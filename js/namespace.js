/**
 * namespace.js — Initialise the window.cryptid global namespace.
 *
 * Must be the first cryptid script loaded.  All other modules attach
 * their exports to this object.
 */
window.cryptid = {};
window.cryptid.cryptid_version = '3f.20230310.1';

// Placeholders so references in other modules don't throw before init
window.cryptid.map       = undefined;
window.cryptid.game      = {};
window.cryptid.settings  = {};
window.cryptid.soundMngr = undefined;
window.cryptid.myTut     = {};
window.cryptid.menu      = {};
window.cryptid.map_arrays = [];
