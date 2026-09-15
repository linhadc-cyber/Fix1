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

const attempts = [
  ["coding-v3-sea", "https://ark.ap-southeast.bytepluses.com/api/coding/v3/chat/completions", "ark-code-latest"],
  ["coding-v3-cn", "https://ark.cn-beijing.volces.com/api/coding/v3/chat/completions", "ark-code-latest"],
  ["v3-sea-deepseek", "https://ark.ap-southeast.bytepluses.com/api/v3/chat/completions", "deepseek-v3-2-251215"],
  ["v3-sea-seed", "https://ark.ap-southeast.bytepluses.com/api/v3/chat/completions", "seed-1-6-250915"],
  ["v3-sea-ep", "https://ark.ap-southeast.bytepluses.com/api/v3/chat/completions", "ep-"],
];

for (const [label, url, model] of attempts) {
  if (model === "ep-") continue;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages: [{ role: "user", content: "OK" }],
      max_tokens: 8,
    }),
  });
  const text = await res.text();
  console.log(label, res.status, text.slice(0, 180).replace(/\s+/g, " "));
}
