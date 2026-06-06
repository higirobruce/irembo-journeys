import { NextResponse } from "next/server";
import { encode, isRole, COOKIE_NAME } from "@/lib/server/session";

export const dynamic = "force-dynamic";

// DEV issuer: pick a role + name. Production replaces this with RISA SSO / OIDC;
// the cookie + verification (session.ts) and the role model stay the same.
export async function POST(req: Request) {
  const { email, name, role } = (await req.json()) as { email?: string; name?: string; role?: string };
  if (!isRole(role)) return NextResponse.json({ error: "role must be editor|reviewer|publisher" }, { status: 400 });
  const user = { email: email || `${role}@dev.local`, name: name || role, role };
  const res = NextResponse.json({ ok: true, user });
  res.cookies.set(COOKIE_NAME, encode(user), { httpOnly: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 8 });
  return res;
}
