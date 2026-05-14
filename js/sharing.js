/**
 * sharing.js — Game code encoding/decoding & URL parameter handling.
 *
 * Provides:
 *  - encodeGame / decodeGame : compact hex game codes
 *  - findTarget              : recompute target hex from clues
 *  - buildPlayerUrls         : generate per-player share URLs
 *  - parseUrlParams          : read ?lang / ?game / ?player from the URL
 *  - applyUrlParams          : bootstrap the app from URL parameters
 *  - copyCode                : copy the current game code to clipboard
 *
 * Exposed as window.cryptid.sharing.
 *
 * Depends on: mapData.js (getAllHexes, parseStructures, buildBoardState,
 *             hexSatisfiesClue), gameGenerator.js (deriveHint), game.js
 */

// ---------------------------------------------------------------------------
// Master clue list — position = 2-hex-char code in the game code
// ---------------------------------------------------------------------------

/** @type {string[]} */
const CLUE_LIST = [
  'within_forest',             // 00
  'within_water',              // 01
  'within_swamp',              // 02
  'within_mountain',           // 03
  'within_desert',             // 04
  'within_animal',             // 05
  'within_animal_cougar',      // 06
  'within_animal_bear',        // 07
  'within_stone',              // 08
  'within_shack',              // 09
  'within_green',              // 0a
  'within_blue',               // 0b
  'within_white',              // 0c
  'within_black',              // 0d
  'desert_or_swamp',           // 0e
  'forest_or_mountain',        // 0f
  'forest_or_swamp',           // 10
  'mountain_or_swamp',         // 11
  'water_or_desert',           // 12
  'water_or_forest',           // 13
  'water_or_swamp',            // 14
  'water_or_mountain',         // 15
  'forest_or_desert',          // 16
  'desert_or_mountain',        // 17
  // Advanced negations
  'not_within_forest',         // 18
  'not_within_water',          // 19
  'not_within_swamp',          // 1a
  'not_within_mountain',       // 1b
  'not_within_desert',         // 1c
  'not_within_animal',         // 1d
  'not_within_animal_cougar',  // 1e
  'not_within_animal_bear',    // 1f
  'not_within_stone',          // 20
  'not_within_shack',          // 21
  'not_within_green',          // 22
  'not_within_blue',           // 23
  'not_within_white',          // 24
  'not_within_black',          // 25
  'not_desert_or_swamp',       // 26
  'not_forest_or_mountain',    // 27
  'not_forest_or_swamp',       // 28
  'not_mountain_or_swamp',     // 29
  'not_water_or_desert',       // 2a
  'not_water_or_forest',       // 2b
  'not_water_or_swamp',        // 2c
  'not_water_or_mountain',     // 2d
  'not_forest_or_desert',      // 2e
  'not_desert_or_mountain',    // 2f
];

// ---------------------------------------------------------------------------
// Encoding / decoding
// ---------------------------------------------------------------------------

/**
 * Game code formats:
 *
 * Version 1 (plain hex):
 *   [0]    version  — '1'
 *   [1]    mode     — '0' intro | '1' advanced
 *   [2]    players  — '2'–'5'
 *   [3–24] mapKey   — 22-char raw key (no 'intro_' prefix)
 *   [25+]  clues    — 2 chars per clue; count = players (4 clues for 2-player)
 *   Total lengths: 3p=31, 4p=33, 2p=33, 5p=35
 *
 * Version 2 (obfuscated hex):
 *   [0]    version  — '2'
 *   [1–4]  salt     — 4 hex chars (16-bit random seed)
 *   [5+]   payload  — v1 payload XOR'd with keystream from salt
 *   Total lengths: v1 length + 4 chars
 *
 * Version 3 (short, base64url — default):
 *   [0]    version  — '3'
 *   [1+]   payload  — v1 payload (bytes after '1') encoded as base64url
 *   Total lengths: 3p=21, 4p=23, 2p=23, 5p=24
 */

/**
 * XOR each byte of hexStr with a keystream derived from salt16 (LCG).
 * @param {string} hexStr  - Hex string with even length.
 * @param {number} salt16  - 16-bit seed value.
 * @returns {string} XOR'd hex string, same length as input.
 */
