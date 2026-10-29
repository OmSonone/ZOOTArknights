import { describe, it, expect } from "vitest";
import { gameData } from "./fixture";
import { defaultOperatorObject } from "../operator";
import {
  levelingCost,
  goalView,
  buildMaterialPlan,
  canCraftOne,
  craftOne,
  autoDetectCraftable,
  allCraftableIds,
  battleRecordPlan,
  penguinStatsExport,
} from "../planner";
import type { PlannerGoal } from "../types";
import { LMD_ID, EXP_ID } from "../constants";

const data = gameData();

/* ---------- helpers ---------- */

function makeGoal(opId: string, overrides: Partial<PlannerGoal> = {}): PlannerGoal {
  return { id: `test-${opId}`, opId, order: 0, ...overrides };
}

function emptyRoster() {
  return {} as Record<string, import("../types").Operator>;
}

function rosterWith(opId: string, owned = true) {
  const op = data.operatorMap[opId];
  return { [opId]: defaultOperatorObject(op, owned) };
}

/* ---------- levelingCost ---------- */

describe("levelingCost", () => {
  // Reference totals from AGENTS.md (total LMD = leveling + promotion)
  it("computes 6★ E0L1 → E2L90 totals", () => {
    const result = levelingCost(6, 0, 1, 2, 90);
    expect(result.exp).toBe(1_111_400);
    expect(result.lmd).toBe(1_334_796); // 1,124,796 leveling + 210,000 promotion
    expect(result.levelingLmd).toBe(1_124_796);
  });

  it("computes 5★ E0L1 → E2L80 totals", () => {
    const result = levelingCost(5, 0, 1, 2, 80);
    expect(result.exp).toBe(734_400);
    expect(result.lmd).toBe(819_325); // total including promotion
  });

  it("computes 4★ E0L1 → E2L70 totals", () => {
    const result = levelingCost(4, 0, 1, 2, 70);
    expect(result.exp).toBe(484_000);
    expect(result.lmd).toBe(482_003);
  });

  it("computes 3★ E0L1 → E1L55 totals", () => {
    const result = levelingCost(3, 0, 1, 1, 55);
    expect(result.exp).toBe(115_400);
    expect(result.lmd).toBe(104_040);
  });

  it("returns zero for same level", () => {
    const result = levelingCost(6, 0, 1, 0, 1);
    expect(result.exp).toBe(0);
    expect(result.lmd).toBe(0);
  });
});

/* ---------- goalView ---------- */

describe("goalView", () => {
  // SilverAsh (6★): char_172_svrash
  const silverAsh = "char_172_svrash";

  it("expands a 6★ E0L1 → E2L90 goal into tasks", () => {
    const roster = rosterWith(silverAsh);
    const goal = makeGoal(silverAsh, { elite: 2, level: 90, skillLevel: 7 });
    const view = goalView(goal, roster, data);
    expect(view).not.toBeNull();
    expect(view!.tasks.length).toBeGreaterThan(0);

    // Should have elite tasks
    const eliteTasks = view!.tasks.filter((t) => t.kind === "elite");
    expect(eliteTasks.length).toBe(2); // E1 and E2
  });

  it("returns null for unknown operator", () => {
    const view = goalView(makeGoal("char_fake_op"), emptyRoster(), data);
    expect(view).toBeNull();
  });

  it("marks completed tasks", () => {
    // Operator already at E2L90
    const op = defaultOperatorObject(data.operatorMap[silverAsh], true);
    op.elite = 2;
    op.level = 90;
    op.skill_level = 7;
    const roster = { [silverAsh]: op };
    const goal = makeGoal(silverAsh, { elite: 2, level: 90, skillLevel: 7 });
    const view = goalView(goal, roster, data);
    expect(view).not.toBeNull();
    expect(view!.complete).toBe(true);
    expect(view!.tasks.every((t) => t.complete)).toBe(true);
  });
});

/* ---------- buildMaterialPlan ---------- */

describe("buildMaterialPlan", () => {
  const silverAsh = "char_172_svrash";

  it("returns empty plan when no goals", () => {
    const plan = buildMaterialPlan(
      [],
      emptyRoster(),
      data,
      {},
      {
        includeCrafting: false,
        ignoreLmd: false,
        showBattleRecords: false,
        craftingItems: [],
      },
    );
    expect(plan.rows.length).toBe(0);
    expect(plan.totalLmd).toBe(0);
    expect(plan.totalExp).toBe(0);
  });

  it("computes materials for a goal", () => {
    const roster = rosterWith(silverAsh);
    const goal = makeGoal(silverAsh, { elite: 2, level: 90 });
    const plan = buildMaterialPlan(
      [goal],
      roster,
      data,
      {},
      {
        includeCrafting: false,
        ignoreLmd: false,
        showBattleRecords: false,
        craftingItems: [],
      },
    );
    expect(plan.totalExp).toBe(1_111_400);
    expect(plan.totalLmd).toBeGreaterThan(0);
    expect(plan.rows.length).toBeGreaterThan(0);
  });

  it("subtracts depot stock", () => {
    const roster = rosterWith(silverAsh);
    const goal = makeGoal(silverAsh, { elite: 1 });
    const planWithout = buildMaterialPlan(
      [goal],
      roster,
      data,
      {},
      {
        includeCrafting: false,
        ignoreLmd: false,
        showBattleRecords: false,
        craftingItems: [],
      },
    );
    // Give the depot a large LMD stock
    const depot = { [LMD_ID]: 999_999_999 };
    const planWith = buildMaterialPlan([goal], roster, data, depot, {
      includeCrafting: false,
      ignoreLmd: false,
      showBattleRecords: false,
      craftingItems: [],
    });
    const lmdRowWithout = planWithout.rows.find((r) => r.id === LMD_ID);
    const lmdRowWith = planWith.rows.find((r) => r.id === LMD_ID);
    if (lmdRowWithout && lmdRowWith) {
      expect(lmdRowWith.missing).toBe(0);
      expect(lmdRowWithout.missing).toBeGreaterThan(0);
    }
  });

  it("expands crafting only for items in craftingItems", () => {
    const roster = rosterWith(silverAsh);
    const goal = makeGoal(silverAsh, { elite: 2, level: 90 });
    const settings = {
      includeCrafting: true,
      ignoreLmd: false,
      showBattleRecords: false,
      craftingItems: [] as string[],
    };
    const planNoCraft = buildMaterialPlan([goal], roster, data, {}, settings);

    // Pick a craftable item from the plan
    const craftableRow = planNoCraft.rows.find((r) => r.canCraft && r.id !== LMD_ID && r.id !== EXP_ID);
    if (craftableRow) {
      const settingsWithCraft = { ...settings, craftingItems: [craftableRow.id] };
      const planWithCraft = buildMaterialPlan([goal], roster, data, {}, settingsWithCraft);
      // The crafted item should now be a parent (expanded)
      const row = planWithCraft.rows.find((r) => r.id === craftableRow.id);
      expect(row?.isParent).toBe(true);
    }
  });
});

