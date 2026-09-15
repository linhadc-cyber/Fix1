import { NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";
import { eq } from "drizzle-orm";
import { dataDir, db, uploadsDir } from "@/db";
import { media } from "@/db/schema";
import { requireUser } from "@/lib/session";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const user = await requireUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;
  const item = db
    .select()
    .from(media)
    .where(eq(media.id, Number(id)))
    .get();
  if (!item) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const filePath = item.relPath
    ? path.join(dataDir, item.relPath)
    : path.join(uploadsDir, item.filename);

  if (!fs.existsSync(filePath)) {
    return NextResponse.json({ error: "File missing" }, { status: 404 });
  }

  const data = fs.readFileSync(filePath);
  return new NextResponse(data, {
    headers: {
      "Content-Type": item.mimeType,
      "Content-Disposition": `inline; filename="${encodeURIComponent(item.originalName)}"`,
      "Content-Length": String(data.length),
    },
  });
}
