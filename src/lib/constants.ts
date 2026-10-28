export {
  MAX_LEVEL_BY_RARITY,
  MAX_SKILL_LEVEL_BY_PROMOTION,
  COST_BY_RARITY,
  MAX_PROMOTION_BY_RARITY,
  MODULE_REQ_BY_RARITY,
} from "./costTables";

import type { Server } from "./types";

export const RARITY_COLORS = [
  "#ffffff", // 0 (unused)
  "#9f9f9f", // 1
  "#dce537", // 2
  "#00b2f6", // 3
  "#dbb1db", // 4
  "#fbae02", // 5
  "#f96601", // 6
] as const;

export const CLASS_LIST = [
  "Vanguard",
  "Guard",
  "Defender",
  "Sniper",
  "Caster",
  "Medic",
  "Supporter",
  "Specialist",
] as const;

export const SERVERS: Server[] = ["EN", "JP", "KR", "TW", "CN", "B"];

export const BATTLE_RECORD_TO_EXP: Record<string, number> = {
  "2001": 200,
  "2002": 400,
  "2003": 1000,
  "2004": 2000,
};

/** Battle records, largest first — used for "what do I need to farm" hints. */
export const BATTLE_RECORD_IDS = ["2004", "2003", "2002", "2001"] as const;

export const LMD_ID = "4001";
export const EXP_ID = "EXP";
export const CATALYST_ID = "32001";

const ONE_POTENTIAL_OPS = new Set(["char_159_peacok", "char_4019_ncdeer", "char_4067_lolxh"]);

export const getMaxPotential = (opId: string): number => (ONE_POTENTIAL_OPS.has(opId) ? 1 : 6);

export const STORAGE_KEY = "zoot.state.v1";
export const THEME_KEY = "zoot.theme";
export const LEGACY_STORAGE_KEY = "arknights-adda.state.v1";
export const LEGACY_THEME_KEY = "arknights-adda.theme";
export const SAVE_VERSION = 1;

export const CDN_BASE = "https://d3gqz3mx7fd4v.cloudfront.net/images";
