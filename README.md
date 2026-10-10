# The Resonance Engine

A browser-based 3D first-person sniper arena built with Three.js and Vite.

The neon pre-match lobby is a complete local operator hub with Play, Shop, Inventory, Build, Challenges, and Settings panels. Its interactive Three.js hero viewport displays the equipped Primary and cosmetic, while the live four-slot strip, build summary, rotating featured weapon, map vote, case spotlight, reactor, and notification feed all connect to the existing game systems. Each five-minute contract begins with a `3…2…1` deployment countdown and a default four-slot combat kit: Specter Carbine, Phantom Suppressed sidearm, Combat Knife, and Frag Bomb. The slots are restricted to Primary, one-handed Secondary pistols, Melee, and Other utility gear. Inventory shows only compatible owned equipment for the selected slot. The saved Other collection includes bouncing bombs, a sticky gravity bomb, an adrenaline medkit, a proximity shock mine, pulse charges, and healing medkits.

Damaging targets, landing long-range sniper shots, defeating enemies, and completing contracts awards credits. The lobby shop offers $250 Standard Weapon Cases and $750 Hypershot Elite Cases alongside direct weapon purchases. Cases use a 70% Common, 20% Rare, 8.5% Legendary, and 1.5% Exotic rarity roll, then run through a full spinner and reveal sequence. Rewards include persistent weapon finishes, utility skins, melee variants, and colored weapon trails; duplicate rewards convert into credits. Owned cosmetics can be equipped again from Inventory. Field caches supply ammunition and a smaller credit bonus.

- 10 Normal weapons — ballistic pistols, carbines, shotguns, the Ironclad LMG, and long-range rifles
- 10 Weird weapons — acoustic waves, piercing sonic beams, kinetic knockback, link traps, and distortion weapons
- 10 Crazy weapons — gravity payloads, ricochets, phase technology, orbital mortars, and arena-disrupting prototypes
- 10 Custom weapons — modular hybrids, dual-feed systems, charged sniper frames, elemental launchers, and guided smart-guns
- 10 role-locked Primary weapons — charge snipers, bank-shot rifles, airborne cannons, link DMRs, and guided projectiles
- 10 role-locked Secondary weapons — one-handed pistols with tracking, chaining, knockback, echo fire, and finisher bonuses
- 10 role-locked Melee weapons — momentum blades, grappling hooks, shockwave hammers, launch axes, whips, and timed deflection
- 10 role-locked Other items — pulse discs, bullet barriers, stealth zones, polarity snares, updrafts, decoys, healing clouds, remote charges, return beacons, and ammo fabrication
- 15 Silly/Chaos weapons — ricochet pizzas, charged fish, AI-bait herrings, tactical toast, breadstick sniping, screaming rail-chickens, banana traps, disco scan fields, healing cake blasts, sticky boba, recoverable gnome turrets, lint disruption, condiment combos, growing shopping carts, and rainbow speed trails
- Glassline Sniper — repeat-hit crystalline marks, immediate headshot shatters, and surface fractures that burst through nearby cover
- Comet Shorty — a two-shell compact shotgun whose recoil can vault the player upward or add forward escape momentum

Scoped weapons use a dedicated precision mode with magnified FOV, reduced look sensitivity, greatly reduced shot spread, and bonus Resonance payouts for hits beyond 60 meters—especially headshots. Several prototype weapons also use specialized systems already active in the arena: piercing beams, explosive splash damage, ricocheting acoustic projectiles, recoil propulsion, magnet links, and wire traps/zip-lines. The Silly/Chaos family uses the same real combat systems for charge shots, physical throwables, AI distraction, reveal fields, traps, knockback, healing, and movement boosts. Golden Pizza, Radioactive Fish, Galaxy Chicken, Diamond Toaster, and Strawberry Bubble Tea finishes can drop from the existing earned-credit cases. The expanded arsenal brings the vault to 97 weapon blueprints, plus the starter utility kit.