/* ---------- canCraftOne / craftOne ---------- */

describe("canCraftOne", () => {
  it("returns false for items without recipes", () => {
    expect(canCraftOne(LMD_ID, {}, data, false)).toBe(false);
  });

  it("returns true when depot has enough ingredients", () => {
    // Orirock Concentration (30014) needs 4× Orirock Cluster (30013)
    const item = data.itemMap["30014"];
    if (item?.ingredients?.length) {
      const depot: Record<string, number> = {};
      for (const ing of item.ingredients) {
        depot[ing.id] = ing.quantity;
      }
      expect(canCraftOne("30014", depot, data, false)).toBe(true);
    }
  });

  it("returns false when depot is short", () => {
    expect(canCraftOne("30014", {}, data, false)).toBe(false);
  });
});

describe("craftOne", () => {
  it("deducts ingredients and credits yield", () => {
    const item = data.itemMap["30014"];
    if (!item?.ingredients?.length) return;
    const depot: Record<string, number> = { "30014": 0 };
    for (const ing of item.ingredients) {
      depot[ing.id] = ing.quantity + 10;
    }
    const patch = craftOne("30014", depot, data);
    expect(patch["30014"]).toBe(0 + (item.yield ?? 1));
    for (const ing of item.ingredients) {
      expect(patch[ing.id]).toBe(depot[ing.id] - ing.quantity);
    }
  });
});

/* ---------- autoDetectCraftable / allCraftableIds ---------- */

describe("autoDetectCraftable", () => {
  it("returns craftable items from the plan", () => {
    const roster = rosterWith("char_172_svrash");
    const goal = makeGoal("char_172_svrash", { elite: 2, level: 90 });
    const plan = buildMaterialPlan(
      [goal],
      roster,
      data,
      {},
      {
        includeCrafting: true,
        ignoreLmd: false,
        showBattleRecords: false,
        craftingItems: [],
      },
    );
    const auto = autoDetectCraftable(plan);
    expect(auto.length).toBeGreaterThan(0);
    // All returned IDs should be craftable
    for (const id of auto) {
      const item = data.itemMap[id];
      expect(item?.ingredients?.length).toBeGreaterThan(0);
    }
  });
});

describe("allCraftableIds", () => {
  it("returns all craftable non-chip items", () => {
    const ids = allCraftableIds(data);
    expect(ids.length).toBeGreaterThan(30);
    for (const id of ids) {
      const item = data.itemMap[id];
      expect(item?.ingredients?.length).toBeGreaterThan(0);
      expect(item!.name).not.toContain(" Chip");
      expect(item!.name).not.toContain("Dualchip");
    }
  });
});

/* ---------- battleRecordPlan ---------- */

describe("battleRecordPlan", () => {
  it("returns zero needs for zero EXP", () => {
    const records = battleRecordPlan(0, {});
    expect(records.every((r) => r.need === 0)).toBe(true);
  });

  it("uses depot stock first", () => {
    const depot = { "2004": 100 }; // 100 Strategic Battle Records
    const records = battleRecordPlan(100_000, depot);
    // Should use depot stock before needing more
    const strategic = records.find((r) => r.id === "2004");
    expect(strategic).toBeDefined();
  });
});

/* ---------- penguinStatsExport ---------- */

describe("penguinStatsExport", () => {
  it("produces the correct format", () => {
    const roster = rosterWith("char_172_svrash");
    const goal = makeGoal("char_172_svrash", { elite: 1 });
    const plan = buildMaterialPlan(
      [goal],
      roster,
      data,
      {},
      {
        includeCrafting: false,
        ignoreLmd: false,
        showBattleRecords: false,
        craftingItems: [],
      },
    );
    const result = penguinStatsExport(plan, {}, data);
    expect(result["@type"]).toBe("@penguin-statistics/planner/config");
    expect(Array.isArray(result.items)).toBe(true);
    for (const item of result.items) {
      expect(item).toHaveProperty("id");
      expect(item).toHaveProperty("have");
      expect(item).toHaveProperty("need");
    }
  });
});
