"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AiKeywordsField } from "@/components/AiKeywordsField";
import { ConfirmDelete } from "@/components/ConfirmDelete";

const CONFIRM_SECONDS = 5;

type Equipment = { id: number; name: string };

type Props = {
  action: (formData: FormData) => void | Promise<void>;
  equipment: Equipment[];
  initial?: {
    id?: number;
    title?: string;
    equipmentTypeId?: number;
    tags?: string;
    content?: string;
    aiKeywords?: string;
  };
  submitLabel?: string;
};

export function ArticleForm({
  action,
  equipment,
  initial,
  submitLabel = "Lưu bài viết",
}: Props) {
  const [content, setContent] = useState(initial?.content || "");
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState("");
  const [importNote, setImportNote] = useState("");
  const [mounted, setMounted] = useState(false);
  const [replaceOpen, setReplaceOpen] = useState(false);
  const [left, setLeft] = useState(CONFIRM_SECONDS);
  const pendingText = useRef<{ text: string; name: string } | null>(null);
  const timerRef = useRef<number | null>(null);

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
    pendingText.current = null;
    setImporting(false);
  }

  function openReplace(text: string, name: string) {
    pendingText.current = { text, name };
    setReplaceOpen(true);
    setLeft(CONFIRM_SECONDS);
    clearTimer();
    timerRef.current = window.setInterval(() => {
      setLeft((s) => {
        if (s <= 1) {
          clearTimer();
          setReplaceOpen(false);
          pendingText.current = null;
          setImporting(false);
          return CONFIRM_SECONDS;
        }
        return s - 1;
      });
    }, 1000);
  }

  useEffect(() => () => clearTimer(), []);

  async function importFile(file: File | null) {
    if (!file) return;
    setImporting(true);
    setImportError("");
    setImportNote("");
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/articles/import-text", {
        method: "POST",
        body: form,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setImportError(data.error || "Import thất bại");
        setImporting(false);
        return;
      }
      const text = String(data.text || "");
      const name = String(data.name || file.name);
      if (content.trim()) {
        openReplace(text, name);
        return;
      }
      setContent(text);
      setImportNote(`Đã đổ nội dung từ: ${name}`);
      setImporting(false);
    } catch {
      setImportError("Không kết nối được máy chủ");
      setImporting(false);
    }
  }

  function confirmReplace() {
    const p = pendingText.current;
    closeReplace();
    if (!p) return;
    setContent(p.text);
    setImportNote(`Đã đổ nội dung từ: ${p.name}`);
  }

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    const form = e.currentTarget;
    const hidden = form.elements.namedItem(
      "content",
    ) as HTMLTextAreaElement | null;
    if (hidden) hidden.value = content;
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
              aria-labelledby="content-replace-title"
              onClick={(e) => e.stopPropagation()}
            >
              <h2 id="content-replace-title" className="text-lg font-semibold">
                Xác nhận thay nội dung
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-[var(--muted)]">
                Ô nội dung đang có chữ. Thay toàn bộ bằng nội dung file?
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
    <form action={action} onSubmit={onSubmit} className="form-stack">
      {initial?.id ? <input type="hidden" name="id" value={initial.id} /> : null}

      <section className="zone zone-content space-y-4">
        <p className="zone-title">Thông tin bài viết</p>
        <label>
          <span className="label">Tiêu đề</span>
          <input
            name="title"
            required
            className="input"
            defaultValue={initial?.title || ""}
          />
        </label>
        <label>
          <span className="label">Loại thiết bị</span>
          <select
            name="equipmentTypeId"
            required
            className="select"
            defaultValue={initial?.equipmentTypeId || equipment[0]?.id}
          >
            {equipment.map((e) => (
              <option key={e.id} value={e.id}>
                {e.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className="label">Tags (cách nhau bằng dấu phẩy)</span>
          <input
            name="tags"
            className="input"
            placeholder="an toàn, checklist"
            defaultValue={initial?.tags || ""}
          />
        </label>
      </section>

      <section className="zone zone-meta space-y-3">
        <p className="zone-title">Keyword AI & nhập file</p>
        <AiKeywordsField defaultValue={initial?.aiKeywords || ""} />
        <div className="space-y-2 rounded border border-dashed border-[var(--border)] bg-white/70 p-3">
          <div className="label mb-0">Nhập từ file (.md / .docx)</div>
          <p className="text-xs text-[var(--muted)]">
            Upload file dài → đổ vào ô nội dung bên dưới, rồi Lưu bài viết.
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="file"
              accept=".md,.markdown,.txt,.docx"
              className="input max-w-md"
              disabled={importing || replaceOpen}
              onChange={(e) => {
                const f = e.target.files?.[0] || null;
                void importFile(f);
                e.target.value = "";
              }}
            />
            {importing && !replaceOpen ? (
              <span className="text-sm text-[var(--muted)]">Đang trích chữ…</span>
            ) : null}
          </div>
          {importError ? (
            <p className="text-sm text-red-700">{importError}</p>
          ) : null}
          {importNote ? (
            <p className="text-sm text-[var(--brand)]">{importNote}</p>
          ) : null}
        </div>
      </section>

      <section className="zone zone-content space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="zone-title mb-0">Nội dung (Markdown)</p>
          {content.trim() ? (
            <ConfirmDelete
              label="Xóa nội dung"
              className="btn btn-secondary text-xs text-red-700"
              message="Xóa toàn bộ nội dung bài viết trong ô này? Có thể upload .md hoặc gõ lại sau."
              onConfirm={() => {
                setContent("");
                setImportNote("");
              }}
            />
          ) : null}
        </div>
        <textarea
          name="content"
          className="textarea min-h-80"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="## Tổng quan&#10;&#10;- Điểm cần nhớ..."
        />
      </section>

      <div className="zone zone-actions">
        <button
          type="submit"
          className="btn btn-primary"
          disabled={importing || replaceOpen}
        >
          {submitLabel}
        </button>
      </div>
      {replaceDialog}
    </form>
  );
}
