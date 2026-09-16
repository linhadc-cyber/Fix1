/**
 * Smoke: rebuild index + tìm "E2001" / tên software.
 * Chạy: npx tsx scripts/verify-software-index.ts
 */
import { db } from "../src/db";
import { software } from "../src/db/schema";
import {
  rebuildKnowledgeIndex,
  searchKnowledgeChunks,
} from "../src/lib/ai/knowledge-index";
import { queryTokens } from "../src/lib/ai/retrieve";
import { selectAndPackDocuments } from "../src/lib/ai/doc-pack";

const soft = db.select().from(software).all();
console.log(
  "software rows:",
  soft.map((s) => ({
    id: s.id,
    name: s.name,
    keywords: s.aiKeywords,
  })),
);

const n = rebuildKnowledgeIndex();
console.log("chunks indexed:", n);

const sampleQ = soft[0]
  ? `phần mềm ${soft[0].name}`
  : "phần mềm E2001";
const tokens = queryTokens(sampleQ);
console.log("query:", sampleQ, "tokens:", tokens);

const hits = searchKnowledgeChunks(tokens, 4);
console.log(
  "hits:",
  hits.map((h) => ({
    type: h.sourceType,
    id: h.sourceId,
    title: h.title,
    score: h.score,
    href: h.href,
  })),
);

const packed = selectAndPackDocuments({
  searchText: sampleQ,
  followUp: false,
  maxDocs: 2,
});
console.log(
  "packed:",
  packed.map((p) => ({
    type: p.type,
    id: p.id,
    title: p.title,
    href: p.href,
    score: p.score,
  })),
);

const softHit = hits.find((h) => h.sourceType === "software");
if (!soft.length) {
  console.log("WARN: chưa có software trong DB — thêm 1 mục rồi chạy lại.");
  process.exit(0);
}
if (!softHit) {
  console.error("FAIL: không tìm thấy software trong hits");
  process.exit(1);
}
console.log("OK: chỉ điểm software", softHit.title, softHit.href);
