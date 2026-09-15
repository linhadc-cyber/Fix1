import Link from "next/link";
import { redirect } from "next/navigation";
import { SoftwareForm } from "@/components/SoftwareForm";
import { canEdit, requireUser } from "@/lib/session";

export default async function NewSoftwarePage() {
  const user = await requireUser();
  if (!user || !canEdit(user.role)) {
    redirect("/login");
  }

  return (
    <div className="w-full space-y-4">
      <p className="text-sm text-[var(--muted)]">
        <Link href="/?tab=software">Trang chủ</Link> / Software mới
      </p>
      <h1 className="text-2xl font-semibold">Thêm software</h1>
      <SoftwareForm uploaderName={user.displayName} />
    </div>
  );
}
