import { searchKnowledgeChunks } from "@/lib/ai/knowledge-index";

export type RetrievedSource = {
  type: "article" | "case" | "doc" | "software";
  id: number;
  title: string;
  equipmentName: string | null;
  equipmentSlug: string | null;
  excerpt: string;
  text: string;
  href: string;
  score: number;
};

const QUERY_STOPWORDS = new Set([
  "hãy",
  "hay",
  "hướng",
  "dẫn",
  "tao",
  "tôi",
  "mình",
  "cho",
  "của",
  "với",
  "và",
  "là",
  "cái",
  "các",
  "một",
  "này",
  "đó",
  "thì",
  "làm",
  "sao",
  "gì",
  "như",
  "thế",
  "nào",
  "xin",
  "vui",
  "lòng",
  "please",
  "help",
  "how",
  "to",
  "the",
  "a",
  "an",
  "of",
  "for",
  "in",
  "on",
  "về",
  "nói",
  "trong",
  "tài",
  "liệu",
  "tailieu",
  "en",
  "or",
  "and",
  "with",
  "from",
  "that",
  "this",
  "what",
  "when",
  "where",
  "which",
  "có",
  "không",
  "được",
  "những",
  "cũng",
  "đã",
  "sẽ",
  "rất",
  "nhé",
  "ạ",
]);

export function queryTokens(query: string): string[] {
  const lower = query.toLowerCase();
  const raw = lower
    .split(/[\s,.;:!?/\\()\[\]{}「」""''<>+=|_-]+/)
    .map((t) => t.trim())
    .filter((t) => {
      if (!t || QUERY_STOPWORDS.has(t)) return false;
      if (/\d/.test(t)) return t.length >= 2;
      return t.length >= 3;
    });

  const phraseHits =
    lower.match(/\b(?:iec|en|iso|ieee)[/\s-]*\d{3,5}(?:-\d+)?\b/gi) || [];
  for (const p of phraseHits) {
    raw.push(p.replace(/\s+/g, "").toLowerCase());
    const digits = p.match(/\d{3,5}(?:-\d+)?/);
    if (digits) raw.push(digits[0]);
  }

  const seen = new Set<string>();
  const out: string[] = [];
  const ranked = [...raw].sort((a, b) => {
    const aw = (/\d/.test(a) ? 100 : 0) + a.length;
    const bw = (/\d/.test(b) ? 100 : 0) + b.length;
    return bw - aw;
  });
  for (const t of ranked) {
    if (seen.has(t)) continue;
    seen.add(t);
    out.push(t);
    if (out.length >= 8) break;
  }
  return out;
}

export function wantsInternet(question: string, flag?: boolean): boolean {
  if (flag) return true;
  const q = question.toLowerCase();
  return (
    /(tìm|tra|search).{0,24}(internet|web|mạng|online)/i.test(q) ||
    /kiến thức (ngoài|chung|internet)/i.test(q) ||
    /lên (mạng|internet|web)/i.test(q) ||
    /web_search|google/i.test(q)
  );
}

/** Tra cứu đoạn chunk đã index — ít token, đúng chỗ. */
export function retrieveKnowledge(query: string, limit = 4): RetrievedSource[] {
  const q = query.trim();
  if (!q) return [];
  const tokens = queryTokens(q);
  if (tokens.length === 0) return [];

  const hits = searchKnowledgeChunks(tokens, limit);
  return hits.map((h) => ({
    type: h.sourceType,
    id: h.sourceId,
    title: h.title,
    equipmentName: h.equipment || null,
    equipmentSlug: null,
    excerpt: h.chunk,
    text: h.chunk,
    href: h.href,
    score: h.score,
  }));
}

export function buildPromptContext(sources: RetrievedSource[]) {
  if (sources.length === 0) {
    return "Không tìm thấy đoạn khớp trong Fix1.";
  }
  // Ngắn gọn để tiết kiệm token
  return sources
    .map((s, i) => {
      const label =
        s.type === "article"
          ? `Bài #${s.id}`
          : s.type === "case"
            ? `Tình huống #${s.id}`
            : s.type === "software"
              ? `Software #${s.id}`
              : `Tài liệu #${s.id}`;
      return `[${i + 1}] ${label} | ${s.title}${s.equipmentName ? ` | ${s.equipmentName}` : ""}
${s.href}
${s.excerpt}`;
    })
    .join("\n\n");
}

export function sourceLabel(s: RetrievedSource) {
  if (s.type === "article") return `Bài #${s.id}`;
  if (s.type === "case") return `Tình huống #${s.id}`;
  if (s.type === "software") return `Software #${s.id}`;
  return `Tài liệu #${s.id}`;
}
