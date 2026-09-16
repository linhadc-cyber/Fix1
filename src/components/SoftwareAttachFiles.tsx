"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ConfirmDelete } from "@/components/ConfirmDelete";
import { deleteSoftwareFile } from "@/app/actions";

const MAX_BYTES = 500 * 1024 * 1024;
const MAX_FILES = 5;
const ACCEPT =
  ".exe,.zip,.rar,.pdf,.docx,.jpg,.jpeg,application/pdf,image/jpeg,application/zip,application/x-rar-compressed,application/vnd.openxmlformats-officedocument.wordprocessingml.document";

type SoftFile = {
  id: number;
  originalName: string;
  sizeBytes: number;
};

type Props = {
  softwareId: number;
  canUpload: boolean;
  canDeleteFile: boolean;
  files: SoftFile[];
};

export function SoftwareAttachFiles({
  softwareId,
  canUpload,
  canDeleteFile,
  files,
}: Props) {
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
    try {
      const picked = Array.from(fileList);
      if (list.length + picked.length > MAX_FILES) {
        showWarn(
          `Tối đa ${MAX_FILES} file (đang có ${list.length}). Xóa bớt hoặc chọn ít hơn.`,
        );
        return;
      }
      for (const file of picked) {
        if (file.size >= MAX_BYTES) {
          showWarn(
            `File “${file.name}” phải nhỏ hơn 500MB (${(file.size / (1024 * 1024)).toFixed(1)} MB). Hãy thu nhỏ rồi chọn lại.`,
          );
          return;
        }
      }

      const form = new FormData();
      for (const file of picked) {
        form.append("files", file);
      }
      const res = await fetch(`/api/software/${softwareId}/files`, {
        method: "POST",
        body: form,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (data.code === "FILE_TOO_LARGE" || data.code === "TOO_MANY_FILES") {
          showWarn(data.error || "File không hợp lệ");
          return;
        }
        setError(data.error || "Đính kèm thất bại");
        return;
      }
      const added = (data.files || []) as SoftFile[];
      setList((prev) => [...prev, ...added]);
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
              aria-labelledby="soft-attach-warn-title"
              onClick={(e) => e.stopPropagation()}
            >
              <h2 id="soft-attach-warn-title" className="text-lg font-semibold">
                Không thể tải lên
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
        File đính kèm ({list.length}/{MAX_FILES})
      </h2>
      <p className="text-xs text-[var(--muted)]">
        exe, zip, rar, pdf, docx, jpeg — tối đa {MAX_FILES} file, mỗi file &lt;
        500MB.
        {canDeleteFile
          ? " Có thể xóa từng file nếu tải nhầm (không xóa cả software)."
          : ""}
      </p>

      {list.length > 0 ? (
        <ul className="space-y-2">
          {list.map((f) => (
            <li
              key={f.id}
              className="flex flex-wrap items-center justify-between gap-2"
            >
              <div className="flex flex-wrap items-center gap-2">
                <a
                  href={`/api/software/files/${f.id}`}
                  className="text-[var(--brand)] underline"
                  download
                >
                  {f.originalName}
                </a>
                <span className="text-xs text-[var(--muted)]">
                  {(f.sizeBytes / (1024 * 1024)).toFixed(2)} MB
                </span>
              </div>
              {canDeleteFile ? (
                <ConfirmDelete
                  label="Xóa file"
                  className="btn btn-secondary text-xs text-red-700"
                  message={`Xóa file “${f.originalName}”? Chỉ xóa file này.`}
                  action={deleteSoftwareFile}
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
            disabled={busy || list.length >= MAX_FILES}
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
