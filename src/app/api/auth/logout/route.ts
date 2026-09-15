import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";

/** @deprecated Use logoutAction server action from Header instead */
export async function POST(request: Request) {
  const session = await getSession();
  await session.destroy();
  return NextResponse.redirect(new URL("/login", request.url), { status: 303 });
}
