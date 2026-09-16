/**
 * Import ONLY sheet "3. Cau hoi loi SP" → Fix1 cases.
 * Usage:
 *   npx tsx scripts/import-huong-dan-xlsx.ts
 *   npx tsx scripts/import-huong-dan-xlsx.ts "C:\\path\\to\\file.xlsx"
 */
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { eq } from "drizzle-orm";
import { db } from "../src/db/index";
import {
  caseTags,
  cases,
  equipmentTypes,
  tags,
  users,
} from "../src/db/schema";
import { slugify, uniqueSlug } from "../src/lib/utils";

const require = createRequire(__filename);
// eslint-disable-next-line @typescript-eslint/no-require-imports
const XLSX = require("xlsx") as typeof import("xlsx");

const SHEET_NAME = "3. Cau hoi loi SP";
const AI_KEYWORDS_MAX = 2000;

const DEFAULT_XLSX = path.join(
  process.env.USERPROFILE || "",
  "Documents",
  "huong_dan-tp_ky_thuat_v1.xlsx",
);

type ParsedRow = {
  stt: number | null;
  productLine: string;
  models: string;
  question: string;
  answer: string;
};

function cellStr(v: unknown): string {
  if (v == null) return "";
  return String(v).trim();
}

function clipKeywords(s: string): string {
  const chars = Array.from(s.trim());
  if (chars.length <= AI_KEYWORDS_MAX) return chars.join("");
  return chars.slice(0, AI_KEYWORDS_MAX).join("");
}

function mapEquipmentSlug(productLine: string): string {
  const t = productLine.toLowerCase();
  if (t.includes("bacs") || t.includes("giám sát aq") || t.includes("giam sat aq")) {
    return "giam-sat-aq";
  }
  if (
    t.includes("dossena") ||
    t.includes("cách điện") ||
    t.includes("cach dien") ||
    t.includes("insulation") ||
    t.includes("giám sát dc") ||
    t.includes("giam sat dc")
  ) {
    return "giam-sat-dc";
  }
  if (
    t.includes("inverter") ||
    t.includes("nghịch lưu") ||
    t.includes("nghich luu") ||
    t.includes("yucoo") ||
    t.includes("cs series") ||
    t.includes("converter")
  ) {
    return "inverter";
  }
  if (t.includes("ups") || t.includes("borri") || t.includes("e2001")) {
    return "ups";
  }
  if (
    t.includes("acquy") ||
    t.includes("ắc quy") ||
    t.includes("ac quy") ||
    t.includes("battery")
  ) {
    return "acquy";
  }
  if (
    t.includes("thyristor") ||
    t.includes("tủ nạp") ||
    t.includes("tu nap") ||
    t.includes("chỉnh lưu") ||
    t.includes("chinh luu") ||
    t.includes("dc-power") ||
    t.includes("salicru")
  ) {
    return "tu-nap";
  }
  if (
    t.includes("vertiv") ||
    t.includes("netsure") ||
    t.includes("tonhe") ||
    t.includes("cấp nguồn") ||
    t.includes("cap nguon")
  ) {
    return "cac-san-pham-khac";
  }
  return "cac-san-pham-khac";
}

function syncTagNames(caseId: number, names: string[]) {
  for (const raw of names) {
    const name = raw.trim().toLowerCase();
    if (!name) continue;
    let tag = db.select().from(tags).where(eq(tags.name, name)).get();
    if (!tag) {
      tag = db.insert(tags).values({ name }).returning().get();
    }
    const existingLinks = db
      .select()
      .from(caseTags)
      .where(eq(caseTags.caseId, caseId))
      .all();
    if (!existingLinks.some((r) => r.tagId === tag.id)) {
      db.insert(caseTags).values({ caseId, tagId: tag.id }).run();
    }
  }
}

