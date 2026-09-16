/**
 * Điều phối Fix1 ↔ AI:
 * - Key scan → chỉ điểm tài liệu → đóng gói full/mục cho AI đọc đủ
 * - Bộ nhớ phiên (tóm tắt + nguồn neo) — không gửi lại cả chat dài
 */

import {
  callChatModel,
  callChatModelWithWebSearch,
} from "@/lib/ai/ask";
import {
  buildDocPromptContext,
  packedToRetrieved,
  selectAndPackDocuments,
} from "@/lib/ai/doc-pack";
import { sourceLabel, wantsInternet, type RetrievedSource } from "@/lib/ai/retrieve";
import { queryTokens } from "@/lib/ai/retrieve";
import {
  emptySessionMemory,
  parseSessionMemory,
  updateSessionMemoryHeuristic,
  type FocusSource,
  type HistoryItem,
  type SessionMemory,
} from "@/lib/ai/session-memory";

export type { FocusSource, HistoryItem, SessionMemory };
export { emptySessionMemory, parseSessionMemory };

/** Ngữ cảnh cố định — mọi phiên đều dùng. */
export const FIX1_SYSTEM_POLICY = `Bạn là trợ lý kỹ thuật Fix1 cho kỹ sư sửa chữa thiết bị điện / UPS / ắc quy / tủ nạp / chỉnh lưu.

NGỮ CẢNH HỆ THỐNG (BẮT BUỘC):
1. Chỉ trả lời bằng tiếng Việt, giọng súc tích, thuật ngữ kỹ thuật rõ ràng.
2. Chỉ viết tiếng Anh khi user yêu cầu soạn email / thư gửi hãng. Khi đó: email EN + tóm tắt VI ngắn.
3. Không dùng kiến thức ngoài kho Fix1 trừ khi được phép (cờ internet). Thiếu dữ liệu → nói thiếu, không bịa.
4. Bám BỘ NHỚ PHIÊN + tài liệu Fix1 đã chỉ. Câu nối: đừng đổi tài liệu/chủ đề trừ khi user hỏi chủ đề mới rõ.
5. Trích dẫn [Bài #id] / [Tình huống #id] / [Software #id] / [Tài liệu #id] + link /articles|cases|software|media/...
6. Hỏi phần mềm/tool (vd E2001): ưu tiên nguồn [Software #id] đã chỉ — bám Keyword AI + chức năng/ghi chú của mục đó.
7. Đọc kỹ NỘI DUNG TÀI LIỆU Fix1 giao (có thể là toàn bộ nguồn hoặc các mục liên quan). Trả lời đúng trọng tâm câu hỏi.`;

