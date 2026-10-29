# ZOOT

**ZOOT — Zeroth Order Oil Tank** — a local-first **Arknights** roster, collection and
material planner with a soft neumorphic UI. Built with React 19 + Vite.

The name is a nod to Closure's replacement for PRTS.

Your save lives in the browser (`localStorage`) and can be exported to JSON at any
time. Optional cloud sync (Google/Discord login via Supabase) keeps your save across
devices. A tiny local server exists only to proxy the optional game-account import,
because the game APIs block browser CORS.

For AI agents working on this repo, read **[AGENTS.md](AGENTS.md)** first.

## Features

| Route         | What it does                                                                                                                                |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `/`           | **Roster** — all 434 operators with your progress, class/rarity/ownership filters, favourites, `/` search shortcut.                         |
| `/collection` | **Collection** — owned-only stats: coverage, rarity donut, class spread, mastery/module investment, missing 6★ list.                        |
| `/planner`    | **Planner** — target-state goals (E2 L90 + per-skill masteries + modules), aggregated materials, per-item crafting, depot stock, farm list. |
| `/input`      | **Input** — per-operator editor (promotion, level, skill level, each mastery, each module, potential, skins) plus JSON save export/import.  |
| `/import`     | **Import** — sync from a Yostar account (EN/JP/KR) and read depot counts from screenshots.                                                  |
| `/profile`    | **Profile** — doctor card: name, UID, server, level, onboard date, assistant, three support slots, cloud save.                              |

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

A goal is a **target state**, not a single action:

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

| Row                                   | Contents                                  |
| ------------------------------------- | ----------------------------------------- |
| Elite 1 / Elite 2                     | promotion materials + promotion LMD       |
| Level 1→50 (E0), 1→80 (E1), 1→90 (E2) | EXP + leveling LMD, one row per promotion |
| Skill Level 1→7                       | skill upgrade materials                   |
| S1 · … / S2 · …                       | each mastery is an independent row        |
| LOR-X · …                             | each module stage is an independent row   |

Level caps follow the target promotion and rarity, matching the game:

| Rarity | E0  | E1  | E2  |
| ------ | --- | --- | --- |
| 6★     | 50  | 80  | 90  |
| 5★     | 50  | 70  | 80  |
| 4★     | 45  | 60  | 70  |
| 3★     | 40  | 55  | 55  |
| 1–2★   | 30  | —   | —   |

Requirements enforced by the editor (and warned about for imported/legacy goals):

- Masteries need **E2 + Skill Level 7**.
- Modules need **E2** and level **40 / 50 / 60** for 4★ / 5★ / 6★.
- Skill level above 4 needs **E1**.
- 3★ operators have no mastery controls.

Material costs are aggregated across open goals, optionally expanded through workshop
recipes (per-item crafting toggles or global auto/all), then compared with your depot.
Chips are treated as farmable leaves because the chip recipe graph is cyclic. `totalLmd`
includes crafting fees; promotion LMD is counted once (in the Elite rows, not in level rows).

Reference numbers for a 6★ E0L1 → E2L90: **1,111,400 EXP**, **1,124,796 leveling LMD**

- **210,000 promotion LMD**.

## Optional cloud save (Supabase)

Off by default. To keep your save across browsers/devices:

1. Create a Supabase project and run `supabase/schema.sql` in the SQL editor.
2. Enable the **Discord** and/or **Google** providers (Authentication → Providers) and add
   your app URL (e.g. `http://localhost:5173`) to the redirect URLs.
3. Copy `.env.example` to `.env.local`, fill in the project URL and anon key, restart `npm run dev`.
4. Sign in from **Profile → Cloud save**. The first sign-in uploads your local save; if both sides
   differ you choose which to keep.

## Deploy (Render, free tier)

`render.yaml` runs `npm start` on one service that serves the site and the import API
(`HOST=0.0.0.0`, port from Render).

1. Render dashboard → **New → Blueprint** → pick this repo.
2. Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` when prompted (optional).
3. Add `https://<service>.onrender.com/**` to Supabase **Redirect URLs** (and Site URL).

Notes: the free tier sleeps when idle (slow first load) and has limited RAM, so depot OCR
may be slow. The import API is public once deployed; it stores nothing and only talks to the
official Yostar hosts.

## Import from the game

Import is optional, unofficial and only works while the app is served by the local
server (`dev`, `preview` or `start`). Credentials travel only between your device and the
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

