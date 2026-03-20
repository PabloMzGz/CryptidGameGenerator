/**
 * gameGenerator.js — Client-side game generation engine.
 *
 * Replaces the server-side getGame.php.  Generates valid Cryptid game setups
 * entirely in the browser: random map layout, structure placement, and clue
 * assignments that satisfy the uniqueness constraint.
 *
 * Public API (called from gameStore.js):
 *   generateGame(mode)  →  game data object  { mapCode, mode, key, players }
 *
 * Depends on: mapData.js  (TERRAIN, ANIMAL, getAllHexes, hexDistance,
 *                           getHexData, parseStructures, buildMapKey)
 */

// ---------------------------------------------------------------------------
// Tuning constants
// ---------------------------------------------------------------------------

/** Maximum number of map layouts to try before giving up. */
const GEN_MAX_MAP_ATTEMPTS   = 30;
/** Desired number of setups per player count per map. */
const GEN_SETUPS_PER_COUNT   = 3;
/** Maximum target-hex attempts per player count per map attempt. */
const GEN_MAX_TARGET_ATTEMPTS = 200;

// ---------------------------------------------------------------------------
// Clue lists
// ---------------------------------------------------------------------------

/**
 * All 24 normal-mode clue keys (used in both intro and normal/advanced mode).
 * Index order matches the sharing-system encoding table in CLAUDE.md.
 */
const NORMAL_CLUES = [
  'within_forest',
  'within_water',
  'within_bone',
  'within_mountain',
  'within_desert',
  'within_fissure',
  'within_active_fissure',
  'within_dormant_fissure',
  'within_pyramid',
  'within_colony',
  'within_green',
  'within_blue',
  'within_red',
  'within_black',
  'desert_or_bone',
  'forest_or_mountain',
  'forest_or_bone',
  'mountain_or_bone',
  'water_or_desert',
  'water_or_forest',
  'water_or_bone',
  'water_or_mountain',
  'forest_or_desert',
  'desert_or_mountain',
];

/**
 * Intro mode: same as normal but without black-structure clues.
 * Black structures are not placed in intro mode so their clues are invalid.
 */
const INTRO_CLUES = NORMAL_CLUES.filter(function (c) {
  return c !== 'within_black';
});

/** Advanced mode adds negations of every normal clue (including within_black). */
const ADVANCED_CLUES = NORMAL_CLUES.concat(
  NORMAL_CLUES.map(function (c) { return 'not_' + c; })
);

// ---------------------------------------------------------------------------
// Hint tables
// ---------------------------------------------------------------------------

/**
 * For each hint key, the set of clue keys that "mention" that category.
 * A hint is applicable when NONE of the chosen rules belongs to its set.
 */
