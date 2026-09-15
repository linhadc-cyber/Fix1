import Link from "next/link";
import { notFound } from "next/navigation";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { articles, cases, equipmentTypes, media } from "@/db/schema";
import { severityLabel } from "@/lib/utils";
import { BackButton } from "@/components/BackButton";

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
  const { slug } = await params;
  const { section: rawSection, page: rawPage } = await searchParams;
  const section =
    rawSection === "cases" || rawSection === "docs" ? rawSection : "articles";
  const pageNum = Math.max(1, Number(rawPage) || 1);

  const equipment = db
    .select()
    .from(equipmentTypes)
    .where(eq(equipmentTypes.slug, slug))
    .get();
  if (!equipment) notFound();

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

  const mediaList = db
    .select()
    .from(media)
    .where(eq(media.equipmentTypeId, equipment.id))
    .orderBy(desc(media.createdAt))
    .all();

  const articlesPage = paginate(articleList, pageNum);
  const casesPage = paginate(caseList, pageNum);
  const docsPage = paginate(mediaList, pageNum);

  const sections = [
    { key: "articles", label: `Bài viết (${articleList.length})` },
    { key: "cases", label: `Tình huống (${caseList.length})` },
    { key: "docs", label: `Tài liệu (${mediaList.length})` },
  ] as const;

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-[var(--muted)]">
          <Link href="/">Trang chủ</Link> / Thiết bị
        </p>
        <div className="mt-2 flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-2xl font-semibold">{equipment.name}</h1>
            <p className="mt-1 text-sm text-[var(--muted)]">
              {equipment.description}
            </p>
          </div>
          <BackButton fallbackHref="/" />
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {sections.map((s) => (
          <Link
            key={s.key}
            href={`/equipment/${slug}?section=${s.key}`}
            className={`btn ${section === s.key ? "btn-primary" : "btn-secondary"}`}
          >
            {s.label}
          </Link>
        ))}
      </div>

      {section === "articles" ? (
        <section>
          <p className="mb-2 text-xs text-[var(--muted)]">
            Mới nhất lên trên · {PAGE_SIZE} mục / trang
          </p>
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
        <section>
          <p className="mb-2 text-xs text-[var(--muted)]">
            Mới nhất lên trên · {PAGE_SIZE} mục / trang
          </p>
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

      {section === "docs" ? (
        <section>
          <p className="mb-2 text-xs text-[var(--muted)]">
            Mới nhất lên trên · {PAGE_SIZE} mục / trang
          </p>
          <div className="space-y-2">
            {docsPage.total === 0 ? (
              <p className="text-sm text-[var(--muted)]">Chưa có tài liệu.</p>
            ) : (
              docsPage.slice.map((m) => (
                <a
                  key={m.id}
                  href={`/media/${m.id}`}
                  className="card card-interactive block"
                >
                  <div className="font-medium">{m.title}</div>
                  <div className="text-sm text-[var(--muted)]">
                    {m.kind} · {m.createdAt}
                  </div>
                </a>
              ))
            )}
          </div>
          <Pager
            slug={slug}
            section="docs"
            page={docsPage.page}
            totalPages={docsPage.totalPages}
          />
        </section>
      ) : null}
    </div>
  );
}
