# NOTICE — attribution

ZOOT (Zeroth Order Oil Tank) is a local-first Arknights planner. It is unaffiliated with
Hypergryph, Studio Montagne, Yostar or the Krooster project.

ZOOT is inspired by and incorporates work from
[ak-roster (Krooster)](https://github.com/neeia/ak-roster), which is released
under the **BSD Zero Clause License (0BSD)**.

## What is based on ak-roster

| Area               | Description                                                                                                                               |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------- |
| Game data          | Generated JSON files for operators, items, skins and factions (`public/data/*.json`).                                                     |
| Cost tables        | Level, EXP, LMD and rarity tables (`src/lib/costTables.ts`).                                                                              |
| Operator rules     | Promotion, level, skill, mastery, module clamping and gating (`src/lib/operator.ts`).                                                     |
| Planner algorithms | Level-cost calculation, goal expansion, material aggregation, crafting expansion, EXP-to-battle-record conversion (`src/lib/planner.ts`). |
| Yostar login chain | EN/JP/KR authentication flow for game-account import (`server/yostar.mjs`).                                                               |
| Import mapping     | Mapping game account data into the save model (`src/lib/gameImport.ts`).                                                                  |
| Depot OCR          | Uses the same library (`@arkntools/depot-recognition`), adapted for server-side use (`server/depotOcr.mjs`).                              |

## What is original to ZOOT

- The entire neumorphic UI, design tokens, layout, motion layer and components
  (`src/components/neu/*`, `src/styles/*`).
- The React state store, save schema/versioning/migration and JSON export/import
  (`src/state/store.tsx`, `src/lib/storage.ts`).
- The target-state goal model and its task expansion (`goalView`, `buildMaterialPlan`),
  including the no-double-count promotion LMD handling.
- Per-item crafting controls and craft-one depot mutations.
- Cloud sync (Supabase, Google/Discord login).
- The local import API, Vite middleware, production server and browser-side import flow.
- Roster, Collection, Profile and planner page composition.

## Upstream game data

The generated JSON files originate from:

- [Kengxxiao/ArknightsGameData](https://github.com/Kengxxiao/ArknightsGameData)
- [ArknightsAssets/ArknightsGamedata](https://github.com/ArknightsAssets/ArknightsGamedata)

Operator and item art is loaded from a CDN at runtime. The art belongs to the game's
rights holders.

## License of incorporated material

ak-roster is licensed under the **BSD Zero Clause License (0BSD)**:

```
BSD Zero Clause License

Copyright (c) 2023

Permission to use, copy, modify, and/or distribute this software for any
purpose with or without fee is hereby granted.

THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH
REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY
AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT,
INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM
LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR
OTHER TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR
PERFORMANCE OF THIS SOFTWARE.
```

0BSD does not require attribution, but it is provided here voluntarily. If you
redistribute ZOOT, please keep this notice.

## Trademarks and assets

Arknights and all related names, characters, images, audio and data are the property of
Hypergryph and Studio Montagne. This project is a personal, non-commercial fan tool and
is not endorsed by or affiliated with them. Game-account import is unofficial and used
at your own risk.
