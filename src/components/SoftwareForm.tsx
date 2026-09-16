"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AiKeywordsField } from "@/components/AiKeywordsField";
import { ClearableTextarea } from "@/components/ClearableTextarea";

const MAX_BYTES = 500 * 1024 * 1024;
const MAX_FILES = 5;
const ACCEPT =
  ".exe,.zip,.rar,.pdf,.docx,.jpg,.jpeg,application/pdf,image/jpeg,application/zip,application/x-rar-compressed,application/vnd.openxmlformats-officedocument.wordprocessingml.document";

type EquipmentOpt = { id: number; name: string };

type Props = {
  uploaderName: string;
  equipment: EquipmentOpt[];
  defaultEquipmentTypeId?: number;
};

export function SoftwareForm({
  uploaderName,
  equipment,
  defaultEquipmentTypeId,
}: Props) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [warnOpen, setWarnOpen] = useState(false);
  const [warnMsg, setWarnMsg] = useState("");
  const [mounted, setMounted] = useState(false);
  const [fileCount, setFileCount] = useState(0);

  useEffect(() => {
    setMounted(true);
  }, []);

  function showWarn(msg: string) {
    setWarnMsg(msg);
    setWarnOpen(true);
  }

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    const formEl = e.currentTarget;
    const files = inputRef.current?.files;
    if (!files?.length) {
      setError("Hãy chọn ít nhất 1 file");
      return;
    }
    if (files.length > MAX_FILES) {
      showWarn(`Mỗi lần chỉ được chọn tối đa ${MAX_FILES} file.`);
      return;
    }
    for (const file of Array.from(files)) {
      if (file.size >= MAX_BYTES) {
        showWarn(
          `File “${file.name}” phải nhỏ hơn 500MB (${(file.size / (1024 * 1024)).toFixed(1)} MB). Hãy thu nhỏ rồi chọn lại.`,
        );
        return;
      }
    }

    setLoading(true);
    const form = new FormData(formEl);
    form.delete("files");
    for (const file of Array.from(files)) {
      form.append("files", file);
    }

    try {
      const res = await fetch("/api/software", { method: "POST", body: form });
      const data = await res.json().catch(() => ({}));
      setLoading(false);
      if (!res.ok) {
        if (data.code === "FILE_TOO_LARGE" || data.code === "TOO_MANY_FILES") {
          showWarn(data.error || "File không hợp lệ");
          return;
        }
        setError(data.error || "Lưu thất bại");
        return;
      }
      router.push(`/software/${data.id}`);
      router.refresh();
    } catch {
      setLoading(false);
      setError("Không kết nối được máy chủ");
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
              aria-labelledby="soft-warn-title"
              onClick={(ev) => ev.stopPropagation()}
            >
              <h2 id="soft-warn-title" className="text-lg font-semibold">
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
    <form onSubmit={onSubmit} className="form-stack">
      <section className="zone zone-content space-y-4">
        <p className="zone-title">Thông tin software</p>
        <label>
          <span className="label">Loại thiết bị</span>
          <select
            name="equipmentTypeId"
            required
            className="select"
            defaultValue={defaultEquipmentTypeId || ""}
          >
            <option value="" disabled>
              Chọn thiết bị…
            </option>
            {equipment.map((e) => (
              <option key={e.id} value={e.id}>
                {e.name}
              </option>
            ))}
          </select>
          <p className="mt-1 text-xs text-[var(--muted)]">
            Software sẽ hiện trong tab Software của thiết bị đã chọn.
          </p>
        </label>
        <label>
          <span className="label">Tên software</span>
          <input name="name" required className="input" />
        </label>
        <ClearableTextarea
          name="functionText"
          label="Chức năng"
          className="textarea min-h-24"
          required
          placeholder="Phần mềm dùng để làm gì…"
        />
        <label>
          <span className="label">Hãng sản xuất</span>
          <input name="vendor" required className="input" />
        </label>
        <label>
          <span className="label">Người upload</span>
          <input className="input" value={uploaderName} disabled readOnly />
        </label>
        <ClearableTextarea
          name="notes"
          label="Ghi chú / hướng dẫn sử dụng"
          className="textarea min-h-28"
        />
      </section>

      <section className="zone zone-meta space-y-3">
        <p className="zone-title">Keyword AI & file</p>
        <AiKeywordsField />
        <label>
          <span className="label">
            File (1–{MAX_FILES}): exe, zip, rar, pdf, docx, jpeg — mỗi file &lt;
            500MB
          </span>
          <input
            ref={inputRef}
            name="files"
            type="file"
            required
            multiple
            accept={ACCEPT}
            className="input"
            onChange={(e) => setFileCount(e.target.files?.length || 0)}
          />
          {fileCount > 0 ? (
            <p className="mt-1 text-xs text-[var(--muted)]">
              Đã chọn {fileCount} file
              {fileCount > MAX_FILES ? ` (vượt quá ${MAX_FILES})` : ""}
            </p>
          ) : null}
        </label>
      </section>

      {error ? (
        <p className="text-base text-red-700">{error}</p>
      ) : null}
      <div className="zone zone-actions">
        <button type="submit" disabled={loading} className="btn btn-primary">
          {loading ? "Đang tải lên…" : "Lưu software"}
        </button>
      </div>
      {warnDialog}
    </form>
  );
}
