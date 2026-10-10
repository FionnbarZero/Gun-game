import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  INPUT_FLAGS,
  NETWORK_ARENA,
  normalizeDirection,
  normalizeNetworkName,
  normalizeRoomCode,
  raySphereDistance,
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
    assert.equal(player.x, NETWORK_ARENA.maxX);
    assert.ok(Math.hypot(player.vx, player.vz) <= 12.00001);
    assert.ok(player.z < 0);
  });

  it('performs bounded server ray intersections', () => {
    const hit = raySphereDistance({ x:0,y:0,z:0 }, { x:0,y:0,z:-1 }, { x:0,y:0,z:-10 }, 1, 20);
    assert.equal(hit, 9);
    assert.equal(raySphereDistance({ x:0,y:0,z:0 }, { x:1,y:0,z:0 }, { x:0,y:0,z:-10 }, 1, 20), null);
  });
});
