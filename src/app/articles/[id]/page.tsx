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
import { Markdown, extractMarkdownToc } from "@/components/Markdown";
import { ArticleToc } from "@/components/ArticleToc";
import { ConfirmDelete } from "@/components/ConfirmDelete";
import { BackButton } from "@/components/BackButton";
import { Breadcrumb } from "@/components/Breadcrumb";
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
  const toc = extractMarkdownToc(article.content || "");
  const hasToc = toc.length >= 2;

  return (
    <article className="reader-doc">
      <Breadcrumb
        items={[
          { label: "Trang chủ", href: "/" },
          ...(article.equipmentSlug
            ? [
                {
                  label: article.equipmentName || "Thiết bị",
                  href: `/equipment/${article.equipmentSlug}`,
                },
              ]
            : []),
          { label: article.title },
        ]}
      />

      <div className="reader-toolbar zone zone-actions">
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-lg font-semibold leading-tight sm:text-xl">
            {article.title}
          </h1>
          <p className="mt-0.5 truncate text-xs text-[var(--muted)]">
            #{article.id}
            {article.authorName ? ` · ${article.authorName}` : ""} ·{" "}
            {article.updatedAt}
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <BackButton fallbackHref={fallbackHref} />
          {canEdit(user?.role) ? (
            <Link href={`/articles/${id}/edit`} className="btn btn-secondary">
              Sửa
            </Link>
          ) : null}
          {canAdmin(user?.role) ? (
            <ConfirmDelete
              message={`Xóa bài viết “${article.title}”? Thao tác không hoàn tác.`}
              action={deleteArticle}
              hiddenFields={{ id }}
            />
          ) : null}
        </div>
      </div>

      <div className={`reader-layout ${hasToc ? "has-toc" : ""}`}>
        {hasToc ? <ArticleToc items={toc} /> : null}
        <div className="reader-body space-y-4">
          {tagList.length > 0 ? (
            <div className="flex flex-wrap gap-2">
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
          <div className="zone zone-content">
            <Markdown content={article.content || "_Chưa có nội dung._"} />
          </div>
          <div className="zone zone-meta">
            <p className="zone-title">File đính kèm</p>
            <AttachFiles
              articleId={id}
              canUpload={!!canEdit(user?.role)}
              files={files.map((f) => ({ id: f.id, title: f.title }))}
            />
          </div>
        </div>
      </div>
    </article>
  );
}
