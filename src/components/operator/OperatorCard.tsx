import type { CSSProperties } from "react";
import { RARITY_COLORS } from "../../lib/constants";
import { avatarUrl, moduleStageUrl, rankUrl } from "../../lib/images";
import { isMaxed } from "../../lib/operator";
import type { OpInfo } from "../../lib/types";
import { Img } from "../common/Img";
import { Icon } from "../neu/Icon";

interface Props {
  op: OpInfo;
  owned: boolean;
  onSelect: (opId: string) => void;
}

export function OperatorCard({ op, owned, onSelect }: Props) {
  const maxed = owned && isMaxed(op);
  const skillCount = op.skillData?.length ?? 0;
  const skillPips =
    owned && op.skill_level > 1
      ? Array.from({ length: skillCount }, (_, index) => ({
          index,
          mastery: op.masteries[index] ?? 0,
          unlocked: op.elite >= Math.min(index, 2),
        })).filter((pip) => pip.unlocked)
      : [];

  const modules =
    owned && op.elite === 2 ? (op.moduleData ?? []).filter((mod) => (op.modules[mod.moduleId] ?? 0) > 0) : [];

  return (
    <button
      type="button"
      className={`op-card${owned ? "" : " op-card--unowned"}${maxed ? " op-card--maxed" : ""}`}
      style={{ "--rarity": RARITY_COLORS[op.rarity] } as CSSProperties}
      onClick={() => onSelect(op.id)}
      aria-label={`${op.name}${owned ? "" : " (not owned)"}`}
    >
      <span className="op-card__media">
        <Img
          className="op-card__img"
          src={avatarUrl(op.op_id, owned ? op.elite : 0, owned ? op.skin : null)}
          alt={op.name}
          fallback={op.name}
        />
        <span className="op-card__rarity" />
        {owned && op.elite > 0 && <span className="op-card__elite">E{op.elite}</span>}
        {op.favorite && (
          <span className="op-card__fav" title="Favorite">
            <Icon name="star" size={12} filled />
          </span>
        )}
        {owned && op.level > 0 && <span className="op-card__level">L{op.level}</span>}
        {skillPips.length > 0 && (
          <span className="op-card__pips">
            {skillPips.map((pip) => (
              <span key={pip.index} className="op-card__pip" title={`Skill ${pip.index + 1}`}>
                <Img src={rankUrl(op.skill_level, pip.mastery)} alt="" />
              </span>
            ))}
          </span>
        )}
        {modules.length > 0 && (
          <span className="op-card__modules">
            {modules.map((mod) => (
              <span
                key={mod.moduleId}
                className="op-card__mod"
                title={`${mod.typeName} stage ${op.modules[mod.moduleId]}`}
                style={{
                  backgroundImage: `url(${moduleStageUrl(op.modules[mod.moduleId])})`,
                  backgroundSize: "cover",
                }}
              >
                {op.modules[mod.moduleId]}
              </span>
            ))}
          </span>
        )}
      </span>
      <span className="op-card__meta">
        <span className="op-card__name">{op.name}</span>
        <span className="op-card__class">
          {op.class} · {op.branch.name}
        </span>
      </span>
      {maxed && (
        <span className="badge badge--accent" style={{ position: "absolute", left: 8, bottom: -8 }}>
          MAXED
        </span>
      )}
    </button>
  );
}
