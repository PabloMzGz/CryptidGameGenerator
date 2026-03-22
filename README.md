# Cryptid Companion — Client-Side Fork

A browser-based companion app for the [Cryptid](https://ospreypublishing.com/uk/cryptid-9781472830654/) board game by Osprey Games.

This fork removes the original server dependency entirely. All game generation runs in JavaScript directly in the browser, making it deployable as a fully static site with no backend required.

## What it does

The app helps players set up and run a game of Cryptid:

- Generates a valid game setup: map layout, structure placement, clue assignments, and habitat location
- Shows each player their secret clue one at a time (pass-the-device model)
- Displays the hex map on screen
- Supports 2–5 players in both normal and advanced mode
- Reveals the habitat and all clues at the end of the game
- Generates shareable URLs so players can open their own clue on their own device (`?game=CODE&player=N`)

## Differences from the original

The original companion site at [playcryptid.com](https://www.playcryptid.com/) relies on a PHP backend that serves pre-generated game data. This fork replaces that with a client-side game generation engine written in plain JavaScript, making it possible to host on GitHub Pages or any static file host with no server-side processing.

Other changes:
- Removed dependency on `localforage` (no longer needed without server caching)
- Added a compact shareable game code system for async/remote play
- Simplified the settings UI

## How to use

Visit the hosted site, select your player count and mode, and press **Start**. Pass the device around for each player to see their clue privately. Use **Share** to generate per-player links if playing remotely.

To run locally, just open `index.html` in a browser — no build step or server required.

---

## Disclaimers and attribution

**This project is an unofficial, fan-made tool and is not affiliated with, endorsed by, or produced by Osprey Games or any of the original creators of Cryptid.**

- **Cryptid** is a board game designed by Hal Duncan and Ruth Veevers, published by [Osprey Games](https://ospreypublishing.com/uk/osprey-games/). All game rules, artwork, and intellectual property related to Cryptid belong to their respective owners.
- The original companion website ([playcryptid.com](https://www.playcryptid.com/)) was created by its respective author(s). This fork is based on the publicly accessible front-end of that site. No proprietary server-side code was accessed or copied.
- Game artwork assets (tile images, structure images, UI graphics) are sourced from the original site and remain the property of their respective copyright holders.
- This project is intended solely for personal, non-commercial use to support players who already own the Cryptid board game.

If you are a rights holder and have concerns about this project, please open an issue or contact the repository owner directly.
