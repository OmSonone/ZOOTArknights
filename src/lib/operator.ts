import {
  MAX_LEVEL_BY_RARITY,
  MAX_PROMOTION_BY_RARITY,
  MAX_SKILL_LEVEL_BY_PROMOTION,
  MODULE_REQ_BY_RARITY,
  getMaxPotential,
} from "./constants";
import type { OpInfo, Operator, OperatorData } from "./types";

export const clamp = (min: number, value: number, max: number): number =>
  Math.min(Math.max(min, value), max);

export const maxLevel = (rarity: number, elite: number): number =>
  MAX_LEVEL_BY_RARITY[rarity]?.[elite] ?? 0;

export const maxPromotion = (rarity: number): number => MAX_PROMOTION_BY_RARITY[rarity] ?? 0;

export const maxSkillLevel = (elite: number): number => MAX_SKILL_LEVEL_BY_PROMOTION[elite] ?? 0;

export const moduleLevelRequirement = (rarity: number): number => MODULE_REQ_BY_RARITY[rarity] ?? 99;

export const numSkills = (data: OperatorData): number => data.skillData?.length ?? 0;

const resetModules = (modules: Record<string, number>, value = 0): Record<string, number> =>
  Object.fromEntries(Object.keys(modules).map((id) => [id, value]));

/** A placeholder operator record for something the player does not own (or has not edited yet). */
export function defaultOperatorObject(data: OperatorData, owned = false): Operator {
  return {
    op_id: data.id,
    favorite: false,
    potential: owned ? 1 : 0,
    elite: owned ? 0 : -1,
    level: owned ? 1 : 0,
    skill_level: owned ? 1 : 0,
    masteries: new Array(data.skillData?.length ?? 0).fill(owned ? 0 : -1),
    modules: Object.fromEntries((data.moduleData ?? []).map((mod) => [mod.moduleId, owned ? 0 : -1])),
    skin: null,
  };
}

export function changeOwned(op: Operator, value: boolean): Operator {
  if (!value) {
    return {
      ...op,
      potential: 0,
      elite: -1,
      level: 0,
      skill_level: 0,
      masteries: op.masteries.map(() => -1),
      modules: resetModules(op.modules, -1),
    };
  }
  return {
    ...op,
    potential: 1,
    elite: 0,
    level: 1,
    skill_level: 1,
    masteries: op.masteries.map(() => 0),
    modules: resetModules(op.modules, 0),
  };
}

export const changeFavorite = (op: Operator, value: boolean): Operator => ({ ...op, favorite: value });

export const changePotential = (op: Operator, value: number): Operator => ({
  ...op,
  potential: clamp(1, value, getMaxPotential(op.op_id)),
});

export function changePromotion(op: Operator, data: OperatorData, value: number): Operator {
  const next: Operator = { ...op };
  next.elite = clamp(0, value, maxPromotion(data.rarity));
  if (value > op.elite) next.level = 1;
  next.level = clamp(1, next.level, maxLevel(data.rarity, next.elite));
  next.skill_level = clamp(1, next.skill_level, maxSkillLevel(next.elite));
  if (next.elite < 2) {
    next.masteries = next.masteries.map(() => 0);
    next.modules = resetModules(next.modules);
  }
  return next;
}

export function changeLevel(op: Operator, data: OperatorData, value: number): Operator {
  const next: Operator = { ...op };
  next.level = clamp(1, value, maxLevel(data.rarity, next.elite));
  if (next.level < moduleLevelRequirement(data.rarity)) next.modules = resetModules(next.modules);
  return next;
}

export function changeSkillLevel(op: Operator, data: OperatorData, value: number): Operator {
  const next: Operator = { ...op };
  if (data.rarity < 3) {
    next.skill_level = 0;
    return next;
  }
  next.skill_level = clamp(1, value, maxSkillLevel(next.elite));
  if (next.skill_level < 7) next.masteries = next.masteries.map(() => 0);
  return next;
}

export function changeMastery(op: Operator, data: OperatorData, index: number, value: number): Operator {
  if (op.elite !== 2 || op.skill_level !== 7 || index >= numSkills(data)) return op;
  const masteries = [...op.masteries];
  masteries[index] = clamp(0, value, 3);
  return { ...op, masteries };
}

export function changeModule(op: Operator, data: OperatorData, moduleId: string, value: number): Operator {
  if (op.elite !== 2 || op.level < moduleLevelRequirement(data.rarity)) return op;
  if (!(moduleId in op.modules)) return op;
  return { ...op, modules: { ...op.modules, [moduleId]: clamp(0, value, 3) } };
}

export const changeSkin = (op: Operator, avatarId: string | null): Operator => ({ ...op, skin: avatarId });

/** True when promotion, level, skill, masteries, modules and potential are all maxed. */
export function isMaxed(op: OpInfo): boolean {
  if (op.elite !== maxPromotion(op.rarity)) return false;
  if (op.level !== maxLevel(op.rarity, op.elite)) return false;
  if (op.rarity > 2 && op.skill_level !== 7) return false;
  if (maxPromotion(op.rarity) === 2) {
    if (!op.skillData?.every((_, index) => op.masteries[index] === 3)) return false;
    const modulesComplete =
      op.moduleData?.every((mod) => mod.isCnOnly || op.modules[mod.moduleId] === 3) ?? true;
    if (!modulesComplete) return false;
  }
  return op.potential === getMaxPotential(op.op_id);
}

/** Completion ratio (0..1) across promotion, level, skills, masteries and modules. */
export function completion(op: OpInfo): number {
  const parts: number[] = [];
  parts.push(op.elite / Math.max(maxPromotion(op.rarity), 1));
  parts.push(op.level / Math.max(maxLevel(op.rarity, op.elite), 1));
  if (op.rarity > 2) parts.push(op.skill_level / 7);
  if (op.elite === 2) {
    const skills = op.skillData?.length ?? 0;
    for (let i = 0; i < skills; i++) parts.push((op.masteries[i] ?? 0) / 3);
    for (const mod of op.moduleData ?? []) {
      if (!mod.isCnOnly) parts.push((op.modules[mod.moduleId] ?? 0) / 3);
    }
  }
  return parts.length ? parts.reduce((a, b) => a + b, 0) / parts.length : 0;
}
