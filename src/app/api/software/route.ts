import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { db, uploadsDir } from "@/db";
import { software, softwareFiles } from "@/db/schema";
import { canEdit, requireUser } from "@/lib/session";
import { requireAiKeywords } from "@/lib/ai-keywords";

export const runtime = "nodejs";

const MAX_BYTES = 500 * 1024 * 1024; // exclusive upper bound: size < this
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

export async function POST(request: Request) {
  const user = await requireUser();
  if (!user || !canEdit(user.role)) {
    return NextResponse.json({ error: "Không có quyền" }, { status: 403 });
  }

  try {
    const form = await request.formData();
    const name = String(form.get("name") || "").trim();
    const functionText = String(form.get("functionText") || "").trim();
    const vendor = String(form.get("vendor") || "").trim();
    const notes = String(form.get("notes") || "").trim();

    let aiKeywords = "";
    try {
      aiKeywords = requireAiKeywords(form.get("aiKeywords"));
    } catch (e) {
      return NextResponse.json(
        { error: e instanceof Error ? e.message : "Keyword AI không hợp lệ" },
        { status: 400 },
      );
    }

    if (!name || !functionText || !vendor) {
      return NextResponse.json(
        { error: "Thiếu tên, chức năng hoặc hãng sản xuất" },
        { status: 400 },
      );
    }

    const rawFiles = form.getAll("files").filter((f): f is File => f instanceof File);
    if (rawFiles.length === 0) {
      return NextResponse.json(
        { error: "Hãy chọn ít nhất 1 file" },
        { status: 400 },
      );
    }
    if (rawFiles.length > MAX_FILES) {
      return NextResponse.json(
        {
          error: `Mỗi lần tối đa ${MAX_FILES} file`,
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

    const row = db
      .insert(software)
      .values({
        name,
        functionText,
        vendor,
        notes,
        aiKeywords,
        uploadedById: user.id,
      })
      .returning()
      .get();

    const softDir = path.join(uploadsDir, "software");
    fs.mkdirSync(softDir, { recursive: true });

    for (const file of rawFiles) {
      const ext = path.extname(file.name).toLowerCase() || ".bin";
      const filename = `${randomUUID()}${ext}`;
      const relPath = path.join("uploads", "software", filename).replace(/\\/g, "/");
      const absPath = path.join(uploadsDir, "software", filename);
      const buffer = Buffer.from(await file.arrayBuffer());
      fs.writeFileSync(absPath, buffer);
      db.insert(softwareFiles)
        .values({
          softwareId: row.id,
          filename,
          originalName: file.name,
          mimeType: file.type || "application/octet-stream",
          sizeBytes: buffer.length,
          relPath,
        })
        .run();
    }

    return NextResponse.json({ id: row.id });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[fix1] software upload failed:", err);
    return NextResponse.json(
      { error: `Upload software thất bại: ${msg}` },
      { status: 500 },
    );
  }
}
