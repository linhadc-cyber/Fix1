import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { articles, cases, equipmentTypes, media } from "@/db/schema";
import { severityLabel } from "@/lib/utils";

const HOME_PREVIEW = 5;

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const { tab: rawTab } = await searchParams;
  const tab = rawTab === "cases" || rawTab === "docs" ? rawTab : "articles";

  const equipment = db
    .select()
    .from(equipmentTypes)
    .orderBy(equipmentTypes.sortOrder)
    .all();

  const articleList = db
    .select({
      id: articles.id,
      title: articles.title,
      createdAt: articles.createdAt,
      equipmentName: equipmentTypes.name,
    })
    .from(articles)
    .leftJoin(equipmentTypes, eq(articles.equipmentTypeId, equipmentTypes.id))
    .orderBy(desc(articles.updatedAt))
    .limit(HOME_PREVIEW)
    .all();

  const caseList = db
    .select({
      id: cases.id,
      title: cases.title,
      severity: cases.severity,
      createdAt: cases.createdAt,
      equipmentName: equipmentTypes.name,
    })
    .from(cases)
    .leftJoin(equipmentTypes, eq(cases.equipmentTypeId, equipmentTypes.id))
    .orderBy(desc(cases.updatedAt))
    .limit(HOME_PREVIEW)
    .all();

  const docList = db
    .select({
      id: media.id,
      title: media.title,
      kind: media.kind,
      createdAt: media.createdAt,
      equipmentName: equipmentTypes.name,
    })
    .from(media)
    .leftJoin(equipmentTypes, eq(media.equipmentTypeId, equipmentTypes.id))
    .orderBy(desc(media.createdAt))
    .limit(HOME_PREVIEW)
    .all();

  const tabs = [
    { key: "articles", label: "Bài viết mới" },
    { key: "cases", label: "Tình huống mới" },
    { key: "docs", label: "Tài liệu mới" },
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
            Kho kiến thức sửa chữa. Chọn thiết bị để xem đủ danh sách; tại đây chỉ
            hiện {HOME_PREVIEW} mục mới nhất mỗi loại.
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
        <p className="text-xs text-[var(--muted)]">
          Hiển thị tối đa {HOME_PREVIEW} mục mới nhất. Xem đủ khi chọn từng thiết bị.
        </p>

        {tab === "articles" &&
          (articleList.length === 0 ? (
            <p className="text-sm text-[var(--muted)]">Chưa có bài viết.</p>
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
              </a>
            ))
          ))}

        {tab === "cases" &&
          (caseList.length === 0 ? (
            <p className="text-sm text-[var(--muted)]">Chưa có tình huống.</p>
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
              </a>
            ))
          ))}

        {tab === "docs" &&
          (docList.length === 0 ? (
            <p className="text-sm text-[var(--muted)]">Chưa có tài liệu.</p>
          ) : (
            docList.map((d) => (
              <a
                key={d.id}
                href={`/media/${d.id}`}
                className="card card-interactive block"
              >
                <div className="font-medium">{d.title}</div>
                <div className="mt-0.5 text-sm text-[var(--muted)]">
                  {d.kind}
                  {d.equipmentName ? ` · ${d.equipmentName}` : ""} · {d.createdAt}
                </div>
              </a>
            ))
          ))}
      </section>
    </div>
  );
}
