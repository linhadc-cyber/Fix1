import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { articles, cases, equipmentTypes, software } from "@/db/schema";
import { severityLabel } from "@/lib/utils";
import { BackButton } from "@/components/BackButton";
import { Breadcrumb } from "@/components/Breadcrumb";
import { canEdit, requireUser } from "@/lib/session";
import { resolveEquipmentSlug } from "@/lib/equipment-catalog";

const PAGE_SIZE = 10;

function paginate<T>(items: T[], page: number) {
  const totalPages = Math.max(1, Math.ceil(items.length / PAGE_SIZE));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const start = (safePage - 1) * PAGE_SIZE;
  return {
    slice: items.slice(start, start + PAGE_SIZE),
    total: items.length,
    totalPages,
    page: safePage,
  };
}

function Pager({
  slug,
  section,
  page,
  totalPages,
}: {
  slug: string;
  section: string;
  page: number;
  totalPages: number;
}) {
  if (totalPages <= 1) return null;
  const base = `/equipment/${slug}?section=${section}`;
  return (
    <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
      {page > 1 ? (
        <Link href={`${base}&page=${page - 1}`} className="btn btn-secondary">
          ← Trước
        </Link>
      ) : (
        <span className="btn btn-secondary opacity-40">← Trước</span>
      )}
      <span className="text-[var(--muted)]">
        Trang {page} / {totalPages}
      </span>
      {page < totalPages ? (
        <Link href={`${base}&page=${page + 1}`} className="btn btn-secondary">
          Sau →
        </Link>
      ) : (
        <span className="btn btn-secondary opacity-40">Sau →</span>
      )}
    </div>
  );
}

