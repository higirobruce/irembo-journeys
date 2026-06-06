/* M4 auth scaffold — roles + a permission guard for API route handlers.
   SCAFFOLD: role is read from an `x-user-role` header (dev stub). In production
   this is replaced by a real session (NextAuth / gov SSO) — swap `roleFromRequest`. */
import { NextResponse } from "next/server";

export type Role = "editor" | "reviewer" | "publisher";
export type Action = "edit" | "approve" | "publish";

// who can do what (Editor drafts/imports; Reviewer approves; Publisher publishes live)
export const PERMISSIONS: Record<Action, Role[]> = {
  edit: ["editor", "reviewer", "publisher"],
  approve: ["reviewer", "publisher"],
  publish: ["publisher"],
};

export function roleFromRequest(req: Request): Role {
  const h = req.headers.get("x-user-role");
  if (h === "editor" || h === "reviewer" || h === "publisher") return h;
  return "publisher"; // DEV DEFAULT so the scaffold is exercisable; tighten with real auth.
}

export function requirePermission(req: Request, action: Action): { ok: true; role: Role } | { ok: false; res: NextResponse } {
  const role = roleFromRequest(req);
  if (PERMISSIONS[action].includes(role)) return { ok: true, role };
  return {
    ok: false,
    res: NextResponse.json({ error: `Forbidden: '${action}' requires one of ${PERMISSIONS[action].join(", ")}`, role }, { status: 403 }),
  };
}
