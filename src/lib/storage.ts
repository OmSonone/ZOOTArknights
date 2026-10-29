import { LEGACY_STORAGE_KEY, LEGACY_THEME_KEY, SAVE_VERSION, STORAGE_KEY, THEME_KEY } from "./constants";
import type { AppState, DoctorProfile, PlannerGoal, PlannerSettings } from "./types";

export type Theme = "light" | "dark";

const defaultProfile: DoctorProfile = {
  name: "",
  uid: "",
  server: "EN",
  level: 1,
  onboard: "",
  assistant: null,
  supports: [null, null, null],
};

const defaultSettings: PlannerSettings = {
  includeCrafting: true,
  ignoreLmd: false,
  showBattleRecords: true,
  craftingItems: [],
};

export const createDefaultState = (): AppState => ({
  version: SAVE_VERSION,
  roster: {},
  goals: [],
  depot: {},
  profile: { ...defaultProfile, supports: [null, null, null] },
  plannerSettings: { ...defaultSettings },
});

export const defaultPlannerSettings = defaultSettings;

/* ------------------------------------------------------------------ */
/* Validation                                                          */
/* ------------------------------------------------------------------ */

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const clampInt = (value: unknown, min: number, max: number): number | null =>
  typeof value === "number" && Number.isFinite(value) ? Math.min(Math.max(Math.round(value), min), max) : null;

/** Reads both the current target-state fields and the legacy per-category goals. */
function normalizeGoal(raw: unknown): PlannerGoal | null {
  if (!isRecord(raw)) return null;
  const { id, opId, order } = raw;
  if (typeof id !== "string" || typeof opId !== "string") return null;

  const goal: PlannerGoal = { id, opId, order: typeof order === "number" ? order : 0 };

  const elite = clampInt(raw.elite, 0, 2);
  if (elite != null) goal.elite = elite;
  const level = clampInt(raw.level, 1, 200);
  if (level != null) goal.level = level;
  const skillLevel = clampInt(raw.skillLevel, 0, 7);
  if (skillLevel != null) goal.skillLevel = skillLevel;

  if (isRecord(raw.masteries)) {
    const masteries: Record<string, number> = {};
    for (const [index, value] of Object.entries(raw.masteries)) {
      const target = clampInt(value, 1, 3);
      if (target != null && /^\d+$/.test(index)) masteries[index] = target;
    }
    if (Object.keys(masteries).length > 0) goal.masteries = masteries;
  }

  if (isRecord(raw.modules)) {
    const modules: Record<string, number> = {};
    for (const [moduleId, value] of Object.entries(raw.modules)) {
      const target = clampInt(value, 1, 3);
      if (target != null && moduleId.length > 0) modules[moduleId] = target;
    }
    if (Object.keys(modules).length > 0) goal.modules = modules;
  }

  // Legacy saves used one goal per category.
  if (typeof raw.kind === "string") {
    switch (raw.kind) {
      case "elite": {
        const target = clampInt(raw.toElite, 0, 2);
        if (target != null && goal.elite == null) goal.elite = target;
        break;
      }
      case "level": {
        const targetElite = clampInt(raw.elite, 0, 2);
        const targetLevel = clampInt(raw.toLevel, 1, 200);
        if (targetElite != null && goal.elite == null) goal.elite = targetElite;
        if (targetLevel != null && goal.level == null) goal.level = targetLevel;
        break;
      }
      case "skill_level": {
        const target = clampInt(raw.toSkillLevel, 0, 7);
        if (target != null && goal.skillLevel == null) goal.skillLevel = target;
        break;
      }
      case "mastery": {
        const index = clampInt(raw.skillIndex, 0, 2);
        const target = clampInt(raw.toMastery, 1, 3);
        if (index != null && target != null && goal.masteries == null) goal.masteries = { [String(index)]: target };
        break;
      }
      case "module": {
        const target = clampInt(raw.toLevel, 1, 3);
        if (typeof raw.moduleId === "string" && target != null && goal.modules == null) {
          goal.modules = { [raw.moduleId]: target };
        }
        break;
      }
      default:
        break;
    }
  }

  const hasTarget =
    goal.elite != null ||
    goal.level != null ||
    goal.skillLevel != null ||
    Object.keys(goal.masteries ?? {}).length > 0 ||
    Object.keys(goal.modules ?? {}).length > 0;
  return hasTarget ? goal : null;
}

