import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { drizzle } from "drizzle-orm/node-sqlite";
import * as schema from "./schema";
import { ensureChatTables, ensureKnowledgeIndex } from "./migrate";
import { setSqlite } from "./sqlite";

const dataDir = path.join(process.cwd(), "data");
const uploadsDir = path.join(dataDir, "uploads");
const knowledgeDir = path.join(dataDir, "knowledge");
const dbPath = path.join(dataDir, "fix1.db");

const EQUIPMENT_SLUGS = [
  "tu-chinh-luu",
  "inverter",
  "bacs",
  "dossena",
  "nguon-1-chieu",
  "ac-quy",
  "chung",
] as const;

fs.mkdirSync(path.join(uploadsDir, "images"), { recursive: true });
fs.mkdirSync(path.join(uploadsDir, "videos"), { recursive: true });
fs.mkdirSync(path.join(uploadsDir, "pdfs"), { recursive: true });
fs.mkdirSync(path.join(uploadsDir, "docs"), { recursive: true });

for (const slug of EQUIPMENT_SLUGS) {
  for (const sub of ["articles", "cases", "notes"] as const) {
    fs.mkdirSync(path.join(knowledgeDir, slug, sub), { recursive: true });
  }
}

const sqlite = new DatabaseSync(dbPath);
sqlite.exec("PRAGMA journal_mode = WAL;");
sqlite.exec("PRAGMA foreign_keys = ON;");
setSqlite(sqlite);
ensureChatTables(sqlite);
ensureKnowledgeIndex(sqlite);

export const db = drizzle({ client: sqlite, schema });
export { dataDir, uploadsDir, knowledgeDir, dbPath, EQUIPMENT_SLUGS, sqlite };

export function resolveDataPath(relPath: string) {
  return path.join(dataDir, relPath);
}

// Rebuild chỉ mục sau khi module sẵn sàng (dynamic import tránh vòng phụ thuộc)
void import("@/lib/ai/knowledge-index")
  .then((m) => {
    try {
      m.rebuildKnowledgeIndex();
    } catch (err) {
      console.warn("[fix1] knowledge index rebuild skipped:", err);
    }
  })
  .catch(() => {});
