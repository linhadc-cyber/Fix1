import { getSqlite } from "@/db/sqlite";

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
      "SELECT id, title, content, equipment_type_id FROM articles",
    )
    .all() as {
    id: number;
    title: string;
    content: string;
    equipment_type_id: number;
  }[];

  for (const a of arts) {
    const pieces = splitIntoChunks(`# ${a.title}\n\n${a.content}`);
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
      `SELECT id, title, symptoms, cause, resolution, prevention, equipment_type_id
       FROM cases`,
    )
    .all() as {
    id: number;
    title: string;
    symptoms: string;
    cause: string;
    resolution: string;
    prevention: string;
    equipment_type_id: number;
  }[];

  for (const c of caseRows) {
    const body = [
      `# ${c.title}`,
      `Triệu chứng: ${c.symptoms}`,
      `Nguyên nhân: ${c.cause}`,
      `Xử lý: ${c.resolution}`,
      `Phòng ngừa: ${c.prevention}`,
    ].join("\n");
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

export function searchKnowledgeChunks(
  tokens: string[],
  limit = 4,
): {
  sourceType: "article" | "case" | "doc";
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
      .map((row) => {
        const hay = `${row.title}\n${row.chunk}`.toLowerCase();
        let score = 0;
        for (const t of tokens) {
          if (!hay.includes(t)) continue;
          score += /\d/.test(t) ? 8 : t.length >= 5 ? 3 : 1;
        }
        return { ...row, score };
      })
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
      sourceType: h.source_type as "article" | "case" | "doc",
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
  sourceType: "article" | "case" | "doc";
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
    sourceType: "article" | "case" | "doc";
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

    const scored = rows.map((row) => {
      const hay = `${row.title}\n${row.chunk}`.toLowerCase();
      let score = 5; // nền tảng vì đang focus
      for (const t of tokens) {
        if (hay.includes(t.toLowerCase())) {
          score += /\d/.test(t) ? 8 : t.length >= 5 ? 3 : 1;
        }
      }
      return { row, score };
    });

    scored
      .sort((a, b) => b.score - a.score)
      .slice(0, perSource)
      .forEach(({ row, score }) => {
        out.push({
          sourceType: row.source_type as "article" | "case" | "doc",
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
