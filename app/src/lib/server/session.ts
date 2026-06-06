/* M4 — session: signed (HMAC) cookie carrying {email, role}. Dependency-free.
   This is real session auth (not gov SSO). Production swaps the *issuer* — the
   sign-in route — for RISA SSO / OIDC; the cookie verification + role model here
   stay. Set AUTH_SECRET in production. */
import crypto from "node:crypto";

export type Role = "editor" | "reviewer" | "publisher";
export interface Session { email: string; name?: string; role: Role }

export const COOKIE_NAME = "irembo_session";
const SECRET = process.env.AUTH_SECRET || "dev-insecure-secret-change-me";
const ROLES: Role[] = ["editor", "reviewer", "publisher"];

const sign = (p: string) => crypto.createHmac("sha256", SECRET).update(p).digest("base64url");

export function encode(s: Session): string {
  const p = Buffer.from(JSON.stringify(s)).toString("base64url");
  return `${p}.${sign(p)}`;
}
export function decode(token: string | undefined): Session | null {
  if (!token) return null;
  const [p, sig] = token.split(".");
  if (!p || !sig || sign(p) !== sig) return null;
  try {
    const s = JSON.parse(Buffer.from(p, "base64url").toString()) as Session;
    return ROLES.includes(s.role) ? s : null;
  } catch { return null; }
}
export function isRole(x: unknown): x is Role { return ROLES.includes(x as Role); }

function parseCookie(header: string | null, name: string): string | undefined {
  if (!header) return undefined;
  for (const part of header.split(";")) {
    const i = part.indexOf("=");
    if (i > -1 && part.slice(0, i).trim() === name) return decodeURIComponent(part.slice(i + 1).trim());
  }
  return undefined;
}
export function sessionFromRequest(req: Request): Session | null {
  return decode(parseCookie(req.headers.get("cookie"), COOKIE_NAME));
}
