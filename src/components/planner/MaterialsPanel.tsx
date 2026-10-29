import { useState } from "react";
import { EXP_ID, LMD_ID } from "../../lib/constants";
import { formatExact, formatNumber } from "../../lib/format";
import {
  allCraftableIds,
  autoDetectCraftable,
  battleRecordPlan,
  canCraftOne,
  craftOne,
  penguinStatsExport,
} from "../../lib/planner";
import type { MaterialPlan, MaterialRow } from "../../lib/planner";
import { downloadJson } from "../../lib/storage";
import type { Depot, GameData, PlannerSettings } from "../../lib/types";
import { useToast } from "../../state/toast";
import { ItemIcon } from "../items/ItemIcon";
import { Icon } from "../neu/Icon";
import { Badge, Button, Chip, Empty, Stat, Switch } from "../neu/ui";

interface Props {
  plan: MaterialPlan;
  depot: Depot;
  data: GameData;
  settings: PlannerSettings;
  onSettingsChange: (patch: Partial<PlannerSettings>) => void;
  onCraftToggle: (itemId: string) => void;
  onCraftSetAll: (itemIds: string[]) => void;
  onDepotBulk: (entries: Record<string, number>) => void;
  goalCount: number;
  onAddGoal: () => void;
}

/** Tri-state for the global crafting button: off → auto → all → off */
type CraftAllState = "off" | "auto" | "all";
const NEXT_CRAFT_STATE: Record<CraftAllState, CraftAllState> = { off: "auto", auto: "all", all: "off" };

function deriveCraftAllState(settings: PlannerSettings, data: GameData): CraftAllState {
  const list = settings.craftingItems;
  if (list.length === 0) return "off";
  const all = allCraftableIds(data);
  if (list.length >= all.length) return "all";
  return "auto";
}

