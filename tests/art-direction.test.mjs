import test from 'node:test';
import assert from 'node:assert/strict';
import { ART_PALETTE, ARENA_ATMOSPHERES, QUALITY_PRESETS, SCENERY_CONFIG, WEAPON_VISUALS, seededRandom } from '../src/art-direction.js';

test('the central art palette covers every gameplay visual role',()=>{
  for(const role of ['structurePrimary','structureSecondary','neutralMetal','grip','playerAccent','enemyAccent','interactive','hazard','vegetationDark','skyHorizon','rock','water'])assert.equal(Number.isInteger(ART_PALETTE[role]),true,role);
  assert.notEqual(ART_PALETTE.playerAccent,ART_PALETTE.enemyAccent);
  assert.notEqual(ART_PALETTE.interactive,ART_PALETTE.hazard);
});

test('procedural placement is deterministic and normalized',()=>{
  const a=seededRandom(SCENERY_CONFIG.seed),b=seededRandom(SCENERY_CONFIG.seed);
  const first=Array.from({length:32},()=>a()),second=Array.from({length:32},()=>b());
  assert.deepEqual(first,second);assert.equal(first.every(value=>value>=0&&value<1),true);
});

test('quality presets scale monotonically and keep low-cost low mode',()=>{
  assert.ok(QUALITY_PRESETS.low.pixelRatio<QUALITY_PRESETS.medium.pixelRatio);
  assert.ok(QUALITY_PRESETS.medium.pixelRatio<QUALITY_PRESETS.high.pixelRatio);
  assert.ok(QUALITY_PRESETS.high.shadowMap<QUALITY_PRESETS.ultra.shadowMap);
  assert.equal(QUALITY_PRESETS.low.bloom,false);
});

test('atmospheres and core weapon families are fully configured',()=>{
  assert.equal(ARENA_ATMOSPHERES.length,3);
  for(const atmosphere of ARENA_ATMOSPHERES)assert.equal(atmosphere.sunDirection.length,3);
  for(const family of ['rifle','pistol','smg','shotgun','sniper','lmg','rail','launcher','knife'])assert.ok(WEAPON_VISUALS[family],family);
});

