/**
 * Broader ModelArk model probe for Coding Plan accounts.
 */
import fs from "node:fs";
import path from "node:path";

function loadEnvLocal() {
  const p = path.join(process.cwd(), ".env.local");
  const raw = fs.readFileSync(p, "utf8");
  /** @type {Record<string, string>} */
  const env = {};
  for (const line of raw.split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i < 0) continue;
    env[t.slice(0, i).trim()] = t.slice(i + 1).trim();
  }
  return env;
}

const env = loadEnvLocal();
const key = env.ARK_API_KEY || env.DEEPSEEK_API_KEY;
const base = "https://ark.ap-southeast.bytepluses.com/api/v3";

const models = [
  // DeepSeek family
  "deepseek-v3",
  "deepseek-v3.1",
  "deepseek-v3-1-250821",
  "deepseek-v3-2-251201",
  "deepseek-v3-2-251215",
  "deepseek-r1",
  "deepseek-r1-250120",
  "deepseek-r1-250528",
  "deepseek-r1-0528",
  // Seed / Doubao coding plan-ish
  "seed-1-6-flash-250715",
  "seed-1-6-thinking-250715",
  "seed-1-6-250615",
  "seed-1-6-251015",
  "seed-2-0-mini-260215",
  "seed-2-0-lite-260228",
  "seed-2-0-260228",
  "doubao-seed-1-6-flash-250715",
  "doubao-seed-1-6-thinking-250715",
  "doubao-seed-1-6-250615",
  "doubao-1-5-thinking-pro-250415",
  "doubao-1-5-lite-32k-250115",
  "doubao-lite-4k-character-240828",
  "doubao-pro-4k-240515",
  "skylark-pro-250415",
  "skylark-lite-250215",
  "kimi-k2-250711",
  "kimi-k2",
];

async function tryOnce(model) {
  const res = await fetch(`${base}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages: [{ role: "user", content: "OK" }],
      max_tokens: 5,
      temperature: 0,
    }),
  });
  const text = await res.text();
  let code = "";
  try {
    code = JSON.parse(text)?.error?.code || "";
  } catch {
    /* ignore */
  }
  return { ok: res.ok, status: res.status, code, text: text.slice(0, 180) };
}

async function main() {
  /** @type {string[]} */
  const openable = [];
  for (const model of models) {
    const r = await tryOnce(model);
    const tag = r.ok ? "OK" : r.code || String(r.status);
    console.log(tag, model);
    if (r.ok) {
      console.log("WINNER", model);
      process.exit(0);
    }
    if (r.code === "ModelNotOpen") openable.push(model);
  }
  console.log("NOT_OPEN_CANDIDATES", openable.join(", ") || "(none)");
  process.exit(2);
}

main();
