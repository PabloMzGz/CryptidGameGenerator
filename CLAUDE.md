# CLAUDE.md — Cryptid Game Generator (Client-Side Fork)

## Project Overview

This is a client-side fork of the **Cryptid board game companion website**. The original site (https://osprey.halfhyde.com/) generates game scenarios (maps + clues) for the Cryptid deduction board game (3–5 players). It relied on a PHP backend (`getGame.php`) to serve pre-generated game data. This fork eliminates the server dependency entirely — all game generation happens in JavaScript in the browser. It is hosted as a static site via **GitHub Pages**.

### What Cryptid Is (Game Context)

Cryptid is a deduction board game where each player receives a secret clue about the creature's habitat location on a hex-grid map. Players deduce other players' clues to find the single hex that satisfies ALL clues simultaneously. The companion website:
- Generates valid game setups (map layout + structure placement + clue assignments + habitat location)
- Shows clues to players one at a time (pass-the-device model)
- Displays the hex map on a canvas
- Reveals the habitat and all clues at game end

## Repository Structure

```
cryptid/
├── CLAUDE.md                  # This file
├── index.html                 # Main HTML (single-page app)
├── css/
│   └── cryptid.css            # Main stylesheet (already readable)
├── js/
│   ├── app.js                 # Main application entry point & orchestration
│   ├── game.js                # Game state machine (clue display, reminders, reveal flow)
│   ├── gameStore.js           # Game store — manages available games, replaces server fetch
│   ├── gameGenerator.js       # **NEW** — client-side game generation engine
│   ├── mapRenderer.js         # Canvas-based hex map drawing
│   ├── mapData.js             # Tile image paths, hex geometry constants, structure image paths
│   ├── settings.js            # User settings (localStorage wrapper, event listeners)
│   ├── sound.js               # Audio manager (BGM, SFX, clue sounds)
│   ├── tutorial.js            # Tutorial step controller
│   ├── errors.js              # Error queue / toast display
│   ├── i18n.js                # Translation system (data-tkey rendering, language switching)
│   └── sharing.js             # **NEW** — game code encoding/decoding & URL parameter handling
├── lang/
│   └── lang_settings.js       # All translation strings (EN, FR, DE, etc.)
├── img/                       # Game art assets (tiles, structures, UI images, flags, logos)
│   ├── art_tiles/
│   │   ├── mobile/            # 0.png–11.png (12 tile images), s1–s4, p1–p4, mask.png, target.png
│   │   ├── tablet/
│   │   └── desktop/
│   ├── flags/
│   └── logos/
├── audio/                     # Sound files
└── sw.js                      # Service worker (for offline/PWA — review if still needed)
```

## Key Architecture Decisions

### Original Architecture (what we're migrating FROM)
- `cryptid.3.min.js` — single minified+bundled JS file (Webpack output), includes polyfills
- `getGame.php` — server endpoint returning JSON game data per mode
- `localforage` — used to cache server responses for offline play
- Game data format from server: `{ mapCode, mode, key, players: { "3": [...], "4": [...], "5": [...], "2": [...] } }`
- Each player count entry is an array of setups: `{ destination: "col, row", rules: ["rule_key", ...], hint: "hint_key" }`

### Target Architecture (what we're building)
- **No server dependency** — all game generation in `gameGenerator.js`
- **No build step required** — plain ES modules or simple script includes, no Webpack
- **GitHub Pages compatible** — pure static files, no server-side processing
- **Shareable game codes** — encode full game state into a compact URL-safe string
- **Player-specific URLs** — `?game=CODE&player=N` shows only player N's clue

## Game Data Model

### Map Structure
- The board is a 12×9 hex grid (12 columns, 9 rows), made of 6 rectangular tiles
- Each tile is a 6×3 section of hexes; tiles are arranged in a 2×3 grid
- **Map code**: a hex string where each character (1–C) identifies which of the 12 tile designs goes in each of the 6 positions. Example: `"79B48C"` means position 0 = tile 7, position 1 = tile 9, etc.
- The full map key also encodes structure positions: `"79B48C6A152A76418B"` — first 6 chars are tiles, remaining chars encode structure hex positions
- Columns are 1-indexed (1–12), rows are 1-indexed (1–9)
- Even columns are offset down by half a hex height (standard hex grid offset)

### Tile Data (defined in mapData.js or gameGenerator.js)
Each of the 12 tiles has a fixed terrain layout. There are 6 base tiles; tiles 7–12 are the 180° rotations of tiles 1–6 respectively. Each hex within a tile has one of 5 terrain types, and optionally an animal territory overlay.

**Terrain types:** `F` = forest, `W` = water, `D` = desert, `M` = mountain, `S` = swamp (called "bone" internally)
**Animal territory:** `B` = bear (dormant fissure), `C` = cougar (active fissure). Notation: `DB` = desert + bear, `FC` = forest + cougar, etc.

**Tile orientation:** Dot is in the top-left corner. Column 1 row 1 = top-left hex. Each tile is 6 columns × 3 rows. Rows are separated by `/`.

**Base tiles (1–6):**
```
Tile 1: W  W  W  W  F  F  / S  S  W  D  F  F  / S  S  D  DB DB FB
Tile 2: SC FC FC F  F  F  / S  S  F  D  D  D  / S  M  M  M  M  D
Tile 3: S  S  F  F  F  W  / SC SC F  M  W  W  / MC M  M  M  W  W
Tile 4: D  D  M  M  M  M  / D  D  M  W  W  WC / D  D  D  F  F  FC
Tile 5: S  S  S  M  M  M  / S  D  D  W  M  MB / D  D  W  W  WB WB
Tile 6: DB D  S  S  S  F  / MB M  S  S  F  F  / M  W  W  W  W  F
```

**Rotated tiles (7–12):** Generated by rotating the base tile 180°. For a 6×3 grid, hex at `(col, row)` maps to `(7 - col, 4 - row)`. So tile 7 = tile 1 rotated, tile 8 = tile 2 rotated, ..., tile 12 = tile 6 rotated.

**In code**, store as arrays. Example:
```javascript
const TILES = [
  // Tile 1 (index 0) — each entry is { terrain, animal }
  [
    [{t:'W'},{t:'W'},{t:'W'},{t:'W'},{t:'F'},{t:'F'}],
    [{t:'S'},{t:'S'},{t:'W'},{t:'D'},{t:'F'},{t:'F'}],
    [{t:'S'},{t:'S'},{t:'D'},{t:'D',a:'B'},{t:'D',a:'B'},{t:'F',a:'B'}]
  ],
  // ... tiles 2–6
];
// Tiles 7–12 generated at init by rotating tiles 1–6
```

### Structures
There are 8 structures placed on the map, encoded in the map code after the 6 tile chars:
- 4 **standing stones** (pyramids) — colors: green, blue, white (called "red" internally), black
- 4 **shacks** (colonies) — colors: green, blue, white (called "red" internally), black
- In normal/intro mode, black structures are NOT used (only 6 structures active)
- In advanced/normal mode, all 8 structures are used
- Structure images: `s1.png`–`s4.png` (standing stones), `p1.png`–`p4.png` (shacks)

### Clue Types (Rule Keys)
These are the `data-tkey` values used for clue text. They represent the possible clue a player can receive:

**Terrain proximity ("within X spaces"):**
- `within_forest`, `within_water`, `within_bone`, `within_mountain`, `within_desert` — "within one space of [terrain]"

**Structure proximity:**
- `within_pyramid` — within 2 spaces of a standing stone
- `within_colony` — within 2 spaces of a shack
- `within_green`, `within_blue`, `within_red`, `within_black` — within 3 spaces of [color] structure

**Animal territory proximity:**
- `within_fissure` — within 1 space of either animal territory
- `within_active_fissure` — within 2 spaces of cougar territory
- `within_dormant_fissure` — within 2 spaces of bear territory

**Terrain combinations ("on X or Y"):**
- `desert_or_bone`, `forest_or_mountain`, `forest_or_bone`, `mountain_or_bone`
- `water_or_desert`, `water_or_forest`, `water_or_bone`, `water_or_mountain`
- `forest_or_desert`, `desert_or_mountain`

**Advanced mode adds negations** of the above (prefixed with "not_" in logic, displayed as "the habitat is NOT...").

### Hint Types
Each game setup has a hint — a meta-clue about which clue categories are NOT present in the current game. **The hint can be derived from the assigned clues** (it describes what's absent), so it does NOT need to be stored in the game code — it is computed at decode/display time by inspecting the clue list.
- `hint_not_1`, `hint_not_2`, `hint_not_3` — no "within N" clues of that distance
- `hint_not_on_on` — no "on terrain or terrain" clues
- `hint_structures` — no structure-related clues
- `hint_terrain` — no terrain-type clues
- `hint_fissure` — no animal territory clues
- `hint_bone`, `hint_mountain`, `hint_desert`, `hint_forest`, `hint_water` — no clues mentioning that terrain

### Two-Player Mode
When `players = 2`, each player gets 2 clues (4 rules total, same as 4-player). The clue display logic groups them in pairs. The 2-player setups share rules with 4-player setups — they're filtered to be non-overlapping.

## Game Generation Algorithm (gameGenerator.js)

This is the core new module. It must:

1. **Generate a valid map configuration:**
   - Pick 6 tiles (from 12 available, with or without repeats — check original game constraints)
   - Assign structure positions to valid hexes on the map

2. **For each player count (3, 4, 5, and 2), generate valid setups:**
   - Pick a target hex (the habitat/destination)
   - Assign one clue per player (for the given player count) such that:
     - The target hex satisfies ALL assigned clues simultaneously
     - The target is the ONLY hex on the entire map that satisfies all clues (uniqueness constraint)
     - Each clue individually is satisfied by multiple hexes (non-trivial)
   - Generate the appropriate hint based on which clue categories are absent

3. **Hex distance calculation:**
   - Uses hex grid distance (accounting for the offset column layout)
   - "Within N spaces" means the hex itself OR any hex within N steps
   - "On X or Y" means the hex's own terrain is one of the two types

4. **Validation:** Every generated game must be verified — the intersection of all clue-satisfying hex sets must contain exactly one hex (the target).

### No Seeded RNG Needed
Games are fully encoded in the shareable game code (not derived from a seed). The generator produces a game, then the sharing system encodes all necessary state into the code. Decoding the code reconstructs the game without any RNG.

## Sharing System (sharing.js)

### Game Code Format
The game code is a **hexadecimal string** with fixed-width positional fields. No delimiters — each field has a known width, and the total length determines the player count. The target hex is NOT stored; it is recomputed at decode time by finding the unique hex satisfying all clues.

**Field layout (all values hex-encoded):**

| Field | Width | Description |
|---|---|---|
| Version | 1 char | Format version (`1` for v1). Allows future evolution. |
| Mode | 1 char | `0` = intro (normal), `1` = advanced |
| Tiles | 6 chars | One hex digit per tile position (values `1`–`C` for tiles 1–12, or `0`–`B` if zero-indexed) |
| Structures | variable | Each structure position = 2 hex chars (column 1–12 as `01`–`0C`, row 1–9 as `1`–`9`). In intro mode: 6 structures = 12 chars. In advanced mode: 8 structures = 16 chars. Order: green standing stone, blue standing stone, white standing stone, black standing stone, green shack, blue shack, white shack, black shack. (In intro mode, black structures are omitted → only 6.) |
| Clues | 2 chars each | One clue per player. Each clue is an index into the master clue list (00–FF, though ~30 values used). The number of 2-char clue fields determines the player count: 3 fields = 3 players, 4 = 4 players, 5 = 5 players, 4 fields with 2-player flag = 2 players. |

**Total length examples (v1, intro mode):**
- 3 players: 1 + 1 + 6 + 12 + 6 = **26 hex chars**
- 4 players: 1 + 1 + 6 + 12 + 8 = **28 hex chars**
- 5 players: 1 + 1 + 6 + 12 + 10 = **30 hex chars**

**Master clue list (index → rule key):** Define a canonical ordered list of all clue rule keys. The index into this list is what gets encoded. Example:
```
00 = within_forest
01 = within_water
02 = within_bone
03 = within_mountain
04 = within_desert
05 = within_fissure
06 = within_active_fissure
07 = within_dormant_fissure
08 = within_pyramid
09 = within_colony
0A = within_green
0B = within_blue
0C = within_red
0D = within_black
0E = desert_or_bone
0F = forest_or_mountain
10 = forest_or_bone
11 = mountain_or_bone
12 = water_or_desert
13 = water_or_forest
14 = water_or_bone
15 = water_or_mountain
16 = forest_or_desert
17 = desert_or_mountain
... (advanced mode negations continue from 18+)
```

**Two-player encoding:** 2-player games use 4 clues (2 per player). Encode 4 clue fields. To distinguish from 4-player: use a dedicated mode value (e.g., mode `2` = intro 2-player, mode `3` = advanced 2-player) or add a 1-char player count field. Decide during implementation — the version prefix allows format adjustments.

**Structure position encoding:** Each structure is on a specific hex. Encode as 2 hex chars: first char = column (1–C hex), second char = row (1–9). This gives clean readability when debugging: `"3A"` is not a valid position (row A doesn't exist), so there's implicit validation.

**Decoding and validation:**
1. Parse version byte
2. Extract mode, tiles, structure positions, clue keys
3. Reconstruct the full map (terrain + structures)
4. For each clue, compute the set of hexes satisfying it
5. Intersect all sets — must yield exactly 1 hex (the target)
6. If intersection ≠ 1 hex, the code is invalid/corrupted

### URL Parameters
- `?game=XXXXX` — loads a specific game from the code
- `?game=XXXXX&player=3` — loads the game and immediately shows ONLY player 3's clue (useful for remote/async play where each player opens their own link)
- `?game=XXXXX&player=3&lang=fr` — also sets language

### UI for Sharing
- After starting a game, show a "Share Game" button
- Clicking it shows:
  - The game code (copyable)
  - Individual player links (one per player) that go directly to that player's clue
  - A QR code or "copy link" button for each

## Migration Steps (Recommended Order)

### Phase 1: Deminify and Restructure
1. Take `cryptid.3.min.js` and deminify/beautify it
2. Identify the logical modules within the bundle (the original clearly has: game controller, game store, map renderer, settings, sound, tutorial, errors, i18n, and polyfills)
3. Split into separate files as listed in the repository structure above
4. Replace the Webpack `require()` calls with plain `<script>` tags or ES modules
5. Remove polyfill dependencies that are no longer needed (the original includes core-js polyfills for IE — we don't need those)
6. Verify the deminified version works identically to the original (except for server fetch, which will fail)

### Phase 2: Define Map/Tile Data
1. Create `mapData.js` with the complete terrain data for all 12 tiles
2. This requires extracting/reverse-engineering the terrain layout of each tile from the original tile images or from the game rules
3. Define hex coordinate system utilities (neighbor finding, distance calculation)
4. Define structure placement encoding/decoding

### Phase 3: Build Game Generator
1. Implement `gameGenerator.js` with the full generation + validation algorithm
2. Start with brute-force: pick random target, assign random clues, check uniqueness
3. Optimize if needed (constraint propagation, etc.)
4. Generate games in the same JSON format the old code expects: `{ mapCode, mode, key, players: { ... } }`
5. Integrate with `gameStore.js` — replace `fetchFromServer()` with `generateNewGame()`

### Phase 4: Sharing System
1. Implement game code encoding/decoding in `sharing.js`
2. Add URL parameter parsing on page load
3. Add "player-only" view mode (hides all UI except that player's clue + map)
4. Add sharing UI (game code display, per-player links)

### Phase 5: Polish and Deploy
1. Remove all server-related code (fetch calls, offline storage status, service worker registration if not needed)
2. Remove localforage dependency (games are generated on-demand, no caching needed)
3. Update the Settings/Offline section — it's now always "offline capable"
4. Update tutorial text if needed
5. Test across devices (the original is responsive with mobile/tablet/desktop breakpoints)
6. Deploy to GitHub Pages

## Important Implementation Details

### Hex Grid Coordinate System
The map uses an **offset coordinates** system (even-column offset):
- Columns 1–12, Rows 1–9
- Even-numbered columns are shifted down by half a hex
- The `xPosToPx` and `yPosToPx` functions in the map renderer handle the pixel conversion
- For neighbor/distance calculations, convert to cube coordinates first

### Map Rendering
- Uses HTML5 Canvas (`#mapCanvas`, 640×520 default)
- Three responsive sizes: mobile (260×210), tablet (400×320), desktop (550×450)
- Hex dimensions defined in the `u` config object per size (hex_d, hex_h, hex_s, hex_ds)
- Tile images are pre-rendered artwork (0.png–11.png per size), NOT programmatically drawn hexes
- Structure images are overlaid on top of tiles
- Target highlighting uses a mask image + target image overlay

### Settings System
- Uses `localStorage` via a custom `Settings` class (was in the minified bundle)
- Keys stored under `cryptid-settings`
- Settings include: `players`, `advanced`, `keep` (keep same map), `bgm`, `sfx`, `lang`, `tutorial`, `store`, `gameLimit`
- Settings have event listeners (e.g., toggling `store` triggers game store save/clear)

### Translation System
- All UI text uses `data-tkey` attributes on DOM elements
- The `d()` function reads the `data-tkey`, looks up the translation in `langData`, and sets `.html()`
- Player number substitution: `?p?` in strings is replaced with the player name (e.g., "Player 3")
- Clue rule keys (like `within_forest`) are ALSO translation keys — the clue text is localized
- Available languages: English, French, German, Italian, Spanish, Portuguese, Polish, Dutch, Czech, Chinese, Japanese, Korean

### Sound System
- Background music toggle (BGM) and sound effects toggle (SFX)
- Clue reveal plays a sound N times for player N (audio privacy feature)
- Game start sound on new game

### Dependencies (Original)
- **jQuery** — used extensively for DOM manipulation (`$()`, `.slideDown()`, `.click()`, etc.)
- **localforage** — IndexedDB/localStorage abstraction for offline game caching
- **W3.CSS** — CSS framework for layout (w3-card, w3-button, w3-modal, etc.)
- **core-js** — polyfills (can be removed)
- **Alegreya** — Google Font used for headings

### Dependencies (Target — keep minimal)
- **jQuery** — keep for now; too deeply integrated to remove during initial migration. Plan a separate phase to replace with vanilla JS later (see Future Work below).
- **W3.CSS** — keep (it's just a CSS file)
- **Alegreya font** — keep
- Remove: localforage, core-js, Webpack runtime

### Future Work (Post-Launch)
- **Remove jQuery:** Replace all jQuery usage with vanilla JS. Key replacements: `$()` → `querySelector/querySelectorAll`, `.slideDown()/.slideUp()` → CSS transitions with class toggling, `.data()` → `dataset`, `.click()` → `addEventListener`, `.html()` → `innerHTML`, `$.getJSON` → `fetch`. This should be done as a dedicated phase after the client-side fork is stable and tested.

## Code Style and Conventions
- Use `const`/`let` (no `var`)
- Use ES6+ features (arrow functions, template literals, destructuring)
- Add JSDoc comments on all public functions
- Keep the `window.cryptid` namespace for backward compatibility with HTML onclick handlers
- File-level IIFE or ES modules to avoid global pollution
- 2-space indentation
- Semicolons required

## Testing
- No test framework currently — consider adding basic tests for `gameGenerator.js` (the most critical new code)
- At minimum, add a `validate(game)` function that verifies a generated game's uniqueness constraint
- Test with all player counts (2, 3, 4, 5) and both modes (intro/normal)

## GitHub Pages Deployment
- The site root should be the repo root (or a `docs/` folder if preferred)
- All paths in HTML/JS/CSS should be relative (they already are: `./img/...`)
- No build step — just push and deploy
- Configure GitHub Pages to serve from the appropriate branch/folder