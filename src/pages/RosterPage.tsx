import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { Page } from "../components/layout/Shell";
import { Icon } from "../components/neu/Icon";
import { Button } from "../components/neu/ui";
import { Select } from "../components/neu/Select";
import { useNavigate } from "react-router-dom";
import { OperatorCard } from "../components/operator/OperatorCard";
import { OperatorPeek } from "../components/operator/OperatorPeek";
import { Chip, Empty, SearchInput, Segmented, Stat } from "../components/neu/ui";
import { CLASS_LIST, RARITY_COLORS } from "../lib/constants";
import { classUrl } from "../lib/images";
import { defaultOperatorObject, isMaxed } from "../lib/operator";
import type { OpInfo } from "../lib/types";
import { useGameData } from "../state/data";
import { useApp } from "../state/store";

type OwnedFilter = "all" | "owned" | "missing";
type SortKey = "rarity" | "level" | "name" | "class";

const toggleInSet = <T,>(set: Set<T>, value: T): Set<T> => {
  const next = new Set(set);
  if (next.has(value)) next.delete(value);
  else next.add(value);
  return next;
};

export function RosterPage() {
  const data = useGameData();
  const { state } = useApp();
  const navigate = useNavigate();

  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query);
  const [classes, setClasses] = useState<Set<string>>(new Set());
  const [rarities, setRarities] = useState<Set<number>>(new Set());
  const [ownedFilter, setOwnedFilter] = useState<OwnedFilter>("all");
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [sort, setSort] = useState<SortKey>("rarity");
  const [selected, setSelected] = useState<string | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  const operators = useMemo<OpInfo[]>(
    () =>
      data.operators.map(
        (opData) => ({ ...opData, ...(state.roster[opData.id] ?? defaultOperatorObject(opData)) }) as OpInfo,
      ),
    [data, state.roster],
  );

  const stats = useMemo(() => {
    let owned = 0;
    let e2 = 0;
    let maxed = 0;
    let sixStar = 0;
    for (const op of operators) {
      if (!op.potential) continue;
      owned += 1;
      if (op.elite === 2) e2 += 1;
      if (op.rarity === 6) sixStar += 1;
      if (isMaxed(op)) maxed += 1;
    }
    return { owned, e2, maxed, sixStar };
  }, [operators]);

  const filtered = useMemo(() => {
    const needle = deferredQuery.trim().toLowerCase();
    const result = operators.filter((op) => {
      if (needle && !op.name.toLowerCase().includes(needle) && !op.cnName.includes(needle)) return false;
      if (classes.size > 0 && !classes.has(op.class)) return false;
      if (rarities.size > 0 && !rarities.has(op.rarity)) return false;
      if (favoritesOnly && !op.favorite) return false;
      if (ownedFilter === "owned" && !op.potential) return false;
      if (ownedFilter === "missing" && op.potential) return false;
      return true;
    });

    result.sort((a, b) => {
      switch (sort) {
        case "name":
          return a.name.localeCompare(b.name);
        case "class":
          return (
            CLASS_LIST.indexOf(a.class as (typeof CLASS_LIST)[number]) -
              CLASS_LIST.indexOf(b.class as (typeof CLASS_LIST)[number]) ||
            b.rarity - a.rarity ||
            a.name.localeCompare(b.name)
          );
        case "level":
          return (
            (b.elite * 1000 + b.level) - (a.elite * 1000 + a.level) ||
            b.rarity - a.rarity ||
            a.name.localeCompare(b.name)
          );
        case "rarity":
        default:
          return b.rarity - a.rarity || a.name.localeCompare(b.name);
      }
    });
    return result;
  }, [operators, deferredQuery, classes, rarities, favoritesOnly, ownedFilter, sort]);

  const filtersActive =
    query.length > 0 || classes.size > 0 || rarities.size > 0 || ownedFilter !== "all" || favoritesOnly;
  const filterCount = classes.size + rarities.size + (ownedFilter !== "all" ? 1 : 0) + (favoritesOnly ? 1 : 0);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "/" || event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      if (target?.closest("input, textarea, select, [contenteditable=true]")) return;
      event.preventDefault();
      searchRef.current?.focus();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const clearFilters = () => {
    setQuery("");
    setClasses(new Set());
    setRarities(new Set());
    setOwnedFilter("all");
    setFavoritesOnly(false);
  };

  return (
    <Page
      title="Roster"
      subtitle="Every operator in the game, with your progress overlaid."
      actions={
        <span className="badge" aria-live="polite">
          <span className="num">{filtered.length}</span> shown
        </span>
      }
    >
      {stats.owned === 0 && (
        <section
          className="neu-card row first-run"
          style={{ gap: 16, flexWrap: "wrap", padding: "18px 22px" }}
        >
          <span className="empty__icon" style={{ width: 46, height: 46, borderRadius: 15 }}>
            <Icon name="sparkles" size={21} />
          </span>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ fontWeight: 600 }}>Your roster is empty</div>
            <p className="hint">
              Nothing is marked as owned yet. Add operators in Input and this page fills in with your
              progress.
            </p>
          </div>
          <Button variant="primary" size="sm" onClick={() => navigate("/input")}>
            Start tracking
          </Button>
        </section>
      )}

      <div className="stat-strip">
        <Stat label="Owned" value={`${stats.owned}`} hint={`of ${operators.length} operators`} />
        <Stat label="Elite 2" value={stats.e2} />
        <Stat label="Maxed" value={stats.maxed} />
        <Stat label="6★ owned" value={stats.sixStar} />
      </div>

      <section className="filters" aria-label="Filters">
        <div className="filters__head">
          <div style={{ flex: 1, minWidth: 0 }}>
            <SearchInput
              value={query}
              onChange={setQuery}
              placeholder="Search operators…"
              inputRef={searchRef}
              shortcut="/"
            />
          </div>
          <button
            type="button"
            className={`neu-btn neu-btn--sm filters__toggle${filtersOpen ? " neu-btn--primary" : ""}`}
            aria-expanded={filtersOpen}
            onClick={() => setFiltersOpen((value) => !value)}
          >
            Filters{filtersOpen && filterCount > 0 ? ` · ${filterCount}` : ""}
          </button>
        </div>
        <div className={`filters__body${filtersOpen ? " is-open" : ""}`}>

        <div className="filters__row">
          <span className="filters__label">Class</span>
          <div className="filters__group">
            {CLASS_LIST.map((className) => (
              <Chip
                key={className}
                pressed={classes.has(className)}
                onClick={() => setClasses((current) => toggleInSet(current, className))}
              >
                <img className="chip-icon" src={classUrl(className)} alt="" />
                {className}
              </Chip>
            ))}
          </div>
        </div>

        <div className="filters__row">
          <span className="filters__label">Rarity</span>
          <div className="filters__group">
            {[6, 5, 4, 3, 2, 1].map((rarity) => (
              <Chip
                key={rarity}
                pressed={rarities.has(rarity)}
                onClick={() => setRarities((current) => toggleInSet(current, rarity))}
              >
                <span style={{ color: RARITY_COLORS[rarity] }}>★</span>
                {rarity}
              </Chip>
            ))}
          </div>
        </div>

        <div className="filters__row">
          <span className="filters__label">Show</span>
          <Segmented<OwnedFilter>
            ariaLabel="Ownership filter"
            value={ownedFilter}
            onChange={setOwnedFilter}
            options={[
              { label: "All", value: "all" },
              { label: "Owned", value: "owned" },
              { label: "Missing", value: "missing" },
            ]}
          />
          <Chip pressed={favoritesOnly} onClick={() => setFavoritesOnly((value) => !value)}>
            ★ Favorites
          </Chip>
          <span className="spacer" />
          <span className="filters__label">Sort</span>
          <Select<SortKey>
            className="roster-sort"
            size="sm"
            ariaLabel="Sort operators"
            value={sort}
            onChange={setSort}
            options={[
              { value: "rarity", label: "Rarity" },
              { value: "level", label: "Progress" },
              { value: "name", label: "Name" },
              { value: "class", label: "Class" },
            ]}
          />
          {filtersActive && (
            <button type="button" className="neu-btn neu-btn--ghost neu-btn--sm" onClick={clearFilters}>
              Reset
            </button>
          )}
        </div>
        </div>
      </section>

      {filtered.length === 0 ? (
        <Empty icon="search" title="No operators match these filters">
          Try a different search term, or reset the filters.
        </Empty>
      ) : (
        <div className="op-grid">
          {filtered.map((op) => (
            <OperatorCard
              key={op.op_id}
              op={op}
              owned={Boolean(op.potential)}
              onSelect={setSelected}
            />
          ))}
        </div>
      )}

      <OperatorPeek opId={selected} onClose={() => setSelected(null)} />
    </Page>
  );
}

export default RosterPage;
