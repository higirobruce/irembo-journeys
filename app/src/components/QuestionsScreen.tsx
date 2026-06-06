"use client";
import { JOURNEYS, QUESTIONS } from "@/lib/data";
import { useLocale } from "@/lib/i18n";

type Answers = Record<string, unknown>;

export function QuestionsScreen({ journeyId, answers, setAnswers, onBack, onNext }: {
  journeyId: string; answers: Answers; setAnswers: React.Dispatch<React.SetStateAction<Answers>>;
  onBack: () => void; onNext: () => void; audience: string;
}) {
  const { t } = useLocale();
  const qs = QUESTIONS[journeyId] || [];
  const set = (key: string, val: unknown) => setAnswers((a) => ({ ...a, [key]: val }));
  return (
    <>
      <h1 className="title">{t(`journey.${journeyId}.name`, JOURNEYS[journeyId].name)}</h1>
      <p className="sub">{t("ui.q.sub")}</p>
      <div className="qcard">
        {qs.length === 0 && <div className="q-empty">No extra questions for this journey — continue to see the path.</div>}
        {qs.map((q) => {
          const opts = q.type === "bool" ? [{ v: true, l: t("ui.yes", "Yes") }, { v: false, l: t("ui.no", "No") }] : (q.opts || []);
          const cur = q.key in answers ? answers[q.key] : q.def;
          return (
            <div className="q" key={q.key}>
              <div className="qlabel">{t(`question.${journeyId}.${q.key}.label`, q.label)}</div>
              <div className="opts">
                {opts.map((o) => (
                  <div key={String(o.v)} className={`opt ${cur === o.v ? "sel" : ""}`} onClick={() => set(q.key, o.v)}>
                    {q.type === "bool" ? o.l : t(`question.${journeyId}.${q.key}.opt.${o.v}`, o.l)}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
      <div className="row">
        <button className="btn ghost" onClick={onBack}>{t("ui.q.back", "← Back")}</button>
        <button className="btn primary" onClick={onNext}>{t("ui.q.next", "See my journey →")}</button>
      </div>
    </>
  );
}
