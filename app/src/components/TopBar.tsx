"use client";
import { useLocale } from "@/lib/i18n";

export function TopBar({ audience, setAudience }: { audience: string; setAudience: (a: string) => void }) {
  const { locale, setLocale, t } = useLocale();
  return (
    <div className="topbar">
      <div className="brandmark">
        <div className="glyph">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="6" cy="6" r="2.4" /><circle cx="6" cy="18" r="2.4" /><circle cx="18" cy="12" r="2.4" /><path d="M8 7l8 4M8 17l8-4" /></svg>
        </div>
        <div className="name">Irembo <span>Journey Companion</span></div>
      </div>
      <div className="topbar-right">
        <div className="audience-toggle">
          <button className={audience === "citizen" ? "on" : ""} onClick={() => setAudience("citizen")}>{t("ui.topbar.citizen", "Citizen")}</button>
          <button className={audience === "agent" ? "on" : ""} onClick={() => setAudience("agent")}>{t("ui.topbar.agent", "Agent")}</button>
        </div>
        <div className="lang" onClick={() => setLocale(locale === "en" ? "rw" : "en")} title="Switch language">
          🌐 {locale === "en" ? "English" : "Kinyarwanda"} ▾
        </div>
        <a className="admin-link" href="/admin" title="Open the admin console">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" /></svg>
          Admin
        </a>
      </div>
    </div>
  );
}

export function Wizard({ screen }: { screen: number }) {
  const { t } = useLocale();
  const steps = [t("ui.wiz.goal", "Your goal"), t("ui.wiz.questions", "A few questions"), t("ui.wiz.journey", "Your journey")];
  return (
    <div className="wiz">
      {steps.map((s, i) => (
        <span key={i} style={{ display: "contents" }}>
          <div className={`step ${screen === i + 1 ? "active" : ""} ${screen > i + 1 ? "done" : ""}`}>
            <span className="b">{screen > i + 1 ? "✓" : i + 1}</span> {s}
          </div>
          {i < steps.length - 1 && <span className="arr">→</span>}
        </span>
      ))}
    </div>
  );
}
