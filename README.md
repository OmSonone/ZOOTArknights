# ZOOT

**ZOOT — Zeroth Order Oil Tank** — a local-first **Arknights** roster, collection and
material planner with a soft neumorphic UI. Built with React 19 + Vite.

The name is a nod to Closure's replacement for PRTS.

Your save lives in the browser (`localStorage`) and can be exported to JSON at any
time. There is no account, no telemetry and no hosted backend. A tiny local server
exists only to proxy the optional game-account import, because the game APIs block
browser CORS.

> **Krooster provenance:** the game data, cost tables, operator rules, level-cost maths,
> goal-expansion semantics, Yostar login flow and depot-OCR approach are copied/ported
> from [ak-roster (Krooster)](https://github.com/neeia/ak-roster), which is 0BSD.
> The UI, state store, save format, goal model adaptation and local import server are
> original. Full breakdown: **[NOTICE.md](NOTICE.md)**.

For AI agents working on this repo, read **[AGENTS.md](AGENTS.md)** first.

## Features

| Route | What it does |
| --- | --- |
| `/` | **Roster** — all 434 operators with your progress, class/rarity/ownership filters, favourites, `/` search shortcut. |
| `/collection` | **Collection** — owned-only stats: coverage, rarity donut, class spread, mastery/module investment, missing 6★ list. |
| `/planner` | **Planner** — target-state goals (E2 L90 + per-skill masteries + modules), aggregated materials, depot stock, crafting breakdown, farm list. |
| `/input` | **Input** — per-operator editor (promotion, level, skill level, each mastery, each module, potential, skins) plus JSON save export/import. |
| `/import` | **Import** — sync from a Yostar account (EN/JP/KR) and read depot counts from screenshots. |
| `/profile` | **Profile** — local doctor card: name, UID, server, level, onboard date, assistant, three support slots. |

Other niceties: light/dark themes (OS default, switch in the sidebar or mobile top bar),
searchable dropdowns with keyboard navigation and a mobile bottom sheet, reduced-motion
support, image fallbacks, and a fully responsive layout from 320 px up.

## Quick start

```bash
npm install
npm run dev        # http://localhost:5173  (app + import API)
npm run build      # production build in dist/
npm run preview    # preview the build (app + import API)
npm start          # production local server on http://127.0.0.1:4173
```

Open **Input**, mark operators you own, then use **Planner** to plan targets.

## How planning works

A goal is a **target state**, not a single action — the same concept as Krooster's
`GoalData`:

```ts
{
  elite: 2,            // target promotion
  level: 90,           // target level in that promotion
  skillLevel: 7,
  masteries: { "0": 3, "1": 1 },   // per skill, independent
  modules: { uniequip_002_svrash: 3 }
}
```

The planner expands one goal into the rows you need to farm:

| Row | Contents |
| --- | --- |
| Elite 1 / Elite 2 | promotion materials + promotion LMD |
| Level 1→50 (E0), 1→80 (E1), 1→90 (E2) | EXP + leveling LMD, one row per promotion |
| Skill Level 1→7 | skill upgrade materials |
| S1 · … / S2 · … | each mastery is an independent row |
| LOR-X · … | each module stage is an independent row |

Level caps follow the target promotion and rarity, exactly like the game/Krooster:

| Rarity | E0 | E1 | E2 |
| --- | --- | --- | --- |
| 6★ | 50 | 80 | 90 |
| 5★ | 50 | 70 | 80 |
| 4★ | 45 | 60 | 70 |
| 3★ | 40 | 55 | 55 |
| 1–2★ | 30 | — | — |

Requirements enforced by the editor (and warned about for imported/legacy goals):

- Masteries need **E2 + Skill Level 7**.
- Modules need **E2** and level **40 / 50 / 60** for 4★ / 5★ / 6★.
- Skill level above 4 needs **E1**.
- 3★ operators have no mastery controls.

Material costs are aggregated across open goals, optionally expanded through workshop
recipes (“craft from lower tiers”), then compared with your depot. Chips are treated as
farmable leaves because the chip recipe graph is cyclic. `totalLmd` includes crafting
fees; promotion LMD is counted once (in the Elite rows, not in level rows).

Reference numbers for a 6★ E0L1 → E2L90: **1,111,400 EXP**, **1,124,796 leveling LMD**
+ **210,000 promotion LMD**.

## Import from the game

Import is optional, unofficial and only works while the app is served by the local
server (`dev`, `preview` or `start`). Credentials travel only between `localhost` and the
official Yostar/game endpoints.

**Yostar (EN / JP / KR)**

1. Enter the email bound to Arknights in game (User Center → Bind Email) and request a
   code. Google/Apple sign-ins are not bound emails.
2. Enter the code. The local server performs the game login chain:
   `yostar/send-code → yostar/get-auth → user/login → u8/user/v1/getToken →
   account/login → account/syncData`.
3. The response is mapped into the save: operators, promotions, levels, skills,
   per-skill masteries, modules, skins, potentials (optionally from tokens), profile,
   supports, depot and LMD.

Logging in through Yostar **signs the game client out**. If "save credentials" is ticked,
the token is stored under `zoot.import-token.v1`; **Forget** removes it.
Imports of a level-1 account are rejected (that usually means the email was not bound to
the main account).

**Depot screenshots**

Full-screen depot screenshots are processed **locally on the server** by
[Arkntools depot-recognition](https://github.com/arkntools/depot-recognition). The model
data (a few MB) is downloaded once and cached in `server/.cache` (gitignored). Nothing
is uploaded anywhere. Recognized counts are shown for review before applying.

**Local API**

| Endpoint | Purpose |
| --- | --- |
| `POST /api/import/mail` | ask Yostar to email a code |
| `POST /api/import/data` | email+code login, or reuse a saved token |
| `POST /api/import/depot` | OCR depot screenshots |
| `GET /api/import/health` | server/OCR availability |

`npm start` binds to `127.0.0.1` by default so these endpoints are not exposed to the
LAN (`HOST`/`PORT` can override). A static-only deployment still runs everything except
import.

## Data and provenance

`public/data/{operators,items,skins,factions}.json` are the generated files from
ak-roster (434 operators, 98 items). They are produced upstream from:

- [Kengxxiao/ArknightsGameData](https://github.com/Kengxxiao/ArknightsGameData)
- [ArknightsAssets/ArknightsGamedata](https://github.com/ArknightsAssets/ArknightsGamedata)

Refresh after a new banner:

```bash
npm run update-data   # shallow-clones ak-roster and copies the four JSON files
```

Art (avatars, item/skill/module icons, rank badges) is hotlinked from Krooster's CDN at
runtime, so images need internet. Missing art falls back to a placeholder tile.

### Relationship to Krooster

This project exists because Krooster's data model is excellent but its UI is heavy. The
following are **copied or ported from ak-roster (0BSD)**:

- generated game data (verbatim) and the cost tables (`MAX_LEVEL_BY_RARITY`,
  `COST_BY_RARITY`, `MODULE_REQ_BY_RARITY`, …);
- operator mutation rules (`defaultOperatorObject`, promotion/level/skill/mastery/module
  changes and clamping);
- `levelingCost` and the goal-expansion semantics (per promotion, per skill, per module);
- crafting/depot/battle-record calculation approaches;
- the Yostar auth chain and import field mapping;
- the depot OCR approach (same library).

**Original to ZOOT:** the neumorphic design system and all UI, the React state store and
save schema/migration, the target-state goal adaptation, the local import server and
Vite integration, and all page composition.

**Not ported:** Supabase/accounts, network lookup, recruitment/gacha calculators,
presets, CN/Skland import, TW/Bilibili auth.

See **[NOTICE.md](NOTICE.md)** for the file-by-file table and the full 0BSD license text.

## Project layout

```
public/data/          generated game data (fetched at runtime, not bundled)
src/lib/              types, data loading, image URLs, operator rules, planner maths,
                      storage/migration, import mapping
src/state/            reducer store, game-data provider, theme, toasts
src/components/       layout shell, neumorphic primitives, operator/planner widgets
src/pages/            Roster, Collection, Planner, Input, Import, Profile
src/styles/           tokens, base, neu primitives, layout, pages, motion
server/               Yostar login chain, depot OCR, import API, production server
scripts/update-data.mjs
```

## Save file

Everything lives under `zoot.state.v1` (plus `zoot.theme`). Saves made before the rename
are migrated automatically from the old `arknights-adda.*` keys on first load.

```json
{
  "version": 1,
  "roster": { "char_172_svrash": { "op_id": "char_172_svrash", "favorite": true,
    "potential": 6, "elite": 2, "level": 90, "skill_level": 7,
    "masteries": [3, 3, 3], "modules": { "uniequip_002_svrash": 3 }, "skin": null } },
  "goals": [{ "id": "…", "opId": "char_172_svrash", "order": 1,
    "elite": 2, "level": 90, "skillLevel": 7,
    "masteries": { "0": 3 }, "modules": { "uniequip_002_svrash": 3 } }],
  "depot": { "30012": 42, "4001": 1200000 },
  "profile": { "name": "", "uid": "", "server": "EN", "level": 1, "onboard": "",
    "assistant": null, "supports": [null, null, null] },
  "plannerSettings": { "includeCrafting": true, "ignoreLmd": false,
    "showBattleRecords": true }
}
```

**Input → Export** downloads `zoot-save-YYYY-MM-DD.json`; the Import dialog on that page
accepts the file (or pasted JSON) and replaces the save. Legacy per-category goals are
migrated automatically on load.

## Verification

```bash
npm run typecheck
npm run build
```

The planner maths were checked against the ak-roster reference for every skill-level range
(8,757), every mastery range (5,736), every module stage range (3,018) and a combined
“all masteries M3 + all modules stage 3” goal per operator (417); all matched.
Promotion/level totals were cross-checked per promotion and for full targets including
mid-promotion starts, e.g. 6★ E0L1→E2L90 = 1,111,400 EXP / 1,334,796 total LMD
(1,124,796 leveling + 210,000 promotion), 5★ E0L1→E2L80 = 734,400 / 819,325,
4★ E0L1→E2L70 = 484,000 / 482,003, 3★ E0L1→E1L55 = 115,400 / 104,040.
Sanity is not modelled — upgrades cost EXP/LMD/materials, and the bundled data has no
stage drop or sanity rates (matching krooster). Browser checks
covered promotion caps, independent masteries, goal expansion, totals, edit round-trips,
save reload/migration, 3★ mastery rules, skin gating, OCR apply, import flow (with mocked
endpoints), and both themes at desktop/mobile sizes.

## Limitations

- The planner is intentionally simpler than Krooster: no groups, presets, events,
  recruitment or gacha tools.
- Import supports EN/JP/KR only; CN/Skland is not implemented.
- Game data is a snapshot — run `npm run update-data` for new operators/events.
- Art needs internet; the import API needs the local server.
- Unofficial project, not endorsed by Hypergryph/Yostar; use import at your own risk.

## Attribution

Game data generated by [ak-roster](https://github.com/neeia/ak-roster) (0BSD). Arknights
and its assets belong to Hypergryph and Studio Montagne. This project is unaffiliated
with and not endorsed by them. See **[NOTICE.md](NOTICE.md)**.
