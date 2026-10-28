import type { FactionData, GameData, Item, OperatorData, Skin } from "./types";

const DATA_BASE = `${import.meta.env.BASE_URL}data`;

let cache: Promise<GameData> | null = null;

async function fetchJson<T>(name: string): Promise<T> {
  const response = await fetch(`${DATA_BASE}/${name}.json`, { cache: "force-cache" });
  if (!response.ok) {
    throw new Error(`Could not load data/${name}.json (HTTP ${response.status})`);
  }
  return (await response.json()) as T;
}

/**
 * Loads the four generated game-data files once per session and keeps them in memory.
 * The JSON lives in `public/data` so it never inflates the JS bundle.
 */
export function loadGameData(): Promise<GameData> {
  cache ??= (async () => {
    const [operators, items, skins, factions] = await Promise.all([
      fetchJson<Record<string, OperatorData>>("operators"),
      fetchJson<Record<string, Item>>("items"),
      fetchJson<Record<string, Skin[]>>("skins"),
      fetchJson<Record<string, FactionData>>("factions"),
    ]);

    const operatorList = Object.values(operators);
    const itemList = Object.values(items);

    return {
      operators: operatorList,
      operatorMap: operators,
      items: itemList,
      itemMap: items,
      skins,
      factions,
    };
  })();

  return cache;
}

export function getOperator(data: GameData, opId: string): OperatorData | undefined {
  return data.operatorMap[opId];
}

export function getItem(data: GameData, itemId: string): Item | undefined {
  return data.itemMap[itemId];
}
