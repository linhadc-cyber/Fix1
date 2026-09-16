import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { caseTags, cases, equipmentTypes, tags } from "@/db/schema";
import { updateCase } from "@/app/actions";
import { AiKeywordsField } from "@/components/AiKeywordsField";
import { Breadcrumb } from "@/components/Breadcrumb";
import { ClearableTextarea } from "@/components/ClearableTextarea";

export default async function EditCasePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: idStr } = await params;
  const id = Number(idStr);
  const item = db.select().from(cases).where(eq(cases.id, id)).get();
  if (!item) notFound();

  const equipment = db
    .select()
    .from(equipmentTypes)
    .orderBy(equipmentTypes.sortOrder)
    .all();

  const tagList = db
    .select({ name: tags.name })
    .from(caseTags)
    .innerJoin(tags, eq(caseTags.tagId, tags.id))
    .where(eq(caseTags.caseId, id))
    .all();

  return (
    <div className="page-stack w-full">
      <div>
        <Breadcrumb
          items={[
            { label: "Trang chủ", href: "/" },
            { label: item.title, href: `/cases/${id}` },
            { label: "Sửa" },
          ]}
        />
        <h1 className="mt-2 text-2xl font-semibold">Sửa tình huống</h1>
      </div>
      <form action={updateCase} className="form-stack">
        <input type="hidden" name="id" value={id} />
        <section className="zone zone-content space-y-4">
          <p className="zone-title">Thông tin tình huống</p>
          <label>
            <span className="label">Tiêu đề</span>
            <input
              name="title"
              required
              className="input"
              defaultValue={item.title}
            />
          </label>
          <div className="grid gap-4 sm:grid-cols-2">
            <label>
              <span className="label">Loại thiết bị</span>
              <select
                name="equipmentTypeId"
                required
                className="select"
                defaultValue={item.equipmentTypeId}
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
              <select
                name="severity"
                className="select"
                defaultValue={item.severity}
              >
                <option value="low">Thấp</option>
                <option value="medium">Trung bình</option>
                <option value="high">Cao</option>
                <option value="critical">Nghiêm trọng</option>
              </select>
            </label>
          </div>
          <label>
            <span className="label">Tags</span>
            <input
              name="tags"
              className="input"
              defaultValue={tagList.map((t) => t.name).join(", ")}
            />
          </label>
        </section>

        <section className="zone zone-meta">
          <p className="zone-title">Keyword AI</p>
          <AiKeywordsField defaultValue={item.aiKeywords || ""} />
        </section>

        <section className="zone zone-content space-y-4">
          <p className="zone-title">Nội dung xử lý</p>
          <ClearableTextarea
            name="symptoms"
            label="Triệu chứng"
            className="textarea"
            defaultValue={item.symptoms}
          />
          <ClearableTextarea
            name="cause"
            label="Nguyên nhân"
            className="textarea"
            defaultValue={item.cause}
          />
          <ClearableTextarea
            name="resolution"
            label="Cách xử lý"
            className="textarea"
            defaultValue={item.resolution}
          />
          <ClearableTextarea
            name="prevention"
            label="Phòng ngừa"
            className="textarea"
            defaultValue={item.prevention}
          />
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
