# Solmar Heist

[![Make GTA 6](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01) [![Rank](https://make.fun/badge/gta6-01/thanhnam97215/solmar-heist/rank.svg)](https://make.fun/bounty/gta6-01) [![Reward](https://make.fun/badge/gta6-01/thanhnam97215/solmar-heist/reward.svg)](https://make.fun/bounty/gta6-01)

An original 3D open-world crime game set in Solmar Bay, a sun-soaked coastal city. You're a getaway driver with no car and a reputation to build: steal wheels, outrun the Solmar PD under a 1–5 star wanted level, run five story missions for Rico's crew, and pull off the heist the whole bay will talk about.

No install, no network, no build step. Just open the file and play.

## How to run offline

1. Open `game/index.html` in any modern desktop browser (Chrome / Edge / Firefox / Safari) — double-click it, or serve the `game/` folder with any static file server (`node serve.ts` serves it on http://localhost:8080).
2. Click **New Game** and follow the gold marker to your first job.

That is all — the game runs entirely from local files. There are no CDN links, no fonts, images, or API calls. Three.js is vendored locally at `game/vendor/three.module.min.js`.

## How to play

- **Goal:** complete all **5 story missions** and become a Solmar Legend. You can also free-roam the city, steal cars, and see how long you survive at 5 stars.
- **Explore** Solmar Bay on foot or by car: a grid of avenues, a palm-lined beach boulevard, the pier, the harbor, and the Meridian Bank downtown.
- **Steal cars** — walk up to any parked or traffic car and press **E**. If a cop sees you take it, you'll earn a star.
- **Wanted level (1–5 stars):** crimes raise it — running someone over, shooting, ramming a cop car. Police cruisers chase and ram you; at 3+ stars they shoot. Break line of sight to cool down, or get busted standing next to a cruiser on foot.
- **Missions** start at the gold beacon on the map: an intro drive, a getaway with Mara, a timed delivery under police heat, a chase to wreck rival wheelman Vex, and the final bank heist. Each pays cash.
- **Combat:** punch with **F**, shoot the pistol with the **mouse** (12-round mag, **R** reloads).
- **Save:** cash and mission progress save automatically in your browser (localStorage). **Continue** on the title screen picks up where you left off.

### Missions

| # | Job | Brief |
|---|---|---|
| 1 | First Wheels | Steal a car and bring it to Rico's Garage — the job interview. |
| 2 | The Getaway | Pick up Mara at the Sunset Diner and get her to the pier with the cops coming. |
| 3 | Hot Delivery | A crate from the Harbor Warehouse to the Coral Beach Club in 100 seconds. |
| 4 | Harbor Chase | Ram rival wheelman Vex's car until it stops. |
| 5 | The Solmar Heist | Crack the Meridian Bank vault on foot and escape to the safehouse at 4 stars. |

## Controls

- **W A S D / arrows:** move on foot, drive (W accelerate, S brake/reverse, A/D steer).
- **Shift:** sprint on foot.
- **Space:** jump on foot, handbrake while driving.
- **E:** steal / enter / exit a car.
- **Mouse click:** shoot the pistol (on foot). **F:** punch. **R:** reload.
- **Right-mouse drag:** orbit the camera. **Mouse wheel:** zoom.
- **P / Esc:** pause. **M:** sound on/off.

## Features

- Procedural 3D city: ~90 buildings with lit windows, roads with traffic, sidewalks with pedestrians, palms, lamps, beach and ocean, day sun with real-time shadows.
- Full driving model: acceleration, braking, steering, handbrake drifts, crashes, wrecked cars, car-to-car collisions.
- Traffic AI (cars follow lanes, turn at intersections, brake for the car ahead) and pedestrian AI (strolling, fleeing from danger).
- Wanted system with police pursuit, ramming, busts, and heat decay; busted/wasted flow with fines and respawns.
- 5-mission story chain with beacons, objectives, distance readout, timed steps, and a rubber-banded rival chase.
- HUD with live canvas minimap (roads, beach, player arrow, mission marker, flashing cop blips, traffic), wanted stars, cash, health, ammo, speed, and a message feed.
- Synthesized WebAudio sound: engine, sirens, gunfire, crashes, jingles, and a music loop — no audio files.
- Save/load via localStorage; staged screenshot scenes via `?shot=chase|drive|foot|menu`.

## Files

- `game/index.html` — entry point, HUD, start / pause / busted / wasted screens.
- `game/style.css` — all HUD and menu styling (system fonts only).
- `game/src/main.js` — boot, the game loop, screens, car collisions, and action handling.
- `game/src/city.js` — procedural city, collision, beacons.
- `game/src/vehicles.js` — car factory, arcade driving physics, traffic and parked cars.
- `game/src/pedestrians.js` — pedestrian AI and the person factory.
- `game/src/player.js` — on-foot and driving player controller and camera.
- `game/src/police.js` — wanted stars, police pursuit, busts.
- `game/src/combat.js` — pistol raycasts, tracers, punches.
- `game/src/missions.js` — the 5-mission story chain and the rival chase.
- `game/src/hud.js` — HUD, minimap, banners, messages.
- `game/src/audio.js` — synthesized WebAudio sound and music.
- `game/src/effects.js` — particle pool (sparks, smoke, muzzle flashes).
- `game/src/save.js` — localStorage save/load.
- `game/src/shots.js` — staged screenshot scenes (`?shot=…`).
- `game/src/config.js`, `game/src/random.js`, `game/src/input.js` — tuning, seeded RNG, input.
- `game/vendor/three.module.min.js` — vendored three.js r160 (minified build).
- `main.ts` — entrypoint: copies `game/` and `screenshots/` to the output directory and writes `dossier.json` with the vendored make.fun library.
- `screenshots/` — 4 screenshots of the game (chase, drive, on foot, title), taken in a browser.
- `shots.json` — which URL each screenshot was taken from.
- `vendor/makefun-game.ts` — the kit's dossier library, unchanged.
- `README.md` — this file.

## Originality

Solmar Heist was written from scratch for this entry: original city, characters (Rico, Mara, Vex), vehicles, story, art (all procedural geometry and canvas textures), and synthesized sound. No assets, names, characters, maps, art, or music were copied from any existing commercial game.
