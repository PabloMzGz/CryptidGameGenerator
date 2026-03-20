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
 *   animalIndex  : 0=none, 1=bear (dormant fissure), 2=cougar (active fissure)
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
