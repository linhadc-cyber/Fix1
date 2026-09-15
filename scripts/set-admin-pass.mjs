import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { db } from "../src/db/index.ts";
import { users } from "../src/db/schema.ts";

async function main() {
  const hash = await bcrypt.hash("12345@abc", 10);
  const row = db.select().from(users).where(eq(users.username, "admin")).get();
  if (!row) {
    console.error("NO_ADMIN");
    process.exit(1);
  }
  db.update(users).set({ passwordHash: hash }).where(eq(users.id, row.id)).run();
  console.log("OK");
}

main();
