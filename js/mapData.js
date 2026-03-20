/**
 * mapData.js — Tile image paths, hex geometry constants, and structure image paths.
 *
 * Exposes three data objects consumed by mapRenderer.js:
 *   - TILE_IMAGES   : { mobile, tablet, desktop } arrays of tile image paths
 *   - STRUCT_IMAGES : { mobile, tablet, desktop } arrays of structure image paths
 *   - HEX_CONFIG    : per-breakpoint hex geometry + canvas dimensions + thresholds
 *
 * Also exposes window.cryptid.map_arrays — the terrain/animal data for each of
 * the 12 tile designs.  Each tile is a flat array of 18 entries (6 cols × 3 rows,
 * row-major).  Each entry is [terrainIndex, animalIndex] where:
 *   terrainIndex : 0=water, 1=forest, 2=desert, 3=mountain, 4=swamp/bone
 *   animalIndex  : 0=none, 1=cougar (active fissure), 2=bear (dormant fissure)
 */

/** Tile artwork paths indexed by breakpoint, then by tile index 0–11. */
const TILE_IMAGES = {
  mobile: [
    './img/art_tiles/mobile/0.png',
    './img/art_tiles/mobile/1.png',
    './img/art_tiles/mobile/2.png',
    './img/art_tiles/mobile/3.png',
    './img/art_tiles/mobile/4.png',
    './img/art_tiles/mobile/5.png',
    './img/art_tiles/mobile/6.png',
    './img/art_tiles/mobile/7.png',
    './img/art_tiles/mobile/8.png',
    './img/art_tiles/mobile/9.png',
    './img/art_tiles/mobile/10.png',
    './img/art_tiles/mobile/11.png',
    './img/art_tiles/mobile/mask.png',
    './img/art_tiles/mobile/target.png',
  ],
  tablet: [
    './img/art_tiles/tablet/0.png',
    './img/art_tiles/tablet/1.png',
    './img/art_tiles/tablet/2.png',
    './img/art_tiles/tablet/3.png',
    './img/art_tiles/tablet/4.png',
    './img/art_tiles/tablet/5.png',
    './img/art_tiles/tablet/6.png',
    './img/art_tiles/tablet/7.png',
    './img/art_tiles/tablet/8.png',
    './img/art_tiles/tablet/9.png',
    './img/art_tiles/tablet/10.png',
    './img/art_tiles/tablet/11.png',
    './img/art_tiles/tablet/mask.png',
    './img/art_tiles/tablet/target.png',
  ],
  desktop: [
    './img/art_tiles/desktop/0.png',
    './img/art_tiles/desktop/1.png',
    './img/art_tiles/desktop/2.png',
    './img/art_tiles/desktop/3.png',
    './img/art_tiles/desktop/4.png',
    './img/art_tiles/desktop/5.png',
    './img/art_tiles/desktop/6.png',
    './img/art_tiles/desktop/7.png',
    './img/art_tiles/desktop/8.png',
    './img/art_tiles/desktop/9.png',
    './img/art_tiles/desktop/10.png',
    './img/art_tiles/desktop/11.png',
    './img/art_tiles/desktop/mask.png',
    './img/art_tiles/desktop/target.png',
  ],
};

/**
 * Structure image paths indexed by breakpoint.
 * Index 0 = standing stones array (s1–s4), index 1 = shacks array (p1–p4).
 */
const STRUCT_IMAGES = {
  mobile: [
    [
      './img/art_tiles/mobile/s1.png',
      './img/art_tiles/mobile/s2.png',
      './img/art_tiles/mobile/s3.png',
      './img/art_tiles/mobile/s4.png',
    ],
    [
      './img/art_tiles/mobile/p1.png',
      './img/art_tiles/mobile/p2.png',
      './img/art_tiles/mobile/p3.png',
      './img/art_tiles/mobile/p4.png',
    ],
  ],
  tablet: [
    [
      './img/art_tiles/tablet/s1.png',
      './img/art_tiles/tablet/s2.png',
      './img/art_tiles/tablet/s3.png',
      './img/art_tiles/tablet/s4.png',
    ],
    [
      './img/art_tiles/tablet/p1.png',
      './img/art_tiles/tablet/p2.png',
      './img/art_tiles/tablet/p3.png',
      './img/art_tiles/tablet/p4.png',
    ],
  ],
  desktop: [
    [
      './img/art_tiles/desktop/s1.png',
      './img/art_tiles/desktop/s2.png',
      './img/art_tiles/desktop/s3.png',
      './img/art_tiles/desktop/s4.png',
    ],
    [
      './img/art_tiles/desktop/p1.png',
      './img/art_tiles/desktop/p2.png',
      './img/art_tiles/desktop/p3.png',
      './img/art_tiles/desktop/p4.png',
    ],
  ],
};

