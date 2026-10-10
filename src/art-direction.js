/**
 * Resonance visual language.
 *
 * Keep world, weapon, effects, and UI colors here so the art direction can be
 * tuned without hunting through gameplay code. Values are original to this
 * project and intentionally avoid matching any single reference palette.
 */
export const ART_PALETTE = Object.freeze({
  structurePrimary: 0x18263a,
  structureSecondary: 0x31475b,
  neutralMetal: 0x8296a3,
  grip: 0x0f1822,
  playerAccent: 0x55e6cf,
  enemyAccent: 0xff5968,
  interactive: 0xffd166,
  hazard: 0xff7548,
  glass: 0x79dff2,
  concrete: 0x718294,
  paintedGreen: 0x466d62,
  paintedRed: 0xa04d5d,
  vegetationDark: 0x245342,
  vegetationMid: 0x3f7651,
  vegetationLight: 0x78a95e,
  bark: 0x5b4538,
  rock: 0x596575,
  snow: 0xe4edf1,
  water: 0x2c8295,
  cloud: 0xe8f3f2,
  skyHorizon: 0xb6d9df,
  skyZenith: 0x3d6f9d,
  sun: 0xffe4ad,
});

export const ARENA_ATMOSPHERES = Object.freeze([
  Object.freeze({
    horizon: 0x8a86be,
    zenith: 0x26375f,
    fog: 0x4e527c,
    ground: 0x4a5365,
    sun: 0xffd6a3,
    sunDirection: [-0.44, 0.72, -0.54],
  }),
  Object.freeze({
    horizon: 0xb6d8c7,
    zenith: 0x4c7790,
    fog: 0x77978c,
    ground: 0x5b685f,
    sun: 0xffe7b0,
    sunDirection: [-0.56, 0.69, -0.46],
  }),
  Object.freeze({
    horizon: 0xc5a79a,
    zenith: 0x536579,
    fog: 0x806f72,
    ground: 0x55545c,
    sun: 0xffd3a0,
    sunDirection: [-0.36, 0.79, -0.5],
  }),
]);

export const SCENERY_CONFIG = Object.freeze({
  seed: 0x5e50a11,
  landscapeRadius: 142,
  mountainCount: 18,
  mountainHeight: [28, 66],
  treeCount: 64,
  treeHeight: [7, 15],
  cloudCount: 15,
  cloudAltitude: [54, 86],
  fogDensity: [0.0022, 0.00265, 0.00235],
});

export const QUALITY_PRESETS = Object.freeze({
  low: Object.freeze({ pixelRatio: 0.6, shadowMap: 0, effects: 0.45, bloom: false, scenery: 0.55 }),
  medium: Object.freeze({ pixelRatio: 0.85, shadowMap: 512, effects: 0.72, bloom: true, scenery: 0.78 }),
  high: Object.freeze({ pixelRatio: 1.25, shadowMap: 1024, effects: 1, bloom: true, scenery: 1 }),
  ultra: Object.freeze({ pixelRatio: 1.5, shadowMap: 2048, effects: 1, bloom: true, scenery: 1 }),
});

export const WEAPON_VISUALS = Object.freeze({
  rifle: Object.freeze({ receiver: 0.76, barrel: 0.72, stock: 0.5, rail: true, optic: 'compact', magazine: 'curved', mass: 1 }),
  pistol: Object.freeze({ receiver: 0.52, barrel: 0.28, stock: 0, rail: false, optic: 'iron', magazine: 'grip', mass: 0.64 }),
  smg: Object.freeze({ receiver: 0.58, barrel: 0.4, stock: 0.32, rail: true, optic: 'reflex', magazine: 'straight', mass: 0.78 }),
  shotgun: Object.freeze({ receiver: 0.62, barrel: 0.94, stock: 0.52, rail: false, optic: 'bead', magazine: 'tube', mass: 1.08 }),
  sniper: Object.freeze({ receiver: 0.82, barrel: 1.08, stock: 0.56, rail: true, optic: 'scope', magazine: 'box', mass: 1.04 }),
  lmg: Object.freeze({ receiver: 0.86, barrel: 0.92, stock: 0.48, rail: true, optic: 'reflex', magazine: 'drum', mass: 1.18 }),
  rail: Object.freeze({ receiver: 0.96, barrel: 1.08, stock: 0.46, rail: true, optic: 'scope', magazine: 'cell', mass: 1.12 }),
  launcher: Object.freeze({ receiver: 0.7, barrel: 0.68, stock: 0.44, rail: true, optic: 'reflex', magazine: 'cell', mass: 1.16 }),
  knife: Object.freeze({ receiver: 0.18, barrel: 0.76, stock: 0, rail: false, optic: 'none', magazine: 'none', mass: 0.5 }),
});

export function seededRandom(seed = SCENERY_CONFIG.seed) {
  let value = seed >>> 0;
  return () => {
    value += 0x6d2b79f5;
    let mixed = value;
    mixed = Math.imul(mixed ^ (mixed >>> 15), mixed | 1);
    mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), mixed | 61);
    return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296;
  };
}

