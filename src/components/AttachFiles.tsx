"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ConfirmDelete } from "@/components/ConfirmDelete";
import { deleteAttachment } from "@/app/actions";

const ACCEPT = ".pdf,.docx,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png";

type Attached = { id: number; title: string };

type Props = {
  articleId?: number;
  caseId?: number;
  canUpload: boolean;
  /** Editor được xóa từng file đính kèm (không xóa cả bài/tình huống). */
  canDeleteFile?: boolean;
  files: Attached[];
  /** Bài viết: 2MB/5. Tình huống: 20MB/10. */
  maxBytes?: number;
  maxAttachments?: number;
};

export function AttachFiles({
  articleId,
  caseId,
  canUpload,
  canDeleteFile = false,
  files,
  maxBytes = 2 * 1024 * 1024,
  maxAttachments = 5,
}: Props) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [warnOpen, setWarnOpen] = useState(false);
  const [warnMsg, setWarnMsg] = useState("");
  const [mounted, setMounted] = useState(false);
  const [list, setList] = useState(files);

  const maxMb = Math.round(maxBytes / (1024 * 1024));

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
        if (currentCount >= maxAttachments) {
          setError(`Tối đa ${maxAttachments} file đính kèm.`);
          break;
        }
        if (file.size > maxBytes) {
          showWarn(
            `File “${file.name}” vượt quá ${maxMb}MB (${(file.size / (1024 * 1024)).toFixed(2)} MB). Hãy thu nhỏ rồi chọn lại.`,
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
                `File “${file.name}” vượt quá ${maxMb}MB. Hãy thu nhỏ rồi thử lại.`,
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
        PDF, DOCX, JPEG, PNG — tối đa {maxAttachments} file, mỗi file ≤ {maxMb}
        MB.
        {canDeleteFile
          ? " Có thể xóa từng file nếu tải nhầm (không xóa cả tình huống/bài)."
          : ""}
      </p>

      {list.length > 0 ? (
        <ul className="space-y-2">
          {list.map((f) => (
            <li
              key={f.id}
              className="flex flex-wrap items-center justify-between gap-2"
            >
              <div>
                <Link
                  href={`/media/${f.id}`}
                  className="text-[var(--brand)] underline"
                >
                  {f.title}
                </Link>
                <span className="ml-2 text-xs text-[var(--muted)]">#{f.id}</span>
              </div>
              {canDeleteFile ? (
                <ConfirmDelete
                  label="Xóa file"
                  className="btn btn-secondary text-xs text-red-700"
                  message={`Xóa file đính kèm “${f.title}”? Chỉ xóa file này.`}
                  action={deleteAttachment}
                  hiddenFields={{ id: f.id }}
                />
              ) : null}
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
            disabled={busy || list.length >= maxAttachments}
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