/**
 * Hex geometry and canvas dimensions, keyed by breakpoint name.
 * Also includes a `thresholds` map used by autoWidthAdjust.
 */
const HEX_CONFIG = {
  mobile: {
    numberMargin: 20,
    numberFontSize: '16px',
    tileGap: 10,
    hex_d: 110 / 4.75,
    hex_s: 110 / 9.5,
    hex_ds: 17.36842105263158,
    hex_h: Math.sqrt(3) * (110 / 9.5),
    fissure_draw: false,
    fissure_active_idx: 0,
    fissure_dormant_idx: 0,
    canvas_width: 260,
    canvas_height: 210,
    dot_height: 0,
    dot_color: 'black',
  },
  tablet: {
    numberMargin: 25,
    numberFontSize: '22px',
    tileGap: 7,
    hex_d: 178 / 4.75,
    hex_s: 178 / 9.5,
    hex_ds: 28.105263157894736,
    hex_h: Math.sqrt(3) * (178 / 9.5),
    fissure_draw: true,
    fissure_active_idx: 5,
    fissure_dormant_idx: 6,
    canvas_width: 400,
    canvas_height: 320,
    dot_height: 7,
    dot_color: 'black',
  },
  desktop: {
    numberMargin: 30,
    numberFontSize: '30px',
    tileGap: 10,
    hex_d: 248 / 4.75,
    hex_s: 248 / 9.5,
    hex_ds: 39.1578947368421,
    hex_h: Math.sqrt(3) * (248 / 9.5),
    fissure_draw: true,
    canvas_width: 550,
    canvas_height: 450,
    dot_height: 10,
    dot_color: '#060d10',
  },
  thresholds: {
    mobile: 0,
    tablet: 700,
    desktop: 1000,
  },
};

/**
 * Terrain/animal data for tiles 1–12 (stored at indices 0–11).
 * Each tile is a flat array of 18 [terrainIndex, animalIndex] pairs:
 *   terrainIndex : 0=water, 1=forest, 2=desert, 3=mountain, 4=swamp/bone
 *   animalIndex  : 0=none, 1=bear (dormant), 2=cougar (active)
 *
 * Layout order: row 1 cols 1–6, row 2 cols 1–6, row 3 cols 1–6.
 */
window.cryptid.map_arrays = [
  // Tile 1
  [[0,0],[0,0],[0,0],[0,0],[1,0],[1,0],[4,0],[4,0],[0,0],[2,0],[1,0],[1,0],[4,0],[4,0],[2,0],[2,2],[2,2],[1,2]],
  // Tile 2
  [[4,1],[1,1],[1,1],[1,0],[1,0],[1,0],[4,0],[4,0],[1,0],[2,0],[2,0],[2,0],[4,0],[3,0],[3,0],[3,0],[3,0],[2,0]],
  // Tile 3
  [[4,0],[4,0],[1,0],[1,0],[1,0],[0,0],[4,1],[4,1],[1,0],[3,0],[0,0],[0,0],[3,1],[3,0],[3,0],[3,0],[0,0],[0,0]],
  // Tile 4
  [[2,0],[2,0],[3,0],[3,0],[3,0],[3,0],[2,0],[2,0],[3,0],[0,0],[0,0],[0,1],[2,0],[2,0],[2,0],[1,0],[1,0],[1,1]],
  // Tile 5
  [[4,0],[4,0],[4,0],[3,0],[3,0],[3,0],[4,0],[2,0],[2,0],[0,0],[3,0],[3,2],[2,0],[2,0],[0,0],[0,0],[0,2],[0,2]],
  // Tile 6
  [[2,2],[2,0],[4,0],[4,0],[4,0],[1,0],[3,2],[3,0],[4,0],[4,0],[1,0],[1,0],[3,0],[0,0],[0,0],[0,0],[0,0],[1,0]],
  // Tile 7 (tile 1 rotated 180°)
  [[1,2],[2,2],[2,2],[2,0],[4,0],[4,0],[1,0],[1,0],[2,0],[0,0],[4,0],[4,0],[1,0],[1,0],[0,0],[0,0],[0,0],[0,0]],
  // Tile 8 (tile 2 rotated 180°)
  [[2,0],[3,0],[3,0],[3,0],[3,0],[4,0],[2,0],[2,0],[2,0],[1,0],[4,0],[4,0],[1,0],[1,0],[1,0],[1,1],[1,1],[4,1]],
  // Tile 9 (tile 3 rotated 180°)
  [[0,0],[0,0],[3,0],[3,0],[3,0],[3,1],[0,0],[0,0],[3,0],[1,0],[4,1],[4,1],[0,0],[1,0],[1,0],[1,0],[4,0],[4,0]],
  // Tile 10 (tile 4 rotated 180°)
  [[1,1],[1,0],[1,0],[2,0],[2,0],[2,0],[0,1],[0,0],[0,0],[3,0],[2,0],[2,0],[3,0],[3,0],[3,0],[3,0],[2,0],[2,0]],
  // Tile 11 (tile 5 rotated 180°)
  [[0,2],[0,2],[0,0],[0,0],[2,0],[2,0],[3,2],[3,0],[0,0],[2,0],[2,0],[4,0],[3,0],[3,0],[3,0],[4,0],[4,0],[4,0]],
  // Tile 12 (tile 6 rotated 180°)
  [[1,0],[0,0],[0,0],[0,0],[0,0],[3,0],[1,0],[1,0],[4,0],[4,0],[3,0],[3,2],[1,0],[4,0],[4,0],[4,0],[2,0],[2,2]],
];

