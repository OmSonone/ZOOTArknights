import { LMD_ID, getMaxPotential } from "./constants";
import { clamp, maxLevel, maxPromotion, numSkills } from "./operator";
import type {
  Depot,
  DoctorProfile,
  GameData,
  Operator,
  Roster,
  SupportSlot,
} from "./types";

/* ------------------------------------------------------------------ */
/* API shapes (subset of what /account/syncData returns)               */
/* ------------------------------------------------------------------ */

export type ImportServer = "en" | "jp" | "kr";

export const IMPORT_SERVERS: { value: ImportServer; label: string }[] = [
  { value: "en", label: "EN" },
  { value: "jp", label: "JP" },
  { value: "kr", label: "KR" },
];

export interface GameStatus {
  nickName?: string;
  nickNumber?: string;
  uid?: string;
  level?: number;
  gold?: number;
  secretary?: string;
  secretarySkinId?: string;
  registerTs?: number;
  serverName?: string;
}

export interface GameSkill {
  skillId: string;
  specializeLevel?: number;
}

export interface GameEquip {
  level?: number;
  locked?: number;
}

export interface GameChar {
  instId?: number;
  charId: string;
  potentialRank?: number;
  mainSkillLvl?: number;
  skin?: string | null;
  level?: number;
  evolvePhase?: number;
  skills?: GameSkill[];
  equip?: Record<string, GameEquip | null>;
  currentTmpl?: string | null;
  tmpl?: Record<
    string,
    {
      skinId?: string | null;
      skills?: GameSkill[];
      equip?: Record<string, GameEquip | null>;
    }
  >;
}

export interface GameAssist {
  charInstId: number;
  skillIndex?: number | null;
  currentEquip?: string | null;
}

export interface GameUserData {
  status: GameStatus;
  troop: { chars: Record<string, GameChar | undefined> };
  social?: { assistCharList?: (GameAssist | null)[] };
  inventory?: Record<string, number | undefined>;
  building?: {
    rooms?: {
      TRAINING?: Record<string, { trainee?: { charInstId?: number; targetSkill?: number; state?: number } }>;
    };
  };
}

export interface YostarTokenData {
  deviceId: string;
  token: { result: number; uid: string; token: string };
}

export interface SavedCredentials {
  server: ImportServer;
  tokenData: YostarTokenData;
  savedAt: number;
}

export interface GameImportResponse {
  user: GameUserData;
  tokenData: YostarTokenData;
}

/* ------------------------------------------------------------------ */
/* Local API client                                                    */
/* ------------------------------------------------------------------ */

