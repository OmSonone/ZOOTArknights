import { useGameData } from "../../state/data";
import { itemUrl } from "../../lib/images";
import { Img } from "../common/Img";
import type { Ingredient } from "../../lib/types";

interface ItemIconProps {
  id: string;
  size?: number;
  alt?: string;
}

export function ItemIcon({ id, size = 32, alt }: ItemIconProps) {
  const data = useGameData();
  const item = data.itemMap[id];
  return (
    <span style={{ width: size, height: size, display: "block", flex: "none" }}>
      <Img src={item ? itemUrl(item.iconId) : undefined} alt={alt ?? item?.name ?? id} fallback={item?.name ?? id} />
    </span>
  );
}

export function ItemChip({ ingredient }: { ingredient: Ingredient }) {
  const data = useGameData();
  const item = data.itemMap[ingredient.id];
  return (
    <span className="mini-mat" title={`${item?.name ?? ingredient.id} ×${ingredient.quantity}`}>
      <span style={{ width: 18, height: 18, display: "block", flex: "none" }}>
        <Img src={item ? itemUrl(item.iconId) : undefined} alt="" fallback={item?.name ?? "?"} />
      </span>
      {ingredient.quantity >= 1000 ? ingredient.quantity.toLocaleString("en-US") : ingredient.quantity}
    </span>
  );
}
