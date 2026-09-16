import { NextResponse } from "next/server";
import { hasAiKey, resolveAiConfig } from "@/lib/ai/ask";
import {
  orchestrateAsk,
  publicSources,
  type FocusSource,
  type HistoryItem,
} from "@/lib/ai/orchestrate";
import {
  getSessionMemory,
  saveSessionMemory,
} from "@/lib/ai/sessions";
import { emptySessionMemory } from "@/lib/ai/session-memory";
import { requireUser } from "@/lib/session";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const user = await requireUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!hasAiKey()) {
    return NextResponse.json(
      {
        error:
          "Chưa có ARK_API_KEY. Thêm vào .env.local rồi restart server.",
        needKey: true,
      },
      { status: 503 },
    );
  }

  const body = await request.json().catch(() => null);
  const question = String(body?.question || "").trim();
  const allowInternet = Boolean(body?.allowInternet);
  const sessionId = Number(body?.sessionId);
  const history = (Array.isArray(body?.history) ? body.history : [])
    .filter(
      (m: HistoryItem) =>
        m &&
        (m.role === "user" || m.role === "assistant") &&
        typeof m.content === "string",
    )
    .slice(-8) as HistoryItem[];

  const focusSources = (
    Array.isArray(body?.focusSources) ? body.focusSources : []
  )
    .filter(
      (s: FocusSource) =>
        s &&
        (s.type === "article" ||
          s.type === "case" ||
          s.type === "doc" ||
          s.type === "software") &&
        Number.isFinite(Number(s.id)),
    )
    .map((s: FocusSource) => ({
      type: s.type,
      id: Number(s.id),
    }))
    .slice(0, 8) as FocusSource[];

  if (!question) {
    return NextResponse.json({ error: "Nhập câu hỏi" }, { status: 400 });
  }

  const cfg = resolveAiConfig();

  let sessionMemory = emptySessionMemory();
  if (Number.isFinite(sessionId) && sessionId > 0) {
    sessionMemory =
      getSessionMemory(user.id, sessionId) || emptySessionMemory();
  }

  try {
    const result = await orchestrateAsk({
      question,
      allowInternet,
      history,
      focusSources,
      sessionMemory,
    });

    if (Number.isFinite(sessionId) && sessionId > 0) {
      saveSessionMemory(user.id, sessionId, result.memory);
    }

    return NextResponse.json({
      answer: result.answer,
      sources: publicSources(result.sources),
      mode: result.mode,
      meta: result.meta,
      memory: result.memory,
      model: cfg?.model || null,
      provider: cfg?.provider || null,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Lỗi AI";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
