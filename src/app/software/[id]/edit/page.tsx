import { notFound, redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { equipmentTypes, software } from "@/db/schema";
import { updateSoftware } from "@/app/actions";
import { AiKeywordsField } from "@/components/AiKeywordsField";
import { Breadcrumb } from "@/components/Breadcrumb";
import { ClearableTextarea } from "@/components/ClearableTextarea";
import { canEdit, requireUser } from "@/lib/session";

export default async function EditSoftwarePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireUser();
  if (!user || !canEdit(user.role)) {
    redirect("/login");
  }

  const { id: idStr } = await params;
  const id = Number(idStr);
  const item = db.select().from(software).where(eq(software.id, id)).get();
  if (!item) notFound();

  const equipment = db
    .select()
    .from(equipmentTypes)
    .orderBy(equipmentTypes.sortOrder)
    .all();

  return (
    <div className="page-stack w-full">
      <div>
        <Breadcrumb
          items={[
            { label: "Trang chủ", href: "/" },
            { label: item.name, href: `/software/${id}` },
            { label: "Sửa" },
          ]}
        />
        <h1 className="mt-2 text-2xl font-semibold">Sửa software</h1>
      </div>
      <form action={updateSoftware} className="form-stack">
        <input type="hidden" name="id" value={id} />
        <section className="zone zone-content space-y-4">
          <p className="zone-title">Thông tin software</p>
          <label>
            <span className="label">Loại thiết bị</span>
            <select
              name="equipmentTypeId"
              required
              className="select"
              defaultValue={item.equipmentTypeId ?? ""}
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
          </label>
          <label>
            <span className="label">Tên software</span>
            <input
              name="name"
              required
              className="input"
              defaultValue={item.name}
            />
          </label>
          <ClearableTextarea
            name="functionText"
            label="Chức năng"
            className="textarea min-h-24"
            required
            defaultValue={item.functionText}
          />
          <label>
            <span className="label">Hãng sản xuất</span>
            <input
              name="vendor"
              required
              className="input"
              defaultValue={item.vendor}
            />
          </label>
          <ClearableTextarea
            name="notes"
            label="Ghi chú / hướng dẫn sử dụng"
            className="textarea min-h-28"
            defaultValue={item.notes}
          />
        </section>

        <section className="zone zone-meta space-y-2">
          <p className="zone-title">Keyword AI</p>
          <AiKeywordsField defaultValue={item.aiKeywords || ""} />
          <p className="text-xs text-[var(--muted)]">
            Muốn đổi/xóa file đính kèm: quay lại trang chi tiết, dùng khu vực
            File đính kèm.
          </p>
        </section>

        <div className="zone zone-actions">
          <button type="submit" className="btn btn-primary">
            Cập nhật
          </button>
        </div>
      </form>
    </div>
  );
}
