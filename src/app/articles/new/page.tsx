import Link from "next/link";
import { db } from "@/db";
import { equipmentTypes } from "@/db/schema";
import { createArticle } from "@/app/actions";
import { ArticleForm } from "@/components/ArticleForm";

export default function NewArticlePage() {
  const equipment = db
    .select()
    .from(equipmentTypes)
    .orderBy(equipmentTypes.sortOrder)
    .all();

  return (
    <div className="w-full space-y-4">
      <p className="text-sm text-[var(--muted)]">
        <Link href="/">Trang chủ</Link> / Bài kiến thức mới
      </p>
      <h1 className="text-2xl font-semibold">Thêm bài kiến thức</h1>
      <ArticleForm action={createArticle} equipment={equipment} />
    </div>
  );
}
