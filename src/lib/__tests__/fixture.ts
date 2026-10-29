import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { FactionData, GameData, Item, OperatorData, Skin } from "../types";

const root = resolve(import.meta.dirname, "../../../public/data");

function load<T>(name: string): T {
  return JSON.parse(readFileSync(resolve(root, `${name}.json`), "utf-8")) as T;
}

let cached: GameData | null = null;

export function gameData(): GameData {
  if (cached) return cached;
  const operators = load<Record<string, OperatorData>>("operators");
  const items = load<Record<string, Item>>("items");
  const skins = load<Record<string, Skin[]>>("skins");
  const factions = load<Record<string, FactionData>>("factions");
  cached = {
    operators: Object.values(operators),
    operatorMap: operators,
    items: Object.values(items),
    itemMap: items,
    skins,
    factions,
  };
  return cached;
}
