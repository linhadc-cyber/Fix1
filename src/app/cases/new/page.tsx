import { db } from "@/db";
import { equipmentTypes } from "@/db/schema";
import { createCase } from "@/app/actions";
import { AiKeywordsField } from "@/components/AiKeywordsField";
import { Breadcrumb } from "@/components/Breadcrumb";
import { ClearableTextarea } from "@/components/ClearableTextarea";

export default async function NewCasePage({
  searchParams,
}: {
  searchParams: Promise<{ equipmentTypeId?: string }>;
}) {
  const { equipmentTypeId: rawEq } = await searchParams;
  const defaultEquipmentTypeId = Number(rawEq) || undefined;

  const equipment = db
    .select()
    .from(equipmentTypes)
    .orderBy(equipmentTypes.sortOrder)
    .all();

  const selected = equipment.some((e) => e.id === defaultEquipmentTypeId)
    ? defaultEquipmentTypeId
    : equipment[0]?.id;

  return (
    <div className="page-stack w-full">
      <div>
        <Breadcrumb
          items={[
            { label: "Trang chủ", href: "/" },
            { label: "Tình huống mới" },
          ]}
        />
        <h1 className="mt-2 text-2xl font-semibold">Ghi tình huống sửa chữa</h1>
      </div>
      <form action={createCase} className="form-stack">
        <section className="zone zone-content space-y-4">
          <p className="zone-title">Thông tin tình huống</p>
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
              <select
                name="equipmentTypeId"
                required
                className="select"
                defaultValue={selected}
              >
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
        </section>

        <section className="zone zone-meta">
          <p className="zone-title">Keyword AI</p>
          <AiKeywordsField />
        </section>

        <section className="zone zone-content space-y-4">
          <p className="zone-title">Nội dung xử lý</p>
          <ClearableTextarea
            name="symptoms"
            label="Triệu chứng"
            className="textarea"
            required
          />
          <ClearableTextarea
            name="cause"
            label="Nguyên nhân"
            className="textarea"
          />
          <ClearableTextarea
            name="resolution"
            label="Cách xử lý"
            className="textarea"
            required
          />
          <ClearableTextarea
            name="prevention"
            label="Phòng ngừa / lưu ý"
            className="textarea"
          />
        </section>

        <div className="zone zone-actions">
          <button type="submit" className="btn btn-primary">
            Lưu tình huống
          </button>
        </div>
      </form>
    </div>
  );
}