Pressing Play starts a full three-card map vote with a ten-second tally, then deploys directly into the selected arena. Solo matches contain exactly one ballot: your vote. Vertigo Grid has two elevated outer Spines, a Sunken Nexus with five rising data blocks, three tall Spires, rooftop bridges, and vertical launch pads. Overgrown Outpost has a river-cut Ravine, sightline-blocking foliage, covered bunkers, an elevated Canopy network, a hollow covered Fallen Titan ramp, and angled Spore Pads. Industrial Foundry has parallel Assembly Line catwalks, three 15-second crane blockers, horizontal piston launchers, a roofed Ventilation Shaft flank, and a Smelter route with rotating platters that tip players into molten metal. Building roofs, bunkers, containers, tower decks, covered-ramp roofs, catwalks, and ventilation roofs are registered as walkable landing surfaces. Each map retains a recommended Other-slot utility.

The lobby Build tab lets each operator equip two active abilities on `Q` and `E`, plus up to three passive attunements. Active choices include Kinetic Slingshot, Thermal Snapshot, Repulsion Nova, Quantum Rewind, Grapple Slingshot, Temporal Phase Camo, Decoy Projection, Vector Dash, and a solid eight-second Hardlight Ramp. Passives include Aero-Stabilizer, Velocity Conversion, Shadow Step, Apex Predator, Tactical Resilience, Momentum Conservation, Lightweight Frame, Rebound Shield, High Ground, and Soft Landing. The combat HUD tracks both cooldowns and all equipped perks.

The Play panel includes an interactive tactical map hologram with known sniper, launch, flank, and hazard landmarks. The Lobby Firing Range is a returnable practice session with 25 m, 60 m, and 100 m target distances, optional moving targets, accuracy, eliminations, and fastest-clear timing; leaving it returns directly to the lobby instead of starting a contract. The Challenges panel rotates three deterministic local contracts at local midnight and includes a persistent trophy wall. The local profile records earned credits, eliminations, headshots, longest confirmed shot, fastest range clear, completed contracts, weapon use, and ability use. Settings persist audio levels, mouse and scope sensitivity, FOV, graphics and shadow quality, camera shake, crosshair appearance, damage-number visibility, reduced motion, and the operator callsign in the existing `resonance-engine-progress` save.

The lobby now has two movement activities. **Chill Deck** is a relaxed, weapon-free social practice space with lounge props, gap jumps, an illuminated vault tutorial, soft checkpoint resets, a saved best time, and a repeatable credit reward. **Parkour Trials** adds three timed variants to the Play route: Neon Velocity across Vertigo Grid, Canopy Circuit through the Fallen Titan and jungle canopy, and Foundry Rush through piston plates and ventilation lanes. Each trial uses bright sequential gates, checkpoint recovery with a three-second fall penalty, movement boosts, bronze/silver/gold targets, credit rewards, persistent personal bests, a restart action, and an immediate Return to Lobby button.

To enter **Chill Deck**, choose `PLAY` in the lobby and select `CHILL DECK`. Use the physical glowing consoles on the lounge platform to restart, return to the main lobby, or transfer into the firing range. To enter a competitive run, choose `PLAY` → `PARKOUR TRIALS`, review the three course cards, select a course, and press its green Start button. During a trial, the HUD identifies the next bright gate, medal pace, progress, and saved best; the HUD restart and Return to Lobby actions remain available at all times.

## Deep combat and progression systems

