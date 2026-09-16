import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { articleTags, articles, equipmentTypes, tags } from "@/db/schema";
import { updateArticle } from "@/app/actions";
import { ArticleForm } from "@/components/ArticleForm";
import { Breadcrumb } from "@/components/Breadcrumb";

export default async function EditArticlePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: idStr } = await params;
  const id = Number(idStr);
  const article = db.select().from(articles).where(eq(articles.id, id)).get();
  if (!article) notFound();

  const equipment = db
    .select()
    .from(equipmentTypes)
    .orderBy(equipmentTypes.sortOrder)
    .all();

  const tagList = db
    .select({ name: tags.name })
    .from(articleTags)
    .innerJoin(tags, eq(articleTags.tagId, tags.id))
    .where(eq(articleTags.articleId, id))
    .all();

  return (
    <div className="page-stack w-full">
      <div>
        <Breadcrumb
          items={[
            { label: "Trang chủ", href: "/" },
            { label: article.title, href: `/articles/${id}` },
            { label: "Sửa" },
          ]}
        />
        <h1 className="mt-2 text-2xl font-semibold">Sửa bài kiến thức</h1>
      </div>
      <ArticleForm
        action={updateArticle}
        equipment={equipment}
        submitLabel="Lưu bài viết"
        initial={{
          id: article.id,
          title: article.title,
          equipmentTypeId: article.equipmentTypeId,
          tags: tagList.map((t) => t.name).join(", "),
          content: article.content,
          aiKeywords: article.aiKeywords,
        }}
      />
    </div>
  );
}
