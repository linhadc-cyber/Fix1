import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { caseTags, cases, equipmentTypes, tags } from "@/db/schema";
import { updateCase } from "@/app/actions";

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
    <div className="w-full space-y-4">
      <p className="text-sm text-[var(--muted)]">
        <Link href={`/cases/${id}`}>← Quay lại</Link>
      </p>
      <h1 className="text-2xl font-semibold">Sửa tình huống</h1>
      <form action={updateCase} className="card space-y-4">
        <input type="hidden" name="id" value={id} />
        <label>
          <span className="label">Tiêu đề</span>
          <input name="title" required className="input" defaultValue={item.title} />
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
            <select name="severity" className="select" defaultValue={item.severity}>
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
        <label>
          <span className="label">Triệu chứng</span>
          <textarea name="symptoms" className="textarea" defaultValue={item.symptoms} />
        </label>
        <label>
          <span className="label">Nguyên nhân</span>
          <textarea name="cause" className="textarea" defaultValue={item.cause} />
        </label>
        <label>
          <span className="label">Cách xử lý</span>
          <textarea
            name="resolution"
            className="textarea"
            defaultValue={item.resolution}
          />
        </label>
        <label>
          <span className="label">Phòng ngừa</span>
          <textarea
            name="prevention"
            className="textarea"
            defaultValue={item.prevention}
          />
        </label>
        <button type="submit" className="btn btn-primary">
          Cập nhật
        </button>
      </form>
    </div>
  );
}
