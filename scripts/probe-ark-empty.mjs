import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const env = Object.fromEntries(
  readFileSync(resolve(root, ".env.local"), "utf8")
    .split(/\r?\n/)
    .filter((l) => l && !l.startsWith("#") && l.includes("="))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i), l.slice(i + 1)];
    }),
);
const key = env.ARK_API_KEY;

async function tryOnce(label, url, body, extraHeaders = {}) {
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      Authorization: `Bearer ${key}`,
      ...extraHeaders,
    },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  console.log("\n===", label, "===");
  console.log("status", res.status, "ct", res.headers.get("content-type"), "len", text.length);
  console.log("head", JSON.stringify(text.slice(0, 300)));
}

const messages = [
  { role: "user", content: "Say OK" },
];

await tryOnce(
  "coding ark-code-latest no stream",
  "https://ark.ap-southeast.bytepluses.com/api/coding/chat/completions",
  { model: "ark-code-latest", messages, stream: false },
);

await tryOnce(
  "coding with system",
  "https://ark.ap-southeast.bytepluses.com/api/coding/chat/completions",
  {
    model: "ark-code-latest",
    stream: false,
    messages: [
      { role: "system", content: "Be brief" },
      { role: "user", content: "Say OK" },
    ],
  },
);

await tryOnce(
  "coding stream true",
  "https://ark.ap-southeast.bytepluses.com/api/coding/chat/completions",
  { model: "ark-code-latest", messages, stream: true },
);

await tryOnce(
  "api/v3 chat",
  "https://ark.ap-southeast.bytepluses.com/api/v3/chat/completions",
  { model: "ark-code-latest", messages, stream: false },
);

await tryOnce(
  "api/v3 doubao/seed",
  "https://ark.ap-southeast.bytepluses.com/api/v3/chat/completions",
  { model: "seed-1-6-250615", messages, stream: false },
);

// try common coding plan aliases
for (const model of [
  "ark-code-latest",
  "doubao-seed-code",
  "dola-seed-2.0-lite",
  "deepseek-v3-1-terminus",
]) {
  await tryOnce(
    `coding model=${model}`,
    "https://ark.ap-southeast.bytepluses.com/api/coding/chat/completions",
    { model, messages, stream: false, max_tokens: 32 },
  );
}
