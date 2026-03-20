/**
 * gameStore.js — Game store.
 *
 * Manages the pool of available pre-generated game objects, fetched from
 * the server (PHP backend) or restored from localforage offline storage.
 *
 * Key responsibilities:
 *  - Fetch game data from getGame.php
 *  - Persist/restore game data via localforage
 *  - Serve random games to the game controller
 *  - Report offline availability status
 *
 * Depends on: jQuery, localforage, settings.js
 */

// ---------------------------------------------------------------------------
// GameRecord — a single stored game (one map with setups for all player counts)
// ---------------------------------------------------------------------------

/** @class GameRecord */
function GameRecord() {
  /**
   * Initialise from a plain object (server JSON or localforage entry).
   * @param {Object} data
   */
  this.create = function (data) {
    this.key     = data.key;
    this.mapCode = data.mapCode;
    this.mode    = data.mode;
    this.players = data.players;
    this.save();
  };

  /** @returns {boolean} True if this game has two-player setups. */
  this.hasTwoPlayer = function () {
    return this.players.hasOwnProperty('2');
  };

  /** Persist this game to localforage if storage is allowed. */
  this.save = function () {
    const payload = {
      key:     this.key,
      mapCode: this.mapCode,
      mode:    this.mode,
      players: this.players,
    };
    if (window.cryptid.settings.get('store')) {
      localforage.setItem(this.key, payload).catch(function (err) {
        console.log(err);
      });
    }
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

    // Keep 2-player and 4-player pools deduplicated against each other
    if (players == 2) {
      const rulesKey = popped[0].rules.join(',');
      this.players[4] = this.players[4].filter(function (setup) {
        return rulesKey !== setup.rules.join(',');
      });
    }
    if (players == 4) {
      const rulesKey = popped[0].rules.join(',');
      this.players[2] = this.players[2].filter(function (setup) {
        return rulesKey !== setup.rules.join(',');
      });
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

  // Error key map for HTTP status codes from the server
  const HTTP_ERRORS = {
    0:   'loading_err_unknown',
    404: 'loading_err_404',
    500: 'loading_err_server',
    503: 'loading_err_server_unavailable',
    502: 'loading_err_gateway',
    504: 'loading_err_gateway',
  };

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
   * Ensure every stored game has setups for all player counts; fetch replacements
   * for any that are missing.
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
          const fetched = await this.fetchGame(modeKey);
          if (fetched) {
            localforage.removeItem(record.key);
          }
        }
      }
    }
  };

  /**
   * Persist all games in all modes to localforage.
   */
  this.commitToStorage = function () {
    for (let i = 0; i < modes.length; i++) {
      const modeKey = modes[i].toString();
      for (const key in modes[modeKey]) {
        modes[modeKey][key].save();
      }
    }
  };

  /** Clear all localforage data. */
  this.removeFromStorage = function () {
    localforage.clear();
  };

  /**
   * Fill the store with games fetched from the server until gameLimit is reached.
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
   * Fetch one game from the PHP backend for the given mode.
   * @param {string} fetchMode - 'intro' | 'normal'
   * @returns {Promise<boolean>}
   */
  this.fetchGame = function (fetchMode) {
    const self = this;
    const params = {
      mode: fetchMode,
      mapsUsed: this.modeMapCodes(fetchMode),
    };
    return new Promise(function (resolve, reject) {
      $.getJSON('php/getGame.php', params)
        .done(function (data) {
          self.storeGame(data);
          resolve(true);
        })
        .fail(function (xhr) {
          const status = xhr.status || 0;
          let errorKey;
          if (xhr.readyState === 4) {
            errorKey = HTTP_ERRORS[status] || 'loading_err_unknown';
          } else if (xhr.readyState === 0) {
            errorKey = 'loading_err_network';
          } else {
            errorKey = 'loading_err_unknown';
          }
          reject(errorKey);
        });
    });
  };

  // ---------------------------------------------------------------------------
  // Local storage restore
  // ---------------------------------------------------------------------------

  /**
   * Restore all games from localforage.
   * @returns {Promise<boolean>} Resolves true if at least one intro AND one normal game were found.
   */
  this.restoreFromLocal = function () {
    const self = this;
    let introCount = 0;
    let normalCount = 0;
    const invalidKeys = [];

    return new Promise(function (resolve, reject) {
      localforage.iterate(function (value, key) {
        let valid = true;

        if (!value.hasOwnProperty('key')) {
          valid = false;
        }
        try {
          if (value.players[3][0].rules[0].indexOf(' ') !== -1) {
            valid = false;
          }
        } catch (e) {
          valid = false;
        }

        if (valid) {
          const record = new GameRecord();
          record.create(value);
          self.storeGame(record);
          if (record.mode === 'intro') {
            introCount++;
          } else {
            normalCount++;
          }
        } else {
          invalidKeys.push(key);
        }
      })
        .then(function () {
          for (const k in invalidKeys) {
            localforage.removeItem(invalidKeys[k]);
          }
        })
        .then(function () {
          resolve(introCount >= 1 && normalCount >= 1);
        })
        .catch(function () {
          reject(false);
        });
    });
  };

  // ---------------------------------------------------------------------------
  // Fetch from server (intro + normal)
  // ---------------------------------------------------------------------------

  /**
   * Fetch one game for each mode (intro and normal).
   * @returns {Promise<boolean>}
   */
  this.fetchFromServer = async function () {
    const normalOk = await this.fetchGame('normal');
    const introOk  = await this.fetchGame('intro');
    if (!introOk || !normalOk) {
      return false;
    }
    return true;
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

  /** @returns {boolean} True when localforage has a driver available. */
  this.offlineAvailable = function () {
    return localforage.driver !== null;
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
   * Gather offline summary information.
   * @returns {Promise<Object>}
   */
  this.summaryInfo = function () {
    const self = this;
    return new Promise(function (resolve, reject) {
      const info = {};
      info.offline = self.offlineAvailable();
      info.storage = localforage.driver();
      let introOffline = 0;
      let normalOffline = 0;

      try {
        localforage.keys().then(function (keys) {
          for (const k in keys) {
            if (keys[k].includes('intro')) {
              introOffline++;
            }
          }
          normalOffline = keys.length - introOffline;
          info.counts = {
            standard:        self.countGames('intro'),
            advanced:        self.countGames('normal'),
            offlineStandard: introOffline,
            offlineAdvanced: normalOffline,
          };
          resolve(info);
        });
      } catch (err) {
        reject(err);
      }
    });
  };

  /**
   * Clear the store and refetch from server.
   */
  this.resetStore = function () {
    localforage.clear();
    modes.intro  = {};
    modes.normal = {};
    gameLimit = window.cryptid.settings.get('gameLimit');
    this.fillGameStore();
  };

  /**
   * Check if any stored normal game has two-player setups.
   * @returns {boolean}
   */
  this.hasTwoPlayer = function () {
    const firstKey = Object.keys(modes.normal)[0];
    return modes.normal[firstKey].hasTwoPlayer();
  };

  /**
   * Debug helper: remove two-player setups from all stored games.
   */
  this.testDropTwo = function () {
    for (const mi in modes) {
      const modeStore = modes[modes[mi]];
      for (const key in modeStore) {
        const record = modeStore[key];
        if (record.hasTwoPlayer()) {
          delete record.players[2];
          record.save();
        }
      }
    }
  };
}
