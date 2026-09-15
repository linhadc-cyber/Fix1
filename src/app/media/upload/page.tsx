import Link from "next/link";
import { db } from "@/db";
import { equipmentTypes } from "@/db/schema";
import { UploadForm } from "@/components/UploadForm";

export default function MediaUploadPage() {
  const equipment = db
    .select({ id: equipmentTypes.id, name: equipmentTypes.name })
    .from(equipmentTypes)
    .orderBy(equipmentTypes.sortOrder)
    .all();

  return (
    <div className="w-full space-y-4">
      <p className="text-sm text-[var(--muted)]">
        <Link href="/?tab=docs">← Trang chủ</Link>
      </p>
      <h1 className="text-2xl font-semibold">Upload tài liệu / video</h1>
      <UploadForm equipment={equipment} />
    </div>
  );
}