export default async function EquipmentPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ section?: string; page?: string }>;
}) {
  const { slug: rawSlug } = await params;
  const { section: rawSection, page: rawPage } = await searchParams;
  const resolved = resolveEquipmentSlug(rawSlug);
  if (resolved !== rawSlug) {
    const qs = new URLSearchParams();
    if (rawSection) qs.set("section", rawSection);
    if (rawPage) qs.set("page", rawPage);
    const q = qs.toString();
    redirect(`/equipment/${resolved}${q ? `?${q}` : ""}`);
  }
  const slug = resolved;
  const section =
    rawSection === "cases" ||
    rawSection === "software" ||
    rawSection === "docs"
      ? rawSection === "docs"
        ? "software"
        : rawSection
      : "articles";
  const pageNum = Math.max(1, Number(rawPage) || 1);

  const equipment = db
    .select()
    .from(equipmentTypes)
    .where(eq(equipmentTypes.slug, slug))
    .get();
  if (!equipment) notFound();

  const user = await requireUser();

  const articleList = db
    .select()
    .from(articles)
    .where(eq(articles.equipmentTypeId, equipment.id))
    .orderBy(desc(articles.updatedAt))
    .all();

  const caseList = db
    .select()
    .from(cases)
    .where(eq(cases.equipmentTypeId, equipment.id))
    .orderBy(desc(cases.updatedAt))
    .all();

  const softwareList = db
    .select()
    .from(software)
    .where(eq(software.equipmentTypeId, equipment.id))
    .orderBy(desc(software.createdAt))
    .all();

  const articlesPage = paginate(articleList, pageNum);
  const casesPage = paginate(caseList, pageNum);
  const softwarePage = paginate(softwareList, pageNum);

  const sections = [
    { key: "articles", label: `Bài viết (${articleList.length})` },
    { key: "cases", label: `Tình huống (${caseList.length})` },
    { key: "software", label: `Software (${softwareList.length})` },
  ] as const;

  return (
    <div className="page-stack">
      <div>
        <Breadcrumb
          items={[
            { label: "Trang chủ", href: "/" },
            { label: equipment.name },
          ]}
        />
        <div className="mt-2 flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-2xl font-semibold">{equipment.name}</h1>
            <p className="mt-2 text-sm text-[var(--muted)]">
              {equipment.description}
            </p>
          </div>
          <BackButton fallbackHref="/" />
        </div>
      </div>

      <section className="zone zone-filter" aria-label="Loại nội dung">
        <p className="zone-title">Loại nội dung</p>
        <div className="flex flex-wrap gap-2">
          {sections.map((s) => (
            <Link
              key={s.key}
              href={`/equipment/${slug}?section=${s.key}`}
              className={`chip ${section === s.key ? "chip-active" : ""}`}
            >
              {s.label}
            </Link>
          ))}
        </div>
      </section>

      {section === "articles" ? (
        <section className="zone zone-list">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <p className="zone-title mb-0">Bài viết · {PAGE_SIZE}/trang</p>
            {canEdit(user?.role) ? (
              <Link
                href={`/articles/new?equipmentTypeId=${equipment.id}`}
                className="btn btn-primary text-sm"
              >
                + Bài viết
              </Link>
            ) : null}
          </div>
          <div className="space-y-2">
            {articlesPage.total === 0 ? (
              <p className="text-sm text-[var(--muted)]">Chưa có bài.</p>
            ) : (
              articlesPage.slice.map((a) => (
                <a
                  key={a.id}
                  href={`/articles/${a.id}`}
                  className="card card-interactive block"
                >
                  <div className="font-medium">{a.title}</div>
                  <div className="text-sm text-[var(--muted)]">{a.updatedAt}</div>
                </a>
              ))
            )}
          </div>
          <Pager
            slug={slug}
            section="articles"
            page={articlesPage.page}
            totalPages={articlesPage.totalPages}
          />
        </section>
      ) : null}

      {section === "cases" ? (
        <section className="zone zone-list">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <p className="zone-title mb-0">Tình huống · {PAGE_SIZE}/trang</p>
            {canEdit(user?.role) ? (
              <Link
                href={`/cases/new?equipmentTypeId=${equipment.id}`}
                className="btn btn-primary text-sm"
              >
                + Tình huống
              </Link>
            ) : null}
          </div>
          <div className="space-y-2">
            {casesPage.total === 0 ? (
              <p className="text-sm text-[var(--muted)]">Chưa có tình huống.</p>
            ) : (
              casesPage.slice.map((c) => (
                <a
                  key={c.id}
                  href={`/cases/${c.id}`}
                  className="card card-interactive block"
                >
                  <div className="font-medium">{c.title}</div>
                  <div className="text-sm text-[var(--muted)]">
                    {severityLabel[c.severity]} · {c.updatedAt}
                  </div>
                </a>
              ))
            )}
          </div>
          <Pager
            slug={slug}
            section="cases"
            page={casesPage.page}
            totalPages={casesPage.totalPages}
          />
        </section>
      ) : null}

      {section === "software" ? (
        <section className="zone zone-list">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <p className="zone-title mb-0">Software · {PAGE_SIZE}/trang</p>
            {canEdit(user?.role) ? (
              <Link
                href={`/software/new?equipmentTypeId=${equipment.id}`}
                className="btn btn-primary text-sm"
              >
                + Software
              </Link>
            ) : null}
          </div>
          <div className="space-y-2">
            {softwarePage.total === 0 ? (
              <p className="text-sm text-[var(--muted)]">
                Chưa có software cho thiết bị này.
              </p>
            ) : (
              softwarePage.slice.map((s) => (
                <a
                  key={s.id}
                  href={`/software/${s.id}`}
                  className="card card-interactive block"
                >
                  <div className="font-medium">{s.name}</div>
                  <div className="text-sm text-[var(--muted)]">
                    {s.vendor} · {s.createdAt}
                  </div>
                  {s.functionText ? (
                    <div className="mt-1 line-clamp-2 text-sm text-[var(--muted)]">
                      {s.functionText}
                    </div>
                  ) : null}
                </a>
              ))
            )}
          </div>
          <Pager
            slug={slug}
            section="software"
            page={softwarePage.page}
            totalPages={softwarePage.totalPages}
          />
        </section>
      ) : null}
    </div>
  );
}
