import { getSqlite } from "@/db/sqlite";
import { queryTokens } from "@/lib/ai/retrieve";
import { searchKnowledgeChunks } from "@/lib/ai/knowledge-index";
import type { FocusSource } from "@/lib/ai/session-memory";

export type PackedDoc = {
  type: "article" | "case" | "doc";
  id: number;
  title: string;
  href: string;
  equipmentName: string | null;
  score: number;
  /** Nội dung đưa AI đọc (full hoặc các mục khớp). */
  body: string;
  mode: "full" | "sections";
};

const FULL_DOC_CHARS = 14000;
const MAX_DOCS = 2;
const TOTAL_BODY_BUDGET = 28000;

function scoreBody(tokens: string[], text: string) {
  const hay = text.toLowerCase();
  let score = 0;
  for (const t of tokens) {
    if (!hay.includes(t.toLowerCase())) continue;
    score += /\d/.test(t) ? 8 : t.length >= 5 ? 3 : 1;
  }
  return score;
}

function loadDocumentBody(
  type: string,
  id: number,
): {
  title: string;
  href: string;
  equipment: string;
  body: string;
} | null {
  const sqlite = getSqlite();

  if (type === "article") {
    const row = sqlite
      .prepare(
        `SELECT a.id, a.title, a.content,
                coalesce(e.name,'') AS equipment
         FROM articles a
         LEFT JOIN equipment_types e ON e.id = a.equipment_type_id
         WHERE a.id = ?`,
      )
      .get(id) as
      | { id: number; title: string; content: string; equipment: string }
      | undefined;
    if (!row) return null;
    return {
      title: row.title,
      href: `/articles/${row.id}`,
      equipment: row.equipment,
      body: `# ${row.title}\n\n${row.content || ""}`,
    };
  }

  if (type === "case") {
    const row = sqlite
      .prepare(
        `SELECT c.id, c.title, c.symptoms, c.cause, c.resolution, c.prevention,
                coalesce(e.name,'') AS equipment
         FROM cases c
         LEFT JOIN equipment_types e ON e.id = c.equipment_type_id
         WHERE c.id = ?`,
      )
      .get(id) as
      | {
          id: number;
          title: string;
          symptoms: string;
          cause: string;
          resolution: string;
          prevention: string;
          equipment: string;
        }
      | undefined;
    if (!row) return null;
    return {
      title: row.title,
      href: `/cases/${row.id}`,
      equipment: row.equipment,
      body: [
        `# ${row.title}`,
        `Triệu chứng: ${row.symptoms}`,
        `Nguyên nhân: ${row.cause}`,
        `Xử lý: ${row.resolution}`,
        `Phòng ngừa: ${row.prevention}`,
      ].join("\n\n"),
    };
  }

  const row = sqlite
    .prepare(
      `SELECT m.id, m.title, m.summary, m.full_text,
              coalesce(e.name,'') AS equipment
       FROM media m
       LEFT JOIN equipment_types e ON e.id = m.equipment_type_id
       WHERE m.id = ?`,
    )
    .get(id) as
    | {
        id: number;
        title: string;
        summary: string;
        full_text: string;
        equipment: string;
      }
    | undefined;
  if (!row) return null;
  return {
    title: row.title,
    href: `/media/${row.id}`,
    equipment: row.equipment,
    body: `# ${row.title}\n\n${row.summary ? `Tóm tắt: ${row.summary}\n\n` : ""}${row.full_text || ""}`,
  };
}