// ---------------------------------------------------------------------------
// Terrain index constants — use these names instead of raw numbers
// ---------------------------------------------------------------------------

/** @enum {number} Terrain type indices matching window.cryptid.map_arrays entries. */
const TERRAIN = { WATER: 0, FOREST: 1, DESERT: 2, MOUNTAIN: 3, SWAMP: 4 };

/** @enum {number} Animal territory indices. */
const ANIMAL = { NONE: 0, COUGAR: 1, BEAR: 2 };

// ---------------------------------------------------------------------------
// Hex coordinate utilities
//
// The board uses 1-indexed (col, row) offset coordinates where even-numbered
// columns (2, 4, 6 …) are shifted DOWN by half a hex height.  In 0-indexed
// terms these are odd-q columns, which maps to the "odd-q" cube-coordinate
// conversion from redblobgames.com.
// ---------------------------------------------------------------------------

/**
 * Convert 1-indexed offset (col, row) to cube coordinates {q, r, s}.
 * Uses odd-q offset (0-indexed odd columns shifted down).
 *
 * @param {number} col - 1-indexed column (1–12).
 * @param {number} row - 1-indexed row (1–9).
 * @returns {{q:number, r:number, s:number}}
 */
function offsetToCube(col, row) {
  const c = col - 1; // 0-indexed
  const r = row - 1; // 0-indexed
  const q = c;
  const cr = r - (c - (c & 1)) / 2;
  return { q, r: cr, s: -q - cr };
}

/**
 * Compute the hex-grid distance between two board positions.
 *
 * @param {number} col1 - 1-indexed.
 * @param {number} row1 - 1-indexed.
 * @param {number} col2 - 1-indexed.
 * @param {number} row2 - 1-indexed.
 * @returns {number} Number of hex steps.
 */
function hexDistance(col1, row1, col2, row2) {
  const a = offsetToCube(col1, row1);
  const b = offsetToCube(col2, row2);
  return Math.max(Math.abs(a.q - b.q), Math.abs(a.r - b.r), Math.abs(a.s - b.s));
}

/**
 * Return the (up to 6) valid board-position neighbours of a hex.
 *
 * @param {number} col - 1-indexed (1–12).
 * @param {number} row - 1-indexed (1–9).
 * @returns {Array<{col:number, row:number}>}
 */
function hexNeighbors(col, row) {
  // Six cube-coordinate direction vectors
  const CUBE_DIRS = [
    { q:  1, r: -1, s:  0 }, { q:  1, r:  0, s: -1 },
    { q:  0, r:  1, s: -1 }, { q: -1, r:  1, s:  0 },
    { q: -1, r:  0, s:  1 }, { q:  0, r: -1, s:  1 },
  ];
  const cube = offsetToCube(col, row);
  const result = [];
  CUBE_DIRS.forEach(function (d) {
    const nq = cube.q + d.q;
    const nr = cube.r + d.r;
    // Convert back to offset (1-indexed)
    const nc = nq + 1;
    const nr_offset = nr + (nq - (nq & 1)) / 2 + 1;
    if (nc >= 1 && nc <= 12 && nr_offset >= 1 && nr_offset <= 9) {
      result.push({ col: nc, row: nr_offset });
    }
  });
  return result;
}

