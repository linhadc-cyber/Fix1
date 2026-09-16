import { redirect } from "next/navigation";
import { db } from "@/db";
import { equipmentTypes } from "@/db/schema";
import { SoftwareForm } from "@/components/SoftwareForm";
import { Breadcrumb } from "@/components/Breadcrumb";
import { canEdit, requireUser } from "@/lib/session";

export default async function NewSoftwarePage({
  searchParams,
}: {
  searchParams: Promise<{ equipmentTypeId?: string }>;
}) {
  const user = await requireUser();
  if (!user || !canEdit(user.role)) {
    redirect("/login");
  }

  const { equipmentTypeId: rawEq } = await searchParams;
  const defaultEquipmentTypeId = Number(rawEq) || undefined;

  const equipment = db
    .select({
      id: equipmentTypes.id,
      name: equipmentTypes.name,
    })
    .from(equipmentTypes)
    .orderBy(equipmentTypes.sortOrder)
    .all();

  return (
    <div className="page-stack w-full">
      <div>
        <Breadcrumb
          items={[
            { label: "Trang chủ", href: "/" },
            { label: "Software mới" },
          ]}
        />
        <h1 className="mt-2 text-2xl font-semibold">Thêm software</h1>
      </div>
      <SoftwareForm
        uploaderName={user.displayName}
        equipment={equipment}
        defaultEquipmentTypeId={
          equipment.some((e) => e.id === defaultEquipmentTypeId)
            ? defaultEquipmentTypeId
            : undefined
        }
      />
    </div>
  );
}
