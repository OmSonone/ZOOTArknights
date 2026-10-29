import { useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { useSearchParams } from "react-router-dom";
import { Page } from "../components/layout/Shell";
import { Img } from "../components/common/Img";
import { Dialog } from "../components/neu/Dialog";
import {
  Badge,
  Button,
  Chip,
  Empty,
  ProgressRing,
  SearchInput,
  Segmented,
  Stepper,
  Switch,
} from "../components/neu/ui";
import { getMaxPotential, RARITY_COLORS } from "../lib/constants";
import { avatarUrl, moduleArtUrl, skillUrl, skinAvatarUrl } from "../lib/images";
import {
  changeFavorite,
  changeLevel,
  changeMastery,
  changeModule,
  changeOwned,
  changePotential,
  changePromotion,
  changeSkin,
  changeSkillLevel,
  completion,
  defaultOperatorObject,
  maxLevel,
  maxPromotion,
  maxSkillLevel,
  moduleLevelRequirement,
  numSkills,
} from "../lib/operator";
import { downloadSave, parseSave } from "../lib/storage";
import type { Operator } from "../lib/types";
import { useGameData } from "../state/data";
import { useApp } from "../state/store";
import { useToast } from "../state/toast";

export default function InputPage() {
  const data = useGameData();
  const { state, dispatch } = useApp();
  const { push } = useToast();
  const [searchParams] = useSearchParams();

  const [query, setQuery] = useState("");
  const [opId, setOpId] = useState<string | null>(searchParams.get("op"));
  const [transferOpen, setTransferOpen] = useState(false);
  const [pasteValue, setPasteValue] = useState("");
  const [resetArmed, setResetArmed] = useState(false);
  const editorRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const param = searchParams.get("op");
    if (param) setOpId(param);
  }, [searchParams]);

  const pickerList = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return data.operators
      .filter((op) => !needle || op.name.toLowerCase().includes(needle) || op.cnName.includes(needle))
      .sort((a, b) => {
        const aOwned = state.roster[a.id]?.potential ? 1 : 0;
        const bOwned = state.roster[b.id]?.potential ? 1 : 0;
        return bOwned - aOwned || b.rarity - a.rarity || a.name.localeCompare(b.name);
      });
  }, [data.operators, query, state.roster]);

  const dataOp = opId ? data.operatorMap[opId] : null;
  const saved = opId ? state.roster[opId] : null;
  const op = dataOp ? (saved ?? defaultOperatorObject(dataOp)) : null;
  const owned = Boolean(op?.potential);
  const skinOptions = useMemo(
    () => (opId ? (data.skins[opId] ?? []) : []).filter((skin) => !(skin.skinName == null && skin.avatarId === opId)),
    [data.skins, opId],
  );

  const apply = (next: Operator) => {
    if (!opId) return;
    dispatch({ type: "operator/set", opId, op: next });
  };

  const markMaxed = () => {
    if (!op || !dataOp) return;
    const elite = maxPromotion(dataOp.rarity);
    const next: Operator = {
      ...op,
      potential: getMaxPotential(op.op_id),
      elite,
      level: maxLevel(dataOp.rarity, elite),
      skill_level: dataOp.rarity > 2 ? 7 : 0,
      masteries: (dataOp.skillData ?? []).map(() => (elite === 2 ? 3 : 0)),
      modules: Object.fromEntries((dataOp.moduleData ?? []).map((mod) => [mod.moduleId, elite === 2 ? 3 : 0])),
    };
    apply(next);
    push("Operator set to max.", "success");
  };

  const resetOp = () => {
    if (!opId) return;
    dispatch({ type: "operator/remove", opId });
    push("Operator reset to unowned.", "info");
  };

  const importSave = (text: string) => {
    try {
      const next = parseSave(text);
      dispatch({ type: "state/replace", state: next });
      push("Save imported.", "success");
      setTransferOpen(false);
      setPasteValue("");
    } catch (error) {
      push(error instanceof Error ? error.message : "Import failed.", "error");
    }
  };

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    try {
      setPasteValue(await file.text());
    } catch {
      push("Could not read that file.", "error");
    }
  };

  return (
    <Page
      title="Input"
      subtitle="Track what you own. Everything saves to this browser."
      actions={
        <>
          <Button size="sm" onClick={() => downloadSave(state)}>
            Export
          </Button>
          <Button size="sm" variant="primary" onClick={() => setTransferOpen(true)}>
            Import
          </Button>
        </>
      }
    >
      <div className="input-layout">
        <aside className="picker">
          <SearchInput value={query} onChange={setQuery} placeholder="Search operators…" />
          <div className="picker__list">
            {pickerList.map((entry) => {
              const entryOwned = Boolean(state.roster[entry.id]?.potential);
              return (
                <button
                  key={entry.id}
                  type="button"
                  className={`picker__item${opId === entry.id ? " is-active" : ""}`}
                  onClick={() => {
                    setOpId(entry.id);
                    window.setTimeout(() => {
                      if (window.matchMedia("(max-width: 980px)").matches) {
                        editorRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
                      }
                    }, 80);
                  }}
                >
                  <span className={`picker__avatar${entryOwned ? "" : " picker__avatar--none"}`}>
                    <Img src={avatarUrl(entry.id, 0)} alt="" />
                  </span>
                  <span style={{ minWidth: 0 }}>
                    <span className="picker__name" style={{ display: "block" }}>
                      {entry.name}
                    </span>
                    <span className="picker__sub">
                      {entry.rarity}★ {entry.class}
                    </span>
                  </span>
                  <span className={`picker__dot${entryOwned ? "" : " picker__dot--none"}`} />
                </button>
              );
            })}
          </div>
        </aside>

        {op && dataOp ? (
          <section className="editor" ref={editorRef}>
            <div className="editor__hero">
              <span className="editor__art" style={{ "--rarity": RARITY_COLORS[dataOp.rarity] } as CSSProperties}>
                <Img src={avatarUrl(dataOp.id, Math.max(op.elite, 0), op.skin)} alt={dataOp.name} />
              </span>
              <div className="editor__heading">
                <div className="editor__name">{dataOp.name}</div>
                <div className="editor__sub">
                  {dataOp.rarity}★ · {dataOp.class} · {dataOp.branch.name}
                </div>
                <div className="row" style={{ marginTop: 6, gap: 6 }}>
                  {owned ? (
                    <>
                      <Badge tone="success">Owned</Badge>
                      <Badge>E{op.elite}</Badge>
                      <Badge>L{op.level}</Badge>
                      {dataOp.rarity > 2 && <Badge>SL{op.skill_level}</Badge>}
                    </>
                  ) : (
                    <Badge>Not owned</Badge>
                  )}
                </div>
              </div>
              <div className="row" style={{ gap: 12 }}>
                {owned && (
                  <ProgressRing
                    value={completion({ ...dataOp, ...op })}
                    size={64}
                    stroke={7}
                    label={`${Math.round(completion({ ...dataOp, ...op }) * 100)}%`}
                  />
                )}
                <div className="editor__toggle">
                  <Switch
                    checked={owned}
                    onChange={(value) => apply(changeOwned(op, value))}
                    label="Own this operator"
                  />
                  Owned
                </div>
              </div>
            </div>

            {!owned ? (
              <Empty icon="info" title="This operator is not in your roster">
                Flip the Owned switch to start tracking levels, skills and modules.
              </Empty>
            ) : (
              <>
                <div className="control">
                  <span className="control__label">Promotion</span>
                  <Segmented<number>
                    ariaLabel="Promotion"
                    value={op.elite}
                    onChange={(value) => apply(changePromotion(op, dataOp, value))}
                    options={Array.from({ length: maxPromotion(dataOp.rarity) + 1 }, (_, index) => ({
                      value: index,
                      label: `E${index}`,
                    }))}
                  />
                  <span className="control__value">Max L{maxLevel(dataOp.rarity, op.elite)}</span>
                </div>

                <div className="control">
                  <span className="control__label">Level</span>
                  <div className="row" style={{ gap: 12 }}>
                    <input
                      className="neu-range"
                      type="range"
                      min={1}
                      max={maxLevel(dataOp.rarity, op.elite)}
                      value={op.level}
                      style={
                        {
                          ["--fill" as string]:
                            ((op.level - 1) / Math.max(maxLevel(dataOp.rarity, op.elite) - 1, 1)) * 100,
                        } as CSSProperties
                      }
                      onChange={(event) => apply(changeLevel(op, dataOp, Number(event.target.value)))}
                      aria-label="Level"
                    />
                    <Stepper
                      value={op.level}
                      min={1}
                      max={maxLevel(dataOp.rarity, op.elite)}
                      onChange={(value) => apply(changeLevel(op, dataOp, value))}
                      label="level"
                      size="lg"
                    />
                  </div>
                </div>

                {dataOp.rarity > 2 && (
                  <div className="control">
                    <span className="control__label">Skill level</span>
                    <Segmented<number>
                      ariaLabel="Skill level"
                      value={op.skill_level}
                      onChange={(value) => apply(changeSkillLevel(op, dataOp, value))}
                      options={[1, 2, 3, 4, 5, 6, 7].map((value) => ({
                        value,
                        label: String(value),
                        disabled: value > maxSkillLevel(op.elite),
                      }))}
                    />
                    <span className="control__value">SL{op.skill_level}</span>
                  </div>
                )}

                {numSkills(dataOp) > 0 && dataOp.rarity > 3 && (
                  <div className="col" style={{ gap: 8 }}>
                    <span className="control__label">Masteries</span>
                    {dataOp.skillData?.map((skill, index) => {
                      const locked = op.elite !== 2 || op.skill_level !== 7;
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
                              value={op.masteries[index] ?? 0}
                              min={0}
                              max={3}
                              onChange={(value) => apply(changeMastery(op, dataOp, index, value))}
                              disabled={locked}
                              label={`mastery for ${skill.skillName}`}
                            />
                          </div>
                          {locked && <span className="hint">Unlocks at Elite 2 with Skill Level 7.</span>}
                        </div>
                      );
                    })}
                  </div>
                )}

                {(dataOp.moduleData?.length ?? 0) > 0 && (
                  <div className="col" style={{ gap: 8 }}>
                    <span className="control__label">Modules</span>
                    {dataOp.moduleData?.map((mod) => {
                      const requirement = moduleLevelRequirement(dataOp.rarity);
                      const locked = op.elite !== 2 || op.level < requirement;
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
                              value={op.modules[mod.moduleId] ?? 0}
                              min={0}
                              max={3}
                              onChange={(value) => apply(changeModule(op, dataOp, mod.moduleId, value))}
                              disabled={locked}
                              label={`${mod.typeName} stage`}
                            />
                          </div>
                          {locked && <span className="hint">Requires Elite 2 and Lv {requirement}.</span>}
                        </div>
                      );
                    })}
                  </div>
                )}

                <div className="control">
                  <span className="control__label">Potential</span>
                  <Stepper
                    value={op.potential}
                    min={1}
                    max={getMaxPotential(op.op_id)}
                    onChange={(value) => apply(changePotential(op, value))}
                    label="potential"
                  />
                  <span className="control__value">{dataOp.potentials[op.potential - 1] ?? ""}</span>
                </div>

                <div className="control">
                  <span className="control__label">Favorite</span>
                  <Chip pressed={op.favorite} onClick={() => apply(changeFavorite(op, !op.favorite))}>
                    ★ Favorite
                  </Chip>
                  <span />
                </div>

                {skinOptions.length > 0 && (
                  <div className="col" style={{ gap: 8 }}>
                    <span className="control__label">Skin</span>
                    <div className="row row--wrap" style={{ gap: 8 }}>
                      <Chip pressed={op.skin == null} onClick={() => apply(changeSkin(op, null))}>
                        Default art
                      </Chip>
                      {skinOptions.map((skin) => (
                        <Chip
                          key={skin.skinId}
                          pressed={op.skin === skin.avatarId}
                          disabled={(skin.sortId === -1 && op.elite < 2) || (skin.sortId === -2 && op.elite < 1)}
                          onClick={() => apply(changeSkin(op, skin.avatarId))}
                          title={
                            (skin.sortId === -1 && op.elite < 2) || (skin.sortId === -2 && op.elite < 1)
                              ? "Unlocks with a higher promotion"
                              : (skin.skinName ?? skin.skinId)
                          }
                        >
                          <span
                            style={{
                              width: 22,
                              height: 22,
                              borderRadius: 6,
                              overflow: "hidden",
                              display: "block",
                            }}
                          >
                            <Img src={skinAvatarUrl(skin.avatarId)} alt="" />
                          </span>
                          {skin.skinName ?? "Alt art"}
                        </Chip>
                      ))}
                    </div>
                  </div>
                )}

                <div className="editor__foot">
                  <Button size="sm" onClick={markMaxed}>
                    Mark maxed
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => apply(changeOwned(op, false))}>
                    Mark unowned
                  </Button>
                  <Button size="sm" variant="ghost" onClick={resetOp}>
                    Reset entry
                  </Button>
                </div>
              </>
            )}
          </section>
        ) : (
          <Empty icon="input" title="Pick an operator">
            Choose someone from the list to start editing, or import a save file.
          </Empty>
        )}
      </div>

      <Dialog
        open={transferOpen}
        onClose={() => setTransferOpen(false)}
        title="Import a save"
        subtitle="Paste a JSON save file or choose one from disk. This replaces the current local save."
        footer={
          <>
            <Button
              variant="ghost"
              className={resetArmed ? "neu-btn--danger" : undefined}
              style={{ marginRight: "auto" }}
              onClick={() => {
                if (!resetArmed) {
                  setResetArmed(true);
                  window.setTimeout(() => setResetArmed(false), 4000);
                  return;
                }
                dispatch({ type: "state/reset" });
                setResetArmed(false);
                setTransferOpen(false);
                push("Local save cleared.", "success");
              }}
            >
              {resetArmed ? "Click again to confirm" : "Reset everything"}
            </Button>
            <Button variant="ghost" onClick={() => setTransferOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" disabled={pasteValue.trim().length === 0} onClick={() => importSave(pasteValue)}>
              Import save
            </Button>
          </>
        }
      >
        <label className="field">
          <span className="field__label">Save file</span>
          <input
            type="file"
            accept="application/json,.json"
            onChange={(event) => void onFile(event.target.files?.[0])}
            className="input"
            style={{ padding: 10 }}
          />
        </label>
        <label className="field">
          <span className="field__label">Or paste JSON</span>
          <textarea
            className="textarea"
            value={pasteValue}
            onChange={(event) => setPasteValue(event.target.value)}
            placeholder='{ "version": 1, "roster": { … } }'
          />
        </label>
      </Dialog>
    </Page>
  );
}
