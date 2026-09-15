import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { count, eq } from "drizzle-orm";
import { db, uploadsDir } from "@/db";
import { articles, cases, media } from "@/db/schema";
import { canEdit, requireUser } from "@/lib/session";
import { extractTextFromBuffer } from "@/lib/knowledge";

export const runtime = "nodejs";

const MAX_BYTES = 2 * 1024 * 1024;
const MAX_ATTACHMENTS = 5;

const ALLOWED_EXT = new Set([".pdf", ".docx", ".jpg", ".jpeg", ".png"]);

function optionalPositiveId(raw: FormDataEntryValue | null): number | null {
  const s = String(raw ?? "").trim();
  if (!s) return null;
  const n = Number(s);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.trunc(n);
}

function kindFromExt(
  ext: string,
  mime: string,
): "pdf" | "image" | "docx" | null {
  if (ext === ".pdf" || mime === "application/pdf") return "pdf";
  if (ext === ".docx") return "docx";
  if (ext === ".jpg" || ext === ".jpeg" || ext === ".png") return "image";
  if (mime.startsWith("image/jpeg") || mime === "image/png") return "image";
  return null;
}

export async function POST(request: Request) {
  const user = await requireUser();
  if (!user || !canEdit(user.role)) {
    return NextResponse.json({ error: "Không có quyền" }, { status: 403 });
  }

  try {
    const form = await request.formData();
    const file = form.get("file");
    const articleId = optionalPositiveId(form.get("articleId"));
    const caseId = optionalPositiveId(form.get("caseId"));

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Thiếu file" }, { status: 400 });
    }
    if ((articleId && caseId) || (!articleId && !caseId)) {
      return NextResponse.json(
        { error: "Chỉ gắn một trong hai: bài viết hoặc tình huống" },
        { status: 400 },
      );
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json(
        {
          error:
            "File vượt quá 2MB. Hãy thu nhỏ (nén ảnh / giảm chất lượng PDF) rồi thử lại.",
          code: "FILE_TOO_LARGE",
        },
        { status: 400 },
      );
    }

    const ext = path.extname(file.name).toLowerCase() || "";
    if (!ALLOWED_EXT.has(ext)) {
      return NextResponse.json(
        { error: "Chỉ nhận PDF, DOCX, JPEG hoặc PNG" },
        { status: 400 },
      );
    }

    const mimeType = file.type || "application/octet-stream";
    const kind = kindFromExt(ext, mimeType);
    if (!kind) {
      return NextResponse.json(
        { error: "Định dạng file không hợp lệ" },
        { status: 400 },
      );
    }

    let equipmentTypeId: number | null = null;
    if (articleId) {
      const a = db
        .select({
          id: articles.id,
          equipmentTypeId: articles.equipmentTypeId,
        })
        .from(articles)
        .where(eq(articles.id, articleId))
        .get();
      if (!a) {
        return NextResponse.json(
          { error: `Không tìm thấy bài viết #${articleId}` },
          { status: 404 },
        );
      }
      equipmentTypeId = a.equipmentTypeId;
      const [{ n }] = db
        .select({ n: count() })
        .from(media)
        .where(eq(media.articleId, articleId))
        .all();
      if (Number(n) >= MAX_ATTACHMENTS) {
        return NextResponse.json(
          {
            error: `Mỗi bài viết tối đa ${MAX_ATTACHMENTS} file đính kèm`,
            code: "TOO_MANY_ATTACHMENTS",
          },
          { status: 400 },
        );
      }
    } else if (caseId) {
      const c = db
        .select({
          id: cases.id,
          equipmentTypeId: cases.equipmentTypeId,
        })
        .from(cases)
        .where(eq(cases.id, caseId))
        .get();
      if (!c) {
        return NextResponse.json(
          { error: `Không tìm thấy tình huống #${caseId}` },
          { status: 404 },
        );
      }
      equipmentTypeId = c.equipmentTypeId;
      const [{ n }] = db
        .select({ n: count() })
        .from(media)
        .where(eq(media.caseId, caseId))
        .all();
      if (Number(n) >= MAX_ATTACHMENTS) {
        return NextResponse.json(
          {
            error: `Mỗi tình huống tối đa ${MAX_ATTACHMENTS} file đính kèm`,
            code: "TOO_MANY_ATTACHMENTS",
          },
          { status: 400 },
        );
      }
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const filename = `${randomUUID()}${ext}`;
    let relPath = "";
    let absPath = "";

    if (kind === "pdf") {
      relPath = path.join("uploads", "pdfs", filename).replace(/\\/g, "/");
      absPath = path.join(uploadsDir, "pdfs", filename);
    } else if (kind === "image") {
      relPath = path.join("uploads", "images", filename).replace(/\\/g, "/");
      absPath = path.join(uploadsDir, "images", filename);
    } else {
      relPath = path.join("uploads", "docs", filename).replace(/\\/g, "/");
      absPath = path.join(uploadsDir, "docs", filename);
    }
    fs.mkdirSync(path.dirname(absPath), { recursive: true });
    fs.writeFileSync(absPath, buffer);

    let fullText = "";
    if (kind === "docx") {
      fullText = await extractTextFromBuffer(buffer, ext);
    }

    const title = file.name.replace(/\.[^.]+$/, "") || file.name;

    const row = db
      .insert(media)
      .values({
        title,
        filename,
        originalName: file.name,
        mimeType: mimeType || "application/octet-stream",
        kind,
        sizeBytes: buffer.length,
        summary: "",
        fullText,
        relPath,
        equipmentTypeId,
        articleId: articleId ?? null,
        caseId: caseId ?? null,
        uploadedById: user.id,
      })
      .returning()
      .get();

    return NextResponse.json({ id: row.id, title: row.title });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[fix1] attach failed:", err);
    return NextResponse.json(
      { error: `Đính kèm thất bại: ${msg}` },
      { status: 500 },
    );
  }
}
