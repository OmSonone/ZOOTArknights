import { describe, it, expect } from "vitest";
import { gameData } from "./fixture";
import {
  clamp,
  maxLevel,
  maxPromotion,
  maxSkillLevel,
  moduleLevelRequirement,
  numSkills,
  defaultOperatorObject,
  changeOwned,
  changePromotion,
  changeLevel,
  changeSkillLevel,
  changeMastery,
  isMaxed,
  completion,
} from "../operator";

const data = gameData();
const silverAsh = data.operatorMap["char_172_svrash"]; // 6★

/* ---------- pure helpers ---------- */

describe("clamp", () => {
  it("clamps below min", () => expect(clamp(0, -5, 10)).toBe(0));
  it("clamps above max", () => expect(clamp(0, 15, 10)).toBe(10));
  it("passes through values in range", () => expect(clamp(0, 5, 10)).toBe(5));
});

describe("maxLevel", () => {
  it("6★ E0=50, E1=80, E2=90", () => {
    expect(maxLevel(6, 0)).toBe(50);
    expect(maxLevel(6, 1)).toBe(80);
    expect(maxLevel(6, 2)).toBe(90);
  });
  it("3★ E0=40, E1=55", () => {
    expect(maxLevel(3, 0)).toBe(40);
    expect(maxLevel(3, 1)).toBe(55);
  });
});

describe("maxPromotion", () => {
  it("6★ can reach E2", () => expect(maxPromotion(6)).toBe(2));
  it("3★ can reach E1", () => expect(maxPromotion(3)).toBe(1));
  it("1★ stays E0", () => expect(maxPromotion(1)).toBe(0));
});

describe("maxSkillLevel", () => {
  it("E0 caps at 4", () => expect(maxSkillLevel(0)).toBe(4));
  it("E1 caps at 7", () => expect(maxSkillLevel(1)).toBe(7));
  it("E2 caps at 7", () => expect(maxSkillLevel(2)).toBe(7));
});

describe("moduleLevelRequirement", () => {
  it("4★=40, 5★=50, 6★=60", () => {
    expect(moduleLevelRequirement(4)).toBe(40);
    expect(moduleLevelRequirement(5)).toBe(50);
    expect(moduleLevelRequirement(6)).toBe(60);
  });
});

describe("numSkills", () => {
  it("SilverAsh has 3 skills", () => expect(numSkills(silverAsh)).toBe(3));
});

/* ---------- mutation rules ---------- */

describe("defaultOperatorObject", () => {
  it("creates an unowned operator", () => {
    const op = defaultOperatorObject(silverAsh, false);
    expect(op.potential).toBe(0);
    expect(op.elite).toBe(-1);
    expect(op.level).toBe(0);
    expect(op.masteries.every((m) => m === -1)).toBe(true);
  });

  it("creates an owned operator at base state", () => {
    const op = defaultOperatorObject(silverAsh, true);
    expect(op.potential).toBe(1);
    expect(op.elite).toBe(0);
    expect(op.level).toBe(1);
    expect(op.skill_level).toBe(1);
    expect(op.masteries.every((m) => m === 0)).toBe(true);
  });
});

describe("changeOwned", () => {
  it("disowning resets everything", () => {
    const owned = defaultOperatorObject(silverAsh, true);
    const disowned = changeOwned(owned, false);
    expect(disowned.potential).toBe(0);
    expect(disowned.elite).toBe(-1);
    expect(disowned.level).toBe(0);
  });
});

describe("changePromotion", () => {
  it("promoting to E1 resets level to 1", () => {
    const op = defaultOperatorObject(silverAsh, true);
    const promoted = changePromotion(op, silverAsh, 1);
    expect(promoted.elite).toBe(1);
    expect(promoted.level).toBe(1);
  });

  it("clamps skill level on demotion to E0", () => {
    let op = defaultOperatorObject(silverAsh, true);
    op = changePromotion(op, silverAsh, 1);
    op = changeSkillLevel(op, silverAsh, 7);
    const demoted = changePromotion(op, silverAsh, 0);
    expect(demoted.skill_level).toBeLessThanOrEqual(4);
  });
});

describe("changeLevel", () => {
  it("clamps to maxLevel for rarity and elite", () => {
    const op = defaultOperatorObject(silverAsh, true);
    const leveled = changeLevel(op, silverAsh, 999);
    expect(leveled.level).toBe(maxLevel(silverAsh.rarity, op.elite));
  });

  it("floors at 1", () => {
    const op = defaultOperatorObject(silverAsh, true);
    const leveled = changeLevel(op, silverAsh, -5);
    expect(leveled.level).toBe(1);
  });
});

describe("changeSkillLevel", () => {
  it("clamps to maxSkillLevel for current elite", () => {
    const op = defaultOperatorObject(silverAsh, true); // E0
    const skilled = changeSkillLevel(op, silverAsh, 7);
    expect(skilled.skill_level).toBeLessThanOrEqual(maxSkillLevel(0));
  });
});

describe("changeMastery", () => {
  it("sets mastery for a specific skill", () => {
    let op = defaultOperatorObject(silverAsh, true);
    op = { ...op, elite: 2, level: 90, skill_level: 7, masteries: [0, 0, 0] };
    const mastered = changeMastery(op, silverAsh, 0, 3);
    expect(mastered.masteries[0]).toBe(3);
    expect(mastered.masteries[1]).toBe(0); // others unchanged
  });
});

/* ---------- isMaxed / completion ---------- */

describe("isMaxed", () => {
  it("returns false for a fresh operator", () => {
    const op = defaultOperatorObject(silverAsh, true);
    const opInfo = { ...silverAsh, ...op };
    expect(isMaxed(opInfo)).toBe(false);
  });
});

describe("completion", () => {
  it("returns low value for a fresh operator", () => {
    const op = defaultOperatorObject(silverAsh, true);
    const opInfo = { ...silverAsh, ...op };
    const pct = completion(opInfo);
    expect(pct).toBeGreaterThanOrEqual(0);
    expect(pct).toBeLessThan(1);
  });
});
