import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const db = new DatabaseSync(resolve(root, "data/fix1.db"));

const arts = db
  .prepare(
    "SELECT id, title, length(content) AS clen, substr(content,1,120) AS preview FROM articles ORDER BY id DESC LIMIT 15",
  )
  .all();
console.log("ARTICLES", JSON.stringify(arts, null, 2));
console.log("counts", {
  articles: db.prepare("SELECT count(*) n FROM articles").get(),
  cases: db.prepare("SELECT count(*) n FROM cases").get(),
  media: db.prepare("SELECT count(*) n FROM media").get(),
});

const q = "hãy hướng dẫn tao cài điện áp cho tủ nạp DC L Salicru";
const fullLike = db
  .prepare(
    "SELECT id, title FROM articles WHERE title LIKE ? OR content LIKE ?",
  )
  .all(`%${q}%`, `%${q}%`);
console.log("full-phrase LIKE hits", fullLike);

for (const token of ["Salicru", "salicru", "điện áp", "tủ nạp", "DC"]) {
  const hits = db
    .prepare(
      "SELECT id, title FROM articles WHERE title LIKE ? OR content LIKE ?",
    )
    .all(`%${token}%`, `%${token}%`);
  console.log(`token '${token}' hits`, hits.length, hits.map((h) => h.title));
}

// Load env without printing key
const envPath = resolve(root, ".env.local");
const env = Object.fromEntries(
  readFileSync(envPath, "utf8")
    .split(/\r?\n/)
    .filter((l) => l && !l.startsWith("#") && l.includes("="))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i), l.slice(i + 1)];
    }),
);

const base = (env.ARK_BASE_URL || "").replace(/\/$/, "");
const model = env.ARK_MODEL || "ark-code-latest";
const key = env.ARK_API_KEY || "";
const url = `${base}/chat/completions`;
console.log("calling", url, "model", model, "keyPrefix", key.slice(0, 8));

const res = await fetch(url, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    Authorization: `Bearer ${key}`,
  },
  body: JSON.stringify({
    model,
    temperature: 0.2,
    messages: [
      { role: "system", content: "Reply briefly in Vietnamese." },
      { role: "user", content: "Chỉ trả lời: OK" },
    ],
  }),
});

const text = await res.text();
console.log("status", res.status);
console.log("content-type", res.headers.get("content-type"));
console.log("bodyLen", text.length);
console.log("bodyHead", text.slice(0, 500));
try {
  const data = JSON.parse(text);
  console.log("choice", data.choices?.[0]?.message?.content?.slice(0, 200));
} catch (e) {
  console.log("JSON parse fail:", e.message);
}
