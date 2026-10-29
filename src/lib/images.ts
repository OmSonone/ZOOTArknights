import { CDN_BASE } from "./constants";

/** Encode the characters that appear in Arknights asset ids and break URLs. */
const enc = (value: string): string =>
  value
    .replace(/#/g, "%23")
    .replace(/\+/g, "%2B")
    .replace(/\[/g, "%5B")
    .replace(/\]/g, "%5D")
    .replace(/ /g, "%20")
    .replace(/'/g, "%27");

const url = (path: string): string => `${CDN_BASE}/${path}`;

/**
 * Operator avatar. E2 uses the `_2` art; Amiya is the only operator whose E1 art
 * has its own `_1` file. Skins store their `avatarId` in the save file.
 */
export const avatarUrl = (opId: string, elite = 0, skinAvatarId?: string | null): string => {
  if (skinAvatarId) return url(`avatars/${enc(skinAvatarId)}.webp`);
  let id = opId;
  if (elite >= 2) id += "_2";
  else if (elite === 1 && opId === "char_002_amiya") id += "_1";
  return url(`avatars/${enc(id)}.webp`);
};

export const itemUrl = (iconId: string): string => url(`items/${enc(iconId)}.webp`);

export const skillUrl = (iconId: string): string => url(`skills/${enc(iconId.replace("#", "_"))}.webp`);

export const moduleUrl = (moduleId: string, typeName?: string): string =>
  url(`equip/${enc((typeName ?? moduleId).toLowerCase())}.webp`);

export const moduleArtUrl = (moduleId: string): string => url(`equip/${enc(moduleId)}.webp`);

export const moduleStageUrl = (stage: number): string => url(`equip/img_stg${Math.min(Math.max(stage, 1), 3)}.webp`);

export const rankBgUrl = (): string => url("rank/bg.webp");

/** rank icon: skill levels 1-7, or `m-1..m-3` for masteries */
export const rankUrl = (skillLevel: number, mastery = 0): string =>
  url(`rank/${mastery > 0 ? `m-${mastery}` : Math.min(Math.max(skillLevel, 1), 7)}.webp`);

export const eliteUrl = (elite: number): string => url(`elite/${elite}_s_box.webp`);

export const potentialUrl = (potential: number): string => url(`potential/${Math.min(Math.max(potential, 1), 6)}.webp`);

export const classUrl = (className: string): string => url(`classes/class_${enc(className.toLowerCase())}.webp`);

export const branchUrl = (branchId: string): string => url(`subclass/sub_${enc(branchId)}_icon.webp`);

export const skinAvatarUrl = (avatarId: string): string => url(`avatars/${enc(avatarId)}.webp`);
