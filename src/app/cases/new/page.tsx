import Link from "next/link";
import { db } from "@/db";
import { equipmentTypes } from "@/db/schema";
import { createCase } from "@/app/actions";
import { AiKeywordsField } from "@/components/AiKeywordsField";

export default function NewCasePage() {
  const equipment = db
    .select()
    .from(equipmentTypes)
    .orderBy(equipmentTypes.sortOrder)
    .all();

  return (
    <div className="w-full space-y-4">
      <p className="text-sm text-[var(--muted)]">
        <Link href="/">Trang chủ</Link> / Tình huống mới
      </p>
      <h1 className="text-2xl font-semibold">Ghi tình huống sửa chữa</h1>
      <form action={createCase} className="card space-y-4">
        <label>
          <span className="label">Tiêu đề ngắn</span>
          <input
            name="title"
            required
            className="input"
            placeholder="VD: Inverter báo lỗi OVDC khi khởi động"
          />
        </label>
        <div className="grid gap-4 sm:grid-cols-2">
          <label>
            <span className="label">Loại thiết bị</span>
            <select name="equipmentTypeId" required className="select">
              {equipment.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className="label">Mức độ</span>
            <select name="severity" className="select" defaultValue="medium">
              <option value="low">Thấp</option>
              <option value="medium">Trung bình</option>
              <option value="high">Cao</option>
              <option value="critical">Nghiêm trọng</option>
            </select>
          </label>
        </div>
        <label>
          <span className="label">Tags</span>
          <input name="tags" className="input" placeholder="alarm, điện áp" />
        </label>
        <AiKeywordsField />
        <label>
          <span className="label">Triệu chứng</span>
          <textarea name="symptoms" className="textarea" required />
        </label>
        <label>
          <span className="label">Nguyên nhân</span>
          <textarea name="cause" className="textarea" />
        </label>
        <label>
          <span className="label">Cách xử lý</span>
          <textarea name="resolution" className="textarea" required />
        </label>
        <label>
          <span className="label">Phòng ngừa / lưu ý</span>
          <textarea name="prevention" className="textarea" />
        </label>
        <button type="submit" className="btn btn-primary">
          Lưu tình huống
        </button>
      </form>
    </div>
  );
}
