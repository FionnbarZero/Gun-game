# The Resonance Engine

A browser-based 3D first-person sniper arena built with Three.js and Vite.

The colorful pre-match lobby has Play, Shop, and Inventory tabs. Each five-minute contract begins with a `3…2…1` deployment countdown and a default four-slot combat kit: Specter Carbine, Phantom Suppressed sidearm, Combat Knife, and Frag Bomb. The slots are restricted to Primary, one-handed Secondary pistols, Melee, and Other utility gear. Inventory shows only compatible owned equipment for the selected slot. The saved Other collection includes bouncing bombs, a sticky gravity bomb, an adrenaline medkit, a proximity shock mine, pulse charges, and healing medkits.

Damaging targets, landing long-range sniper shots, defeating enemies, and completing contracts awards credits. The lobby shop offers $250 Standard Weapon Cases and $750 Hypershot Elite Cases alongside direct weapon purchases. Cases use a 70% Common, 20% Rare, 8.5% Legendary, and 1.5% Exotic rarity roll, then run through a full spinner and reveal sequence. Rewards include persistent weapon finishes, utility skins, melee variants, and colored weapon trails; duplicate rewards convert into credits. Owned cosmetics can be equipped again from Inventory. Field caches supply ammunition and a smaller credit bonus.

- 10 Normal weapons — ballistic pistols, carbines, shotguns, the Ironclad LMG, and long-range rifles
- 10 Weird weapons — acoustic waves, piercing sonic beams, kinetic knockback, link traps, and distortion weapons
- 10 Crazy weapons — gravity payloads, ricochets, phase technology, orbital mortars, and arena-disrupting prototypes
- 10 Custom weapons — modular hybrids, dual-feed systems, charged sniper frames, elemental launchers, and guided smart-guns
- 10 role-locked Primary weapons — charge snipers, bank-shot rifles, airborne cannons, link DMRs, and guided projectiles
- 10 role-locked Secondary weapons — one-handed pistols with tracking, chaining, knockback, echo fire, and finisher bonuses
- 10 role-locked Melee weapons — momentum blades, grappling hooks, shockwave hammers, launch axes, whips, and timed deflection
- 10 role-locked Other items — pulse discs, bullet barriers, stealth zones, polarity snares, updrafts, decoys, healing clouds, remote charges, return beacons, and ammo fabrication

Scoped weapons use a dedicated precision mode with magnified FOV, reduced look sensitivity, greatly reduced shot spread, and bonus Resonance payouts for hits beyond 60 meters—especially headshots. Several prototype weapons also use specialized systems already active in the arena: piercing beams, explosive splash damage, ricocheting acoustic projectiles, recoil propulsion, magnet links, and wire traps/zip-lines. The expanded arsenal brings the vault to 80 weapon blueprints, plus the starter utility kit.

The lobby now opens with a full three-card map vote and an eight-second tally. Vertigo Grid has two elevated outer Spines, a Sunken Nexus with five rising data blocks, three tall Spires, rooftop bridges, and vertical launch pads. Overgrown Outpost has a river-cut Ravine, sightline-blocking foliage, covered bunkers, an elevated Canopy network, a hollow covered Fallen Titan ramp, and angled Spore Pads. Industrial Foundry has parallel Assembly Line catwalks, three 15-second crane blockers, horizontal piston launchers, a roofed Ventilation Shaft flank, and a Smelter route with rotating platters that tip players into molten metal. Each map retains a recommended Other-slot utility.

The lobby Build tab lets each operator equip two active abilities on `Q` and `E`, plus up to three passive attunements. New active choices include Kinetic Slingshot, Thermal Snapshot, Repulsion Nova, and Quantum Rewind alongside Grapple Slingshot, Temporal Phase Camo, and Decoy Projection. Passives include Aero-Stabilizer, Velocity Conversion, Shadow Step, Apex Predator, Tactical Resilience, Momentum Conservation, Lightweight Frame, and Rebound Shield. The combat HUD tracks both cooldowns and all equipped perks.

## Run locally

```bash
npm install
npm run dev
```

Open the URL shown by Vite and select **Enter the Engine**.

## Controls

- `WASD` or arrow keys — move quickly
- Mouse — aim
- Hold left mouse — aim, raise a sniper scope, or preview a bomb's dotted throwing arc (pistols do not ADS)
- Right mouse — fire or use the equipped item
- `1` — primary rifle or selected vault weapon
- `2` — one-handed secondary pistol
- `3` — combat knife
- `4` — Other gear: bombs, medkits, and proximity mines; the hotbar shows stacks and cooldown
- `Q` / `E` — activate the two selected character abilities
- Mouse wheel — cycle the four equipped slots
- `R` — reload
- `B` — open the 80-weapon vault
- `F` — search a nearby crate or use a wire zip-line
- `H` — toggle hostile mode
- `M` — switch arena
- `Shift` — sprint
- `C` — crouch or momentum slide
- `Space` — jump
- `Esc` — release the mouse

## Production build

```bash
npm run build
```
