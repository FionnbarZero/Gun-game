# The Resonance Engine

A browser-based 3D first-person sniper arena built with Three.js and Vite.

The neon pre-match lobby is a complete local operator hub with Play, Shop, Inventory, Build, Challenges, and Settings panels. Its interactive Three.js hero viewport displays the equipped Primary and cosmetic, while the live four-slot strip, build summary, rotating featured weapon, case spotlight, reactor, and notification feed all connect to the existing game systems. Pressing Play opens a mode chooser for Main Game, Duels, and the Chill Deck; selecting Main Game opens a three-map picker for Vertigo Grid, Overgrown Outpost, and Industrial Foundry. Choosing a map deploys immediately without a voting detour. Each five-minute contract begins with a `3…2…1` deployment countdown and a default four-slot combat kit: Specter Carbine, Phantom Suppressed sidearm, Combat Knife, and Frag Bomb. The slots are restricted to Primary, one-handed Secondary pistols, Melee, and Other utility gear. Inventory shows only compatible owned equipment for the selected slot. The saved Other collection includes bouncing bombs, a sticky gravity bomb, an adrenaline medkit, a proximity shock mine, pulse charges, and healing medkits.

Damaging targets, landing long-range sniper shots, defeating enemies, and completing contracts awards credits. The lobby Shop now contains Standard Skin (◆250), Neon Arsenal (◆750), complete Skin Kit (◆1,500 or a Kit Key), earned Map Vault, and Silly Supply (◆500) cases. Standard and Neon cases visibly disclose their exact 70% Common, 20% Rare, 8.5% Legendary, and 1.5% Exotic odds; every case selects and saves its reward before the spinner begins, prefers unowned rewards, converts unavoidable duplicates into Cosmetic Shards, and guarantees Legendary-or-better by opening 20. The same data-driven catalog supports guaranteed direct purchases and shard crafting, so cases are never the only acquisition path.

Inventory has Weapons, Skins, Skin Kits, Charms, Tracers, Kill FX, and Collections tabs with weapon, rarity, collection, ownership, recent, and favorite filters. Skins equip per weapon without unlocking or changing that weapon, while charms, tracers, and Kill FX use independent cosmetic slots. Kill FX appear only after a locally authoritative hostile defeat or a confirmed online elimination; practice-target hits never trigger them. Enter Chill Deck and use the violet **Preview Equipped Kill FX** chamber to test an owned effect without earning credits or statistics. Gold parkour medals grant a one-time Kit Key per course, match victories grant Map Vault keys, completed daily challenge sets grant a cosmetic, and factory milestones can grant Foundry cosmetics. The Accessibility settings can show full, reduced, or no other-player Kill FX.

Premium cosmetics are component-authored designs rather than flat recolors. Vertigo Phantom, Overgrown Hunter, Foundry Destroyer, Hyperpop, Deep Space, Pizza Champion, and Red Fish separately style the receiver, secondary panels, trim, scope, magazine, and muzzle, then add a quality-scaled animated detail and matching inspect cue. The lobby hero viewer supports drag rotation, wheel zoom, Inspect, Fire, Reload, Scope, and three lighting modes. Case openings use a distinct physical silhouette and staged presentation for Standard, Neon Arsenal, Skin Kit, Map Vault, and Silly Supply families. `Cosmetic Quality` and `Reduced Cosmetic Motion` keep these effects scalable without changing any weapon statistic, hitbox, muzzle transform, or scope accuracy.

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

Pressing Play opens the mode chooser instead of sending the player to a voting area. Choose Main Game to select Vertigo Grid, Overgrown Outpost, or Industrial Foundry and deploy directly; choose Duels for private-team options or Chill Deck to enter the connected social and movement hub. Vertigo Grid has two elevated outer Spines, a Sunken Nexus with five rising data blocks, three tall Spires, rooftop bridges, and vertical launch pads. Overgrown Outpost has a river-cut Ravine, sightline-blocking foliage, covered bunkers, an elevated Canopy network, a hollow covered Fallen Titan ramp, and angled Spore Pads. Industrial Foundry has parallel Assembly Line catwalks, three 15-second crane blockers, horizontal piston launchers, a roofed Ventilation Shaft flank, and a Smelter route with rotating platters that tip players into molten metal. Building roofs, bunkers, containers, tower decks, covered-ramp roofs, catwalks, and ventilation roofs are registered as walkable landing surfaces. Each map retains a recommended Other-slot utility.

