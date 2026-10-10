import test from 'node:test';
import assert from 'node:assert/strict';
import { LOBBY_PARKOUR, formatParkourTime, isVaultableObstacle, parkourReward } from '../src/lobby-parkour.js';

test('parkour pays a full reward initially and a smaller repeat reward during cooldown',()=>{
  assert.deepEqual(parkourReward(100_000,0),{amount:LOBBY_PARKOUR.reward,fullReward:true});
  assert.deepEqual(parkourReward(120_000,100_000),{amount:LOBBY_PARKOUR.repeatReward,fullReward:false});
  assert.deepEqual(parkourReward(160_000,100_000),{amount:LOBBY_PARKOUR.reward,fullReward:true});
});

test('vaulting accepts low thin walls with a clear landing',()=>{
  assert.equal(isVaultableObstacle({feetY:4,minY:4,maxY:5.2,depth:.8,onGround:true,movingForward:true,landingClear:true}),true);
  assert.equal(isVaultableObstacle({feetY:4,minY:4,maxY:7,depth:.8,onGround:true,movingForward:true,landingClear:true}),false);
  assert.equal(isVaultableObstacle({feetY:4,minY:4,maxY:5.2,depth:.8,onGround:true,movingForward:true,landingClear:false}),false);
});

test('parkour time is shown in seconds',()=>{
  assert.equal(formatParkourTime(12_345),'12.35S');
});
