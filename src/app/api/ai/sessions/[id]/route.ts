import { NextResponse } from "next/server";
import {
  deleteChatSession,
  getChatSession,
  renameChatSession,
  saveChatSession,
} from "@/lib/ai/sessions";
import { requireUser } from "@/lib/session";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_request: Request, ctx: Ctx) {
  const user = await requireUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await ctx.params;
  const sessionId = Number(id);
  if (!Number.isFinite(sessionId)) {
    return NextResponse.json({ error: "ID không hợp lệ" }, { status: 400 });
  }
  const data = getChatSession(user.id, sessionId);
  if (!data) {
    return NextResponse.json({ error: "Không tìm thấy phiên" }, { status: 404 });
  }
  return NextResponse.json(data);
}

export async function PUT(request: Request, ctx: Ctx) {
  const user = await requireUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await ctx.params;
  const sessionId = Number(id);
  if (!Number.isFinite(sessionId)) {
    return NextResponse.json({ error: "ID không hợp lệ" }, { status: 400 });
  }

  const body = await request.json().catch(() => null);
  const title =
    typeof body?.title === "string" ? body.title.trim() : undefined;
  const messages = Array.isArray(body?.messages) ? body.messages : null;

  if (messages) {
    const normalized = messages
      .filter(
        (m: { role?: string; content?: string }) =>
          (m?.role === "user" || m?.role === "assistant") &&
          typeof m.content === "string",
      )
      .map(
        (m: {
          role: "user" | "assistant";
          content: string;
          sourcesJson?: string;
          sources?: unknown;
          mode?: string;
        }) => ({
          role: m.role,
          content: m.content,
          sourcesJson:
            m.sourcesJson ||
            (m.sources ? JSON.stringify(m.sources) : "[]"),
          mode: m.mode || "local",
        }),
      );

    const data = saveChatSession(user.id, sessionId, normalized, title);
    if (!data) {
      return NextResponse.json({ error: "Không tìm thấy phiên" }, { status: 404 });
    }
    return NextResponse.json(data);
  }

  if (title) {
    const data = renameChatSession(user.id, sessionId, title);
    if (!data) {
      return NextResponse.json({ error: "Không tìm thấy phiên" }, { status: 404 });
    }
    return NextResponse.json(data);
  }

  return NextResponse.json({ error: "Thiếu dữ liệu lưu" }, { status: 400 });
}

export async function DELETE(_request: Request, ctx: Ctx) {
  const user = await requireUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await ctx.params;
  const sessionId = Number(id);
  if (!Number.isFinite(sessionId)) {
    return NextResponse.json({ error: "ID không hợp lệ" }, { status: 400 });
  }
  const ok = deleteChatSession(user.id, sessionId);
  if (!ok) {
    return NextResponse.json({ error: "Không tìm thấy phiên" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
