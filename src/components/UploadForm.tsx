"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

type Equipment = { id: number; name: string };

export function UploadForm({ equipment }: { equipment: Equipment[] }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const form = new FormData(e.currentTarget);
    try {
      const res = await fetch("/api/media/upload", {
        method: "POST",
        body: form,
      });
      const data = await res.json().catch(() => ({}));
      setLoading(false);
      if (!res.ok) {
        setError(data.error || "Upload thất bại");
        return;
      }
      router.push(`/media/${data.id}`);
      router.refresh();
    } catch {
      setLoading(false);
      setError("Không kết nối được máy chủ");
    }
  }

  return (
    <form onSubmit={onSubmit} className="card space-y-4">
      <p className="text-base text-[var(--muted)]">
        Tài liệu chữ cho AI: <strong>.md</strong> hoặc <strong>.docx</strong>.
        Ảnh/video chỉ để minh họa (nên ghi tóm tắt). Hệ thống tự cấp mã ID sau
        khi lưu.
      </p>
      <label>
        <span className="label">Tiêu đề</span>
        <input name="title" required className="input" />
      </label>
      <label>
        <span className="label">Loại thiết bị (phân khu AI)</span>
        <select name="equipmentTypeId" className="select" required defaultValue="">
          <option value="" disabled>
            — Chọn thiết bị —
          </option>
          {equipment.map((e) => (
            <option key={e.id} value={e.id}>
              {e.name}
            </option>
          ))}
        </select>
      </label>
      <label>
        <span className="label">Thư mục trong khu thiết bị</span>
        <select name="folder" className="select" defaultValue="notes">
          <option value="articles">articles (hướng dẫn / manual)</option>
          <option value="cases">cases (sự cố)</option>
          <option value="notes">notes (ghi chú khác)</option>
        </select>
      </label>
      <label>
        <span className="label">Tóm tắt cho AI (khuyến nghị, bắt buộc nếu file khó trích chữ)</span>
        <textarea
          name="summary"
          className="textarea"
          placeholder="5–15 câu: thiết bị, nội dung chính, mã lỗi liên quan…"
        />
      </label>
      <label>
        <span className="label">File (.md / .docx / ảnh / video)</span>
        <input
          name="file"
          type="file"
          required
          className="input"
          accept=".md,.markdown,.docx,.txt,image/*,video/*"
        />
      </label>
      {error ? <p className="text-base text-red-700">{error}</p> : null}
      <button type="submit" disabled={loading} className="btn btn-primary">
        {loading ? "Đang tải lên..." : "Upload"}
      </button>
    </form>
  );
}
