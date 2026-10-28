import { useMemo, useState } from "react";
import { itemUrl } from "../../lib/images";
import type { Depot, Item } from "../../lib/types";
import { Img } from "../common/Img";
import { Button, Empty, SearchInput, Stepper } from "../neu/ui";

interface Props {
  items: Item[];
  depot: Depot;
  onChange: (itemId: string, quantity: number) => void;
  onClear: () => void;
}

export function DepotPanel({ items, depot, onChange, onClear }: Props) {
  const [query, setQuery] = useState("");

  const sorted = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return items
      .filter((item) => !needle || item.name.toLowerCase().includes(needle))
      .sort((a, b) => b.tier - a.tier || a.sortId - b.sortId);
  }, [items, query]);

  const entered = Object.keys(depot).length;

  if (items.length === 0) {
    return <Empty icon="box" title="No material data" />;
  }

  return (
    <div className="col" style={{ gap: 16 }}>
      <section className="neu-card col" style={{ gap: 12 }}>
        <div className="section-head">
          <span className="section-head__title">Depot</span>
          <span className="badge">
            {entered} item{entered === 1 ? "" : "s"} tracked
          </span>
          <div className="section-head__actions">
            <Button size="sm" variant="ghost" onClick={onClear} disabled={entered === 0}>
              Clear all
            </Button>
          </div>
        </div>
        <p className="hint" style={{ marginTop: -4 }}>
          Enter what you have in game. The planner subtracts it from your goals and only shows the shortfall.
        </p>
        <SearchInput value={query} onChange={setQuery} placeholder="Find a material…" />
      </section>

      <div className="depot-grid">
        {sorted.map((item) => (
          <div key={item.id} className="depot-item">
            <span style={{ width: 34, height: 34, flex: "none" }}>
              <Img src={itemUrl(item.iconId)} alt={item.name} fallback={item.name} />
            </span>
            <span className="depot-item__name" title={item.name}>
              {item.name}
            </span>
            <Stepper
              value={depot[item.id] ?? 0}
              onChange={(value) => onChange(item.id, value)}
              min={0}
              max={99999}
              label={item.name}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
