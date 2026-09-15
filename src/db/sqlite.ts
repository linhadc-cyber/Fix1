import type { DatabaseSync } from "node:sqlite";

let sqliteRef: DatabaseSync | null = null;

export function setSqlite(db: DatabaseSync) {
  sqliteRef = db;
}

export function getSqlite() {
  if (!sqliteRef) {
    throw new Error("SQLite chưa khởi tạo");
  }
  return sqliteRef;
}