- Movement actions now build a five-rank style chain from **Flow** through **Perfect Resonance**. Slides, slide-cancels, launch pads, piston plates, grapples, slingshot releases, zip-lines, ramp slides, aerial direction changes, and airborne eliminations extend the chain. Higher ranks accelerate ability recharge, briefly improve reload speed, award small style-credit bonuses, and persist best-combo/style totals.
- Every weapon earns persistent cosmetic-only mastery XP from damage, eliminations, headshots, long shots, executions, and range testing. Levels unlock recorded charm, color, inspect, trail, skin, and golden-badge rewards without increasing weapon damage.
- Selected glass, wood, data, market, factory, vent, and barricade cover has four readable damage states and dependable colliders. Heavy rifles, shotguns, explosives, and piercing weapons break it faster; destroyed cover opens real movement and shot paths while debris stays capped and short-lived.
- Execution medals detect airborne headshots, scoped long shots, secondary finishers, post-grapple melee attacks, post-slide-cancel eliminations, shots through destroyed cover, double pierces, maximum-combo kills, final rounds, Thermal Snapshot kills, moving-platform shots, ricochets, and environmental eliminations.
- Six elite enemies are mixed into the three arenas: Shield Carrier, Grappling Sniper, Shotgun Rusher, Invisible Scout, Medic, and Drone Operator. Each has a distinct color/silhouette, preparation cue, behavior, weakness, and higher credit value while retaining the same line-of-sight and reaction-delay fairness rules as standard enemies.
- Each arena has illuminated limited-ammunition power-weapon stations and player-triggered environmental terminals. Pickups never overwrite the saved four-slot loadout and respawn after 30 seconds. Terminals give a one-second warning and deterministic cooldown before gravity, flood, crane, or steam effects activate.
- Field treasure, first-time executions, mastery milestones, crate duplicates, map-page completion, factory repairs, and Factory Defense award blueprint fragments. Fragment-gated prototypes are assembled in the Factory Research screen rather than bypassed with credits.
- The Collection Book records owned/discovered weapons, weapon mastery, executions, fragments, and twelve proximity-discovered map landmarks without revealing undiscovered secrets.
- Factory Defense is a separate five-wave Foundry mode with storage integrity, four physical maintenance terminals, a deterministic emergency queue, repair windows, scaled enemy durability, persistent best wave, and fragment rewards. Factory emergencies and defense rules never run in normal contracts.

The save key remains `resonance-engine-progress`; older saves are migrated with defaults for weapon mastery, blueprint fragments, discoveries, execution medals, and factory progress.

## Private online multiplayer

The first online milestone is a playable, server-authoritative private 1V1 on Vertigo Grid. Choose **Play → Duels → 1V1**, enter an operator name, then either create a five-character room code or join a friend's code. The match begins automatically when the second player connects, after a server-owned three-second countdown.

The Colyseus room—not either browser—owns player transforms, health, shields, ammunition, reload timing, fire-rate validation, ray hits, eliminations, respawns, score, and the three-minute match clock. The browser predicts its own fixed-step movement, reconciles it against server snapshots, interpolates the other operator, and creates tracers, muzzle effects, audio, and HUD animation locally. Private matches currently use the Specter Carbine so the secure movement/combat loop can be proven before the rest of the 97-weapon vault is migrated.

Start the combined Vite client and Colyseus server:

```bash
npm run dev:multiplayer
```

Open the printed URL in one browser, create a 1V1 room, and open the same URL in a second browser or computer to join with the code. For another computer on the LAN, use Vite's printed Network URL and allow the port through the host firewall if required.

The online production build writes the static frontend to `dist/client` and the Node entry point to `dist/server`:

```bash
npm run build:multiplayer
npm run start:multiplayer
```

For split hosting, publish `dist/client` on the static host, run `dist/server/server.mjs` on a WebSocket-capable Node host, and set `VITE_COLYSEUS_URL` to its public `wss://` endpoint when building the client. The health endpoint is `/api/health`.

Current multiplayer limits are intentional: one region/server process, guest names, private two-player rooms, one flat-ground movement simulation, one map, and the Specter loadout. Accounts, persistent online inventory, complete map collision/vertical traversal, server-side cover occlusion and lag compensation, public matchmaking, parties, abilities, projectiles, NPCs, and the tycoon room are later milestones. Existing single-player saves and modes remain local and unchanged.

