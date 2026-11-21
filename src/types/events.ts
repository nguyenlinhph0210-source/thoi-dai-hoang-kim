import type {
  Branch,
  CharacterStats,
  CharacterStatus,
  EventKind,
  RankTier,
} from "./game";
import type { ActionLog, ActionResult } from "./runtime";
import type { SeatWorld } from "./seats";
export type PersonalEventKind = Extract<
  EventKind,
  "NORMAL" | "RARE" | "DANGEROUS" | "GREAT_CALAMITY"
>;
export type EventTag = "HARM" | "SLANDER" | "INVESTIGATION" | "HAREM_AUDIENCE";
export interface EventRequirements {
  minimums?: Partial<CharacterStats>;
  maximums?: Partial<CharacterStats>;
  tiers?: RankTier[];
  statuses?: CharacterStatus[];
  rankIds?: string[];
}
export interface EventOutcome {
  code: string;
  text: string;
  effects: Partial<CharacterStats>;
  flags: ("SEVERELY_ILL" | "CONVERT_HAREM" | "RUMOR_SETTLEMENT")[];
  terminal: "SUCCESS" | "FAILURE" | "NEXT";
  nextStage?: string;
  type?: "NORMAL" | "AUDIENCE";
}
export interface EventProbability {
  base: number;
  intDivisor: number;
  hpDivisor: number;
  min: number;
  max: number;
  contest: boolean;
}
export interface PersonalEventChoice {
  code: string;
  label: string;
  apCost: number;
  silverCost: number;
  requirements?: EventRequirements;
  result:
    | { kind: "FIXED"; outcome: EventOutcome }
    | {
        kind: "CHANCE";
        formula: EventProbability;
        success: EventOutcome;
        failure: EventOutcome;
      };
}
export interface EventStage {
  code: string;
  title: string;
  body: string;
  choices: PersonalEventChoice[];
  defaultOutcome: EventOutcome;
}
export interface EventDefinition {
  code: string;
  group: PersonalEventKind;
  trigger: "WEEKLY" | "INVESTIGATION";
  branches: Branch[];
  requirements: EventRequirements;
  weight: number;
  cooldownGameDays: number;
  expiresHours: number;
  mandatory: boolean;
  tags: EventTag[];
  title: string;
  body: string;
  stages: EventStage[];
  calamityCode?: string;
  destinyReward?: 1;
  status: "SAMPLE_DRAFT" | "OFFICIAL";
  fictional: true;
}
export interface CharacterEvent {
  id: string;
  accountId: string;
  characterId: string;
  seasonId: string;
  definition: EventDefinition;
  stage: number;
  status: "PENDING" | "RESOLVED" | "EXPIRED";
  createdAt: string;
  expiresAt: string;
  resolvedAt: string | null;
  history: { stage: string; outcome: string; text: string; at: string }[];
}
export interface WeeklyEventCheck {
  accountId: string;
  characterId: string;
  seasonId: string;
  week: number;
  firstActionId: string;
  triggered: boolean;
  group: PersonalEventKind | null;
  eventId: string | null;
  reason: "MISS" | "CREATED" | "FULL" | "NO_ELIGIBLE" | "LEGACY_MARK";
}
export interface WeekMark {
  characterId: string;
  seasonId: string;
  week: number;
  firstActionId: string;
}
export interface CalamityClaim {
  accountId: string;
  seasonId: string;
  calamityCode: string;
}
export interface DestinyEntry {
  id: string;
  accountId: string;
  seasonId: string;
  calamityCode: string | null;
  delta: number;
  reason: "GREAT_CALAMITY" | "REROLL";
  reference: string;
  createdAt: string;
}
export interface ResolveEventInput {
  eventId: string;
  choiceCode: string;
  /** Required by the HTTP API; internal callers may use the current server stage. */
  stage?: number;
}
export interface EventResolutionInfo {
  eventId: string;
  choiceCode: string;
  title: string;
  text: string;
  stage: number;
  completed: boolean;
  success: boolean;
  destinyAwarded: number;
  suspicionNarrative: string;
  expired: boolean;
}
export interface EventRecord {
  accountId: string;
  key: string;
  payload: ResolveEventInput;
  result: ActionResult;
  system: boolean;
  expectedStage: number;
}
export interface EventData {
  instances: CharacterEvent[];
  checks: WeeklyEventCheck[];
  marks: WeekMark[];
  claims: CalamityClaim[];
  ledger: DestinyEntry[];
  records: EventRecord[];
}
export interface EventWorld extends SeatWorld {
  eventData: EventData;
}
export interface PublicPendingEvent {
  id: string;
  code: string;
  title: string;
  body: string;
  group: PersonalEventKind;
  mandatory: boolean;
  stage: number;
  stageCount: number;
  expiresAt: string;
  sample: boolean;
  choices: {
    code: string;
    label: string;
    apCost: number;
    silverCost: number;
    lockReason: string | null;
  }[];
}
export interface EventActionRequest {
  accountId: string;
  key: string;
  code: ActionLog["actionCode"];
  payload: ResolveEventInput | null;
  result: ActionResult;
}
