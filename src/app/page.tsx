import Link from "next/link";
import { desc, eq, like, or, SQL } from "drizzle-orm";
import { db } from "@/db";
import { articles, cases, equipmentTypes, software, users } from "@/db/schema";
import { severityLabel } from "@/lib/utils";

const HOME_PREVIEW = 5;

function SearchForm({
  tab,
  q,
  placeholder,
}: {
  tab: string;
  q: string;
  placeholder: string;
}) {
  return (
    <form className="flex flex-wrap items-end gap-2" method="get">
      {tab !== "articles" ? (
        <input type="hidden" name="tab" value={tab} />
      ) : null}
      <label className="min-w-[14rem] flex-1">
        <span className="label">Tìm kiếm</span>
        <input
          name="q"
          className="input"
          defaultValue={q}
          placeholder={placeholder}
        />
      </label>
      <button type="submit" className="btn btn-primary">
        Tìm
      </button>
      {q ? (
        <Link
          href={tab === "articles" ? "/" : `/?tab=${tab}`}
          className="btn btn-secondary"
        >
          Xóa lọc
        </Link>
      ) : null}
    </form>
  );
}

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; q?: string }>;
}) {
  const { tab: rawTab, q: rawQ } = await searchParams;
  const tab =
    rawTab === "cases" || rawTab === "software" || rawTab === "docs"
      ? rawTab === "docs"
        ? "software"
        : rawTab
      : "articles";
  const q = String(rawQ || "").trim();
  const pattern = `%${q}%`;

  const equipment = db
    .select()
    .from(equipmentTypes)
    .orderBy(equipmentTypes.sortOrder)
    .all();

  const articleBase = db
    .select({
      id: articles.id,
      title: articles.title,
      createdAt: articles.createdAt,
      equipmentName: equipmentTypes.name,
      aiKeywords: articles.aiKeywords,
    })
    .from(articles)
    .leftJoin(equipmentTypes, eq(articles.equipmentTypeId, equipmentTypes.id))
    .orderBy(desc(articles.updatedAt));

  const articleFilter: SQL | undefined = q
    ? or(
        like(articles.title, pattern),
        like(articles.aiKeywords, pattern),
        like(equipmentTypes.name, pattern),
      )
    : undefined;

  const articleList = q
    ? articleBase.where(articleFilter).all()
    : articleBase.limit(HOME_PREVIEW).all();

  const caseBase = db
    .select({
      id: cases.id,
      title: cases.title,
      severity: cases.severity,
      createdAt: cases.createdAt,
      equipmentName: equipmentTypes.name,
      aiKeywords: cases.aiKeywords,
    })
    .from(cases)
    .leftJoin(equipmentTypes, eq(cases.equipmentTypeId, equipmentTypes.id))
    .orderBy(desc(cases.updatedAt));

  const caseFilter: SQL | undefined = q
    ? or(
        like(cases.title, pattern),
        like(cases.aiKeywords, pattern),
        like(equipmentTypes.name, pattern),
      )
    : undefined;

  const caseList = q
    ? caseBase.where(caseFilter).all()
    : caseBase.limit(HOME_PREVIEW).all();

  const softwareQuery = db
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
    .orderBy(desc(software.createdAt));

  const softwareList = q
    ? softwareQuery
        .where(
          or(
            like(software.name, pattern),
            like(software.functionText, pattern),
            like(software.vendor, pattern),
            like(software.aiKeywords, pattern),
          ),
        )
        .all()
    : softwareQuery.limit(HOME_PREVIEW).all();

  const tabs = [
    { key: "articles", label: "Bài viết mới" },
    { key: "cases", label: "Tình huống mới" },
    { key: "software", label: "Software" },
  ] as const;

  function tabHref(key: string) {
    return key === "articles" ? "/" : `/?tab=${key}`;
  }

  return (
    <div className="space-y-6">
      <section className="space-y-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Trang chủ</h1>
          <p className="mt-1 max-w-2xl text-sm text-[var(--muted)]">
            Kho kiến thức sửa chữa. Không lọc thì hiện {HOME_PREVIEW} mục mới
            nhất; có tìm kiếm thì hiện đủ kết quả khớp.
          </p>
        </div>

        <div>
          <h2 className="mb-2 text-sm font-semibold text-[var(--muted)]">
            Theo thiết bị
          </h2>
          <div className="flex flex-wrap gap-2">
            {equipment.map((e) => (
              <Link
                key={e.id}
                href={`/equipment/${e.slug}`}
                className="btn btn-secondary"
              >
                {e.name}
              </Link>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {tabs.map((t) => (
            <Link
              key={t.key}
              href={tabHref(t.key)}
              className={`btn ${tab === t.key ? "btn-primary" : "btn-secondary"}`}
            >
              {t.label}
            </Link>
          ))}
        </div>
      </section>

      <section className="stagger space-y-2">
        {tab === "articles" ? (
          <SearchForm
            tab="articles"
            q={tab === "articles" ? q : ""}
            placeholder="Tiêu đề / loại thiết bị / Keyword AI…"
          />
        ) : null}
        {tab === "cases" ? (
          <SearchForm
            tab="cases"
            q={q}
            placeholder="Tiêu đề / loại thiết bị / Keyword AI…"
          />
        ) : null}
        {tab === "software" ? (
          <SearchForm
            tab="software"
            q={q}
            placeholder="Tên / chức năng / hãng / Keyword AI…"
          />
        ) : null}

        {!q ? (
          <p className="text-xs text-[var(--muted)]">
            Hiển thị tối đa {HOME_PREVIEW} mục mới nhất khi chưa tìm.
          </p>
        ) : null}

        {tab === "articles" &&
          (articleList.length === 0 ? (
            <p className="text-sm text-[var(--muted)]">
              {q ? "Không có bài viết khớp." : "Chưa có bài viết."}
            </p>
          ) : (
            articleList.map((a) => (
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
            ))
          ))}

        {tab === "cases" &&
          (caseList.length === 0 ? (
            <p className="text-sm text-[var(--muted)]">
              {q ? "Không có tình huống khớp." : "Chưa có tình huống."}
            </p>
          ) : (
            caseList.map((c) => (
              <a
                key={c.id}
                href={`/cases/${c.id}`}
                className="card card-interactive block"
              >
                <div className="font-medium">{c.title}</div>
                <div className="mt-0.5 text-sm text-[var(--muted)]">
                  {c.equipmentName} · {severityLabel[c.severity]} · {c.createdAt}
                </div>
                {c.aiKeywords ? (
                  <div className="mt-1 line-clamp-1 text-xs text-[var(--muted)]">
                    Keyword: {c.aiKeywords}
                  </div>
                ) : null}
              </a>
            ))
          ))}

        {tab === "software" &&
          (softwareList.length === 0 ? (
            <p className="text-sm text-[var(--muted)]">
              {q ? "Không có software khớp." : "Chưa có software."}
            </p>
          ) : (
            softwareList.map((s) => (
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
            ))
          ))}
      </section>
    </div>
  );
}
