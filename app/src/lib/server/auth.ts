/* M4 auth — permission guard for API route handlers, backed by the signed
   session cookie (src/lib/server/session.ts). In non-production, an x-user-role
   header is still accepted as a testing fallback. */
import { NextResponse } from "next/server";
import { sessionFromRequest, isRole, type Role } from "./session";

export type { Role };
export type Action = "edit" | "approve" | "publish";

// Editor drafts/imports; Reviewer approves; Publisher publishes live.
export const PERMISSIONS: Record<Action, Role[]> = {
  edit: ["editor", "reviewer", "publisher"],
  approve: ["reviewer", "publisher"],
  publish: ["publisher"],
};

export function roleFromRequest(req: Request): Role | null {
  const s = sessionFromRequest(req);
  if (s) return s.role;
  if (process.env.NODE_ENV !== "production") {
    const h = req.headers.get("x-user-role");
    if (isRole(h)) return h; // dev/testing convenience only
  }
  return null;
}

export function requirePermission(req: Request, action: Action): { ok: true; role: Role } | { ok: false; res: NextResponse } {
  const role = roleFromRequest(req);
  if (role && PERMISSIONS[action].includes(role)) return { ok: true, role };
  const status = role ? 403 : 401;
  const error = role
    ? `Forbidden: '${action}' requires one of ${PERMISSIONS[action].join(", ")}`
    : "Not signed in";
  return { ok: false, res: NextResponse.json({ error, role }, { status }) };
}