The lobby Build tab lets each operator equip two active abilities on `Q` and `E`, plus up to three passive attunements. Active choices include Kinetic Slingshot, Thermal Snapshot, Repulsion Nova, Quantum Rewind, Grapple Slingshot, Temporal Phase Camo, Decoy Projection, Vector Dash, and a solid eight-second Hardlight Ramp. Passives include Aero-Stabilizer, Velocity Conversion, Shadow Step, Apex Predator, Tactical Resilience, Momentum Conservation, Lightweight Frame, Rebound Shield, High Ground, and Soft Landing. The combat HUD tracks both cooldowns and all equipped perks.

The Lobby Firing Range is a returnable practice session with 25 m, 60 m, and 100 m target distances, optional moving targets, accuracy, eliminations, and fastest-clear timing; leaving it returns directly to the lobby instead of starting a contract. The Challenges panel rotates three deterministic local contracts at local midnight and includes a persistent trophy wall. The local profile records earned credits, eliminations, headshots, longest confirmed shot, fastest range clear, completed contracts, weapon use, and ability use. Settings persist audio levels, mouse and scope sensitivity, FOV, graphics and shadow quality, camera shake, crosshair appearance, damage-number visibility, reduced motion, and the operator callsign in the existing `resonance-engine-progress` save.

**Chill Deck** is one connected, weapon-free social and movement hub built on a 56×40 social platform with perimeter terminals and an obstacle-free center lane. It retains solid lounge seating, a reactive dance floor, animated Resonance Engine hologram, robotic-fish aquarium, trophy deck, drone route to a rooftop garden, gap jumps, wall-running, ledge grabbing, illuminated vault tutorial, blue jump and green boost training pads, soft checkpoint resets, a saved best time, and a repeatable credit reward. Three one-time color-button secrets award small credit bonuses and open the local treasure-vault reward. A broad Parkour Campus is built directly into the main lobby: Neon Velocity, Canopy Circuit, and Foundry Rush occupy three physical course wings spaced 56 world units apart, with color-coded concourse strips, wide starts, collision-backed platforms, recovery floors, checkpoint connectors, and continuous blue return walkways. Each timed run uses bright sequential gates, collectible treasure, checkpoint recovery with a three-second fall penalty, movement boosts, bronze/silver/gold targets, a local personal-best ghost, persistent records, restart, and Return to Lobby actions.

To enter **Chill Deck**, choose `PLAY` and select `CHILL DECK`. Walk east across the wide Parkour Campus concourse, then use `F` at the Neon, Canopy, or Foundry start terminal. The run begins in that same physical wing—there is no separate parkour map or course-selection screen. Use `F` at other glowing consoles to restart the casual route, return to the main lobby, enter the firing range, open a lobby destination, or reveal a secret. During a timed trial, the HUD identifies the next bright cyan gate, active variant, medal pace, treasure count, progress, and saved best; the HUD restart and Return to Lobby actions remain available at all times.

The new **Resonance Central Hub** physically connects those systems. Use the green `CHILL DECK` button in the bottom navigation to spawn in the Central Atrium, then follow the colored in-world floor lines and signs: blue reaches Matchmaking and the Play mode chooser, magenta reaches the Armory and crate chamber, purple reaches Inventory and the Ability Lab, red reaches the returnable Firing Range, green crosses the solid aquarium skybridge to the Chill Deck, gold marks challenges and parkour, and orange reaches the cargo elevator for Factory Defense. Matchmaking, Armory, Firing Range, Ability Lab, Factory access, and the Atrium have collision-backed wall shells with centered doorway gaps; the outdoor Chill Deck and parkour campus remain open-air. Every bridge overlaps its destination platform and has solid railings. Press `F` at terminals to open the existing interface or destination. Parkour runs launched from the deck and range sessions entered from the hub return to the physical hub instead of dropping the player at an unrelated screen.

