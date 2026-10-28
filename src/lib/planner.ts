import {
  BATTLE_RECORD_IDS,
  BATTLE_RECORD_TO_EXP,
  COST_BY_RARITY,
  EXP_ID,
  LMD_ID,
} from "./constants";
import {
  clamp,
  defaultOperatorObject,
  maxLevel,
  maxPromotion,
  maxSkillLevel,
  moduleLevelRequirement,
} from "./operator";
import type {
  Depot,
  GameData,
  GoalKind,
  Ingredient,
  Item,
  OpInfo,
  PlannerGoal,
  PlannerSettings,
  Roster,
} from "./types";

/* ------------------------------------------------------------------ */
/* Level / EXP / LMD                                                   */
/* ------------------------------------------------------------------ */

export interface LevelingCost {
  exp: number;
  lmd: number;
  levelingLmd: number;
  eliteLmd: number;
}

/** LEVELING cost for a range inside one or more promotions (ported from ak-roster). */
export function levelingCost(
  rarity: number,
  fromElite: number,
  fromLevel: number,
  toElite: number,
  toLevel: number,
): LevelingCost {
  const total: LevelingCost = { exp: 0, lmd: 0, levelingLmd: 0, eliteLmd: 0 };
  for (let elite = fromElite; elite <= toElite; elite++) {
    const start = elite === fromElite ? fromLevel : 1;
    const end = elite === toElite ? toLevel : maxLevel(rarity, elite);
    if (end <= start) continue;

    const expTable = COST_BY_RARITY.expCostByElite[elite] ?? [];
    const lmdTable = COST_BY_RARITY.lmdCostByElite[elite] ?? [];
    const exp = expTable.slice(start - 1, end - 1).reduce((a, b) => a + b, 0);
    const levelingLmd = lmdTable.slice(start - 1, end - 1).reduce((a, b) => a + b, 0);
    const eliteLmd = elite === fromElite ? 0 : (COST_BY_RARITY.eliteLmdCost[rarity]?.[elite - 1] ?? 0);

    total.exp += exp;
    total.levelingLmd += levelingLmd;
    total.eliteLmd += eliteLmd;
    total.lmd += levelingLmd + eliteLmd;
  }
  return total;
}

/* ------------------------------------------------------------------ */
/* Goal resolution                                                     */
/* ------------------------------------------------------------------ */

export interface GoalTask {
  key: string;
  kind: GoalKind;
  title: string;
  fromLabel: string;
  toLabel: string;
  ingredients: Ingredient[];
  complete: boolean;
  warning?: string;
}

export interface GoalView {
  goal: PlannerGoal;
  op: OpInfo;
  tasks: GoalTask[];
  warnings: string[];
  complete: boolean;
  fromLabel: string;
  toLabel: string;
  targetElite: number;
  targetLevel: number;
  targetSkillLevel: number;
}

const sumIngredients = (lists: Ingredient[][]): Ingredient[] => {
  const totals = new Map<string, number>();
  for (const list of lists) {
    for (const { id, quantity } of list) totals.set(id, (totals.get(id) ?? 0) + quantity);
  }
  return [...totals].map(([id, quantity]) => ({ id, quantity }));
};

export const resolveOperator = (data: GameData, roster: Roster, opId: string): OpInfo | null => {
  const dataOp = data.operatorMap[opId];
  if (!dataOp) return null;
  const saved = roster[opId] ?? defaultOperatorObject(dataOp);
  return { ...dataOp, ...saved };
};

/**
 * Expands one target-state goal into the same per-category rows krooster shows:
 * every promotion crossed, every level range per promotion, skill level, each
 * mastery and each module independently.
 */
