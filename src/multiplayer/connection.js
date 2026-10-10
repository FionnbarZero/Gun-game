import { Callbacks, ColyseusSDK } from '@colyseus/sdk';
import { Predict } from '@colyseus/sdk/predict';
import { normalizeNetworkName, normalizeRoomCode, stepNetworkPlayer } from '../../shared/network-config.js';

function defaultEndpoint() {
  if (import.meta.env.VITE_COLYSEUS_URL) return import.meta.env.VITE_COLYSEUS_URL;
  return `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}`;
}

export class OnlineMatchClient {
  constructor(handlers = {}, endpoint = defaultEndpoint()) {
    this.handlers = handlers;
    this.client = new ColyseusSDK(endpoint);
    this.room = null;
    this.predict = null;
    this.input = null;
    this.self = null;
    this.callbacks = null;
    this.lastPhase = '';
  }

  get connected() { return Boolean(this.room); }
  get sessionId() { return this.room?.sessionId ?? ''; }
  get roomCode() { return this.room?.roomId ?? ''; }

  async create(name) {
    return this.connect(() => this.client.create('private_match', { name:normalizeNetworkName(name) }));
  }

  async join(code, name) {
    const roomCode = normalizeRoomCode(code);
    if (roomCode.length !== 5) throw new Error('Enter the five-character room code.');
    return this.connect(() => this.client.joinById(roomCode, { name:normalizeNetworkName(name) }));
  }

  async connect(connectRoom) {
    if (this.room) await this.leave();
    const room = await connectRoom();
    this.room = room;
    this.predict = Predict.get(room);
    this.predict.attachAll('players', { mode:'lerp', fields:['x', 'y', 'z', 'yaw', 'pitch'], smoothMs:65 });
    this.input = room.input({ mode:'unreliable', historySize:4 });

    room.onMessage('shot', event => this.handlers.onShot?.(event));
    room.onMessage('elimination', event => this.handlers.onElimination?.(event));
    room.onMessage('match-start', event => this.handlers.onMatchStart?.(event));
    room.onMessage('match-end', event => this.handlers.onMatchEnd?.(event));
    room.onDrop(() => this.handlers.onStatus?.('CONNECTION INTERRUPTED // RECONNECTING'));
    room.onReconnect(() => this.handlers.onStatus?.('CONNECTION RESTORED'));
    room.onLeave(code => {
      const expected = !this.room;
      this.disposePrediction();
      if (!expected) this.handlers.onDisconnected?.(code);
    });

    await new Promise(resolve => room.onStateChange.once(resolve));
    if (this.room !== room) throw new Error('Connection was cancelled.');
    this.self = room.state.players.get(room.sessionId);
    if (!this.self) throw new Error('Server did not create the local player.');
    this.predict.reconciler(this.self, {
      input:this.input,
      fields:['x', 'y', 'z', 'vx', 'vy', 'vz', 'yaw', 'pitch', 'onGround'],
      step:(ctx, predicted, command) => stepNetworkPlayer(predicted, command, ctx.dt),
    });
    this.callbacks = Callbacks.get(room);
    this.callbacks.onAdd('players', (player, sessionId) => this.handlers.onPlayerAdded?.(sessionId, player));
    this.callbacks.onRemove('players', (_player, sessionId) => this.handlers.onPlayerRemoved?.(sessionId));
    this.lastPhase = room.state.phase;
    this.handlers.onPhase?.(room.state.phase, room.state);
    room.onStateChange(state => {
      if (this.room !== room || state.phase === this.lastPhase) return;
      this.lastPhase = state.phase;
      this.handlers.onPhase?.(state.phase, state);
    });
    return { roomCode:room.roomId, sessionId:room.sessionId };
  }

  tick(now, command) {
    if (!this.room || !this.predict || !this.input || !this.self) return null;
    const steps = this.predict.tick(now);
    for (let index = 0; index < steps; index++) {
      Object.assign(this.input.data, command);
      this.input.send();
    }
    const state = this.room.state;
    if (state.phase !== this.lastPhase) {
      this.lastPhase = state.phase;
      this.handlers.onPhase?.(state.phase, state);
    }
    const players = [];
    for (const [sessionId, player] of state.players) {
      players.push({
        sessionId, name:player.name,
        x:this.predict.value(player, 'x'), y:this.predict.value(player, 'y'), z:this.predict.value(player, 'z'),
        vx:this.predict.value(player, 'vx'), vy:this.predict.value(player, 'vy'), vz:this.predict.value(player, 'vz'),
        yaw:this.predict.value(player, 'yaw'), pitch:this.predict.value(player, 'pitch'),
        health:player.health, shield:player.shield, alive:player.alive, onGround:player.onGround, connected:player.connected,
        ammo:player.ammo, reserve:player.reserve, reloading:player.reloading,
        kills:player.kills, deaths:player.deaths, respawnAt:player.respawnAt,
      });
    }
    return {
      phase:state.phase, countdownEndsAt:state.countdownEndsAt, matchEndsAt:state.matchEndsAt,
      winnerSessionId:state.winnerSessionId, selfSessionId:this.room.sessionId, players,
    };
  }

  fire(direction) {
    if (!this.room) return;
    this.room.send('fire', { weaponId:'specter', direction:{ x:direction.x, y:direction.y, z:direction.z }, timestamp:Date.now() });
  }

  reload() { this.room?.send('reload'); }

  async leave() {
    const room = this.room;
    this.room = null;
    this.disposePrediction();
    if (room) await room.leave(true).catch(() => {});
  }

  disposePrediction() {
    this.room = null;
    this.predict = null;
    this.input = null;
    this.self = null;
    this.callbacks = null;
    this.lastPhase = '';
  }
}
