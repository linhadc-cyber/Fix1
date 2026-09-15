import { getIronSession, type SessionOptions } from "iron-session";
import { cookies } from "next/headers";
import type { UserRole } from "@/db/schema";

export type SessionData = {
  userId?: number;
  username?: string;
  displayName?: string;
  role?: UserRole;
  isLoggedIn: boolean;
};

export const sessionOptions: SessionOptions = {
  password:
    process.env.SESSION_SECRET ||
    "fix1-dev-secret-change-me-in-production-32chars",
  cookieName: "fix1_session",
  cookieOptions: {
    secure: process.env.NODE_ENV === "production" && process.env.HTTPS === "1",
    httpOnly: true,
    sameSite: "lax",
    path: "/",
  },
};

export async function getSession() {
  return getIronSession<SessionData>(await cookies(), sessionOptions);
}

export async function requireUser() {
  const session = await getSession();
  if (!session.isLoggedIn || !session.userId || !session.role) {
    return null;
  }
  return {
    id: session.userId,
    username: session.username!,
    displayName: session.displayName!,
    role: session.role,
  };
}

export function canEdit(role?: UserRole) {
  return role === "admin" || role === "editor";
}

export function canAdmin(role?: UserRole) {
  return role === "admin";
}
