"use client";
import { useState } from "react";
import { login } from "@/lib/apiClient";
import type { Role } from "@/lib/server/session";

const ROLES: { role: Role; label: string; desc: string }[] = [
  { role: "editor", label: "Editor", desc: "Draft & import services" },
  { role: "reviewer", label: "Reviewer", desc: "Approve items in the review queue" },
  { role: "publisher", label: "Publisher", desc: "Publish services live to citizens" },
];

export default function SignIn() {
  const [name, setName] = useState("");
  const [role, setRole] = useState<Role>("publisher");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit() {
    setBusy(true); setErr(null);
    try { await login(role, name.trim() || undefined); window.location.href = "/admin"; }
    catch (e) { setErr((e as Error).message); setBusy(false); }
  }

  return (
    <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", background: "var(--bg)", padding: 20 }}>
      <div style={{ width: 420, maxWidth: "92vw", background: "var(--paper)", border: "1px solid var(--line)", borderRadius: "var(--r-lg)", boxShadow: "var(--shadow-lg)", padding: "30px 30px 26px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 11, marginBottom: 6 }}>
          <div style={{ width: 32, height: 32, borderRadius: 9, background: "var(--brand)", color: "#fff", display: "grid", placeItems: "center" }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="6" cy="6" r="2.4" /><circle cx="6" cy="18" r="2.4" /><circle cx="18" cy="12" r="2.4" /><path d="M8 7l8 4M8 17l8-4" /></svg>
          </div>
          <div style={{ fontWeight: 800 }}>Journey Companion <span style={{ color: "var(--faint)", fontWeight: 500 }}>· Admin</span></div>
        </div>
        <h1 style={{ fontSize: "1.3rem", margin: "8px 0 4px" }}>Sign in</h1>
        <p style={{ color: "var(--soft)", fontSize: ".9rem", margin: "0 0 20px" }}>
          Dev sign-in — pick a role to explore the lifecycle. In production this is RISA SSO.
        </p>

        <label style={{ fontSize: ".72rem", textTransform: "uppercase", letterSpacing: ".05em", color: "var(--faint)", fontWeight: 800 }}>Your name (optional)</label>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. J. Mukamana"
          style={{ width: "100%", margin: "6px 0 18px", border: "1px solid var(--line)", borderRadius: "var(--r-sm)", padding: "10px 12px", font: "inherit", background: "var(--paper)", color: "var(--ink)" }} />

        <label style={{ fontSize: ".72rem", textTransform: "uppercase", letterSpacing: ".05em", color: "var(--faint)", fontWeight: 800 }}>Role</label>
        <div style={{ display: "flex", flexDirection: "column", gap: 8, margin: "8px 0 22px" }}>
          {ROLES.map((r) => (
            <button key={r.role} onClick={() => setRole(r.role)}
              style={{ textAlign: "left", border: `1.5px solid ${role === r.role ? "var(--brand)" : "var(--line)"}`, background: role === r.role ? "var(--brand-soft)" : "var(--paper)", borderRadius: "var(--r-md)", padding: "11px 14px", cursor: "pointer" }}>
              <div style={{ fontWeight: 700, fontSize: ".92rem", color: "var(--ink)" }}>{r.label}</div>
              <div style={{ fontSize: ".8rem", color: "var(--soft)" }}>{r.desc}</div>
            </button>
          ))}
        </div>

        {err && <div style={{ color: "var(--red)", fontSize: ".84rem", marginBottom: 12 }}>{err}</div>}
        <button className="btn primary" style={{ width: "100%" }} onClick={submit} disabled={busy}>{busy ? "Signing in…" : "Sign in →"}</button>
      </div>
    </div>
  );
}
