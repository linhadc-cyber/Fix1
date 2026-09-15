import { asc, desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { chatMessages, chatSessions } from "@/db/schema";
import {
  emptySessionMemory,
  parseSessionMemory,
  type SessionMemory,
} from "@/lib/ai/session-memory";

export const MAX_CHAT_SESSIONS = 30;

export type SessionSummary = {
  id: number;
  title: string;
  updatedAt: string;
  createdAt: string;
  messageCount: number;
};

function trimOldestSessions(userId: number) {
  const rows = db
    .select({ id: chatSessions.id })
    .from(chatSessions)
    .where(eq(chatSessions.userId, userId))
    .orderBy(desc(chatSessions.updatedAt))
    .all();

  if (rows.length <= MAX_CHAT_SESSIONS) return;
  const drop = rows.slice(MAX_CHAT_SESSIONS);
  for (const row of drop) {
    db.delete(chatMessages).where(eq(chatMessages.sessionId, row.id)).run();
    db.delete(chatSessions).where(eq(chatSessions.id, row.id)).run();
  }
}

export function listChatSessions(userId: number): SessionSummary[] {
  const rows = db
    .select({
      id: chatSessions.id,
      title: chatSessions.title,
      updatedAt: chatSessions.updatedAt,
      createdAt: chatSessions.createdAt,
    })
    .from(chatSessions)
    .where(eq(chatSessions.userId, userId))
    .orderBy(desc(chatSessions.updatedAt))
    .all();

  return rows.map((r) => {
    const count = db
      .select({ n: sql<number>`count(*)` })
      .from(chatMessages)
      .where(eq(chatMessages.sessionId, r.id))
      .get();
    return {
      ...r,
      messageCount: Number(count?.n || 0),
    };
  });
}

export function createChatSession(userId: number, title = "Phiên chat mới") {
  const row = db
    .insert(chatSessions)
    .values({
      userId,
      title: title.slice(0, 120),
      memoryJson: "{}",
    })
    .returning()
    .get();
  trimOldestSessions(userId);
  return row;
}

export function getChatSession(userId: number, sessionId: number) {
  const session = db
    .select()
    .from(chatSessions)
    .where(eq(chatSessions.id, sessionId))
    .get();
  if (!session || session.userId !== userId) return null;

  const messages = db
    .select()
    .from(chatMessages)
    .where(eq(chatMessages.sessionId, sessionId))
    .orderBy(asc(chatMessages.id))
    .all();

  return {
    session,
    messages,
    memory: parseSessionMemory(session.memoryJson),
  };
}

export function getSessionMemory(
  userId: number,
  sessionId: number,
): SessionMemory | null {
  const session = db
    .select()
    .from(chatSessions)
    .where(eq(chatSessions.id, sessionId))
    .get();
  if (!session || session.userId !== userId) return null;
  return parseSessionMemory(session.memoryJson);
}

export function saveSessionMemory(
  userId: number,
  sessionId: number,
  memory: SessionMemory,
) {
  const session = db
    .select()
    .from(chatSessions)
    .where(eq(chatSessions.id, sessionId))
    .get();
  if (!session || session.userId !== userId) return false;
  db.update(chatSessions)
    .set({
      memoryJson: JSON.stringify(memory || emptySessionMemory()),
      updatedAt: sql`(datetime('now'))`,
    })
    .where(eq(chatSessions.id, sessionId))
    .run();
  return true;
}

export function renameChatSession(
  userId: number,
  sessionId: number,
  title: string,
) {
  const session = db
    .select()
    .from(chatSessions)
    .where(eq(chatSessions.id, sessionId))
    .get();
  if (!session || session.userId !== userId) return null;
  db.update(chatSessions)
    .set({
      title: title.trim().slice(0, 120) || session.title,
      updatedAt: sql`(datetime('now'))`,
    })
    .where(eq(chatSessions.id, sessionId))
    .run();
  return getChatSession(userId, sessionId);
}

export function saveChatSession(
  userId: number,
  sessionId: number,
  messages: {
    role: "user" | "assistant";
    content: string;
    sourcesJson?: string;
    mode?: string;
  }[],
  title?: string,
  memory?: SessionMemory,
) {
  const session = db
    .select()
    .from(chatSessions)
    .where(eq(chatSessions.id, sessionId))
    .get();
  if (!session || session.userId !== userId) return null;

  db.delete(chatMessages).where(eq(chatMessages.sessionId, sessionId)).run();

  for (const m of messages) {
    db.insert(chatMessages)
      .values({
        sessionId,
        role: m.role,
        content: m.content,
        sourcesJson: m.sourcesJson || "[]",
        mode: m.mode || "local",
      })
      .run();
  }

  const firstUser = messages.find((m) => m.role === "user")?.content || "";
  const nextTitle =
    (title && title.trim()) ||
    (session.title !== "Phiên chat mới"
      ? session.title
      : firstUser.slice(0, 80) || session.title);

  db.update(chatSessions)
    .set({
      title: nextTitle.slice(0, 120),
      updatedAt: sql`(datetime('now'))`,
      ...(memory ? { memoryJson: JSON.stringify(memory) } : {}),
    })
    .where(eq(chatSessions.id, sessionId))
    .run();

  trimOldestSessions(userId);
  return getChatSession(userId, sessionId);
}

export function deleteChatSession(userId: number, sessionId: number) {
  const session = db
    .select()
    .from(chatSessions)
    .where(eq(chatSessions.id, sessionId))
    .get();
  if (!session || session.userId !== userId) return false;
  db.delete(chatMessages).where(eq(chatMessages.sessionId, sessionId)).run();
  db.delete(chatSessions).where(eq(chatSessions.id, sessionId)).run();
  return true;
}
