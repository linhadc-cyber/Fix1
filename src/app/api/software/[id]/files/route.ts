import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { count, eq } from "drizzle-orm";
import { db, uploadsDir } from "@/db";
import { software, softwareFiles } from "@/db/schema";
import { canEdit, requireUser } from "@/lib/session";

export const runtime = "nodejs";

const MAX_BYTES = 500 * 1024 * 1024;
const MAX_FILES = 5;
const ALLOWED_EXT = new Set([
  ".exe",
  ".zip",
  ".rar",
  ".pdf",
  ".docx",
  ".jpg",
  ".jpeg",
]);

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const user = await requireUser();
  if (!user || !canEdit(user.role)) {
    return NextResponse.json({ error: "Không có quyền" }, { status: 403 });
  }

  const { id: idStr } = await context.params;
  const softwareId = Number(idStr);
  const item = db
    .select()
    .from(software)
    .where(eq(software.id, softwareId))
    .get();
  if (!item) {
    return NextResponse.json({ error: "Không tìm thấy software" }, { status: 404 });
  }

  try {
    const form = await request.formData();
    const rawFiles = form
      .getAll("files")
      .filter((f): f is File => f instanceof File && f.size > 0);

    if (rawFiles.length === 0) {
      return NextResponse.json(
        { error: "Hãy chọn ít nhất 1 file" },
        { status: 400 },
      );
    }

    const existingCount = Number(
      db
        .select({ n: count() })
        .from(softwareFiles)
        .where(eq(softwareFiles.softwareId, softwareId))
        .get()?.n || 0,
    );
    if (existingCount + rawFiles.length > MAX_FILES) {
      return NextResponse.json(
        {
          error: `Tối đa ${MAX_FILES} file (đang có ${existingCount})`,
          code: "TOO_MANY_FILES",
        },
        { status: 400 },
      );
    }

    for (const file of rawFiles) {
      if (file.size >= MAX_BYTES) {
        return NextResponse.json(
          {
            error: `File “${file.name}” phải nhỏ hơn 500MB`,
            code: "FILE_TOO_LARGE",
          },
          { status: 400 },
        );
      }
      const ext = path.extname(file.name).toLowerCase();
      if (!ALLOWED_EXT.has(ext)) {
        return NextResponse.json(
          {
            error: `File “${file.name}” không đúng định dạng (exe/zip/rar/pdf/docx/jpeg)`,
          },
          { status: 400 },
        );
      }
    }

    const softDir = path.join(uploadsDir, "software");
    fs.mkdirSync(softDir, { recursive: true });

    const added: { id: number; originalName: string; sizeBytes: number }[] = [];
    for (const file of rawFiles) {
      const ext = path.extname(file.name).toLowerCase() || ".bin";
      const filename = `${randomUUID()}${ext}`;
      const relPath = path
        .join("uploads", "software", filename)
        .replace(/\\/g, "/");
      const absPath = path.join(uploadsDir, "software", filename);
      const buffer = Buffer.from(await file.arrayBuffer());
      fs.writeFileSync(absPath, buffer);
      const row = db
        .insert(softwareFiles)
        .values({
          softwareId,
          filename,
          originalName: file.name,
          mimeType: file.type || "application/octet-stream",
          sizeBytes: buffer.length,
          relPath,
        })
        .returning()
        .get();
      added.push({
        id: row.id,
        originalName: row.originalName,
        sizeBytes: row.sizeBytes,
      });
    }

    return NextResponse.json({ files: added });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[fix1] software file attach failed:", err);
    return NextResponse.json(
      { error: `Đính kèm file thất bại: ${msg}` },
      { status: 500 },
    );
  }
}