async function post<T>(route: string, body: unknown): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`/api/import/${route}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch {
    throw new Error("Could not reach the local import server. Is the dev/preview server running?");
  }

  const data = (await response.json().catch(() => ({}))) as { error?: string } & T;
  if (!response.ok) {
    throw new Error(data?.error ?? `Import request failed (HTTP ${response.status}).`);
  }
  return data;
}

export const requestCode = (email: string, server: ImportServer) =>
  post<{ ok: true }>("mail", { email, server });

export const requestAccount = (email: string, code: string, server: ImportServer) =>
  post<GameImportResponse>("data", { email, code, server });

export const requestAccountWithToken = (tokenData: YostarTokenData, server: ImportServer) =>
  post<GameImportResponse>("data", { tokenData, server });

export const requestDepotOcr = (images: string[]) =>
  post<{ items: Record<string, number> }>("depot", { images });

/* ------------------------------------------------------------------ */
/* Credential storage                                                  */
/* ------------------------------------------------------------------ */

const TOKEN_KEY = "zoot.import-token.v1";
const LEGACY_TOKEN_KEY = "arknights-adda.import-token.v1";

export function loadSavedCredentials(): SavedCredentials | null {
  for (const key of [TOKEN_KEY, LEGACY_TOKEN_KEY]) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      const parsed = JSON.parse(raw) as SavedCredentials;
      if (!parsed?.tokenData?.token?.token) continue;
      if (key === LEGACY_TOKEN_KEY) {
        saveCredentials(parsed);
        localStorage.removeItem(LEGACY_TOKEN_KEY);
      }
      return parsed;
    } catch {
      // try the next key
    }
  }
  return null;
}

export function saveCredentials(credentials: SavedCredentials): void {
  localStorage.setItem(TOKEN_KEY, JSON.stringify(credentials));
}

export function clearCredentials(): void {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(LEGACY_TOKEN_KEY);
}

/* ------------------------------------------------------------------ */
/* Mapping the game account into the local save                        */
/* ------------------------------------------------------------------ */

export interface ImportOptions {
  operators: boolean;
  profile: boolean;
  depot: boolean;
  applyPotentials: boolean;
}

export interface ImportSummary {
  operators: number;
  e2: number;
  maxPotential: number;
  lmd: number;
  depotItems: number;
}

export interface ImportResult {
  roster: Roster;
  depot: Depot;
  profile: DoctorProfile;
  supports: (SupportSlot | null)[];
  summary: ImportSummary;
}

const asNumber = (value: unknown, fallback = 0): number =>
  typeof value === "number" && Number.isFinite(value) ? value : fallback;

const skillSkinAvatar = (data: GameData, opId: string, skinId: string | null | undefined): string | null => {
  if (!skinId) return null;
  const match = data.skins[opId]?.find((skin) => skin.skinId === skinId);
  return match?.avatarId ?? null;
};

function mapOperator(
  data: GameData,
  opId: string,
  char: {
    level?: number;
    evolvePhase?: number;
    potentialRank?: number;
    mainSkillLvl?: number;
    skinId?: string | null;
    skills?: GameSkill[];
    equip?: Record<string, GameEquip | null>;
  },
  favorite: boolean,
  options: Pick<ImportOptions, "applyPotentials">,
  inventory: Record<string, number | undefined>,
): Operator | null {
  const dataOp = data.operatorMap[opId];
  if (!dataOp) return null;

  const elite = clamp(0, asNumber(char.evolvePhase), maxPromotion(dataOp.rarity));
  const level = clamp(1, asNumber(char.level, 1), maxLevel(dataOp.rarity, elite));
  const potential = clamp(1, asNumber(char.potentialRank) + 1, getMaxPotential(opId));

  const masteries = new Array(numSkills(dataOp)).fill(0) as number[];
  (char.skills ?? []).forEach((skill, index) => {
    if (index < masteries.length) masteries[index] = clamp(0, asNumber(skill.specializeLevel), 3);
  });

  const modules: Record<string, number> = {};
  for (const mod of dataOp.moduleData ?? []) modules[mod.moduleId] = 0;
  for (const [moduleId, state] of Object.entries(char.equip ?? {})) {
    if (!state || state.locked) continue;
    if (!(moduleId in modules)) continue;
    modules[moduleId] = clamp(0, asNumber(state.level), 3);
  }

  let finalPotential = potential;
  if (options.applyPotentials && finalPotential < getMaxPotential(opId)) {
    const suffix = opId.split("_").pop();
    const letter = inventory[`voucher_full_${suffix}`] ?? 0;
    const tokens =
      (inventory[`p_${opId}`] ?? 0) + (inventory[`class_p_${opId}`] ?? 0);
    if (letter > 0) finalPotential = getMaxPotential(opId);
    else if (tokens > 0) finalPotential = Math.min(finalPotential + tokens, getMaxPotential(opId));
  }

  return {
    op_id: opId,
    favorite,
    potential: finalPotential,
    elite,
    level,
    skill_level: dataOp.rarity > 2 ? clamp(1, asNumber(char.mainSkillLvl, 1), 7) : Math.max(1, asNumber(char.mainSkillLvl, 1)),
    masteries,
    modules,
    skin: skillSkinAvatar(data, opId, char.skinId),
  };
}

export function mapImportedAccount(
  user: GameUserData,
  data: GameData,
  current: { roster: Roster; profile: DoctorProfile },
  options: ImportOptions,
): ImportResult {
  const roster: Roster = {};
  const chars = user.troop?.chars ?? {};
  const inventory = user.inventory ?? {};

  for (const char of Object.values(chars)) {
    if (!char?.charId) continue;

    const favorite = current.roster[char.charId]?.favorite ?? false;
    const base = mapOperator(
      data,
      char.charId,
      {
        level: char.level,
        evolvePhase: char.evolvePhase,
        potentialRank: char.potentialRank,
        mainSkillLvl: char.mainSkillLvl,
        skinId: char.skin ?? null,
        skills: char.skills,
        equip: char.equip,
      },
      favorite,
      options,
      inventory,
    );
    if (base) roster[char.charId] = base;

    // Amiya (and any future template operator): one base record holds alternate forms.
    for (const [altId, template] of Object.entries(char.tmpl ?? {})) {
      if (!template) continue;
      const alt = mapOperator(
        data,
        altId,
        {
          level: char.level,
          evolvePhase: char.evolvePhase,
          potentialRank: char.potentialRank,
          mainSkillLvl: char.mainSkillLvl,
          skinId: template.skinId ?? null,
          skills: template.skills,
          equip: template.equip,
        },
        current.roster[altId]?.favorite ?? false,
        options,
        inventory,
      );
      if (alt) roster[altId] = alt;
    }
  }

  // +1 mastery for the operator currently training in the Training Room.
  const training = user.building?.rooms?.TRAINING;
  const trainee = training ? Object.values(training)[0]?.trainee : undefined;
  if (trainee && trainee.state !== 3 && asNumber(trainee.targetSkill, -1) >= 0) {
    const instId = trainee.charInstId;
    const entry = instId != null ? chars[String(instId)] : undefined;
    if (entry) {
      const opId = entry.currentTmpl ?? entry.charId;
      const record = roster[opId];
      if (record && trainee.targetSkill != null && trainee.targetSkill < record.masteries.length) {
        record.masteries[trainee.targetSkill] = clamp(0, record.masteries[trainee.targetSkill] + 1, 3);
      }
    }
  }

  // Depot: only materials we actually plan with, plus LMD.
  const depot: Depot = {};
  for (const [id, count] of Object.entries(inventory)) {
    if (!data.itemMap[id]) continue;
    if (typeof count === "number" && count > 0) depot[id] = count;
  }
  const gold = asNumber(user.status?.gold);
  if (gold > 0) depot[LMD_ID] = gold;

  // Profile
  const registered = asNumber(user.status?.registerTs);
  const onboard = registered > 0 ? new Date(registered * 1000).toISOString().slice(0, 10) : "";
  const profile: DoctorProfile = {
    ...current.profile,
    name: user.status?.nickName || current.profile.name,
    uid: user.status?.uid ? String(user.status.uid) : current.profile.uid,
    level: asNumber(user.status?.level, current.profile.level) || current.profile.level,
    onboard: onboard || current.profile.onboard,
    assistant:
      user.status?.secretary && data.operatorMap[user.status.secretary]
        ? user.status.secretary
        : current.profile.assistant,
  };

  // Supports
  const assists = user.social?.assistCharList ?? [];
  const supports: (SupportSlot | null)[] = [null, null, null];
  assists.slice(0, 3).forEach((assist, index) => {
    if (!assist) return;
    const entry = chars[String(assist.charInstId)];
    if (!entry) return;
    const opId = entry.currentTmpl ?? entry.charId;
    const dataOp = data.operatorMap[opId];
    if (!dataOp) return;
    const moduleIndex = assist.currentEquip
      ? (dataOp.moduleData ?? []).findIndex((mod) => mod.moduleId === assist.currentEquip)
      : -1;
    supports[index] = {
      opId,
      skill: clamp(1, asNumber(assist.skillIndex) + 1, Math.max(1, dataOp.skillData?.length ?? 1)),
      module: moduleIndex >= 0 ? moduleIndex + 1 : 0,
    };
  });

  const owned = Object.values(roster);
  const summary: ImportSummary = {
    operators: owned.length,
    e2: owned.filter((op) => op.elite === 2).length,
    maxPotential: owned.filter((op) => op.potential >= getMaxPotential(op.op_id)).length,
    lmd: depot[LMD_ID] ?? 0,
    depotItems: Object.keys(depot).length,
  };

  return { roster, depot, profile, supports, summary };
}

/** Read a screenshot file as a data URL for the local OCR endpoint. */
export function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error(`Could not read ${file.name}.`));
    reader.readAsDataURL(file);
  });
}
