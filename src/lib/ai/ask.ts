/**
 * ModelArk (BytePlus) — base_url /api/v3 theo docs console.
 */

function trimEnv(name: string) {
  return process.env[name]?.trim() || "";
}

export function resolveAiConfig() {
  const arkKey = trimEnv("ARK_API_KEY") || trimEnv("DEEPSEEK_API_KEY");
  const deepseekKey = trimEnv("DEEPSEEK_API_KEY");

  if (arkKey.startsWith("ark-") || trimEnv("ARK_API_KEY")) {
    const key = trimEnv("ARK_API_KEY") || arkKey;
    if (!key) return null;

    const defaultBase = "https://ark.ap-southeast.bytepluses.com/api/v3";

    return {
      provider: "ark" as const,
      key,
      baseUrl: (trimEnv("ARK_BASE_URL") || defaultBase).replace(/\/$/, ""),
      model: trimEnv("ARK_MODEL") || "deepseek-v4-pro-ga-260813",
    };
  }

  if (deepseekKey) {
    return {
      provider: "deepseek" as const,
      key: deepseekKey,
      baseUrl: "https://api.deepseek.com",
      model: trimEnv("DEEPSEEK_MODEL") || "deepseek-chat",
    };
  }

  return null;
}

export function hasAiKey() {
  return Boolean(resolveAiConfig()?.key);
}

/** @deprecated use hasAiKey */
export function hasDeepSeekKey() {
  return hasAiKey();
}

export function hasAnyAiKey() {
  return hasAiKey() || Boolean(trimEnv("GEMINI_API_KEY"));
}

function formatArkError(status: number, errText: string) {
  const snippet = errText.slice(0, 500);
  try {
    const parsed = JSON.parse(errText) as {
      error?: { code?: string; message?: string };
    };
    const code = parsed.error?.code || "";
    const msg = parsed.error?.message || snippet;
    if (code === "InvalidSubscription") {
      return `Gói ModelArk không hợp lệ/hết hạn (${code}). Kiểm tra console BytePlus.`;
    }
    if (code === "ModelNotOpen" || code === "InvalidEndpointOrModel.NotFound") {
      return `Model chưa mở trên tài khoản ModelArk (${code}): ${msg}`;
    }
    return `ModelArk lỗi ${status}${code ? ` [${code}]` : ""}: ${msg}`;
  } catch {
    if (!errText.trim()) {
      return `ModelArk trả về rỗng (HTTP ${status}). Kiểm tra ARK_BASE_URL = https://ark.ap-southeast.bytepluses.com/api/v3`;
    }
    return `ModelArk lỗi ${status}: ${snippet}`;
  }
}

type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

async function postJson(url: string, key: string, body: unknown) {
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify(body),
  });
  const raw = await res.text();
  if (!res.ok) {
    throw new Error(formatArkError(res.status, raw));
  }
  if (!raw.trim()) {
    throw new Error(formatArkError(res.status, raw));
  }
  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    throw new Error(
      `ModelArk trả JSON không hợp lệ: ${raw.slice(0, 200) || "(rỗng)"}`,
    );
  }
}

export async function callChatModel(opts: {
  system: string;
  user?: string;
  messages?: { role: "user" | "assistant"; content: string }[];
}): Promise<string> {
  const cfg = resolveAiConfig();
  if (!cfg) {
    throw new Error(
      "Chưa cấu hình ARK_API_KEY (ModelArk) trong .env.local. Thêm key rồi restart server.",
    );
  }

  const messages: ChatMessage[] = [{ role: "system", content: opts.system }];
  if (opts.messages?.length) {
    for (const m of opts.messages) {
      messages.push({ role: m.role, content: m.content });
    }
  } else if (opts.user) {
    messages.push({ role: "user", content: opts.user });
  } else {
    throw new Error("Thiếu nội dung hỏi AI");
  }

  const data = await postJson(`${cfg.baseUrl}/chat/completions`, cfg.key, {
    model: cfg.model,
    temperature: 0.2,
    stream: false,
    messages,
  });

  if (data.error) {
    throw new Error(formatArkError(200, JSON.stringify(data)));
  }

  const choices = data.choices as
    | { message?: { content?: string } }[]
    | undefined;
  const text = choices?.[0]?.message?.content?.trim();
  if (!text) {
    throw new Error("ModelArk không trả nội dung");
  }
  return text;
}

/** Responses API + web_search — chỉ khi user yêu cầu tìm internet. */
export async function callChatModelWithWebSearch(opts: {
  system: string;
  user: string;
}): Promise<string> {
  const cfg = resolveAiConfig();
  if (!cfg) {
    throw new Error(
      "Chưa cấu hình ARK_API_KEY (ModelArk) trong .env.local. Thêm key rồi restart server.",
    );
  }

  const data = await postJson(`${cfg.baseUrl}/responses`, cfg.key, {
    model: cfg.model,
    input: [
      { role: "system", content: opts.system },
      { role: "user", content: opts.user },
    ],
    tools: [{ type: "web_search", max_keyword: 3 }],
  });

  if (data.error) {
    throw new Error(formatArkError(200, JSON.stringify(data)));
  }

  const output = data.output as
    | {
        type?: string;
        content?: { type?: string; text?: string }[];
      }[]
    | undefined;

  const texts: string[] = [];
  for (const item of output || []) {
    if (item.type !== "message" || !item.content) continue;
    for (const c of item.content) {
      if (c.type === "output_text" && c.text) texts.push(c.text);
    }
  }
  const text = texts.join("\n").trim();
  if (!text) {
    // Fallback chat nếu responses không parse được
    return callChatModel({
      system: opts.system,
      user: `${opts.user}\n\n(Ghi chú: hãy dùng kiến thức kỹ thuật chung nếu Fix1 thiếu.)`,
    });
  }
  return text;
}

/** @deprecated use callChatModel */
export async function callDeepSeek(opts: {
  system: string;
  user: string;
}): Promise<string> {
  return callChatModel(opts);
}