const HINT_GROUPS = {
  hint_water: [
    'within_water', 'not_within_water',
    'water_or_desert', 'not_water_or_desert',
    'water_or_forest', 'not_water_or_forest',
    'water_or_bone', 'not_water_or_bone',
    'water_or_mountain', 'not_water_or_mountain',
  ],
  hint_forest: [
    'within_forest', 'not_within_forest',
    'forest_or_mountain', 'not_forest_or_mountain',
    'forest_or_bone', 'not_forest_or_bone',
    'water_or_forest', 'not_water_or_forest',
    'forest_or_desert', 'not_forest_or_desert',
  ],
  hint_desert: [
    'within_desert', 'not_within_desert',
    'desert_or_bone', 'not_desert_or_bone',
    'water_or_desert', 'not_water_or_desert',
    'forest_or_desert', 'not_forest_or_desert',
    'desert_or_mountain', 'not_desert_or_mountain',
  ],
  hint_mountain: [
    'within_mountain', 'not_within_mountain',
    'forest_or_mountain', 'not_forest_or_mountain',
    'mountain_or_bone', 'not_mountain_or_bone',
    'water_or_mountain', 'not_water_or_mountain',
    'desert_or_mountain', 'not_desert_or_mountain',
  ],
  hint_bone: [
    'within_bone', 'not_within_bone',
    'desert_or_bone', 'not_desert_or_bone',
    'forest_or_bone', 'not_forest_or_bone',
    'mountain_or_bone', 'not_mountain_or_bone',
    'water_or_bone', 'not_water_or_bone',
  ],
  hint_fissure: [
    'within_fissure', 'not_within_fissure',
    'within_active_fissure', 'not_within_active_fissure',
    'within_dormant_fissure', 'not_within_dormant_fissure',
  ],
  hint_structures: [
    'within_pyramid', 'not_within_pyramid',
    'within_colony', 'not_within_colony',
    'within_green', 'not_within_green',
    'within_blue', 'not_within_blue',
    'within_red', 'not_within_red',
    'within_black', 'not_within_black',
  ],
  hint_terrain: [
    'within_forest', 'not_within_forest',
    'within_water', 'not_within_water',
    'within_bone', 'not_within_bone',
    'within_mountain', 'not_within_mountain',
    'within_desert', 'not_within_desert',
  ],
  hint_not_1: [
    'within_forest', 'not_within_forest',
    'within_water', 'not_within_water',
    'within_bone', 'not_within_bone',
    'within_mountain', 'not_within_mountain',
    'within_desert', 'not_within_desert',
    'within_fissure', 'not_within_fissure',
  ],
  hint_not_2: [
    'within_pyramid', 'not_within_pyramid',
    'within_colony', 'not_within_colony',
    'within_active_fissure', 'not_within_active_fissure',
    'within_dormant_fissure', 'not_within_dormant_fissure',
  ],
  hint_not_3: [
    'within_green', 'not_within_green',
    'within_blue', 'not_within_blue',
    'within_red', 'not_within_red',
    'within_black', 'not_within_black',
  ],
  hint_not_on_on: [
    'desert_or_bone', 'not_desert_or_bone',
    'forest_or_mountain', 'not_forest_or_mountain',
    'forest_or_bone', 'not_forest_or_bone',
    'mountain_or_bone', 'not_mountain_or_bone',
    'water_or_desert', 'not_water_or_desert',
    'water_or_forest', 'not_water_or_forest',
    'water_or_bone', 'not_water_or_bone',
    'water_or_mountain', 'not_water_or_mountain',
    'forest_or_desert', 'not_forest_or_desert',
    'desert_or_mountain', 'not_desert_or_mountain',
  ],
};

/**
 * Priority order for hint selection — most informative (specific) first.
 * The first applicable hint (none of the chosen rules belong to its group)
 * is used.
 */
const HINT_PRIORITY = [
  'hint_water', 'hint_forest', 'hint_desert', 'hint_mountain', 'hint_bone',
  'hint_fissure', 'hint_structures', 'hint_terrain',
  'hint_not_1', 'hint_not_2', 'hint_not_3', 'hint_not_on_on',
];

// ---------------------------------------------------------------------------
// Board state
// ---------------------------------------------------------------------------

/**
 * Build a precomputed board state for efficient clue checking.
 *
 * @param {string} mapKey - Full map key string.
 * @returns {{
 *   data: Object,          // "col,row" → {terrain, animal}
 *   byTerrain: Array[],   // TERRAIN index → [{col,row}, …]
 *   byAnimal: Array[],    // ANIMAL index  → [{col,row}, …]
 * }}
 */
function buildBoardState(mapKey) {
  const data = {};
  const byTerrain = [[], [], [], [], []]; // indices 0–4
  const byAnimal  = [[], [], []];         // indices 0–2

  getAllHexes().forEach(function (h) {
    const entry = getHexData(mapKey, h.col, h.row);
    const key = h.col + ',' + h.row;
    data[key] = entry;
    byTerrain[entry.terrain].push(h);
    if (entry.animal !== ANIMAL.NONE) {
      byAnimal[entry.animal].push(h);
    }
  });

  return { data, byTerrain, byAnimal };
}

// ---------------------------------------------------------------------------
// Clue satisfaction
// ---------------------------------------------------------------------------

/**
 * @param {number} col
 * @param {number} row
 * @param {number} terrainIdx - TERRAIN constant.
 * @param {number} n          - Maximum distance.
 * @param {Object} boardState
 * @returns {boolean}
 */
function isWithinTerrain(col, row, terrainIdx, n, boardState) {
  return boardState.byTerrain[terrainIdx].some(function (h) {
    return hexDistance(col, row, h.col, h.row) <= n;
  });
}

/**
 * @param {number} col
 * @param {number} row
 * @param {number|null} animalIdx - ANIMAL constant, or null for any animal.
 * @param {number} n
 * @param {Object} boardState
 * @returns {boolean}
 */
