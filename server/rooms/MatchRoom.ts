import { Client, CloseCode, Room, type StepContext } from 'colyseus';
import { MatchInput, MatchState, PlayerState } from '../schema/MatchState.js';
import {
  NETWORK_COUNTDOWN_MS,
  NETWORK_MATCH_SECONDS,
  NETWORK_PATCH_RATE_MS,
  NETWORK_RESPAWN_MS,
  NETWORK_SPAWNS,
  NETWORK_TICK_RATE,
  NETWORK_WEAPONS,
  normalizeDirection,
  normalizeNetworkName,
  raySphereDistance,
  stepNetworkPlayer,
  viewDirectionFromAngles,
} from '../../shared/network-config.js';

const ROOM_CODE_KEY = 'resonance:private-room-codes';
const ROOM_CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const weapon = NETWORK_WEAPONS.specter;

export class MatchRoom extends Room<{ state: MatchState, input: MatchInput }> {
  maxClients = 2;
  maxMessagesPerSecond = 50;
  patchRate = NETWORK_PATCH_RATE_MS;
  state = new MatchState({
    phase: 'waiting', mapId: 'vertigo-grid', countdownEndsAt: 0,
    matchEndsAt: 0, winnerSessionId: '',
  });
  inputs = this.defineInput(MatchInput, {
    bufferMaxSize: 64,
    sanitize: {
      moveX: [-1, 1], moveZ: [-1, 1], flags: [0, 7],
      yaw: [-Math.PI, Math.PI], pitch: [-1.5, 1.5],
    },
  });

  private lastShotAt = new Map<string, number>();
  private spawnOrder = new Map<string, number>();
  private nextSpawnIndex = 0;
  private countdownGeneration = 0;

  messages = {
    fire: (client: Client, payload: any) => this.handleFire(client, payload),
    reload: (client: Client) => this.handleReload(client),
  };

  async onCreate() {
    this.roomId = await this.generateRoomId();
    await this.setPrivate(true);
    this.setFixedTimestep((ctx) => this.step(ctx), NETWORK_TICK_RATE);
  }

  onJoin(client: Client, options: any) {
    const spawnIndex = this.nextSpawnIndex++ % NETWORK_SPAWNS.length;
    const spawn = NETWORK_SPAWNS[spawnIndex];
    this.spawnOrder.set(client.sessionId, spawnIndex);
    this.state.players.set(client.sessionId, new PlayerState({
      name: normalizeNetworkName(options?.name),
      x: spawn.x, y: spawn.y, z: spawn.z,
      vx: 0, vy: 0, vz: 0, yaw: spawn.yaw, pitch: 0,
      health: 100, shield: 50, alive: true, onGround: true, connected: true, reloading: false,
      ammo: weapon.magazine, reserve: weapon.reserve, kills: 0, deaths: 0,
      weaponId: weapon.id, reloadEndsAt: 0, respawnAt: 0,
    }));
    client.send('room-info', { roomCode:this.roomId, mapId:this.state.mapId, authority:'server' });
    if (this.clients.length === this.maxClients) this.startCountdown();
  }

  onDrop(client: Client, _code: CloseCode) {
    const player = this.state.players.get(client.sessionId);
    if (player) player.connected = false;
    this.allowReconnection(client, 20).catch(() => {});
  }

  onReconnect(client: Client) {
    const player = this.state.players.get(client.sessionId);
    if (player) player.connected = true;
  }

  onLeave(client: Client) {
    this.countdownGeneration++;
    this.state.players.delete(client.sessionId);
    this.lastShotAt.delete(client.sessionId);
    this.spawnOrder.delete(client.sessionId);
    if (this.state.phase !== 'ended') {
      this.state.phase = 'waiting';
      this.state.countdownEndsAt = 0;
      this.state.matchEndsAt = 0;
      for (const player of this.state.players.values()) this.resetPlayer(player, 0);
    }
  }

  onDispose() {
    this.presence.srem(ROOM_CODE_KEY, this.roomId);
  }

  private async generateRoomId() {
    const existing = new Set(await this.presence.smembers(ROOM_CODE_KEY));
    for (let attempt = 0; attempt < 100; attempt++) {
      let code = '';
      for (let index = 0; index < 5; index++) code += ROOM_CODE_CHARS[Math.floor(Math.random() * ROOM_CODE_CHARS.length)];
      if (existing.has(code)) continue;
      await this.presence.sadd(ROOM_CODE_KEY, code);
      return code;
    }
    throw new Error('Unable to allocate a private room code.');
  }

  private startCountdown() {
    const generation = ++this.countdownGeneration;
    this.state.phase = 'countdown';
    this.state.countdownEndsAt = Date.now() + NETWORK_COUNTDOWN_MS;
    this.clock.setTimeout(() => {
      if (generation !== this.countdownGeneration || this.clients.length < this.maxClients) return;
      this.state.phase = 'playing';
      this.state.countdownEndsAt = 0;
      this.state.matchEndsAt = Date.now() + NETWORK_MATCH_SECONDS * 1000;
      this.broadcast('match-start', { matchEndsAt:this.state.matchEndsAt });
    }, NETWORK_COUNTDOWN_MS);
  }

