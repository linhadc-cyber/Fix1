import { retrieveKnowledge, queryTokens, extractRelevantExcerpts } from "../src/lib/ai/retrieve.ts";

const q = "IEC/EN 61204 nói gì trong tài liệu?";
const hits = retrieveKnowledge(q, 6);
console.log(
  "tokens",
  queryTokens(q),
  hits.map((h) => ({
    id: h.id,
    title: h.title,
    score: h.score,
    excerptHas61204: h.excerpt.toLowerCase().includes("61204"),
    excerptLen: h.excerpt.length,
    head: h.excerpt.slice(0, 220).replace(/\s+/g, " "),
  })),
);