function isWithinAnimal(col, row, animalIdx, n, boardState) {
  let sources;
  if (animalIdx === null) {
    sources = boardState.byAnimal[ANIMAL.BEAR].concat(boardState.byAnimal[ANIMAL.COUGAR]);
  } else {
    sources = boardState.byAnimal[animalIdx];
  }
  return sources.some(function (h) {
    return hexDistance(col, row, h.col, h.row) <= n;
  });
}

/**
 * @param {number} col
 * @param {number} row
 * @param {string|null} type  - 'stone' | 'shack' | null (any).
 * @param {string|null} color - 'green' | 'blue' | 'white' | 'black' | null (any).
 * @param {number} n
 * @param {Array}  structs    - Output of parseStructures().
 * @returns {boolean}
 */
function isWithinStructure(col, row, type, color, n, structs) {
  return structs.some(function (s) {
    if (type  !== null && s.type  !== type)  return false;
    if (color !== null && s.color !== color) return false;
    return hexDistance(col, row, s.col, s.row) <= n;
  });
}

/**
 * Test whether a single hex satisfies a given clue.
 *
 * @param {number} col
 * @param {number} row
 * @param {string} clue       - Clue key.
 * @param {Object} boardState - From buildBoardState().
 * @param {Array}  structs    - From parseStructures().
 * @returns {boolean}
 */
function hexSatisfiesClue(col, row, clue, boardState, structs) {
  const d = boardState.data[col + ',' + row];
  switch (clue) {
    // Terrain proximity — within 1
    case 'within_forest':   return isWithinTerrain(col, row, TERRAIN.FOREST,   1, boardState);
    case 'within_water':    return isWithinTerrain(col, row, TERRAIN.WATER,    1, boardState);
    case 'within_bone':     return isWithinTerrain(col, row, TERRAIN.SWAMP,    1, boardState);
    case 'within_mountain': return isWithinTerrain(col, row, TERRAIN.MOUNTAIN, 1, boardState);
    case 'within_desert':   return isWithinTerrain(col, row, TERRAIN.DESERT,   1, boardState);
    // Animal territory
    case 'within_fissure':          return isWithinAnimal(col, row, null,          1, boardState);
    case 'within_active_fissure':   return isWithinAnimal(col, row, ANIMAL.COUGAR, 2, boardState);
    case 'within_dormant_fissure':  return isWithinAnimal(col, row, ANIMAL.BEAR,   2, boardState);
    // Structure proximity
    case 'within_pyramid': return isWithinStructure(col, row, 'stone', null,    2, structs);
    case 'within_colony':  return isWithinStructure(col, row, 'shack', null,    2, structs);
    case 'within_green':   return isWithinStructure(col, row, null,    'green', 3, structs);
    case 'within_blue':    return isWithinStructure(col, row, null,    'blue',  3, structs);
    case 'within_red':     return isWithinStructure(col, row, null,    'white', 3, structs);
    case 'within_black':   return isWithinStructure(col, row, null,    'black', 3, structs);
    // Terrain combinations (on hex's own terrain)
    case 'desert_or_bone':     return d.terrain === TERRAIN.DESERT   || d.terrain === TERRAIN.SWAMP;
    case 'forest_or_mountain': return d.terrain === TERRAIN.FOREST   || d.terrain === TERRAIN.MOUNTAIN;
    case 'forest_or_bone':     return d.terrain === TERRAIN.FOREST   || d.terrain === TERRAIN.SWAMP;
    case 'mountain_or_bone':   return d.terrain === TERRAIN.MOUNTAIN || d.terrain === TERRAIN.SWAMP;
    case 'water_or_desert':    return d.terrain === TERRAIN.WATER    || d.terrain === TERRAIN.DESERT;
    case 'water_or_forest':    return d.terrain === TERRAIN.WATER    || d.terrain === TERRAIN.FOREST;
    case 'water_or_bone':      return d.terrain === TERRAIN.WATER    || d.terrain === TERRAIN.SWAMP;
    case 'water_or_mountain':  return d.terrain === TERRAIN.WATER    || d.terrain === TERRAIN.MOUNTAIN;
    case 'forest_or_desert':   return d.terrain === TERRAIN.FOREST   || d.terrain === TERRAIN.DESERT;
    case 'desert_or_mountain': return d.terrain === TERRAIN.DESERT   || d.terrain === TERRAIN.MOUNTAIN;
    default:
      // Advanced negations: strip 'not_' prefix and negate
      if (clue.startsWith('not_')) {
        return !hexSatisfiesClue(col, row, clue.substring(4), boardState, structs);
      }
      return false;
  }
}