export function goalView(goal: PlannerGoal, roster: Roster, data: GameData): GoalView | null {
  const dataOp = data.operatorMap[goal.opId];
  if (!dataOp) return null;
  const op = resolveOperator(data, roster, goal.opId);
  if (!op) return null;

  const rarity = dataOp.rarity;
  const hardMaxElite = maxPromotion(rarity);
  const fromElite = clamp(0, Math.max(op.elite, 0), hardMaxElite);
  const fromLevel = clamp(1, op.level || 1, maxLevel(rarity, fromElite));

  const targetElite = clamp(fromElite, goal.elite ?? fromElite, hardMaxElite);
  let targetLevel = goal.level ?? (targetElite > fromElite ? maxLevel(rarity, targetElite) : fromLevel);
  targetLevel = clamp(1, targetLevel, maxLevel(rarity, targetElite));
  if (targetElite === fromElite) targetLevel = Math.max(targetLevel, fromLevel);

  const currentSkill = clamp(0, op.skill_level, 7);
  const maxTargetSkill = maxSkillLevel(targetElite);
  const targetSkill = clamp(currentSkill, goal.skillLevel ?? currentSkill, Math.max(maxTargetSkill, currentSkill));

  const warnings: string[] = [];
  if (goal.skillLevel != null && goal.skillLevel > maxTargetSkill) {
    warnings.push(`Skill Level ${goal.skillLevel} needs Elite ${maxTargetSkill >= 7 ? 1 : 0}`);
  }

  const tasks: GoalTask[] = [];

  // Promotions crossed -> promotion materials (including their LMD).
  for (let elite = fromElite + 1; elite <= targetElite; elite++) {
    const entry = dataOp.eliteLevels[elite - 1];
    const ingredients = entry?.ingredients ?? [];
    tasks.push({
      key: `elite-${elite}`,
      kind: "elite",
      title: `Elite ${elite}`,
      fromLabel: `E${elite - 1}`,
      toLabel: `E${elite}`,
      ingredients,
      complete: ingredients.length === 0,
    });
  }

  // Leveling per promotion; promotion LMD lives in the elite tasks above, so
  // these use single-promotion costs and never double count.
  const levelRanges: { elite: number; start: number; end: number }[] = [];
  if (targetElite === fromElite) {
    if (targetLevel > fromLevel) levelRanges.push({ elite: fromElite, start: fromLevel, end: targetLevel });
  } else {
    for (let elite = fromElite; elite <= targetElite; elite++) {
      const start = elite === fromElite ? fromLevel : 1;
      const end = elite === targetElite ? targetLevel : maxLevel(rarity, elite);
      if (end > start) levelRanges.push({ elite, start, end });
    }
  }

  for (const range of levelRanges) {
    const cost = levelingCost(rarity, range.elite, range.start, range.elite, range.end);
    const ingredients: Ingredient[] = [];
    if (cost.lmd > 0) ingredients.push({ id: LMD_ID, quantity: cost.lmd });
    if (cost.exp > 0) ingredients.push({ id: EXP_ID, quantity: cost.exp });
    tasks.push({
      key: `level-${range.elite}-${range.start}-${range.end}`,
      kind: "level",
      title: `Level ${range.start} → ${range.end}`,
      fromLabel: `E${range.elite}`,
      toLabel: `E${range.elite}`,
      ingredients,
      complete: ingredients.length === 0,
    });
  }

  // Skill level.
  if (targetSkill > currentSkill) {
    const ingredients = sumIngredients(
      dataOp.skillLevels.slice(Math.max(currentSkill - 1, 0), targetSkill - 1).map((level) => level.ingredients),
    );
    const requiredElite = targetSkill <= 4 ? 0 : 1;
    tasks.push({
      key: `skill-${targetSkill}`,
      kind: "skill_level",
      title: `Skill Level ${currentSkill} → ${targetSkill}`,
      fromLabel: `SL${currentSkill}`,
      toLabel: `SL${targetSkill}`,
      ingredients,
      complete: ingredients.length === 0,
      warning: targetElite < requiredElite ? `Needs Elite ${requiredElite}` : undefined,
    });
  }

  // Masteries: one independent task per skill.
  const masteryReady = targetElite >= 2 && targetSkill >= 7;
  for (const [indexKey, targetRaw] of Object.entries(goal.masteries ?? {})) {
    const index = Number(indexKey);
    const skill = dataOp.skillData?.[index];
    if (!skill || !Number.isFinite(index)) continue;
    const current = clamp(0, op.masteries[index] ?? 0, 3);
    const target = clamp(current, targetRaw, 3);
    if (target <= current) continue;

    const ingredients = sumIngredients(skill.masteries.slice(current, target).map((level) => level.ingredients));
    tasks.push({
      key: `mastery-${index}`,
      kind: "mastery",
      title: `S${index + 1} · ${skill.skillName}`,
      fromLabel: `M${current}`,
      toLabel: `M${target}`,
      ingredients,
      complete: ingredients.length === 0,
      warning: masteryReady ? undefined : "Needs Elite 2 + Skill Level 7",
    });
  }

  // Modules: one independent task per module.
  const levelRequirement = moduleLevelRequirement(rarity);
  const moduleReady = targetElite >= 2 && targetLevel >= levelRequirement;
  for (const [moduleId, targetRaw] of Object.entries(goal.modules ?? {})) {
    const module = dataOp.moduleData?.find((entry) => entry.moduleId === moduleId);
    if (!module) continue;
    const current = clamp(0, op.modules[moduleId] ?? 0, 3);
    const target = clamp(current, targetRaw, 3);
    if (target <= current) continue;

    const ingredients = sumIngredients(module.stages.slice(current, target).map((stage) => stage.ingredients));
    tasks.push({
      key: `module-${moduleId}`,
      kind: "module",
      title: `${module.typeName} · ${module.moduleName}`,
      fromLabel: `Stage ${current}`,
      toLabel: `Stage ${target}`,
      ingredients,
      complete: ingredients.length === 0,
      warning: moduleReady ? undefined : `Needs Elite 2 + Lv ${levelRequirement}`,
    });
  }

  const complete = tasks.every((task) => task.complete) && warnings.length === 0;

  return {
    goal,
    op,
    tasks,
    warnings,
    complete,
    fromLabel: `E${fromElite} L${fromLevel}`,
    toLabel: `E${targetElite} L${targetLevel}`,
    targetElite,
    targetLevel,
    targetSkillLevel: targetSkill,
  };
}

