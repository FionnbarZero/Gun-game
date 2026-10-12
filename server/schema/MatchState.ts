import { schema, t, type SchemaType } from '@colyseus/schema';

export const MatchInput = schema({
  moveX: t.int8(),
  moveZ: t.int8(),
  flags: t.uint8(),
  yaw: t.number(),
  pitch: t.number(),
});
export type MatchInput = SchemaType<typeof MatchInput>;

export const PlayerState = schema({
  name: t.string(),
  x: t.number(), y: t.number(), z: t.number(),
  vx: t.number(), vy: t.number(), vz: t.number(),
  yaw: t.number(), pitch: t.number(),
  health: t.number(), shield: t.number(),
  alive: t.boolean(), onGround: t.boolean(), connected: t.boolean(), reloading: t.boolean(),
  aiming: t.boolean(), animationState: t.string(), movementSpeed: t.number(), activeSlot: t.uint8(),
  ammo: t.number(), reserve: t.number(), kills: t.number(), deaths: t.number(),
  weaponId: t.string(), reloadEndsAt: t.number(), respawnAt: t.number(), spawnProtectedUntil: t.number(),
});
export type PlayerState = SchemaType<typeof PlayerState>;

export const MatchState = schema({
  phase: t.string(),
  mapId: t.string(),
  countdownEndsAt: t.number(),
  matchEndsAt: t.number(),
  winnerSessionId: t.string(),
  winningScore: t.uint8(),
  players: t.map(PlayerState),
});
export type MatchState = SchemaType<typeof MatchState>;
