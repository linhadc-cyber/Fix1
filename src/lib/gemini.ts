import { like, or } from "drizzle-orm";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { db } from "@/db";
import { articles, cases, media } from "@/db/schema";

export function hasGeminiKey() {
  return Boolean(process.env.GEMINI_API_KEY?.trim());
}

export function searchLocalKnowledge(query: string, limit = 8) {
  const q = query.trim();
  if (!q) return { articles: [], cases: [], media: [] };
  const pattern = `%${q}%`;

  const articleHits = db
    .select({
      id: articles.id,
      title: articles.title,
      content: articles.content,
    })
    .from(articles)
    .where(or(like(articles.title, pattern), like(articles.content, pattern)))
    .limit(limit)
    .all();

  const caseHits = db
    .select({
      id: cases.id,
      title: cases.title,
      symptoms: cases.symptoms,
      cause: cases.cause,
      resolution: cases.resolution,
      prevention: cases.prevention,
    })
    .from(cases)
    .where(
      or(
        like(cases.title, pattern),
        like(cases.symptoms, pattern),
        like(cases.cause, pattern),
        like(cases.resolution, pattern),
        like(cases.prevention, pattern),
      ),
    )
    .limit(limit)
    .all();

  const mediaHits = db
    .select({
      id: media.id,
      title: media.title,
      kind: media.kind,
    })
    .from(media)
    .where(or(like(media.title, pattern), like(media.originalName, pattern)))
    .limit(5)
    .all();

  return { articles: articleHits, cases: caseHits, media: mediaHits };
}

function buildContext(local: ReturnType<typeof searchLocalKnowledge>) {
  const parts: string[] = [];

  for (const a of local.articles) {
    parts.push(
      `[Bài #${a.id}] ${a.title}\n${a.content.slice(0, 1200)}`,
    );
  }
  for (const c of local.cases) {
    parts.push(
      `[Tình huống #${c.id}] ${c.title}\nTriệu chứng: ${c.symptoms}\nNguyên nhân: ${c.cause}\nXử lý: ${c.resolution}\nPhòng ngừa: ${c.prevention}`,
    );
  }
  for (const m of local.media) {
    parts.push(`[Media #${m.id} · ${m.kind}] ${m.title}`);
  }

  return parts.join("\n\n---\n\n").slice(0, 14000);
}

export async function askGemini(opts: {
  question: string;
  mode: "local" | "hybrid";
}) {
  const key = process.env.GEMINI_API_KEY?.trim();
  if (!key) {
    throw new Error(
      "Chưa cấu hình GEMINI_API_KEY. Thêm vào file .env.local rồi khởi động lại server.",
    );
  }

  const local = searchLocalKnowledge(opts.question);
  const context = buildContext(local);
  const hasLocal = context.length > 0;

  const system = `Bạn là trợ lý kỹ thuật Fix1 cho kỹ sư sửa chữa thiết bị điện/UPS/ắc quy tại công ty.
Trả lời bằng tiếng Việt, rõ ràng, có bước kiểm tra an toàn khi cần.
Ưu tiên kiến thức nội bộ Fix1 nếu có. Khi trích dẫn, ghi rõ [Bài #id] hoặc [Tình huống #id].
${
  opts.mode === "hybrid"
    ? "Nếu kiến thức nội bộ thiếu, bạn có thể bổ sung kiến thức kỹ thuật chung (internet/general knowledge), nhưng phải ghi rõ phần nào là từ Fix1 và phần nào là kiến thức bổ sung."
    : "Chỉ trả lời dựa trên ngữ cảnh Fix1 bên dưới. Nếu thiếu dữ liệu, nói rõ và gợi ý kỹ sư nên ghi thêm tình huống/bài viết."
}`;

  const prompt = `${system}

=== NGỮ CẢNH FIX1 ${hasLocal ? "" : "(không tìm thấy mục khớp từ khóa)"} ===
${hasLocal ? context : "Không có bài/tình huống khớp."}

=== CÂU HỎI KỸ SƯ ===
${opts.question}`;

  const genAI = new GoogleGenerativeAI(key);
  const modelName = process.env.GEMINI_MODEL?.trim() || "gemini-2.0-flash";
  const model = genAI.getGenerativeModel({ model: modelName });
  const result = await model.generateContent(prompt);
  const answer = result.response.text();

  return {
    answer,
    sources: {
      articles: local.articles.map((a) => ({ id: a.id, title: a.title })),
      cases: local.cases.map((c) => ({ id: c.id, title: c.title })),
      media: local.media.map((m) => ({ id: m.id, title: m.title, kind: m.kind })),
    },
    mode: opts.mode,
  };
}