/** Accepts a parsed JSON object and returns a complete, usable state. Throws on garbage. */
export function normalizeState(input: unknown): AppState {
  if (!isRecord(input)) throw new Error("Save file is not a JSON object.");
  if (typeof input.version === "number" && input.version > SAVE_VERSION) {
    throw new Error(`Save was made by a newer version (v${input.version}).`);
  }
  if (!isRecord(input.roster)) throw new Error("Save file has no roster object.");

  const base = createDefaultState();

  const roster: AppState["roster"] = {};
  for (const [opId, value] of Object.entries(input.roster)) {
    if (!isRecord(value)) continue;
    roster[opId] = {
      op_id: opId,
      favorite: value.favorite === true,
      potential: typeof value.potential === "number" ? value.potential : 1,
      elite: typeof value.elite === "number" ? value.elite : 0,
      level: typeof value.level === "number" ? value.level : 1,
      skill_level: typeof value.skill_level === "number" ? value.skill_level : 1,
      masteries: Array.isArray(value.masteries) ? value.masteries.map((m) => (typeof m === "number" ? m : 0)) : [],
      modules: isRecord(value.modules)
        ? Object.fromEntries(
            Object.entries(value.modules).map(([id, level]) => [id, typeof level === "number" ? level : 0]),
          )
        : {},
      skin: typeof value.skin === "string" ? value.skin : null,
    };
  }

  const goals = Array.isArray(input.goals)
    ? input.goals.map(normalizeGoal).filter((goal): goal is PlannerGoal => goal != null)
    : [];

  const depot: AppState["depot"] = {};
  if (isRecord(input.depot)) {
    for (const [id, value] of Object.entries(input.depot)) {
      if (typeof value === "number" && Number.isFinite(value) && value > 0) depot[id] = Math.floor(value);
    }
  }

  const rawProfile = isRecord(input.profile) ? input.profile : {};
  const supports = Array.isArray(rawProfile.supports) ? rawProfile.supports : [];
  const profile: DoctorProfile = {
    ...base.profile,
    name: typeof rawProfile.name === "string" ? rawProfile.name : "",
    uid: typeof rawProfile.uid === "string" ? rawProfile.uid : "",
    server: (["EN", "JP", "KR", "TW", "CN", "B"] as const).includes(rawProfile.server as never)
      ? (rawProfile.server as DoctorProfile["server"])
      : "EN",
    level: typeof rawProfile.level === "number" ? rawProfile.level : 1,
    onboard: typeof rawProfile.onboard === "string" ? rawProfile.onboard : "",
    assistant: typeof rawProfile.assistant === "string" ? rawProfile.assistant : null,
    supports: [0, 1, 2].map((index) => {
      const slot = supports[index];
      if (!isRecord(slot) || typeof slot.opId !== "string") return null;
      return {
        opId: slot.opId,
        skill: typeof slot.skill === "number" ? slot.skill : 1,
        module: typeof slot.module === "number" ? slot.module : 0,
      };
    }),
  };

  const rawSettings = isRecord(input.plannerSettings) ? input.plannerSettings : {};
  const plannerSettings: PlannerSettings = {
    includeCrafting:
      typeof rawSettings.includeCrafting === "boolean" ? rawSettings.includeCrafting : defaultSettings.includeCrafting,
    ignoreLmd: typeof rawSettings.ignoreLmd === "boolean" ? rawSettings.ignoreLmd : defaultSettings.ignoreLmd,
    showBattleRecords:
      typeof rawSettings.showBattleRecords === "boolean"
        ? rawSettings.showBattleRecords
        : defaultSettings.showBattleRecords,
    craftingItems: Array.isArray(rawSettings.craftingItems)
      ? (rawSettings.craftingItems as unknown[]).filter((x): x is string => typeof x === "string")
      : defaultSettings.craftingItems,
  };

  return { version: SAVE_VERSION, roster, goals, depot, profile, plannerSettings };
}

/* ------------------------------------------------------------------ */
/* Persistence                                                         */
/* ------------------------------------------------------------------ */

export function loadState(): AppState {
  for (const key of [STORAGE_KEY, LEGACY_STORAGE_KEY]) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      const state = normalizeState(JSON.parse(raw));
      if (key === LEGACY_STORAGE_KEY) {
        saveState(state);
        localStorage.removeItem(LEGACY_STORAGE_KEY);
      }
      return state;
    } catch (error) {
      console.warn(`Could not read the local save at ${key}.`, error);
    }
  }
  return createDefaultState();
}

export function saveState(state: AppState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (error) {
    console.warn("Could not write the local save.", error);
  }
}

export function serializeSave(state: AppState): string {
  return JSON.stringify(state, null, 2);
}

export function parseSave(text: string): AppState {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error("That file is not valid JSON.");
  }
  return normalizeState(parsed);
}

export function downloadSave(state: AppState): void {
  const blob = new Blob([serializeSave(state)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  const stamp = new Date().toISOString().slice(0, 10);
  anchor.href = url;
  anchor.download = `zoot-save-${stamp}.json`;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function downloadJson(json: string, filename: string): void {
  const url = URL.createObjectURL(new Blob([json], { type: "application/json" }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function loadTheme(): Theme {
  const stored = localStorage.getItem(THEME_KEY) ?? localStorage.getItem(LEGACY_THEME_KEY);
  if (stored === "light" || stored === "dark") {
    if (!localStorage.getItem(THEME_KEY)) {
      localStorage.setItem(THEME_KEY, stored);
      localStorage.removeItem(LEGACY_THEME_KEY);
    }
    return stored;
  }
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function saveTheme(theme: Theme): void {
  localStorage.setItem(THEME_KEY, theme);
}
