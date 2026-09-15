import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { articleTags, articles, equipmentTypes, tags } from "@/db/schema";
import { updateArticle } from "@/app/actions";
import { ArticleForm } from "@/components/ArticleForm";

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
    <div className="w-full space-y-4">
      <p className="text-sm text-[var(--muted)]">
        <Link href={`/articles/${id}`}>← Quay lại</Link>
      </p>
      <h1 className="text-2xl font-semibold">Sửa bài kiến thức</h1>
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
        }}
      />
    </div>
  );
}
