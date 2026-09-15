import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const env = Object.fromEntries(
  readFileSync(resolve(import.meta.dirname, "../.env.local"), "utf8")
    .split(/\r?\n/)
    .filter((l) => l && !l.startsWith("#") && l.includes("="))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i), l.slice(i + 1)];
    }),
);
const key = env.ARK_API_KEY;

const urls = [
  "https://ark.ap-southeast.bytepluses.com/api/coding/v3/chat/completions",
  "https://ark.ap-southeast.bytepluses.com/api/coding/chat/completions",
];

for (const url of urls) {
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "ark-code-latest",
      messages: [{ role: "user", content: "Reply with exactly: OK" }],
      max_tokens: 16,
      temperature: 0,
    }),
  });
  const text = await res.text();
  console.log(url);
  console.log(" ", res.status, "len", text.length, text.slice(0, 220).replace(/\s+/g, " "));
}
