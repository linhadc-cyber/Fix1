import type { DatabaseSync } from "node:sqlite";

/** Tạo bảng nếu chưa có (không cần drizzle-kit khi deploy LAN). */
export function ensureChatTables(sqlite: DatabaseSync) {
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS chat_sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      title TEXT NOT NULL DEFAULT 'Phiên chat mới',
      memory_json TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS chat_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id INTEGER NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
      role TEXT NOT NULL,
      content TEXT NOT NULL DEFAULT '',
      sources_json TEXT NOT NULL DEFAULT '[]',
      mode TEXT NOT NULL DEFAULT 'local',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_chat_sessions_user_updated
      ON chat_sessions(user_id, updated_at DESC);
    CREATE INDEX IF NOT EXISTS idx_chat_messages_session
      ON chat_messages(session_id, id);
  `);

  // DB cũ: thêm cột memory_json nếu thiếu
  try {
    const cols = sqlite
      .prepare(`PRAGMA table_info(chat_sessions)`)
      .all() as { name: string }[];
    if (!cols.some((c) => c.name === "memory_json")) {
      sqlite.exec(
        `ALTER TABLE chat_sessions ADD COLUMN memory_json TEXT NOT NULL DEFAULT '{}'`,
      );
    }
  } catch {
    /* ignore */
  }
}

/** FTS5 + bảng chunk — tìm đoạn nhanh, tiết kiệm token. */
export function ensureKnowledgeIndex(sqlite: DatabaseSync) {
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS knowledge_chunks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      source_type TEXT NOT NULL,
      source_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      href TEXT NOT NULL,
      equipment TEXT NOT NULL DEFAULT '',
      chunk TEXT NOT NULL,
      chunk_index INTEGER NOT NULL DEFAULT 0
    );
    CREATE INDEX IF NOT EXISTS idx_knowledge_chunks_source
      ON knowledge_chunks(source_type, source_id);
  `);

  // FTS có thể chưa có trên một số build — bọc try
  try {
    sqlite.exec(`
      CREATE VIRTUAL TABLE IF NOT EXISTS knowledge_fts USING fts5(
        title,
        chunk,
        source_type UNINDEXED,
        source_id UNINDEXED,
        href UNINDEXED,
        equipment UNINDEXED,
        chunk_rowid UNINDEXED,
        tokenize = 'unicode61'
      );
    `);
  } catch {
    // bỏ qua nếu FTS5 không khả dụng
  }
}
