import { db } from "@/db";
import { equipmentTypes } from "@/db/schema";
import { createArticle } from "@/app/actions";
import { ArticleForm } from "@/components/ArticleForm";
import { Breadcrumb } from "@/components/Breadcrumb";

export default async function NewArticlePage({
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

  return (
    <div className="page-stack w-full">
      <div>
        <Breadcrumb
          items={[
            { label: "Trang chủ", href: "/" },
            { label: "Bài kiến thức mới" },
          ]}
        />
        <h1 className="mt-2 text-2xl font-semibold">Thêm bài kiến thức</h1>
      </div>
      <ArticleForm
        action={createArticle}
        equipment={equipment}
        initial={{
          equipmentTypeId: equipment.some((e) => e.id === defaultEquipmentTypeId)
            ? defaultEquipmentTypeId
            : undefined,
        }}
      />
    </div>
  );
}