/**
 * Compute the set of hex keys that satisfy a clue.
 *
 * @param {string} clue
 * @param {Object} boardState
 * @param {Array}  structs
 * @returns {Set<string>}  Elements are "col,row" strings.
 */
function computeSatisfyingSet(clue, boardState, structs) {
  const result = new Set();
  getAllHexes().forEach(function (h) {
    if (hexSatisfiesClue(h.col, h.row, clue, boardState, structs)) {
      result.add(h.col + ',' + h.row);
    }
  });
  return result;
}

/**
 * Precompute satisfying sets for every clue in the list.
 *
 * @param {string[]} clueList
 * @param {Object}   boardState
 * @param {Array}    structs
 * @returns {Object}  clueKey → Set<string>
 */
function computeAllSatisfyingSets(clueList, boardState, structs) {
  const sets = {};
  clueList.forEach(function (clue) {
    sets[clue] = computeSatisfyingSet(clue, boardState, structs);
  });
  return sets;
}

// ---------------------------------------------------------------------------
// Setup finding — backtracking
// ---------------------------------------------------------------------------

/**
 * Attempt to find N clues (one per player) that uniquely identify a randomly
 * chosen target hex.
 *
 * @param {number}  n             - Player count (number of clues needed).
 * @param {string[]} clueList     - Full ordered clue list for the current mode.
 * @param {Object}  satisfySets   - clueKey → Set<string> (from computeAllSatisfyingSets).
 * @param {string[]} allHexKeys   - All 108 "col,row" keys.
 * @returns {{destination:string, rules:string[], hint:string}|null}
 */
function tryGenerateSetup(n, clueList, satisfySets, allHexKeys) {
  // Pick a random target
  const targetKey = allHexKeys[Math.floor(Math.random() * allHexKeys.length)];

  // Filter to clues the target satisfies AND whose satisfying set is non-trivial
  const eligible = clueList.filter(function (c) {
    return satisfySets[c].has(targetKey) && satisfySets[c].size > 1;
  });

  // Sort ascending by satisfying-set size so most restrictive clues are tried first
  eligible.sort(function (a, b) {
    return satisfySets[a].size - satisfySets[b].size;
  });

  if (eligible.length < n) return null; // Not enough clues satisfy this target

  // Backtracking search: find exactly n clues whose intersection = {targetKey}
  let found = null;

  function backtrack(startIdx, chosen, intersection) {
    if (found !== null) return; // Already found a solution

    if (chosen.length === n) {
      if (intersection.size === 1) {
        found = chosen.slice();
      }
      return;
    }

    const remaining = n - chosen.length;
    const limit = eligible.length - remaining;

    for (let i = startIdx; i <= limit; i++) {
      const clue = eligible[i];
      const clueSet = satisfySets[clue];

      // Intersect current set with this clue's satisfying set
      const newIntersection = new Set();
      intersection.forEach(function (key) {
        if (clueSet.has(key)) newIntersection.add(key);
      });

      // Prune: target must survive the intersection
      if (!newIntersection.has(targetKey)) continue;

      // Prune: intersection must have shrunk (clue adds information)
      // — unless this is the last clue slot, where size could already be 1
      if (newIntersection.size >= intersection.size && chosen.length + 1 < n) continue;

      chosen.push(clue);
      backtrack(i + 1, chosen, newIntersection);
      chosen.pop();

      if (found !== null) return;
    }
  }

  const allHexSet = new Set(allHexKeys);
  backtrack(0, [], allHexSet);

  if (found === null) return null;

  const hint = deriveHint(found);
  return { destination: targetKey, rules: found, hint };
}

// ---------------------------------------------------------------------------
// Hint derivation
// ---------------------------------------------------------------------------

/**
 * Derive the most informative applicable hint from a set of chosen clue rules.
 *
 * A hint is applicable when none of the chosen rules belong to its group
 * (i.e. the category is completely absent from the game).
 *
 * @param {string[]} rules - Chosen clue keys for one setup.
 * @returns {string} Hint key.
 */
