export const NETWORK_TICK_RATE = 30;
export const NETWORK_PATCH_RATE_MS = 50;
export const NETWORK_MATCH_SECONDS = 180;
export const NETWORK_RESPAWN_MS = 2200;
export const NETWORK_COUNTDOWN_MS = 3000;

export const INPUT_FLAGS = Object.freeze({
  jump: 1,
  sprint: 2,
  crouch: 4,
});

// The multiplayer vertical slice uses Vertigo Grid. These limits deliberately
// stay just inside its authored play space; decorative scenery is client-only.
export const NETWORK_ARENA = Object.freeze({
  id: 'vertigo-grid',
  minX: -314,
  maxX: -126,
  minZ: -94,
  maxZ: 94,
  groundY: 1.75,
});

export const NETWORK_SPAWNS = Object.freeze([
  Object.freeze({ x: -285, y: NETWORK_ARENA.groundY, z: 70, yaw: Math.PI }),
  Object.freeze({ x: -155, y: NETWORK_ARENA.groundY, z: -70, yaw: 0 }),
]);

export const NETWORK_WEAPONS = Object.freeze({
  specter: Object.freeze({
    id: 'specter',
    name: 'SPECTER CARBINE',
    damage: 34,
    headshotMultiplier: 1.55,
    fireIntervalMs: 105,
    magazine: 30,
    reserve: 180,
    reloadMs: 1650,
    range: 190,
  }),
});

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

export function normalizeNetworkName(value) {
  const cleaned = String(value ?? '').replace(/[^a-zA-Z0-9 _-]/g, '').trim().slice(0, 18);
  return cleaned || 'OPERATOR';
}

export function normalizeRoomCode(value) {
  return String(value ?? '').replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, 5);
}

export function normalizeDirection(direction) {
  const x = Number(direction?.x) || 0;
  const y = Number(direction?.y) || 0;
  const z = Number(direction?.z) || 0;
  const length = Math.hypot(x, y, z);
  if (length < .75 || length > 1.25) return null;
  return { x:x / length, y:y / length, z:z / length };
}

export function viewDirectionFromAngles(yaw, pitch) {
  const vertical = Math.sin(clamp(Number(pitch) || 0, -1.5, 1.5));
  const horizontal = Math.cos(clamp(Number(pitch) || 0, -1.5, 1.5));
  const safeYaw = clamp(Number(yaw) || 0, -Math.PI, Math.PI);
  return { x:-Math.sin(safeYaw) * horizontal, y:vertical, z:-Math.cos(safeYaw) * horizontal };
}

/** Pure fixed-step movement shared by the authoritative room and tests. */
export function stepNetworkPlayer(player, input, dt) {
  if (!player.alive) return;
  let moveX = clamp(Number(input.moveX) || 0, -1, 1);
  let moveZ = clamp(Number(input.moveZ) || 0, -1, 1);
  const length = Math.hypot(moveX, moveZ);
  if (length > 1) { moveX /= length; moveZ /= length; }

  player.yaw = clamp(Number(input.yaw) || 0, -Math.PI, Math.PI);
  player.pitch = clamp(Number(input.pitch) || 0, -1.5, 1.5);
  const flags = Number(input.flags) || 0;
  const speed = flags & INPUT_FLAGS.crouch ? 5 : flags & INPUT_FLAGS.sprint ? 12 : 8;
  const sin = Math.sin(player.yaw);
  const cos = Math.cos(player.yaw);
  const targetVx = (cos * moveX - sin * moveZ) * speed;
  const targetVz = (-sin * moveX - cos * moveZ) * speed;
  const acceleration = player.onGround ? 18 : 6;
  const blend = Math.min(1, acceleration * dt);
  player.vx += (targetVx - player.vx) * blend;
  player.vz += (targetVz - player.vz) * blend;

  if ((flags & INPUT_FLAGS.jump) && player.onGround) {
    player.vy = 7.5;
    player.onGround = false;
  }
  if (!player.onGround) player.vy -= 18 * dt;

  player.x = clamp(player.x + player.vx * dt, NETWORK_ARENA.minX, NETWORK_ARENA.maxX);
  player.z = clamp(player.z + player.vz * dt, NETWORK_ARENA.minZ, NETWORK_ARENA.maxZ);
  player.y += player.vy * dt;
  if (player.y <= NETWORK_ARENA.groundY) {
    player.y = NETWORK_ARENA.groundY;
    player.vy = 0;
    player.onGround = true;
  }
}

export function raySphereDistance(origin, direction, center, radius, maxDistance) {
  const ox = origin.x - center.x;
  const oy = origin.y - center.y;
  const oz = origin.z - center.z;
  const projection = ox * direction.x + oy * direction.y + oz * direction.z;
  const discriminant = projection * projection - (ox * ox + oy * oy + oz * oz - radius * radius);
  if (discriminant < 0) return null;
  const near = -projection - Math.sqrt(discriminant);
  const far = -projection + Math.sqrt(discriminant);
  const distance = near >= 0 ? near : far >= 0 ? far : null;
  return distance !== null && distance <= maxDistance ? distance : null;
}
