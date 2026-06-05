/* Single entry point to the dataset + engine for the whole app. */
import { createEngine } from "@engine/engine";
import type { Dataset, Agency, Artifact, Journey, Question } from "@engine/types";
import datasetJson from "@data/dataset.json";

export const dataset = datasetJson as unknown as Dataset;
export const ENGINE = createEngine(dataset);

const byId = <T extends { id: string }>(arr: T[]): Record<string, T> =>
  Object.fromEntries(arr.map((x) => [x.id, x]));

export const AGENCIES: Record<string, Agency> = byId(dataset.agencies);
export const ARTIFACTS: Record<string, Artifact> = byId(dataset.artifacts);
export const JOURNEYS: Record<string, Journey> = byId(dataset.journeys);
export const QUESTIONS: Record<string, Question[]> = dataset.questions || {};

export type { Dataset, Agency, Artifact, Journey, Question } from "@engine/types";
