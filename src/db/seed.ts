import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { db } from "./index";
import { equipmentTypes, users } from "./schema";

const EQUIPMENT = [
  {
    slug: "tu-chinh-luu",
    name: "Tủ chỉnh lưu",
    description: "Hệ thống chỉnh lưu / rectifier cabinet",
    sortOrder: 1,
  },
  {
    slug: "inverter",
    name: "Inverter",
    description: "Bộ biến tần / inverter",
    sortOrder: 2,
  },
  {
    slug: "bacs",
    name: "Giám sát acquy Online BACS",
    description: "Battery Analysis & Care System",
    sortOrder: 3,
  },
  {
    slug: "dossena",
    name: "Giám sát chạm đất Dossena",
    description: "Hệ thống giám sát cách điện / chạm đất Dossena",
    sortOrder: 4,
  },
  {
    slug: "nguon-1-chieu",
    name: "Bộ cấp nguồn 1 chiều",
    description: "DC power supply / nguồn DC",
    sortOrder: 5,
  },
  {
    slug: "ac-quy",
    name: "Ắc quy",
    description: "Pin / ắc quy dự phòng",
    sortOrder: 6,
  },
  {
    slug: "chung",
    name: "Kiến thức chung",
    description: "Tài liệu dùng chung nhiều loại thiết bị",
    sortOrder: 99,
  },
] as const;

async function seed() {
  for (const item of EQUIPMENT) {
    const existing = db
      .select()
      .from(equipmentTypes)
      .where(eq(equipmentTypes.slug, item.slug))
      .get();
    if (!existing) {
      db.insert(equipmentTypes).values(item).run();
      console.log(`+ Thiết bị: ${item.name}`);
    } else {
      console.log(`= Thiết bị đã có: ${item.name}`);
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
