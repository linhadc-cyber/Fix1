import { NextResponse } from "next/server";
import path from "node:path";
import { canEdit, requireUser } from "@/lib/session";
import { extractTextFromBuffer } from "@/lib/knowledge";

export const runtime = "nodejs";

const MAX_BYTES = 8 * 1024 * 1024;

export async function POST(request: Request) {
  const user = await requireUser();
  if (!user || !canEdit(user.role)) {
    return NextResponse.json({ error: "Không có quyền" }, { status: 403 });
  }

  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Thiếu file" }, { status: 400 });
  }

  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      { error: "File quá lớn (tối đa 8MB). Hãy tách chương." },
      { status: 400 },
    );
  }

  const ext = path.extname(file.name).toLowerCase();
  if (![".md", ".markdown", ".txt", ".docx"].includes(ext)) {
    return NextResponse.json(
      { error: "Chỉ nhận .md, .txt hoặc .docx" },
      { status: 400 },
    );
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const text = (await extractTextFromBuffer(buffer, ext)).trim();
  if (!text) {
    return NextResponse.json(
      { error: "Không trích được chữ từ file" },
      { status: 400 },
    );
  }

  return NextResponse.json({ text, name: file.name });
}
