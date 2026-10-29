import { useEffect, useMemo, useState } from "react";
import { RARITY_COLORS } from "../../lib/constants";
import { avatarUrl, moduleArtUrl, skillUrl } from "../../lib/images";
import {
  clamp,
  defaultOperatorObject,
  maxLevel,
  maxPromotion,
  maxSkillLevel,
  moduleLevelRequirement,
} from "../../lib/operator";
import type { Operator, PlannerGoal } from "../../lib/types";
import { useGameData } from "../../state/data";
import { useApp } from "../../state/store";
import { Img } from "../common/Img";
import { Dialog } from "../neu/Dialog";
import { Button, Chip, SearchInput, Segmented, Stepper } from "../neu/ui";

interface Props {
  open: boolean;
  onClose: () => void;
  initialOpId?: string | null;
  goal?: PlannerGoal | null;
  onSave: (goal: PlannerGoal) => void;
}

const newId = (): string =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `goal_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

const masteryStart = (op: Operator, skills: number): Record<string, number> =>
  Object.fromEntries(
    Array.from({ length: skills }, (_, index) => [String(index), clamp(0, op.masteries[index] ?? 0, 3)]),
  );

const moduleStart = (op: Operator): Record<string, number> =>
  Object.fromEntries(Object.entries(op.modules).map(([id, level]) => [id, clamp(0, level, 3)]));

export function GoalEditor({ open, onClose, initialOpId, goal, onSave }: Props) {
  const data = useGameData();
  const { state } = useApp();

  const [opId, setOpId] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  const [targetElite, setTargetElite] = useState(0);
  const [targetLevel, setTargetLevel] = useState(1);
  const [targetSkill, setTargetSkill] = useState(0);
  const [masteries, setMasteries] = useState<Record<string, number>>({});
  const [modules, setModules] = useState<Record<string, number>>({});

  const dataOp = opId ? data.operatorMap[opId] : null;
  const savedOp = opId ? (state.roster[opId] ?? null) : null;
  const base = dataOp ? (savedOp ?? defaultOperatorObject(dataOp)) : null;

  useEffect(() => {
    if (!open) return;
    setQuery("");
    setOpId(goal?.opId ?? initialOpId ?? null);
  }, [open, goal?.id, initialOpId]);

  useEffect(() => {
    if (!open || !dataOp || !base) return;

    const rarity = dataOp.rarity;
    const currentElite = clamp(0, Math.max(base.elite, 0), maxPromotion(rarity));
    const currentLevel = clamp(1, base.level || 1, maxLevel(rarity, currentElite));
    const currentSkill = clamp(0, base.skill_level, 7);
    const skills = dataOp.skillData?.length ?? 0;

    const nextElite = clamp(currentElite, goal?.elite ?? currentElite, maxPromotion(rarity));
    const nextLevel = clamp(
      nextElite === currentElite ? currentLevel : 1,
      goal?.level ?? (nextElite === currentElite ? currentLevel : maxLevel(rarity, nextElite)),
      maxLevel(rarity, nextElite),
    );
    const nextSkill = clamp(
      currentSkill,
      goal?.skillLevel ?? currentSkill,
      Math.max(maxSkillLevel(nextElite), currentSkill),
    );

    const nextMasteries = masteryStart(base, skills);
    for (const [index, value] of Object.entries(goal?.masteries ?? {})) {
      const current = nextMasteries[index] ?? 0;
      nextMasteries[index] = clamp(current, value, 3);
    }

    const nextModules = moduleStart(base);
    for (const [moduleId, value] of Object.entries(goal?.modules ?? {})) {
      const current = nextModules[moduleId] ?? 0;
      nextModules[moduleId] = clamp(current, value, 3);
    }

    setTargetElite(nextElite);
    setTargetLevel(nextLevel);
    setTargetSkill(nextSkill);
    setMasteries(nextMasteries);
    setModules(nextModules);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, opId, goal?.id]);

  const pickerList = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return data.operators
      .filter((op) => !needle || op.name.toLowerCase().includes(needle) || op.cnName.includes(needle))
      .sort((a, b) => b.rarity - a.rarity || a.name.localeCompare(b.name))
      .slice(0, 80);
  }, [data.operators, query]);

  if (!open) {
    return null;
  }

  const rarity = dataOp?.rarity ?? 6;
  const maxE = dataOp ? maxPromotion(rarity) : 0;
  const currentElite = base ? clamp(0, Math.max(base.elite, 0), maxE) : 0;
  const currentLevel = base ? clamp(1, base.level || 1, maxLevel(rarity, currentElite)) : 1;
  const currentSkill = base ? clamp(0, base.skill_level, 7) : 0;

  const levelMax = maxLevel(rarity, targetElite);
  const levelMin = targetElite === currentElite ? currentLevel : 1;
  const skillMax = maxSkillLevel(targetElite);
  const masteryReady = targetElite >= 2 && targetSkill >= 7;
  const levelRequirement = moduleLevelRequirement(rarity);
  const moduleReady = targetElite >= 2 && targetLevel >= levelRequirement;

  const skills = dataOp?.skillData ?? [];
  const moduleList = dataOp?.moduleData ?? [];

  const hasChanges =
    base != null &&
    (targetElite > currentElite ||
      (targetElite === currentElite && targetLevel > currentLevel) ||
      targetSkill > currentSkill ||
      skills.some((_, index) => (masteries[String(index)] ?? 0) > clamp(0, base.masteries[index] ?? 0, 3)) ||
      moduleList.some((mod) => (modules[mod.moduleId] ?? 0) > clamp(0, base.modules[mod.moduleId] ?? 0, 3)));

  const changePromotion = (next: number) => {
    const elite = clamp(currentElite, next, maxE);
    setTargetElite(elite);
    const max = maxLevel(rarity, elite);
    setTargetLevel(elite === currentElite ? clamp(currentLevel, targetLevel, max) : max);
    setTargetSkill((value) => clamp(currentSkill, Math.min(value, maxSkillLevel(elite)), 7));
    if (elite < 2) {
      setMasteries((current) =>
        Object.fromEntries(
          Object.entries(current).map(([index]) => [index, clamp(0, base?.masteries[Number(index)] ?? 0, 3)]),
        ),
      );
      setModules((current) =>
        Object.fromEntries(
          Object.entries(current).map(([moduleId]) => [moduleId, clamp(0, base?.modules[moduleId] ?? 0, 3)]),
        ),
      );
    }
  };

  const changeLevel = (next: number) => {
    setTargetLevel(clamp(levelMin, next, levelMax));
  };

  const changeSkill = (next: number) => {
    setTargetSkill(clamp(currentSkill, Math.min(next, skillMax), 7));
  };

  const applyMax = () => {
    setTargetElite(maxE);
    setTargetLevel(maxLevel(rarity, maxE));
    setTargetSkill(rarity > 2 ? 7 : 0);
    if (maxE >= 2 && rarity > 3) {
      setMasteries(Object.fromEntries(skills.map((_, index) => [String(index), 3])));
      setModules(Object.fromEntries(moduleList.map((mod) => [mod.moduleId, 3])));
    }
  };

  const save = () => {
    if (!opId || !dataOp) return;
    const next: PlannerGoal = {
      id: goal?.id ?? newId(),
      opId,
      order: goal?.order ?? Date.now(),
      elite: targetElite,
      level: targetLevel,
    };
    if (dataOp.rarity > 2) next.skillLevel = targetSkill;

    const masteryTargets = Object.fromEntries(
      skills
        .map((_, index) => [String(index), clamp(0, masteries[String(index)] ?? 0, 3)] as const)
        .filter(([index, value]) => value > clamp(0, base?.masteries[Number(index)] ?? 0, 3)),
    );
    if (Object.keys(masteryTargets).length > 0) next.masteries = masteryTargets;

    const moduleTargets = Object.fromEntries(
      moduleList
        .map((mod) => [mod.moduleId, clamp(0, modules[mod.moduleId] ?? 0, 3)] as const)
        .filter(([id, value]) => value > clamp(0, base?.modules[id] ?? 0, 3)),
    );
    if (Object.keys(moduleTargets).length > 0) next.modules = moduleTargets;

    onSave(next);
    onClose();
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={goal ? "Edit goal" : "Add a goal"}
      subtitle={
        goal
          ? "Adjust the target state; the planner recalculates every row."
          : "Pick the end state you want. Promotion, level, skills, masteries and modules can all be planned together."
      }
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" disabled={!hasChanges} onClick={save}>
            {goal ? "Save goal" : "Add goal"}
          </Button>
        </>
      }
    >
      {!opId && (
        <>
          <div className="field">
            <span className="field__label">Operator</span>
            <SearchInput value={query} onChange={setQuery} placeholder="Search by name…" />
          </div>
          <div className="picker__list" style={{ maxHeight: 300 }}>
            {pickerList.map((op) => {
              const owned = Boolean(state.roster[op.id]?.potential);
              return (
                <button
                  key={op.id}
                  type="button"
                  className="picker__item"
                  onClick={() => setOpId(op.id)}
                  style={{ borderLeft: `3px solid ${RARITY_COLORS[op.rarity]}` }}
                >
                  <span className={`picker__avatar${owned ? "" : " picker__avatar--none"}`}>
                    <Img src={avatarUrl(op.id, 0)} alt="" />
                  </span>
                  <span style={{ minWidth: 0 }}>
                    <span className="picker__name" style={{ display: "block" }}>
                      {op.name}
                    </span>
                    <span className="picker__sub">
                      {op.rarity}★ {op.class}
                    </span>
                  </span>
                  <span className={`picker__dot${owned ? "" : " picker__dot--none"}`} />
                </button>
              );
            })}
          </div>
        </>
      )}

      {dataOp && base && (
        <>
          <div className="row row--wrap" style={{ gap: 10 }}>
            <span
              className="editor__art"
              style={{ width: 56, height: 56, borderRadius: 14, ["--rarity" as string]: RARITY_COLORS[dataOp.rarity] }}
            >
              <Img src={avatarUrl(dataOp.id, Math.max(base.elite, 0), base.skin)} alt="" />
            </span>
            <div style={{ minWidth: 0 }}>
              <div className="editor__name" style={{ fontSize: "1.05rem" }}>
                {dataOp.name}
              </div>
              <div className="editor__sub">
                Current: {base.elite < 0 ? "unowned" : `E${currentElite} L${currentLevel}`}
                {dataOp.rarity > 2 ? ` · SL${currentSkill}` : ""}
              </div>
            </div>
            <span className="spacer" />
            {!goal && <Chip onClick={() => setOpId(null)}>Change</Chip>}
          </div>

          <div className="goal-target">
            <div className="goal-target__row">
              <span className="goal-target__label">Promotion</span>
              <Segmented<number>
                ariaLabel="Target promotion"
                value={targetElite}
                onChange={changePromotion}
                options={Array.from({ length: maxE + 1 }, (_, index) => ({
                  value: index,
                  label: `E${index}`,
                  disabled: index < currentElite,
                }))}
              />
              <span className="goal-target__hint">Max L{maxLevel(rarity, targetElite)}</span>
            </div>

            <div className="goal-target__row">
              <span className="goal-target__label">Level</span>
              <div className="row" style={{ gap: 12, minWidth: 0 }}>
                <input
                  className="neu-range"
                  type="range"
                  min={levelMin}
                  max={levelMax}
                  value={clamp(levelMin, targetLevel, levelMax)}
                  style={{
                    ["--fill" as string]:
                      ((clamp(levelMin, targetLevel, levelMax) - levelMin) / Math.max(levelMax - levelMin, 1)) * 100,
                  }}
                  onChange={(event) => changeLevel(Number(event.target.value))}
                  aria-label="Target level"
                />
                <Stepper
                  value={targetLevel}
                  min={levelMin}
                  max={levelMax}
                  onChange={changeLevel}
                  label="target level"
                />
              </div>
              <span className="goal-target__hint">
                {levelMin}–{levelMax}
              </span>
            </div>

            {dataOp.rarity > 2 && (
              <div className="goal-target__row">
                <span className="goal-target__label">Skill level</span>
                <Segmented<number>
                  ariaLabel="Target skill level"
                  value={targetSkill}
                  onChange={changeSkill}
                  options={[1, 2, 3, 4, 5, 6, 7].map((value) => ({
                    value,
                    label: String(value),
                    disabled: value > skillMax || value < currentSkill,
                  }))}
                />
                <span className="goal-target__hint">max {skillMax}</span>
              </div>
            )}
          </div>

          {dataOp.rarity > 3 && skills.length > 0 && (
            <section className="col" style={{ gap: 8 }}>
              <div className="row" style={{ gap: 8 }}>
                <span className="field__label" style={{ margin: 0 }}>
                  Masteries
                </span>
                <span className="hint">each skill is independent</span>
              </div>
              {skills.map((skill, index) => {
                const currentMastery = clamp(0, base.masteries[index] ?? 0, 3);
                return (
                  <div key={skill.skillId} className="skill-row" data-kind="mastery">
                    <div className="skill-row__head">
                      <span className="skill-row__icon">
                        <Img src={skillUrl(skill.iconId ?? skill.skillId)} alt="" />
                      </span>
                      <span className="skill-row__name">
                        S{index + 1} · {skill.skillName}
                      </span>
                      <span className="spacer" />
                      <Stepper
                        value={masteries[String(index)] ?? currentMastery}
                        min={currentMastery}
                        max={3}
                        onChange={(value) =>
                          setMasteries((current) => ({ ...current, [String(index)]: clamp(currentMastery, value, 3) }))
                        }
                        disabled={!masteryReady}
                        label={`mastery for ${skill.skillName}`}
                      />
                    </div>
                    {!masteryReady && (
                      <span className="hint">Target Elite 2 + Skill Level 7 above to plan masteries.</span>
                    )}
                  </div>
                );
              })}
            </section>
          )}

          {moduleList.length > 0 && (
            <section className="col" style={{ gap: 8 }}>
              <div className="row" style={{ gap: 8 }}>
                <span className="field__label" style={{ margin: 0 }}>
                  Modules
                </span>
                <span className="hint">each module is independent</span>
              </div>
              {moduleList.map((mod) => {
                const currentLevel = clamp(0, base.modules[mod.moduleId] ?? 0, 3);
                return (
                  <div key={mod.moduleId} className="skill-row" data-kind="module">
                    <div className="skill-row__head">
                      <span className="skill-row__icon">
                        <Img src={moduleArtUrl(mod.moduleId)} alt="" />
                      </span>
                      <span className="skill-row__name">
                        {mod.typeName} · {mod.moduleName}
                        {mod.isCnOnly ? " (CN)" : ""}
                      </span>
                      <span className="spacer" />
                      <Stepper
                        value={modules[mod.moduleId] ?? currentLevel}
                        min={currentLevel}
                        max={3}
                        onChange={(value) =>
                          setModules((current) => ({ ...current, [mod.moduleId]: clamp(currentLevel, value, 3) }))
                        }
                        disabled={!moduleReady}
                        label={`${mod.typeName} stage`}
                      />
                    </div>
                    {!moduleReady && (
                      <span className="hint">Target Elite 2 + Lv {levelRequirement} above to plan modules.</span>
                    )}
                  </div>
                );
              })}
            </section>
          )}

          <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
            <Chip onClick={applyMax} title="Fill every target to its maximum">
              Max everything
            </Chip>
            <span className="hint">
              {base.elite < 0 ? "Unowned" : `From E${currentElite} L${currentLevel}`} → E{targetElite} L{targetLevel}
              {dataOp.rarity > 2 ? ` · SL${targetSkill}` : ""}
            </span>
          </div>
        </>
      )}
    </Dialog>
  );
}