function parseSheet3(filePath: string): ParsedRow[] {
  const wb = XLSX.readFile(filePath, { cellDates: false });
  if (!wb.SheetNames.includes(SHEET_NAME)) {
    throw new Error(
      `Không thấy sheet "${SHEET_NAME}". Sheets: ${wb.SheetNames.join(", ")}`,
    );
  }
  const ws = wb.Sheets[SHEET_NAME];
  const rows = XLSX.utils.sheet_to_json<(string | number | null)[]>(ws, {
    header: 1,
    defval: null,
    raw: false,
  });

  const out: ParsedRow[] = [];
  let productLine = "";
  let models = "";

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i] || [];
    const sttRaw = row[0];
    const colProduct = cellStr(row[1]);
    const colModel = cellStr(row[2]);
    const question = cellStr(row[3]);
    const answer = cellStr(row[4]);

    if (i === 0) continue;
    if (colProduct.startsWith("STT") || question === "Câu hỏi") continue;
    if (
      colProduct.startsWith("VD:") ||
      colModel.startsWith("VD:") ||
      question.startsWith("VD:") ||
      answer.startsWith("VD:")
    ) {
      continue;
    }

    if (colProduct) productLine = colProduct;
    if (colModel) models = colModel;

    if (!question || !answer) continue;

    const sttNum = Number(sttRaw);
    const stt = Number.isFinite(sttNum) ? Math.trunc(sttNum) : null;

    out.push({
      stt,
      productLine,
      models,
      question,
      answer,
    });
  }

  return out;
}

async function main() {
  const filePath = path.resolve(process.argv[2] || DEFAULT_XLSX);
  if (!fs.existsSync(filePath)) {
    console.error("Không tìm thấy file:", filePath);
    process.exit(1);
  }

  const admin = db
    .select()
    .from(users)
    .where(eq(users.username, "admin"))
    .get();
  if (!admin) {
    console.error("Chưa có user admin — chạy npm run db:setup trước.");
    process.exit(1);
  }

  const equipBySlug = Object.fromEntries(
    db
      .select()
      .from(equipmentTypes)
      .all()
      .map((e) => [e.slug, e]),
  );

  const parsed = parseSheet3(filePath);
  console.log(`File: ${filePath}`);
  console.log(`Sheet: ${SHEET_NAME}`);
  console.log(`Dòng có câu trả lời: ${parsed.length}`);

  let imported = 0;
  let skippedDup = 0;

  for (const item of parsed) {
    const title = item.question.replace(/\s+/g, " ").slice(0, 200);
    const isCauseQ = /nguyên nhân/i.test(item.question);
    const symptoms = [
      item.question,
      item.productLine ? `Dòng SP: ${item.productLine}` : "",
      item.models ? `Model: ${item.models}` : "",
    ]
      .filter(Boolean)
      .join("\n\n");

    const cause = isCauseQ ? item.answer : "";
    const resolution = item.answer;
    const prevention = "";

    const kwParts = [item.productLine, item.models, item.question]
      .filter(Boolean)
      .join("; ");
    const aiKeywords = clipKeywords(kwParts || title);

    const eqSlug = mapEquipmentSlug(item.productLine);
      const equipment = equipBySlug[eqSlug] || equipBySlug["cac-san-pham-khac"];
      if (!equipment) {
        console.error("Thiếu equipment:", eqSlug);
      process.exit(1);
    }

    const baseSlug =
      item.stt != null
        ? `hd-tp-stt-${item.stt}`
        : `hd-tp-${slugify(title).slice(0, 60)}`;

    const existing = db
      .select()
      .from(cases)
      .where(eq(cases.slug, baseSlug))
      .get();
    if (existing) {
      skippedDup += 1;
      console.log(`= skip trùng: ${baseSlug} — ${title.slice(0, 60)}`);
      continue;
    }

    const slug = uniqueSlug(baseSlug, (s) =>
      Boolean(db.select().from(cases).where(eq(cases.slug, s)).get()),
    );

    const row = db
      .insert(cases)
      .values({
        title,
        slug,
        symptoms,
        cause,
        resolution,
        prevention,
        aiKeywords,
        severity: "medium",
        equipmentTypeId: equipment.id,
        authorId: admin.id,
      })
      .returning()
      .get();

    const tagNames = ["import-huong-dan", eqSlug];
    if (item.productLine) {
      const short = item.productLine.replace(/^\d+\.\s*/, "").slice(0, 40);
      tagNames.push(short);
    }
    syncTagNames(row.id, tagNames);

    imported += 1;
    console.log(
      `+ #${row.id} [${equipment.slug}] ${title.slice(0, 70)}${title.length > 70 ? "…" : ""}`,
    );
  }

  try {
    const { rebuildKnowledgeIndex } = await import(
      "../src/lib/ai/knowledge-index"
    );
    rebuildKnowledgeIndex();
    console.log("Knowledge index rebuilt.");
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn("Knowledge index rebuild skipped:", msg);
  }

  console.log("---");
  console.log(
    `Import xong: +${imported}, skip trùng ${skippedDup}, nguồn ${parsed.length}`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
