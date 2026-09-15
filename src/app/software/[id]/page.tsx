import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { software, softwareFiles, users } from "@/db/schema";
import { canAdmin, requireUser } from "@/lib/session";
import { ConfirmDelete } from "@/components/ConfirmDelete";
import { BackButton } from "@/components/BackButton";
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
    })
    .from(software)
    .leftJoin(users, eq(software.uploadedById, users.id))
    .where(eq(software.id, id))
    .get();

  if (!item) notFound();

  const files = db
    .select()
    .from(softwareFiles)
    .where(eq(softwareFiles.softwareId, id))
    .all();

  const user = await requireUser();

  return (
    <article className="reader-frame">
      <div className="reader-meta">
        <p className="text-sm text-[var(--muted)]">
          <Link href="/?tab=software">Software</Link>
          {" · "}
          <span className="font-medium text-[var(--foreground)]">
            Mã #{item.id}
          </span>
        </p>
        <h1
          className="mt-1 text-2xl font-semibold leading-tight sm:text-3xl"
          style={{ fontFamily: "var(--font-display), Georgia, serif" }}
        >
          {item.name}
        </h1>
        <p className="mt-1.5 text-sm text-[var(--muted)]">
          {item.vendor} · {item.uploader} · {item.createdAt}
        </p>
        <div className="mt-2.5 flex items-center justify-between gap-3">
          <BackButton fallbackHref="/?tab=software" />
          {canAdmin(user?.role) ? (
            <ConfirmDelete
              message={`Xóa software “${item.name}” và toàn bộ file? Thao tác không hoàn tác.`}
              action={deleteSoftware}
              hiddenFields={{ id }}
            />
          ) : null}
        </div>
      </div>

      <div className="reader-scroll space-y-3">
        <div className="card space-y-3">
          <section className="space-y-1">
            <h2 className="text-base font-semibold text-[var(--brand)]">
              Chức năng
            </h2>
            <p className="whitespace-pre-wrap text-base">{item.functionText}</p>
          </section>
          <section className="space-y-1">
            <h2 className="text-base font-semibold text-[var(--brand)]">
              Keyword AI
            </h2>
            <p className="text-base">{item.aiKeywords || "_Chưa có._"}</p>
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

        <div className="card space-y-2">
          <h2 className="text-base font-semibold text-[var(--brand)]">
            File đính kèm ({files.length})
          </h2>
          {files.length === 0 ? (
            <p className="text-sm text-[var(--muted)]">Không có file.</p>
          ) : (
            <ul className="space-y-2">
              {files.map((f) => (
                <li key={f.id} className="flex flex-wrap items-center gap-2">
                  <a
                    href={`/api/software/files/${f.id}`}
                    className="text-[var(--brand)] underline"
                    download
                  >
                    {f.originalName}
                  </a>
                  <span className="text-xs text-[var(--muted)]">
                    {(f.sizeBytes / (1024 * 1024)).toFixed(2)} MB
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </article>
  );
}
