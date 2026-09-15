import fs from "node:fs";
import path from "node:path";
import mammoth from "mammoth";
import { knowledgeDir } from "@/db";

export async function extractTextFromBuffer(
  buffer: Buffer,
  ext: string,
): Promise<string> {
  const lower = ext.toLowerCase();
  if (lower === ".md" || lower === ".markdown" || lower === ".txt") {
    return buffer.toString("utf8");
  }
  if (lower === ".docx") {
    const result = await mammoth.extractRawText({ buffer });
    return result.value || "";
  }
  return "";
}

export function knowledgeRelPath(
  equipmentSlug: string,
  folder: "articles" | "cases" | "notes",
  filename: string,
) {
  const slug = equipmentSlug || "chung";
  return path.join("knowledge", slug, folder, filename).replace(/\\/g, "/");
}

export function ensureKnowledgeParent(relPath: string) {
  const abs = path.join(process.cwd(), "data", relPath);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  return abs;
}

export { knowledgeDir };
