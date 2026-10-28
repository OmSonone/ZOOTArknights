import { useState } from "react";
import { EXP_ID, LMD_ID } from "../../lib/constants";
import { formatExact, formatNumber } from "../../lib/format";
import { battleRecordPlan } from "../../lib/planner";
import type { MaterialPlan } from "../../lib/planner";
import type { Depot, PlannerSettings } from "../../lib/types";
import { useToast } from "../../state/toast";
import { ItemIcon } from "../items/ItemIcon";
import { Badge, Button, Chip, Empty, Stat, Switch } from "../neu/ui";

interface Props {
  plan: MaterialPlan;
  depot: Depot;
  settings: PlannerSettings;
  onSettingsChange: (patch: Partial<PlannerSettings>) => void;
  goalCount: number;
  onAddGoal: () => void;
}

export function MaterialsPanel({ plan, depot, settings, onSettingsChange, goalCount, onAddGoal }: Props) {
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

  return (
    <div className="col" style={{ gap: 16 }}>
      <section className="neu-card col" style={{ gap: 16 }}>
        <div className="section-head">
          <span className="section-head__title">Totals</span>
          <div className="section-head__actions">
            <Button size="sm" variant="ghost" onClick={copyList}>
              Copy list
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
            <Chip pressed={onlyMissing} onClick={() => setOnlyMissing((value) => !value)}>
              Only missing
            </Chip>
          </div>
        </div>

        {visibleRows.length === 0 ? (
          <p className="hint">Nothing to farm — every material goal is available in your depot.</p>
        ) : (
          <div className="mat-table">
            <div className="mat-row__head">
              <span />
              <span>Material</span>
              <span>Required</span>
              <span>Have</span>
              <span>Missing</span>
            </div>
            {visibleRows.map((row) => (
              <div key={row.id} className="mat-row">
                <span className="mat-row__icon">
                  <ItemIcon id={row.id} size={40} />
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
                <span className="mat-row__cell">{formatExact(row.required)}</span>
                <span className="mat-row__cell mat-row__cell--muted">{formatExact(row.have)}</span>
                <span className={`mat-row__cell${row.missing > 0 ? " mat-row__cell--danger" : ""}`}>
                  {row.missing > 0 ? formatExact(row.missing) : "✓"}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>

      {settings.includeCrafting && plan.farmRows.length > 0 && (
        <section className="neu-card col" style={{ gap: 12 }}>
          <div className="section-head">
            <span className="section-head__title">Farm list</span>
            <span className="badge">{plan.farmRows.length} items</span>
          </div>
          <div className="mat-table">
            {plan.farmRows
              .filter((row) => row.id !== LMD_ID && row.id !== EXP_ID)
              .map((row) => (
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
      )}
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
