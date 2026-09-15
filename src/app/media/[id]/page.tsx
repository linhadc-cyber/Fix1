import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { equipmentTypes, media, users } from "@/db/schema";
import { canEdit, requireUser } from "@/lib/session";
import { deleteMedia } from "@/app/actions";
import { Markdown } from "@/components/Markdown";
import { ConfirmDelete } from "@/components/ConfirmDelete";
import { BackButton } from "@/components/BackButton";

export default async function MediaDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: idStr } = await params;
  const id = Number(idStr);
  const item = db
    .select({
      id: media.id,
      title: media.title,
      kind: media.kind,
      mimeType: media.mimeType,
      originalName: media.originalName,
      sizeBytes: media.sizeBytes,
      summary: media.summary,
      fullText: media.fullText,
      createdAt: media.createdAt,
      equipmentName: equipmentTypes.name,
      equipmentSlug: equipmentTypes.slug,
      uploader: users.displayName,
    })
    .from(media)
    .leftJoin(equipmentTypes, eq(media.equipmentTypeId, equipmentTypes.id))
    .leftJoin(users, eq(media.uploadedById, users.id))
    .where(eq(media.id, id))
    .get();

  if (!item) notFound();
  const user = await requireUser();
  const src = `/api/files/${id}`;
  const fallbackHref = item.equipmentSlug
    ? `/equipment/${item.equipmentSlug}?section=docs`
    : "/?tab=docs";

  return (
    <article className="reader-frame">
      <div className="reader-meta">
        <p className="text-sm text-[var(--muted)]">
          <span className="font-medium text-[var(--foreground)]">
            Mã #{item.id}
          </span>
          {item.equipmentName ? ` · ${item.equipmentName}` : ""}
        </p>
        <h1
          className="mt-1 text-2xl font-semibold leading-tight sm:text-3xl"
          style={{ fontFamily: "var(--font-display), Georgia, serif" }}
        >
          {item.title}
        </h1>
        <p className="mt-1.5 text-sm text-[var(--muted)]">
          {item.kind} · {item.originalName} ·{" "}
          {(item.sizeBytes / 1024).toFixed(1)} KB · {item.uploader}
        </p>
        <div className="mt-2.5 flex items-center justify-between gap-3">
          <BackButton fallbackHref={fallbackHref} />
          {canEdit(user?.role) ? (
            <ConfirmDelete
              label="Xóa file"
              message={`Xóa file “${item.title}”? Thao tác không hoàn tác.`}
              action={deleteMedia}
              hiddenFields={{ id }}
            />
          ) : null}
        </div>
      </div>

      <div className="reader-scroll space-y-3">
        {item.summary ? (
          <div className="card space-y-1">
            <h2 className="text-base font-semibold text-[var(--brand)]">
              Tóm tắt AI
            </h2>
            <p className="whitespace-pre-wrap text-base">{item.summary}</p>
          </div>
        ) : null}

        <div className="card">
          {item.kind === "image" ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={src}
              alt={item.title}
              className="max-h-[70vh] w-auto rounded"
            />
          ) : item.kind === "video" ? (
            <video src={src} controls className="w-full max-w-3xl rounded" />
          ) : item.kind === "pdf" ? (
            <iframe
              src={src}
              title={item.title}
              className="h-[70vh] w-full rounded border-0"
            />
          ) : item.kind === "markdown" || item.kind === "docx" ? (
            <div className="space-y-3">
              <Markdown
                content={item.fullText || "_Chưa trích được nội dung._"}
              />
              <a href={src} className="btn btn-secondary" download>
                Tải file gốc
              </a>
            </div>
          ) : (
            <a href={src} className="text-[var(--brand)] underline" download>
              Tải xuống {item.originalName}
            </a>
          )}
        </div>
      </div>
    </article>
  );
}