export const isGoalComplete = (goal: PlannerGoal, roster: Roster, data: GameData): boolean =>
  goalView(goal, roster, data)?.complete ?? false;

/** Pre-filled default target state used by the goal editor. */
export function currentGoalState(op: OpInfo): Pick<PlannerGoal, "elite" | "level" | "skillLevel"> {
  const elite = Math.max(op.elite, 0);
  return { elite, level: Math.max(op.level, 1), skillLevel: Math.max(op.skill_level, 0) };
}

export const hasGoalTarget = (goal: Partial<PlannerGoal>): boolean =>
  goal.elite != null ||
  goal.level != null ||
  goal.skillLevel != null ||
  Object.keys(goal.masteries ?? {}).length > 0 ||
  Object.keys(goal.modules ?? {}).length > 0;

/* ------------------------------------------------------------------ */
/* Aggregation + crafting expansion                                    */
/* ------------------------------------------------------------------ */

export interface MaterialRow {
  id: string;
  item?: Item;
  required: number;
  have: number;
  missing: number;
  /** number of workshop formula executions when the shortfall is crafted */
  crafts?: number;
  /** true when this row can be produced from lower-tier materials */
  canCraft: boolean;
  /** this row is itself a crafted parent, its ingredients are listed separately */
  isParent: boolean;
}

export interface MaterialPlan {
  /** itemId -> quantity needed before any crafting maths */
  raw: Record<string, number>;
  /** itemId -> quantity needed after expanding recipes */
  expanded: Record<string, number>;
  rows: MaterialRow[];
  /** leaves of the recipe tree — actual farming list */
  farmRows: MaterialRow[];
  totalLmd: number;
  totalExp: number;
  complete: boolean;
  /** true when the whole plan is affordable ignoring LMD */
  completeIgnoringLmd: boolean;
}

const tierOf = (data: GameData, id: string): number => data.itemMap[id]?.tier ?? 6;

/**
 * Chips have a cyclic recipe graph in the game data (chip <-> chip pack), and in
 * practice they are farmed from chip stages rather than crafted. Treat them as leaves.
 */
const isChip = (name: string): boolean => name.includes(" Chip") || name.includes("Dualchip");

