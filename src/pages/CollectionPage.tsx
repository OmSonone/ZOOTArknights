import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Page } from "../components/layout/Shell";
import { Bar, Button, Empty, ProgressRing, Stat } from "../components/neu/ui";
import { CLASS_LIST, RARITY_COLORS } from "../lib/constants";
import { avatarUrl, classUrl } from "../lib/images";
import { defaultOperatorObject } from "../lib/operator";
import type { OpInfo } from "../lib/types";
import { useGameData } from "../state/data";
import { useApp } from "../state/store";
import { Img } from "../components/common/Img";

const DONUT_SIZE = 168;
const DONUT_RADIUS = 62;
const DONUT_STROKE = 16;
const CIRCUMFERENCE = 2 * Math.PI * DONUT_RADIUS;

function RarityDonut({ counts, total }: { counts: Map<number, number>; total: number }) {
  let offset = 0;
  const segments = [6, 5, 4, 3, 2, 1].map((rarity) => {
    const value = counts.get(rarity) ?? 0;
    const length = total > 0 ? (value / total) * CIRCUMFERENCE : 0;
    const segment = { rarity, value, length, offset };
    offset += length;
    return segment;
  });

  return (
    <div className="donut-wrap">
      <svg className="donut" viewBox={`0 0 ${DONUT_SIZE} ${DONUT_SIZE}`} role="img" aria-label="Owned by rarity">
        <circle
          cx={DONUT_SIZE / 2}
          cy={DONUT_SIZE / 2}
          r={DONUT_RADIUS}
          stroke="var(--bg-sunken)"
          strokeWidth={DONUT_STROKE}
        />
        {segments.map((segment) =>
          segment.length > 0 ? (
            <circle
              key={segment.rarity}
              cx={DONUT_SIZE / 2}
              cy={DONUT_SIZE / 2}
              r={DONUT_RADIUS}
              stroke={RARITY_COLORS[segment.rarity]}
              strokeWidth={DONUT_STROKE}
              strokeDasharray={`${Math.max(segment.length - 2, 0)} ${CIRCUMFERENCE}`}
              strokeDashoffset={-segment.offset}
              transform={`rotate(-90 ${DONUT_SIZE / 2} ${DONUT_SIZE / 2})`}
            />
          ) : null,
        )}
        <text x={DONUT_SIZE / 2} y={DONUT_SIZE / 2 + 4} className="donut__center">
          {total}
        </text>
        <text x={DONUT_SIZE / 2} y={DONUT_SIZE / 2 + 20} className="donut__center-label">
          OWNED
        </text>
      </svg>
      <div className="legend">
        {segments.map((segment) => (
          <div key={segment.rarity} className="legend__item">
            <span
              className="legend__dot"
              style={{ background: RARITY_COLORS[segment.rarity], color: RARITY_COLORS[segment.rarity] }}
            />
            <span>{segment.rarity}★</span>
            <span className="num">{segment.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function CollectionPage() {
  const data = useGameData();
  const { state } = useApp();
  const navigate = useNavigate();
  const [showAllSix, setShowAllSix] = useState(false);

  const operators = useMemo<OpInfo[]>(
    () =>
      data.operators.map(
        (opData) => ({ ...opData, ...(state.roster[opData.id] ?? defaultOperatorObject(opData)) }) as OpInfo,
      ),
    [data, state.roster],
  );

  const summary = useMemo(() => {
    const owned = operators.filter((op) => op.potential > 0);
    const byClass = new Map<string, number>();
    const byRarity = new Map<number, number>();
    let e2 = 0;
    let e1 = 0;
    let e0 = 0;
    let sl7 = 0;
    let masteryLevels = 0;
    let m3Skills = 0;
    let moduleStages = 0;
    let favorites = 0;
    let totalLevels = 0;
    let levelSamples = 0;

    for (const op of owned) {
      byClass.set(op.class, (byClass.get(op.class) ?? 0) + 1);
      byRarity.set(op.rarity, (byRarity.get(op.rarity) ?? 0) + 1);
      if (op.elite === 2) e2 += 1;
      else if (op.elite === 1) e1 += 1;
      else e0 += 1;
      if (op.skill_level === 7) sl7 += 1;
      for (const mastery of op.masteries) {
        if (mastery > 0) masteryLevels += mastery;
        if (mastery === 3) m3Skills += 1;
      }
      for (const level of Object.values(op.modules)) {
        if (level > 0) moduleStages += level;
      }
      if (op.favorite) favorites += 1;
      if (op.elite === 2) {
        totalLevels += op.level;
        levelSamples += 1;
      }
    }

    const missingSix = operators.filter((op) => op.rarity === 6 && !op.potential);

    return {
      owned,
      byClass,
      byRarity,
      e2,
      e1,
      e0,
      sl7,
      masteryLevels,
      m3Skills,
      moduleStages,
      favorites,
      averageE2Level: levelSamples ? Math.round(totalLevels / levelSamples) : 0,
      missingSix,
      total: operators.length,
    };
  }, [operators]);

  const ownedRatio = summary.total > 0 ? summary.owned.length / summary.total : 0;

  if (summary.owned.length === 0) {
    return (
      <Page title="Collection" subtitle="What you actually own, at a glance.">
        <Empty icon="box" title="Your collection is empty">
          Mark operators as owned in the Input page and your collection summary will appear here.
          <div style={{ marginTop: 16 }}>
            <Button variant="primary" onClick={() => navigate("/input")}>
              Open Input
            </Button>
          </div>
        </Empty>
      </Page>
    );
  }

  return (
    <Page title="Collection" subtitle="What you actually own, at a glance.">
      <div className="page-grid page-grid--split">
        <section className="neu-card col" style={{ gap: 18 }}>
          <div className="section-head">
            <span className="section-head__title">Coverage</span>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 22, alignItems: "center" }}>
            <ProgressRing
              value={ownedRatio}
              size={132}
              stroke={11}
              label={ownedRatio > 0 && ownedRatio < 0.01 ? "<1%" : `${Math.round(ownedRatio * 100)}%`}
              sublabel={`${summary.owned.length}/${summary.total}`}
            />
            <div className="col" style={{ flex: 1, minWidth: 190, gap: 12 }}>
              <div className="col" style={{ gap: 6 }}>
                <div className="row" style={{ justifyContent: "space-between" }}>
                  <span className="hint">Elite 2</span>
                  <span className="num">{summary.e2}</span>
                </div>
                <Bar value={summary.owned.length ? summary.e2 / summary.owned.length : 0} label="Elite 2 share" />
              </div>
              <div className="col" style={{ gap: 6 }}>
                <div className="row" style={{ justifyContent: "space-between" }}>
                  <span className="hint">Skill Level 7</span>
                  <span className="num">{summary.sl7}</span>
                </div>
                <Bar value={summary.owned.length ? summary.sl7 / summary.owned.length : 0} label="SL7 share" />
              </div>
              <div className="row" style={{ gap: 16, flexWrap: "wrap" }}>
                <span className="hint">
                  E1 <span className="num">{summary.e1}</span>
                </span>
                <span className="hint">
                  E0 <span className="num">{summary.e0}</span>
                </span>
                <span className="hint">
                  Avg E2 level <span className="num">{summary.averageE2Level}</span>
                </span>
              </div>
            </div>
          </div>

          <hr className="neu-divider" />

          <div className="section-head">
            <span className="section-head__title">By class</span>
            <span className="hint" style={{ marginLeft: "auto" }}>
              owned / total
            </span>
          </div>
          <div className="dist">
            {CLASS_LIST.map((className) => {
              const owned = summary.byClass.get(className) ?? 0;
              const total = operators.filter((op) => op.class === className).length;
              return (
                <div key={className} className="dist__row">
                  <span className="dist__label">
                    <img className="chip-icon" src={classUrl(className)} alt="" />
                    <span>{className}</span>
                  </span>
                  <Bar value={total ? owned / total : 0} label={`${className} coverage`} />
                  <span className="dist__value">
                    {owned}
                    <span className="faint">/{total}</span>
                  </span>
                </div>
              );
            })}
          </div>
        </section>

        <div className="col" style={{ gap: 16 }}>
          <section className="neu-card col" style={{ gap: 14 }}>
            <div className="section-head">
              <span className="section-head__title">Rarity mix</span>
            </div>
            <RarityDonut counts={summary.byRarity} total={summary.owned.length} />
          </section>

          <section className="neu-card col" style={{ gap: 16 }}>
            <div className="section-head">
              <span className="section-head__title">Investment</span>
            </div>
            <div className="collection-stats">
              <Stat label="Mastery levels" value={summary.masteryLevels} />
              <Stat label="M3 skills" value={summary.m3Skills} />
              <Stat label="Module stages" value={summary.moduleStages} />
              <Stat label="Favorites" value={summary.favorites} />
            </div>
          </section>
        </div>
      </div>

      {summary.missingSix.length > 0 && (
        <section className="neu-card col" style={{ gap: 14 }}>
          <div className="section-head">
            <span className="section-head__title">Missing 6★</span>
            <span className="badge">{summary.missingSix.length}</span>
            {summary.missingSix.length > 24 && (
              <div className="section-head__actions">
                <Button size="sm" variant="ghost" onClick={() => setShowAllSix((value) => !value)}>
                  {showAllSix ? "Show less" : `Show all ${summary.missingSix.length}`}
                </Button>
              </div>
            )}
          </div>
          <div className="row row--wrap" style={{ gap: 10 }}>
            {(showAllSix ? summary.missingSix : summary.missingSix.slice(0, 24)).map((op) => (
              <button
                key={op.op_id}
                type="button"
                className="neu-chip"
                style={{ paddingLeft: 4, gap: 8 }}
                onClick={() => navigate(`/input?op=${op.op_id}`)}
                title={`Edit ${op.name}`}
              >
                <span
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: 8,
                    overflow: "hidden",
                    display: "block",
                    boxShadow: "var(--shadow-inset-sm)",
                  }}
                >
                  <Img src={avatarUrl(op.op_id, 0)} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                </span>
                {op.name}
              </button>
            ))}
          </div>
        </section>
      )}
    </Page>
  );
}
