import { getSqlite } from "@/db/sqlite";

export type KnowledgeSourceType = "article" | "case" | "doc" | "software";

type ChunkRow = {
  source_type: string;
  source_id: number;
  title: string;
  href: string;
  equipment: string;
  chunk: string;
  chunk_index: number;
};

const TARGET = 900;
const OVERLAP = 120;

/** Cắt văn bản thành đoạn ngắn quanh heading/paragraph. */
export function splitIntoChunks(text: string, target = TARGET): string[] {
  const cleaned = text.replace(/\r\n/g, "\n").trim();
  if (!cleaned) return [];
  if (cleaned.length <= target) return [cleaned];

  const parts = cleaned.split(/\n{2,}|(?=^#{1,3}\s)/m).filter((p) => p.trim());
  const chunks: string[] = [];
  let buf = "";

  const flush = () => {
    const t = buf.trim();
    if (t) chunks.push(t);
    buf = "";
  };

  for (const part of parts) {
    const p = part.trim();
    if (!p) continue;
    if (!buf) {
      buf = p;
      continue;
    }
    if (buf.length + 2 + p.length <= target) {
      buf = `${buf}\n\n${p}`;
    } else {
      flush();
      const prev = chunks[chunks.length - 1] || "";
      const tail = prev.slice(Math.max(0, prev.length - OVERLAP));
      buf = tail ? `${tail}\n\n${p}` : p;
      if (buf.length > target * 2) {
        for (let i = 0; i < buf.length; i += target - OVERLAP) {
          chunks.push(buf.slice(i, i + target));
        }
        buf = "";
      }
    }
  }
  flush();
  return chunks.length ? chunks : [cleaned.slice(0, target)];
}

function hasFts() {
  try {
    const sqlite = getSqlite();
    const row = sqlite
      .prepare(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='knowledge_fts'",
      )
      .get() as { name?: string } | undefined;
    return Boolean(row?.name);
  } catch {
    return false;
  }
}

function keywordBlock(keywords: string | null | undefined) {
  const k = String(keywords || "").trim();
  return k ? `Keyword AI: ${k}` : "";
}

/** Rebuild toàn bộ chỉ mục kiến thức. */
export function rebuildKnowledgeIndex() {
  const sqlite = getSqlite();
  const equipmentById = new Map(
    (
      sqlite.prepare("SELECT id, name FROM equipment_types").all() as {
        id: number;
        name: string;
      }[]
    ).map((e) => [e.id, e.name]),
  );

  const rows: ChunkRow[] = [];

  const arts = sqlite
    .prepare(
      "SELECT id, title, content, ai_keywords, equipment_type_id FROM articles",
    )
    .all() as {
    id: number;
    title: string;
    content: string;
    ai_keywords: string;
    equipment_type_id: number;
  }[];

  for (const a of arts) {
    const kw = keywordBlock(a.ai_keywords);
    const pieces = splitIntoChunks(
      [`# ${a.title}`, kw, a.content || ""].filter(Boolean).join("\n\n"),
    );
    pieces.forEach((chunk, i) => {
      rows.push({
        source_type: "article",
        source_id: a.id,
        title: a.title,
        href: `/articles/${a.id}`,
        equipment: equipmentById.get(a.equipment_type_id) || "",
        chunk,
        chunk_index: i,
      });
    });
  }

  const caseRows = sqlite
    .prepare(
      `SELECT id, title, symptoms, cause, resolution, prevention, ai_keywords, equipment_type_id
       FROM cases`,
    )
    .all() as {
    id: number;
    title: string;
    symptoms: string;
    cause: string;
    resolution: string;
    prevention: string;
    ai_keywords: string;
    equipment_type_id: number;
  }[];

  for (const c of caseRows) {
    const body = [
      `# ${c.title}`,
      keywordBlock(c.ai_keywords),
      `Triệu chứng: ${c.symptoms}`,
      `Nguyên nhân: ${c.cause}`,
      `Xử lý: ${c.resolution}`,
      `Phòng ngừa: ${c.prevention}`,
    ]
      .filter(Boolean)
      .join("\n\n");
    splitIntoChunks(body).forEach((chunk, i) => {
      rows.push({
        source_type: "case",
        source_id: c.id,
        title: c.title,
        href: `/cases/${c.id}`,
        equipment: equipmentById.get(c.equipment_type_id) || "",
        chunk,
        chunk_index: i,
      });
    });
  }

  const docs = sqlite
    .prepare(
      `SELECT id, title, kind, summary, full_text, equipment_type_id FROM media`,
    )
    .all() as {
    id: number;
    title: string;
    kind: string;
    summary: string;
    full_text: string;
    equipment_type_id: number | null;
  }[];

  for (const d of docs) {
    if (
      d.kind !== "markdown" &&
      d.kind !== "docx" &&
      !d.full_text &&
      !d.summary
    ) {
      continue;
    }
    const body = `# ${d.title}\n\n${d.summary ? `Tóm tắt: ${d.summary}\n\n` : ""}${d.full_text || ""}`;
    splitIntoChunks(body).forEach((chunk, i) => {
      rows.push({
        source_type: "doc",
        source_id: d.id,
        title: d.title,
        href: `/media/${d.id}`,
        equipment: d.equipment_type_id
          ? equipmentById.get(d.equipment_type_id) || ""
          : "",
        chunk,
        chunk_index: i,
      });
    });
  }

  // Software: tên + Keyword AI là điểm chỉ chính cho AI
  let softRows: {
    id: number;
    name: string;
    function: string;
    vendor: string;
    notes: string;
    ai_keywords: string;
    equipment_type_id: number | null;
  }[] = [];
  try {
    softRows = sqlite
      .prepare(
        `SELECT id, name, function, vendor, notes, ai_keywords, equipment_type_id
         FROM software`,
      )
      .all() as typeof softRows;
  } catch {
    softRows = [];
  }

  for (const s of softRows) {
    const kw = keywordBlock(s.ai_keywords);
    const eqName = s.equipment_type_id
      ? equipmentById.get(s.equipment_type_id) || ""
      : "";
    const body = [
      `# ${s.name}`,
      kw,
      s.ai_keywords?.trim()
        ? `Từ khóa chỉ điểm: ${s.name} ${s.ai_keywords}`
        : `Từ khóa chỉ điểm: ${s.name}`,
      eqName ? `Thiết bị: ${eqName}` : "",
      `Hãng: ${s.vendor || ""}`,
      `Chức năng: ${s.function || ""}`,
      s.notes?.trim() ? `Ghi chú / hướng dẫn: ${s.notes}` : "",
    ]
      .filter(Boolean)
      .join("\n\n");
    splitIntoChunks(body).forEach((chunk, i) => {
      rows.push({
        source_type: "software",
        source_id: s.id,
        title: s.name,
        href: `/software/${s.id}`,
        equipment: eqName || s.vendor || "",
        chunk,
        chunk_index: i,
      });
    });
  }

  sqlite.exec("DELETE FROM knowledge_chunks;");
  const insert = sqlite.prepare(
    `INSERT INTO knowledge_chunks
      (source_type, source_id, title, href, equipment, chunk, chunk_index)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  );
  for (const r of rows) {
    insert.run(
      r.source_type,
      r.source_id,
      r.title,
      r.href,
      r.equipment,
      r.chunk,
      r.chunk_index,
    );
  }

  if (hasFts()) {
    try {
      sqlite.exec("DELETE FROM knowledge_fts;");
      sqlite
        .prepare(
          `INSERT INTO knowledge_fts
            (title, chunk, source_type, source_id, href, equipment, chunk_rowid)
           SELECT title, chunk, source_type, source_id, href, equipment, id
           FROM knowledge_chunks`,
        )
        .run();
    } catch {
      /* ignore */
    }
  }

  return rows.length;
}

function scoreHaystack(tokens: string[], title: string, chunk: string) {
  const hay = `${title}\n${chunk}`.toLowerCase();
  const titleLower = title.toLowerCase();
  let score = 0;
  for (const t of tokens) {
    const tok = t.toLowerCase();
    if (!hay.includes(tok)) continue;
    // Mã/tên trong title (vd E2001) ưu tiên mạnh — chỉ điểm đúng software
    if (titleLower.includes(tok)) {
      score += /\d/.test(tok) ? 24 : tok.length >= 5 ? 12 : 6;
    } else {
      score += /\d/.test(tok) ? 8 : tok.length >= 5 ? 3 : 1;
    }
    if (
      chunk.toLowerCase().includes("keyword ai:") &&
      chunk.toLowerCase().includes(tok)
    ) {
      score += /\d/.test(tok) ? 10 : 4;
    }
  }
  return score;
}

export function searchKnowledgeChunks(
  tokens: string[],
  limit = 4,
): {
  sourceType: KnowledgeSourceType;
  sourceId: number;
  title: string;
  href: string;
  equipment: string;
  chunk: string;
  score: number;
}[] {
  const sqlite = getSqlite();
  const ftsTerms = tokens
    .filter((t) => t.length >= 2)
    .slice(0, 6)
    .map((t) => `"${t.replace(/"/g, "")}"`)
    .join(" OR ");

  type Raw = {
    source_type: string;
    source_id: number;
    title: string;
    href: string;
    equipment: string;
    chunk: string;
    score: number;
  };

  let hits: Raw[] = [];

  if (ftsTerms && hasFts()) {
    try {
      hits = sqlite
        .prepare(
          `SELECT
            source_type AS source_type,
            source_id AS source_id,
            title AS title,
            href AS href,
            equipment AS equipment,
            chunk AS chunk,
            rank * -1 AS score
           FROM knowledge_fts
           WHERE knowledge_fts MATCH ?
           ORDER BY rank
           LIMIT ?`,
        )
        .all(ftsTerms, limit * 4) as Raw[];
      // Re-score với ưu tiên title/keyword (FTS rank chỉ để lọc ứng viên)
      hits = hits.map((h) => ({
        ...h,
        score: scoreHaystack(tokens, h.title, h.chunk) || h.score,
      }));
    } catch {
      hits = [];
    }
  }

  if (hits.length === 0) {
    const all = sqlite
      .prepare(
        `SELECT source_type, source_id, title, href, equipment, chunk
         FROM knowledge_chunks`,
      )
      .all() as Omit<Raw, "score">[];

    hits = all
      .map((row) => ({
        ...row,
        score: scoreHaystack(tokens, row.title, row.chunk),
      }))
      .filter((r) => r.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit * 4);
  }

  const best = new Map<string, Raw>();
  for (const h of hits) {
    const key = `${h.source_type}:${h.source_id}`;
    const prev = best.get(key);
    if (!prev || h.score > prev.score) best.set(key, h);
  }

  return [...best.values()]
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((h) => ({
      sourceType: h.source_type as KnowledgeSourceType,
      sourceId: h.source_id,
      title: h.title,
      href: h.href,
      equipment: h.equipment,
      chunk: h.chunk.slice(0, 1200),
      score: h.score,
    }));
}

/** Lấy đoạn trong các nguồn đang focus phiên — khớp token nếu có. */
export function getChunksForSources(
  focus: { type: string; id: number }[],
  tokens: string[],
  perSource = 2,
): {
  sourceType: KnowledgeSourceType;
  sourceId: number;
  title: string;
  href: string;
  equipment: string;
  chunk: string;
  score: number;
}[] {
  if (!focus.length) return [];
  const sqlite = getSqlite();
  const out: {
    sourceType: KnowledgeSourceType;
    sourceId: number;
    title: string;
    href: string;
    equipment: string;
    chunk: string;
    score: number;
  }[] = [];

  for (const f of focus.slice(0, 6)) {
    const rows = sqlite
      .prepare(
        `SELECT source_type, source_id, title, href, equipment, chunk
         FROM knowledge_chunks
         WHERE source_type = ? AND source_id = ?
         ORDER BY chunk_index ASC`,
      )
      .all(f.type, f.id) as {
      source_type: string;
      source_id: number;
      title: string;
      href: string;
      equipment: string;
      chunk: string;
    }[];

    const scored = rows.map((row) => ({
      row,
      score: 5 + scoreHaystack(tokens, row.title, row.chunk),
    }));

    scored
      .sort((a, b) => b.score - a.score)
      .slice(0, perSource)
      .forEach(({ row, score }) => {
        out.push({
          sourceType: row.source_type as KnowledgeSourceType,
          sourceId: row.source_id,
          title: row.title,
          href: row.href,
          equipment: row.equipment,
          chunk: row.chunk.slice(0, 1200),
          score,
        });
      });
  }

  return out.sort((a, b) => b.score - a.score);
}
