import type { CSSProperties } from "react";
import { RARITY_COLORS } from "../../lib/constants";
import { avatarUrl } from "../../lib/images";
import type { GoalTask, GoalView } from "../../lib/planner";
import type { GoalKind } from "../../lib/types";
import { Img } from "../common/Img";
import { ItemChip } from "../items/ItemIcon";
import { Badge, IconButton } from "../neu/ui";

const KIND_LABEL: Record<GoalKind, string> = {
  elite: "E",
  level: "L",
  skill_level: "SL",
  mastery: "M",
  module: "MOD",
};

interface Props {
  view: GoalView;
  onEdit: () => void;
  onRemove: () => void;
}

function TaskRow({ task }: { task: GoalTask }) {
  const visible = task.ingredients.slice(0, 4);
  const hidden = task.ingredients.length - visible.length;

  return (
    <li className={`goal-task${task.complete ? " is-complete" : ""}`}>
      <span className={`goal-task__kind kind-${task.kind}`}>{KIND_LABEL[task.kind]}</span>
      <div className="goal-task__main">
        <div className="goal-task__line">
          <span className="goal-task__title">{task.title}</span>
          <span className="goal-task__range num">
            {task.fromLabel} → {task.toLabel}
          </span>
          {task.complete && <Badge tone="success">Done</Badge>}
          {!task.complete && task.warning && <Badge tone="warning">{task.warning}</Badge>}
        </div>
        {!task.complete && visible.length > 0 && (
          <div className="goal-task__mats">
            {visible.map((ingredient) => (
              <ItemChip key={ingredient.id} ingredient={ingredient} />
            ))}
            {hidden > 0 && <span className="badge">+{hidden}</span>}
          </div>
        )}
      </div>
    </li>
  );
}

export function GoalCard({ view, onEdit, onRemove }: Props) {
  const { op, tasks, warnings, complete } = view;
  const openTasks = tasks.filter((task) => !task.complete).length;

  return (
    <article className={`goal-card${complete ? " is-complete" : ""}`}>
      <header className="goal-card__head">
        <span className="goal-row__avatar" style={{ "--rarity": RARITY_COLORS[op.rarity] } as CSSProperties}>
          <Img src={avatarUrl(op.op_id, Math.max(op.elite, 0), op.skin)} alt="" />
        </span>
        <div className="goal-card__id">
          <span className="goal-card__name">{op.name}</span>
          <span className="goal-card__state num">
            {view.fromLabel} → {view.toLabel}
            {op.rarity > 2 && view.targetSkillLevel > op.skill_level
              ? ` · SL${op.skill_level} → SL${view.targetSkillLevel}`
              : ""}
          </span>
        </div>
        <div className="goal-card__actions">
          {complete ? (
            <Badge tone="success">Complete</Badge>
          ) : (
            <Badge>
              {openTasks} step{openTasks === 1 ? "" : "s"}
            </Badge>
          )}
          <IconButton icon="input" label={`Edit goal for ${op.name}`} size="sm" variant="ghost" onClick={onEdit} />
          <IconButton icon="trash" label={`Remove goal for ${op.name}`} size="sm" variant="ghost" onClick={onRemove} />
        </div>
      </header>

      {warnings.length > 0 && (
        <div className="row row--wrap" style={{ gap: 6 }}>
          {warnings.map((warning) => (
            <Badge key={warning} tone="warning">
              {warning}
            </Badge>
          ))}
        </div>
      )}

      {tasks.length === 0 ? (
        <p className="hint" style={{ margin: 0 }}>
          Nothing left to do for this target.
        </p>
      ) : (
        <ul className="goal-tasks">
          {tasks.map((task) => (
            <TaskRow key={task.key} task={task} />
          ))}
        </ul>
      )}
    </article>
  );
}
