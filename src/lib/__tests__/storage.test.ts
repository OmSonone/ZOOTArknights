import { describe, it, expect } from "vitest";
import { createDefaultState, normalizeState, defaultPlannerSettings } from "../storage";
import { SAVE_VERSION } from "../constants";

/* ---------- createDefaultState ---------- */

describe("createDefaultState", () => {
  it("returns a valid default state", () => {
    const state = createDefaultState();
    expect(state.version).toBe(SAVE_VERSION);
    expect(state.roster).toEqual({});
    expect(state.goals).toEqual([]);
    expect(state.depot).toEqual({});
    expect(state.profile.server).toBe("EN");
    expect(state.profile.supports).toHaveLength(3);
    expect(state.plannerSettings.includeCrafting).toBe(true);
    expect(state.plannerSettings.craftingItems).toEqual([]);
  });
});

/* ---------- normalizeState ---------- */

describe("normalizeState", () => {
  it("normalizes a minimal valid save", () => {
    const state = normalizeState({ version: 1, roster: {} });
    expect(state.version).toBe(SAVE_VERSION);
    expect(state.goals).toEqual([]);
    expect(state.depot).toEqual({});
    expect(state.profile.server).toBe("EN");
    expect(state.plannerSettings).toEqual(defaultPlannerSettings);
  });

  it("throws on non-object input", () => {
    expect(() => normalizeState("not an object")).toThrow("not a JSON object");
    expect(() => normalizeState(null)).toThrow("not a JSON object");
    expect(() => normalizeState(42)).toThrow("not a JSON object");
  });

  it("throws when roster is missing", () => {
    expect(() => normalizeState({ version: 1 })).toThrow("no roster");
  });

  it("throws on newer version", () => {
    expect(() => normalizeState({ version: 999, roster: {} })).toThrow("newer version");
  });

  it("normalizes roster entries", () => {
    const state = normalizeState({
      version: 1,
      roster: {
        char_172_svrash: {
          favorite: true,
          potential: 6,
          elite: 2,
          level: 90,
          skill_level: 7,
          masteries: [3, 3, 3],
          modules: { uniequip_002_svrash: 3 },
          skin: null,
        },
      },
    });
    const op = state.roster["char_172_svrash"];
    expect(op.op_id).toBe("char_172_svrash");
    expect(op.favorite).toBe(true);
    expect(op.elite).toBe(2);
    expect(op.masteries).toEqual([3, 3, 3]);
    expect(op.modules).toEqual({ uniequip_002_svrash: 3 });
  });

  it("handles missing optional roster fields", () => {
    const state = normalizeState({
      version: 1,
      roster: {
        char_172_svrash: {},
      },
    });
    const op = state.roster["char_172_svrash"];
    expect(op.potential).toBe(1); // default
    expect(op.elite).toBe(0);
    expect(op.masteries).toEqual([]);
    expect(op.modules).toEqual({});
    expect(op.skin).toBeNull();
  });

  it("normalizes target-state goals", () => {
    const state = normalizeState({
      version: 1,
      roster: {},
      goals: [
        {
          id: "g1",
          opId: "char_172_svrash",
          order: 1,
          elite: 2,
          level: 90,
          skillLevel: 7,
          masteries: { "0": 3, "1": 2 },
          modules: { uniequip_002_svrash: 3 },
        },
      ],
    });
    expect(state.goals).toHaveLength(1);
    expect(state.goals[0].elite).toBe(2);
    expect(state.goals[0].masteries).toEqual({ "0": 3, "1": 2 });
  });

  it("drops goals with no targets", () => {
    const state = normalizeState({
      version: 1,
      roster: {},
      goals: [{ id: "g1", opId: "char_172_svrash", order: 0 }],
    });
    expect(state.goals).toHaveLength(0);
  });

  it("validates mastery keys are numeric strings", () => {
    const state = normalizeState({
      version: 1,
      roster: {},
      goals: [
        {
          id: "g1",
          opId: "char_172_svrash",
          elite: 2,
          masteries: { "0": 3, abc: 2, "": 1 },
        },
      ],
    });
    expect(state.goals[0].masteries).toEqual({ "0": 3 });
  });

  it("migrates legacy per-category goals", () => {
    const state = normalizeState({
      version: 1,
      roster: {},
      goals: [
        { id: "g1", opId: "char_172_svrash", kind: "elite", toElite: 2 },
        { id: "g2", opId: "char_172_svrash", kind: "mastery", skillIndex: 0, toMastery: 3 },
      ],
    });
    expect(state.goals).toHaveLength(2);
    expect(state.goals[0].elite).toBe(2);
    expect(state.goals[1].masteries).toEqual({ "0": 3 });
  });

  it("normalizes depot (drops non-positive, floors)", () => {
    const state = normalizeState({
      version: 1,
      roster: {},
      depot: { "30012": 42.7, "30013": 0, "30014": -1, "30015": "nope" },
    });
    expect(state.depot).toEqual({ "30012": 42 });
  });

  it("normalizes profile with default fallbacks", () => {
    const state = normalizeState({ version: 1, roster: {}, profile: { name: "Doc" } });
    expect(state.profile.name).toBe("Doc");
    expect(state.profile.server).toBe("EN");
    expect(state.profile.level).toBe(1);
  });

  it("normalizes plannerSettings with defaults for missing fields", () => {
    const state = normalizeState({
      version: 1,
      roster: {},
      plannerSettings: { ignoreLmd: true },
    });
    expect(state.plannerSettings.ignoreLmd).toBe(true);
    expect(state.plannerSettings.includeCrafting).toBe(true); // default
    expect(state.plannerSettings.craftingItems).toEqual([]);
  });

  it("filters non-string craftingItems", () => {
    const state = normalizeState({
      version: 1,
      roster: {},
      plannerSettings: { craftingItems: ["30014", 42, null, "30015"] },
    });
    expect(state.plannerSettings.craftingItems).toEqual(["30014", "30015"]);
  });
});
