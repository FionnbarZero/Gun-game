import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, it } from 'node:test';
import { boot, type ColyseusTestServer } from '@colyseus/testing';
import appConfig from '../../server/app.config.js';
import type { MatchRoom } from '../../server/rooms/MatchRoom.js';
import type { MatchInput, MatchState } from '../../server/schema/MatchState.js';

describe('private MatchRoom', () => {
  let colyseus: ColyseusTestServer<typeof appConfig>;

  before(async () => { colyseus = await boot(appConfig); });
  after(async () => { await colyseus.shutdown(); });
  beforeEach(async () => { await colyseus.cleanup(); });

  it('creates a private five-character room and sanitizes guest names', async () => {
    const room = await colyseus.createRoom<MatchRoom>('private_match', {});
    const client = await colyseus.connectTo(room, { name:'<ACE!>' });
    assert.match(room.roomId, /^[A-HJ-NP-Z2-9]{5}$/);
    assert.equal(room.maxClients, 2);
    assert.equal(room.state.players.get(client.sessionId)?.name, 'ACE');
    assert.equal(room.state.phase, 'waiting');
  });

  it('starts a server countdown only after the second player joins', async () => {
    const room = await colyseus.createRoom<MatchRoom>('private_match', {});
    await colyseus.connectTo(room, { name:'ONE' });
    assert.equal(room.state.phase, 'waiting');
    await colyseus.connectTo(room, { name:'TWO' });
    assert.equal(room.state.phase, 'countdown');
    assert.ok(room.state.countdownEndsAt > Date.now());
  });

  it('moves from buffered inputs without accepting client positions', async () => {
    const room = await colyseus.createRoom<MatchRoom>('private_match', {});
    const client = await colyseus.connectTo(room, { name:'RUNNER' });
    room.state.phase = 'playing';
    room.state.matchEndsAt = Date.now() + 60_000;
    const player = room.state.players.get(client.sessionId)!;
    const startZ = player.z;
    const input = client.input<MatchInput>({ mode:'reliable' });
    input.data.moveX = 0; input.data.moveZ = 100 as any; input.data.flags = 0; input.data.yaw = 0; input.data.pitch = 0;
    input.send();
    await room.waitForNextMessage();
    await room.waitForNextTimestep();
    assert.ok(player.z < startZ);
    assert.ok(startZ - player.z < 1, 'sanitized movement advances at one fixed server step');
  });

  it('validates fire rate, ammunition, direction, and damage on the server', async () => {
    const room = await colyseus.createRoom<MatchRoom>('private_match', {});
    const shooterClient = await colyseus.connectTo(room, { name:'SHOOTER' });
    const targetClient = await colyseus.connectTo(room, { name:'TARGET' });
    room.state.phase = 'playing';
    room.state.matchEndsAt = Date.now() + 60_000;
    const shooter = room.state.players.get(shooterClient.sessionId)!;
    const target = room.state.players.get(targetClient.sessionId)!;
    shooter.x = -220; shooter.y = 1.75; shooter.z = 10; shooter.yaw = 0; shooter.pitch = 0;
    target.x = -220; target.y = 1.75; target.z = 0;

    shooterClient.send('fire', { weaponId:'specter', direction:{ x:0,y:0,z:-1 }, timestamp:0 });
    await room.waitForNextMessage();
    assert.equal(shooter.ammo, 29);
    assert.equal(target.shield, 0);
    assert.equal(target.health, 97, 'eye-level ray is validated as a headshot');

    shooterClient.send('fire', { weaponId:'specter', direction:{ x:0,y:0,z:-1 }, timestamp:Number.MAX_SAFE_INTEGER });
    await room.waitForNextMessage();
    assert.equal(shooter.ammo, 29, 'server rejects a shot inside the fire-rate window');
    assert.equal(target.shield, 0);
    assert.equal(target.health, 97);

    await new Promise(resolve => setTimeout(resolve, 120));
    shooterClient.send('fire', { weaponId:'specter', direction:{ x:0,y:0,z:-50 }, timestamp:0 });
    await room.waitForNextMessage();
    assert.equal(shooter.ammo, 29, 'server rejects a forged direction vector');
    assert.equal(target.shield, 0);
    assert.equal(target.health, 97);
  });
});
