"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

const MAX_BYTES = 2 * 1024 * 1024;
const MAX_ATTACHMENTS = 5;
const ACCEPT = ".pdf,.docx,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png";

type Attached = { id: number; title: string };

type Props = {
  articleId?: number;
  caseId?: number;
  canUpload: boolean;
  files: Attached[];
};

export function AttachFiles({ articleId, caseId, canUpload, files }: Props) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [warnOpen, setWarnOpen] = useState(false);
  const [warnMsg, setWarnMsg] = useState("");
  const [mounted, setMounted] = useState(false);
  const [list, setList] = useState(files);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    setList(files);
  }, [files]);

  function showWarn(msg: string) {
    setWarnMsg(msg);
    setWarnOpen(true);
  }

  async function onPick(fileList: FileList | null) {
    if (!fileList?.length) return;
    setBusy(true);
    setError("");
    let currentCount = list.length;
    try {
      for (const file of Array.from(fileList)) {
        if (currentCount >= MAX_ATTACHMENTS) {
          setError(`Tối đa ${MAX_ATTACHMENTS} file đính kèm.`);
          break;
        }
        if (file.size > MAX_BYTES) {
          showWarn(
            `File “${file.name}” vượt quá 2MB (${(file.size / (1024 * 1024)).toFixed(2)} MB). Hãy thu nhỏ file (nén ảnh hoặc giảm dung lượng PDF/DOCX) rồi chọn lại.`,
          );
          continue;
        }
        const form = new FormData();
        form.set("file", file);
        if (articleId) form.set("articleId", String(articleId));
        if (caseId) form.set("caseId", String(caseId));

        const res = await fetch("/api/media/attach", {
          method: "POST",
          body: form,
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          if (data.code === "FILE_TOO_LARGE") {
            showWarn(
              data.error ||
                `File “${file.name}” vượt quá 2MB. Hãy thu nhỏ rồi thử lại.`,
            );
            continue;
          }
          setError(data.error || "Đính kèm thất bại");
          break;
        }
        currentCount += 1;
        setList((prev) => [
          ...prev,
          { id: data.id, title: data.title || file.name },
        ]);
      }
      router.refresh();
    } catch {
      setError("Không kết nối được máy chủ");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  const warnDialog =
    warnOpen && mounted
      ? createPortal(
          <div
            className="confirm-delete-backdrop"
            role="presentation"
            onClick={() => setWarnOpen(false)}
          >
            <div
              className="confirm-delete-dialog"
              role="alertdialog"
              aria-modal="true"
              aria-labelledby="attach-warn-title"
              onClick={(e) => e.stopPropagation()}
            >
              <h2 id="attach-warn-title" className="text-lg font-semibold">
                File quá dung lượng
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-[var(--muted)]">
                {warnMsg}
              </p>
              <div className="mt-4 flex justify-end">
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => setWarnOpen(false)}
                >
                  Đã xem
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )
      : null;

  return (
    <section className="card space-y-2">
      <h2 className="text-base font-semibold text-[var(--brand)]">
        Tài liệu đính kèm
      </h2>
      <p className="text-xs text-[var(--muted)]">
        PDF, DOCX, JPEG, PNG — tối đa {MAX_ATTACHMENTS} file, mỗi file ≤ 2MB.
      </p>

      {list.length > 0 ? (
        <ul className="space-y-1.5">
          {list.map((f) => (
            <li key={f.id}>
              <Link
                href={`/media/${f.id}`}
                className="text-[var(--brand)] underline"
              >
                {f.title}
              </Link>
              <span className="ml-2 text-xs text-[var(--muted)]">#{f.id}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-[var(--muted)]">Chưa có file đính kèm.</p>
      )}

      {canUpload ? (
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <input
            ref={inputRef}
            type="file"
            accept={ACCEPT}
            multiple
            className="input max-w-md"
            disabled={busy || list.length >= MAX_ATTACHMENTS}
            onChange={(e) => void onPick(e.target.files)}
          />
          {busy ? (
            <span className="text-sm text-[var(--muted)]">Đang tải lên…</span>
          ) : null}
        </div>
      ) : null}

      {error ? <p className="text-sm text-red-700">{error}</p> : null}
      {warnDialog}
    </section>
  );
}
