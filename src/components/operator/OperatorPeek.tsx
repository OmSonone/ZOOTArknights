import type { CSSProperties } from "react";
import { useNavigate } from "react-router-dom";
import { RARITY_COLORS } from "../../lib/constants";
import { avatarUrl, moduleArtUrl, moduleStageUrl, potentialUrl, rankUrl, skillUrl } from "../../lib/images";
import { defaultOperatorObject } from "../../lib/operator";
import type { OpInfo } from "../../lib/types";
import { useGameData } from "../../state/data";
import { useApp } from "../../state/store";
import { Img } from "../common/Img";
import { Dialog } from "../neu/Dialog";
import { Badge, Button } from "../neu/ui";

interface Props {
  opId: string | null;
  onClose: () => void;
}

export function OperatorPeek({ opId, onClose }: Props) {
  const data = useGameData();
  const { state } = useApp();
  const navigate = useNavigate();

  const dataOp = opId ? data.operatorMap[opId] : null;
  const saved = opId ? state.roster[opId] : null;
  const owned = Boolean(saved?.potential);
  const op: OpInfo | null = dataOp
    ? ({ ...dataOp, ...(saved ?? defaultOperatorObject(dataOp)) } as OpInfo)
    : null;

  if (!op) {
    return (
      <Dialog open={false} onClose={onClose} title="Operator">
        {null}
      </Dialog>
    );
  }

  const factions = op.factions.map((id) => data.factions[id]?.powerName ?? id);

  return (
    <Dialog
      open={opId != null}
      onClose={onClose}
      title={op.name}
      subtitle={`${op.rarity}★ ${op.class} · ${op.branch.name}`}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Close
          </Button>
          <Button
            variant="primary"
            onClick={() => {
              navigate(`/input?op=${op.op_id}`);
              onClose();
            }}
          >
            Edit in Input
          </Button>
        </>
      }
    >
      <div className="peek" style={{ "--rarity": RARITY_COLORS[op.rarity] } as CSSProperties}>
        <div className="peek__art">
          <Img src={avatarUrl(op.op_id, owned ? op.elite : 0, owned ? op.skin : null)} alt={op.name} />
        </div>
        <div className="peek__rows">
          <div className="peek__row">
            <span className="peek__key">Rarity</span>
            <span className="peek__val" style={{ letterSpacing: 2 }}>
              {"★".repeat(op.rarity)}
            </span>
          </div>
          <div className="peek__row">
            <span className="peek__key">Status</span>
            <span className="peek__val">
              {owned ? (
                <Badge tone="success">Owned</Badge>
              ) : (
                <Badge>Not owned</Badge>
              )}
            </span>
          </div>
          {owned && (
            <>
              <div className="peek__row">
                <span className="peek__key">Progress</span>
                <span className="peek__val num">
                  E{op.elite} · L{op.level}
                  {op.rarity > 2 ? ` · SL${op.skill_level}` : ""}
                </span>
              </div>
              <div className="peek__row">
                <span className="peek__key">Potential</span>
                <span className="peek__val" style={{ display: "flex", gap: 4, alignItems: "center" }}>
                  <Img src={potentialUrl(Math.max(op.potential, 1))} alt="" style={{ width: 18, height: 24 }} />
                  <span className="num">{op.potential}</span>
                </span>
              </div>
            </>
          )}
          <div className="peek__row">
            <span className="peek__key">Branch</span>
            <span className="peek__val">{op.branch.name}</span>
          </div>
          {factions.length > 0 && (
            <div className="peek__row">
              <span className="peek__key">Faction</span>
              <span className="peek__val">{factions.join(" · ")}</span>
            </div>
          )}
          <div className="peek__row">
            <span className="peek__key">Pools</span>
            <span className="peek__val" style={{ display: "flex", gap: 4, flexWrap: "wrap", justifyContent: "flex-end" }}>
              {op.pools.length > 0 ? op.pools.map((pool) => <Badge key={pool}>{pool}</Badge>) : <span>—</span>}
            </span>
          </div>
        </div>
      </div>

      {(op.skillData?.length ?? 0) > 0 && (
        <section>
          <div className="section-head">
            <span className="section-head__title">Skills</span>
          </div>
          <div className="col" style={{ gap: 6 }}>
            {op.skillData?.map((skill, index) => (
              <div key={skill.skillId} className="skill-row" style={{ padding: 10 }}>
                <div className="skill-row__head">
                  <span className="skill-row__icon">
                    <Img src={skillUrl(skill.iconId ?? skill.skillId)} alt="" />
                  </span>
                  <span className="skill-row__name">
                    S{index + 1} · {skill.skillName}
                  </span>
                  <span className="spacer" />
                  {owned && (
                    <span className="pip-row">
                      {[1, 2, 3].map((level) => (
                        <span
                          key={level}
                          className={`pip${(op.masteries[index] ?? 0) >= level ? "" : " pip--empty"}`}
                          title={`Mastery ${level}`}
                        >
                          <Img src={rankUrl(7, level)} alt="" />
                        </span>
                      ))}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {(op.moduleData?.length ?? 0) > 0 && (
        <section>
          <div className="section-head">
            <span className="section-head__title">Modules</span>
          </div>
          <div className="col" style={{ gap: 6 }}>
            {op.moduleData?.map((mod) => (
              <div key={mod.moduleId} className="skill-row" style={{ padding: 10 }}>
                <div className="skill-row__head">
                  <span className="skill-row__icon">
                    <Img src={moduleArtUrl(mod.moduleId)} alt="" />
                  </span>
                  <span className="skill-row__name">
                    {mod.typeName} · {mod.moduleName}
                  </span>
                  <span className="spacer" />
                  {owned && (
                    <span className="pip-row">
                      {[1, 2, 3].map((stage) => (
                        <span
                          key={stage}
                          className={`pip${(op.modules[mod.moduleId] ?? 0) >= stage ? "" : " pip--empty"}`}
                          title={`Stage ${stage}`}
                        >
                          <Img src={moduleStageUrl(stage)} alt="" />
                        </span>
                      ))}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </Dialog>
  );
}
