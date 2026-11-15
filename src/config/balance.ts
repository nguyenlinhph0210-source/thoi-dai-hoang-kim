/** World/AP constants implement AGENTS.md; TEMP values are balance knobs only. */
export const MS_PER_GAME_DAY = 300_000;
export const DAYS_PER_GAME_MONTH = 30;
export const DAYS_PER_GAME_YEAR = 360;
export const DAYS_PER_GAME_WEEK = 7;
export const START_REIGN_YEAR = 8; // Display only; internal years start at 1.
export const INITIAL_AP = 10; // TEMP
export const AP_PER_DAY = 10;
export const AP_CAP = 15;
export const REAL_DAY_MS = 86_400_000;
export const UTC7_OFFSET_MS = 7 * 3_600_000;
export const RESONANCE_STACKING = true; // TODO(spec): choose cumulative 15% per 200 cha.
export const TREATMENTS_REQUIRED = 5; // TODO(spec): five paid treatment actions unlock illness.
export const LOG_PAGE_SIZE = 20;
/** TEMP — deliberately centralized; no balance values in the processor. */
export const ACTION_BALANCE = {
  STUDY: {
    apCost: 1,
    silverCost: 0,
    hpCost: 0,
    gains: { int: 8 },
    dailyCap: 5,
  },
  SOCIALIZE: {
    apCost: 1,
    silverCost: 2,
    hpCost: 0,
    gains: { rep: 7 },
    dailyCap: 4,
  },
  AUDIENCE: {
    apCost: 1,
    silverCost: 0,
    hpCost: 0,
    gains: { fav: 8 },
    dailyCap: 3,
  },
  ETIQUETTE: {
    apCost: 1,
    silverCost: 0,
    hpCost: 0,
    gains: { cha: 7 },
    dailyCap: 4,
  },
  WORK: {
    apCost: 1,
    silverCost: 0,
    hpCost: 12,
    gains: { characterSilver: 15 },
    dailyCap: 8,
  },
  REST: { apCost: 1, silverCost: 0, hpCost: 0, gains: { hp: 20 }, dailyCap: 5 },
  RUMOR: {
    apCost: 1,
    silverCost: 10,
    hpCost: 0,
    gains: { suspicion: -15 },
    dailyCap: 3,
  },
  TREAT: {
    apCost: 1,
    silverCost: 0,
    hpCost: 0,
    gains: { hp: 10 },
    dailyCap: 5,
  },
} as const;
