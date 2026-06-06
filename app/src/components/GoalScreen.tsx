"use client";
import { ENGINE, dataset } from "@/lib/data";
import { useLocale } from "@/lib/i18n";
import { JourneyIcons } from "./icons";

export function GoalScreen({ goalText, setGoalText, journeyId, pickJourney, onContinue }: {
  goalText: string; setGoalText: (v: string) => void; journeyId: string | null;
  pickJourney: (id: string) => void; onContinue: () => void; audience: string;
}) {
  const { t } = useLocale();
  function onType(e: React.ChangeEvent<HTMLInputElement>) {
    const v = e.target.value; setGoalText(v);
    const m = ENGINE.matchGoal(v); if (m) pickJourney(m);
  }
  return (
    <>
      <h1 className="title">{t("ui.goal.title", "What do you want to do?")}</h1>
      <p className="sub">{t("ui.goal.sub")}</p>
      <div className="search">
        <input value={goalText} onChange={onType} placeholder={t("ui.goal.search")} />
      </div>
      <div className="or-label">{t("ui.goal.orpick", "Or pick one")}</div>
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
        <button className="btn primary" disabled={!journeyId} onClick={onContinue}>{t("ui.goal.continue", "Continue →")}</button>
      </div>
    </>
  );
}
