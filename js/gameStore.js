/**
 * gameStore.js — Game store.
 *
 * Manages the in-memory pool of generated game objects.
 *
 * Key responsibilities:
 *  - Generate games client-side on demand
 *  - Serve random games to the game controller
 *
 * Depends on: gameGenerator.js, settings.js
 */

// ---------------------------------------------------------------------------
// GameRecord — a single stored game (one map with setups for all player counts)
// ---------------------------------------------------------------------------

/** @class GameRecord */
function GameRecord() {
  /**
   * Initialise from a plain object.
   * @param {Object} data
   */
  this.create = function (data) {
    this.key     = data.key;
    this.mapCode = data.mapCode;
    this.mode    = data.mode;
    this.players = data.players;
  };

  /**
   * Remove a random setup for the given player count from this record's pool
   * and return it.  Also keeps 4-player and 2-player pools in sync.
   *
   * @param {string} mode    - 'intro' | 'normal' (unused here, kept for compat).
   * @param {number} players - Player count (2–5).
   * @returns {Array|null} The popped setup array, or null if pool is empty.
   */
  this.popRandomSetup = function (mode, players) {
    const pool = this.players[players];
    if (pool.length <= 0) return null;

    const idx = Math.floor(Math.random() * pool.length);
    const popped = pool.splice(idx, 1);

    // 2-player and 4-player share the same pool (identical content, same order).
    // Remove the same index from the mirror pool to keep them in sync.
    if (players == 2 && this.players[4] && idx < this.players[4].length) {
      this.players[4].splice(idx, 1);
    }
    if (players == 4 && this.players[2] && idx < this.players[2].length) {
      this.players[2].splice(idx, 1);
    }

    return popped;
  };
}

// ---------------------------------------------------------------------------
// GameStore — collection of GameRecord objects, one per map/mode
// ---------------------------------------------------------------------------

/** @class GameStore */
function GameStore() {
  let mode = 'normal';
  const modes = ['intro', 'normal'];
  let gameLimit = window.cryptid.settings.get('gameLimit');

  // mode-keyed maps: modes.intro = {}, modes.normal = {}
  modes.intro  = {};
  modes.normal = {};

  // ---------------------------------------------------------------------------
  // Mode
  // ---------------------------------------------------------------------------

  /** @param {string} m - 'intro' | 'normal' */
  this.setMode = function (m) {
    mode = m === 'intro' ? 'intro' : 'normal';
  };

  /** @returns {string} */
  this.getMode = function () {
    return mode;
  };

  // ---------------------------------------------------------------------------
  // Counting
  // ---------------------------------------------------------------------------

  /**
   * @param {string} m - Mode key.
   * @returns {number}
   */
  this.countGames = function (m) {
    let count = 0;
    for (const key in modes[m]) {
      count++;
    }
    return count;
  };

  // ---------------------------------------------------------------------------
  // Fill / replace
  // ---------------------------------------------------------------------------

  /**
   * Ensure every stored game has setups for all player counts; generate
   * replacements for any that are exhausted.
   */
  this.replaceEmpty = async function () {
    for (let mi = 0; mi < modes.length; mi++) {
      const modeKey = modes[mi].toString();
      const modeStore = modes[modeKey];
      for (const key in modeStore) {
        const record = modeStore[key];
        let needsReplacement = false;
        for (let p = 3; p < 6; p++) {
          if (record.players[p].length <= 0) {
            needsReplacement = true;
          }
        }
        if (needsReplacement) {
          await this.fetchGame(modeKey);
        }
      }
    }
  };

  /**
   * Fill the store with generated games until gameLimit is reached.
   */
  this.fillGameStore = async function () {
    for (let mi = 0; mi < modes.length; mi++) {
      const modeKey = modes[mi].toString();
      let failures = 0;
      while (this.countGames(modeKey) < gameLimit && failures < 5) {
        let success = false;
        try {
          success = await this.fetchGame(modeKey);
        } catch (err) {
          console.log(err);
        }
        if (!success) {
          failures++;
        }
      }
    }
  };

  // ---------------------------------------------------------------------------
  // Server fetch
  // ---------------------------------------------------------------------------

  /**
   * Generate one game client-side for the given mode (replaces the PHP fetch).
   * @param {string} fetchMode - 'intro' | 'normal'
   * @returns {Promise<boolean>}
   */
  this.fetchGame = function (fetchMode) {
    const self = this;
    return new Promise(function (resolve, reject) {
      try {
        const data = generateGame(fetchMode);
        self.storeGame(data);
        resolve(true);
      } catch (err) {
        console.error('gameGenerator error:', err);
        reject('loading_err_unknown');
      }
    });
  };

  // ---------------------------------------------------------------------------
  // Initial generation (intro + normal)
  // ---------------------------------------------------------------------------

  /**
   * Generate one game for each mode (intro and normal).
   * Called once during app initialisation.
   * @throws {Error} If generation fails.
   */
  this.generateInitialGames = function () {
    this.storeGame(generateGame('normal'));
    this.storeGame(generateGame('intro'));
  };

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  /**
   * @param {string} m - Mode key.
   * @returns {string[]} Array of map codes already in the store for this mode.
   */
  this.modeMapCodes = function (m) {
    const codes = [];
    for (const key in modes[m]) {
      codes.push(key);
    }
    return codes;
  };

  /**
   * Add a game to the in-memory store.
   * @param {Object|GameRecord} data
   */
  this.storeGame = function (data) {
    const record = new GameRecord();
    record.create(data);
    modes[record.mode][record.key] = record;
  };

  /**
   * Return a random game that has at least one setup for the given player count.
   * @param {string} m       - 'intro' | 'normal'
   * @param {number} players - Player count (2–5)
   * @returns {GameRecord|null}
   */
  this.getRandomGame = function (m, players) {
    const modeKey   = m === 'intro' ? 'intro' : 'normal';
    const modeStore = modes[modeKey];
    const eligible  = [];

    for (const key in modeStore) {
      const record = modeStore[key];
      if (record.players[players].length > 0) {
        eligible.push(record.key);
      }
    }

    if (eligible.length <= 0) return null;
    const chosen = Math.floor(Math.random() * eligible.length);
    return modes[modeKey][eligible[chosen]];
  };

  /** @returns {Object} Raw mode store object. */
  this.getGameStore = function () {
    return modes;
  };

  /**
   * Generate a game on-the-fly with the same tile layout but new random
   * structure positions.  Used by the "keep map" feature when the current
   * game's setups are exhausted.
   *
   * @param {string} tileKey - First 6 chars of the current map code.
   * @param {string} m       - 'intro' | 'normal'
   * @returns {GameRecord|null}
   */
  this.generateWithTileKey = function (tileKey, m) {
    const data = generateGameWithTileKey(tileKey, m);
    if (!data) return null;
    const record = new GameRecord();
    record.create(data);
    return record;
  };

  /**
   * Clear the store and regenerate.
   */
  this.resetStore = function () {
    modes.intro  = {};
    modes.normal = {};
    gameLimit = window.cryptid.settings.get('gameLimit');
    this.fillGameStore();
  };
}
