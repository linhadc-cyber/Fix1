import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { eq } from "drizzle-orm";
import { db, uploadsDir } from "@/db";
import { equipmentTypes, media } from "@/db/schema";
import { canEdit, requireUser } from "@/lib/session";
import { mediaKindFromMime } from "@/lib/utils";
import {
  ensureKnowledgeParent,
  extractTextFromBuffer,
  knowledgeRelPath,
} from "@/lib/knowledge";

export const runtime = "nodejs";

function optionalPositiveId(raw: FormDataEntryValue | null): number | null {
  const s = String(raw ?? "").trim();
  if (!s) return null;
  const n = Number(s);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.trunc(n);
}

export async function POST(request: Request) {
  const user = await requireUser();
  if (!user || !canEdit(user.role)) {
    return NextResponse.json({ error: "Không có quyền" }, { status: 403 });
  }

  try {
    const form = await request.formData();
    const file = form.get("file");
    const title = String(form.get("title") || "").trim();
    const summary = String(form.get("summary") || "").trim();
    const folder = String(form.get("folder") || "notes") as
      | "articles"
      | "cases"
      | "notes";
    const equipmentTypeId = optionalPositiveId(form.get("equipmentTypeId"));

    if (!(file instanceof File) || !title) {
      return NextResponse.json(
        { error: "Thiếu file hoặc tiêu đề" },
        { status: 400 },
      );
    }
    if (!equipmentTypeId) {
      return NextResponse.json(
        { error: "Hãy chọn loại thiết bị" },
        { status: 400 },
      );
    }

    const ext = path.extname(file.name).toLowerCase() || "";
    const buffer = Buffer.from(await file.arrayBuffer());
    const mimeType = file.type || "application/octet-stream";

    let kind = mediaKindFromMime(mimeType);
    if (ext === ".md" || ext === ".markdown" || ext === ".txt") {
      kind = "markdown";
    }
    if (ext === ".docx") kind = "docx";

    const isKnowledge = kind === "markdown" || kind === "docx";
    if (!isKnowledge && (kind === "pdf" || kind === "other")) {
      return NextResponse.json(
        {
          error:
            "Tài liệu chữ hãy upload .md hoặc .docx. PDF không nhận. Ảnh/video vẫn upload được.",
        },
        { status: 400 },
      );
    }

    const eqRow = db
      .select()
      .from(equipmentTypes)
      .where(eq(equipmentTypes.id, equipmentTypeId))
      .get();
    if (!eqRow) {
      return NextResponse.json(
        { error: "Loại thiết bị không hợp lệ" },
        { status: 400 },
      );
    }
    const equipmentSlug = eqRow.slug;

    const filename = `${randomUUID()}${ext || ".bin"}`;
    let relPath = "";
    let absPath = "";

    if (isKnowledge) {
      const safeFolder =
        folder === "articles" || folder === "cases" ? folder : "notes";
      relPath = knowledgeRelPath(equipmentSlug, safeFolder, filename);
      absPath = ensureKnowledgeParent(relPath);
    } else if (kind === "image") {
      relPath = path.join("uploads", "images", filename).replace(/\\/g, "/");
      absPath = path.join(uploadsDir, "images", filename);
      fs.mkdirSync(path.dirname(absPath), { recursive: true });
    } else if (kind === "video") {
      relPath = path.join("uploads", "videos", filename).replace(/\\/g, "/");
      absPath = path.join(uploadsDir, "videos", filename);
      fs.mkdirSync(path.dirname(absPath), { recursive: true });
    } else {
      relPath = path.join("uploads", filename).replace(/\\/g, "/");
      absPath = path.join(uploadsDir, filename);
      fs.mkdirSync(path.dirname(absPath), { recursive: true });
    }

    fs.writeFileSync(absPath, buffer);

    let fullText = "";
    if (isKnowledge) {
      fullText = await extractTextFromBuffer(buffer, ext);
    }

    if (isKnowledge && !fullText.trim() && !summary) {
      try {
        fs.unlinkSync(absPath);
      } catch {
        // ignore
      }
      return NextResponse.json(
        { error: "Không trích được chữ từ file. Hãy thêm tóm tắt." },
        { status: 400 },
      );
    }

    const row = db
      .insert(media)
      .values({
        title,
        filename,
        originalName: file.name,
        mimeType,
        kind,
        sizeBytes: buffer.length,
        summary,
        fullText,
        relPath,
        equipmentTypeId,
        uploadedById: user.id,
      })
      .returning()
      .get();

    return NextResponse.json({ id: row.id });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[fix1] upload failed:", err);
    return NextResponse.json(
      { error: `Upload thất bại: ${msg}` },
      { status: 500 },
    );
  }
}
