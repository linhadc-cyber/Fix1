"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ConfirmDelete } from "@/components/ConfirmDelete";
import { AI_KEYWORDS_MAX, charCount } from "@/lib/ai-keywords";

const CONFIRM_SECONDS = 5;

type Props = {
  name?: string;
  defaultValue?: string;
  required?: boolean;
};

function clipToMax(text: string): string {
  const chars = Array.from(text);
  if (chars.length <= AI_KEYWORDS_MAX) return chars.join("");
  return chars.slice(0, AI_KEYWORDS_MAX).join("");
}

export function AiKeywordsField({
  name = "aiKeywords",
  defaultValue = "",
  required = true,
}: Props) {
  const [value, setValue] = useState(defaultValue);
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [mounted, setMounted] = useState(false);
  const [replaceOpen, setReplaceOpen] = useState(false);
  const [left, setLeft] = useState(CONFIRM_SECONDS);
  const pending = useRef<{ text: string; name: string } | null>(null);
  const timerRef = useRef<number | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const n = charCount(value);
  const over = n > AI_KEYWORDS_MAX;

  useEffect(() => {
    setMounted(true);
  }, []);

  function clearTimer() {
    if (timerRef.current != null) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }

  function closeReplace() {
    clearTimer();
    setReplaceOpen(false);
    setLeft(CONFIRM_SECONDS);
    pending.current = null;
  }

  function openReplace(text: string, fileName: string) {
    pending.current = { text, name: fileName };
    setReplaceOpen(true);
    setLeft(CONFIRM_SECONDS);
    clearTimer();
    timerRef.current = window.setInterval(() => {
      setLeft((s) => {
        if (s <= 1) {
          clearTimer();
          setReplaceOpen(false);
          pending.current = null;
          return CONFIRM_SECONDS;
        }
        return s - 1;
      });
    }, 1000);
  }

  useEffect(() => () => clearTimer(), []);

  function applyText(raw: string, fromName?: string) {
    const next = clipToMax(raw.replace(/^\uFEFF/, "").trim());
    setValue(next);
    setError("");
    setNote(
      fromName
        ? `Đã nạp từ ${fromName}${charCount(raw.trim()) > AI_KEYWORDS_MAX ? ` (cắt còn ${AI_KEYWORDS_MAX} chữ)` : ""}`
        : "",
    );
  }

  async function onPickFile(file: File | null) {
    if (!file) return;
    const lower = file.name.toLowerCase();
    if (
      !lower.endsWith(".md") &&
      !lower.endsWith(".markdown") &&
      !lower.endsWith(".txt")
    ) {
      setError("Chỉ nhận file .md / .markdown / .txt");
      if (fileRef.current) fileRef.current.value = "";
      return;
    }
    try {
      const text = await file.text();
      if (value.trim()) {
        openReplace(text, file.name);
      } else {
        applyText(text, file.name);
      }
    } catch {
      setError("Không đọc được file");
    } finally {
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  function confirmReplace() {
    const p = pending.current;
    closeReplace();
    if (p) applyText(p.text, p.name);
  }

  const replaceDialog =
    replaceOpen && mounted
      ? createPortal(
          <div
            className="confirm-delete-backdrop"
            role="presentation"
            onClick={closeReplace}
          >
            <div
              className="confirm-delete-dialog"
              role="alertdialog"
              aria-modal="true"
              aria-labelledby="kw-replace-title"
              onClick={(e) => e.stopPropagation()}
            >
              <h2 id="kw-replace-title" className="text-lg font-semibold">
                Xác nhận thay Keyword
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-[var(--muted)]">
                Ô Keyword AI đang có chữ. Thay toàn bộ bằng nội dung file .md?
              </p>
              <p className="mt-2 text-sm font-medium text-red-700">
                Còn {left}s — hết giờ sẽ hủy tự động nếu bạn không xác nhận.
              </p>
              <div className="mt-4 flex flex-wrap justify-end gap-2">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={closeReplace}
                >
                  Hủy
                </button>
                <button
                  type="button"
                  className="btn btn-primary !bg-red-700 hover:!bg-red-800"
                  onClick={confirmReplace}
                >
                  Xác nhận thay ({left})
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )
      : null;

  return (
    <div className="block space-y-1">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="label mb-0">Keyword AI</span>
        <div className="flex flex-wrap items-center gap-2">
          <label className="btn btn-secondary cursor-pointer text-xs">
            Upload .md
            <input
              ref={fileRef}
              type="file"
              accept=".md,.markdown,.txt,text/markdown,text/plain"
              className="sr-only"
              onChange={(e) => {
                void onPickFile(e.target.files?.[0] || null);
              }}
            />
          </label>
          {value.trim() ? (
            <ConfirmDelete
              label="Xóa Keyword"
              className="btn btn-secondary text-xs text-red-700"
              message="Xóa toàn bộ Keyword AI trong ô này? Có thể Upload .md hoặc gõ lại sau."
              onConfirm={() => {
                setValue("");
                setNote("");
                setError("");
              }}
            />
          ) : null}
        </div>
      </div>
      <p className="text-xs text-[var(--muted)]">
        Từ khóa chức năng / chủ đề để AI chỉ đúng chỗ. Upload file .md để nạp
        nhanh. Tối đa {AI_KEYWORDS_MAX} chữ.
      </p>
      <textarea
        name={name}
        className={`textarea min-h-24 ${over ? "border-red-600" : ""}`}
        value={value}
        required={required}
        maxLength={AI_KEYWORDS_MAX}
        onChange={(e) => {
          setValue(e.target.value);
          setNote("");
        }}
        placeholder="VD: cài driver inverter, phần mềm giám sát BACS, cấu hình…"
      />
      <p
        className={`text-xs ${over ? "font-medium text-red-700" : "text-[var(--muted)]"}`}
      >
        {n}/{AI_KEYWORDS_MAX}
      </p>
      {note ? <p className="text-sm text-[var(--brand)]">{note}</p> : null}
      {error ? <p className="text-sm text-red-700">{error}</p> : null}
      {replaceDialog}
    </div>
  );
}
