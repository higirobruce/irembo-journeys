/* ============================================================================
   Engine types — the canonical dataset shape (matches app/data/schema.json)
   and the layout outputs. Type-only module (fully erasable).
   ============================================================================ */

export type Locale = "en" | "rw";

export interface Condition {
  v?: string;
  op?: "eq" | "neq" | "gte" | "gt" | "lte" | "lt" | "in" | "exists";
  val?: unknown;
  allOf?: Condition[];
  anyOf?: Condition[];
}

export interface Agency {
  id: string;
  name: string;
  short?: string;
  color?: string;
  where?: string;
  type: string;
}

export interface Artifact {
  id: string;
  name: string;
  bring?: boolean;
  issuedBy?: string;
}

export interface Rule {
  severity: "high" | "medium" | "low";
  failureMode: "rejection" | "silent-liability" | "illegal-operation" | "rework";
  when?: Condition | null;
  message: string;
  mitigation?: string;
}

export interface Duration {
  min?: number;
  max?: number;
  unit: "instant" | "min" | "hour" | "day" | "week";
}

export interface Service {
  id: string;
  name: string;
  short?: string;
  agency: string;
  desc?: string;
  requires: string[];
  produces: string[];
  cost: { model: string };
  duration: Duration;
  hidden?: boolean;
  appliesWhen?: Condition | null;
  rules?: Rule[];
  _meta?: { status: string; source: string; updated?: string; note?: string };
}

export interface JourneyStep { order: number; service: string; }

export interface Journey {
  id: string;
  name: string;
  blurb?: string;
  icon?: string;
  goalPhrases?: string[];
  outcomeArtifacts?: string[];
  steps: JourneyStep[];
}

export interface Question {
  key: string;
  label: string;
  type: "choice" | "bool";
  def?: unknown;
  opts?: { v: unknown; l: string }[];
}

export interface Dataset {
  version: string;
  agencies: Agency[];
  artifacts: Artifact[];
  services: Service[];
  journeys: Journey[];
  questions: Record<string, Question[]>;
}

export type Profile = Record<string, unknown>;

export interface ActiveStep { id: string; svc: Service; }

export interface Edge { from: string; to: string; art: string; }
export interface EdgePath extends Edge { path: string; x1: number; y1: number; x2: number; y2: number; }

export interface LayoutNode {
  id: string;
  svc: Service;
  x: number; y: number; col: number; row: number;
  depth: number; preds: string[]; succs: string[];
  order: number;
}

export interface LayoutOpts {
  density?: "compact" | "regular" | "comfy";
  variant?: "cards" | "compact" | "transit";
  hideHidden?: boolean;
}

export interface LayoutResult {
  nodes: LayoutNode[];
  edges: EdgePath[];
  width: number;
  height: number;
  dim: { w: number; gx: number; gy: number; pad: number; h: number };
  maxC: number;
  density: string;
}

export interface Rollup { steps: number; hidden: number; lo: number; hi: number; fees: boolean; }
export interface Warning { sev: string; msg: string; tip?: string; step: string; stepId: string; }