export function MaterialsPanel({
  plan,
  depot,
  data,
  settings,
  onSettingsChange,
  onCraftToggle,
  onCraftSetAll,
  onDepotBulk,
  goalCount,
  onAddGoal,
}: Props) {
  const { push } = useToast();
  const [onlyMissing, setOnlyMissing] = useState(false);

  if (goalCount === 0) {
    return (
      <Empty icon="planner" title="No goals yet">
        Add a goal and the planner will total up every material, LMD and EXP you need.
        <div style={{ marginTop: 16 }}>
          <Button variant="primary" onClick={onAddGoal}>
            Add your first goal
          </Button>
        </div>
      </Empty>
    );
  }

  const records = battleRecordPlan(plan.totalExp, depot);
  const materialRows = plan.rows.filter((row) => row.id !== LMD_ID && row.id !== EXP_ID);
  const visibleRows = onlyMissing ? materialRows.filter((row) => row.missing > 0) : materialRows;
  const missingCount = materialRows.filter((row) => row.missing > 0).length;
  const lmdMissing = Math.max(0, plan.totalLmd - (depot[LMD_ID] ?? 0));

  const craftSet = new Set(settings.craftingItems);
  const craftAllState = deriveCraftAllState(settings, data);

  const handleCraftAllCycle = () => {
    const next = NEXT_CRAFT_STATE[craftAllState];
    switch (next) {
      case "off":
        onCraftSetAll([]);
        break;
      case "auto":
        onCraftSetAll(autoDetectCraftable(plan));
        break;
      case "all":
        onCraftSetAll(allCraftableIds(data));
        break;
    }
  };

  const handleCraftOne = (row: MaterialRow) => {
    const patch = craftOne(row.id, depot, data);
    onDepotBulk(patch);
    push(`Crafted 1× ${row.item?.name ?? row.id}.`, "success");
  };

  const copyList = async () => {
    const lines: string[] = ["ZOOT — planner materials", ""];
    if (plan.totalLmd > 0) lines.push(`LMD: ${formatExact(plan.totalLmd)}`);
    if (plan.totalExp > 0) lines.push(`EXP: ${formatExact(plan.totalExp)}`);
    const farm = plan.farmRows.filter((row) => row.id !== LMD_ID && row.id !== EXP_ID);
    if (farm.length > 0) {
      lines.push("", "Farm:");
      for (const row of farm) lines.push(`- ${row.item?.name ?? row.id} ×${row.missing}`);
    } else if (materialRows.length > 0) {
      lines.push("", "Materials:");
      for (const row of materialRows) lines.push(`- ${row.item?.name ?? row.id} ×${row.required}`);
    }
    try {
      await navigator.clipboard.writeText(lines.join("\n"));
      push("Shopping list copied to clipboard.", "success");
    } catch {
      push("Clipboard access was blocked by the browser.", "error");
    }
  };

  const penguinJson = () => JSON.stringify(penguinStatsExport(plan, depot, data));

  const copyPenguin = async () => {
    try {
      await navigator.clipboard.writeText(penguinJson());
      push("Penguin Statistics JSON copied to clipboard.", "success");
    } catch {
      push("Clipboard access was blocked by the browser.", "error");
    }
  };

  const downloadPenguin = () =>
    downloadJson(penguinJson(), `zoot-penguin-stats-${new Date().toISOString().slice(0, 10)}.json`);

  return (
    <div className="col" style={{ gap: 16 }}>
      <section className="neu-card col" style={{ gap: 16 }}>
        <div className="section-head">
          <span className="section-head__title">Totals</span>
          <div className="section-head__actions">
            <Button size="sm" variant="ghost" onClick={copyList}>
              Copy list
            </Button>
            <Button size="sm" variant="ghost" onClick={copyPenguin}>
              Copy Penguin Stats
            </Button>
            <Button size="sm" variant="ghost" onClick={downloadPenguin}>
              Download Penguin Stats
            </Button>
          </div>
        </div>
        <div className="summary-hero">
          <Stat label="Goals" value={goalCount} />
          <Stat label="LMD" value={formatNumber(plan.totalLmd)} hint={formatExact(plan.totalLmd)} />
          <Stat label="EXP" value={formatNumber(plan.totalExp)} hint={formatExact(plan.totalExp)} />
          <Stat label="Materials short" value={missingCount} hint={`${materialRows.length} line items`} />
        </div>
        <div className="row row--wrap" style={{ gap: 16 }}>
          <label className="row" style={{ gap: 10, fontSize: "0.84rem" }}>
            <Switch
              checked={settings.includeCrafting}
              onChange={(value) => onSettingsChange({ includeCrafting: value })}
              label="Include crafting"
            />
            Craft from lower tiers
          </label>
          <label className="row" style={{ gap: 10, fontSize: "0.84rem" }}>
            <Switch
              checked={settings.ignoreLmd}
              onChange={(value) => onSettingsChange({ ignoreLmd: value })}
              label="Ignore LMD"
            />
            Ignore LMD
          </label>
          <label className="row" style={{ gap: 10, fontSize: "0.84rem" }}>
            <Switch
              checked={settings.showBattleRecords}
              onChange={(value) => onSettingsChange({ showBattleRecords: value })}
              label="Show battle records"
            />
            Battle records
          </label>
        </div>
      </section>

      <section className="neu-card col" style={{ gap: 10 }}>
        <div className="section-head">
          <span className="section-head__title">LMD & EXP</span>
        </div>
        <div className="record-row">
          <span style={{ width: 30, height: 30 }}>
            <ItemIcon id={LMD_ID} size={30} />
          </span>
          <span>LMD</span>
          <span className="record-row__count">
            {formatExact(plan.totalLmd)}
            {!settings.ignoreLmd && lmdMissing > 0 && (
              <span className="faint" style={{ marginLeft: 8, fontWeight: 500 }}>
                missing {formatNumber(lmdMissing)}
              </span>
            )}
          </span>
        </div>
        <div className="record-row">
          <span style={{ width: 30, height: 30 }}>
            <ItemIcon id={EXP_ID} size={30} />
          </span>
          <span>Operator EXP</span>
          <span className="record-row__count">{formatExact(plan.totalExp)}</span>
        </div>
        {settings.showBattleRecords && plan.totalExp > 0 && (
          <div className="neu-well" style={{ padding: 12 }}>
            <div className="hint" style={{ marginBottom: 6 }}>
              Battle records still needed
            </div>
            {records.every((record) => record.need === 0) ? (
              <Badge tone="success">Covered by your depot</Badge>
            ) : (
              records
                .filter((record) => record.need > 0)
                .map((record) => (
                  <div key={record.id} className="record-row">
                    <span style={{ width: 26, height: 26 }}>
                      <ItemIcon id={record.id} size={26} />
                    </span>
                    <span>{DATA_NAME_HACK[record.id] ?? record.id}</span>
                    <span className="record-row__count">×{record.need}</span>
                  </div>
                ))
            )}
          </div>
        )}
      </section>

      <section className="neu-card col" style={{ gap: 12 }}>
        <div className="section-head">
          <span className="section-head__title">Materials</span>
          <div className="section-head__actions">
            {settings.includeCrafting && (
              <>
                <Chip pressed={craftAllState !== "off"} onClick={handleCraftAllCycle}>
                  <Icon name="craft" size={14} />
                  {craftAllState === "off" ? "Crafting: off" : craftAllState === "auto" ? "Crafting: auto" : "Crafting: all"}
                </Chip>
                {craftAllState !== "off" && (
                  <Chip onClick={() => onCraftSetAll([])}>Reset</Chip>
                )}
              </>
            )}
            <Chip pressed={onlyMissing} onClick={() => setOnlyMissing((value) => !value)}>
              Only missing
            </Chip>
          </div>
        </div>

        {visibleRows.length === 0 ? (
          <p className="hint">Nothing to farm — every material goal is available in your depot.</p>
        ) : (
          <div className={`mat-table${settings.includeCrafting ? " mat-table--craft" : ""}`}>
            <div className="mat-row__head">
              <span />
              <span>Material</span>
              {settings.includeCrafting && <span>Craft</span>}
              <span>Required</span>
              <span>Have</span>
              <span>Missing</span>
            </div>
            {visibleRows.map((row) => {
              const isCrafting = craftSet.has(row.id);
              const craftable = canCraftOne(row.id, depot, data, settings.ignoreLmd);
              const dimmed = isCrafting && row.isParent && row.missing === 0;
              return (
                <div
                  key={row.id}
                  className="mat-row"
                  style={dimmed ? { opacity: 0.45 } : undefined}
                >
                  <span className="mat-row__icon">
                    <ItemIcon id={row.id} size={40} />
                    {isCrafting && row.isParent && (
                      <span className="mat-row__craft-badge" title="Marked for crafting">
                        <Icon name="craft" size={14} />
                      </span>
                    )}
                  </span>
                  <span className="mat-row__name">
                    <span className="mat-row__title">{row.item?.name ?? row.id}</span>
                    {row.crafts != null ? (
                      <span className="mat-row__craft">
                        craft ×{row.crafts} (yield {row.item?.yield ?? 1})
                      </span>
                    ) : row.canCraft ? (
                      <span className="mat-row__craft">recipe available</span>
                    ) : null}
                  </span>
                  {settings.includeCrafting && (
                    <span className="mat-row__craft-actions">
                      {row.canCraft && (
                        <>
                          <button
                            type="button"
                            className={`mat-craft-btn${isCrafting ? " is-active" : ""}`}
                            onClick={() => onCraftToggle(row.id)}
                            title={isCrafting ? "Stop crafting" : "Mark for crafting"}
                            aria-pressed={isCrafting}
                          >
                            <Icon name="craft" size={14} />
                          </button>
                          {isCrafting && (
                            <button
                              type="button"
                              className="mat-craft-btn mat-craft-btn--go"
                              disabled={!craftable}
                              onClick={() => handleCraftOne(row)}
                              title={craftable ? "Craft one batch" : "Not enough ingredients"}
                            >
                              +1
                            </button>
                          )}
                        </>
                      )}
                    </span>
                  )}
                  <span className="mat-row__cell">{formatExact(row.required)}</span>
                  <span className="mat-row__cell mat-row__cell--muted">{formatExact(row.have)}</span>
                  <span className={`mat-row__cell${row.missing > 0 ? " mat-row__cell--danger" : ""}`}>
                    {row.missing > 0 ? formatExact(row.missing) : "✓"}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {settings.includeCrafting && (() => {
        const recordRows = records.filter((r) => r.need > 0);
        const farmMats = plan.farmRows.filter((row) => row.id !== EXP_ID);
        const totalItems = farmMats.length + recordRows.length;
        if (totalItems === 0) return null;
        return (
          <section className="neu-card col" style={{ gap: 12 }}>
            <div className="section-head">
              <span className="section-head__title">Farm list</span>
              <span className="badge">{totalItems} items</span>
            </div>
            <div className="mat-table">
              {recordRows.map((record) => (
                <div key={record.id} className="mat-row">
                  <span className="mat-row__icon">
                    <ItemIcon id={record.id} size={40} />
                  </span>
                  <span className="mat-row__name">
                    <span className="mat-row__title">{DATA_NAME_HACK[record.id] ?? record.id}</span>
                    <span className="mat-row__craft">
                      {formatExact(record.value)} EXP each
                      {record.have > 0 ? ` · ${record.have} in depot` : ""}
                    </span>
                  </span>
                  <span className="mat-row__cell mat-row__cell--danger">×{record.need}</span>
                </div>
              ))}
              {farmMats.map((row) => (
                <div key={row.id} className="mat-row">
                  <span className="mat-row__icon">
                    <ItemIcon id={row.id} size={40} />
                  </span>
                  <span className="mat-row__name">
                    <span className="mat-row__title">{row.item?.name ?? row.id}</span>
                    <span className="mat-row__craft">
                      tier {row.item?.tier ?? "?"}
                      {row.have > 0 ? ` · ${row.have} in depot` : ""}
                    </span>
                  </span>
                  <span className="mat-row__cell mat-row__cell--danger">×{formatExact(row.missing)}</span>
                </div>
              ))}
            </div>
          </section>
        );
      })()}
    </div>
  );
}

/** Battle record names are stable and only four, avoids an extra data lookup. */
export const DATA_NAME_HACK: Record<string, string> = {
  "2001": "Drill Battle Record",
  "2002": "Frontline Battle Record",
  "2003": "Tactical Battle Record",
  "2004": "Strategic Battle Record",
};