## Procedural visual system

The arena presentation uses an original low-poly science-fiction art direction built from reusable Three.js geometry and materials. The central palette, arena atmospheres, deterministic scenery settings, graphics presets, and weapon-family visual definitions live in `src/art-direction.js`.

- Chamfered structural modules catch highlights without changing gameplay colliders or routes.
- Weapon bodies are assembled from category-driven receivers, barrels, stocks, rails, optics, grips, accent panels, and named muzzle/sight/ejection/hand attachment points.
- Every blueprint now supplies its full identity to the visual generator. Weapon class, scope, suppressor, magazine capacity, damage technology, and special behavior select distinct stocks, magazines, muzzles, optics, proportions, panels, and signature geometry instead of producing same-family recolors. Revolvers expose cylinders, automatic shotguns use drums, suppressed weapons extend to their true muzzle, and all ten specialist melee weapons have dedicated silhouettes.
- Seeded instanced mountain ridges, snowcaps, tree lines, cloud banks, and the outpost lake extend each playable arena without collision, picking, or distant shadows.
- A camera-following procedural gradient sky provides a configurable sun disk and atmospheric glow without external skybox assets.
- A fixed tracer/casing/impact pool keeps combat effects bounded; low through ultra presets scale shadows, bloom, effects, cloud visibility, and resolution.
- The existing shooting, movement, damage, collision, enemy, save, and level systems remain unchanged by the visual layer.

## Combat economy and targeting

Crate prices remain fixed at their original ◆250 Standard and ◆750 Elite values. Direct weapon purchases are discounted separately in `src/game-balance.js`. Firearms receive at least 50% more reserve ammunition, while higher-priced blueprints gain a capped premium curve of up to 18% more damage, 12% faster reloads, and 80% more reserve ammunition. Enemy and training-target hits use compact, uninterrupted head and body raycast volumes rather than oversized decorative armor, limb, and accessory meshes.

## Run locally

```bash
npm install
npm run dev
```

Open the URL shown by Vite and select **Enter the Engine**.

## Controls

- `WASD` or arrow keys — move quickly
- Mouse — look
- Left mouse — shoot, throw, swing, place, or activate the equipped item
- Hold right mouse — aim, raise a sniper scope, use a compact pistol zoom, preview a bomb arc, or prepare a melee guard
- `1` — primary rifle or selected vault weapon
- `2` — one-handed secondary pistol
- `3` — combat knife
- `4` — Other gear: bombs, medkits, and proximity mines; the hotbar shows stacks and cooldown
- `Q` / `E` — activate the two selected character abilities
- Mouse wheel — cycle the four equipped slots
- `R` — reload
- `B` — open the 97-weapon vault
- `F` — search a nearby crate, collect a temporary power weapon, activate a map/factory terminal, recover a surviving gnome turret, or use a wire zip-line
- `H` — toggle hostile mode
- `M` — switch arena
- `Shift` — sprint
- `C` — crouch or momentum slide
- `Space` — jump; hold while moving into a low wall to vault over it
- `Esc` — release the mouse

## Production build

```bash
npm run build
```

## Verification

```bash
npm test
npm run build:multiplayer
npm run multiplayer:smoke
npm run visual:smoke
```

`visual:smoke` expects the Vite server and a Chrome remote-debugging endpoint. Override them with `RESONANCE_GAME_URL` and `RESONANCE_CDP_ENDPOINT`; screenshots default to `/tmp/resonance-visual-*.png`.

`multiplayer:smoke` expects `npm run dev:multiplayer` plus a Chrome remote-debugging endpoint (default `http://127.0.0.1:9231`). It creates a room in the real lobby, joins a second SDK client, verifies two synchronized players and one rendered remote operator, and captures `/tmp/resonance-multiplayer-room-code.png` plus `/tmp/resonance-multiplayer-host-live.png`.
