/**
 * Probe ModelArk endpoints/models using .env.local (do not print the key).
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
if (!key) {
  console.error("NO_KEY");
  process.exit(1);
}

const bases = [
  "https://ark.ap-southeast.bytepluses.com/api/v3",
  "https://ark.cn-beijing.volces.com/api/v3",
];

const models = [
  "deepseek-v3-1-250821",
  "deepseek-v3-250324",
  "deepseek-v3-2-251201",
  "deepseek-r1-250528",
  "doubao-1-5-pro-32k-250115",
  "doubao-seed-1-6-250615",
  "seed-1-6-250615",
  "seed-2-0-lite-260228",
];

async function tryOnce(base, model) {
  const res = await fetch(`${base}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages: [{ role: "user", content: "Reply with OK only" }],
      max_tokens: 8,
      temperature: 0,
    }),
  });
  const text = await res.text();
  return { ok: res.ok, status: res.status, text: text.slice(0, 240) };
}

async function main() {
  for (const base of bases) {
    console.log("BASE", base);
    for (const model of models) {
      try {
        const r = await tryOnce(base, model);
        console.log(
          r.ok ? "OK" : "FAIL",
          model,
          r.status,
          r.text.replace(/\s+/g, " ").slice(0, 160),
        );
        if (r.ok) {
          console.log("WINNER", base, model);
          process.exit(0);
        }
      } catch (e) {
        console.log("ERR", model, e instanceof Error ? e.message : String(e));
      }
    }
  }
  console.log("NONE");
  process.exit(2);
}

main();