  private step(ctx: StepContext) {
    if (this.state.phase === 'playing' && Date.now() >= this.state.matchEndsAt) this.finishMatch();
    for (const [sessionId, player] of this.state.players) {
      if (!player.alive) {
        if (player.respawnAt && Date.now() >= player.respawnAt && this.state.phase === 'playing') {
          this.resetPlayer(player, this.spawnOrder.get(sessionId) ?? 0);
        }
        continue;
      }
      if (this.state.phase !== 'playing') continue;
      const channel = this.inputs.get(sessionId);
      if (!channel) continue;
      // A modified client cannot gain speed by flooding several commands into
      // one simulation tick. Use only the newest command and advance once.
      let newestInput: MatchInput | undefined;
      for (const input of channel) newestInput = input;
      if (newestInput) stepNetworkPlayer(player, newestInput, ctx.dt);
    }
  }

  private handleFire(client: Client, payload: any) {
    const shooter = this.state.players.get(client.sessionId);
    const now = Date.now();
    if (!shooter || !shooter.alive || this.state.phase !== 'playing' || shooter.reloading) return;
    if (payload?.weaponId !== shooter.weaponId || shooter.weaponId !== weapon.id) return;
    if (shooter.ammo <= 0 || now - (this.lastShotAt.get(client.sessionId) ?? 0) < weapon.fireIntervalMs) return;
    const direction = normalizeDirection(payload?.direction);
    if (!direction) return;
    const expectedDirection = viewDirectionFromAngles(shooter.yaw, shooter.pitch);
    const aimDot = direction.x * expectedDirection.x + direction.y * expectedDirection.y + direction.z * expectedDirection.z;
    if (aimDot < .94) return;

    this.lastShotAt.set(client.sessionId, now);
    shooter.ammo--;
    const origin = { x:shooter.x, y:shooter.y - .08, z:shooter.z };
    let hit: { sessionId:string, distance:number, headshot:boolean } | null = null;
    for (const [sessionId, target] of this.state.players) {
      if (sessionId === client.sessionId || !target.alive) continue;
      const headDistance = raySphereDistance(origin, direction, { x:target.x, y:target.y, z:target.z }, .36, weapon.range);
      const bodyDistance = raySphereDistance(origin, direction, { x:target.x, y:target.y - .82, z:target.z }, .72, weapon.range);
      const distance = headDistance ?? bodyDistance;
      if (distance !== null && (!hit || distance < hit.distance)) hit = { sessionId, distance, headshot:headDistance !== null };
    }

    if (hit) {
      const target = this.state.players.get(hit.sessionId)!;
      this.applyDamage(client.sessionId, target, Math.round(weapon.damage * (hit.headshot ? weapon.headshotMultiplier : 1)));
    }
    this.broadcast('shot', {
      shooterSessionId:client.sessionId, direction, hitSessionId:hit?.sessionId ?? '',
      headshot:hit?.headshot ?? false, ammo:shooter.ammo,
    });
  }

  private applyDamage(shooterSessionId: string, target: PlayerState, damage: number) {
    let remaining = damage;
    if (target.shield > 0) {
      const absorbed = Math.min(target.shield, remaining);
      target.shield -= absorbed;
      remaining -= absorbed;
    }
    target.health = Math.max(0, target.health - remaining);
    if (target.health > 0) return;
    target.alive = false;
    target.deaths++;
    target.respawnAt = Date.now() + NETWORK_RESPAWN_MS;
    const shooter = this.state.players.get(shooterSessionId);
    if (shooter) shooter.kills++;
    this.broadcast('elimination', { shooterSessionId, targetName:target.name, respawnAt:target.respawnAt });
  }

  private handleReload(client: Client) {
    const player = this.state.players.get(client.sessionId);
    if (!player || !player.alive || player.reloading || player.ammo >= weapon.magazine || player.reserve <= 0) return;
    player.reloading = true;
    player.reloadEndsAt = Date.now() + weapon.reloadMs;
    this.clock.setTimeout(() => {
      if (!player.reloading || !this.state.players.has(client.sessionId)) return;
      const amount = Math.min(weapon.magazine - player.ammo, player.reserve);
      player.ammo += amount;
      player.reserve -= amount;
      player.reloading = false;
      player.reloadEndsAt = 0;
    }, weapon.reloadMs);
  }

  private resetPlayer(player: PlayerState, spawnIndex: number) {
    const spawn = NETWORK_SPAWNS[spawnIndex % NETWORK_SPAWNS.length];
    player.x = spawn.x; player.y = spawn.y; player.z = spawn.z;
    player.vx = 0; player.vy = 0; player.vz = 0; player.yaw = spawn.yaw; player.pitch = 0;
    player.health = 100; player.shield = 50; player.alive = true; player.onGround = true;
    player.reloading = false; player.ammo = weapon.magazine; player.reserve = weapon.reserve;
    player.reloadEndsAt = 0; player.respawnAt = 0;
  }

  private finishMatch() {
    if (this.state.phase === 'ended') return;
    this.state.phase = 'ended';
    this.state.matchEndsAt = 0;
    let winner = '';
    let highScore = -1;
    for (const [sessionId, player] of this.state.players) {
      if (player.kills > highScore) { highScore = player.kills; winner = sessionId; }
      else if (player.kills === highScore) winner = '';
    }
    this.state.winnerSessionId = winner;
    this.broadcast('match-end', { winnerSessionId:winner });
  }
}
