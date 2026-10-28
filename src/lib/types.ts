/** Game data + save-file types. Mirrors the shape of ak-roster's generated JSON. */

export interface Ingredient {
  id: string;
  quantity: number;
}

export interface Branch {
  id: string;
  name: string;
}

export interface GoalIngredientList {
  name: string;
  category: number;
  ingredients: Ingredient[];
}

export interface SkillLevelGoalData extends GoalIngredientList {
  skillLevel: number;
}

export interface EliteGoalData extends GoalIngredientList {
  eliteLevel: number;
}

export interface MasteryGoalData extends GoalIngredientList {
  masteryLevel: number;
}

export interface ModuleStageData extends GoalIngredientList {
  moduleLevel: number;
}

export interface SkillData {
  skillId: string;
  iconId: string | null;
  skillName: string;
  masteries: MasteryGoalData[];
}

export interface ModuleData {
  moduleName: string;
  moduleId: string;
  typeName: string;
  stages: ModuleStageData[];
  isCnOnly: boolean;
}

export interface OperatorData {
  id: string;
  name: string;
  cnName: string;
  rarity: number;
  class: string;
  branch: Branch;
  isCnOnly: boolean;
  factions: string[];
  factionsHidden?: string[];
  pools: string[];
  skillData?: SkillData[];
  moduleData?: ModuleData[];
  potentials: string[];
  skillLevels: SkillLevelGoalData[];
  eliteLevels: EliteGoalData[];
}

export interface Item {
  id: string;
  name: string;
  iconId: string;
  tier: number;
  sortId: number;
  yield?: number;
  ingredients?: Ingredient[];
}

export interface Skin {
  skinId: string;
  skinName: string | null;
  avatarId: string;
  sortId: number;
}

export interface FactionData {
  powerName: string;
  powerCode: string;
  powerLevel: number;
  isRaw: boolean;
  sortId: number;
}

/** One operator as stored in the local save file. */
export interface Operator {
  op_id: string;
  favorite: boolean;
  potential: number;
  elite: number;
  level: number;
  skill_level: number;
  masteries: number[];
  modules: Record<string, number>;
  skin: string | null;
}

export type Roster = Record<string, Operator>;

export type OpInfo = OperatorData & Operator;

export type GoalKind = "elite" | "level" | "skill_level" | "mastery" | "module";

/**
 * One planned target state for an operator, mirroring krooster GoalData.
 * A single goal can cross promotions and set every dimension at once.
 * Missing fields mean "no target for that dimension".
 */
export interface PlannerGoal {
  id: string;
  opId: string;
  /** creation order, used for stable sorting */
  order: number;
  /** target promotion (0..2) */
  elite?: number;
  /** target level inside the target promotion */
  level?: number;
  /** target skill level (1..7) */
  skillLevel?: number;
  /** skill index -> target mastery (1..3) */
  masteries?: Record<string, number>;
  /** moduleId -> target stage (1..3) */
  modules?: Record<string, number>;
}

/** itemId -> owned quantity */
export type Depot = Record<string, number>;

export type Server = "EN" | "JP" | "KR" | "TW" | "CN" | "B";

export interface SupportSlot {
  opId: string;
  skill: number;
  module: number;
}

export interface DoctorProfile {
  name: string;
  uid: string;
  server: Server;
  level: number;
  onboard: string;
  assistant: string | null;
  supports: (SupportSlot | null)[];
}

export interface PlannerSettings {
  includeCrafting: boolean;
  ignoreLmd: boolean;
  showBattleRecords: boolean;
}

export interface AppState {
  version: number;
  roster: Roster;
  goals: PlannerGoal[];
  depot: Depot;
  profile: DoctorProfile;
  plannerSettings: PlannerSettings;
}

export interface GameData {
  operators: OperatorData[];
  operatorMap: Record<string, OperatorData>;
  items: Item[];
  itemMap: Record<string, Item>;
  skins: Record<string, Skin[]>;
  factions: Record<string, FactionData>;
}