| Endpoint                 | Purpose                                  |
| ------------------------ | ---------------------------------------- |
| `POST /api/import/mail`  | ask Yostar to email a code               |
| `POST /api/import/data`  | email+code login, or reuse a saved token |
| `POST /api/import/depot` | OCR depot screenshots                    |
| `GET /api/import/health` | server/OCR availability                  |

`npm start` binds to `127.0.0.1` by default so these endpoints are not exposed to the
LAN (`HOST`/`PORT` can override). A static-only deployment still runs everything except
import.

## Data

`public/data/{operators,items,skins,factions}.json` are generated game-data files
(434 operators, 98 items). They are produced upstream from:

- [Kengxxiao/ArknightsGameData](https://github.com/Kengxxiao/ArknightsGameData)
- [ArknightsAssets/ArknightsGamedata](https://github.com/ArknightsAssets/ArknightsGamedata)

Refresh after a new banner:

```bash
npm run update-data   # fetches the latest game data JSON files
```

Art (avatars, item/skill/module icons, rank badges) is loaded from a CDN at
runtime, so images need internet. Missing art falls back to a placeholder tile.

## Project layout

```
public/data/          generated game data (fetched at runtime, not bundled)
src/lib/              types, data loading, image URLs, operator rules, planner maths,
                      storage/migration, import mapping
src/state/            reducer store, game-data provider, theme, toasts, cloud sync
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
  "roster": {
    "char_172_svrash": {
      "op_id": "char_172_svrash",
      "favorite": true,
      "potential": 6,
      "elite": 2,
      "level": 90,
      "skill_level": 7,
      "masteries": [3, 3, 3],
      "modules": { "uniequip_002_svrash": 3 },
      "skin": null
    }
  },
  "goals": [
    {
      "id": "…",
      "opId": "char_172_svrash",
      "order": 1,
      "elite": 2,
      "level": 90,
      "skillLevel": 7,
      "masteries": { "0": 3 },
      "modules": { "uniequip_002_svrash": 3 }
    }
  ],
  "depot": { "30012": 42, "4001": 1200000 },
  "profile": {
    "name": "",
    "uid": "",
    "server": "EN",
    "level": 1,
    "onboard": "",
    "assistant": null,
    "supports": [null, null, null]
  },
  "plannerSettings": { "includeCrafting": true, "ignoreLmd": false, "showBattleRecords": true, "craftingItems": [] }
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

The planner maths were verified against a reference implementation for every skill-level
range (8,757), every mastery range (5,736), every module stage range (3,018) and a
combined "all masteries M3 + all modules stage 3" goal per operator (417); all matched.
Promotion/level totals were cross-checked per promotion and for full targets including
mid-promotion starts, e.g. 6★ E0L1→E2L90 = 1,111,400 EXP / 1,334,796 total LMD
(1,124,796 leveling + 210,000 promotion), 5★ E0L1→E2L80 = 734,400 / 819,325,
4★ E0L1→E2L70 = 484,000 / 482,003, 3★ E0L1→E1L55 = 115,400 / 104,040.
Sanity is not modelled — upgrades cost EXP/LMD/materials, and the bundled data has no
stage drop or sanity rates. Browser checks covered promotion caps, independent masteries,
goal expansion, totals, edit round-trips, save reload/migration, 3★ mastery rules, skin
gating, OCR apply, import flow (with mocked endpoints), and both themes at desktop/mobile
sizes.

## Limitations

- No groups, presets, events, recruitment or gacha tools.
- Import supports EN/JP/KR only; CN/Skland is not implemented.
- Game data is a snapshot — run `npm run update-data` for new operators/events.
- Art needs internet; the import API needs the local server.
- Unofficial project, not endorsed by Hypergryph/Yostar; use import at your own risk.

## Acknowledgments

- Inspired by [Krooster](https://krooster.com) ([ak-roster](https://github.com/neeia/ak-roster), 0BSD).
  Game data, cost tables, and planner algorithms are based on ak-roster's work.
- Game data sourced from [Kengxxiao/ArknightsGameData](https://github.com/Kengxxiao/ArknightsGameData)
  and [ArknightsAssets](https://github.com/ArknightsAssets/ArknightsGamedata).
- Arknights and its assets belong to Hypergryph and Studio Montagne. This project is
  unaffiliated with and not endorsed by them.
- See **[NOTICE.md](NOTICE.md)** for full attribution and license details.