export function buildMaterialPlan(
  goals: PlannerGoal[],
  roster: Roster,
  data: GameData,
  depot: Depot,
  settings: PlannerSettings,
): MaterialPlan {
  const raw: Record<string, number> = {};

  for (const goal of goals) {
    const view = goalView(goal, roster, data);
    if (!view) continue;
    for (const task of view.tasks) {
      if (task.complete) continue;
      for (const { id, quantity } of task.ingredients) {
        raw[id] = (raw[id] ?? 0) + quantity;
      }
    }
  }

  const expanded: Record<string, number> = { ...raw };
  const crafts: Record<string, number> = {};

  if (settings.includeCrafting) {
    const queue = Object.keys(expanded)
      .filter((id) => (data.itemMap[id]?.ingredients?.length ?? 0) > 0)
      .sort((a, b) => tierOf(data, b) - tierOf(data, a));
    const expandedIds = new Set<string>();

    while (queue.length > 0) {
      queue.sort((a, b) => tierOf(data, b) - tierOf(data, a));
      const id = queue.shift() as string;
      if (expandedIds.has(id)) continue;
      const item = data.itemMap[id];
      if (!item?.ingredients?.length) continue;
      if (id === LMD_ID || id === EXP_ID) continue;
      if (isChip(item.name)) continue;

      const shortfall = (expanded[id] ?? 0) - (depot[id] ?? 0);
      if (shortfall <= 0) continue;

      expandedIds.add(id);
      const yieldPer = item.yield ?? 1;
      const times = Math.ceil(shortfall / yieldPer);
      crafts[id] = times;

      for (const ingredient of item.ingredients) {
        if (ingredient.id === LMD_ID && settings.ignoreLmd) continue;
        expanded[ingredient.id] = (expanded[ingredient.id] ?? 0) + ingredient.quantity * times;
        if (!expandedIds.has(ingredient.id)) queue.push(ingredient.id);
      }
    }
  }

  const rowFor = (id: string, required: number): MaterialRow => {
    const have = depot[id] ?? 0;
    const missing = Math.max(0, required - have);
    const item = data.itemMap[id];
    return {
      id,
      item,
      required,
      have,
      missing,
      crafts: crafts[id],
      canCraft: (item?.ingredients?.length ?? 0) > 0 && !isChip(item?.name ?? ""),
      isParent: crafts[id] != null,
    };
  };

  const parentIds = new Set(Object.keys(crafts));
  const rows = Object.keys(expanded)
    .map((id) => rowFor(id, expanded[id]))
    .sort((a, b) => {
      const tierDiff = (b.item?.tier ?? 0) - (a.item?.tier ?? 0);
      if (tierDiff !== 0) return tierDiff;
      return (a.item?.sortId ?? 0) - (b.item?.sortId ?? 0);
    });

  const farmRows = rows
    .filter((row) => !parentIds.has(row.id))
    .filter((row) => row.missing > 0)
    .sort((a, b) => (b.item?.tier ?? 0) - (a.item?.tier ?? 0) || (a.item?.sortId ?? 0) - (b.item?.sortId ?? 0));

  // crafting recipes also cost LMD, so report the expanded total (raw + craft fees)
  const totalLmd = expanded[LMD_ID] ?? raw[LMD_ID] ?? 0;
  const totalExp = raw[EXP_ID] ?? 0;

  const isCovered = (row: MaterialRow) =>
    row.id === LMD_ID ? settings.ignoreLmd || row.missing === 0 : row.id === EXP_ID ? true : row.missing === 0;

  return {
    raw,
    expanded,
    rows,
    farmRows,
    totalLmd,
    totalExp,
    complete: rows.every((row) => parentIds.has(row.id) || isCovered(row)),
    completeIgnoringLmd: rows.every(
      (row) => row.id === LMD_ID || parentIds.has(row.id) || row.missing === 0,
    ),
  };
}

/* ------------------------------------------------------------------ */
/* EXP -> battle records                                               */
/* ------------------------------------------------------------------ */

export interface RecordNeed {
  id: string;
  value: number;
  have: number;
  need: number;
}

/** Greedy conversion of an EXP total into battle records, stock first, largest first. */
export function battleRecordPlan(expNeeded: number, depot: Depot): RecordNeed[] {
  let remaining = Math.max(0, expNeeded);
  const needs: RecordNeed[] = BATTLE_RECORD_IDS.map((id) => ({
    id,
    value: BATTLE_RECORD_TO_EXP[id],
    have: depot[id] ?? 0,
    need: 0,
  }));

  for (const record of needs) {
    const used = Math.min(record.have, Math.floor(remaining / record.value));
    remaining -= used * record.value;
    record.have -= used;
  }
  for (const record of needs) {
    if (remaining <= 0) break;
    const count = Math.floor(remaining / record.value) + (remaining % record.value > 0 ? 1 : 0);
    if (count > 0) {
      record.need += count;
      remaining -= count * record.value;
    }
  }
  return needs;
}
