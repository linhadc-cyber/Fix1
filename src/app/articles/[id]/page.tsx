import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import {
  articleTags,
  articles,
  equipmentTypes,
  media,
  tags,
  users,
} from "@/db/schema";
import { Markdown } from "@/components/Markdown";
import { ConfirmDelete } from "@/components/ConfirmDelete";
import { BackButton } from "@/components/BackButton";
import { AttachFiles } from "@/components/AttachFiles";
import { canAdmin, canEdit, requireUser } from "@/lib/session";
import { deleteArticle } from "@/app/actions";

export default async function ArticleDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: idStr } = await params;
  const id = Number(idStr);
  const article = db
    .select({
      id: articles.id,
      title: articles.title,
      content: articles.content,
      createdAt: articles.createdAt,
      updatedAt: articles.updatedAt,
      equipmentName: equipmentTypes.name,
      equipmentSlug: equipmentTypes.slug,
      authorName: users.displayName,
    })
    .from(articles)
    .leftJoin(equipmentTypes, eq(articles.equipmentTypeId, equipmentTypes.id))
    .leftJoin(users, eq(articles.authorId, users.id))
    .where(eq(articles.id, id))
    .get();

  if (!article) notFound();

  const tagList = db
    .select({ name: tags.name })
    .from(articleTags)
    .innerJoin(tags, eq(articleTags.tagId, tags.id))
    .where(eq(articleTags.articleId, id))
    .all();

  const files = db.select().from(media).where(eq(media.articleId, id)).all();
  const user = await requireUser();
  const fallbackHref = article.equipmentSlug
    ? `/equipment/${article.equipmentSlug}?section=articles`
    : "/?tab=articles";

  return (
    <article className="reader-frame">
      <div className="reader-meta">
        <p className="text-sm text-[var(--muted)]">
          <Link href="/">Trang chủ</Link> /{" "}
          <Link href={`/equipment/${article.equipmentSlug}`}>
            {article.equipmentName}
          </Link>
          {" · "}
          <span className="font-medium text-[var(--foreground)]">
            Mã #{article.id}
          </span>
        </p>
        <h1
          className="mt-1 text-2xl font-semibold leading-tight sm:text-3xl"
          style={{ fontFamily: "var(--font-display), Georgia, serif" }}
        >
          {article.title}
        </h1>
        <p className="mt-1.5 text-sm text-[var(--muted)]">
          {article.authorName} · cập nhật {article.updatedAt}
        </p>
        {tagList.length > 0 ? (
          <div className="mt-2 flex flex-wrap gap-2">
            {tagList.map((t) => (
              <span
                key={t.name}
                className="rounded bg-[var(--bg-soft)] px-2 py-0.5 text-xs"
              >
                {t.name}
              </span>
            ))}
          </div>
        ) : null}
        <div className="mt-2.5 flex items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <BackButton fallbackHref={fallbackHref} />
            {canEdit(user?.role) ? (
              <Link href={`/articles/${id}/edit`} className="btn btn-secondary">
                Sửa
              </Link>
            ) : null}
          </div>
          {canAdmin(user?.role) ? (
            <ConfirmDelete
              message={`Xóa bài viết “${article.title}”? Thao tác không hoàn tác.`}
              action={deleteArticle}
              hiddenFields={{ id }}
            />
          ) : null}
        </div>
      </div>

      <div className="reader-scroll space-y-3">
        <div className="card">
          <Markdown content={article.content || "_Chưa có nội dung._"} />
        </div>

        <AttachFiles
          articleId={id}
          canUpload={!!canEdit(user?.role)}
          files={files.map((f) => ({ id: f.id, title: f.title }))}
        />
      </div>
    </article>
  );
}
