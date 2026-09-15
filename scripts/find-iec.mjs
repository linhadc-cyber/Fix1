import { DatabaseSync } from "node:sqlite";
import { resolve } from "node:path";

const db = new DatabaseSync(resolve(import.meta.dirname, "../data/fix1.db"));
const rows = db
  .prepare(
    `SELECT id, title,
            instr(lower(content), '61204') AS pos,
            length(content) AS clen
     FROM articles
     WHERE lower(title) LIKE '%61204%'
        OR lower(content) LIKE '%61204%'
        OR lower(content) LIKE '%iec%'
        OR lower(title) LIKE '%iec%'`,
  )
  .all();

console.log("hits", rows.length);
for (const r of rows) {
  console.log(r);
  if (r.pos > 0) {
    const snip = db
      .prepare(
        `SELECT substr(content, max(1, ? - 100), 280) AS snip FROM articles WHERE id = ?`,
      )
      .get(r.pos, r.id);
    console.log("SNIP:", JSON.stringify(snip.snip));
  }
}

console.log(
  "all articles",
  db.prepare("SELECT id, title, length(content) clen FROM articles").all(),
);