/**
 * Return all 108 valid board positions as {col, row} objects.
 *
 * @returns {Array<{col:number, row:number}>}
 */
function getAllHexes() {
  const hexes = [];
  for (let col = 1; col <= 12; col++) {
    for (let row = 1; row <= 9; row++) {
      hexes.push({ col, row });
    }
  }
  return hexes;
}

// ---------------------------------------------------------------------------
// Map key parsing helpers
// ---------------------------------------------------------------------------

/**
 * Return the terrain and animal data for a single hex on a given map.
 *
 * @param {string} mapKey - Raw map key string (e.g. "79B48C6A152A76418B").
 *   The leading "intro_" prefix is stripped automatically.
 * @param {number} col - 1-indexed column (1–12).
 * @param {number} row - 1-indexed row (1–9).
 * @returns {{terrain:number, animal:number}}
 *   terrain: TERRAIN constant; animal: ANIMAL constant.
 */
function getHexData(mapKey, col, row) {
  const key = mapKey.replace('intro_', '');
  // Which of the 6 tile positions does this hex fall in?
  const tileCol = col <= 6 ? 0 : 1;
  const tileRow = Math.floor((row - 1) / 3);
  const tilePos = tileRow * 2 + tileCol;
  // Design index (0-indexed) encoded as hex digit 1–C in the key
  const designIdx = parseInt(key.substring(tilePos, tilePos + 1), 16) - 1;
  // Local position within tile (1-indexed, 6-wide × 3-tall)
  const localCol = ((col - 1) % 6) + 1;
  const localRow = ((row - 1) % 3) + 1;
  const flatIdx = (localRow - 1) * 6 + (localCol - 1);
  const entry = window.cryptid.map_arrays[designIdx][flatIdx];
  return { terrain: entry[0], animal: entry[1] };
}

/**
 * Parse structure positions from a map key.
 *
 * ENCODING NOTE — there is a deliberate swap in mapRenderer.drawStructures:
 *   local var "col" (first key byte)  → passed as 2nd arg → becomes visual row.
 *   local var "row" (second key byte) → passed as 1st arg → becomes visual col.
 * So for a structure at visual board position (col, row):
 *   byte 1 = hex(row − 1)
 *   byte 2 = hex(col − 1)
 *
 * @param {string} mapKey   - Raw map key string.
 * @returns {Array<{col:number, row:number, type:string, color:string}>}
 *   type:  'stone' | 'shack'
 *   color: 'green' | 'blue' | 'white' | 'black'
 */
function parseStructures(mapKey) {
  const key = mapKey.replace('intro_', '');
  // Structure order in key: stones (green, blue, white, black), shacks (green, blue, white, black)
  // All 8 positions are always encoded; the renderer decides which to draw based on mode.
  const COLORS = ['white', 'green', 'blue', 'black'];
  const result = [];
  let offset = 6; // First 6 chars are tile indices

  ['stone', 'shack'].forEach(function (type) {
    for (let i = 0; i < 4; i++) {
      // Byte 1 encodes visual row−1; byte 2 encodes visual col−1 (see note above)
      const visualRow = parseInt(key.substring(offset,     offset + 1), 16) + 1;
      const visualCol = parseInt(key.substring(offset + 1, offset + 2), 16) + 1;
      offset += 2;
      result.push({ col: visualCol, row: visualRow, type, color: COLORS[i] });
    }
  });

  return result;
}

/**
 * Encode a list of structure positions back into the 12- or 16-char structure
 * portion of a map key.  Structures must be provided in the canonical order:
 * stones (green, blue, white[, black]) then shacks (green, blue, white[, black]).
 *
 * @param {Array<{col:number, row:number}>} structures - In canonical order.
 * @returns {string} Hex string ready to be appended to the 6-char tile prefix.
 */
function encodeStructures(structures) {
  return structures.map(function (s) {
    // Byte 1 = row−1, byte 2 = col−1 (matches the renderer's swap; see parseStructures)
    return (s.row - 1).toString(16).toUpperCase() +
           (s.col - 1).toString(16).toUpperCase();
  }).join('');
}

/**
 * Build a complete map key string from tile indices and structure positions.
 *
 * @param {number[]} tileDesigns - Array of 6 tile design numbers (1–12), one per tile position.
 * @param {Array<{col:number, row:number}>} structures - In canonical order (see encodeStructures).
 * @returns {string}
 */
function buildMapKey(tileDesigns, structures) {
  const tileStr = tileDesigns.map(function (d) {
    return d.toString(16).toUpperCase();
  }).join('');
  return tileStr + encodeStructures(structures);
}