function deriveHint(rules) {
  const ruleSet = new Set(rules);

  for (let i = 0; i < HINT_PRIORITY.length; i++) {
    const hintKey = HINT_PRIORITY[i];
    const group   = HINT_GROUPS[hintKey];
    const absent  = group.every(function (c) { return !ruleSet.has(c); });
    if (absent) return hintKey;
  }

  // Fallback — should rarely be reached on a well-generated 3–5 clue set
  return 'hint_terrain';
}

// ---------------------------------------------------------------------------
// Map code generation
// ---------------------------------------------------------------------------

/**
 * Fisher-Yates shuffle (in-place).
 * @param {Array} arr
 */
function shuffleArray(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = arr[i];
    arr[i] = arr[j];
    arr[j] = tmp;
  }
}

/**
 * Generate a random full map key (6 tile chars + 16 structure chars = 22 chars).
 *
 * Tile designs are chosen randomly from 1–12 (repeats allowed).
 * Structure positions are chosen from the 108 board hexes without replacement.
 *
 * @returns {string} 22-character hex key.
 */
function generateRandomMapCode() {
  // Pick 6 unique tile designs from 1–12.
  // Tiles 1–6 are base; tiles 7–12 are their 180° rotations (same physical piece).
  // Neither the same design nor its pair (n and n+6, or n-6) may appear twice.
  const available = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
  const tileDesigns = [];
  for (let i = 0; i < 6; i++) {
    const idx = Math.floor(Math.random() * available.length);
    const chosen = available[idx];
    tileDesigns.push(chosen);
    // Remove the chosen tile and its physical pair from the pool
    const pair = chosen <= 6 ? chosen + 6 : chosen - 6;
    available.splice(idx, 1);
    const pairIdx = available.indexOf(pair);
    if (pairIdx !== -1) available.splice(pairIdx, 1);
  }

  // Pick 8 non-overlapping structure positions
  const hexPool = getAllHexes().slice(); // shallow copy
  shuffleArray(hexPool);
  const structPositions = hexPool.slice(0, 8);

  // Order: green stone, blue stone, white stone, black stone,
  //        green shack, blue shack, white shack, black shack
  return buildMapKey(tileDesigns, structPositions);
}

// ---------------------------------------------------------------------------
// Main game generation
// ---------------------------------------------------------------------------

/**
 * Generate a complete game data object compatible with GameRecord.create().
 *
 * Retries up to GEN_MAX_MAP_ATTEMPTS times with different map layouts if it
 * cannot find valid setups for all player counts.
 *
 * @param {string} mode - 'intro' | 'normal'
 * @returns {{mapCode:string, mode:string, key:string, players:Object}}
 * @throws {Error} If generation fails after all retries.
 */
function generateGame(mode) {
  const isAdvanced = (mode === 'normal');
  const clueList   = isAdvanced ? ADVANCED_CLUES : INTRO_CLUES;

  for (let attempt = 0; attempt < GEN_MAX_MAP_ATTEMPTS; attempt++) {
    const mapCode    = generateRandomMapCode();
    const boardState = buildBoardState(mapCode);
    const structs    = parseStructures(mapCode);
    const satSets    = computeAllSatisfyingSets(clueList, boardState, structs);
    const allHexKeys = getAllHexes().map(function (h) { return h.col + ',' + h.row; });

    const players = {};
    let success = true;

    // Generate setups for each player count
    const playerCounts = [3, 4, 5, 2];
    for (let pi = 0; pi < playerCounts.length; pi++) {
      const count  = playerCounts[pi];
      const clueN  = count === 2 ? 4 : count; // 2-player uses 4 clues (2 per player)
      const setups = [];

      for (let t = 0; t < GEN_MAX_TARGET_ATTEMPTS && setups.length < GEN_SETUPS_PER_COUNT; t++) {
        const setup = tryGenerateSetup(clueN, clueList, satSets, allHexKeys);
        if (setup !== null) {
          // Avoid duplicate destinations within the same player-count pool
          const duplicate = setups.some(function (s) { return s.destination === setup.destination; });
          if (!duplicate) setups.push(setup);
        }
      }

      if (setups.length === 0) {
        success = false;
        break;
      }

      players[count] = setups;
    }

    if (!success) continue; // Try a different map

    const key = mode === 'intro' ? 'intro_' + mapCode : mapCode;

    return { mapCode, mode, key, players };
  }

  throw new Error('gameGenerator: failed to produce a valid game after ' + GEN_MAX_MAP_ATTEMPTS + ' attempts');
}
