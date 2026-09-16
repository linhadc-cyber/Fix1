import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import {
  caseTags,
  cases,
  equipmentTypes,
  media,
  tags,
  users,
} from "@/db/schema";
import { Markdown } from "@/components/Markdown";
import { ConfirmDelete } from "@/components/ConfirmDelete";
import { BackButton } from "@/components/BackButton";
import { Breadcrumb } from "@/components/Breadcrumb";
import { AttachFiles } from "@/components/AttachFiles";
import { canAdmin, canEdit, requireUser } from "@/lib/session";
import { deleteCase } from "@/app/actions";
import { severityLabel } from "@/lib/utils";

export default async function CaseDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: idStr } = await params;
  const id = Number(idStr);
  const item = db
    .select({
      id: cases.id,
      title: cases.title,
      symptoms: cases.symptoms,
      cause: cases.cause,
      resolution: cases.resolution,
      prevention: cases.prevention,
      severity: cases.severity,
      createdAt: cases.createdAt,
      updatedAt: cases.updatedAt,
      equipmentName: equipmentTypes.name,
      equipmentSlug: equipmentTypes.slug,
      authorName: users.displayName,
    })
    .from(cases)
    .leftJoin(equipmentTypes, eq(cases.equipmentTypeId, equipmentTypes.id))
    .leftJoin(users, eq(cases.authorId, users.id))
    .where(eq(cases.id, id))
    .get();

  if (!item) notFound();

  const tagList = db
    .select({ name: tags.name })
    .from(caseTags)
    .innerJoin(tags, eq(caseTags.tagId, tags.id))
    .where(eq(caseTags.caseId, id))
    .all();

  const files = db.select().from(media).where(eq(media.caseId, id)).all();
  const user = await requireUser();
  const fallbackHref = item.equipmentSlug
    ? `/equipment/${item.equipmentSlug}?section=cases`
    : "/?tab=cases";

  return (
    <article className="reader-doc">
      <Breadcrumb
        items={[
          { label: "Trang chủ", href: "/" },
          ...(item.equipmentSlug
            ? [
                {
                  label: item.equipmentName || "Thiết bị",
                  href: `/equipment/${item.equipmentSlug}?section=cases`,
                },
              ]
            : []),
          { label: item.title },
        ]}
      />

      <div className="reader-toolbar zone zone-actions">
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-lg font-semibold leading-tight sm:text-xl">
            {item.title}
          </h1>
          <p className="mt-0.5 truncate text-xs text-[var(--muted)]">
            #{item.id} · {severityLabel[item.severity]}
            {item.authorName ? ` · ${item.authorName}` : ""} · {item.updatedAt}
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <BackButton fallbackHref={fallbackHref} />
          {canEdit(user?.role) ? (
            <Link href={`/cases/${id}/edit`} className="btn btn-secondary">
              Sửa
            </Link>
          ) : null}
          {canAdmin(user?.role) ? (
            <ConfirmDelete
              message={`Xóa tình huống “${item.title}”? Thao tác không hoàn tác.`}
              action={deleteCase}
              hiddenFields={{ id }}
            />
          ) : null}
        </div>
      </div>

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
        <div className="zone zone-content space-y-4">
          {(
            [
              ["Triệu chứng", item.symptoms],
              ["Nguyên nhân", item.cause],
              ["Cách xử lý", item.resolution],
              ["Phòng ngừa / lưu ý", item.prevention],
            ] as const
          ).map(([label, content]) => (
            <section key={label} className="space-y-1">
              <h2 className="text-base font-semibold text-[var(--brand)]">
                {label}
              </h2>
              <Markdown content={content || "_Chưa ghi._"} />
            </section>
          ))}
        </div>

        <div className="zone zone-meta">
          <p className="zone-title">File đính kèm</p>
          <AttachFiles
            caseId={id}
            canUpload={!!canEdit(user?.role)}
            canDeleteFile={!!canEdit(user?.role)}
            maxBytes={20 * 1024 * 1024}
            maxAttachments={10}
            files={files.map((f) => ({ id: f.id, title: f.title }))}
          />
        </div>
      </div>
    </article>
  );
}
