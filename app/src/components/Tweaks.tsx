"use client";
import { useState } from "react";

export interface Tweaks {
  direction: "Cards" | "Minimal" | "Transit";
  density: "Compact" | "Regular" | "Comfy";
  brand: string;
  dark: boolean;
  hideHidden: boolean;
}
export const TWEAK_DEFAULTS: Tweaks = { direction: "Cards", density: "Regular", brand: "#0E6BA8", dark: false, hideHidden: false };

const BRANDS = ["#0E6BA8", "#0E9488", "#4F46E5", "#1E9E5A", "#C2410C"];

export function TweaksPanel({ t, setTweak }: { t: Tweaks; setTweak: <K extends keyof Tweaks>(k: K, v: Tweaks[K]) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button className="tweaks-fab" onClick={() => setOpen((o) => !o)} title="Customize" aria-label="Customize view">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6" /></svg>
      </button>
      {open && (
        <div className="tweaks-panel">
          <div className="tw-head">Customize <button onClick={() => setOpen(false)}>✕</button></div>
          <TwRadio label="Node style" value={t.direction} options={["Cards", "Minimal", "Transit"]} onChange={(v) => setTweak("direction", v as Tweaks["direction"])} />
          <TwRadio label="Density" value={t.density} options={["Compact", "Regular", "Comfy"]} onChange={(v) => setTweak("density", v as Tweaks["density"])} />
          <TwToggle label="Hide 'easy to forget' steps" value={t.hideHidden} onChange={(v) => setTweak("hideHidden", v)} />
          <div className="tw-section">Brand accent</div>
          <div className="tw-swatches">
            {BRANDS.map((c) => (
              <button key={c} className={`tw-swatch ${t.brand === c ? "on" : ""}`} style={{ background: c }} onClick={() => setTweak("brand", c)} aria-label={c} />
            ))}
          </div>
          <TwToggle label="Dark mode" value={t.dark} onChange={(v) => setTweak("dark", v)} />
        </div>
      )}
    </>
  );
}

function TwRadio({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (v: string) => void }) {
  return (
    <div className="tw-row">
      <div className="tw-section">{label}</div>
      <div className="tw-radio">
        {options.map((o) => (
          <button key={o} className={value === o ? "on" : ""} onClick={() => onChange(o)}>{o}</button>
        ))}
      </div>
    </div>
  );
}

function TwToggle({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="tw-toggle" onClick={() => onChange(!value)}>
      <span>{label}</span>
      <span className={`tw-switch ${value ? "on" : ""}`} />
    </div>
  );
}
