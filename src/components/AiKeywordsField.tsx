"use client";

import { useState } from "react";
import { AI_KEYWORDS_MAX, charCount } from "@/lib/ai-keywords";

type Props = {
  name?: string;
  defaultValue?: string;
  required?: boolean;
};

export function AiKeywordsField({
  name = "aiKeywords",
  defaultValue = "",
  required = true,
}: Props) {
  const [value, setValue] = useState(defaultValue);
  const n = charCount(value);
  const over = n > AI_KEYWORDS_MAX;

  return (
    <label className="block space-y-1">
      <span className="label">Keyword AI</span>
      <p className="text-xs text-[var(--muted)]">
        Từ khóa chức năng / chủ đề để AI chỉ đúng chỗ (cài soft, tra cứu…). Tối
        đa {AI_KEYWORDS_MAX} chữ.
      </p>
      <textarea
        name={name}
        className={`textarea min-h-20 ${over ? "border-red-600" : ""}`}
        value={value}
        required={required}
        maxLength={AI_KEYWORDS_MAX}
        onChange={(e) => setValue(e.target.value)}
        placeholder="VD: cài driver inverter, phần mềm giám sát BACS, cấu hình…"
      />
      <p
        className={`text-xs ${over ? "font-medium text-red-700" : "text-[var(--muted)]"}`}
      >
        {n}/{AI_KEYWORDS_MAX}
      </p>
    </label>
  );
}
