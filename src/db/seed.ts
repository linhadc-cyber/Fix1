import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { db } from "./index";
import { equipmentTypes, users } from "./schema";
import { EQUIPMENT_CATALOG } from "@/lib/equipment-catalog";

async function seed() {
  for (const item of EQUIPMENT_CATALOG) {
    const existing = db
      .select()
      .from(equipmentTypes)
      .where(eq(equipmentTypes.slug, item.slug))
      .get();
    if (!existing) {
      db.insert(equipmentTypes)
        .values({
          slug: item.slug,
          name: item.name,
          description: item.description,
          sortOrder: item.sortOrder,
        })
        .run();
      console.log(`+ Thiết bị: ${item.name}`);
    } else {
      db.update(equipmentTypes)
        .set({
          name: item.name,
          description: item.description,
          sortOrder: item.sortOrder,
        })
        .where(eq(equipmentTypes.id, existing.id))
        .run();
      console.log(`= Thiết bị: ${item.name}`);
    }
  }

  const admin = db
    .select()
    .from(users)
    .where(eq(users.username, "admin"))
    .get();

  if (!admin) {
    const passwordHash = await bcrypt.hash("admin123", 10);
    db.insert(users)
      .values({
        username: "admin",
        passwordHash,
        displayName: "Quản trị viên",
        role: "admin",
      })
      .run();
    console.log("+ Tài khoản admin / admin123 (đổi mật khẩu sau khi triển khai)");
  } else {
    console.log("= Tài khoản admin đã có");
  }

  console.log("Seed xong.");
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