Jumping is release-driven: press `Space` to charge and release it to jump. The crosshair ring changes from white through cyan and purple to gold at the 0.75-second maximum. A quick release gives a normal jump; sprinting and slide releases retain more momentum. Sprint alongside a cyan-marked vertical wall to wall-run, then charge and release `Space` for a wall jump. Release near a low obstacle to vault, release near a taller ledge to mantle, or catch a missed ledge and release again to climb. `C` drops from a ledge and, when pressed shortly before a fast landing, performs a momentum-preserving roll. Parkour Assist in Settings expands detection and input buffering without raising maximum speed or changing medal targets; Disable Camera Roll and Reduce Motion remove wall-run roll.

The shared traversal obstacle kit includes tic-tac walls, monkey bars, swinging poles, grind rails, precision pads, crumbling platforms, rotating beams, momentum rings, rope-style grapple swings, directional bounce walls, balance beams, moving ladders, air vents, bomb-breakable shortcuts, and optional treasures. Neon Velocity emphasizes charge, vault, slide-jump, wall-run, rail, and landing flow; Canopy Circuit uses grapple arcs, ledges, branch vaults, opposing walls, bars, and a maximum-charge treasure; Foundry Rush combines lava wall-runs, moving mantles, piston vaults, rotating machinery, vents, and momentum rings.

Every trial now has a signed **MAIN ROUTE — SAFE** with platforms at least three player-capsules wide, checkpoints before major mechanics and after short obstacle groups, blue recovery routes, and no required moving-platform or disappearing-platform jumps. Neon Velocity uses three fixed rooftops and a lower wall-run bypass, Canopy Circuit uses stationary branch collision and lower grapple/wall-run paths, and Foundry Rush uses slower warned machinery plus a safe industrial lane. Red/gold expert and purple treasure shortcuts always reconnect to the main route. Falls pause briefly, clear charged-jump and wall-run state, then restore the latest checkpoint. Parkour Assist adds visible trajectories, landing guidance, longer coyote time, more forgiving detection, and a small edge correction only when the player is already close to a main-route landing; assisted records are stored on a separate local board. Each finish platform connects to a physical blue walkway back to the Chill Deck, and the completion screen also provides an immediate Return to Lobby button.

Parkour surface colors are consistent across the hub and trials: cyan is a checkpoint, green is a speed boost, blue is a vertical jump pad, orange is a horizontal launcher, purple is a grapple point, yellow is moving machinery, red is a hazard, gold is a secret or treasure, and white/slate is ordinary solid footing. Trial medal rewards are ◆250 Gold, ◆125 Silver, ◆75 Bronze, and ◆50 Completion. The medal payout is granted once per course per UTC day; later finishes award ◆15 so players can keep racing without making the timed routes an unlimited large-credit farm. Chill Deck keeps its separate ◆75/◆20 short-run reward cadence.

The variant schedule changes deterministically every four hours and is displayed before deployment. Reverse routing, low gravity, no-mistakes restarts, collectible hunts, crosswind, fast grapple recovery, grounded/no-grapple rules, and Foundry overdrive feed directly into the movement simulation. Personal ghosts are stored locally with existing save data. Friends' ghosts and weekly global leaderboards require the online account/leaderboard service and are not presented as live data in this local milestone.

## Deep combat and progression systems

