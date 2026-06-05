"use client";
import { ENGINE, dataset } from "@/lib/data";
import { useLocale } from "@/lib/i18n";
import { JourneyIcons } from "./icons";

export function GoalScreen({ goalText, setGoalText, journeyId, pickJourney, onContinue, audience }: {
  goalText: string; setGoalText: (v: string) => void; journeyId: string | null;
  pickJourney: (id: string) => void; onContinue: () => void; audience: string;
}) {
  const { t } = useLocale();
  function onType(e: React.ChangeEvent<HTMLInputElement>) {
    const v = e.target.value; setGoalText(v);
    const m = ENGINE.matchGoal(v); if (m) pickJourney(m);
  }
  const who = audience === "agent" ? "the citizen wants" : "you want";
  return (
    <>
      <h1 className="title">What do {who} to do?</h1>
      <p className="sub">Tell us the life event — we&apos;ll map the whole path, including the steps people usually don&apos;t know about, and how they depend on each other.</p>
      <div className="search">
        <input value={goalText} onChange={onType} placeholder={'e.g. "open a restaurant" or "transfer a plot to my name"'} />
      </div>
      <div className="or-label">Or pick one</div>
      <div className="goalgrid">
        {dataset.journeys.map((j) => (
          <div key={j.id} className={`goalcard ${journeyId === j.id ? "sel" : ""}`} onClick={() => pickJourney(j.id)}>
            <div className="gic">{j.icon ? JourneyIcons[j.icon] : null}</div>
            <h3>{t(`journey.${j.id}.name`, j.name)}</h3>
            <p>{t(`journey.${j.id}.blurb`, j.blurb || "")}</p>
          </div>
        ))}
      </div>
      <div className="row">
        <span />
        <button className="btn primary" disabled={!journeyId} onClick={onContinue}>Continue →</button>
      </div>
    </>
  );
}
