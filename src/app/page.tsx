import Link from "next/link";
import { count, desc, eq, like, or, SQL } from "drizzle-orm";
import { db } from "@/db";
import { articles, cases, equipmentTypes, software, users } from "@/db/schema";
import { severityLabel } from "@/lib/utils";
import { HomeSearchForm } from "@/components/HomeSearchForm";

const PAGE_SIZE = 20;

function buildHomeHref(opts: { tab: string; q?: string; page?: number }) {
  const params = new URLSearchParams();
  if (opts.tab && opts.tab !== "articles") params.set("tab", opts.tab);
  if (opts.q) params.set("q", opts.q);
  if (opts.page && opts.page > 1) params.set("page", String(opts.page));
  const qs = params.toString();
  return qs ? `/?${qs}` : "/";
}

function HomePager({
  tab,
  q,
  page,
  totalPages,
  total,
}: {
  tab: string;
  q: string;
  page: number;
  totalPages: number;
  total: number;
}) {
  if (totalPages <= 1) {
    return (
      <p className="mt-2 text-xs text-[var(--muted)]">
        {total} mục · trang {page}/{Math.max(1, totalPages)}
      </p>
    );
  }
  return (
    <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
      {page > 1 ? (
        <Link
          href={buildHomeHref({ tab, q, page: page - 1 })}
          className="btn btn-secondary"
        >
          ← Trước
        </Link>
      ) : (
        <span className="btn btn-secondary opacity-40">← Trước</span>
      )}
      <span className="text-[var(--muted)]">
        Trang {page} / {totalPages} · {total} mục
      </span>
      {page < totalPages ? (
        <Link
          href={buildHomeHref({ tab, q, page: page + 1 })}
          className="btn btn-secondary"
        >
          Sau →
        </Link>
      ) : (
        <span className="btn btn-secondary opacity-40">Sau →</span>
      )}
    </div>
  );
}

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; q?: string; page?: string }>;
}) {
  const { tab: rawTab, q: rawQ, page: rawPage } = await searchParams;
  const tab =
    rawTab === "cases" || rawTab === "software" || rawTab === "docs"
      ? rawTab === "docs"
        ? "software"
        : rawTab
      : "articles";
  const q = String(rawQ || "").trim();
  const pattern = `%${q}%`;
  const pageNum = Math.max(1, Number(rawPage) || 1);

  const equipment = db
    .select()
    .from(equipmentTypes)
    .orderBy(equipmentTypes.sortOrder)
    .all();

  const articleFilter: SQL | undefined = q
    ? or(
        like(articles.title, pattern),
        like(articles.aiKeywords, pattern),
        like(equipmentTypes.name, pattern),
      )
    : undefined;

  const articleTotal = Number(
    (articleFilter
      ? db
          .select({ n: count() })
          .from(articles)
          .leftJoin(
            equipmentTypes,
            eq(articles.equipmentTypeId, equipmentTypes.id),
          )
          .where(articleFilter)
          .get()
      : db.select({ n: count() }).from(articles).get()
    )?.n || 0,
  );
  const articlePages = Math.max(1, Math.ceil(articleTotal / PAGE_SIZE));
  const articlePage = Math.min(pageNum, articlePages);
  const articleOffset = (articlePage - 1) * PAGE_SIZE;

  const articleList = (
    articleFilter
      ? db
          .select({
            id: articles.id,
            title: articles.title,
            createdAt: articles.createdAt,
            equipmentName: equipmentTypes.name,
            aiKeywords: articles.aiKeywords,
          })
          .from(articles)
          .leftJoin(
            equipmentTypes,
            eq(articles.equipmentTypeId, equipmentTypes.id),
          )
          .where(articleFilter)
          .orderBy(desc(articles.updatedAt))
          .limit(PAGE_SIZE)
          .offset(articleOffset)
      : db
          .select({
            id: articles.id,
            title: articles.title,
            createdAt: articles.createdAt,
            equipmentName: equipmentTypes.name,
            aiKeywords: articles.aiKeywords,
          })
          .from(articles)
          .leftJoin(
            equipmentTypes,
            eq(articles.equipmentTypeId, equipmentTypes.id),
          )
          .orderBy(desc(articles.updatedAt))
          .limit(PAGE_SIZE)
          .offset(articleOffset)
  ).all();

  const caseFilter: SQL | undefined = q
    ? or(
        like(cases.title, pattern),
        like(cases.aiKeywords, pattern),
        like(equipmentTypes.name, pattern),
      )
    : undefined;

  const caseTotal = Number(
    (caseFilter
      ? db
          .select({ n: count() })
          .from(cases)
          .leftJoin(
            equipmentTypes,
            eq(cases.equipmentTypeId, equipmentTypes.id),
          )
          .where(caseFilter)
          .get()
      : db.select({ n: count() }).from(cases).get()
    )?.n || 0,
  );
  const casePages = Math.max(1, Math.ceil(caseTotal / PAGE_SIZE));
  const casePage = Math.min(pageNum, casePages);
  const caseOffset = (casePage - 1) * PAGE_SIZE;

  const caseList = (
    caseFilter
      ? db
          .select({
            id: cases.id,
            title: cases.title,
            severity: cases.severity,
            createdAt: cases.createdAt,
            equipmentName: equipmentTypes.name,
            aiKeywords: cases.aiKeywords,
          })
          .from(cases)
          .leftJoin(
            equipmentTypes,
            eq(cases.equipmentTypeId, equipmentTypes.id),
          )
          .where(caseFilter)
          .orderBy(desc(cases.updatedAt))
          .limit(PAGE_SIZE)
          .offset(caseOffset)
      : db
          .select({
            id: cases.id,
            title: cases.title,
            severity: cases.severity,
            createdAt: cases.createdAt,
            equipmentName: equipmentTypes.name,
            aiKeywords: cases.aiKeywords,
          })
          .from(cases)
          .leftJoin(
            equipmentTypes,
            eq(cases.equipmentTypeId, equipmentTypes.id),
          )
          .orderBy(desc(cases.updatedAt))
          .limit(PAGE_SIZE)
          .offset(caseOffset)
  ).all();

  const softwareFilter: SQL | undefined = q
    ? or(
        like(software.name, pattern),
        like(software.functionText, pattern),
        like(software.vendor, pattern),
        like(software.aiKeywords, pattern),
      )
    : undefined;

  const softwareTotal = Number(
    (softwareFilter
      ? db.select({ n: count() }).from(software).where(softwareFilter).get()
      : db.select({ n: count() }).from(software).get()
    )?.n || 0,
  );
  const softwarePages = Math.max(1, Math.ceil(softwareTotal / PAGE_SIZE));
  const softwarePage = Math.min(pageNum, softwarePages);
  const softwareOffset = (softwarePage - 1) * PAGE_SIZE;

  const softwareList = (
    softwareFilter
      ? db
          .select({
            id: software.id,
            name: software.name,
            functionText: software.functionText,
            vendor: software.vendor,
            createdAt: software.createdAt,
            uploader: users.displayName,
          })
          .from(software)
          .leftJoin(users, eq(software.uploadedById, users.id))
          .where(softwareFilter)
          .orderBy(desc(software.createdAt))
          .limit(PAGE_SIZE)
          .offset(softwareOffset)
      : db
          .select({
            id: software.id,
            name: software.name,
            functionText: software.functionText,
            vendor: software.vendor,
            createdAt: software.createdAt,
            uploader: users.displayName,
          })
          .from(software)
          .leftJoin(users, eq(software.uploadedById, users.id))
          .orderBy(desc(software.createdAt))
          .limit(PAGE_SIZE)
          .offset(softwareOffset)
  ).all();

  const tabs = [
    { key: "articles", label: "Bài viết", total: articleTotal },
    { key: "cases", label: "Tình huống", total: caseTotal },
    { key: "software", label: "Software", total: softwareTotal },
  ] as const;

  return (
    <div className="page-stack">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Trang chủ</h1>
        <p className="mt-2 max-w-2xl text-sm text-[var(--muted)]">
          Tra cứu kiến thức sửa chữa: chọn thiết bị hoặc lọc theo Bài viết /
          Tình huống / Software · tối đa {PAGE_SIZE} mục/trang.
        </p>
      </div>

      <section className="zone zone-filter" aria-label="Theo thiết bị và loại">
        <p className="zone-title">Theo thiết bị</p>
        <div className="flex flex-wrap gap-2">
          {equipment.map((e) => (
            <Link key={e.id} href={`/equipment/${e.slug}`} className="chip">
              {e.name}
            </Link>
          ))}
        </div>
        <p className="zone-title mt-4">Loại nội dung</p>
        <div className="flex flex-wrap gap-2">
          {tabs.map((t) => (
            <Link
              key={t.key}
              href={buildHomeHref({ tab: t.key, q })}
              className={`chip ${tab === t.key ? "chip-active" : ""}`}
            >
              {t.label} ({t.total})
            </Link>
          ))}
        </div>
      </section>

      <section className="zone zone-search" aria-label="Tìm kiếm">
        <p className="zone-title">Tìm kiếm</p>
        {tab === "articles" ? (
          <HomeSearchForm
            tab="articles"
            q={q}
            placeholder="Tiêu đề / loại thiết bị / Keyword AI…"
          />
        ) : null}
        {tab === "cases" ? (
          <HomeSearchForm
            tab="cases"
            q={q}
            placeholder="Tiêu đề / loại thiết bị / Keyword AI…"
          />
        ) : null}
        {tab === "software" ? (
          <HomeSearchForm
            tab="software"
            q={q}
            placeholder="Tên / chức năng / hãng / Keyword AI…"
          />
        ) : null}
        <p className="mt-2 text-xs text-[var(--muted)]">
          {q
            ? `Kết quả tìm “${q}” trong tab hiện tại.`
            : `Toàn bộ mục thuộc tab · ${PAGE_SIZE} mục/trang.`}
        </p>
      </section>

      <section className="zone zone-list space-y-2" aria-label="Danh sách">
        <p className="zone-title">
          {tab === "articles"
            ? "Danh sách bài viết"
            : tab === "cases"
              ? "Danh sách tình huống"
              : "Danh sách software"}
        </p>

        {tab === "articles" &&
          (articleList.length === 0 ? (
            <p className="text-sm text-[var(--muted)]">
              {q ? "Không có bài viết khớp." : "Chưa có bài viết."}
            </p>
          ) : (
            <>
              {articleList.map((a) => (
                <a
                  key={a.id}
                  href={`/articles/${a.id}`}
                  className="card card-interactive block"
                >
                  <div className="font-medium">{a.title}</div>
                  <div className="mt-0.5 text-sm text-[var(--muted)]">
                    {a.equipmentName} · {a.createdAt}
                  </div>
                  {a.aiKeywords ? (
                    <div className="mt-1 line-clamp-1 text-xs text-[var(--muted)]">
                      Keyword: {a.aiKeywords}
                    </div>
                  ) : null}
                </a>
              ))}
              <HomePager
                tab="articles"
                q={q}
                page={articlePage}
                totalPages={articlePages}
                total={articleTotal}
              />
            </>
          ))}

        {tab === "cases" &&
          (caseList.length === 0 ? (
            <p className="text-sm text-[var(--muted)]">
              {q ? "Không có tình huống khớp." : "Chưa có tình huống."}
            </p>
          ) : (
            <>
              {caseList.map((c) => (
                <a
                  key={c.id}
                  href={`/cases/${c.id}`}
                  className="card card-interactive block"
                >
                  <div className="font-medium">{c.title}</div>
                  <div className="mt-0.5 text-sm text-[var(--muted)]">
                    {c.equipmentName} · {severityLabel[c.severity]} ·{" "}
                    {c.createdAt}
                  </div>
                  {c.aiKeywords ? (
                    <div className="mt-1 line-clamp-1 text-xs text-[var(--muted)]">
                      Keyword: {c.aiKeywords}
                    </div>
                  ) : null}
                </a>
              ))}
              <HomePager
                tab="cases"
                q={q}
                page={casePage}
                totalPages={casePages}
                total={caseTotal}
              />
            </>
          ))}

        {tab === "software" &&
          (softwareList.length === 0 ? (
            <p className="text-sm text-[var(--muted)]">
              {q ? "Không có software khớp." : "Chưa có software."}
            </p>
          ) : (
            <>
              {softwareList.map((s) => (
                <a
                  key={s.id}
                  href={`/software/${s.id}`}
                  className="card card-interactive block"
                >
                  <div className="font-medium">{s.name}</div>
                  <div className="mt-0.5 text-sm text-[var(--muted)]">
                    {s.vendor} · {s.uploader} · {s.createdAt}
                  </div>
                  <div className="mt-1 line-clamp-2 text-sm text-[var(--muted)]">
                    {s.functionText}
                  </div>
                </a>
              ))}
              <HomePager
                tab="software"
                q={q}
                page={softwarePage}
                totalPages={softwarePages}
                total={softwareTotal}
              />
            </>
          ))}
      </section>
    </div>
  );
}
