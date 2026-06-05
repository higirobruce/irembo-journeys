"use client";
import { useState, useMemo, useEffect } from "react";
import { ENGINE, JOURNEYS, AGENCIES, QUESTIONS } from "@/lib/data";
import { darken, mixWhite, mixDark } from "@/lib/colors";
import { TopBar, Wizard } from "@/components/TopBar";
import { GoalScreen } from "@/components/GoalScreen";
import { QuestionsScreen } from "@/components/QuestionsScreen";
import { GraphCanvas, type Filter } from "@/components/GraphCanvas";
import { JourneyBar } from "@/components/JourneyBar";
import { DetailPanel } from "@/components/DetailPanel";
import { TweaksPanel, TWEAK_DEFAULTS, type Tweaks } from "@/components/Tweaks";

const VARIANT_MAP: Record<string, string> = { Cards: "cards", Minimal: "compact", Transit: "transit" };
const DENSITY_MAP: Record<string, "compact" | "regular" | "comfy"> = { Compact: "compact", Regular: "regular", Comfy: "comfy" };

type Answers = Record<string, unknown>;

export default function App() {
  const [t, setT] = useState<Tweaks>(TWEAK_DEFAULTS);
  const setTweak = <K extends keyof Tweaks>(k: K, v: Tweaks[K]) => setT((p) => ({ ...p, [k]: v }));

  const [screen, setScreen] = useState(1);
  const [journeyId, setJourneyId] = useState<string | null>(null);
  const [goalText, setGoalText] = useState("");
  const [answers, setAnswers] = useState<Answers>({});
  const [audience, setAudience] = useState("citizen");

  const [progress, setProgress] = useState(false);
  const [done, setDone] = useState<Set<string>>(() => new Set());
  const [selected, setSelected] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>({ type: "none" });

  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute("data-theme", t.dark ? "dark" : "light");
    root.style.setProperty("--brand", t.brand);
    root.style.setProperty("--brand-700", darken(t.brand, 0.18));
    root.style.setProperty("--brand-soft", t.dark ? mixDark(t.brand, 0.74) : mixWhite(t.brand, 0.88));
  }, [t.dark, t.brand]);

  const variant = VARIANT_MAP[t.direction] || "cards";
  const density = DENSITY_MAP[t.density] || "regular";

  const layout = useMemo(() => {
    if (!journeyId) return null;
    return ENGINE.layout(journeyId, answers, { density, variant: variant as "cards" | "compact" | "transit", hideHidden: t.hideHidden });
  }, [journeyId, answers, density, variant, t.hideHidden]);

  const rollup = useMemo(() => (layout ? ENGINE.rollup(layout.nodes, layout.edges) : null), [layout]);
  const warnings = useMemo(() => (layout ? ENGINE.warnings(layout.nodes, answers) : []), [layout, answers]);
  const usedAgencies = useMemo(() => (layout ? [...new Set(layout.nodes.map((n) => n.svc.agency))] : []), [layout]);

  function pickJourney(id: string) { setJourneyId(id); }
  function goToQuestions() {
    const seed: Answers = {};
    (QUESTIONS[journeyId!] || []).forEach((q) => { seed[q.key] = q.key in answers ? answers[q.key] : q.def; });
    setAnswers(seed); setScreen(2);
  }
  function goToJourney() { setDone(new Set()); setSelected(null); setFilter({ type: "none" }); setScreen(3); }
  function toggleDone(id: string) {
    setDone((d) => { const n = new Set(d); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }

  const selectedNode = layout && selected ? layout.nodes.find((n) => n.id === selected) ?? null : null;
  const topWarnings = warnings.filter((w) => w.sev === "high").slice(0, 2);
  const journeyGoal = journeyId ? JOURNEYS[journeyId].outcomeArtifacts?.[0] : undefined;

  return (
    <div className="app">
      <TopBar audience={audience} setAudience={setAudience} />
      <Wizard screen={screen} />

      {screen === 1 && (
        <div className="scroll"><div className="container screen-anim">
          <GoalScreen goalText={goalText} setGoalText={setGoalText} journeyId={journeyId}
            pickJourney={pickJourney} onContinue={goToQuestions} audience={audience} />
        </div></div>
      )}

      {screen === 2 && journeyId && (
        <div className="scroll"><div className="container screen-anim">
          <QuestionsScreen journeyId={journeyId} answers={answers} setAnswers={setAnswers}
            onBack={() => setScreen(1)} onNext={goToJourney} audience={audience} />
        </div></div>
      )}

      {screen === 3 && layout && rollup && journeyId && (
        <div className="journey screen-anim">
          <JourneyBar journey={JOURNEYS[journeyId]} rollup={rollup} progress={progress}
            onToggleProgress={() => setProgress((p) => !p)} filter={filter} setFilter={setFilter}
            agencies={AGENCIES} usedAgencies={usedAgencies} doneCount={done.size} onEdit={() => setScreen(2)} />
          {topWarnings.length > 0 && (
            <div className="heads-up">
              <div className="heads-up-icon">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-4 10.5c.7.7 1 1.2 1 2.5h6c0-1.3.3-1.8 1-2.5A6 6 0 0 0 12 3z" /></svg>
              </div>
              <div className="heads-up-body">
                <div className="heads-up-title">Before you start — easy mistakes to avoid</div>
                <ul className="heads-up-list">
                  {topWarnings.map((w, i) => (
                    <li key={i}><b>{w.step}:</b> {w.msg} <span className="wtip">{w.tip}</span></li>
                  ))}
                </ul>
              </div>
            </div>
          )}
          <GraphCanvas layout={layout} variant={variant} progress={progress} done={done}
            selected={selected} filter={filter} onSelect={setSelected} onToggleDone={toggleDone}
            journeyGoal={journeyGoal} />
          {selectedNode && (
            <DetailPanel node={selectedNode} agencies={AGENCIES} allNodes={layout.nodes}
              done={done} progress={progress} onClose={() => setSelected(null)} onToggleDone={toggleDone} />
          )}
        </div>
      )}

      <TweaksPanel t={t} setTweak={setTweak} />
    </div>
  );
}
