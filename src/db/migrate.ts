import type { DatabaseSync } from "node:sqlite";
import { EQUIPMENT_CATALOG } from "@/lib/equipment-catalog";

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

function addColumnIfMissing(
  sqlite: DatabaseSync,
  table: string,
  column: string,
  ddl: string,
) {
  try {
    const cols = sqlite
      .prepare(`PRAGMA table_info(${table})`)
      .all() as { name: string }[];
    if (!cols.some((c) => c.name === column)) {
      sqlite.exec(`ALTER TABLE ${table} ADD COLUMN ${ddl}`);
    }
  } catch {
    /* ignore */
  }
}

/** Software catalog + AI keywords trên articles/cases. */
export function ensureSoftwareTables(sqlite: DatabaseSync) {
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS software (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      function TEXT NOT NULL DEFAULT '',
      vendor TEXT NOT NULL DEFAULT '',
      notes TEXT NOT NULL DEFAULT '',
      ai_keywords TEXT NOT NULL DEFAULT '',
      uploaded_by_id INTEGER NOT NULL REFERENCES users(id),
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS software_files (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      software_id INTEGER NOT NULL REFERENCES software(id) ON DELETE CASCADE,
      filename TEXT NOT NULL,
      original_name TEXT NOT NULL,
      mime_type TEXT NOT NULL DEFAULT 'application/octet-stream',
      size_bytes INTEGER NOT NULL DEFAULT 0,
      rel_path TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_software_created
      ON software(created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_software_files_software
      ON software_files(software_id);
  `);

  addColumnIfMissing(
    sqlite,
    "software",
    "equipment_type_id",
    `equipment_type_id INTEGER REFERENCES equipment_types(id)`,
  );
  try {
    sqlite.exec(
      `CREATE INDEX IF NOT EXISTS idx_software_equipment ON software(equipment_type_id)`,
    );
  } catch {
    /* ignore */
  }

  addColumnIfMissing(
    sqlite,
    "articles",
    "ai_keywords",
    `ai_keywords TEXT NOT NULL DEFAULT ''`,
  );
  addColumnIfMissing(
    sqlite,
    "cases",
    "ai_keywords",
    `ai_keywords TEXT NOT NULL DEFAULT ''`,
  );
}

type EquipRow = {
  id: number;
  slug: string;
  name: string;
  description: string;
  sort_order: number;
};

function reassignEquipmentContent(
  sqlite: DatabaseSync,
  fromId: number,
  toId: number,
) {
  if (fromId === toId) return;
  for (const table of ["articles", "cases", "media", "software"] as const) {
    try {
      sqlite
        .prepare(
          `UPDATE ${table} SET equipment_type_id = ? WHERE equipment_type_id = ?`,
        )
        .run(toId, fromId);
    } catch {
      /* bảng có thể chưa có cột / chưa tồn tại */
    }
  }
}

/**
 * Đồng bộ danh mục thiết bị:
 * Tủ nạp · Acquy · Inverter · Giám sát AQ · Giám sát DC · UPS · Các sản phẩm khác
 */
export function ensureEquipmentCatalog(sqlite: DatabaseSync) {
  try {
    const findBySlug = (slug: string) =>
      sqlite
        .prepare(
          `SELECT id, slug, name, description, sort_order FROM equipment_types WHERE slug = ?`,
        )
        .get(slug) as EquipRow | undefined;

    for (const item of EQUIPMENT_CATALOG) {
      const candidates = [item.slug, ...(item.aliases || [])];
      let primary: EquipRow | undefined;
      for (const s of candidates) {
        const row = findBySlug(s);
        if (row) {
          primary = row;
          break;
        }
      }

      if (!primary) {
        sqlite
          .prepare(
            `INSERT INTO equipment_types (slug, name, description, sort_order)
             VALUES (?, ?, ?, ?)`,
          )
          .run(item.slug, item.name, item.description, item.sortOrder);
        primary = findBySlug(item.slug);
      } else if (
        primary.slug !== item.slug ||
        primary.name !== item.name ||
        primary.description !== item.description ||
        primary.sort_order !== item.sortOrder
      ) {
        sqlite
          .prepare(
            `UPDATE equipment_types
             SET slug = ?, name = ?, description = ?, sort_order = ?
             WHERE id = ?`,
          )
          .run(
            item.slug,
            item.name,
            item.description,
            item.sortOrder,
            primary.id,
          );
        primary = findBySlug(item.slug) || { ...primary, slug: item.slug };
      }

      if (!primary) continue;

      for (const alias of item.aliases || []) {
        if (alias === item.slug) continue;
        const orphan = findBySlug(alias);
        if (orphan && orphan.id !== primary.id) {
          reassignEquipmentContent(sqlite, orphan.id, primary.id);
          sqlite
            .prepare(`DELETE FROM equipment_types WHERE id = ?`)
            .run(orphan.id);
        }
      }
    }
  } catch (err) {
    console.warn("[fix1] equipment catalog sync skipped:", err);
  }
}