export function isMostlyEnglish(text: string): boolean {
  const q = text.trim();
  if (q.length < 12) return false;
  if (
    /[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]/i.test(
      q,
    )
  ) {
    return false;
  }
  const words = q.split(/\s+/).filter(Boolean);
  if (words.length < 4) return false;
  const ascii = words.filter((w) => /^[a-zA-Z0-9'.,;:!?%/+_-]+$/.test(w));
  return ascii.length / words.length >= 0.72;
}

export function isFollowUpQuestion(question: string, hasContext: boolean) {
  if (!hasContext) return false;
  const q = question.trim().toLowerCase();
  if (q.length <= 80) {
    if (
      /^(còn|thế|vậy|và|như|giải thích|làm rõ|chi tiết|tiếp|phần|mục|đoạn|câu|ý|ở trên|như trên|như vậy|ok|tiếp đi)/i.test(
        q,
      )
    ) {
      return true;
    }
    if (
      /\b(this|that|it|above|same|also|more|detail|explain|continue|what about)\b/i.test(
        q,
      )
    ) {
      return true;
    }
  }
  const tokens = queryTokens(question);
  const heavy = tokens.filter((t) => t.length >= 5 || /\d/.test(t));
  return heavy.length <= 1 && q.split(/\s+/).length <= 12;
}

export function wantsEnglishEmail(question: string) {
  const q = question.toLowerCase();
  return (
    /(soạn|viết|draft|compose).{0,40}(email|e-mail|thư).{0,40}(anh|english|hãng|manufacturer|supplier)/i.test(
      q,
    ) ||
    /(email|e-mail).{0,30}(tiếng anh|in english|to (the )?manufacturer)/i.test(q)
  );
}

async function translateEnglishForSearch(question: string): Promise<{
  vi: string;
  keys: string[];
}> {
  const raw = await callChatModel({
    system: `Bạn hỗ trợ Fix1 tra cứu tài liệu kỹ thuật.
Hiểu câu tiếng Anh từ hãng/OEM, dịch sang tiếng Việt kỹ thuật, liệt kê từ khóa tìm kiếm.
Chỉ JSON thuần: {"vi":"...","keys":["key1",...]}
keys: 5–12 từ/cụm (mã lỗi, IEC, tên thiết bị, thông số) — giữ nguyên model/code tiếng Anh.`,
    user: question,
  });

  try {
    const jsonText = raw.replace(/^```json\s*|\s*```$/g, "").trim();
    const parsed = JSON.parse(jsonText) as { vi?: string; keys?: string[] };
    const vi = String(parsed.vi || "").trim() || question;
    const keys = (parsed.keys || [])
      .map((k) => String(k).trim())
      .filter(Boolean)
      .slice(0, 12);
    return { vi, keys };
  } catch {
    return { vi: question, keys: queryTokens(question) };
  }
}

export async function orchestrateAsk(opts: {
  question: string;
  allowInternet?: boolean;
  history?: HistoryItem[];
  focusSources?: FocusSource[];
  sessionMemory?: SessionMemory | null;
}): Promise<{
  answer: string;
  sources: RetrievedSource[];
  mode: "local" | "internet";
  memory: SessionMemory;
  meta: {
    englishInput: boolean;
    translatedVi: string | null;
    searchKeys: string[];
    followUp: boolean;
    emailEnglish: boolean;
    packModes: string[];
  };
}> {
  const question = opts.question.trim();
  const memory = opts.sessionMemory || emptySessionMemory();
  const history = (opts.history || []).slice(-4);
  const hasSessionCtx =
    history.length > 0 || Boolean(memory.summary) || memory.focusDocs.length > 0;
  const followUp = isFollowUpQuestion(question, hasSessionCtx);
  const useInternet = wantsInternet(question, opts.allowInternet);
  const emailEnglish = wantsEnglishEmail(question);
  const englishInput = isMostlyEnglish(question);

  let searchText = question;
  let translatedVi: string | null = null;
  let searchKeys: string[] = [];

  if (englishInput) {
    const t = await translateEnglishForSearch(question);
    translatedVi = t.vi;
    searchKeys = t.keys;
    searchText = `${t.vi}\n${t.keys.join(" ")}`;
  }

  const focusSources: FocusSource[] = [
    ...(opts.focusSources || []),
    ...memory.focusDocs.map((d) => ({ type: d.type, id: d.id })),
  ];
  // unique focus
  const focusUniq = [
    ...new Map(focusSources.map((f) => [`${f.type}:${f.id}`, f])).values(),
  ];

  const packed = selectAndPackDocuments({
    searchText,
    extraKeys: searchKeys,
    focusSources: focusUniq,
    followUp,
    maxDocs: followUp ? 2 : 2,
  });

  const sources = packedToRetrieved(packed);
  const context = buildDocPromptContext(packed);

  let system = FIX1_SYSTEM_POLICY;
  if (useInternet) {
    system += `\n\nCHẾ ĐỘ: Cho phép ngoài Fix1/internet — tách (A) Fix1 (B) ngoài.`;
  } else {
    system += `\n\nCHẾ ĐỘ: Chỉ dùng tài liệu Fix1 bên dưới + bộ nhớ phiên. Cấm bịa.`;
  }
  if (emailEnglish) {
    system += `\n\nNGOẠI LỆ: Soạn email tiếng Anh gửi hãng + tóm tắt VI.`;
  }
  if (followUp) {
    system += `\n\nCÂU NỐI TRONG PHIÊN: bám bộ nhớ phiên và tài liệu đang neo.`;
  }
  if (englishInput && translatedVi) {
    system += `\n\nCâu gốc EN từ hãng — đã dịch nội bộ để tra cứu. Trả lời tiếng Việt (trừ email EN).`;
  }

  const memoryBlock = [
    memory.summary
      ? `TÓM TẮT PHIÊN (Fix1 giữ):\n${memory.summary}`
      : "TÓM TẮT PHIÊN: (phiên mới / chưa có)",
    memory.focusDocs.length
      ? `NGUỒN ĐANG NEO:\n${memory.focusDocs.map((d) => `- [${d.type} #${d.id}] ${d.title} ${d.href}`).join("\n")}`
      : "",
    memory.notes ? `GHI CHÚ THÔNG SỐ:\n${memory.notes}` : "",
  ]
    .filter(Boolean)
    .join("\n\n");

  const userPayload = [
    memoryBlock,
    englishInput && translatedVi
      ? `CÂU GỐC (EN):\n${question}\n\nBẢN DỊCH NỘI BỘ (VI):\n${translatedVi}\n\nKEY TRA CỨU:\n${searchKeys.join(", ") || "(auto)"}`
      : `CÂU HỎI:\n${question}`,
    `TÀI LIỆU FIX1 ĐÃ CHỈ (đọc kỹ để trả lời):\n${context}`,
  ].join("\n\n");

  // Chỉ gửi 1–2 lượt gần — phần còn lại nằm trong tóm tắt phiên
  const shortHistory = history.slice(-2).map((m) => ({
    role: m.role,
    content:
      m.role === "user" ? m.content.slice(0, 500) : m.content.slice(0, 900),
  }));

  let answer: string;
  if (useInternet) {
    answer = await callChatModelWithWebSearch({
      system,
      user: userPayload,
    });
  } else {
    answer = await callChatModel({
      system,
      messages: [...shortHistory, { role: "user", content: userPayload }],
    });
  }

  const nextMemory = updateSessionMemoryHeuristic(
    memory,
    translatedVi || question,
    answer,
    packed.map((d) => ({
      type: d.type,
      id: d.id,
      title: d.title,
      href: d.href,
    })),
  );

  return {
    answer,
    sources,
    mode: useInternet ? "internet" : "local",
    memory: nextMemory,
    meta: {
      englishInput,
      translatedVi,
      searchKeys,
      followUp,
      emailEnglish,
      packModes: packed.map((d) => `${d.type}#${d.id}:${d.mode}`),
    },
  };
}

export function publicSources(sources: RetrievedSource[]) {
  return sources.map((s) => ({
    type: s.type,
    id: s.id,
    title: s.title,
    href: s.href,
    label: sourceLabel(s),
    equipmentName: s.equipmentName,
    excerpt: s.excerpt.slice(0, 480),
    score: s.score,
  }));
}
