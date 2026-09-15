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
const model = "deepseek-v4-pro-ga-260813";
const base = "https://ark.ap-southeast.bytepluses.com/api/v3";

async function hit(label, path, body) {
  const res = await fetch(`${base}${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  console.log(`\n=== ${label} ===`);
  console.log("status", res.status, "len", text.length);
  console.log(text.slice(0, 500).replace(/\s+/g, " "));
}

await hit("chat/completions", "/chat/completions", {
  model,
  messages: [{ role: "user", content: "Reply with exactly: OK" }],
  max_tokens: 16,
  temperature: 0,
  stream: false,
});

await hit("responses", "/responses", {
  model,
  input: [{ role: "user", content: "Reply with exactly: OK" }],
});

await hit("responses+web_search", "/responses", {
  model,
  input: [{ role: "user", content: "Reply with exactly: OK" }],
  tools: [{ type: "web_search", max_keyword: 2 }],
});
