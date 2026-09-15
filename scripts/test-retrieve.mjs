import { createRequire } from "node:module";
import path from "node:path";
import { pathToFileURL } from "node:url";

// Use tsx if available; else compile via next isn't easy. Run through node --import tsx
const { retrieveKnowledge } = await import("../src/lib/ai/retrieve.ts");

const q = "hãy hướng dẫn tao cài điện áp cho tủ nạp DC L Salicru";
const hits = retrieveKnowledge(q, 5);
console.log(
  "hits",
  hits.map((h) => ({ type: h.type, id: h.id, title: h.title, score: h.score })),
);