function _xorHexStream(hexStr, salt16) {
  let s = salt16 & 0xFFFF;
  let result = '';
  for (let i = 0; i < hexStr.length; i += 2) {
    s = (1664525 * s + 1013904223) & 0xFFFF;
    const keyByte = s & 0xFF;
    const dataByte = parseInt(hexStr.substring(i, i + 2), 16);
    result += ('0' + (dataByte ^ keyByte).toString(16)).slice(-2);
  }
  return result;
}

// ---------------------------------------------------------------------------
// Base64url helpers for v3 encoding
// ---------------------------------------------------------------------------

function _hexToBytes(hexStr) {
  const bytes = new Uint8Array(hexStr.length / 2);
  for (let i = 0; i < hexStr.length; i += 2) {
    bytes[i / 2] = parseInt(hexStr.substring(i, i + 2), 16);
  }
  return bytes;
}

function _bytesToHex(bytes) {
  let hex = '';
  for (let i = 0; i < bytes.length; i++) {
    hex += ('0' + bytes[i].toString(16)).slice(-2);
  }
  return hex;
}

function _bytesToBase64url(bytes) {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

function _base64urlToBytes(str) {
  const base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64 + '='.repeat((4 - base64.length % 4) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/**
 * Encode a v1 code as a compact base64url v3 code.
 * @param {string} v1Code
 * @returns {string}
 */
function _encodeV3(v1Code) {
  return '3' + _bytesToBase64url(_hexToBytes(v1Code.substring(1)));
}

/**
 * Decode a v3 code back to a v1 code.
 * @param {string} code
 * @returns {string|null}
 */
function _decodeV3(code) {
  try {
    return '1' + _bytesToHex(_base64urlToBytes(code.substring(1)));
  } catch (e) {
    return null;
  }
}

/**
 * Wrap a v1 code in v2 obfuscation using a random salt.
 * @param {string} v1Code - A valid version-1 game code.
 * @returns {string} Version-2 obfuscated game code.
 */
function _encodeV2(v1Code) {
  const payload = v1Code.substring(1); // strip '1' version byte
  const salt16  = Math.floor(Math.random() * 0x10000);
  const saltStr = ('000' + salt16.toString(16)).slice(-4);
  return '2' + saltStr + _xorHexStream(payload, salt16);
}

/**
 * Unwrap a v2 code back to a v1 code.
 * @param {string} code - A version-2 game code.
 * @returns {string|null} Recovered v1 code, or null if malformed.
 */
function _decodeV2(code) {
  if (code.length < 6) return null;
  const saltStr = code.substring(1, 5);
  const salt16  = parseInt(saltStr, 16);
  if (isNaN(salt16)) return null;
  return '1' + _xorHexStream(code.substring(5), salt16);
}

/**
 * Encode the current game into a shareable code string.
 *
 * @param {string}   mapKey      - Map key (may carry 'intro_' prefix).
 * @param {string}   mode        - 'intro' | 'normal'
 * @param {number}   playerCount - 2–5
 * @param {string[]} rules       - Ordered clue keys (one per player; 4 for 2p).
 * @param {string}   [format]    - 'short' (default, base64url v3), 'obfuscated' (XOR hex v2), 'plain' (hex v1).
 * @returns {string} Game code.
 * @throws {Error} If a clue key is not in CLUE_LIST.
 */
function encodeGame(mapKey, mode, playerCount, rules, format) {
  const rawKey    = mapKey.replace('intro_', '');
  const modeChar  = mode === 'intro' ? '0' : '1';
  const plyrChar  = playerCount.toString(16);

  const clueStr = rules.map(function (r) {
    const idx = CLUE_LIST.indexOf(r);
    if (idx < 0) throw new Error('Unknown clue key: ' + r);
    return ('0' + idx.toString(16)).slice(-2);
  }).join('');

  const v1Code = '1' + modeChar + plyrChar + rawKey + clueStr;
  if (format === 'plain')      return v1Code;
  if (format === 'obfuscated') return _encodeV2(v1Code);
  return _encodeV3(v1Code); // default: 'short'
}

/**
 * Decode a game code string. Handles v1 (plain), v2 (obfuscated) and v3 (short base64url).
 *
 * @param {string} code
 * @returns {{mapKey:string, mode:string, playerCount:number, rules:string[], hint:string}|null}
 *   Returns null if the code is malformed or references unknown clues.
 */
function decodeGame(code) {
  try {
    if (!code) return null;

    const version = code.charAt(0);

    if (version === '3') {
      if (code.length < 21) return null;
      const v1Code = _decodeV3(code);
      if (!v1Code) return null;
      return decodeGame(v1Code);
    }

    if (version === '2') {
      if (code.length < 35) return null;
      const v1Code = _decodeV2(code);
      if (!v1Code) return null;
      return decodeGame(v1Code);
    }

    if (code.length < 31) return null;
    if (version !== '1') return null;

    const mode = code.charAt(1) === '0' ? 'intro' : 'normal';

    const playerCount = parseInt(code.charAt(2), 16);
    if (playerCount < 2 || playerCount > 5) return null;

    // 22-char map key starts at position 3
    const rawKey = code.substring(3, 25);
    const mapKey = mode === 'intro' ? 'intro_' + rawKey : rawKey;

    // Clue count: 2-player uses 4 clues (2 per player), others use playerCount
    const clueCount = playerCount === 2 ? 4 : playerCount;
    const clueChars = code.substring(25);
    if (clueChars.length !== clueCount * 2) return null;

    const rules = [];
    for (let i = 0; i < clueCount; i++) {
      const idx = parseInt(clueChars.substring(i * 2, i * 2 + 2), 16);
      if (isNaN(idx) || idx >= CLUE_LIST.length) return null;
      rules.push(CLUE_LIST[idx]);
    }

    const hint = deriveHint(rules);

    return { mapKey, mode, playerCount, rules, hint };
  } catch (e) {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Target resolution
// ---------------------------------------------------------------------------

/**
 * Find the unique hex on the board that satisfies every clue in rules.
 *
 * @param {string}   mapKey - Full map key (with or without 'intro_' prefix).
 * @param {string[]} rules  - Array of clue keys.
 * @returns {string|null} "col,row" of the target hex, or null if not found.
 */
function findTarget(mapKey, rules) {
  const boardState = buildBoardState(mapKey);
  const allStructs = parseStructures(mapKey);
  const structs    = mapKey.startsWith('intro_')
    ? allStructs.filter(function (s) { return s.color !== 'black'; })
    : allStructs;
  const hexes      = getAllHexes();

  for (let i = 0; i < hexes.length; i++) {
    const h = hexes[i];
    const ok = rules.every(function (rule) {
      return hexSatisfiesClue(h.col, h.row, rule, boardState, structs);
    });
    if (ok) return h.col + ',' + h.row;
  }
  return null;
}

// ---------------------------------------------------------------------------
// URL helpers
// ---------------------------------------------------------------------------

/**
 * Parse URL query parameters.
 *
 * @returns {{lang:string|null, game:string|null, player:string|null}}
 */
function parseUrlParams() {
  const result = { lang: null, game: null, player: null };
  const search = window.location.search.substring(1);
  if (!search) return result;

  search.split('&').forEach(function (part) {
    const eqIdx = part.indexOf('=');
    if (eqIdx < 0) return;
    const key = decodeURIComponent(part.substring(0, eqIdx));
    const val = decodeURIComponent(part.substring(eqIdx + 1));
    if (key in result) result[key] = val;
  });

  return result;
}

/**
 * Update (or remove) a single query parameter in the current URL without
 * triggering a page reload.
 *
 * @param {string}      key   - Parameter name ('lang', 'game', 'player', …).
 * @param {string|null} value - New value, or null to remove the parameter.
 */
function setUrlParam(key, value) {
  if (!window.history || !window.history.replaceState) return;

  const current = parseUrlParams();
  if (value !== null && value !== undefined && value !== '') {
    current[key] = value;
  } else {
    delete current[key];
  }

  const parts = [];
  if (current.lang)   parts.push('lang='   + encodeURIComponent(current.lang));
  if (current.game)   parts.push('game='   + encodeURIComponent(current.game));
  if (current.player) parts.push('player=' + encodeURIComponent(current.player));

  const search = parts.length ? '?' + parts.join('&') : '';
  window.history.replaceState({}, document.title, window.location.pathname + search);
}

/**
 * Build per-player share URLs for a game code.
 *
 * For 4-player games also includes paired player URLs (12, 34).
 * The current UI language is included in each URL when available.
 *
 * @param {string} gameCode
 * @returns {Array<{label:string, tpnum:number|null, url:string}>}
 */
function buildPlayerUrls(gameCode) {
  const decoded = decodeGame(gameCode);
  if (!decoded) return [];

  const base    = window.location.href.split('?')[0];
  const n       = decoded.playerCount;
  const lang    = window.cryptid.settings && window.cryptid.settings.get('lang');
  const langPfx = lang ? 'lang=' + encodeURIComponent(lang) + '&' : '';
  const entries = [];

  if (n === 2) {
    // 2-player games use 4 clues: player 1 gets clues 1&2, player 2 gets clues 3&4
    entries.push({
      label: 'player_1',
      tpnum: 1,
      url:   base + '?' + langPfx + 'game=' + gameCode + '&player=12',
    });
    entries.push({
      label: 'player_2',
      tpnum: 2,
      url:   base + '?' + langPfx + 'game=' + gameCode + '&player=34',
    });
  } else {
    for (let p = 1; p <= n; p++) {
      entries.push({
        label: 'player_' + p,
        tpnum: p,
        url:   base + '?' + langPfx + 'game=' + gameCode + '&player=' + p,
      });
    }

    if (n === 4) {
      entries.push({
        label: 'share_players_12',
        tpnum: null,
        url:   base + '?' + langPfx + 'game=' + gameCode + '&player=12',
      });
      entries.push({
        label: 'share_players_34',
        tpnum: null,
        url:   base + '?' + langPfx + 'game=' + gameCode + '&player=34',
      });
    }
  }

  return entries;
}

/**
 * Build the full shareable game URL (lang + game, no player).
 * @param {string} gameCode
 * @returns {string}
 */
function buildGameUrl(gameCode) {
  const base    = window.location.href.split('?')[0];
  const lang    = window.cryptid.settings && window.cryptid.settings.get('lang');
  const langPfx = lang ? 'lang=' + encodeURIComponent(lang) + '&' : '';
  return base + '?' + langPfx + 'game=' + gameCode;
}

/**
 * Copy the full game URL (with lang, without player) to the clipboard.
 * The URL is read from #shareCodeCopy's data-copyurl attribute.
 * Falls back to prompt() on older browsers.
 */
function copyCode() {
  const url = $('#shareCodeCopy').attr('data-copyurl');
  if (!url) return;

  const btn = $('#shareCodeCopy');
  if (navigator.clipboard) {
    navigator.clipboard.writeText(url).then(function () {
      btn.data('tkey', 'share_copied');
      translateElement(btn);
      setTimeout(function () {
        btn.data('tkey', 'share_copy_link');
        translateElement(btn);
      }, 2000);
    });
  } else {
    window.prompt(translateString('share_title', null), url);
  }
}

/**
 * Copy just the raw game code text when the user clicks the code div.
 */
function copyCodeText() {
  const code = $('#shareCode').text();
  if (!code) return;

  const el = $('#shareCode');
  if (navigator.clipboard) {
    navigator.clipboard.writeText(code).then(function () {
      el.addClass('share-code-copied');
      setTimeout(function () { el.removeClass('share-code-copied'); }, 1000);
    });
  } else {
    window.prompt(translateString('share_code_label', null), code);
  }
}

// ---------------------------------------------------------------------------
// Bootstrap
// ---------------------------------------------------------------------------

/**
 * Read URL parameters and apply them.
 * Called once from app.js after the game controller is initialised.
 */
function applyUrlParams() {
  const params = parseUrlParams();

  if (params.lang) {
    // Save to settings so buildGameUrl / refreshSharePanel see the correct lang.
    // settings.set fires the lang listener which calls switchLanguage internally.
    if (window.cryptid.settings) {
      window.cryptid.settings.set('lang', params.lang);
    } else {
      switchLanguage(params.lang);
    }
  }

  if (params.game) {
    const decoded = decodeGame(params.game);
    if (decoded) {
      window.cryptid.game.loadFromSharedCode(decoded, params.player || null);
    }
  }
}

// ---------------------------------------------------------------------------
// Namespace export
// ---------------------------------------------------------------------------

window.cryptid.sharing = {
  encodeGame,
  decodeGame,
  findTarget,
  buildGameUrl,
  buildPlayerUrls,
  copyCode,
  copyCodeText,
  parseUrlParams,
  setUrlParam,
  applyUrlParams,
};
