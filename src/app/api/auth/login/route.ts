import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { getIronSession } from "iron-session";
import { cookies } from "next/headers";
import { db } from "@/db";
import { users } from "@/db/schema";
import { sessionOptions, type SessionData } from "@/lib/session";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const username = String(body?.username || "").trim();
  const password = String(body?.password || "");

  if (!username || !password) {
    return NextResponse.json(
      { error: "Nhập tài khoản và mật khẩu" },
      { status: 400 },
    );
  }

  const user = db.select().from(users).where(eq(users.username, username)).get();
  if (!user) {
    return NextResponse.json(
      { error: "Sai tài khoản hoặc mật khẩu" },
      { status: 401 },
    );
  }

  if (user.disabled) {
    return NextResponse.json(
      { error: "Tài khoản đã bị khóa. Liên hệ quản trị viên." },
      { status: 403 },
    );
  }

  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) {
    return NextResponse.json(
      { error: "Sai tài khoản hoặc mật khẩu" },
      { status: 401 },
    );
  }

  const cookieStore = await cookies();
  const session = await getIronSession<SessionData>(cookieStore, sessionOptions);
  session.userId = user.id;
  session.username = user.username;
  session.displayName = user.displayName;
  session.role = user.role;
  session.isLoggedIn = true;
  await session.save();

  return NextResponse.json({ ok: true });
}
