import { sql } from "drizzle-orm";
import { integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const users = sqliteTable("users", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  username: text("username").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  displayName: text("display_name").notNull(),
  role: text("role", { enum: ["admin", "editor", "viewer"] })
    .notNull()
    .default("viewer"),
  disabled: integer("disabled", { mode: "boolean" }).notNull().default(false),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(datetime('now'))`),
});

export const equipmentTypes = sqliteTable("equipment_types", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  description: text("description").notNull().default(""),
  sortOrder: integer("sort_order").notNull().default(0),
});

export const articles = sqliteTable("articles", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  title: text("title").notNull(),
  slug: text("slug").notNull().unique(),
  content: text("content").notNull().default(""),
  equipmentTypeId: integer("equipment_type_id")
    .notNull()
    .references(() => equipmentTypes.id),
  authorId: integer("author_id")
    .notNull()
    .references(() => users.id),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(datetime('now'))`),
  updatedAt: text("updated_at")
    .notNull()
    .default(sql`(datetime('now'))`),
});

export const cases = sqliteTable("cases", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  title: text("title").notNull(),
  slug: text("slug").notNull().unique(),
  symptoms: text("symptoms").notNull().default(""),
  cause: text("cause").notNull().default(""),
  resolution: text("resolution").notNull().default(""),
  prevention: text("prevention").notNull().default(""),
  severity: text("severity", {
    enum: ["low", "medium", "high", "critical"],
  })
    .notNull()
    .default("medium"),
  equipmentTypeId: integer("equipment_type_id")
    .notNull()
    .references(() => equipmentTypes.id),
  authorId: integer("author_id")
    .notNull()
    .references(() => users.id),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(datetime('now'))`),
  updatedAt: text("updated_at")
    .notNull()
    .default(sql`(datetime('now'))`),
});

export const tags = sqliteTable("tags", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull().unique(),
});

export const articleTags = sqliteTable(
  "article_tags",
  {
    articleId: integer("article_id")
      .notNull()
      .references(() => articles.id, { onDelete: "cascade" }),
    tagId: integer("tag_id")
      .notNull()
      .references(() => tags.id, { onDelete: "cascade" }),
  },
  (t) => [uniqueIndex("article_tags_uniq").on(t.articleId, t.tagId)],
);

export const caseTags = sqliteTable(
  "case_tags",
  {
    caseId: integer("case_id")
      .notNull()
      .references(() => cases.id, { onDelete: "cascade" }),
    tagId: integer("tag_id")
      .notNull()
      .references(() => tags.id, { onDelete: "cascade" }),
  },
  (t) => [uniqueIndex("case_tags_uniq").on(t.caseId, t.tagId)],
);

export const media = sqliteTable("media", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  title: text("title").notNull(),
  filename: text("filename").notNull(),
  originalName: text("original_name").notNull(),
  mimeType: text("mime_type").notNull(),
  kind: text("kind", {
    enum: ["pdf", "image", "video", "markdown", "docx", "other"],
  })
    .notNull()
    .default("other"),
  sizeBytes: integer("size_bytes").notNull().default(0),
  summary: text("summary").notNull().default(""),
  fullText: text("full_text").notNull().default(""),
  relPath: text("rel_path").notNull().default(""),
  equipmentTypeId: integer("equipment_type_id").references(
    () => equipmentTypes.id,
  ),
  articleId: integer("article_id").references(() => articles.id, {
    onDelete: "set null",
  }),
  caseId: integer("case_id").references(() => cases.id, {
    onDelete: "set null",
  }),
  uploadedById: integer("uploaded_by_id")
    .notNull()
    .references(() => users.id),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(datetime('now'))`),
});

export const chatSessions = sqliteTable("chat_sessions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  title: text("title").notNull().default("Phiên chat mới"),
  /** JSON SessionMemory: summary + focusDocs + notes */
  memoryJson: text("memory_json").notNull().default("{}"),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(datetime('now'))`),
  updatedAt: text("updated_at")
    .notNull()
    .default(sql`(datetime('now'))`),
});

export const chatMessages = sqliteTable("chat_messages", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  sessionId: integer("session_id")
    .notNull()
    .references(() => chatSessions.id, { onDelete: "cascade" }),
  role: text("role", { enum: ["user", "assistant"] }).notNull(),
  content: text("content").notNull().default(""),
  sourcesJson: text("sources_json").notNull().default("[]"),
  mode: text("mode").notNull().default("local"),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(datetime('now'))`),
});

export type UserRole = "admin" | "editor" | "viewer";
export type Severity = "low" | "medium" | "high" | "critical";
export type MediaKind =
  | "pdf"
  | "image"
  | "video"
  | "markdown"
  | "docx"
  | "other";