/** Cắt tài liệu dài thành các mục quanh heading / đoạn, lấy mục khớp key. */
function packLongDocument(body: string, tokens: string[], budget: number) {
  const parts = body
    .replace(/\r\n/g, "\n")
    .split(/\n(?=#{1,3}\s)|\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);

  if (parts.length <= 1) {
    // Cửa sổ quanh token
    const lower = body.toLowerCase();
    const wins: { start: number; end: number; score: number }[] = [];
    for (const t of tokens) {
      let from = 0;
      let g = 0;
      while (g++ < 20) {
        const idx = lower.indexOf(t.toLowerCase(), from);
        if (idx < 0) break;
        wins.push({
          start: Math.max(0, idx - 900),
          end: Math.min(body.length, idx + t.length + 900),
          score: /\d/.test(t) ? 8 : 3,
        });
        from = idx + t.length;
      }
    }
    if (!wins.length) {
      return {
        text: body.slice(0, budget),
        mode: "sections" as const,
      };
    }
    wins.sort((a, b) => b.score - a.score);
    const picked: typeof wins = [];
    for (const w of wins) {
      const overlap = picked.find(
        (p) => !(w.end < p.start - 100 || w.start > p.end + 100),
      );
      if (overlap) {
        overlap.start = Math.min(overlap.start, w.start);
        overlap.end = Math.max(overlap.end, w.end);
        continue;
      }
      if (picked.length >= 4) continue;
      picked.push({ ...w });
    }
    picked.sort((a, b) => a.start - b.start);
    let used = 0;
    const chunks: string[] = [];
    for (const w of picked) {
      let c = body.slice(w.start, w.end).trim();
      if (w.start > 0) c = `…${c}`;
      if (w.end < body.length) c = `${c}…`;
      if (used + c.length > budget) c = c.slice(0, Math.max(0, budget - used));
      if (!c) break;
      chunks.push(c);
      used += c.length;
      if (used >= budget) break;
    }
    return { text: chunks.join("\n\n---\n\n"), mode: "sections" as const };
  }

  const scored = parts.map((p, i) => ({
    i,
    p,
    score: scoreBody(tokens, p) + (i === 0 ? 1 : 0),
  }));
  scored.sort((a, b) => b.score - a.score || a.i - b.i);

  const chosen = scored
    .filter((s) => s.score > 0)
    .slice(0, 8)
    .sort((a, b) => a.i - b.i);

  const useParts = chosen.length ? chosen : scored.slice(0, 3);
  let text = "";
  // Mục lục ngắn
  const outline = parts
    .filter((p) => /^#{1,3}\s/.test(p) || p.length < 80)
    .slice(0, 20)
    .map((p) => p.split("\n")[0].slice(0, 100));
  if (outline.length > 2) {
    text += `MỤC LỤC GỢI Ý:\n${outline.map((o) => `- ${o}`).join("\n")}\n\n`;
  }
  for (const { p } of useParts) {
    if (text.length >= budget) break;
    const piece = p.slice(0, budget - text.length);
    text += `${piece}\n\n`;
  }
  return { text: text.trim(), mode: "sections" as const };
}

/**
 * Lớp A: key scan chọn tài liệu.
 * Lớp B: đóng gói full hoặc các mục khớp để AI đọc đủ.
 */
export function selectAndPackDocuments(opts: {
  searchText: string;
  extraKeys?: string[];
  focusSources?: FocusSource[];
  followUp: boolean;
  maxDocs?: number;
}): PackedDoc[] {
  const maxDocs = opts.maxDocs ?? MAX_DOCS;
  const tokens = [
    ...queryTokens(opts.searchText),
    ...(opts.extraKeys || []).flatMap((k) => queryTokens(k)),
    ...(opts.extraKeys || []).map((k) => k.toLowerCase()),
  ];
  const uniq = [...new Set(tokens.filter(Boolean))].slice(0, 12);

  type Cand = {
    type: "article" | "case" | "doc";
    id: number;
    score: number;
    title: string;
    href: string;
    equipment: string;
  };
  const candMap = new Map<string, Cand>();

  const addCand = (c: Cand) => {
    const key = `${c.type}:${c.id}`;
    const prev = candMap.get(key);
    if (!prev || c.score > prev.score) candMap.set(key, c);
  };

  if (uniq.length) {
    for (const h of searchKnowledgeChunks(uniq, maxDocs * 4)) {
      addCand({
        type: h.sourceType,
        id: h.sourceId,
        score: h.score,
        title: h.title,
        href: h.href,
        equipment: h.equipment,
      });
    }
  }

  if (opts.focusSources?.length) {
    for (const f of opts.focusSources) {
      const key = `${f.type}:${f.id}`;
      const prev = candMap.get(key);
      if (prev) {
        prev.score += opts.followUp ? 40 : 20;
      } else if (opts.followUp || !uniq.length) {
        const loaded = loadDocumentBody(f.type, f.id);
        if (loaded) {
          addCand({
            type: f.type,
            id: f.id,
            score: opts.followUp ? 50 : 15,
            title: loaded.title,
            href: loaded.href,
            equipment: loaded.equipment,
          });
        }
      }
    }
  }

  let ranked = [...candMap.values()].sort((a, b) => b.score - a.score);

  if (opts.followUp && opts.focusSources?.length) {
    const focusKeys = new Set(
      opts.focusSources.map((f) => `${f.type}:${f.id}`),
    );
    const focused = ranked.filter((c) => focusKeys.has(`${c.type}:${c.id}`));
    if (focused.length) ranked = focused;
  }

  const picked = ranked.slice(0, maxDocs);
  const packed: PackedDoc[] = [];
  let budgetLeft = TOTAL_BODY_BUDGET;

  for (const c of picked) {
    if (budgetLeft < 2000) break;
    const loaded = loadDocumentBody(c.type, c.id);
    if (!loaded) continue;

    let body: string;
    let mode: "full" | "sections";
    const perBudget = Math.min(FULL_DOC_CHARS, budgetLeft);

    if (loaded.body.length <= FULL_DOC_CHARS && loaded.body.length <= budgetLeft) {
      body = loaded.body;
      mode = "full";
    } else {
      const packedLong = packLongDocument(loaded.body, uniq, perBudget);
      body = packedLong.text;
      mode = packedLong.mode;
    }

    budgetLeft -= body.length;
    packed.push({
      type: c.type,
      id: c.id,
      title: loaded.title,
      href: loaded.href,
      equipmentName: loaded.equipment || null,
      score: c.score,
      body,
      mode,
    });
  }

  return packed;
}

export function buildDocPromptContext(docs: PackedDoc[]) {
  if (!docs.length) {
    return "Không tìm thấy tài liệu khớp trong Fix1.";
  }
  return docs
    .map((d, i) => {
      const label =
        d.type === "article"
          ? `Bài #${d.id}`
          : d.type === "case"
            ? `Tình huống #${d.id}`
            : `Tài liệu #${d.id}`;
      const how =
        d.mode === "full"
          ? "TOÀN BỘ nội dung nguồn (Fix1 đã chỉ đúng tài liệu này)"
          : "CÁC MỤC/ĐOẠN khớp từ khóa trong nguồn (tài liệu dài — đã lọc mục liên quan)";
      return `[${i + 1}] ${label} | ${d.title}${d.equipmentName ? ` | ${d.equipmentName}` : ""}
Link: ${d.href}
(${how})
-----
${d.body}`;
    })
    .join("\n\n");
}

export function packedToRetrieved(docs: PackedDoc[]) {
  return docs.map((d) => ({
    type: d.type,
    id: d.id,
    title: d.title,
    equipmentName: d.equipmentName,
    equipmentSlug: null as string | null,
    excerpt: d.body.slice(0, 480),
    text: d.body.slice(0, 480),
    href: d.href,
    score: d.score,
  }));
}
