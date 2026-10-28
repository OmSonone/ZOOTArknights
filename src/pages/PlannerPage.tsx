import { useMemo, useState } from "react";
import { Page } from "../components/layout/Shell";
import { DepotPanel } from "../components/planner/DepotPanel";
import { GoalCard } from "../components/planner/GoalCard";
import { GoalEditor } from "../components/planner/GoalEditor";
import { MaterialsPanel } from "../components/planner/MaterialsPanel";
import { Button, Empty, ProgressRing, Tabs } from "../components/neu/ui";
import { ItemIcon } from "../components/items/ItemIcon";
import { formatNumber } from "../lib/format";
import { EXP_ID, LMD_ID } from "../lib/constants";
import { buildMaterialPlan, goalView } from "../lib/planner";
import type { GoalView } from "../lib/planner";
import type { PlannerGoal } from "../lib/types";
import { useGameData } from "../state/data";
import { useApp } from "../state/store";

type Tab = "goals" | "materials" | "depot";

export default function PlannerPage() {
  const data = useGameData();
  const { state, dispatch } = useApp();
  const [tab, setTab] = useState<Tab>("goals");
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<PlannerGoal | null>(null);

  const views = useMemo<GoalView[]>(
    () =>
      state.goals
        .map((goal) => goalView(goal, state.roster, data))
        .filter((view): view is GoalView => view != null)
        .sort((a, b) => a.goal.order - b.goal.order),
    [state.goals, state.roster, data],
  );

  const plan = useMemo(
    () => buildMaterialPlan(state.goals, state.roster, data, state.depot, state.plannerSettings),
    [state.goals, state.roster, data, state.depot, state.plannerSettings],
  );

  const openGoals = views.filter((view) => !view.complete).length;

  const openEditor = (goal: PlannerGoal | null) => {
    setEditing(goal);
    setEditorOpen(true);
  };

  const saveGoal = (goal: PlannerGoal) => {
    if (state.goals.some((entry) => entry.id === goal.id)) {
      dispatch({ type: "goal/update", id: goal.id, patch: goal });
    } else {
      dispatch({ type: "goal/add", goal });
    }
    setEditorOpen(false);
    setEditing(null);
  };

  return (
    <Page
      title="Planner"
      subtitle="Set target states, then see exactly what to farm."
      actions={
        <>
          <span className="badge">
            {openGoals} open goal{openGoals === 1 ? "" : "s"}
          </span>
          <Button variant="primary" size="sm" onClick={() => openEditor(null)}>
            Add goal
          </Button>
        </>
      }
    >
      <Tabs<Tab>
        ariaLabel="Planner sections"
        value={tab}
        onChange={setTab}
        tabs={[
          { id: "goals", label: "Goals" },
          { id: "materials", label: "Materials" },
          { id: "depot", label: "Depot" },
        ]}
      />

      {tab === "goals" &&
        (views.length === 0 ? (
          <Empty icon="planner" title="No goals yet">
            Plan a target state such as E2 L90 with specific masteries and modules; the planner keeps score and totals
            the materials.
            <div style={{ marginTop: 16 }}>
              <Button variant="primary" onClick={() => openEditor(null)}>
                Add your first goal
              </Button>
            </div>
          </Empty>
        ) : (
          <div className="page-grid page-grid--split">
            <div className="col" style={{ gap: 10 }}>
              {views.map((view) => (
                <GoalCard
                  key={view.goal.id}
                  view={view}
                  onEdit={() => openEditor(view.goal)}
                  onRemove={() => dispatch({ type: "goal/remove", id: view.goal.id })}
                />
              ))}
              <div className="row" style={{ justifyContent: "flex-end", marginTop: 4 }}>
                <Button size="sm" variant="ghost" onClick={() => dispatch({ type: "goal/clear" })}>
                  Clear all goals
                </Button>
              </div>
            </div>

            <aside className="neu-card col" style={{ gap: 14 }}>
              <div className="section-head">
                <span className="section-head__title">Overview</span>
              </div>
              <div className="row" style={{ gap: 18 }}>
                <ProgressRing
                  value={views.length ? (views.length - openGoals) / views.length : 0}
                  size={92}
                  stroke={9}
                  label={`${views.length - openGoals}/${views.length}`}
                  sublabel="goals done"
                />
                <div className="col" style={{ gap: 6, flex: 1 }}>
                  <span className="hint">
                    Open goals <strong className="num">{openGoals}</strong>
                  </span>
                  <span className="hint">
                    LMD <strong className="num">{formatNumber(plan.totalLmd)}</strong>
                  </span>
                  <span className="hint">
                    EXP <strong className="num">{formatNumber(plan.totalExp)}</strong>
                  </span>
                </div>
              </div>
              {plan.farmRows.length > 0 && (
                <>
                  <hr className="neu-divider" style={{ margin: "4px 0" }} />
                  <span className="hint">Biggest shortfalls</span>
                  <div className="col" style={{ gap: 8 }}>
                    {plan.farmRows
                      .filter((row) => row.id !== LMD_ID && row.id !== EXP_ID)
                      .slice(0, 6)
                      .map((row) => (
                        <div key={row.id} className="row" style={{ gap: 8 }}>
                          <ItemIcon id={row.id} size={26} />
                          <span className="truncate" style={{ flex: 1, fontSize: "0.8rem" }}>
                            {row.item?.name ?? row.id}
                          </span>
                          <span className="num" style={{ fontSize: "0.8rem", color: "var(--danger)" }}>
                            ×{row.missing}
                          </span>
                        </div>
                      ))}
                  </div>
                </>
              )}
              <Button size="sm" variant="primary" block onClick={() => setTab("materials")}>
                Open materials
              </Button>
            </aside>
          </div>
        ))}

      {tab === "materials" && (
        <MaterialsPanel
          plan={plan}
          depot={state.depot}
          settings={state.plannerSettings}
          goalCount={views.length}
          onSettingsChange={(patch) => dispatch({ type: "settings/patch", patch })}
          onAddGoal={() => openEditor(null)}
        />
      )}

      {tab === "depot" && (
        <DepotPanel
          items={data.items}
          depot={state.depot}
          onChange={(itemId, quantity) => dispatch({ type: "depot/set", itemId, quantity })}
          onClear={() => dispatch({ type: "depot/clear" })}
        />
      )}

      <GoalEditor
        open={editorOpen}
        onClose={() => {
          setEditorOpen(false);
          setEditing(null);
        }}
        goal={editing}
        onSave={saveGoal}
      />
    </Page>
  );
}