- Movement actions now build a five-rank style chain from **Flow** through **Perfect Resonance**. Slides, slide-cancels, launch pads, piston plates, grapples, slingshot releases, zip-lines, ramp slides, aerial direction changes, and airborne eliminations extend the chain. Higher ranks accelerate ability recharge, briefly improve reload speed, award small style-credit bonuses, and persist best-combo/style totals.
- Every weapon earns persistent cosmetic-only mastery XP from damage, eliminations, headshots, long shots, executions, and range testing. Levels unlock recorded charm, color, inspect, trail, skin, and golden-badge rewards without increasing weapon damage.
- Selected glass, wood, data, market, factory, vent, and barricade cover has four readable damage states and dependable colliders. Heavy rifles, shotguns, explosives, and piercing weapons break it faster; destroyed cover opens real movement and shot paths while debris stays capped and short-lived.
- Execution medals detect airborne headshots, scoped long shots, secondary finishers, post-grapple melee attacks, post-slide-cancel eliminations, shots through destroyed cover, double pierces, maximum-combo kills, final rounds, Thermal Snapshot kills, moving-platform shots, ricochets, and environmental eliminations.
- Six elite enemies are mixed into the three arenas: Shield Carrier, Grappling Sniper, Shotgun Rusher, Invisible Scout, Medic, and Drone Operator. Each has a distinct color/silhouette, preparation cue, behavior, weakness, and higher credit value while retaining the same line-of-sight and reaction-delay fairness rules as standard enemies.
- Enemy difficulty changes perception, timing, aim error, burst length, and attacker limits instead of padding health. Training, Easy, Normal, and Hard enemies use patrol, investigate, react, aim, fire, reload, search, and take-cover states; they remember only a last-known position after losing line of sight, turn at bounded speeds, consume real magazines, and are forced to miss after difficulty-specific hit streaks. Snipers telegraph their shot and every profile keeps a nonzero miss rate. Optional AI and parkour debug overlays expose state, vision, aim error, reaction time, ammo, route lines, colliders, checkpoint order, and recovery zones.
- Each arena has illuminated limited-ammunition power-weapon stations and player-triggered environmental terminals. Pickups never overwrite the saved four-slot loadout and respawn after 30 seconds. Terminals give a one-second warning and deterministic cooldown before gravity, flood, crane, or steam effects activate.
- Field treasure, first-time executions, mastery milestones, crate duplicates, map-page completion, factory repairs, and Factory Defense award blueprint fragments. Fragment-gated prototypes are assembled in the Factory Research screen rather than bypassed with credits.
- The Collection Book records owned/discovered weapons, weapon mastery, executions, fragments, and twelve proximity-discovered map landmarks without revealing undiscovered secrets.
- Factory Defense is a separate five-wave Foundry mode with storage integrity, four physical maintenance terminals, a deterministic emergency queue, repair windows, scaled enemy durability, persistent best wave, and fragment rewards. Factory emergencies and defense rules never run in normal contracts.

The save key remains `resonance-engine-progress`; older saves are migrated with defaults for weapon mastery, blueprint fragments, discoveries, execution medals, and factory progress.

## Private online multiplayer

The first online milestone is a playable, server-authoritative private 1V1 on Vertigo Grid. Choose **Play → Duels → 1V1**, enter an operator name, then either create a five-character room code or join a friend's code. The match begins automatically when the second player connects, after a server-owned three-second countdown, and ends at five eliminations or the three-minute time limit.

The Colyseus room—not either browser—owns player transforms, health, shields, spawn protection, ammunition, reload timing, fire-rate validation, ray hits, duplicate-safe elimination IDs, respawns, score, and the three-minute match clock. The browser predicts its own fixed-step movement, reconciles it against server snapshots, interpolates the other operator, and creates tracers, muzzle effects, audio, Kill FX, and HUD animation locally. Remote robots blend server-owned idle, walk, sprint, jump, fall, slide, aim, reload, and defeated states instead of synchronizing animation frames. Dropped connections retain the same server player for a 25-second reconnection window. Private matches currently use the Specter Carbine so the secure movement/combat loop can be proven before the rest of the 97-weapon vault is migrated.

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

For split hosting, publish `dist/client` on the static host, run `dist/server/server.mjs` on a WebSocket-capable Node host, and set `VITE_MULTIPLAYER_URL` to its public `wss://` endpoint when building the client. `VITE_COLYSEUS_URL` remains a backward-compatible alias. The health endpoint is `/api/health`; never put secrets in either `VITE_` variable because Vite exposes them to the browser.

Current multiplayer limits are intentional: one region/server process, guest names, private two-player rooms, one flat-ground movement simulation, one map, and the Specter loadout. Accounts, persistent online inventory, complete map collision/vertical traversal, server-side cover occlusion and lag compensation, public matchmaking, parties, abilities, projectiles, NPCs, and the tycoon room are later milestones. Existing single-player saves and modes remain local and unchanged.

