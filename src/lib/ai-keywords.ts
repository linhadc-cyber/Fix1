/** Keyword AI — tối đa 2000 ký tự Unicode (code points). */
export const AI_KEYWORDS_MAX = 2000;

export function charCount(s: string): number {
  return Array.from(s).length;
}

/** Trả về keywords đã trim; throw Error nếu trống hoặc quá dài. */
export function requireAiKeywords(raw: FormDataEntryValue | null | string): string {
  const s = String(raw ?? "").trim();
  if (!s) {
    throw new Error("Hãy nhập Keyword AI (bắt buộc)");
  }
  if (charCount(s) > AI_KEYWORDS_MAX) {
    throw new Error(`Keyword AI tối đa ${AI_KEYWORDS_MAX} chữ`);
  }
  return s;
}

export function validateAiKeywordsOptional(raw: string): string | null {
  const s = raw.trim();
  if (!s) return "Hãy nhập Keyword AI (bắt buộc)";
  if (charCount(s) > AI_KEYWORDS_MAX) {
    return `Keyword AI tối đa ${AI_KEYWORDS_MAX} chữ`;
  }
  return null;
}
