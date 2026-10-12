export const NETWORK_TICK_RATE = 30;
export const NETWORK_PATCH_RATE_MS = 50;
export const NETWORK_MATCH_SECONDS = 180;
export const NETWORK_RESPAWN_MS = 2200;
export const NETWORK_COUNTDOWN_MS = 3000;
export const NETWORK_RECONNECT_SECONDS = 25;
export const NETWORK_SPAWN_PROTECTION_MS = 1000;
export const NETWORK_WINNING_SCORE = 5;

export const INPUT_FLAGS = Object.freeze({
  jump: 1,
  sprint: 2,
  crouch: 4,
  aim: 8,
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

const collider=(id,minX,maxX,minZ,maxZ,minY=0,maxY=12)=>Object.freeze({id,minX,maxX,minY,maxY,minZ,maxZ});
const buildingWalls=(id,x,z,w,d,h=9)=>{
  const wall=.8,doorWidth=Math.min(7,w*.34),frontWidth=(w-doorWidth)/2,frontZ=z+d/2;
  return[
    collider(`${id}-back`,x-w/2,x+w/2,z-d/2-wall/2,z-d/2+wall/2,0,h),
    collider(`${id}-left`,x-w/2-wall/2,x-w/2+wall/2,z-d/2,z+d/2,0,h),
    collider(`${id}-right`,x+w/2-wall/2,x+w/2+wall/2,z-d/2,z+d/2,0,h),
    collider(`${id}-front-left`,x-w/2,x-doorWidth/2,frontZ-wall/2,frontZ+wall/2,0,h),
    collider(`${id}-front-right`,x+doorWidth/2,x+w/2,frontZ-wall/2,frontZ+wall/2,0,h),
  ];
};

// Server-side collision for the multiplayer Vertigo slice. These volumes
// mirror the solid ground-level architecture; decorative trim and distant
// scenery intentionally remain non-colliding.
export const NETWORK_COLLIDERS=Object.freeze([
  ...buildingWalls('west-hangar',-294,-35,22,34,9),
  ...buildingWalls('east-hangar',-146,-37,22,32,9),
  collider('center-barricade',-223.6,-216.4,-22.9,-21.1,0,1.4),
  collider('west-barricade',-248.8,-241.2,16.4,19.6,0,1.4),
  collider('east-barricade',-196.8,-189.2,40.4,43.6,0,1.4),
  ...[-2.7,2.7].flatMap(offsetX=>[-2.7,2.7].map(offsetZ=>collider(`south-tower-${offsetX}-${offsetZ}`,-220+offsetX-.22,-220+offsetX+.22,-76+offsetZ-.22,-76+offsetZ+.22,0,12))),
  ...[[-275,-33],[-165,-33],[-220,49]].flatMap(([x,z],towerIndex)=>[-11,11].flatMap(offsetX=>[-11,11].map(offsetZ=>collider(`roof-${towerIndex}-${offsetX}-${offsetZ}`,x+offsetX-.55,x+offsetX+.55,z+offsetZ-.55,z+offsetZ+.55,0,18)))),
]);

export function networkPositionBlocked(x,z,radius=.45,y=NETWORK_ARENA.groundY,height=1.95){
  if(x-radius<NETWORK_ARENA.minX||x+radius>NETWORK_ARENA.maxX||z-radius<NETWORK_ARENA.minZ||z+radius>NETWORK_ARENA.maxZ)return true;
  const feet=y-1.75,head=feet+height;
  return NETWORK_COLLIDERS.some(box=>x+radius>box.minX&&x-radius<box.maxX&&z+radius>box.minZ&&z-radius<box.maxZ&&feet<box.maxY&&head>box.minY);
}

export function resolveNetworkPlayerOverlaps(players,radius=.55){
  const active=players.filter(player=>player?.alive);
  for(let index=0;index<active.length;index++)for(let otherIndex=index+1;otherIndex<active.length;otherIndex++){
    const a=active[index],b=active[otherIndex];let dx=a.x-b.x,dz=a.z-b.z,distance=Math.hypot(dx,dz);const minimum=radius*2;
    if(distance>=minimum)continue;let nx,nz;if(distance<1e-6){nx=index%2?1:-1;nz=0;distance=0;}else{nx=dx/distance;nz=dz/distance;}
    const push=(minimum-distance)/2;
    const aX=a.x+nx*push,aZ=a.z+nz*push,bX=b.x-nx*push,bZ=b.z-nz*push;
    if(!networkPositionBlocked(aX,aZ,radius,a.y)){a.x=aX;a.z=aZ;}
    if(!networkPositionBlocked(bX,bZ,radius,b.y)){b.x=bX;b.z=bZ;}
  }
}

export function networkRayObstacleDistance(origin,direction,maxDistance=Infinity){
  let nearest=maxDistance;
  for(const box of NETWORK_COLLIDERS){let near=0,far=nearest;for(const axis of ['x','y','z']){const delta=direction[axis],value=origin[axis],min=box[`min${axis.toUpperCase()}`],max=box[`max${axis.toUpperCase()}`];if(Math.abs(delta)<1e-8){if(value<min||value>max){near=Infinity;break;}continue;}const first=(min-value)/delta,second=(max-value)/delta;near=Math.max(near,Math.min(first,second));far=Math.min(far,Math.max(first,second));if(near>far){near=Infinity;break;}}if(Number.isFinite(near)&&near>=0)nearest=Math.min(nearest,near);}
  return nearest;
}

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
  player.aiming = Boolean(flags & INPUT_FLAGS.aim);
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

  const nextX=clamp(player.x+player.vx*dt,NETWORK_ARENA.minX+.45,NETWORK_ARENA.maxX-.45);
  if(!networkPositionBlocked(nextX,player.z,.45,player.y))player.x=nextX;else player.vx=0;
  const nextZ=clamp(player.z+player.vz*dt,NETWORK_ARENA.minZ+.45,NETWORK_ARENA.maxZ-.45);
  if(!networkPositionBlocked(player.x,nextZ,.45,player.y))player.z=nextZ;else player.vz=0;
  player.y += player.vy * dt;
  if (player.y <= NETWORK_ARENA.groundY) {
    player.y = NETWORK_ARENA.groundY;
    player.vy = 0;
    player.onGround = true;
  }
  player.movementSpeed = Math.hypot(player.vx, player.vz);
  player.animationState = networkAnimationState(player, flags);
}

export function networkAnimationState(player, flags = 0) {
  if (!player.alive) return 'defeated';
  if (player.reloading) return 'reload';
  if (!player.onGround) return player.vy > .35 ? 'jump' : 'fall';
  const speed = Number(player.movementSpeed) || Math.hypot(Number(player.vx) || 0, Number(player.vz) || 0);
  if ((flags & INPUT_FLAGS.crouch) && speed > 1) return 'slide';
  if ((flags & INPUT_FLAGS.sprint) && speed > 1) return 'sprint';
  if (speed > .35) return 'walk';
  if (flags & INPUT_FLAGS.aim) return 'aim';
  return 'idle';
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
