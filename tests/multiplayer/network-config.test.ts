import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  INPUT_FLAGS,
  NETWORK_ARENA,
  NETWORK_COLLIDERS,
  networkAnimationState,
  networkPositionBlocked,
  networkRayObstacleDistance,
  normalizeDirection,
  normalizeNetworkName,
  normalizeRoomCode,
  raySphereDistance,
  resolveNetworkPlayerOverlaps,
  stepNetworkPlayer,
  viewDirectionFromAngles,
} from '../../shared/network-config.js';

describe('shared authoritative simulation', () => {
  it('sanitizes public names and private room codes', () => {
    assert.equal(normalizeNetworkName('<script> Fionn!'), 'script Fionn');
    assert.equal(normalizeNetworkName(''), 'OPERATOR');
    assert.equal(normalizeRoomCode(' a7-k9q-more '), 'A7K9Q');
  });

  it('normalizes valid shot directions and rejects forged magnitudes', () => {
    assert.deepEqual(normalizeDirection({ x:0, y:0, z:-1 }), { x:0, y:0, z:-1 });
    assert.equal(normalizeDirection({ x:0, y:0, z:-50 }), null);
    assert.equal(normalizeDirection({ x:0, y:0, z:0 }), null);
    const forward=viewDirectionFromAngles(0,0);
    assert.equal(Math.abs(forward.x),0);assert.equal(forward.y,0);assert.equal(forward.z,-1);
  });

  it('keeps movement bounded and prevents diagonal speed boosts', () => {
    const player = { x:NETWORK_ARENA.maxX-.01, y:NETWORK_ARENA.groundY, z:0, vx:0, vy:0, vz:0, yaw:0, onGround:true, alive:true };
    stepNetworkPlayer(player, { moveX:1, moveZ:1, flags:INPUT_FLAGS.sprint, yaw:0, pitch:0 }, 1);
    assert.equal(player.x, NETWORK_ARENA.maxX-.45);
    assert.ok(Math.hypot(player.vx, player.vz) <= 12.00001);
    assert.ok(player.z < 0);
  });

  it('derives compact animation states from authoritative movement facts', () => {
    const player = { alive:true, reloading:false, onGround:true, vy:0, vx:0, vz:0, movementSpeed:0 };
    assert.equal(networkAnimationState(player, 0), 'idle');
    assert.equal(networkAnimationState(player, INPUT_FLAGS.aim), 'aim');
    player.movementSpeed = 8;
    assert.equal(networkAnimationState(player, INPUT_FLAGS.sprint), 'sprint');
    assert.equal(networkAnimationState(player, INPUT_FLAGS.crouch), 'slide');
    player.onGround = false; player.vy = 2;
    assert.equal(networkAnimationState(player, 0), 'jump');
    player.vy = -2;
    assert.equal(networkAnimationState(player, 0), 'fall');
    player.alive = false;
    assert.equal(networkAnimationState(player, 0), 'defeated');
  });

  it('performs bounded server ray intersections', () => {
    const hit = raySphereDistance({ x:0,y:0,z:0 }, { x:0,y:0,z:-1 }, { x:0,y:0,z:-10 }, 1, 20);
    assert.equal(hit, 9);
    assert.equal(raySphereDistance({ x:0,y:0,z:0 }, { x:1,y:0,z:0 }, { x:0,y:0,z:-10 }, 1, 20), null);
  });

  it('blocks authored map walls while preserving building doorways',()=>{
    assert.ok(NETWORK_COLLIDERS.length>=20);
    assert.equal(networkPositionBlocked(-305,-35,.45),true);
    assert.equal(networkPositionBlocked(-294,-18,.45),false);
    assert.equal(networkPositionBlocked(-220,-22,.45),true);
    const distance=networkRayObstacleDistance({x:-300,y:1.6,z:-10},{x:0,y:0,z:-1},100);
    assert.ok(distance>7&&distance<9);
  });

  it('keeps authoritative players from overlapping each other',()=>{
    const first={x:-220,y:NETWORK_ARENA.groundY,z:0,alive:true};
    const second={x:-219.6,y:NETWORK_ARENA.groundY,z:0,alive:true};
    resolveNetworkPlayerOverlaps([first,second]);
    assert.ok(Math.hypot(first.x-second.x,first.z-second.z)>=1.099);
  });
});
