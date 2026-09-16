import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { equipmentTypes, software, softwareFiles, users } from "@/db/schema";
import { canAdmin, canEdit, requireUser } from "@/lib/session";
import { ConfirmDelete } from "@/components/ConfirmDelete";
import { BackButton } from "@/components/BackButton";
import { Breadcrumb } from "@/components/Breadcrumb";
import { SoftwareAttachFiles } from "@/components/SoftwareAttachFiles";
import { deleteSoftware } from "@/app/actions";

export default async function SoftwareDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: idStr } = await params;
  const id = Number(idStr);
  const item = db
    .select({
      id: software.id,
      name: software.name,
      functionText: software.functionText,
      vendor: software.vendor,
      notes: software.notes,
      aiKeywords: software.aiKeywords,
      createdAt: software.createdAt,
      uploader: users.displayName,
      equipmentName: equipmentTypes.name,
      equipmentSlug: equipmentTypes.slug,
    })
    .from(software)
    .leftJoin(users, eq(software.uploadedById, users.id))
    .leftJoin(
      equipmentTypes,
      eq(software.equipmentTypeId, equipmentTypes.id),
    )
    .where(eq(software.id, id))
    .get();

  if (!item) notFound();

  const files = db
    .select()
    .from(softwareFiles)
    .where(eq(softwareFiles.softwareId, id))
    .all();

  const user = await requireUser();
  const editor = !!canEdit(user?.role);
  const fallbackHref = item.equipmentSlug
    ? `/equipment/${item.equipmentSlug}?section=software`
    : "/?tab=software";

  return (
    <article className="reader-doc">
      <Breadcrumb
        items={[
          { label: "Trang chủ", href: "/" },
          ...(item.equipmentSlug
            ? [
                {
                  label: item.equipmentName || "Thiết bị",
                  href: `/equipment/${item.equipmentSlug}?section=software`,
                },
              ]
            : [
                { label: "Software", href: "/?tab=software" },
              ]),
          { label: item.name },
        ]}
      />

      <div className="reader-toolbar zone zone-actions">
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-lg font-semibold leading-tight sm:text-xl">
            {item.name}
          </h1>
          <p className="mt-0.5 truncate text-xs text-[var(--muted)]">
            #{item.id} · {item.vendor}
            {item.uploader ? ` · ${item.uploader}` : ""} · {item.createdAt}
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <BackButton fallbackHref={fallbackHref} />
          {editor ? (
            <Link href={`/software/${id}/edit`} className="btn btn-secondary">
              Sửa
            </Link>
          ) : null}
          {canAdmin(user?.role) ? (
            <ConfirmDelete
              message={`Xóa software “${item.name}” và toàn bộ file? Thao tác không hoàn tác.`}
              action={deleteSoftware}
              hiddenFields={{ id }}
            />
          ) : null}
        </div>
      </div>

      <div className="reader-body space-y-4">
        <div className="zone zone-content space-y-4">
          <section className="space-y-1">
            <h2 className="text-base font-semibold text-[var(--brand)]">
              Chức năng
            </h2>
            <p className="whitespace-pre-wrap text-base">{item.functionText}</p>
          </section>
          {item.notes ? (
            <section className="space-y-1">
              <h2 className="text-base font-semibold text-[var(--brand)]">
                Ghi chú / hướng dẫn
              </h2>
              <p className="whitespace-pre-wrap text-base">{item.notes}</p>
            </section>
          ) : null}
        </div>

        <div className="zone zone-meta space-y-3">
          <div>
            <p className="zone-title">Keyword AI</p>
            <p className="text-base">{item.aiKeywords || "_Chưa có._"}</p>
          </div>
          <div>
            <p className="zone-title">File phần mềm</p>
            <SoftwareAttachFiles
              softwareId={id}
              canUpload={editor}
              canDeleteFile={editor}
              files={files.map((f) => ({
                id: f.id,
                originalName: f.originalName,
                sizeBytes: f.sizeBytes,
              }))}
            />
          </div>
        </div>
      </div>
    </article>
  );
}
