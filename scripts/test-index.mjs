import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

// Boot db module
await import("../src/db/index.ts");
const { rebuildKnowledgeIndex, searchKnowledgeChunks } = await import(
  "../src/lib/ai/knowledge-index.ts"
);
const { queryTokens, retrieveKnowledge } = await import(
  "../src/lib/ai/retrieve.ts"
);

const n = rebuildKnowledgeIndex();
console.log("chunks", n);
const tokens = queryTokens("IEC/EN 61204");
console.log("tokens", tokens);
console.log(
  "retrieve",
  retrieveKnowledge("IEC/EN 61204 nói gì?", 3).map((h) => ({
    id: h.id,
    title: h.title,
    has: h.excerpt.toLowerCase().includes("61204"),
    len: h.excerpt.length,
  })),
);