## Procedural visual system

The arena presentation uses an original low-poly science-fiction art direction built from reusable Three.js geometry and materials. The central palette, arena atmospheres, deterministic scenery settings, graphics presets, and weapon-family visual definitions live in `src/art-direction.js`.

- `src/visual-definition-system.js` expands every weapon into shared scope, animation, material, effect, sound, attachment, and quality-fallback profiles. The same module defines bounded three-phase Kill FX, physical crate families, and ability presentation states instead of scattering those rules through individual items.
- Chamfered structural modules catch highlights without changing gameplay colliders or routes.
- Weapon bodies are assembled from category-driven receivers, barrels, stocks, rails, optics, grips, accent panels, and named muzzle, sight, casing, hand, charm, trigger, bolt, slide, pump, charging-handle, feed-cover, and emitter transforms.
- Every blueprint now supplies its full identity to the visual generator. Weapon class, scope, suppressor, magazine capacity, damage technology, and special behavior select distinct stocks, magazines, muzzles, optics, proportions, panels, and signature geometry instead of producing same-family recolors. Revolvers expose cylinders, automatic shotguns use drums, suppressed weapons extend to their true muzzle, and all ten specialist melee weapons have dedicated silhouettes.
- Aim-down-sights placement is calculated from each model's explicit sight anchor and current model/weapon transform. Scoped aiming hides unsafe charms and decorations, suppresses scope-flooding muzzle light and casings, and prevents duplicate first-person weapon rendering. Enable **Scope Debug** in Settings to compare the projected sight anchor, reticle center, and actual center shot ray.
- Fire, empty/full reload, equip, aim-enter, and aim-exit events drive reusable weapon animation state. Ballistic and energy categories visibly use the appropriate slide, cylinder, pump, bolt, charging handle, feed cover, rotating emitter, trigger, or heat-vent behavior while ammunition and hit logic remain unchanged.
- Seeded instanced mountain ridges, snowcaps, tree lines, cloud banks, and the outpost lake extend each playable arena without collision, picking, or distant shadows.
- A camera-following procedural gradient sky provides a configurable sun disk and atmospheric glow without external skybox assets.
- Fixed tracer, casing, impact, and Kill FX pools keep combat effects bounded. Low through ultra visual profiles scale particles, skin animation, cosmetic lights, distant character work, environment motion, shadows, bloom, cloud visibility, and resolution. **Reduced UI Motion** disables nonessential lobby and reward transitions independently of camera motion.
- The existing shooting, damage, enemy, save, and level systems remain intact; advanced traversal extends the original swept-capsule movement and collision controller in place.

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
- `C` — crouch, momentum slide, pre-landing roll, or ledge drop
- Hold `Space`, then release — charged jump; releasing near a low wall vaults, near a ledge mantles, and during a wall-run performs a wall jump
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
npm run visual:realism
```

`visual:smoke` expects the Vite server and a Chrome remote-debugging endpoint. Override them with `RESONANCE_GAME_URL` and `RESONANCE_CDP_ENDPOINT`; screenshots default to `/tmp/resonance-visual-*.png`.

`visual:realism` performs a focused pass over every weapon and scope definition, exercises representative slide, pump, bolt, feed-cover, and energy-chamber animation states, verifies pooled Kill FX limits, and captures unobstructed hip-fire and sight-alignment debug frames in `/tmp/resonance-realism-*.png`.

`multiplayer:smoke` expects `npm run dev:multiplayer` plus two Chrome remote-debugging endpoints (defaults `http://127.0.0.1:9231` and `http://127.0.0.1:9232`). Override them with `RESONANCE_CDP_ENDPOINT` and `RESONANCE_GUEST_CDP_ENDPOINT`. It drives two full game pages through room-code joining, movement, five server-confirmed elimination/respawn cycles, and a score-limit result, then captures `/tmp/resonance-multiplayer-host-live.png` and `/tmp/resonance-multiplayer-guest-victory.png`.
