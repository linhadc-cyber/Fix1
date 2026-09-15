"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import {
  articleTags,
  articles,
  caseTags,
  cases,
  media,
  tags,
} from "@/db/schema";
import { canAdmin, canEdit, getSession, requireUser } from "@/lib/session";
import { uniqueSlug } from "@/lib/utils";
import { uploadsDir } from "@/db";
import fs from "node:fs";
import path from "node:path";
import bcrypt from "bcryptjs";
import { users } from "@/db/schema";

export async function logoutAction() {
  const session = await getSession();
  await session.destroy();
  redirect("/login");
}

async function requireEditor() {
  const user = await requireUser();
  if (!user || !canEdit(user.role)) {
    throw new Error("Không có quyền biên tập");
  }
  return user;
}

function syncTags(
  names: string[],
  link: (tagId: number) => void,
  clear: () => void,
) {
  clear();
  for (const raw of names) {
    const name = raw.trim().toLowerCase();
    if (!name) continue;
    let tag = db.select().from(tags).where(eq(tags.name, name)).get();
    if (!tag) {
      tag = db.insert(tags).values({ name }).returning().get();
    }
    link(tag.id);
  }
}

export async function createArticle(formData: FormData) {
  const user = await requireEditor();
  const title = String(formData.get("title") || "").trim();
  const content = String(formData.get("content") || "");
  const equipmentTypeId = Number(formData.get("equipmentTypeId"));
  const tagNames = String(formData.get("tags") || "")
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);

  if (!title || !equipmentTypeId) {
    throw new Error("Thiếu tiêu đề hoặc loại thiết bị");
  }

  const slug = uniqueSlug(title, (s) =>
    Boolean(db.select().from(articles).where(eq(articles.slug, s)).get()),
  );

  const article = db
    .insert(articles)
    .values({
      title,
      slug,
      content,
      equipmentTypeId,
      authorId: user.id,
    })
    .returning()
    .get();

  syncTags(
    tagNames,
    (tagId) => {
      db.insert(articleTags)
        .values({ articleId: article.id, tagId })
        .run();
    },
    () => {},
  );

  try {
    const { rebuildKnowledgeIndex } = await import("@/lib/ai/knowledge-index");
    rebuildKnowledgeIndex();
  } catch {
    /* ignore */
  }

  revalidatePath("/");
  redirect("/");
}

export async function updateArticle(formData: FormData) {
  await requireEditor();
  const id = Number(formData.get("id"));
  const title = String(formData.get("title") || "").trim();
  const content = String(formData.get("content") || "");
  const equipmentTypeId = Number(formData.get("equipmentTypeId"));
  const tagNames = String(formData.get("tags") || "")
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);

  db.update(articles)
    .set({
      title,
      content,
      equipmentTypeId,
      updatedAt: new Date().toISOString().slice(0, 19).replace("T", " "),
    })
    .where(eq(articles.id, id))
    .run();

  syncTags(
    tagNames,
    (tagId) => {
      db.insert(articleTags).values({ articleId: id, tagId }).run();
    },
    () => {
      db.delete(articleTags).where(eq(articleTags.articleId, id)).run();
    },
  );

  try {
    const { rebuildKnowledgeIndex } = await import("@/lib/ai/knowledge-index");
    rebuildKnowledgeIndex();
  } catch {
    /* ignore */
  }

  revalidatePath("/");
  revalidatePath(`/articles/${id}`);
  redirect("/");
}

export async function deleteArticle(formData: FormData) {
  const user = await requireUser();
  if (!user || !canAdmin(user.role)) throw new Error("Chỉ admin mới xóa được");
  const id = Number(formData.get("id"));
  db.delete(articles).where(eq(articles.id, id)).run();
  revalidatePath("/");
  redirect("/");
}

export async function createCase(formData: FormData) {
  const user = await requireEditor();
  const title = String(formData.get("title") || "").trim();
  const symptoms = String(formData.get("symptoms") || "");
  const cause = String(formData.get("cause") || "");
  const resolution = String(formData.get("resolution") || "");
  const prevention = String(formData.get("prevention") || "");
  const severity = String(formData.get("severity") || "medium") as
    | "low"
    | "medium"
    | "high"
    | "critical";
  const equipmentTypeId = Number(formData.get("equipmentTypeId"));
  const tagNames = String(formData.get("tags") || "")
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);

  if (!title || !equipmentTypeId) {
    throw new Error("Thiếu tiêu đề hoặc loại thiết bị");
  }

  const slug = uniqueSlug(title, (s) =>
    Boolean(db.select().from(cases).where(eq(cases.slug, s)).get()),
  );

  const item = db
    .insert(cases)
    .values({
      title,
      slug,
      symptoms,
      cause,
      resolution,
      prevention,
      severity,
      equipmentTypeId,
      authorId: user.id,
    })
    .returning()
    .get();

  syncTags(
    tagNames,
    (tagId) => {
      db.insert(caseTags).values({ caseId: item.id, tagId }).run();
    },
    () => {},
  );

  revalidatePath("/");
  redirect(`/cases/${item.id}`);
}

