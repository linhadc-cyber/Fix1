import { NextResponse } from "next/server";
import {
  createChatSession,
  listChatSessions,
  MAX_CHAT_SESSIONS,
} from "@/lib/ai/sessions";
import { requireUser } from "@/lib/session";

export const runtime = "nodejs";

export async function GET() {
  const user = await requireUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const sessions = listChatSessions(user.id);
  return NextResponse.json({
    sessions,
    max: MAX_CHAT_SESSIONS,
  });
}

export async function POST(request: Request) {
  const user = await requireUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const body = await request.json().catch(() => null);
  const title = String(body?.title || "Phiên chat mới").trim();
  const session = createChatSession(user.id, title || "Phiên chat mới");
  return NextResponse.json({ session, max: MAX_CHAT_SESSIONS });
}
