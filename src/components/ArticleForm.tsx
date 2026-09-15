"use client";

import { FormEvent, useState } from "react";

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

  async function importFile(file: File | null) {
    if (!file) return;
    setImporting(true);
    setImportError("");
    setImportNote("");
    try {
      if (content.trim()) {
        const ok = window.confirm(
          "Ô nội dung đang có chữ. Thay toàn bộ bằng nội dung file?",
        );
        if (!ok) {
          setImporting(false);
          return;
        }
      }
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
      setContent(String(data.text || ""));
      setImportNote(`Đã đổ nội dung từ: ${data.name || file.name}`);
    } catch {
      setImportError("Không kết nối được máy chủ");
    } finally {
      setImporting(false);
    }
  }

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    // ensure latest content is in the form field before server action
    const form = e.currentTarget;
    const hidden = form.elements.namedItem("content") as HTMLTextAreaElement | null;
    if (hidden) hidden.value = content;
  }

  return (
    <form action={action} onSubmit={onSubmit} className="card space-y-4">
      {initial?.id ? <input type="hidden" name="id" value={initial.id} /> : null}
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

      <div className="space-y-2 rounded-lg border border-dashed border-[var(--border)] bg-white/60 p-3">
        <div className="label mb-0">Nhập từ file (.md / .docx)</div>
        <p className="text-xs text-[var(--muted)]">
          Upload file dài → bấm đổ vào ô nội dung bên dưới, rồi Lưu bài viết.
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="file"
            accept=".md,.markdown,.txt,.docx"
            className="input max-w-md"
            disabled={importing}
            onChange={(e) => {
              const f = e.target.files?.[0] || null;
              void importFile(f);
              e.target.value = "";
            }}
          />
          {importing ? (
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

      <label>
        <span className="label">Nội dung (Markdown)</span>
        <textarea
          name="content"
          className="textarea min-h-80"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="## Tổng quan&#10;&#10;- Điểm cần nhớ..."
        />
      </label>
      <button type="submit" className="btn btn-primary" disabled={importing}>
        {submitLabel}
      </button>
    </form>
  );
}