export async function updateCase(formData: FormData) {
  await requireEditor();
  const id = Number(formData.get("id"));
  const title = String(formData.get("title") || "").trim();
  const symptoms = String(formData.get("symptoms") || "");
  const cause = String(formData.get("cause") || "");
  const resolution = String(formData.get("resolution") || "");
  const prevention = String(formData.get("prevention") || "");
  const severity = String(formData.get("severity") || "medium") as
    | "low"
    | "medium"
    | "high"
    | "critical";
  const equipmentTypeId = Number(formData.get("equipmentTypeId"));
  const tagNames = String(formData.get("tags") || "")
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);

  db.update(cases)
    .set({
      title,
      symptoms,
      cause,
      resolution,
      prevention,
      severity,
      equipmentTypeId,
      updatedAt: new Date().toISOString().slice(0, 19).replace("T", " "),
    })
    .where(eq(cases.id, id))
    .run();

  syncTags(
    tagNames,
    (tagId) => {
      db.insert(caseTags).values({ caseId: id, tagId }).run();
    },
    () => {
      db.delete(caseTags).where(eq(caseTags.caseId, id)).run();
    },
  );

  revalidatePath(`/cases/${id}`);
  redirect(`/cases/${id}`);
}

export async function deleteCase(formData: FormData) {
  const user = await requireUser();
  if (!user || !canAdmin(user.role)) throw new Error("Chỉ admin mới xóa được");
  const id = Number(formData.get("id"));
  db.delete(cases).where(eq(cases.id, id)).run();
  revalidatePath("/");
  redirect("/");
}

export async function createUser(formData: FormData) {
  const user = await requireUser();
  if (!user || !canAdmin(user.role)) throw new Error("Chỉ admin");

  const username = String(formData.get("username") || "").trim();
  const displayName = String(formData.get("displayName") || "").trim();
  const password = String(formData.get("password") || "");
  const role = String(formData.get("role") || "viewer") as
    | "admin"
    | "editor"
    | "viewer";

  if (!username || !displayName || !password) {
    throw new Error("Thiếu thông tin");
  }

  const existing = db
    .select()
    .from(users)
    .where(eq(users.username, username))
    .get();
  if (existing) throw new Error("Username đã tồn tại");

  const passwordHash = await bcrypt.hash(password, 10);
  db.insert(users)
    .values({ username, displayName, passwordHash, role, disabled: false })
    .run();

  revalidatePath("/admin/users");
  redirect("/admin/users");
}

export async function updateUser(formData: FormData) {
  const me = await requireUser();
  if (!me || !canAdmin(me.role)) throw new Error("Chỉ admin");

  const id = Number(formData.get("id"));
  const username = String(formData.get("username") || "").trim();
  const displayName = String(formData.get("displayName") || "").trim();
  const password = String(formData.get("password") || "");
  const role = String(formData.get("role") || "viewer") as
    | "admin"
    | "editor"
    | "viewer";
  const disabled = String(formData.get("disabled") || "") === "1";

  if (!id || !username || !displayName) {
    throw new Error("Thiếu thông tin");
  }

  const target = db.select().from(users).where(eq(users.id, id)).get();
  if (!target) throw new Error("Không tìm thấy user");

  const clash = db
    .select()
    .from(users)
    .where(eq(users.username, username))
    .get();
  if (clash && clash.id !== id) throw new Error("Username đã tồn tại");

  if (id === me.id && disabled) {
    throw new Error("Không thể khóa chính mình");
  }
  if (id === me.id && role !== "admin") {
    throw new Error("Không thể tự bỏ quyền admin của mình");
  }

  const patch: {
    username: string;
    displayName: string;
    role: "admin" | "editor" | "viewer";
    disabled: boolean;
    passwordHash?: string;
  } = { username, displayName, role, disabled };

  if (password) {
    patch.passwordHash = await bcrypt.hash(password, 10);
  }

  db.update(users).set(patch).where(eq(users.id, id)).run();
  revalidatePath("/admin/users");
  redirect("/admin/users");
}

export async function deleteUser(formData: FormData) {
  const me = await requireUser();
  if (!me || !canAdmin(me.role)) throw new Error("Chỉ admin");
  const id = Number(formData.get("id"));
  if (!id || id === me.id) throw new Error("Không thể xóa chính mình");

  const target = db.select().from(users).where(eq(users.id, id)).get();
  if (!target) throw new Error("Không tìm thấy user");

  const hasContent =
    Boolean(db.select().from(articles).where(eq(articles.authorId, id)).get()) ||
    Boolean(db.select().from(cases).where(eq(cases.authorId, id)).get()) ||
    Boolean(
      db.select().from(media).where(eq(media.uploadedById, id)).get(),
    );
  if (hasContent) {
    throw new Error(
      "Tài khoản đã có bài/tình huống/file — hãy Khóa thay vì Xóa để giữ lịch sử.",
    );
  }

  db.delete(users).where(eq(users.id, id)).run();
  revalidatePath("/admin/users");
  redirect("/admin/users");
}

export async function toggleUserDisabled(formData: FormData) {
  const me = await requireUser();
  if (!me || !canAdmin(me.role)) throw new Error("Chỉ admin");
  const id = Number(formData.get("id"));
  if (id === me.id) throw new Error("Không thể khóa chính mình");
  const target = db.select().from(users).where(eq(users.id, id)).get();
  if (!target) throw new Error("Không tìm thấy user");
  db.update(users)
    .set({ disabled: !target.disabled })
    .where(eq(users.id, id))
    .run();
  revalidatePath("/admin/users");
  redirect("/admin/users");
}

export async function deleteMedia(formData: FormData) {
  const user = await requireUser();
  if (!user || !canEdit(user.role)) throw new Error("Không có quyền");
  const id = Number(formData.get("id"));
  const item = db.select().from(media).where(eq(media.id, id)).get();
  if (item) {
    const filePath = item.relPath
      ? path.join(process.cwd(), "data", item.relPath)
      : path.join(uploadsDir, item.filename);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    db.delete(media).where(eq(media.id, id)).run();
  }
  revalidatePath("/library");
  redirect("/library?tab=docs");
}
