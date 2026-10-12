import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import './style.css';
import { ART_PALETTE, ARENA_ATMOSPHERES, QUALITY_PRESETS, SCENERY_CONFIG, WEAPON_VISUALS, seededRandom } from './art-direction.js';
import { activeParkourVariant, PARKOUR_COURSES, PARKOUR_ROUTES, PARKOUR_SURFACE_COLORS, parkourMedalForTime, parkourRewardForCompletion } from './match-flow.js';
import { ORIGINAL_CRATE_PRICES, applyWeaponBalance, directWeaponPrice } from './game-balance.js';
import { weaponVisualDefinition } from './weapon-visual-system.js';
import { LOBBY_PARKOUR, formatParkourTime, isVaultableObstacle, parkourReward } from './lobby-parkour.js';
import { OnlineMatchClient } from './multiplayer/connection.js';
import { networkInputFromControls } from './multiplayer/input.js';
import { createRemotePlayer, disposeRemotePlayer, markRemotePlayerFired, updateRemotePlayer } from './multiplayer/remote-player.js';
import { AI_STATES, COMBAT_ROLES, ENEMY_DIFFICULTY_PROFILES, aimErrorRadius, beginReload, isArmedRobot, nearestRobotRival, sampleReactionDelay, shouldForceMiss, stepAngle, updateReload } from './enemy-combat.js';
import { TRAVERSAL_CONFIG, assistedLandingDelta, beginJumpCharge, cameraRollTarget, canStartWallRun, clearTraversalState, consumeBufferedJump, createTraversalState, guidedLaunchVelocity, isTypingTarget, ledgeGrabValid, mantleCandidateValid, movingPlatformCarry, releaseJumpCharge, resetTraversalAtCheckpoint, smoothCharge, updateJumpCharge, vaultCandidateValid, wallJumpVelocity, wallSurfaceEligible } from './traversal-controller.js';
import { CASES, COLLECTIONS, COSMETICS, COSMETIC_KITS, RARITIES, canEquipCosmetic, cosmeticById, createCosmeticProgress, createOfflineRewardService, craftCosmetic, directPurchaseCosmetic, equipCosmetic as equipCatalogCosmetic, killFxParticleBudget, kitById, shouldTriggerKillFx } from './cosmetic-system.js';
import { ABILITY_VISUAL_PROFILES, CRATE_VISUAL_PROFILES, EFFECT_PROFILES, beginVisualAnimation, createVisualAnimationState, effectPhaseAt, qualityVisualFallback, resetVisualAnimation, sampleVisualAnimation, scopeDecorationVisibility, sightAnchorCorrection } from './visual-definition-system.js';
import { CHILL_DECK_LAYOUT, HUB_AREAS, HUB_CONNECTIONS, HUB_NAVIGATION_COLORS, HUB_PARKOUR_PORTALS, HUB_PRIMARY_WINGS, HUB_PROMENADE_SEGMENTS, HUB_UPPER_FLOOR, LOBBY_SECRET_TOTAL, hubRoomWallSegments } from './lobby-hub.js';
import { capsuleIntersectsAabb, circlesOverlap, sampleSegment, separateCirclePair } from './collision-system.js';

const canvas = document.querySelector('#game');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance',stencil:false });
const maximumPixelRatio = Math.min(devicePixelRatio, 1.5);
let renderPixelRatio = maximumPixelRatio;
renderer.setPixelRatio(renderPixelRatio);
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.shadowMap.autoUpdate = false;
renderer.shadowMap.needsUpdate = true;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.08;

const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(ARENA_ATMOSPHERES[0].fog, SCENERY_CONFIG.fogDensity[0]);

const camera = new THREE.PerspectiveCamera(72, innerWidth / innerHeight, 0.08, 900);
camera.rotation.order = 'YXZ';
scene.add(camera);

const hemi = new THREE.HemisphereLight(0xc9edee, 0x435061, 2.05);
scene.add(hemi);
const sun = new THREE.DirectionalLight(ART_PALETTE.sun, 3.85);
sun.position.set(-105, 172, -94);
sun.castShadow = true;
sun.shadow.mapSize.set(1024, 1024);
sun.shadow.camera.left = -118;
sun.shadow.camera.right = 118;
sun.shadow.camera.top = 118;
sun.shadow.camera.bottom = -118;
sun.shadow.camera.near = 5;
sun.shadow.camera.far = 390;
sun.shadow.bias = -0.00012;
sun.shadow.normalBias = .025;
scene.add(sun);

const renderPass = new RenderPass(scene, camera);
const bloomPass = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), .18, .32, .91);
const composer = new EffectComposer(renderer);
composer.setPixelRatio(renderPixelRatio);
composer.setSize(innerWidth, innerHeight);
composer.addPass(renderPass);
composer.addPass(bloomPass);
composer.addPass(new OutputPass());

const skyUniforms = {
  horizonColor: { value:new THREE.Color(ARENA_ATMOSPHERES[0].horizon) },
  zenithColor: { value:new THREE.Color(ARENA_ATMOSPHERES[0].zenith) },
  sunColor: { value:new THREE.Color(ARENA_ATMOSPHERES[0].sun) },
  sunDirection: { value:new THREE.Vector3(...ARENA_ATMOSPHERES[0].sunDirection).normalize() },
};
const sky = new THREE.Mesh(
  new THREE.SphereGeometry(760, 28, 16),
  new THREE.ShaderMaterial({
    uniforms:skyUniforms,
    side:THREE.BackSide,
    depthWrite:false,
    fog:false,
    vertexShader:`varying vec3 vDirection; void main(){vDirection=position;vec4 p=projectionMatrix*modelViewMatrix*vec4(position,1.0);gl_Position=p.xyww;}`,
    fragmentShader:`varying vec3 vDirection;uniform vec3 horizonColor;uniform vec3 zenithColor;uniform vec3 sunColor;uniform vec3 sunDirection;void main(){vec3 d=normalize(vDirection);float h=smoothstep(-.08,.72,d.y);vec3 color=mix(horizonColor,zenithColor,h);float sunDot=max(dot(d,normalize(sunDirection)),0.0);float halo=pow(sunDot,42.0)*.34;float disc=smoothstep(.9974,.9992,sunDot);color+=sunColor*halo;color=mix(color,sunColor,disc*.92);float haze=pow(1.0-max(d.y,0.0),4.0)*.08;color+=horizonColor*haze;gl_FragColor=vec4(color,1.0);}`,
  }),
);
sky.frustumCulled = false;
sky.renderOrder = -1000;
scene.add(sky);

const mats = {
  sand: new THREE.MeshStandardMaterial({ color:ARENA_ATMOSPHERES[0].ground, roughness:.96 }),
  concrete: new THREE.MeshStandardMaterial({ color:ART_PALETTE.concrete, roughness:.88 }),
  dark: new THREE.MeshStandardMaterial({ color:ART_PALETTE.structurePrimary, roughness:.62, metalness:.3 }),
  metal: new THREE.MeshStandardMaterial({ color:ART_PALETTE.structureSecondary, roughness:.46, metalness:.62 }),
  steel: new THREE.MeshStandardMaterial({ color:ART_PALETTE.neutralMetal, roughness:.31, metalness:.82 }),
  olive: new THREE.MeshStandardMaterial({ color:ART_PALETTE.paintedGreen, roughness:.7, metalness:.18 }),
  rust: new THREE.MeshStandardMaterial({ color:ART_PALETTE.paintedRed, roughness:.72, metalness:.16 }),
  orange: new THREE.MeshStandardMaterial({ color:ART_PALETTE.hazard, roughness:.55, metalness:.22 }),
  cream: new THREE.MeshStandardMaterial({ color:0xd3d7cd, roughness:.76 }),
  black: new THREE.MeshStandardMaterial({ color:ART_PALETTE.grip, roughness:.82, metalness:.08 }),
  target: new THREE.MeshStandardMaterial({ color:ART_PALETTE.enemyAccent, roughness:.58 }),
  glass: new THREE.MeshPhysicalMaterial({ color:ART_PALETTE.glass, transparent:true, opacity:.3, roughness:.16, metalness:.12, transmission:.14, depthWrite:false }),
  neonCyan: new THREE.MeshStandardMaterial({ color:ART_PALETTE.playerAccent, emissive:ART_PALETTE.playerAccent, emissiveIntensity:1.05, metalness:.28, roughness:.32 }),
  neonPink: new THREE.MeshStandardMaterial({ color:0xe56fb5, emissive:0xa93179, emissiveIntensity:.82, metalness:.26, roughness:.38 }),
  interactive: new THREE.MeshStandardMaterial({ color:ART_PALETTE.interactive, emissive:0x9f641d, emissiveIntensity:.72, metalness:.36, roughness:.34 }),
  leaf: new THREE.MeshStandardMaterial({ color:ART_PALETTE.vegetationDark, roughness:.92, flatShading:true }),
  moss: new THREE.MeshStandardMaterial({ color:ART_PALETTE.vegetationMid, roughness:.96, flatShading:true }),
  bark: new THREE.MeshStandardMaterial({ color:ART_PALETTE.bark, roughness:.98, flatShading:true }),
  rock: new THREE.MeshStandardMaterial({ color:ART_PALETTE.rock, roughness:.96, flatShading:true }),
  snow: new THREE.MeshStandardMaterial({ color:ART_PALETTE.snow, roughness:.86, flatShading:true }),
  water: new THREE.MeshPhysicalMaterial({ color:ART_PALETTE.water, roughness:.17, metalness:.08, transparent:true, opacity:.8, depthWrite:false }),
  cloud: new THREE.MeshStandardMaterial({ color:ART_PALETTE.cloud, roughness:1, flatShading:true, transparent:true, opacity:.82, depthWrite:false }),
  lava: new THREE.MeshStandardMaterial({ color:ART_PALETTE.hazard, emissive:0xff3518, emissiveIntensity:1.75, roughness:.38 }),
};

const roundedGeometryCache = new Map();
function chamferedBoxGeometry(size, requestedRadius = .09) {
  const radius=Math.min(requestedRadius,Math.min(...size)*.24);
  const key=`${size.map(value=>Number(value).toFixed(3)).join(':')}:${radius.toFixed(3)}`;
  if(!roundedGeometryCache.has(key))roundedGeometryCache.set(key,new RoundedBoxGeometry(...size,1,radius));
  return roundedGeometryCache.get(key);
}

const world = new THREE.Group();
scene.add(world);
const colliders = [];
const occluders = [];
const shootables = [];
const arenaRenderables = [[],[],[]];
const destructibleCover = [];
const coverDebris = [];
const environmentalControls = [];
const weaponPickupStations = [];
const enemyDrones = [];

const hitboxMaterial=new THREE.MeshBasicMaterial({color:0xffffff});
const hitboxGeometry={
  dummyBody:new THREE.BoxGeometry(1.6,3.15,1),
  dummyHead:new THREE.SphereGeometry(.45,8,6),
  enemyBody:new THREE.BoxGeometry(1.05,3.05,.64),
  enemyHead:new THREE.SphereGeometry(.38,8,6),
};

function addCombatHitbox(target,geometry,position,hitZone,parent=target.group) {
  const hitbox=new THREE.Mesh(geometry,hitboxMaterial);
  hitbox.position.set(...position);
  hitbox.visible=false;
  hitbox.userData.target=target;
  hitbox.userData.hitZone=hitZone;
  parent.add(hitbox);
  shootables.push(hitbox);
  return hitbox;
}

function isHeadshotHit(hit,target) {
  return hit?.object?.userData?.hitZone==='head'||hit?.object===target.head||hit?.object===target.face;
}

function arenaIndexFromX(x) { return x < -110 ? 0 : x > 110 ? 2 : 1; }
function registerArenaRenderable(object,x) {
  const arena=arenaIndexFromX(x); object.userData.arenaIndex=arena; arenaRenderables[arena].push(object); return object;
}
function syncArenaVisibility(activeArena) {
  arenaRenderables.forEach((objects,arena)=>objects.forEach(object=>{object.visible=arena===activeArena&&!object.userData.cover?.destroyed;}));
  renderer.shadowMap.needsUpdate=true;
}

function mesh(geometry, material, position, shadows = true, arenaAware = true) {
  const item = new THREE.Mesh(geometry, material);
  item.position.set(...position);
  item.castShadow = shadows;
  item.receiveShadow = shadows;
  item.userData.shadowRequested=shadows;
  world.add(item);
  if (arenaAware) registerArenaRenderable(item,position[0]);
  return item;
}

function addBox(size, position, material, rotationY = 0, solid = false) {
  const item = mesh(chamferedBoxGeometry(size,Math.min(.16,Math.min(...size)*.18)), material, position);
  item.rotation.y = rotationY;
  if (solid) {
    const halfX = Math.abs(Math.cos(rotationY)) * size[0] / 2 + Math.abs(Math.sin(rotationY)) * size[2] / 2;
    const halfZ = Math.abs(Math.sin(rotationY)) * size[0] / 2 + Math.abs(Math.cos(rotationY)) * size[2] / 2;
    const collider = { minX:position[0]-halfX, maxX:position[0]+halfX, minY:position[1]-size[1]/2, maxY:position[1]+size[1]/2, minZ:position[2]-halfZ, maxZ:position[2]+halfZ, active:true, mesh:item,kind:'world' };
    colliders.push(collider); item.userData.collider = collider;
    occluders.push(item);
  }
  return item;
}

// Ground and navigation markings.
const ground = mesh(new THREE.PlaneGeometry(700, 700, 1, 1), mats.sand, [0, 0, 0], true, false);
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
const grid = new THREE.GridHelper(700, 140, 0x848371, 0x6c6d5b);
grid.position.y = .015;
grid.material.opacity = .18;
grid.material.transparent = true;
world.add(grid);

function road(width, length, x, z, rotation = 0) {
  const r = addBox([width, .025, length], [x, .025, z], mats.concrete, rotation);
  for (let i = -length / 2 + 8; i < length / 2; i += 16) {
    const mark = addBox([.28, .035, 6], [x, .05, z + i], mats.cream, rotation);
    mark.receiveShadow = false;
  }
  return r;
}
road(13, 176, -220, 0);

const arenaDefinitions = [
  { id:'vertigo', name:'VERTIGO GRID', short:'VERTIGO', spawn:new THREE.Vector3(-220, 1.75, 78), sky:0x171435, fog:0x251b48, utility:'SHOCK MINE', intel:'Lock down rooftop launch exits while watching the glowing bridge lanes.' },
  { id:'outpost', name:'OVERGROWN OUTPOST', short:'OUTPOST', spawn:new THREE.Vector3(0, 1.75, 78), sky:0x718c83, fog:0x668276, utility:'GRAVITY BOMB', intel:'Pull hidden flankers out of dense valley brush beneath the cliff nests.' },
  { id:'foundry', name:'INDUSTRIAL FOUNDRY', short:'FOUNDRY', spawn:new THREE.Vector3(220, 1.75, 80), sky:0x493f48, fog:0x685255, utility:'ADRENALINE', intel:'Time a speed boost to cross open lanes as the crane blockers move.' },
];
const platformSurfaces = [];
const jumpPads = [];
const movingCranes = [];
const movingDataBlocks = [];
const assemblyPlatters = [];
const steamVents = [];
const lavaHazards = [];

function addPlatformSurface(type, options) { platformSurfaces.push({ type, arena:arenaIndexFromX(options.x), ...options }); }
function addJumpPad(x, z, targetX, targetZ, targetHeight, color = 0xe7ff57, launchMode = 'arc',radius=3.2,padHeight=.2) {
  const pad = mesh(new THREE.CylinderGeometry(radius, radius+.4, .35, 16), new THREE.MeshStandardMaterial({ color, emissive:color, emissiveIntensity:.35, metalness:.35, roughness:.48 }), [x, padHeight, z]);
  pad.receiveShadow = true;
  const ring = mesh(new THREE.TorusGeometry(radius*.76, .12, 8, 24), new THREE.MeshBasicMaterial({ color }), [x, padHeight+.21, z]); ring.rotation.x = Math.PI / 2;
  jumpPads.push({ x, z, targetX, targetZ, targetHeight, launchMode, radius, padHeight, surfaceY:padHeight+.175, cooldown:0, pad, ring });
}

function addWalkableBox(size,position,material=mats.metal,rotationY=0) {
  const item=addBox(size,position,material,rotationY,true);
  addPlatformSurface(Math.abs(rotationY)>.0001?'orientedRect':'rect',{
    x:position[0],z:position[2],w:size[0],d:size[2],height:position[1]+size[1]/2,
    angle:rotationY,collider:item.userData.collider,mesh:item,
  });
  return item;
}

function addRaisedSurface(x, z, width, depth, height, material = mats.metal) {
  return addWalkableBox([width,.6,depth],[x,height-.3,z],material);
}

function addRamp(x, z, width, length, startHeight, endHeight, axis = 'z', material = mats.bark) {
  const rise = endHeight - startHeight; const slope = Math.atan2(rise, length);
  const geometry = axis === 'x' ? new THREE.BoxGeometry(Math.hypot(length, rise), .9, width) : new THREE.BoxGeometry(width, .9, Math.hypot(length, rise));
  const ramp = mesh(geometry, material, [x, (startHeight + endHeight) / 2 - .3, z]);
  if (axis === 'x') ramp.rotation.z = slope; else ramp.rotation.x = -slope;
  addPlatformSurface('ramp', { x, z, w:width, length, axis, startHeight, endHeight });
  return ramp;
}

function addDiagonalRamp(x,z,width,length,startHeight,endHeight,angle,material=mats.bark,covered=false) {
  const rise=endHeight-startHeight; const slope=Math.atan2(rise,length); const depth=Math.hypot(length,rise);
  const createPanel=(panelWidth,panelHeight,offsetY,offsetAcross=0,panelMaterial=material)=>{
    const panel=mesh(new THREE.BoxGeometry(panelWidth,panelHeight,depth),panelMaterial,[x+Math.cos(angle)*offsetAcross,(startHeight+endHeight)/2+offsetY,z-Math.sin(angle)*offsetAcross]);
    panel.rotation.order='YXZ'; panel.rotation.y=angle; panel.rotation.x=-slope; return panel;
  };
  const floor=createPanel(width,.9,-.3);
  addPlatformSurface('orientedRamp',{x,z,w:width,length,angle,startHeight,endHeight,covered,ceilingClearance:covered?5.2:0});
  if (covered) {
    const roof=createPanel(width+1,.8,5.2); occluders.push(roof);
    addPlatformSurface('orientedRamp',{x,z,w:width+1,length,angle,startHeight:startHeight+5.6,endHeight:endHeight+5.6,mesh:roof});
    const left=createPanel(.75,4.8,2.35,-width/2,mats.bark); const right=createPanel(.75,4.8,2.35,width/2,mats.bark);
    occluders.push(left,right);
  }
  return floor;
}

function addMovingCrane(x, z, width, depth, axis, range, phase, period = 15000,options={}) {
  const craneMaterial=options.routeTransport?mats.orange.clone():mats.orange;
  const deckHeight=options.deckHeight??12;const bodyHeight=options.routeTransport?Math.min(7,Math.max(2.8,deckHeight*.68)):7;const bodyCenter=deckHeight-bodyHeight/2;
  const item = addBox([width, bodyHeight, depth], [x, bodyCenter, z], craneMaterial, 0, true);
  const collider = item.userData.collider;
  const surface={type:'rect',x,z,w:width,d:depth,height:deckHeight,active:true,collider,mesh:item,dynamic:true,arena:arenaIndexFromX(x)};platformSurfaces.push(surface);
  const crane={ item, collider, surface, originX:x, originZ:z, lastX:x, lastZ:z, width, depth, axis, range, phase, period,routeTransport:Boolean(options.routeTransport),warning:null,gates:[] };movingCranes.push(crane);
  const cap = new THREE.Mesh(new THREE.BoxGeometry(width + 1, .25, depth + 1), mats.metal); cap.position.y = bodyHeight/2+.12; item.add(cap);
  if(options.routeTransport){const railY=bodyHeight/2+.72;for(const zSide of [-1,1]){const rail=new THREE.Mesh(new THREE.BoxGeometry(width+.4,1.2,.16),mats.yellow);rail.position.set(0,railY,zSide*(depth/2-.12));item.add(rail);}for(const xSide of [-1,1]){const gate=new THREE.Mesh(new THREE.BoxGeometry(.16,1.2,depth-.4),mats.yellow);gate.position.set(xSide*(width/2-.12),railY,0);item.add(gate);crane.gates.push(gate);}const beacon=new THREE.PointLight(PARKOUR_SURFACE_COLORS.boost,2.4,12,2);beacon.position.set(0,bodyHeight/2+1.7,0);item.add(beacon);crane.warning=beacon;}
}

function addMovingDataBlock(x,z,width,depth,height,phase) {
  const item=addBox([width,height,depth],[x,height/2,z],mats.neonPink,0,true); const collider=item.userData.collider;
  const edge=new THREE.LineSegments(new THREE.EdgesGeometry(item.geometry),new THREE.LineBasicMaterial({color:0x50e5ff,transparent:true,opacity:.85})); item.add(edge);
  const surface={type:'rect',x,z,w:width,d:depth,height,active:true,collider,mesh:item,dynamic:true,arena:arenaIndexFromX(x)};platformSurfaces.push(surface);
  movingDataBlocks.push({item,collider,surface,baseY:height/2,lastTop:height,width,depth,height,phase});
}

function addAssemblyPlatter(x,z,radius,height,phase) {
  const item=mesh(new THREE.CylinderGeometry(radius,radius+.35,.55,18),mats.metal,[x,height-.28,z]); item.castShadow=true; item.receiveShadow=true;
  const rim=new THREE.Mesh(new THREE.TorusGeometry(radius-.22,.12,8,24),mats.orange); rim.rotation.x=Math.PI/2; rim.position.y=.3; item.add(rim);
  const surface={type:'disc',x,z,radius,height,active:true,arena:arenaIndexFromX(x)}; platformSurfaces.push(surface);
  assemblyPlatters.push({item,surface,x,z,radius,height,phase,occupiedSince:0,tipUntil:0});
}

function addSteamVent(x, z, phase) {
  const pipe = mesh(new THREE.CylinderGeometry(.7, .9, 2.2, 10), mats.metal, [x, 1.1, z]);
  const cloud = mesh(new THREE.SphereGeometry(2.8, 10, 7), new THREE.MeshBasicMaterial({ color:0xdce8e8, transparent:true, opacity:.16, depthWrite:false }), [x, 4, z], false);
  cloud.scale.set(1.4, .75, 1); steamVents.push({ pipe, cloud, phase });
}

// Perimeter walls and repeating posts.
addBox([700, 5, 1.5], [0, 2.5, -349], mats.dark, 0, true);
addBox([700, 5, 1.5], [0, 2.5, 349], mats.dark, 0, true);
addBox([1.5, 5, 700], [-349, 2.5, 0], mats.dark, 0, true);
addBox([1.5, 5, 700], [349, 2.5, 0], mats.dark, 0, true);
for (let p = -336; p <= 336; p += 24) {
  addBox([.5, 7, .5], [p, 3.5, -347.8], mats.metal);
  addBox([.5, 7, .5], [p, 3.5, 347.8], mats.metal);
  addBox([.5, 7, .5], [-347.8, 3.5, p], mats.metal);
  addBox([.5, 7, .5], [347.8, 3.5, p], mats.metal);
}

// Enterable compounds and hangars. Every wall is separate so doors and interiors are real space.
const buildingLootSpots = [];
function building(x, z, w, d, h, material = mats.dark) {
  const wall = .8;
  const doorWidth = Math.min(7, w * .34);
  const frontWidth = (w - doorWidth) / 2;
  addBox([w - wall * 2, .18, d - wall * 2], [x, .09, z], mats.concrete);
  addBox([w, h, wall], [x, h / 2, z - d / 2], material, 0, true);
  addBox([wall, h, d], [x - w / 2, h / 2, z], material, 0, true);
  addBox([wall, h, d], [x + w / 2, h / 2, z], material, 0, true);
  addBox([frontWidth, h, wall], [x - (doorWidth + frontWidth) / 2, h / 2, z + d / 2], material, 0, true);
  addBox([frontWidth, h, wall], [x + (doorWidth + frontWidth) / 2, h / 2, z + d / 2], material, 0, true);
  addBox([doorWidth, h * .28, wall], [x, h * .86, z + d / 2], mats.metal);
  addWalkableBox([w + 1.2, .7, d + 1.2], [x, h + .35, z], mats.metal);
  addBox([doorWidth - .5, .18, 2.8], [x, .11, z + d / 2 + 1.2], mats.concrete);
  for (let k = -1; k <= 1; k += 2) {
    const window = addBox([2.5, 1.4, .1], [x + k * w * .31, h * .58, z + d / 2 + .46], mats.cream);
    window.material = new THREE.MeshBasicMaterial({ color: 0xa5b8ae }); window.castShadow = false;
  }
  // Interior shelving and warm practical lighting make each building searchable.
  addBox([w * .32, 2.2, .7], [x - w * .23, 1.1, z - d * .29], mats.metal,0,true);
  addBox([w * .32, 2.2, .7], [x + w * .23, 1.1, z - d * .29], mats.metal,0,true);
  const light = new THREE.PointLight(0xffd39a, 14, Math.max(w, d) * .75, 2);
  light.position.set(x, h - 1.2, z); world.add(light); registerArenaRenderable(light,x);
  buildingLootSpots.push(new THREE.Vector3(x - w * .22, .55, z), new THREE.Vector3(x + w * .22, .55, z - d * .18));
}
building(-294, -35, 22, 34, 9, mats.rust);
building(-146, -37, 22, 32, 9, mats.olive);
building(-65, -40, 21, 25, 8, mats.dark);
building(65, 38, 21, 25, 8, mats.olive);
building(263, -5, 48, 38, 12, mats.dark);
building(290, 62, 24, 25, 9, mats.rust);
building(154, 57, 24, 28, 9, mats.olive);

const lootCrates = [];
function createLootCrate(position, index) {
  const group = new THREE.Group(); group.position.copy(position); world.add(group); registerArenaRenderable(group,position.x);
  const energyColor = [0x50e5ff, 0xff4fba, 0xffc857, 0x9b6cff][index % 4];
  const energyMaterial = new THREE.MeshStandardMaterial({ color:energyColor, emissive:energyColor, emissiveIntensity:.65, metalness:.45, roughness:.3 });
  const base = new THREE.Mesh(new THREE.BoxGeometry(2.3, .9, 1.5), mats.olive); base.position.y = .45; base.castShadow = true; group.add(base);
  const lid = new THREE.Mesh(new THREE.BoxGeometry(2.36, .28, 1.56), mats.metal); lid.position.set(0, 1.02, 0); lid.castShadow = true; group.add(lid);
  for (const xBand of [-.72, .72]) {
    const band = new THREE.Mesh(new THREE.BoxGeometry(.12, 1.2, 1.62), energyMaterial); band.position.set(xBand, .65, 0); group.add(band);
  }
  const glow = new THREE.PointLight(energyColor, 4, 7); glow.position.y = 1.35; group.add(glow);
  const core = new THREE.Mesh(new THREE.OctahedronGeometry(.2), energyMaterial); core.position.y = 1.42; group.add(core);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(.5, .025, 6, 20), new THREE.MeshBasicMaterial({ color:energyColor, transparent:true, opacity:.8 })); ring.position.y = 1.42; ring.rotation.x = Math.PI / 2; group.add(ring);
  const collider={minX:position.x-1.18,maxX:position.x+1.18,minY:position.y,maxY:position.y+1.2,minZ:position.z-.78,maxZ:position.z+.78,active:true,mesh:group,kind:'loot-crate'};colliders.push(collider);group.userData.collider=collider;
  lootCrates.push({ group, lid, glow, core, ring, index, arena:arenaIndexFromX(position.x), opened:false, phase:index * .7 });
}
buildingLootSpots.forEach(createLootCrate);

function container(x, z, color, rot = 0) {
  const c=addWalkableBox([6,6,14],[x,3,z],color,rot);
  for (let y = .6; y < 6; y += 1.05) {
    const rib = addBox([6.1, .12, 14.1], [x, y, z], mats.dark, rot);
    rib.castShadow = false;
  }
  return c;
}
container(180, 3, mats.rust);
container(190, 8, mats.olive, Math.PI / 2);
container(169, -8, mats.metal);
container(-75, 45, mats.rust, Math.PI / 2);
container(76, -43, mats.olive, Math.PI / 2);

function tower(x, z) {
  for (const sx of [-2.7, 2.7]) for (const sz of [-2.7, 2.7]) addBox([.35, 12, .35], [x + sx, 6, z + sz], mats.metal,0,true);
  addWalkableBox([7,.45,7],[x,10.2,z],mats.metal);
  addBox([6, 3, 6], [x, 11.8, z], mats.dark,0,true);
  addBox([4.5, 1.3, .1], [x, 12, z + 3.02], mats.cream);
  addWalkableBox([8,.3,8],[x,13.45,z],mats.metal);
}
tower(-220, -76);
tower(220, -68);

function barricade(x, z, rot = 0) {
  addBox([7, 1.4, 1.2], [x, .7, z], mats.concrete, rot,true);
  addBox([5.8, .12, 1.3], [x, 1.1, z], mats.orange, rot);
}
for (const [x, z, r] of [[-220,-22,0],[-245,18,.2],[-193,42,-.2],[-22,-68,.35],[26,64,-.35],[185,30,.15],[242,35,-.15],[267,-45,.3]]) barricade(x,z,r);

// Arena 1: three neon rooftops, traversable light bridges, and a cover-rich lower courtyard.
function buildVertigoGrid() {
  const cx = -220;
  addBox([190, 7, 2], [cx, 3.5, -96], mats.dark, 0, true); addBox([190, 7, 2], [cx, 3.5, 96], mats.dark, 0, true);
  addBox([2, 7, 192], [cx - 96, 3.5, 0], mats.dark, 0, true); addBox([2, 7, 192], [cx + 96, 3.5, 0], mats.dark, 0, true);
  addBox([176, .18, 176], [cx, .1, 0], mats.dark);
  for (let gx = -80; gx <= 80; gx += 10) addBox([.08, .03, 176], [cx + gx, .2, 0], gx % 20 ? mats.neonPink : mats.neonCyan);
  for (let gz = -80; gz <= 80; gz += 10) addBox([176, .03, .08], [cx, .21, gz], gz % 20 ? mats.neonCyan : mats.neonPink);
  const towers = [
    { x:cx - 55, z:-33, h:18, color:mats.neonCyan },
    { x:cx + 55, z:-33, h:18, color:mats.neonPink },
    { x:cx, z:49, h:24, color:mats.neonCyan },
  ];
  for (const towerInfo of towers) {
    for (const ox of [-11,11]) for (const oz of [-11,11]) addBox([1, towerInfo.h, 1], [towerInfo.x + ox, towerInfo.h / 2, towerInfo.z + oz], mats.metal);
    addRaisedSurface(towerInfo.x, towerInfo.z, 27, 27, towerInfo.h, mats.metal);
    addBox([24, .18, .18], [towerInfo.x, towerInfo.h + 1.1, towerInfo.z - 10.5], towerInfo.color);
    addBox([.18, 2.3, 22], [towerInfo.x - 10.5, towerInfo.h + 1.15, towerInfo.z], mats.glass,0,true);
    addBox([.18, 2.3, 22], [towerInfo.x + 10.5, towerInfo.h + 1.15, towerInfo.z], mats.glass,0,true);
    addBox([21, 2.3, .18], [towerInfo.x, towerInfo.h + 1.15, towerInfo.z - 10.5], mats.glass,0,true);
    addJumpPad(towerInfo.x,towerInfo.z+17,towerInfo.x,towerInfo.z,towerInfo.h,towerInfo.color.color.getHex(),'vertical');
  }
  // The Spines run the full outer lanes with sparse, rhythmically spaced slide-peek cover.
  for (const x of [cx-80,cx+80]) {
    addRaisedSurface(x,0,7,164,6,mats.glass);
    for (let z=-66;z<=66;z+=26) addBox([6,1.5,1.2],[x,6.75,z],z%52?mats.neonPink:mats.neonCyan,0,true);
    addRamp(x,78,7,24,6,0,'z',mats.glass);
  }
  // Light bridges join the outer nests while twin climbing bridges lead into the taller Center Spire.
  addRaisedSurface(cx,-33,83,4.5,18,mats.glass);
  addBox([83,.12,.16],[cx,18.38,-35],mats.neonCyan); addBox([83,.12,.16],[cx,18.38,-31],mats.neonPink);
  addRamp(cx-27,7,4.5,70,18,24,'z',mats.glass); addRamp(cx+27,7,4.5,70,18,24,'z',mats.glass);
  // The Sunken Nexus has data blocks that rise and retract, continually cutting sightlines.
  addBox([58, .12, 53], [cx, .16, 5], new THREE.MeshStandardMaterial({ color:0x251943, roughness:.72 }));
  for (const [ox,oz,w,d,h,phase] of [[-21,-14,11,4,9,0],[18,-11,10,5,7,1.2],[-16,9,5,13,11,2.4],[14,14,5,14,8,3.6],[0,0,8,8,13,4.8]]) addMovingDataBlock(cx+ox,oz,w,d,h,phase);
}

// Arena 2: jungle valley, sniper cliffs, thick brush, and fallen-tree ramps.
function buildOvergrownOutpost() {
  const cx = 0;
  for (const x of [-96,96]) addBox([2, 14, 194], [x, 7, 0], mats.concrete, 0, true);
  addBox([194, 8, 2], [cx, 4, -96], mats.concrete, 0, true); addBox([194, 8, 2], [cx, 4, 96], mats.concrete, 0, true);
  // Twin cliff shelves overlook a hollow central ravine and climb into the canopy.
  addBox([29, 14, 170], [-70, 7, 0], mats.concrete, 0, true); addPlatformSurface('rect', { x:-70, z:0, w:29, d:170, height:14 });
  addBox([29, 14, 170], [70, 7, 0], mats.concrete, 0, true); addPlatformSurface('rect', { x:70, z:0, w:29, d:170, height:14 });
  for (const z of [-65,-22,24,66]) {
    const vinesLeft = addBox([30,.32,2],[-70,14.25,z],mats.moss); vinesLeft.rotation.y=.08;
    const vinesRight = addBox([30,.32,2],[70,14.25,z],mats.moss); vinesRight.rotation.y=-.08;
  }
  // A rushing river divides the Ravine; ruined bunkers give ground players overhead protection.
  const river=mesh(new THREE.PlaneGeometry(14,176),new THREE.MeshStandardMaterial({color:0x2d8d9c,emissive:0x17465a,emissiveIntensity:.35,transparent:true,opacity:.84,roughness:.18}),[0,.08,0]); river.rotation.x=-Math.PI/2;
  for (const z of [-52,18,62]) {
    const bunkerX=z===18?-25:25; addWalkableBox([20,.8,14],[bunkerX,4.6,z],mats.concrete);
    addBox([1,4,14],[bunkerX-9,2,z],mats.concrete,0,true); addBox([1,4,14],[bunkerX+9,2,z],mats.concrete,0,true);
  }
  // The covered Fallen Titan forms a diagonal, hollow slide route from ravine to canopy.
  addDiagonalRamp(0,0,9,130,0,18,Math.PI/4,mats.bark,true);
  // Suspended branch and research-catwalk network creates the Canopy sightline layer.
  addRaisedSurface(0,-66,116,5,18,mats.bark); addRaisedSurface(0,66,116,5,18,mats.bark);
  addRaisedSurface(-42,28,7,72,18,mats.moss); addRaisedSurface(42,-28,7,72,18,mats.moss);
  addRamp(-69,63,8,28,14,18,'z',mats.bark); addRamp(69,-63,8,28,18,14,'z',mats.bark);
  // Spore pads throw players across the valley at a pronounced forty-five-degree arc.
  for (const rampPoint of [[-18,58,-70,42],[18,-58,70,-42],[-18,-18,70,6],[18,18,-70,-6]]) addJumpPad(rampPoint[0],rampPoint[1],rampPoint[2],rampPoint[3],14,0x67e8a5,'arc');
  // Ruined columns and brush create crouch-height lanes through the valley.
  for (const [x,z] of [[-30,-71],[3,-61],[31,-48],[-18,-34],[24,-18],[-34,4],[4,9],[35,28],[-19,43],[17,60],[-37,74]]) {
    addBox([3.2,3.5,3.2],[x,1.75,z],mats.concrete,0,true);
    for (let n=0;n<3;n++) {
      const shrub=mesh(new THREE.DodecahedronGeometry(2.2+n*.3,0),mats.leaf,[x+(n-1)*1.8,1.2,z+(n%2?.8:-.8)]); shrub.scale.y=.65; occluders.push(shrub);
    }
  }
  // Giant ancient trees frame the cliffs and waterfall basin.
  for (const [x,z,s] of [[-82,-70,1.4],[-76,54,1.7],[78,-48,1.5],[83,68,1.8],[47,1,1.2]]) {
    const trunk=mesh(new THREE.CylinderGeometry(2.4*s,3.3*s,16*s,10),mats.bark,[x,8*s,z]);
    for (let n=0;n<4;n++) { const crown=mesh(new THREE.DodecahedronGeometry(5*s,0),mats.leaf,[x+Math.cos(n*1.7)*4*s,15*s+n*.7,z+Math.sin(n*1.7)*4*s]); crown.scale.y=.72; }
  }
  const waterfall=mesh(new THREE.PlaneGeometry(17,12),new THREE.MeshBasicMaterial({color:0x8ce8ef,transparent:true,opacity:.46,side:THREE.DoubleSide}),[69,6,-70],false); waterfall.rotation.y=-Math.PI/2;
  const pool=mesh(new THREE.CircleGeometry(13,24),new THREE.MeshStandardMaterial({color:0x397d7c,transparent:true,opacity:.7,roughness:.18}),[53,.08,-70]); pool.rotation.x=-Math.PI/2;
}

// Arena 3: symmetrical foundry lanes with molten hazards, steam, and moving crane blockers.
function buildIndustrialFoundry() {
  const cx = 220;
  addBox([190, 9, 2], [cx, 4.5, -96], mats.dark, 0, true); addBox([190, 9, 2], [cx, 4.5, 96], mats.dark, 0, true);
  addBox([2, 9, 192], [cx - 96, 4.5, 0], mats.dark, 0, true); addBox([2, 9, 192], [cx + 96, 4.5, 0], mats.dark, 0, true);
  addBox([184,.18,184],[cx,.1,0],mats.metal);
  // The Assembly Line: two parallel sniper catwalks and opposing end nests.
  for (const x of [cx-25,cx+25]) {
    addRaisedSurface(x,0,10,154,9,mats.metal);
    for (const z of [-66,-22,22,66]) addBox([9,.18,.18],[x,10,z],z%44?mats.neonCyan:mats.orange);
  }
  addRaisedSurface(cx,-72,72,12,9,mats.metal); addRaisedSurface(cx,72,72,12,9,mats.metal);
  addRamp(cx-25,84,9,24,9,0,'z',mats.metal); addRamp(cx+25,-84,9,24,0,9,'z',mats.metal);
  // Piston plates fire horizontally across the warehouse floor at extreme speed.
  addJumpPad(cx-51,-46,cx+42,-46,2,0x50e5ff,'horizontal'); addJumpPad(cx+51,46,cx-42,46,2,0xff4fba,'horizontal');
  // Four lava vats split the ground into dangerous open crossing lanes.
  for (const [x,z] of [[cx-30,-29],[cx+30,-29],[cx-30,29],[cx+30,29]]) {
    const vat=mesh(new THREE.CylinderGeometry(9,10,3,20),mats.dark,[x,1.5,z]); vat.castShadow=true;
    const molten=mesh(new THREE.CircleGeometry(8.5,20),mats.lava,[x,3.05,z]); molten.rotation.x=-Math.PI/2;
    const rim=mesh(new THREE.TorusGeometry(9,.45,8,24),mats.orange,[x,3.1,z]); rim.rotation.x=Math.PI/2;
    lavaHazards.push({ type:'circle',x,z,radius:8.5,maxY:4.2 });
  }
  // Three suspended engine blocks open and close center shots on a synchronized 15-second loop.
  addMovingCrane(cx,-38,16,10,'x',20,0,15000); addMovingCrane(cx,0,18,11,'x',21,Math.PI*2/3,15000); addMovingCrane(cx,38,16,10,'x',20,Math.PI*4/3,15000);
  // The Smelter lane is a molten trench crossed only by rotating platters that eventually tip.
  const smelterX=cx-70;
  const moltenLane=addBox([38,.12,158],[smelterX,.08,0],mats.lava); moltenLane.receiveShadow=false;
  lavaHazards.push({type:'rect',x:smelterX,z:0,w:38,d:158,maxY:2.8});
  for (const [z,phase] of [[-60,0],[-20,1.2],[20,2.4],[60,3.6]]) addAssemblyPlatter(smelterX,z,7.2,4.5,phase);
  addJumpPad(smelterX,-84,smelterX,-60,4.5,0xff6338,'arc');
  // The Ventilation Shafts form a roofed, zero-sightline right-side route with open end entries.
  const ventX=cx+70;
  addRaisedSurface(ventX,0,15,150,5,mats.metal);
  addBox([1,5,150],[ventX-7,7.5,0],mats.dark,0,true); addBox([1,5,150],[ventX+7,7.5,0],mats.dark,0,true); addWalkableBox([15,1,150],[ventX,10,0],mats.dark);
  addRamp(ventX,84,14,18,5,0,'z',mats.metal); addRamp(ventX,-84,14,18,0,5,'z',mats.metal);
  for (const z of [-55,-18,18,55]) { const pipe=mesh(new THREE.CylinderGeometry(.7,.7,12,10),mats.metal,[ventX,8.7,z]); pipe.rotation.z=Math.PI/2; }
  for (const [x,z,p] of [[cx-50,-55,0],[cx+51,-52,1.2],[cx-51,51,2.4],[cx+50,54,3.5],[cx,0,4.4]]) addSteamVent(x,z,p);
  for (const [x,z,r] of [[cx-52,-20,0],[cx+52,20,0],[cx-18,-56,Math.PI/2],[cx+18,56,Math.PI/2]]) addBox([18,2.2,2],[x,1.1,z],mats.concrete,r,true);
}

buildVertigoGrid(); buildOvergrownOutpost(); buildIndustrialFoundry();

function addDestructibleCoverBox(size,position,kind='barricade',material=mats.concrete,hp=150){
  const damageMaterial=material.clone();const item=addBox(size,position,damageMaterial,0,true);const cover={mesh:item,collider:item.userData.collider,kind,maxHealth:hp,health:hp,stage:0,arena:arenaIndexFromX(position[0]),baseColor:damageMaterial.color.clone(),destroyed:false};item.userData.cover=cover;destructibleCover.push(cover);return cover;
}
function coverDamageMultiplier(gun){if(!gun)return 1;if(gun.effect==='explosive'||gun.kind==='launcher'||gun.kind==='grenade')return 2.4;if(gun.kind==='sniper'||gun.kind==='rail'||gun.effect==='pierce')return 1.8;if(gun.kind==='shotgun'||gun.weaponClass.includes('SHOTGUN'))return 1.45;if(gun.kind==='pistol')return .55;return 1;}
function createCoverDebris(cover,point){const count=progress.settings.graphicsQuality==='low'?3:6;while(coverDebris.length>28){const old=coverDebris.shift();world.remove(old.mesh);old.mesh.material.dispose();}for(let index=0;index<count;index++){const material=new THREE.MeshBasicMaterial({color:cover.mesh.material.color,transparent:true,opacity:.9});const piece=new THREE.Mesh(sharedDebrisGeometry,material);piece.userData.sharedGeometry=true;piece.position.copy(point||cover.mesh.position);piece.position.y+=Math.random()*1.7;piece.rotation.set(Math.random()*3,Math.random()*3,Math.random()*3);world.add(piece);coverDebris.push({mesh:piece,velocity:new THREE.Vector3((Math.random()-.5)*7,2+Math.random()*5,(Math.random()-.5)*7),life:1.1+Math.random()*.5});}}
function damageCover(cover,damage,gun,point){
  if(!cover||cover.destroyed)return false;cover.health-=Math.max(1,damage*coverDamageMultiplier(gun));const ratio=cover.health/cover.maxHealth;const nextStage=ratio<=0?3:ratio<.34?2:ratio<.7?1:0;if(nextStage>cover.stage){cover.stage=nextStage;cover.mesh.material.color.copy(cover.baseColor).multiplyScalar(Math.max(.28,1-nextStage*.2));cover.mesh.material.emissive?.setHex(nextStage>=2?0x3d1515:0x000000);createCoverDebris(cover,point);}
  if(cover.health>0)return false;cover.destroyed=true;cover.collider.active=false;cover.mesh.visible=false;const index=occluders.indexOf(cover.mesh);if(index>=0)occluders.splice(index,1);ui.status.textContent=`${cover.kind.toUpperCase()} DESTROYED // ROUTE OPEN`;return true;
}
function updateCoverDebris(dt){for(const debris of [...coverDebris]){debris.life-=dt;debris.velocity.y-=13*dt;debris.mesh.position.addScaledVector(debris.velocity,dt);debris.mesh.rotation.x+=dt*5;debris.mesh.rotation.z+=dt*7;debris.mesh.material.opacity=Math.max(0,debris.life);if(debris.life>0)continue;world.remove(debris.mesh);debris.mesh.material.dispose();coverDebris.splice(coverDebris.indexOf(debris),1);}}
function resetDestructibleCover(){for(const cover of destructibleCover){cover.health=cover.maxHealth;cover.stage=0;cover.destroyed=false;cover.collider.active=true;cover.mesh.visible=cover.arena===state.activeArena;cover.mesh.material.color.copy(cover.baseColor);if(!occluders.includes(cover.mesh))occluders.push(cover.mesh);}}

// Selected cover communicates durability through material and silhouette; decorative foliage remains non-solid.
addDestructibleCoverBox([7,3,.35],[-241,1.5,8],'glass wall',mats.glass,90);addDestructibleCoverBox([7,3,.35],[-199,1.5,8],'glass wall',mats.glass,90);addDestructibleCoverBox([6,2.4,1.1],[-220,1.2,-13],'data barricade',mats.neonPink,130);
addDestructibleCoverBox([8,3,.7],[-25,1.5,25],'wooden door',mats.bark,115);addDestructibleCoverBox([8,2.2,1.2],[26,1.1,-30],'market stall',mats.bark,125);addDestructibleCoverBox([7,2,1.2],[2,1,-57],'small barricade',mats.moss,110);
addDestructibleCoverBox([5,3,5],[200,1.5,-17],'factory crate',mats.rust,170);addDestructibleCoverBox([5,3,5],[240,1.5,18],'factory crate',mats.olive,170);addDestructibleCoverBox([12,4,.45],[290,7.2,0],'vent cover',mats.metal,210);

function addEnvironmentalControl(position,type,label,color=0xff7043,factoryOnly=false){
  const group=new THREE.Group();group.position.set(...position);world.add(group);registerArenaRenderable(group,position[0]);const base=new THREE.Mesh(new THREE.BoxGeometry(1.2,1.6,.75),mats.dark);base.position.y=.8;group.add(base);const screen=new THREE.Mesh(new THREE.BoxGeometry(.74,.46,.05),new THREE.MeshBasicMaterial({color}));screen.position.set(0,1.05,.4);group.add(screen);const beacon=new THREE.Mesh(new THREE.TorusGeometry(.42,.06,8,18),new THREE.MeshBasicMaterial({color}));beacon.position.y=1.85;beacon.rotation.x=Math.PI/2;group.add(beacon);environmentalControls.push({group,screen,beacon,type,label,color,arena:arenaIndexFromX(position[0]),cooldownUntil:0,factoryOnly,pending:false});
}
addEnvironmentalControl([-220,.1,5],'gravity','NEXUS GRAVITY PULSE',0xa96cff);addEnvironmentalControl([0,.1,-10],'flood','RAVINE FLOODGATE',0x50e5ff);addEnvironmentalControl([220,.1,0],'crane','ASSEMBLY CRANE DROP',0xff7043);addEnvironmentalControl([270,.1,-38],'steam','VENT STEAM BLAST',0xe8f2ff);
addEnvironmentalControl([197,.1,63],'conveyor','CLEAR CONVEYOR',0xff7043,true);addEnvironmentalControl([209,.1,63],'power','RESTORE POWER',0x50e5ff,true);addEnvironmentalControl([221,.1,63],'steam','SEAL COOLING PIPE',0xe8f2ff,true);addEnvironmentalControl([233,.1,63],'reactor','STABILIZE REACTOR',0xa96cff,true);
function executeEnvironmentalControl(control){
  const center=control.group.position;for(const enemy of enemies){if(!enemy.alive||enemy.arena!==control.arena)continue;const distance=enemy.group.position.distanceTo(center);if(distance>22)continue;enemy.lastEnvironmentalDamage=performance.now();if(control.type==='gravity'){enemy.slowUntil=performance.now()+2500;enemy.group.position.lerp(center,.35);damageTarget(enemy,35);}else if(control.type==='flood'){enemy.stunnedUntil=performance.now()+950;pushTarget(enemy,enemy.group.position.clone().sub(center),9);damageTarget(enemy,22);}else if(control.type==='steam'){enemy.stunnedUntil=performance.now()+700;damageTarget(enemy,45);}else if(control.type==='crane'){damageTarget(enemy,85);}}
  createPulseBlast(center.clone().add(new THREE.Vector3(0,1,0)),control.type==='crane'?9:15,control.color);ui.status.textContent=`${control.label} // ACTIVATED`;control.pending=false;control.cooldownUntil=performance.now()+10000;control.screen.material.color.setHex(control.color);
}
function activateEnvironmentalControl(control){
  const now=performance.now();if(!control||control.pending||now<control.cooldownUntil)return;if(control.factoryOnly){if(state.gameMode!=='factoryDefense'){ui.status.textContent='TERMINAL OFFLINE // FACTORY MODE ONLY';return;}const emergency=factoryEmergencyCatalog[progress.factory.emergencyIndex%factoryEmergencyCatalog.length];if(control.type!==emergency.control){ui.status.textContent='WRONG MAINTENANCE TERMINAL';return;}progress.factory.emergencyProgress=Math.min(100,progress.factory.emergencyProgress+50);ui.status.textContent=`${emergency.name} // ${progress.factory.emergencyProgress}% REPAIRED`;control.cooldownUntil=now+900;if(progress.factory.emergencyProgress>=100){progress.factory.repairs++;progress.factory.emergencyIndex=(progress.factory.emergencyIndex+1)%factoryEmergencyCatalog.length;progress.factory.emergencyProgress=0;if(state.factoryDefense)state.factoryDefense.emergencyResolved=true;awardBlueprintFragments(1,'FACTORY REPAIR');}saveProgress();renderFactoryPanel();return;}
  control.pending=true;control.screen.material.color.setHex(0xff405c);ui.status.textContent=`WARNING // ${control.label} IN 1 SECOND`;setTimeout(()=>executeEnvironmentalControl(control),900);
}

function addWeaponPickupStation(position,weaponId,ammo,label){
  const group=new THREE.Group();group.position.set(...position);world.add(group);registerArenaRenderable(group,position[0]);const pedestal=new THREE.Mesh(new THREE.CylinderGeometry(1.35,1.65,.7,12),mats.dark);pedestal.position.y=.35;group.add(pedestal);const ring=new THREE.Mesh(new THREE.TorusGeometry(1.05,.08,8,24),new THREE.MeshBasicMaterial({color:0xffc857}));ring.position.y=.75;ring.rotation.x=Math.PI/2;group.add(ring);const core=new THREE.Mesh(new THREE.OctahedronGeometry(.48),new THREE.MeshStandardMaterial({color:0xffc857,emissive:0xff8a35,emissiveIntensity:1.5}));core.position.y=1.55;group.add(core);weaponPickupStations.push({group,ring,core,weaponId,ammo,label,arena:arenaIndexFromX(position[0]),available:true,respawnAt:0});
}
addWeaponPickupStation([-220,24.3,49],'hybrid-bolt',4,'FULLY CHARGED HYBRID BOLT');addWeaponPickupStation([-220,.1,0],'pizza-party-launcher',3,'PIZZA PARTY LAUNCHER');addWeaponPickupStation([0,9,0],'singularity',2,'SINGULARITY CORE');addWeaponPickupStation([0,18.3,-66],'comet-shorty',6,'EXPERIMENTAL COMET SHORTY');addWeaponPickupStation([220,9.4,0],'rubber-chicken-railgun',3,'RUBBER CHICKEN RAILGUN');addWeaponPickupStation([220,.1,72],'hybrid-bolt',4,'HYBRID BOLT');
function releasePowerPickup(message='POWER WEAPON DEPLETED'){
  const pickup=state.powerPickup;if(!pickup)return;const gun=loadout[pickup.weaponIndex];gun.ammo=pickup.originalAmmo;gun.reserve=pickup.originalReserve;state.powerPickup=null;equipQuickSlot(0);ui.status.textContent=message;
}
function collectPowerWeapon(station){
  if(!station?.available)return;if(state.powerPickup)releasePowerPickup('POWER WEAPON SWAPPED');const index=loadout.findIndex(gun=>gun.id===station.weaponId);if(index<0)return;const gun=loadout[index];state.powerPickup={station,weaponIndex:index,originalAmmo:gun.ammo,originalReserve:gun.reserve};station.available=false;station.respawnAt=performance.now()+30000;station.core.visible=false;station.ring.visible=false;gun.ammo=station.ammo;gun.reserve=0;switchWeapon(index,false);progress.discoveredWeapons.add(gun.id);ui.status.textContent=`POWER WEAPON ACQUIRED // ${station.label} // ${station.ammo} SHOTS`;lobbyNotify(`FIELD PICKUP // ${station.label}`,'info');
}
function updateWorldSystems(time,now,dt){updateCoverDebris(dt);for(const control of environmentalControls){if(control.arena!==state.activeArena)continue;control.beacon.rotation.z+=dt*.8;control.beacon.scale.setScalar(.9+Math.sin(time*3)*.08);if(!control.pending&&now>=control.cooldownUntil)control.screen.material.color.setHex(control.color);}for(const station of weaponPickupStations){if(station.arena!==state.activeArena)continue;if(!station.available&&now>=station.respawnAt){station.available=true;station.core.visible=true;station.ring.visible=true;}if(station.available){station.core.rotation.y+=dt*1.8;station.core.position.y=1.55+Math.sin(time*2.8)*.14;station.ring.rotation.z+=dt*.7;}}if(state.powerPickup&&loadout[state.powerPickup.weaponIndex].ammo<=0)releasePowerPickup();}

// Deterministic, collision-free scenery expands each arena beyond its gameplay
// walls. Repeated forms are instanced and never participate in picking/shadows.
const scenicGroups=[];
const scenicClouds=[];
function buildProceduralScenery(){
  const dummy=new THREE.Object3D();
  for(let arenaIndex=0;arenaIndex<arenaDefinitions.length;arenaIndex++){
    const cx=[-220,0,220][arenaIndex];const random=seededRandom(SCENERY_CONFIG.seed+arenaIndex*991);
    const group=new THREE.Group();group.position.x=cx;group.userData.scenery=true;world.add(group);registerArenaRenderable(group,cx);scenicGroups.push(group);
    const peakGeometry=new THREE.ConeGeometry(1,1,7,1,false);peakGeometry.rotateY(Math.PI/7);
    const snowGeometry=new THREE.ConeGeometry(1,1,7,1,false);snowGeometry.rotateY(Math.PI/7);
    const peaks=new THREE.InstancedMesh(peakGeometry,mats.rock,SCENERY_CONFIG.mountainCount);
    const snowcaps=new THREE.InstancedMesh(snowGeometry,mats.snow,SCENERY_CONFIG.mountainCount);
    for(let i=0;i<SCENERY_CONFIG.mountainCount;i++){
      const angle=i/SCENERY_CONFIG.mountainCount*Math.PI*2+(random()-.5)*.18;
      const radius=SCENERY_CONFIG.landscapeRadius+random()*30;const height=THREE.MathUtils.lerp(...SCENERY_CONFIG.mountainHeight,random());const width=height*(.33+random()*.16);
      const x=Math.cos(angle)*radius;const z=Math.sin(angle)*radius;
      dummy.position.set(x,height*.5-2,z);dummy.rotation.set(0,random()*Math.PI,0);dummy.scale.set(width,height,width);dummy.updateMatrix();peaks.setMatrixAt(i,dummy.matrix);
      const snowHeight=height*.27;dummy.position.set(x,height-snowHeight*.48-2,z);dummy.scale.set(width*.51,snowHeight,width*.51);dummy.updateMatrix();snowcaps.setMatrixAt(i,dummy.matrix);
    }
    peaks.instanceMatrix.needsUpdate=true;snowcaps.instanceMatrix.needsUpdate=true;peaks.receiveShadow=false;peaks.castShadow=false;snowcaps.castShadow=false;group.add(peaks,snowcaps);

    const treeCount=[18,SCENERY_CONFIG.treeCount,12][arenaIndex];
    const trunks=new THREE.InstancedMesh(new THREE.CylinderGeometry(.22,.38,1,6),mats.bark,treeCount);
    const crowns=new THREE.InstancedMesh(new THREE.ConeGeometry(1,1,7),arenaIndex===1?mats.moss:mats.leaf,treeCount*2);
    for(let i=0;i<treeCount;i++){
      const angle=random()*Math.PI*2;const radius=108+random()*25;const height=THREE.MathUtils.lerp(...SCENERY_CONFIG.treeHeight,random());const x=Math.cos(angle)*radius;const z=Math.sin(angle)*radius;
      dummy.position.set(x,height*.32,z);dummy.rotation.set(0,random()*Math.PI,0);dummy.scale.set(1,height*.64,1);dummy.updateMatrix();trunks.setMatrixAt(i,dummy.matrix);
      for(let tier=0;tier<2;tier++){const crownHeight=height*(tier?.43:.52);dummy.position.set(x,height*(tier?.61:.86),z);dummy.scale.set(height*(tier?.25:.32),crownHeight,height*(tier?.25:.32));dummy.updateMatrix();crowns.setMatrixAt(i*2+tier,dummy.matrix);}
    }
    trunks.instanceMatrix.needsUpdate=true;crowns.instanceMatrix.needsUpdate=true;trunks.castShadow=false;crowns.castShadow=false;group.add(trunks,crowns);

    const puffCount=SCENERY_CONFIG.cloudCount*3;const cloudField=new THREE.InstancedMesh(new THREE.DodecahedronGeometry(1,0),mats.cloud,puffCount);
    for(let i=0;i<SCENERY_CONFIG.cloudCount;i++){
      const angle=random()*Math.PI*2;const radius=72+random()*92;const altitude=THREE.MathUtils.lerp(...SCENERY_CONFIG.cloudAltitude,random());const baseX=Math.cos(angle)*radius;const baseZ=Math.sin(angle)*radius;
      for(let puff=0;puff<3;puff++){dummy.position.set(baseX+(puff-1)*5.5,altitude+Math.abs(puff-1)*-1.2,baseZ+(random()-.5)*3);dummy.rotation.set(random(),random()*Math.PI,random()*.3);dummy.scale.set(5.5+random()*3,2.1+random()*1.6,3.8+random()*2);dummy.updateMatrix();cloudField.setMatrixAt(i*3+puff,dummy.matrix);}
    }
    cloudField.instanceMatrix.needsUpdate=true;cloudField.renderOrder=-10;cloudField.castShadow=false;cloudField.receiveShadow=false;group.add(cloudField);scenicClouds.push(cloudField);
    if(arenaIndex===1){const lake=new THREE.Mesh(new THREE.CircleGeometry(46,28),mats.water);lake.position.set(0,.025,-126);lake.rotation.x=-Math.PI/2;lake.renderOrder=-5;group.add(lake);}
  }
}
buildProceduralScenery();

// The Chill Deck is a separate, low-pressure lobby activity. Its collision and
// walkable surfaces are enabled only while the player is visiting the deck.
const lobbyCourse={
  group:new THREE.Group(), colliders:[], surfaces:[], checkpoints:[], interactives:[], animated:[], pads:[], colorTiles:[], fish:[], portals:[], doors:[], traffic:[], signs:[], aquariumLights:[], stageLights:[],
  spawn:new THREE.Vector3(...CHILL_DECK_LAYOUT.crossroads), courseSpawn:new THREE.Vector3(...CHILL_DECK_LAYOUT.courseSpawn), chillReturn:new THREE.Vector3(...CHILL_DECK_LAYOUT.socialSpawn), goal:new THREE.Vector3(0,6.2,210.5), goalRadius:4.2,
  fishExcitedUntil:0, aquariumLightMode:0, stageMode:0,
};
lobbyCourse.group.name='lobby-chill-deck';lobbyCourse.group.visible=false;world.add(lobbyCourse.group);
const lobbyCourseMaterials={
  deck:new THREE.MeshStandardMaterial({color:0x345c70,roughness:.58,metalness:.34}),
  trim:new THREE.MeshStandardMaterial({color:0x56e1d0,emissive:0x176f78,emissiveIntensity:.76,roughness:.34,metalness:.38}),
  warm:new THREE.MeshStandardMaterial({color:0xf3b85d,emissive:0x8e4e19,emissiveIntensity:.72,roughness:.46,metalness:.24}),
  cushion:new THREE.MeshStandardMaterial({color:0x765a92,roughness:.86,metalness:.05}),
  pink:new THREE.MeshStandardMaterial({color:0xff5fa2,emissive:0x7d173f,emissiveIntensity:.8,roughness:.38,metalness:.22}),
  violet:new THREE.MeshStandardMaterial({color:0xa96cff,emissive:0x3b176c,emissiveIntensity:.78,roughness:.38,metalness:.28}),
  boost:new THREE.MeshStandardMaterial({color:PARKOUR_SURFACE_COLORS.boost,emissive:0x235f26,emissiveIntensity:.85,roughness:.35,metalness:.2}),
  jump:new THREE.MeshStandardMaterial({color:PARKOUR_SURFACE_COLORS.jump,emissive:0x163b89,emissiveIntensity:.9,roughness:.3,metalness:.25}),
  secret:new THREE.MeshStandardMaterial({color:PARKOUR_SURFACE_COLORS.secret,emissive:0x8a5313,emissiveIntensity:.8,roughness:.32,metalness:.45}),
  wall:new THREE.MeshStandardMaterial({color:0x17364d,emissive:0x0b263b,emissiveIntensity:.48,roughness:.68,metalness:.18}),
};
const lobbyHubMaterials=Object.fromEntries(Object.entries(HUB_NAVIGATION_COLORS).map(([role,color])=>[role,new THREE.MeshStandardMaterial({color,emissive:new THREE.Color(color).multiplyScalar(.26),emissiveIntensity:role==='walkway'?.16:.7,roughness:role==='walkway'?.66:.38,metalness:role==='walkway'?.18:.32})]));
function addLobbyCourseMesh(size,position,material=lobbyCourseMaterials.deck,{solid=false,walkable=false,rotationY=0}={}){
  const item=new THREE.Mesh(chamferedBoxGeometry(size,Math.min(.15,Math.min(...size)*.18)),material);item.position.set(...position);item.rotation.y=rotationY;
  // The hub is already lit by the shared sun/fill setup. Keeping its numerous
  // static collision meshes out of the shadow map removes a large low-end GPU
  // cost without changing collision, floor support, or visual readability.
  item.castShadow=false;item.receiveShadow=true;lobbyCourse.group.add(item);
  if(solid){
    const halfX=Math.abs(Math.cos(rotationY))*size[0]/2+Math.abs(Math.sin(rotationY))*size[2]/2;const halfZ=Math.abs(Math.sin(rotationY))*size[0]/2+Math.abs(Math.cos(rotationY))*size[2]/2;
    const collider={minX:position[0]-halfX,maxX:position[0]+halfX,minY:position[1]-size[1]/2,maxY:position[1]+size[1]/2,minZ:position[2]-halfZ,maxZ:position[2]+halfZ,active:false,mesh:item,lobbyOnly:true,kind:walkable?'walkable':'world'};colliders.push(collider);lobbyCourse.colliders.push(collider);item.userData.collider=collider;
  }
  if(walkable){const surface={type:Math.abs(rotationY)>.001?'orientedRect':'rect',x:position[0],z:position[2],w:size[0],d:size[2],height:position[1]+size[1]/2,angle:rotationY,active:false,mesh:item,arena:1,lobbyOnly:true};platformSurfaces.push(surface);lobbyCourse.surfaces.push(surface);}
  return item;
}
function addLobbyCourseDecor(geometry,material,position,rotation=[0,0,0]){const item=new THREE.Mesh(geometry,material);item.position.set(...position);item.rotation.set(...rotation);item.castShadow=false;item.receiveShadow=false;lobbyCourse.group.add(item);return item;}
const hubSignMaterials=new Map();
function hubSignMaterial(label,color){
  const key=`${label}:${color}`;if(hubSignMaterials.has(key))return hubSignMaterials.get(key);
  const surface=document.createElement('canvas');surface.width=512;surface.height=128;const context=surface.getContext('2d');context.fillStyle='rgba(4,10,20,.94)';context.fillRect(0,0,512,128);context.strokeStyle=`#${color.toString(16).padStart(6,'0')}`;context.lineWidth=8;context.strokeRect(5,5,502,118);context.fillStyle='#eef7ff';context.font='700 31px Arial';context.textAlign='center';context.textBaseline='middle';context.fillText(label,256,54);context.fillStyle=`#${color.toString(16).padStart(6,'0')}`;context.font='700 14px monospace';context.fillText('FOLLOW THE MATCHING FLOOR LINE',256,91);
  const texture=new THREE.CanvasTexture(surface);texture.colorSpace=THREE.SRGBColorSpace;const material=new THREE.MeshBasicMaterial({map:texture,transparent:true,side:THREE.DoubleSide,depthWrite:false});hubSignMaterials.set(key,material);return material;
}
function addHubSign(label,color,position,rotationY=0,width=7.2){
  const sign=addLobbyCourseDecor(new THREE.PlaneGeometry(width,width/4),hubSignMaterial(label,color),position,[0,rotationY,0]);sign.renderOrder=4;sign.userData.hubSign=label;lobbyCourse.signs.push(sign);return sign;
}
function addHubDoor(position,color,rotationY=0,width=7.4,alwaysOpen=false){
  const group=new THREE.Group();group.position.set(...position);group.rotation.y=rotationY;lobbyCourse.group.add(group);const material=lobbyHubMaterials[color];const left=new THREE.Mesh(chamferedBoxGeometry([width/2,4.6,.3],.08),material);const right=left.clone();const closedLeft=-width/4,closedRight=width/4,openOffset=width*.42;left.position.x=alwaysOpen?closedLeft-openOffset:closedLeft;right.position.x=alwaysOpen?closedRight+openOffset:closedRight;group.add(left,right);const header=new THREE.Mesh(chamferedBoxGeometry([width+.7,.48,.52],.08),material);header.position.y=2.5;group.add(header);lobbyCourse.doors.push({group,left,right,closedLeft,closedRight,openOffset,alwaysOpen,position:new THREE.Vector3(...position)});return group;
}
function addHubRailings(connection,material){
  const [x,y,z]=connection.position,[w,,d]=connection.size;const alongX=connection.axis?connection.axis==='x':w>d;const glass=Boolean(connection.glass);const railMaterial=glass?new THREE.MeshPhysicalMaterial({color:HUB_NAVIGATION_COLORS.chill,transparent:true,opacity:.28,roughness:.12,metalness:.08,depthWrite:false}):material;
  if(alongX){for(const side of [-1,1])addLobbyCourseMesh([w,glass?2.25:1.25,.22],[x,y+(glass?1.28:.78),z+side*(d/2-.18)],railMaterial,{solid:true});}
  else for(const side of [-1,1])addLobbyCourseMesh([.22,glass?2.25:1.25,d],[x+side*(w/2-.18),y+(glass?1.28:.78),z],railMaterial,{solid:true});
}
function buildHubPromenade(){
  for(const segment of HUB_PROMENADE_SEGMENTS){
    const floor=addLobbyCourseMesh(segment.size,segment.position,lobbyCourseMaterials.deck,{solid:true,walkable:true});floor.userData.hubPromenade=segment.id;
    const [x,y,z]=segment.position,[w,,d]=segment.size;const alongX=segment.axis==='x';const stripeSize=alongX?[w-1.2,.08,.42]:[.42,.08,d-1.2];addLobbyCourseDecor(new THREE.BoxGeometry(...stripeSize),lobbyHubMaterials.walkway,[x,y+.4,z]);
    const spacing=32,length=alongX?w:d;for(let offset=-length/2+8;offset<=length/2-8;offset+=spacing){const px=alongX?x+offset:x,pz=alongX?z:z+offset;const beacon=addLobbyCourseDecor(new THREE.OctahedronGeometry(.2,0),offset%64?lobbyHubMaterials.information:lobbyHubMaterials.parkour,[px,y+1,pz]);beacon.userData.promenadeBeacon=true;}
  }
  addHubSign('OUTER DISCOVERY LOOP — ALL WINGS CONNECTED',HUB_NAVIGATION_COLORS.walkway,[-118,7.2,120],0,15);
}
function buildHubUpperFloor(){
  for(const slab of HUB_UPPER_FLOOR.slabs){
    const floor=addLobbyCourseMesh(slab.size,slab.position,lobbyCourseMaterials.deck,{solid:true,walkable:true});floor.userData.upperFloor=slab.id;
    const [x,y,z]=slab.position,[w,,d]=slab.size;const accent=slab.id.includes('parkour')?lobbyHubMaterials.parkour:slab.id.includes('museum')?lobbyHubMaterials.shop:slab.id.includes('lounge')?lobbyHubMaterials.chill:lobbyHubMaterials.information;const stripSize=slab.axis==='x'?[Math.max(2,w-1),.08,.28]:[.28,.08,Math.max(2,d-1)];addLobbyCourseDecor(new THREE.BoxGeometry(...stripSize),accent,[x,y+.39,z]);
  }
  for(const stairway of HUB_UPPER_FLOOR.stairs){
    for(let index=0;index<stairway.steps;index++){
      const [baseX,baseY,baseZ]=stairway.base,[dx,,dz]=stairway.direction;const position=[baseX+dx*stairway.run*index,baseY+stairway.rise*index,baseZ+dz*stairway.run*index];const step=addLobbyCourseMesh([stairway.width,.4,stairway.run+.08],position,index===stairway.steps-1?lobbyHubMaterials.chill:lobbyCourseMaterials.deck,{solid:true,walkable:true});step.userData.upperStair=stairway.id;
    }
  }
  const glass=new THREE.MeshPhysicalMaterial({color:0x8de8ff,transparent:true,opacity:.24,roughness:.1,metalness:.08,depthWrite:false});
  for(const [size,position] of [[[46,2.1,.25],[-44,10.6,194]],[[.25,2.1,28],[-127,10.6,272]],[[.25,2.1,28],[73,10.6,272]],[[58,2.1,.25],[-44,10.6,346]]])addLobbyCourseMesh(size,position,glass,{solid:true});
  addHubSign('SECOND FLOOR — OBSERVATION + WEAPON MUSEUM',HUB_NAVIGATION_COLORS.information,[-110,12.4,257],0,12);
  addHubSign('PARKOUR OVERLOOK',HUB_NAVIGATION_COLORS.parkour,[54,12.2,259],0,8.5);
  addHubSign('SKY LOUNGE + TROPHIES',HUB_NAVIGATION_COLORS.chill,[-44,12.2,322],0,9.5);
}
function buildConnectedLobbyHub(addControl){
  for(const area of HUB_AREAS){
    if(!area.existing)addLobbyCourseMesh(area.size,area.position,lobbyCourseMaterials.deck,{solid:true,walkable:true});
    const material=lobbyHubMaterials[area.colorRole];const [x,y,z]=area.position,[w,,d]=area.size;
    for(const segment of hubRoomWallSegments(area)){
      const wall=addLobbyCourseMesh(segment.size,segment.position,lobbyCourseMaterials.wall,{solid:true});wall.userData.hubRoom=area.id;wall.userData.wallSide=segment.side;
      const horizontal=segment.size[0]>segment.size[2];const capSize=horizontal?[segment.size[0],.11,.12]:[.12,.11,segment.size[2]];addLobbyCourseDecor(new THREE.BoxGeometry(...capSize),material,[segment.position[0],segment.position[1]+segment.size[1]/2-.28,segment.position[2]]);
    }
    addLobbyCourseDecor(new THREE.BoxGeometry(Math.max(5,w*.72),.075,.22),material,[x,y+.45,z-d*.32]);
    addLobbyCourseDecor(new THREE.BoxGeometry(.22,.075,Math.max(5,d*.62)),material,[x-w*.3,y+.45,z]);
    // The crossroads already has four doorway signs. Keeping another large
    // sign in its center would obscure the player's view and invite phasing.
    if(!area.existing&&area.id!=='atrium')addHubSign(area.label,HUB_NAVIGATION_COLORS[area.colorRole],[x,7.75,z-d/2+1.05],0,Math.min(9,w*.72));
  }
  for(const connection of HUB_CONNECTIONS){const material=lobbyHubMaterials[connection.colorRole];addLobbyCourseMesh(connection.size,connection.position,lobbyCourseMaterials.deck,{solid:true,walkable:true});addLobbyCourseDecor(new THREE.BoxGeometry(connection.size[0]*.72,.08,connection.size[2]*.16),material,[connection.position[0],connection.position[1]+.34,connection.position[2]]);addHubRailings(connection,material);}
  buildHubPromenade();buildHubUpperFloor();

  // The atrium engine and canopy are the visual anchor seen immediately at spawn.
  const engine=new THREE.Group();engine.position.set(-44,10.25,272);lobbyCourse.group.add(engine);const core=new THREE.Mesh(new THREE.IcosahedronGeometry(1.2,1),lobbyHubMaterials.information);core.scale.y=1.25;engine.add(core);const orbit=new THREE.Mesh(new THREE.TorusGeometry(2.15,.08,8,36),lobbyHubMaterials.walkway);orbit.rotation.x=Math.PI/2;engine.add(orbit);const orbitB=new THREE.Mesh(new THREE.TorusGeometry(1.7,.06,8,32),lobbyHubMaterials.shop);orbitB.rotation.y=Math.PI/2;engine.add(orbitB);lobbyCourse.animated.push({object:engine,core,orbit,orbitB,baseY:engine.position.y,phase:.2});
  const canopy=new THREE.Mesh(new THREE.CylinderGeometry(13.2,13.2,.18,24,1,true),new THREE.MeshPhysicalMaterial({color:0x88dfff,transparent:true,opacity:.12,roughness:.08,metalness:.05,side:THREE.DoubleSide,depthWrite:false}));canopy.position.set(-44,11.5,272);canopy.rotation.z=Math.PI/2;lobbyCourse.group.add(canopy);
  for(const [x,z] of [[-56,260],[-32,260],[-56,284],[-32,284]]){const pillar=addLobbyCourseDecor(new THREE.CylinderGeometry(.22,.34,7.3,8),mats.steel,[x,7.65,z]);pillar.castShadow=true;}

  // Distant skyline and deterministic transit make the station feel inhabited.
  for(let index=0;index<12;index++){const angle=index/12*Math.PI*2;const radius=58+(index%3)*7;const height=10+(index%5)*4;const tower=addLobbyCourseDecor(chamferedBoxGeometry([5,height,5],.35),index%3===0?lobbyHubMaterials.play:mats.dark,[-44+Math.cos(angle)*radius,height/2-1,272+Math.sin(angle)*radius]);tower.userData.hubSkyline=true;}
  for(let index=0;index<5;index++){const craft=new THREE.Group();craft.position.set(-70+index*15,16+index%2*3,220-index*8);const body=new THREE.Mesh(new THREE.OctahedronGeometry(.55,0),index%2?lobbyHubMaterials.play:lobbyHubMaterials.shop);body.scale.set(2.3,.45,.8);craft.add(body);const light=new THREE.Mesh(new THREE.SphereGeometry(.08,6,4),lobbyHubMaterials.walkway);light.position.x=1.2;craft.add(light);lobbyCourse.group.add(craft);lobbyCourse.traffic.push({group:craft,origin:craft.position.clone(),phase:index*1.7,speed:.7+index*.08});}

  addHubDoor([-44,6.15,256], 'play',0,9,true);addHubDoor([-60,6.15,272],'shop',Math.PI/2,9,true);addHubDoor([-28,6.15,272],'parkour',Math.PI/2,9,true);addHubDoor([-44,6.15,288],'chill',0,9,true);
  addHubDoor([-18,6.15,214],'range',Math.PI/2,9,true);addHubDoor([-108,6.15,243],'inventory',0,9,true);addHubDoor([-108,6.15,302],'factory',0,9,true);
  addHubSign('NORTH — MAPS + FIRING RANGE',HUB_NAVIGATION_COLORS.play,[-44,6.9,255.65],0,9.8);
  addHubSign('WEST — WEAPONS + ABILITIES',HUB_NAVIGATION_COLORS.shop,[-60.35,6.9,272],Math.PI/2,9.8);
  addHubSign('EAST — PARKOUR CAMPUS',HUB_NAVIGATION_COLORS.parkour,[-27.65,6.9,272],Math.PI/2,9.8);
  addHubSign('SOUTH — CHILL + SOCIAL',HUB_NAVIGATION_COLORS.chill,[-44,6.9,288.35],Math.PI,9.8);

  // Matchmaking holograms reuse the existing map identities and play flow.
  const mapColors=[0x50e5ff,0x67e8a5,0xff7043];for(let index=0;index<3;index++){const x=-56+index*12;const stand=addLobbyCourseMesh([6.2,.8,5.2],[x,4.4,208],lobbyCourseMaterials.deck,{solid:true,walkable:true});const map=new THREE.Mesh(new THREE.OctahedronGeometry(.95,0),new THREE.MeshStandardMaterial({color:mapColors[index],emissive:mapColors[index],emissiveIntensity:.45,transparent:true,opacity:.82}));map.position.set(x,6.4,208);lobbyCourse.group.add(map);const ring=new THREE.Mesh(new THREE.TorusGeometry(1.35,.035,7,26),lobbyHubMaterials.play);ring.position.copy(map.position);ring.rotation.x=Math.PI/2;lobbyCourse.group.add(ring);lobbyCourse.animated.push({object:map,core:map,orbit:ring,baseY:map.position.y,phase:index*1.9});stand.userData.mapDisplay=index;}

  // A physical crate chamber, ability lab, safety threshold, and cargo lift.
  const crate=new THREE.Group();crate.position.set(-112,5.25,277);lobbyCourse.group.add(crate);const shell=new THREE.Mesh(chamferedBoxGeometry([3.3,1.7,2.2],.22),mats.dark);crate.add(shell);for(const side of [-1,1]){const lock=new THREE.Mesh(chamferedBoxGeometry([.34,.62,.2],.05),lobbyHubMaterials.shop);lock.position.set(side*.85,.15,1.12);crate.add(lock);}const crateRing=new THREE.Mesh(new THREE.TorusGeometry(2.2,.055,8,32),lobbyHubMaterials.shop);crateRing.rotation.x=Math.PI/2;crateRing.position.y=-.8;crate.add(crateRing);const crateCollider={minX:-113.65,maxX:-110.35,minY:4.4,maxY:6.1,minZ:275.9,maxZ:278.1,active:false,mesh:crate,lobbyOnly:true,kind:'world'};colliders.push(crateCollider);lobbyCourse.colliders.push(crateCollider);crate.userData.collider=crateCollider;lobbyCourse.animated.push({object:crate,core:shell,orbit:crateRing,baseY:crate.position.y,phase:2.3,noFloat:true});
  for(let index=0;index<3;index++){const icon=new THREE.Mesh(new THREE.TorusKnotGeometry(.55,.12,48,7,2,3),index===0?lobbyHubMaterials.inventory:index===1?lobbyHubMaterials.information:lobbyHubMaterials.chill);icon.position.set(-116+index*8,6.5,214);icon.scale.setScalar(.72);lobbyCourse.group.add(icon);lobbyCourse.animated.push({object:icon,core:icon,orbit:null,baseY:icon.position.y,phase:index*2});}
  addLobbyCourseDecor(new THREE.BoxGeometry(10,.08,.7),lobbyHubMaterials.range,[-18,4.08,214]);
  const lift=addLobbyCourseMesh([10,.55,10],[-108,4.18,326],lobbyHubMaterials.factory,{solid:true,walkable:true});const liftRing=addLobbyCourseDecor(new THREE.TorusGeometry(5.1,.08,8,36),lobbyHubMaterials.factory,[-108,4.5,326],[Math.PI/2,0,0]);lobbyCourse.animated.push({object:liftRing,core:liftRing,orbit:null,baseY:liftRing.position.y,phase:5,noFloat:true});lift.userData.cargoElevator=true;

  const terminals=CHILL_DECK_LAYOUT.terminalPositions;
  addControl('daily-reward','CLAIM DAILY REWARD',terminals['daily-reward'],lobbyHubMaterials.information,claimHubDailyReward);
  addControl('tutorial-guide','OPEN MOVEMENT TUTORIAL',terminals['tutorial-guide'],lobbyHubMaterials.chill,()=>{state.statusMessage='HUB GUIDE';ui.status.textContent='WEST WEAPONS // NORTH MAPS + RANGE // EAST PARKOUR // SOUTH CHILL';});
  addControl('quick-play','QUICK PLAY',terminals['quick-play'],lobbyHubMaterials.play,()=>launchModeFromHub('quick'));
  addControl('map-selector','CHOOSE MAP + MAIN GAME',terminals['map-selector'],lobbyHubMaterials.play,()=>openLobbyDestination('play'));
  addControl('private-match','PRIVATE MATCH + ROOM CODE',terminals['private-match'],lobbyHubMaterials.play,()=>openPlayRouteFromHub('duels'));
  addControl('range-door','ENTER FIRING RANGE',terminals['range-door'],lobbyHubMaterials.range,enterRangeFromHub);
  addControl('drone-lab','RUN DRONE AIM DEMO',terminals['drone-lab'],lobbyHubMaterials.range,()=>{createPulseBlast(new THREE.Vector3(...terminals['drone-lab']).setY(4.2),4,HUB_NAVIGATION_COLORS.range);ui.status.textContent='DRONE LAB // TRACKING DEMONSTRATION ACTIVE';});
  addControl('shop-wing','BUY WEAPONS',terminals['shop-wing'],lobbyHubMaterials.shop,()=>openLobbyDestination('shop'));
  addControl('inventory-wing','CHOOSE LOADOUT',terminals['inventory-wing'],lobbyHubMaterials.inventory,()=>openLobbyDestination('inventory'));
  addControl('crate-chamber','OPEN CRATE CHAMBER',terminals['crate-chamber'],lobbyHubMaterials.shop,()=>openLobbyDestination('shop'));
  addControl('hub-preview-room','OPEN COSMETIC PREVIEW',terminals['hub-preview-room'],lobbyHubMaterials.inventory,openCosmeticPreviewRoom);
  addControl('ability-lab','CHOOSE ABILITIES + PASSIVES',terminals['ability-lab'],lobbyHubMaterials.inventory,()=>openLobbyDestination('build'));
  addControl('utility-sandbox','TEST UTILITY EFFECT',terminals['utility-sandbox'],lobbyHubMaterials.inventory,()=>{createPulseBlast(new THREE.Vector3(...terminals['utility-sandbox']).setY(4.2),5,HUB_NAVIGATION_COLORS.inventory);lobbyCourse.pads.forEach(pad=>pad.cooldown=0);ui.status.textContent='UTILITY SANDBOX // COOLDOWNS RESET';});
  addControl('personal-factory','DESCEND TO FACTORY DEFENSE',terminals['personal-factory'],lobbyHubMaterials.factory,()=>launchModeFromHub('factory'));
  addControl('public-tycoon','PUBLIC TYCOON DISTRICT',terminals['public-tycoon'],lobbyHubMaterials.factory,announceTycoonAccess);
}
function buildLobbyCourse(){
  const [socialX,,socialZ]=CHILL_DECK_LAYOUT.socialArea.position;
  const platforms=[
    {size:[...CHILL_DECK_LAYOUT.size],position:[...CHILL_DECK_LAYOUT.position],checkpoint:[...CHILL_DECK_LAYOUT.courseSpawn]},
    {size:[8,.8,7],position:[0,4,254],checkpoint:[0,6.15,254]},
    {size:[7,.8,6.5],position:[2.3,4.45,243.5],checkpoint:[2.3,6.6,243.5]},
    {size:[7,.8,6.5],position:[-2.2,4.9,233],checkpoint:[-2.2,7.05,233]},
    {size:[8,.8,8],position:[2,5.35,222.5],checkpoint:[2,7.5,225]},
    {size:[12,.8,10],position:[0,5.8,210.5],checkpoint:[0,7.95,212.5]},
  ];
  platforms.forEach((entry,index)=>{const platform=addLobbyCourseMesh(entry.size,entry.position,index===platforms.length-1?lobbyCourseMaterials.warm:lobbyCourseMaterials.deck,{solid:true,walkable:true});const strip=addLobbyCourseDecor(new THREE.BoxGeometry(entry.size[0]-.45,.08,.18),index===platforms.length-1?lobbyCourseMaterials.trim:lobbyCourseMaterials.warm,[entry.position[0],entry.position[1]+.45,entry.position[2]-entry.size[2]/2+.18]);strip.castShadow=false;lobbyCourse.checkpoints.push(new THREE.Vector3(...entry.checkpoint));platform.userData.courseIndex=index;});
  // A deliberately low wall teaches the same Space + forward vault used in combat.
  addLobbyCourseMesh([7.1,1.12,.7],[2,6.31,222.4],lobbyCourseMaterials.trim,{solid:true});
  for(const side of [-1,1]){
    const loungeX=socialX+side*9;const planterX=socialX+side*18;
    addLobbyCourseMesh([6.4,.55,1.8],[loungeX,4.23,socialZ+1],lobbyCourseMaterials.cushion,{solid:true,walkable:true});
    addLobbyCourseMesh([6.4,.3,.55],[loungeX,4.92,socialZ+1.7],lobbyCourseMaterials.deck,{solid:true});
    const planter=addLobbyCourseMesh([2.7,1.15,2.7],[planterX,4.18,socialZ+10],mats.dark,{solid:true,walkable:true});
    const trunk=addLobbyCourseDecor(new THREE.CylinderGeometry(.16,.24,2.2,6),mats.bark,[planterX,5.7,socialZ+10]);const crown=addLobbyCourseDecor(new THREE.ConeGeometry(1.55,3.7,7),mats.moss,[planterX,7.9,socialZ+10]);planter.receiveShadow=true;trunk.castShadow=true;crown.castShadow=true;
  }
  // Arrival Plaza: a holographic Engine, reactive dance tiles, and readable
  // portal silhouettes make the deck feel like a destination rather than a menu.
  const engine=new THREE.Group();engine.position.set(socialX,7.8,socialZ+8);engine.scale.setScalar(.78);lobbyCourse.group.add(engine);
  const engineCore=new THREE.Mesh(new THREE.IcosahedronGeometry(1.05,1),lobbyCourseMaterials.violet);engineCore.scale.y=1.4;engine.add(engineCore);
  const engineOrbit=new THREE.Mesh(new THREE.TorusGeometry(1.8,.055,8,36),lobbyCourseMaterials.trim);engineOrbit.rotation.x=Math.PI/2;engine.add(engineOrbit);
  const engineOrbitB=new THREE.Mesh(new THREE.TorusGeometry(1.42,.045,8,30),lobbyCourseMaterials.pink);engineOrbitB.rotation.y=Math.PI/2;engine.add(engineOrbitB);
  lobbyCourse.animated.push({object:engine,core:engineCore,orbit:engineOrbit,orbitB:engineOrbitB,baseY:engine.position.y,phase:.8});
  const tileMaterials=[lobbyCourseMaterials.trim,lobbyCourseMaterials.pink,lobbyCourseMaterials.violet,lobbyCourseMaterials.warm];
  for(let row=0;row<2;row++)for(let column=0;column<6;column++){
    const x=socialX+(column-2.5)*1.75,z=socialZ-7+row*1.75;const tile=addLobbyCourseDecor(new THREE.BoxGeometry(1.42,.08,1.42),tileMaterials[(row*6+column)%tileMaterials.length],[x,4.06,z]);
    lobbyCourse.colorTiles.push({mesh:tile,x,z,phase:(row*6+column)*.65,baseMaterial:tile.material});
  }
  for(let index=0;index<8;index++){const angle=index/8*Math.PI*2;const light=addLobbyCourseDecor(new THREE.OctahedronGeometry(.24,0),tileMaterials[index%tileMaterials.length].clone(),[socialX+Math.cos(angle)*11,7.2,socialZ-5+Math.sin(angle)*4.2]);light.userData.stageLight=true;lobbyCourse.stageLights.push(light);}
  for(let index=0;index<3;index++){const cabinet=addLobbyCourseMesh([2.4,3.2,1.4],[-68+index*4.2,5.6,350],mats.dark,{solid:true});const screen=addLobbyCourseDecor(new THREE.BoxGeometry(1.65,1.05,.08),tileMaterials[index%tileMaterials.length],[-68+index*4.2,6.05,349.26]);screen.userData.arcadeScreen=index;}
  const koiPool=addLobbyCourseDecor(new THREE.CylinderGeometry(4.8,4.8,.18,24),new THREE.MeshPhysicalMaterial({color:0x3abfd8,transparent:true,opacity:.58,roughness:.18,metalness:.08}),[-40,4.12,350]);koiPool.userData.koiPool=true;
  for(let index=0;index<5;index++){const koi=addLobbyCourseDecor(new THREE.OctahedronGeometry(.18,0),index%2?lobbyCourseMaterials.warm:lobbyCourseMaterials.pink,[-43+index*1.5,4.28,350+(index%2?1.2:-1.1)]);koi.scale.set(1.8,.55,.65);lobbyCourse.fish.push({group:koi,originX:koi.position.x,originY:koi.position.y,phase:10+index,swimRange:.8});}
  // Trophy deck and rooftop garden are optional side routes with fully backed
  // collision. Gold always means a secret; white/slate remains ordinary solid.
  addLobbyCourseMesh([12,.8,10],[-70,6,350],lobbyCourseMaterials.deck,{solid:true,walkable:true});
  for(const [index,step] of [[0,[-62,4.3,344]],[1,[-65,4.85,346]],[2,[-68,5.4,348]]]){const stair=addLobbyCourseMesh([3,.45,2.6],step,index===2?lobbyCourseMaterials.secret:lobbyCourseMaterials.deck,{solid:true,walkable:true});stair.userData.secretRoute='trophy';stair.userData.secretStep=index;}
  for(let index=0;index<3;index++){
    const plinth=addLobbyCourseMesh([1.1,.55+index*.2,1.1],[-73+index*3,6.7+index*.1,350],lobbyCourseMaterials.secret,{solid:true,walkable:true});
    const trophy=addLobbyCourseDecor(new THREE.OctahedronGeometry(.42+index*.07),index===1?lobbyCourseMaterials.pink:lobbyCourseMaterials.secret,[plinth.position.x,7.55+index*.22,350]);
    lobbyCourse.animated.push({object:trophy,core:trophy,orbit:null,baseY:trophy.position.y,phase:index*1.7});
  }
  addLobbyCourseMesh([12,.8,12],[48,6,246],lobbyCourseMaterials.deck,{solid:true,walkable:true});
  for(const [x,z] of [[44,243],[51,242],[48,249]]){const trunk=addLobbyCourseDecor(new THREE.CylinderGeometry(.12,.19,1.5,6),mats.bark,[x,7.15,z]);const crown=addLobbyCourseDecor(new THREE.DodecahedronGeometry(.72,0),mats.moss,[x,8.25,z]);trunk.castShadow=true;crown.castShadow=true;}
  for(const [index,position] of [[0,[30,4.45,264]],[1,[36,4.95,258]],[2,[42,5.45,252]]]){
    const drone=addLobbyCourseMesh([2.2,.35,2.2],position,index===2?lobbyCourseMaterials.secret:lobbyCourseMaterials.violet,{solid:true,walkable:true});lobbyCourse.animated.push({object:drone,core:drone,orbit:null,baseY:position[1],phase:index*1.9,noFloat:true});
  }
  // More deliberate secrets sit on separate side routes off the outer loop.
  addLobbyCourseMesh([12,.8,10],[-184,4.8,302],lobbyCourseMaterials.deck,{solid:true,walkable:true});
  for(const [index,z] of [320,314,308].entries()){const plate=addLobbyCourseMesh([5,.42,4],[-184,4.1+index*.34,z],index===2?lobbyCourseMaterials.secret:lobbyCourseMaterials.deck,{solid:true,walkable:true});plate.userData.secretRoute='developer-workshop';}
  for(const [index,x] of [-34,-29,-24,-19].entries()){const stone=addLobbyCourseMesh([3.5,.4,3.5],[x,4.15+index*.45,356],index===3?lobbyCourseMaterials.secret:lobbyCourseMaterials.deck,{solid:true,walkable:true});stone.userData.secretRoute='koi-stones';}
  addLobbyCourseMesh([12,.8,12],[208,4.8,126],lobbyCourseMaterials.secret,{solid:true,walkable:true});
  addHubSign('NEON TREASURE VAULT — FIND ALL SIX SECRETS',HUB_NAVIGATION_COLORS.parkour,[208,9.2,132],Math.PI,11);
  // Aquarium Grotto: two long tanks create a wide glass tunnel. The center
  // remains a clear public path while a maintenance ledge hides a secret.
  const aquariumX=-160,aquariumZ=348;
  const glassMaterial=new THREE.MeshPhysicalMaterial({color:0x66dfff,transparent:true,opacity:.2,roughness:.08,metalness:.05,depthWrite:false,transmission:.35});
  for(const side of [-1,1]){
    const tankZ=aquariumZ+side*7;addLobbyCourseMesh([38,1,6],[aquariumX,4.05,tankZ],lobbyCourseMaterials.deck,{solid:true,walkable:true});
    const aquarium=addLobbyCourseMesh([37,4.6,5.2],[aquariumX,6.85,tankZ],glassMaterial,{solid:true});aquarium.renderOrder=2;aquarium.userData.aquariumTank=true;
    for(let index=0;index<7;index++){
      const fish=new THREE.Group();fish.position.set(aquariumX-15+index*5,5.8+(index%3)*.72,tankZ);lobbyCourse.group.add(fish);
      const body=new THREE.Mesh(new THREE.OctahedronGeometry(.42+(index%2)*.08,0),index%3===0?lobbyCourseMaterials.warm:index%3===1?lobbyCourseMaterials.pink:lobbyCourseMaterials.trim);body.scale.set(1.65,.72,.58);fish.add(body);
      const tail=new THREE.Mesh(new THREE.ConeGeometry(.28,.58,3),lobbyCourseMaterials.trim);tail.rotation.z=-Math.PI/2;tail.position.x=-.76;fish.add(tail);lobbyCourse.fish.push({group:fish,originX:fish.position.x,originY:fish.position.y,phase:index*1.4+side,swimRange:2.4+(index%3)*.55});
    }
    for(let index=0;index<5;index++){const lamp=addLobbyCourseDecor(new THREE.SphereGeometry(.16,7,5),(index%2?lobbyCourseMaterials.trim:lobbyCourseMaterials.violet).clone(),[aquariumX-14+index*7,8.6,tankZ]);lobbyCourse.aquariumLights.push(lamp);}
  }
  const tunnelRoof=addLobbyCourseDecor(new THREE.CylinderGeometry(7.1,7.1,38,18,1,true,0,Math.PI),glassMaterial,[aquariumX,8.3,aquariumZ],[0,0,Math.PI/2]);tunnelRoof.renderOrder=2;tunnelRoof.userData.aquariumTunnel=true;
  addHubSign('AQUARIUM GROTTO — FEED FISH + FIND THE VENT',HUB_NAVIGATION_COLORS.information,[aquariumX,10.8,aquariumZ-6.8],0,15);
  for(const [index,position] of [[0,[-176,4.28,359]],[1,[-179,4.78,361]],[2,[-182,5.28,363]]]){const ledge=addLobbyCourseMesh([3.2,.45,2.4],position,index===2?lobbyCourseMaterials.secret:lobbyCourseMaterials.deck,{solid:true,walkable:true});ledge.userData.secretRoute='aquarium-vent';ledge.userData.secretStep=index;}
  // A blue tutorial pad and green strip are local, predictable training tools.
  const trainingPad=addLobbyCourseDecor(new THREE.CylinderGeometry(1.35,1.35,.14,12),lobbyCourseMaterials.jump,[-9.5,4.12,264]);trainingPad.scale.z=.78;
  lobbyCourse.pads.push({type:'jump',x:-9.5,z:264,radius:1.65,cooldown:0});
  const boostStrip=addLobbyCourseDecor(new THREE.BoxGeometry(4.6,.09,1.45),lobbyCourseMaterials.boost,[21.5,4.08,264]);
  lobbyCourse.pads.push({type:'boost',x:21.5,z:264,radius:2.5,cooldown:0});
  for(const side of [-1,1])for(let z=250;z>=214;z-=12){const lamp=addLobbyCourseDecor(new THREE.CylinderGeometry(.055,.08,3.2,6),mats.steel,[side*7.2,6.1+(250-z)*.045,z]);const light=addLobbyCourseDecor(new THREE.OctahedronGeometry(.24),lobbyCourseMaterials.warm,[side*7.2,7.75+(250-z)*.045,z]);lamp.castShadow=false;light.castShadow=false;}
  const archMat=lobbyCourseMaterials.trim;for(const side of [-1,1])addLobbyCourseDecor(new THREE.BoxGeometry(.45,4.8,.45),archMat,[side*4.7,8.5,207.4]);addLobbyCourseDecor(new THREE.BoxGeometry(9.85,.45,.45),archMat,[0,10.7,207.4]);
  const goalRing=addLobbyCourseDecor(new THREE.TorusGeometry(2.35,.13,8,28),lobbyCourseMaterials.warm,[0,8.35,207.45],[0,0,0]);goalRing.name='lobby-course-goal';lobbyCourse.goalRing=goalRing;
  const loungeRing=addLobbyCourseDecor(new THREE.TorusGeometry(6.2,.055,8,40),lobbyCourseMaterials.trim,[socialX,5.1,socialZ+1],[Math.PI/2,0,0]);loungeRing.name='lobby-course-lounge-ring';lobbyCourse.loungeRing=loungeRing;
  // Lounge holograms and a stylized armory display give the social deck a
  // purpose without exposing the combat inventory in this weapon-free mode.
  for(const side of [-1,1]){
    const holo=new THREE.Group();holo.position.set(socialX+side*10,6.3,socialZ+1);lobbyCourse.group.add(holo);
    const pedestal=new THREE.Mesh(new THREE.CylinderGeometry(.7,.9,.45,8),mats.dark);pedestal.position.y=-1.75;holo.add(pedestal);
    const core=new THREE.Mesh(new THREE.OctahedronGeometry(.7,0),side<0?lobbyCourseMaterials.trim:lobbyCourseMaterials.warm);core.scale.y=1.35;holo.add(core);
    const orbit=new THREE.Mesh(new THREE.TorusGeometry(1.05,.035,6,24),side<0?lobbyCourseMaterials.warm:lobbyCourseMaterials.trim);orbit.rotation.x=Math.PI/2;holo.add(orbit);
    lobbyCourse.animated.push({object:holo,core,orbit,baseY:holo.position.y,phase:side<0?0:Math.PI});
  }
  const display=new THREE.Group();display.position.set(socialX,6.3,socialZ+12.5);lobbyCourse.group.add(display);
  const displayBack=addLobbyCourseMesh([8.2,3.1,.35],[socialX,6.3,socialZ+12.5],mats.dark,{solid:true});displayBack.userData.socialDisplay=true;
  for(const [index,color] of [0x50e5ff,0xff5fa2,0xe7ff57].entries()){
    const weaponGroup=new THREE.Group();weaponGroup.position.set((index-1)*2.45,.25,.3);weaponGroup.rotation.z=-.08;display.add(weaponGroup);
    const displayMaterial=new THREE.MeshStandardMaterial({color,emissive:color,emissiveIntensity:.32,metalness:.55,roughness:.3});
    const body=new THREE.Mesh(chamferedBoxGeometry([1.55,.38,.34],.07),displayMaterial);weaponGroup.add(body);
    const barrel=new THREE.Mesh(new THREE.CylinderGeometry(.07,.09,.85,7),mats.steel);barrel.rotation.z=Math.PI/2;barrel.position.x=1.12;weaponGroup.add(barrel);
    const grip=new THREE.Mesh(chamferedBoxGeometry([.28,.7,.28],.05),mats.black);grip.position.set(-.35,-.46,0);grip.rotation.z=-.28;weaponGroup.add(grip);
  }
  const addControl=(id,label,position,colorMaterial,action)=>{
    const group=new THREE.Group();group.position.set(...position);lobbyCourse.group.add(group);
    const base=new THREE.Mesh(chamferedBoxGeometry([1.5,1.05,1.1],.13),mats.dark);base.position.y=-.45;group.add(base);
    const panel=new THREE.Mesh(chamferedBoxGeometry([1.18,.15,.82],.05),colorMaterial);panel.position.set(0,.14,-.08);panel.rotation.x=-.36;group.add(panel);
    const halo=new THREE.Mesh(new THREE.TorusGeometry(.48,.035,6,20),colorMaterial);halo.position.y=.72;halo.rotation.x=Math.PI/2;group.add(halo);
    const collider={minX:position[0]-.75,maxX:position[0]+.75,minY:position[1]-.98,maxY:position[1]+.08,minZ:position[2]-.55,maxZ:position[2]+.55,active:false,mesh:group,lobbyOnly:true,kind:'terminal'};colliders.push(collider);lobbyCourse.colliders.push(collider);group.userData.collider=collider;
    lobbyCourse.interactives.push({id,label,group,action,halo,phase:lobbyCourse.interactives.length*2.1});
  };
  buildConnectedLobbyHub(addControl);
  const terminalPositions=CHILL_DECK_LAYOUT.terminalPositions;
  const fxDummy=new THREE.Group();fxDummy.position.set(-48,5.8,313);lobbyCourse.group.add(fxDummy);const fxBody=new THREE.Mesh(new THREE.CapsuleGeometry(.42,1.05,4,8),new THREE.MeshStandardMaterial({color:0x24566b,emissive:0x50e5ff,emissiveIntensity:.55,transparent:true,opacity:.78,roughness:.28}));fxDummy.add(fxBody);const fxRing=new THREE.Mesh(new THREE.TorusGeometry(.75,.045,7,24),lobbyCourseMaterials.violet);fxRing.rotation.x=Math.PI/2;fxRing.position.y=1.25;fxDummy.add(fxRing);lobbyCourse.animated.push({object:fxDummy,core:fxBody,orbit:fxRing,baseY:fxDummy.position.y,phase:3.4});lobbyCourse.killFxDummy=fxDummy;
  addControl('kill-fx-preview','PREVIEW EQUIPPED KILL FX',terminalPositions['kill-fx-preview'],lobbyCourseMaterials.violet,()=>previewKillFx(equippedKillFx(),fxDummy.getWorldPosition(new THREE.Vector3())));
  addControl('cosmetic-preview-room','OPEN COSMETIC PREVIEW ROOM',terminalPositions['cosmetic-preview-room'],lobbyCourseMaterials.pink,()=>openCosmeticPreviewRoom());
  addControl('terminal-challenges','OPEN CHALLENGES',terminalPositions['terminal-challenges'],lobbyCourseMaterials.warm,()=>openLobbyDestination('challenges'));
  addControl('trophy-gallery','OPEN TROPHY + COLLECTION GALLERY',terminalPositions['trophy-gallery'],lobbyCourseMaterials.secret,()=>openLobbyDestination('collection'));
  addControl('aquarium-feed','FEED THE AQUARIUM FISH',terminalPositions['aquarium-feed'],lobbyCourseMaterials.trim,()=>{lobbyCourse.fishExcitedUntil=performance.now()+10000;createPulseBlast(new THREE.Vector3(-160,5.1,348),5,HUB_NAVIGATION_COLORS.information);ui.status.textContent='AQUARIUM // FEED RELEASED // FISH SCHOOL EXCITED';uiSound('reward');});
  addControl('aquarium-lights','CHANGE AQUARIUM LIGHTS',terminalPositions['aquarium-lights'],lobbyCourseMaterials.violet,()=>{lobbyCourse.aquariumLightMode=(lobbyCourse.aquariumLightMode+1)%3;ui.status.textContent=`AQUARIUM LIGHTS // MODE ${lobbyCourse.aquariumLightMode+1}`;});
  addControl('arcade-challenge','START ARCADE LIGHT CHALLENGE',terminalPositions['arcade-challenge'],lobbyCourseMaterials.pink,()=>{lobbyCourse.stageMode=(lobbyCourse.stageMode+1)%3;ui.status.textContent='ARCADE CHALLENGE // STEP ON THE REACTIVE FLOOR TILES';});
  addControl('jukebox','CHANGE SOCIAL STAGE MUSIC',terminalPositions.jukebox,lobbyCourseMaterials.warm,()=>{lobbyCourse.stageMode=(lobbyCourse.stageMode+1)%3;ui.status.textContent=`JUKEBOX // LIGHT SHOW ${lobbyCourse.stageMode+1}`;uiSound('select');});
  addControl('koi-controls','CHANGE KOI WATERFALL',terminalPositions['koi-controls'],lobbyCourseMaterials.trim,()=>{createPulseBlast(new THREE.Vector3(-40,4.25,350),3.5,HUB_NAVIGATION_COLORS.chill);ui.status.textContent='KOI GARDEN // WATERFALL FLOW CHANGED';});
  addControl('treasure-vault','CHECK NEON TREASURE VAULT',terminalPositions['treasure-vault'],lobbyCourseMaterials.secret,()=>{const found=Object.values(progress.stats.lobbySecrets).filter(Boolean).length;ui.status.textContent=found>=LOBBY_SECRET_TOTAL?'NEON TREASURE VAULT // OPEN // BLUEPRINT ARCHIVE UNLOCKED':`NEON TREASURE VAULT // ${found} / ${LOBBY_SECRET_TOTAL} SECRETS FOUND`;if(found>=LOBBY_SECRET_TOTAL)createPulseBlast(new THREE.Vector3(...terminalPositions['treasure-vault']).setY(4.2),6,PARKOUR_SURFACE_COLORS.secret);});
  addControl('restart','RESTART PARKOUR RUN',terminalPositions.restart,lobbyCourseMaterials.warm,()=>resetLobbyParkourRun());
  addControl('return','RETURN TO MAIN LOBBY',terminalPositions.return,lobbyCourseMaterials.trim,()=>exitLobbyParkour());
  // The timed courses are physical wings of the Chill Deck. A broad east
  // concourse keeps the entrances visible and separates them enough that the
  // three themes read as real places instead of a cluster of menu portals.
  const campusCenterX=(CHILL_DECK_LAYOUT.campusBounds.minX+CHILL_DECK_LAYOUT.campusBounds.maxX)/2;
  addLobbyCourseMesh([CHILL_DECK_LAYOUT.concourseWidth,.8,CHILL_DECK_LAYOUT.concourseDepth],[campusCenterX,3.6,CHILL_DECK_LAYOUT.concourseZ],lobbyCourseMaterials.deck,{solid:true,walkable:true});
  addLobbyCourseDecor(new THREE.BoxGeometry(CHILL_DECK_LAYOUT.concourseWidth-6,.09,.55),lobbyCourseMaterials.boost,[campusCenterX,4.05,CHILL_DECK_LAYOUT.concourseZ+CHILL_DECK_LAYOUT.concourseDepth/2-1.3]);
  addHubSign('PARKOUR CAMPUS — THREE CONNECTED COURSE WINGS',HUB_NAVIGATION_COLORS.parkour,[38,8.05,280.4],0,14);
  const courseMaterials=[lobbyCourseMaterials.trim,lobbyCourseMaterials.boost,lobbyCourseMaterials.warm];
  const embeddedRoutes=PARKOUR_ROUTES.map((route,index)=>({x:route.spawn[0],name:PARKOUR_COURSES[index].name,color:PARKOUR_COURSES[index].color,points:route.checkpoints}));
  embeddedRoutes.forEach((route,courseIndex)=>{
    const material=courseMaterials[courseIndex];
    const laneHalf=CHILL_DECK_LAYOUT.courseLaneWidth/2;
    const returnX=route.x+laneHalf-3.5;
    const expertX=route.x-laneHalf+3.5;
    const routeMinZ=CHILL_DECK_LAYOUT.campusBounds.minZ+4;
    const routeMaxZ=CHILL_DECK_LAYOUT.portalZ+4;
    const routeDepth=routeMaxZ-routeMinZ;
    const routeCenterZ=(routeMinZ+routeMaxZ)/2;
    // Every course has a forgiving recovery floor, a clearly separated main
    // lane, an optional expert route on the left, and a continuous raised
    // return path on the right. This keeps failed jumps recoverable without
    // making the timed route feel automatic.
    addLobbyCourseMesh([CHILL_DECK_LAYOUT.courseLaneWidth,.55,routeDepth],[route.x,2.05,routeCenterZ],lobbyCourseMaterials.jump,{solid:true,walkable:true});
    addLobbyCourseMesh([6,.55,routeDepth],[returnX,3.72,routeCenterZ],lobbyCourseMaterials.jump,{solid:true,walkable:true});
    addLobbyCourseMesh([CHILL_DECK_LAYOUT.courseLaneWidth,.55,8],[route.x,3.72,routeMinZ],lobbyCourseMaterials.jump,{solid:true,walkable:true});
    addLobbyCourseMesh([CHILL_DECK_LAYOUT.courseLaneWidth,.55,9],[route.x,3.72,routeMaxZ],lobbyCourseMaterials.jump,{solid:true,walkable:true});
    // Segmented solid walls establish each obby as its own room while gaps at
    // every checkpoint allow players to escape to the recovery path.
    for(const z of [278,254,230,206,182,158,134]){
      addLobbyCourseMesh([.55,3.25,14],[route.x-laneHalf+.3,5.25,z],material,{solid:true});
      addLobbyCourseMesh([.55,3.25,14],[route.x+laneHalf-.3,5.25,z],material,{solid:true});
    }
    route.points.forEach(([x,z],index)=>{
      const width=courseIndex===1?18:17;const depth=index===route.points.length-1?13:11;const y=3.7;
      const platform=addLobbyCourseMesh([width,.7,depth],[x,y,z],courseIndex===0&&index%2?lobbyCourseMaterials.violet:material,{solid:true,walkable:true});
      platform.userData.embeddedParkour=route.name;platform.userData.courseIndex=courseIndex;
      const ring=addLobbyCourseDecor(new THREE.RingGeometry(1.05,1.45,28),material,[x,y+.38,z],[-Math.PI/2,0,0]);ring.material=material;ring.userData.landingMarker=true;
      const connectorWidth=Math.abs(returnX-x)+3;addLobbyCourseMesh([connectorWidth,.45,2.6],[(returnX+x)/2,3.72,z],lobbyCourseMaterials.jump,{solid:true,walkable:true});
      if(index%2===1){
        addLobbyCourseMesh([6,.55,8],[expertX,4.25,z-2],lobbyCourseMaterials.violet,{solid:true,walkable:true});
        const expertConnector=Math.abs(x-expertX);addLobbyCourseMesh([expertConnector,.42,2.15],[(x+expertX)/2,4.1,z-2],lobbyCourseMaterials.violet,{solid:true,walkable:true});
      }
      if([2,5,7].includes(index))addLobbyCourseMesh([7.5,1.05,.65],[x,4.55,z-3.1],material,{solid:true});
      if(index<route.points.length-1){const next=route.points[index+1];const arrow=addLobbyCourseDecor(new THREE.ConeGeometry(.38,1.15,4),material,[x,y+.48,z-2.15],[Math.PI/2,0,Math.atan2(next[0]-x,next[1]-z)]);arrow.userData.routeArrow=true;}
    });
    const boostPad=addLobbyCourseDecor(new THREE.CylinderGeometry(2.25,2.5,.16,18),lobbyCourseMaterials.boost,[route.x,4.18,258]);boostPad.userData.coursePad='boost';lobbyCourse.pads.push({mesh:boostPad,type:'boost',x:route.x,z:258,radius:2.7,cooldown:0});
    const jumpPad=addLobbyCourseDecor(new THREE.CylinderGeometry(2.25,2.5,.16,18),lobbyCourseMaterials.trim,[route.x,4.18,194]);jumpPad.userData.coursePad='jump';lobbyCourse.pads.push({mesh:jumpPad,type:'jump',x:route.x,z:194,radius:2.7,cooldown:0});
    addHubSign(route.name,route.color,[route.x,8.4,284.5],0,9.2);
    addHubSign('MAIN ROUTE',route.color,[route.x,7.15,268],0,6.8);
    addHubSign('OPTIONAL SIDE ROUTE',HUB_NAVIGATION_COLORS.inventory,[expertX,7.15,244],Math.PI/2,7.5);
    addHubSign('RETURN PATH',HUB_NAVIGATION_COLORS.range,[returnX,7.1,218],Math.PI/2,6.8);
    for(const z of [270,234,198,162,130]){
      const beacon=addLobbyCourseDecor(new THREE.CylinderGeometry(.08,.12,2.5,6),material,[route.x-7.7,5.25,z]);
      const glow=addLobbyCourseDecor(new THREE.OctahedronGeometry(.22),material,[route.x-7.7,6.65,z]);beacon.castShadow=false;glow.castShadow=false;
    }
  });
  // Theme-specific readable details stay out of the main collision path.
  const [neonX,canopyX,foundryX]=CHILL_DECK_LAYOUT.courseCenters;
  for(const z of [250,226,202,178,154])addLobbyCourseMesh([6,1.05,.65],[neonX,5.0,z],lobbyCourseMaterials.violet,{solid:true});
  for(const [x,z] of [[canopyX-8,258],[canopyX+8,234],[canopyX-8,210],[canopyX+8,186],[canopyX-8,150]]){addLobbyCourseDecor(new THREE.CylinderGeometry(.28,.42,3.5,7),mats.bark,[x,5.25,z]);addLobbyCourseDecor(new THREE.DodecahedronGeometry(1.15,0),mats.moss,[x,7.1,z]);}
  for(const z of [258,222,186,150]){const warning=addLobbyCourseDecor(new THREE.TorusGeometry(.62,.11,7,20),lobbyCourseMaterials.warm,[foundryX-8,5.35,z]);warning.rotation.y=Math.PI/2;lobbyCourse.animated.push({object:warning,core:warning,orbit:null,baseY:warning.position.y,phase:z*.04,noFloat:true});}

  const portalMaterials=courseMaterials;
  HUB_PARKOUR_PORTALS.forEach(({id,label,x,z,courseIndex})=>{const material=portalMaterials[courseIndex];
    const floorStrip=addLobbyCourseDecor(new THREE.BoxGeometry(4,.09,CHILL_DECK_LAYOUT.concourseDepth-2),material,[x,4.05,CHILL_DECK_LAYOUT.concourseZ]);floorStrip.userData.courseFloorStrip=courseIndex;
    const portal=new THREE.Group();portal.position.set(x,7.1,(z??CHILL_DECK_LAYOUT.portalZ)-3);lobbyCourse.group.add(portal);
    const ring=new THREE.Mesh(new THREE.TorusGeometry(1.55,.12,8,28),material);portal.add(ring);
    const grid=new THREE.Mesh(new THREE.CircleGeometry(1.34,24),new THREE.MeshBasicMaterial({color:material.color,transparent:true,opacity:.12,side:THREE.DoubleSide,depthWrite:false}));grid.position.z=.04;portal.add(grid);
    lobbyCourse.portals.push({group:portal,ring,phase:courseIndex*2});
    addControl(id,label,[x-3.8,5.25,(z??CHILL_DECK_LAYOUT.portalZ)+4.5],material,()=>openParkourFromDeck(courseIndex));
  });
  const secretPositions=CHILL_DECK_LAYOUT.secretPositions;
  addControl('secret-aquarium','PRESS CYAN SECRET BUTTON',secretPositions.aquarium.position,lobbyCourseMaterials.trim,()=>activateLobbySecret('aquarium','AQUARIUM VENT'));
  addControl('secret-trophy','PRESS PINK SECRET BUTTON',secretPositions.trophy.position,lobbyCourseMaterials.pink,()=>activateLobbySecret('trophy','TROPHY DECK'));
  addControl('secret-garden','PRESS GOLD PIZZA BUTTON',secretPositions.pizza.position,lobbyCourseMaterials.secret,()=>activateLobbySecret('pizza','ROOFTOP GARDEN'));
  addControl('secret-developer','PRESS PURPLE WORKSHOP BUTTON',secretPositions.developer.position,lobbyCourseMaterials.violet,()=>activateLobbySecret('developer','DEVELOPER WORKSHOP'));
  addControl('secret-koi','PRESS GREEN KOI BUTTON',secretPositions.koi.position,lobbyCourseMaterials.trim,()=>activateLobbySecret('koi','KOI STEPPING STONES'));
  addControl('secret-vault','PRESS GOLD VAULT BUTTON',secretPositions.vault.position,lobbyCourseMaterials.secret,()=>activateLobbySecret('vault','NEON TREASURE VAULT'));
  // Physical range threshold: the pillars use the same collision path as room
  // walls, so the visible frame can never be walked through.
  for(const z of [210.1,217.9])addLobbyCourseMesh([.42,3.7,.42],[-18,5.85,z],lobbyCourseMaterials.trim,{solid:true});
  addLobbyCourseMesh([.42,.42,8.2],[-18,7.7,214],lobbyCourseMaterials.trim,{solid:true});
}
buildLobbyCourse();
lobbyCourse.checkpoints.unshift(lobbyCourse.courseSpawn.clone());
lobbyCourse.checkpoints.unshift(lobbyCourse.spawn.clone());

// Advanced traversal obstacles share the main player capsule and the existing
// arena surface registry. They never create a parallel movement controller.
const traversalObstacles={walls:[],rails:[],bars:[],poles:[],precisionPads:[],crumbling:[],rotatingBeams:[],rings:[],bounceWalls:[],balanceBeams:[],ladders:[],airVents:[],breakables:[],treasures:[]};
const traversalMaterials={
  runnable:new THREE.MeshStandardMaterial({color:0x315f76,emissive:0x123e59,emissiveIntensity:.62,roughness:.5,metalness:.35}),
  rail:new THREE.MeshStandardMaterial({color:0xe6ff57,emissive:0x597b17,emissiveIntensity:1.05,roughness:.24,metalness:.45}),
  grapple:new THREE.MeshStandardMaterial({color:0xa96cff,emissive:0x4b2089,emissiveIntensity:.95,roughness:.28,metalness:.32}),
  moving:new THREE.MeshStandardMaterial({color:0xffd45a,emissive:0x845319,emissiveIntensity:.72,roughness:.4,metalness:.36}),
  hazard:new THREE.MeshStandardMaterial({color:0xff5366,emissive:0x861a2b,emissiveIntensity:.9,roughness:.4,metalness:.24}),
  stable:new THREE.MeshStandardMaterial({color:0xe8f4f5,emissive:0x173a46,emissiveIntensity:.2,roughness:.64,metalness:.2}),
};
let traversalObstacleSequence=0;
function obstacleActive(obstacle){return obstacle.lobbyOnly?state.lobbyParkour:!state.lobbyParkour&&obstacle.arena===state.activeArena;}
function arenaTraversalBox(size,position,material=traversalMaterials.stable,{walkable=false,rotationY=0}={}){return walkable?addWalkableBox(size,position,material,rotationY):addBox(size,position,material,rotationY,true);}
function lobbyTraversalBox(size,position,material=traversalMaterials.stable,{walkable=false,rotationY=0}={}){return addLobbyCourseMesh(size,position,material,{solid:true,walkable,rotationY});}
function makeRunnableWall(size,position,{lobbyOnly=false,ticTac=false,bounceDirection=null,id=`runnable-${++traversalObstacleSequence}`}={}){
  const item=lobbyOnly?lobbyTraversalBox(size,position,traversalMaterials.runnable):arenaTraversalBox(size,position,traversalMaterials.runnable);const collider=item.userData.collider;collider.wallRunnable=true;collider.traversalId=id;collider.ticTac=ticTac;collider.bounceDirection=bounceDirection;const markerMaterial=new THREE.MeshBasicMaterial({color:ticTac?0xa96cff:0x50e5ff,transparent:true,opacity:.82,depthWrite:false});
  for(let row=-1;row<=1;row++){const marker=new THREE.Mesh(new THREE.BoxGeometry(size[0]>.8?1.25:.08,.09,size[0]>.8?.08:1.25),markerMaterial);marker.position.set(position[0],position[1]+row*1.1,position[2]);marker.position[size[0]>.8?'z':'x']+=(size[0]>.8?size[2]:size[0])*.51;(lobbyOnly?lobbyCourse.group:world).add(marker);if(!lobbyOnly)registerArenaRenderable(marker,position[0]);}
  const obstacle={type:ticTac?'ticTacWall':'wall',item,collider,arena:arenaIndexFromX(position[0]),lobbyOnly,id};traversalObstacles.walls.push(obstacle);if(bounceDirection)traversalObstacles.bounceWalls.push({...obstacle,direction:new THREE.Vector3(...bounceDirection).normalize(),cooldown:0});return obstacle;
}
function makeRail(start,end,{lobbyOnly=false}={}){const a=new THREE.Vector3(...start),b=new THREE.Vector3(...end),direction=b.clone().sub(a),length=direction.length(),mid=a.clone().add(b).multiplyScalar(.5);const item=new THREE.Mesh(new THREE.CylinderGeometry(.11,.11,length,8),traversalMaterials.rail);item.position.copy(mid);item.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),direction.clone().normalize());item.castShadow=false;(lobbyOnly?lobbyCourse.group:world).add(item);if(!lobbyOnly)registerArenaRenderable(item,a.x);const obstacle={type:'rail',item,start:a,end:b,direction:direction.normalize(),length,arena:arenaIndexFromX(a.x),lobbyOnly};traversalObstacles.rails.push(obstacle);return obstacle;}
function makeBars(start,end,count,{lobbyOnly=false,pole=false}={}){const a=new THREE.Vector3(...start),b=new THREE.Vector3(...end),group=new THREE.Group();(lobbyOnly?lobbyCourse.group:world).add(group);for(let index=0;index<count;index++){const point=a.clone().lerp(b,index/Math.max(1,count-1));const bar=new THREE.Mesh(new THREE.CylinderGeometry(.09,.09,2.2,7),traversalMaterials.grapple);bar.rotation.z=Math.PI/2;bar.position.copy(point);group.add(bar);}if(!lobbyOnly)registerArenaRenderable(group,a.x);const obstacle={type:pole?'swingingPole':'monkeyBars',group,start:a,end:b,length:a.distanceTo(b),arena:arenaIndexFromX(a.x),lobbyOnly};(pole?traversalObstacles.poles:traversalObstacles.bars).push(obstacle);return obstacle;}
function makePrecisionPad(position,{lobbyOnly=false}={}){const material=new THREE.MeshStandardMaterial({color:0x67e8a5,emissive:0x187c61,emissiveIntensity:.9,roughness:.35});const item=new THREE.Mesh(new THREE.CylinderGeometry(1.35,1.45,.18,16),material);item.position.set(...position);(lobbyOnly?lobbyCourse.group:world).add(item);if(!lobbyOnly)registerArenaRenderable(item,position[0]);const obstacle={type:'precisionPad',item,position:new THREE.Vector3(...position),radius:1.45,arena:arenaIndexFromX(position[0]),lobbyOnly,cooldown:0};traversalObstacles.precisionPads.push(obstacle);return obstacle;}
function makeCrumblingPlatform(size,position){const item=arenaTraversalBox(size,position,traversalMaterials.moving,{walkable:true});const surface=platformSurfaces.findLast(entry=>entry.mesh===item);const obstacle={type:'crumblingPlatform',item,collider:item.userData.collider,surface,originY:position[1],arena:arenaIndexFromX(position[0]),touchedAt:0,resetAt:0};traversalObstacles.crumbling.push(obstacle);return obstacle;}
function makeRotatingBeam(position,length=12){const item=arenaTraversalBox([length,.45,1],position,traversalMaterials.moving,{walkable:true});const surface=platformSurfaces.findLast(entry=>entry.mesh===item);surface.dynamic=true;const obstacle={type:'rotatingBeam',item,collider:item.userData.collider,surface,origin:new THREE.Vector3(...position),length,arena:arenaIndexFromX(position[0]),lastAngle:0};item.userData.collider.dynamic=true;traversalObstacles.rotatingBeams.push(obstacle);return obstacle;}
function makeMomentumRing(position,direction){const item=new THREE.Mesh(new THREE.TorusGeometry(2.15,.16,8,28),traversalMaterials.rail);item.position.set(...position);const launch=new THREE.Vector3(...direction).normalize();item.quaternion.setFromUnitVectors(new THREE.Vector3(0,0,1),launch);world.add(item);registerArenaRenderable(item,position[0]);const obstacle={type:'momentumRing',item,direction:launch,arena:arenaIndexFromX(position[0]),cooldown:0};traversalObstacles.rings.push(obstacle);return obstacle;}
function makeBalanceBeam(size,position){const item=arenaTraversalBox(size,position,traversalMaterials.stable,{walkable:true});traversalObstacles.balanceBeams.push({type:'balanceBeam',item,arena:arenaIndexFromX(position[0])});return item;}
function makeAirVent(position,height=13){const group=new THREE.Group();group.position.set(...position);const base=new THREE.Mesh(new THREE.CylinderGeometry(1.9,2.2,.45,12),traversalMaterials.rail);const column=new THREE.Mesh(new THREE.CylinderGeometry(1.7,1.9,height,16,1,true),new THREE.MeshBasicMaterial({color:0x50e5ff,transparent:true,opacity:.1,side:THREE.DoubleSide,depthWrite:false}));column.position.y=height/2;group.add(base,column);world.add(group);registerArenaRenderable(group,position[0]);traversalObstacles.airVents.push({type:'airVent',group,position:new THREE.Vector3(...position),height,radius:2.1,arena:arenaIndexFromX(position[0])});return group;}
function makeMovingLadder(position,range=7){const item=arenaTraversalBox([1.3,7,.55],position,traversalMaterials.moving);const collider=item.userData.collider;collider.dynamic=true;traversalObstacles.ladders.push({type:'movingLadder',item,collider,origin:new THREE.Vector3(...position),range,arena:arenaIndexFromX(position[0]),lastY:position[1]});return item;}
function makeBreakableShortcut(size,position){const item=arenaTraversalBox(size,position,traversalMaterials.hazard);const obstacle={type:'breakableShortcut',item,collider:item.userData.collider,arena:arenaIndexFromX(position[0]),broken:false};item.userData.breakableShortcut=obstacle;traversalObstacles.breakables.push(obstacle);return obstacle;}
function makeParkourTreasure(position,label){const group=new THREE.Group();group.position.set(...position);const core=new THREE.Mesh(new THREE.OctahedronGeometry(.52,0),lobbyCourseMaterials.secret);const ring=new THREE.Mesh(new THREE.TorusGeometry(.9,.06,7,24),traversalMaterials.rail);ring.rotation.x=Math.PI/2;group.add(core,ring);world.add(group);registerArenaRenderable(group,position[0]);traversalObstacles.treasures.push({type:'parkourTreasure',group,core,ring,label,arena:arenaIndexFromX(position[0]),collected:false,baseY:position[1]});return group;}
function makeRouteSign(label,position,color=0x67e85d){
  const board=new THREE.Mesh(chamferedBoxGeometry([5.8,1.15,.18],.08),new THREE.MeshStandardMaterial({color:0x101a25,emissive:color,emissiveIntensity:.2,roughness:.52}));board.position.set(...position);world.add(board);registerArenaRenderable(board,position[0]);
  const canvas=document.createElement('canvas');canvas.width=768;canvas.height=128;const context=canvas.getContext('2d');const cssColor=`#${color.toString(16).padStart(6,'0')}`;
  context.fillStyle='rgba(5,12,20,.9)';context.fillRect(0,0,canvas.width,canvas.height);context.strokeStyle=cssColor;context.lineWidth=8;context.strokeRect(5,5,canvas.width-10,canvas.height-10);context.fillStyle=cssColor;context.font='800 40px "DM Mono", monospace';context.textAlign='center';context.textBaseline='middle';context.shadowColor=cssColor;context.shadowBlur=15;context.fillText(label,canvas.width/2,canvas.height/2,canvas.width-42);
  const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;texture.minFilter=THREE.LinearFilter;texture.generateMipmaps=false;
  const marker=new THREE.Mesh(new THREE.PlaneGeometry(5.3,.72),new THREE.MeshBasicMaterial({map:texture,transparent:true,side:THREE.DoubleSide,toneMapped:false}));marker.position.z=.11;board.add(marker);board.userData.routeLabel=label;return board;
}

const ROUTE_SIGN_COLORS=Object.freeze({main:0x67e85d,expert:0xff4b57,treasure:0xa96cff,recovery:0x4f8dff});
const parkourLandingTargets=[];const parkourReturnPortals=[];const courseConveyors=[];const courseMachinery={pistons:[],fans:[]};
function markMainRouteSurface(item,{assistRadius=null}={}){
  const surface=platformSurfaces.findLast(entry=>entry.mesh===item);if(!surface)return item;
  surface.parkourMain=true;surface.assistRadius=assistRadius??Math.max(1.35,Math.min(surface.w||surface.radius||2,surface.d||surface.radius||2)*.42);
  parkourLandingTargets.push({surface,x:surface.x,z:surface.z,y:surface.height,radius:surface.assistRadius,arena:surface.arena});return item;
}
function makeLandingMarker(position,radius=1.25,color=PARKOUR_SURFACE_COLORS.checkpoint){
  const ring=new THREE.Mesh(new THREE.RingGeometry(radius*.62,radius,28),new THREE.MeshBasicMaterial({color,transparent:true,opacity:.82,side:THREE.DoubleSide,depthWrite:false}));ring.rotation.x=-Math.PI/2;ring.position.set(...position);ring.position.y+=.025;world.add(ring);registerArenaRenderable(ring,position[0]);return ring;
}
function makeRouteArrow(from,to,color=PARKOUR_SURFACE_COLORS.checkpoint){
  const start=new THREE.Vector3(...from),end=new THREE.Vector3(...to),direction=end.clone().sub(start);direction.y=0;if(direction.lengthSq()<.01)return null;direction.normalize();
  const arrow=new THREE.Mesh(new THREE.ConeGeometry(.42,1.3,4),new THREE.MeshBasicMaterial({color,transparent:true,opacity:.86,depthWrite:false}));arrow.position.copy(start);arrow.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),direction);world.add(arrow);registerArenaRenderable(arrow,from[0]);return arrow;
}
function makeProjectedTrajectory(start,end,arcHeight=4,color=PARKOUR_SURFACE_COLORS.jump){
  const group=new THREE.Group();for(let index=1;index<10;index++){const t=index/10;const dot=new THREE.Mesh(new THREE.SphereGeometry(.11,6,4),new THREE.MeshBasicMaterial({color,transparent:true,opacity:.72,depthWrite:false}));dot.position.set(THREE.MathUtils.lerp(start[0],end[0],t),THREE.MathUtils.lerp(start[1],end[1],t)+Math.sin(t*Math.PI)*arcHeight,THREE.MathUtils.lerp(start[2],end[2],t));group.add(dot);}world.add(group);registerArenaRenderable(group,start[0]);return group;
}
function makeReturnPortal(courseIndex,position){
  const course=PARKOUR_COURSES[courseIndex];const group=new THREE.Group();group.position.set(...position);const ring=new THREE.Mesh(new THREE.TorusGeometry(2.3,.2,10,36),new THREE.MeshStandardMaterial({color:course.color,emissive:course.color,emissiveIntensity:1.3,metalness:.35,roughness:.2}));const field=new THREE.Mesh(new THREE.CircleGeometry(2.05,32),new THREE.MeshBasicMaterial({color:course.color,transparent:true,opacity:.12,side:THREE.DoubleSide,depthWrite:false}));field.position.z=.04;group.add(ring,field);group.userData.arenaIndex=course.arena;world.add(group);registerArenaRenderable(group,position[0]);parkourReturnPortals.push({courseIndex,group,ring,radius:3.3});makeRouteSign('RETURN TO CHILL DECK — PRESS F',[position[0],position[1]+3.4,position[2]-.35],course.color);return group;
}
function makeCoursePiston(position,phase=0){
  const item=arenaTraversalBox([5,1.25,8],position,traversalMaterials.hazard);const collider=item.userData.collider;collider.dynamic=true;const warning=new THREE.PointLight(PARKOUR_SURFACE_COLORS.hazard,0,9,2);warning.position.set(position[0],2.2,position[2]);world.add(warning);registerArenaRenderable(warning,position[0]);courseMachinery.pistons.push({item,collider,warning,originY:position[1],lastY:position[1],phase,arena:arenaIndexFromX(position[0])});return item;
}
function makeCourseFan(position,phase=0){
  const group=new THREE.Group();group.position.set(...position);for(let index=0;index<4;index++){const blade=new THREE.Mesh(new THREE.BoxGeometry(.28,4.5,.16),traversalMaterials.moving);blade.rotation.z=index*Math.PI/2;group.add(blade);}const hub=new THREE.Mesh(new THREE.CylinderGeometry(.45,.45,.5,10),traversalMaterials.hazard);hub.rotation.x=Math.PI/2;group.add(hub);world.add(group);registerArenaRenderable(group,position[0]);courseMachinery.fans.push({group,phase,arena:arenaIndexFromX(position[0]),spinning:false});return group;
}
function makeCourseConveyor(size,position,direction=[1,0,0],speed=2.2){
  const item=markMainRouteSurface(arenaTraversalBox(size,position,traversalMaterials.moving,{walkable:true}));const surface=platformSurfaces.findLast(entry=>entry.mesh===item);courseConveyors.push({item,surface,direction:new THREE.Vector3(...direction).normalize(),speed,arena:arenaIndexFromX(position[0])});return item;
}

// Chill Deck: safe, clearly marked tutorial versions.
makeRunnableWall([.65,5,12],[-8,6.5,239],{lobbyOnly:true,id:'chill-wallrun'});
makeRunnableWall([5,3.1,.65],[7,5.55,240],{lobbyOnly:true,ticTac:true,id:'chill-tictac'});
makeRail([-8,7.2,252],[-2,7.2,244],{lobbyOnly:true});makePrecisionPad([-8,4.12,257],{lobbyOnly:true});
// Retired arena copies are kept out of the scene. Timed trials now use the
// three physical course wings constructed inside the Chill Deck above.
if(false){
// Neon Velocity: a forgiving ground tutorial feeds three fixed rooftops. Moving
// data blocks remain above it as a deliberately marked expert shortcut.
for(const z of [78,68,58])arenaTraversalBox([7,1.05,.7],[-300,.53,z],traversalMaterials.stable);
arenaTraversalBox([8,.48,10],[-300,1.7,47],traversalMaterials.stable); // taller slide-tunnel roof
addJumpPad(-300,28,-300,15,18,PARKOUR_SURFACE_COLORS.jump,'vertical',6.4);
for(const [x,z,y,w,d] of [[-300,15,18,13,14],[-289,-3,18.4,13,14],[-278,-21,18.8,13,14]]){
  const platform=markMainRouteSurface(arenaTraversalBox([w,.7,d],[x,y-.35,z],traversalMaterials.stable,{walkable:true}),{assistRadius:4.6});makeLandingMarker([x,y+.03,z],2.1);platform.userData.parkourRoute='main';
}
markMainRouteSurface(arenaTraversalBox([58,.7,9],[-247,18.35,-33],traversalMaterials.stable,{walkable:true}),{assistRadius:3.5});
markMainRouteSurface(arenaTraversalBox([60,.45,14],[-270,7.2,4],traversalMaterials.stable,{walkable:true}),{assistRadius:5.4});
const neonLowerPath=markMainRouteSurface(arenaTraversalBox([10,.7,42],[-220,18.35,-12],traversalMaterials.stable,{walkable:true}),{assistRadius:3.8});neonLowerPath.userData.recoveryRoute=true;
makeRunnableWall([.7,7,20],[-214.4,21.5,-10],{id:'neon-wallrun'});makeRail([-220,19.4,8],[-220,25.1,49]);makePrecisionPad([-275,19.2,-33]);makePrecisionPad([-220,19.2,-33]);makeCrumblingPlatform([5,.55,5],[-247,22.3,18]);
makeLandingMarker([-300,.04,49],1.5);makeLandingMarker([-220,18.74,-33],1.8);makeProjectedTrajectory([-300,.5,38],[-300,1.1,31],2.8);makeProjectedTrajectory([-300,.45,28],[-300,18.2,15],7.5);makeRouteArrow([-300,.12,84],[-300,.12,74]);makeRouteArrow([-300,.12,54],[-300,.12,45]);makeRouteArrow([-265,19,-33],[-245,19,-33]);makeRouteArrow([-220,19,-27],[-220,19,-12]);
makeRouteSign('MAIN ROUTE — SAFE',[-302,2.5,85],ROUTE_SIGN_COLORS.main);makeRouteSign('EXPERT SHORTCUT — DIFFICULT',[-247,22.9,18],ROUTE_SIGN_COLORS.expert);makeRouteSign('RECOVERY ROUTE',[-270,8.25,4],ROUTE_SIGN_COLORS.recovery);makeRouteSign('HOLD SPACE // RELEASE AT 50%',[-300,2.5,37],PARKOUR_SURFACE_COLORS.checkpoint);makeRouteSign('LOWER WALKWAY — SAFE',[-220,20,-24],ROUTE_SIGN_COLORS.recovery);makeReturnPortal(0,[-220,26.4,49]);

// Canopy Circuit: oversized guided pads and broad, stationary branch collision.
// The golden moving branch line is optional and reconnects near the waterfall.
addJumpPad(-48,-42,-38,-38,18,PARKOUR_SURFACE_COLORS.boost,'arc',5.2);
for(const [x,z,w,d] of [[-38,-38,14,14],[-25,-25,14,14],[-10,-10,14,15],[8,8,14,15],[25,25,15,15],[42,40,16,18],[22,55,16,10],[0,66,34,10]]){
  const branch=markMainRouteSurface(arenaTraversalBox([w,.7,d],[x,17.65,z],traversalMaterials.stable,{walkable:true}),{assistRadius:Math.min(w,d)*.36});branch.userData.staticBranchCollision=true;makeLandingMarker([x,18.03,z],Math.min(2.35,Math.min(w,d)*.2));
}
addJumpPad(16,16,25,25,18,PARKOUR_SURFACE_COLORS.boost,'arc',4.7,18.2);
markMainRouteSurface(arenaTraversalBox([10,.55,42],[-17,13.72,-9],traversalMaterials.stable,{walkable:true}),{assistRadius:4});
markMainRouteSurface(arenaTraversalBox([10,.55,38],[4,13.72,12],traversalMaterials.stable,{walkable:true}),{assistRadius:4});
makeRunnableWall([.65,7,13],[-5,21,-3],{id:'canopy-main-wall'});makeRunnableWall([.65,8,18],[-12,8,-12],{id:'canopy-expert-wall-a'});makeRunnableWall([.65,8,18],[-5,8,-12],{id:'canopy-expert-wall-b'});makeBars([-7,20,24],[8,20,24],6);makeBars([22,20,24],[22,20,24],1,{pole:true});makeBalanceBeam([5,.45,24],[42,18.3,40]);makeParkourTreasure([-57,21,50],'CANOPY RELIC');
makeProjectedTrajectory([-48,.45,-42],[-38,18.2,-38],7);makeProjectedTrajectory([16,18.4,16],[25,18.4,25],4.8);makeRouteArrow([-46,.15,-47],[-40,.15,-41]);makeRouteArrow([-18,18.1,-18],[-10,18.1,-10]);makeRouteArrow([31,18.1,31],[40,18.1,39]);
makeRouteSign('MAIN ROUTE — SAFE',[-48,2.4,-50],ROUTE_SIGN_COLORS.main);makeRouteSign('GRAPPLE OR LOWER WALKWAY',[-24,20,-29],PARKOUR_SURFACE_COLORS.grapple);makeRouteSign('TREASURE ROUTE',[-50,20.3,50],ROUTE_SIGN_COLORS.treasure);makeRouteSign('RECOVERY ROUTE',[-17,14.75,-16],ROUTE_SIGN_COLORS.recovery);makeReturnPortal(1,[-57,16.4,50]);

// Foundry Rush: readable 25%-slower piston timing, slower wide belts, a
// stopped-at-dock crane and pausing decorative fans with safe bays between.
for(const [x,phase] of [[178,0],[188,.32],[198,.64]])makeCoursePiston([x,6,-46],phase);
makeCourseConveyor([18,.55,13],[215,.28,-46],[1,0,0],2.2);makeCourseConveyor([18,.55,13],[236,.28,-46],[1,0,0],2.2);
addRamp(245,-44,12,14,0,4.8,'z',traversalMaterials.stable);
const foundryGrate=markMainRouteSurface(arenaTraversalBox([12,.65,28],[245,4.5,-25],traversalMaterials.stable,{walkable:true}),{assistRadius:4.6});foundryGrate.userData.recoveryRoute=true;
const foundryWalkaround=markMainRouteSurface(arenaTraversalBox([9,.55,40],[234,.28,-25],traversalMaterials.stable,{walkable:true}),{assistRadius:3.6});foundryWalkaround.userData.recoveryRoute=true;
markMainRouteSurface(arenaTraversalBox([14,.65,14],[245,4.5,-7],traversalMaterials.stable,{walkable:true}),{assistRadius:5});addJumpPad(245,-7,262,10,5,PARKOUR_SURFACE_COLORS.launch,'horizontal',5,4.95);
const dockA=markMainRouteSurface(arenaTraversalBox([15,.8,18],[257,4.6,10],traversalMaterials.stable,{walkable:true}),{assistRadius:5});const dockB=markMainRouteSurface(arenaTraversalBox([15,.8,18],[293,4.6,10],traversalMaterials.stable,{walkable:true}),{assistRadius:5});dockA.userData.transportDock='A';dockB.userData.transportDock='B';addMovingCrane(275,10,12,12,'x',12,0,12000,{routeTransport:true,deckHeight:5});
markMainRouteSurface(arenaTraversalBox([12,.65,58],[290,4.5,38],traversalMaterials.stable,{walkable:true}),{assistRadius:4.8});markMainRouteSurface(arenaTraversalBox([18,.65,18],[282,4.5,60],traversalMaterials.stable,{walkable:true}),{assistRadius:6});addJumpPad(282,60,178,46,0,PARKOUR_SURFACE_COLORS.launch,'horizontal',5.2,4.95);
makeRunnableWall([.65,8,22],[250.5,8,-25],{id:'foundry-lava-wall'});makeRunnableWall([8,5,.65],[206,5.5,46],{bounceDirection:[1,.45,0],id:'foundry-bounce'});for(const [z,phase] of [[24,0],[40,.34],[56,.68]])makeCourseFan([290,7,z],phase);makeAirVent([290,0,50],15);makeMomentumRing([250,11,46],[1,.18,0]);makeMovingLadder([280,5,-64],6);makeBreakableShortcut([1.1,6,8],[271,3,23]);makeParkourTreasure([278,11,26],'FOUNDRY CORE');
makeLandingMarker([200,.04,-46],1.6);makeLandingMarker([245,.04,-46],1.8);makeLandingMarker([245,4.86,-10],2);makeLandingMarker([262,5.04,10],2.2);makeLandingMarker([290,5,24],2);makeLandingMarker([282,4.86,60],2.4);makeProjectedTrajectory([245,5.15,-7],[262,5.15,10],4.2,PARKOUR_SURFACE_COLORS.launch);makeProjectedTrajectory([282,5.15,60],[178,1,46],10,PARKOUR_SURFACE_COLORS.launch);makeRouteArrow([171.5,.15,-57],[171.5,.15,-49]);makeRouteArrow([206,.65,-46],[228,.65,-46]);makeRouteArrow([245,5,-36],[245,5,-20]);makeRouteArrow([290,5,18],[290,5,31]);
makeRouteSign('MAIN ROUTE — SAFE',[171.5,2.5,-61],ROUTE_SIGN_COLORS.main);makeRouteSign('PISTONS — MOVE AFTER RED',[185,2.6,-55],PARKOUR_SURFACE_COLORS.hazard);makeRouteSign('WALL-RUN OR BLUE WALKWAY',[245,6,-39],ROUTE_SIGN_COLORS.recovery);makeRouteSign('CRANE LOADING — WAIT FOR GREEN',[263,6.5,1],ROUTE_SIGN_COLORS.main);makeRouteSign('EXPERT SHORTCUT — DIFFICULT',[218,8,24],ROUTE_SIGN_COLORS.expert);makeRouteSign('RECOVERY ROUTE',[234,1.7,-25],ROUTE_SIGN_COLORS.recovery);makeReturnPortal(2,[178,3.4,46]);
}
function resetTraversalObstaclesForArena(arena){
  for(const platform of traversalObstacles.crumbling){if(platform.arena!==arena)continue;platform.item.position.y=platform.originY;platform.item.visible=true;platform.surface.active=true;platform.collider.active=true;platform.touchedAt=0;platform.resetAt=0;}
  for(const shortcut of traversalObstacles.breakables){if(shortcut.arena!==arena)continue;shortcut.broken=false;shortcut.item.visible=true;shortcut.collider.active=true;}
  for(const treasure of traversalObstacles.treasures){if(treasure.arena!==arena)continue;treasure.collected=false;treasure.group.visible=true;}
}

// Training dummies.
const parkourDebugGroup=new THREE.Group();parkourDebugGroup.visible=false;world.add(parkourDebugGroup);
for(const route of PARKOUR_ROUTES){const routeHeight=route.id==='foundry-rush'?14:route.id==='canopy-circuit'?22:20;const points=[route.spawn,...route.checkpoints].map(([x,z])=>new THREE.Vector3(x,routeHeight,z));const line=new THREE.Line(new THREE.BufferGeometry().setFromPoints(points),new THREE.LineBasicMaterial({color:PARKOUR_SURFACE_COLORS.checkpoint,transparent:true,opacity:.9,depthTest:false}));line.renderOrder=40;parkourDebugGroup.add(line);for(const [x,z] of route.plan.recoveryZones){const recovery=new THREE.Mesh(new THREE.CircleGeometry(3.2,16),new THREE.MeshBasicMaterial({color:PARKOUR_SURFACE_COLORS.boost,wireframe:true,transparent:true,opacity:.7,depthTest:false}));recovery.rotation.x=-Math.PI/2;recovery.position.set(x,routeHeight-.15,z);parkourDebugGroup.add(recovery);}}
for(const pad of jumpPads){const curve=[];const startY=pad.surfaceY??.55;for(let index=0;index<=14;index++){const t=index/14;curve.push(new THREE.Vector3(THREE.MathUtils.lerp(pad.x,pad.targetX,t),THREE.MathUtils.lerp(startY,pad.targetHeight+.2,t)+Math.sin(t*Math.PI)*Math.max(4,Math.abs(pad.targetHeight-startY)*.45),THREE.MathUtils.lerp(pad.z,pad.targetZ,t)));}parkourDebugGroup.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(curve),new THREE.LineBasicMaterial({color:PARKOUR_SURFACE_COLORS.jump,transparent:true,opacity:.65,depthTest:false})));}
for(const obstacle of Object.values(traversalObstacles).flat()){const collider=obstacle.collider||obstacle.item?.userData?.collider;if(!collider)continue;const size=[collider.maxX-collider.minX,collider.maxY-collider.minY,collider.maxZ-collider.minZ],center=[(collider.minX+collider.maxX)/2,(collider.minY+collider.maxY)/2,(collider.minZ+collider.maxZ)/2];const box=new THREE.Mesh(new THREE.BoxGeometry(...size),new THREE.MeshBasicMaterial({color:obstacle.type==='crumblingPlatform'||obstacle.type==='rotatingBeam'?PARKOUR_SURFACE_COLORS.moving:PARKOUR_SURFACE_COLORS.solid,wireframe:true,transparent:true,opacity:.38,depthTest:false}));box.position.set(...center);parkourDebugGroup.add(box);}

const dummies = [];
const dummySpawns = [
  [-220,0,0], [-275,18,-33], [-220,24,49], [0,0,58], [-70,14,-12], [70,14,25], [180,0,18], [220,9,-68]
].map(([x,y,z]) => new THREE.Vector3(x, y, z));
function createDummy(position, index) {
  const group = new THREE.Group();
  group.position.copy(position);
  group.rotation.y = index ? -1.2 : .28;
  world.add(group); registerArenaRenderable(group,position.x);
  const stand = new THREE.Mesh(new THREE.BoxGeometry(2.6, .35, 2.6), mats.metal);
  stand.position.y = .18;
  group.add(stand);
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(.18, .24, 3.8, 10), mats.dark);
  pole.position.y = 2.2;
  group.add(pole);
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(1.15, 2.3, 6, 12), mats.target.clone());
  body.position.y = 4.75;
  group.add(body);
  const chest = new THREE.Mesh(new THREE.RingGeometry(.35, .62, 20), mats.cream);
  chest.position.set(0, 5, 1.08);
  chest.rotation.x = 0;
  group.add(chest);
  const head = new THREE.Mesh(new THREE.SphereGeometry(.67, 14, 10), mats.cream.clone());
  head.position.y = 7.05;
  head.scale.z = .8;
  group.add(head);
  const face = new THREE.Mesh(new THREE.CircleGeometry(.27, 16), mats.target.clone());
  face.position.set(0, 7.05, .56);
  group.add(face);
  const dummy = { kind: 'dummy', combatRole:COMBAT_ROLES.target, canShoot:false, group, body, head, face, health: 100, alive: true, index, arena:index < 3 ? 0 : index < 6 ? 1 : 2, baseY:position.y, phase: index * 2.1 };
  dummy.hitboxes={
    body:addCombatHitbox(dummy,hitboxGeometry.dummyBody,[0,4.72,0],'body'),
    head:addCombatHitbox(dummy,hitboxGeometry.dummyHead,[0,7.05,0],'head'),
  };
  for (const part of [body, head, face, chest]) part.castShadow=true;
  dummies.push(dummy);
}
dummySpawns.forEach(createDummy);

// Armed range raiders patrol the compounds, advance on the player, and return fire.
const enemies = [];
const aiDebugGroup=new THREE.Group();aiDebugGroup.visible=false;world.add(aiDebugGroup);
function createAiDebugHelper(enemy){
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(new Float32Array(6),3));const line=new THREE.Line(geometry,new THREE.LineBasicMaterial({color:0xff405c,transparent:true,opacity:.9,depthTest:false}));line.frustumCulled=false;line.renderOrder=42;aiDebugGroup.add(line);
  const visionGeometry=new THREE.BufferGeometry();visionGeometry.setAttribute('position',new THREE.Float32BufferAttribute(new Float32Array(12),3));const vision=new THREE.Line(visionGeometry,new THREE.LineBasicMaterial({color:0xffc857,transparent:true,opacity:.48,depthTest:false}));vision.frustumCulled=false;aiDebugGroup.add(vision);const aimRadius=new THREE.Mesh(new THREE.SphereGeometry(1,8,6),new THREE.MeshBasicMaterial({color:0xff405c,wireframe:true,transparent:true,opacity:.45,depthTest:false}));aiDebugGroup.add(aimRadius);const memory=new THREE.Mesh(new THREE.RingGeometry(.35,.48,16),new THREE.MeshBasicMaterial({color:0xa96cff,side:THREE.DoubleSide,transparent:true,opacity:.65,depthTest:false}));memory.rotation.x=-Math.PI/2;aiDebugGroup.add(memory);
  const canvas=document.createElement('canvas');canvas.width=320;canvas.height=110;const texture=new THREE.CanvasTexture(canvas);const sprite=new THREE.Sprite(new THREE.SpriteMaterial({map:texture,transparent:true,depthTest:false}));sprite.scale.set(7.4,2.55,1);aiDebugGroup.add(sprite);return{line,vision,aimRadius,memory,canvas,context:canvas.getContext('2d'),texture,sprite,lastText:''};
}
function updateAiDebugHelper(enemy,targetPoint){const debug=enemy.debug;if(!debug)return;const positions=debug.line.geometry.attributes.position.array;positions[0]=enemy.group.position.x;positions[1]=enemy.group.position.y+4;positions[2]=enemy.group.position.z;positions[3]=targetPoint.x;positions[4]=targetPoint.y;positions[5]=targetPoint.z;debug.line.geometry.attributes.position.needsUpdate=true;debug.line.material.color.setHex(enemy.hasLineOfSight?0x67e85d:0xff405c);const cone=debug.vision.geometry.attributes.position.array,origin=enemy.group.position,range=9,yaw=enemy.group.rotation.y;[[0,0],[Math.sin(yaw-.48)*range,Math.cos(yaw-.48)*range],[Math.sin(yaw+.48)*range,Math.cos(yaw+.48)*range],[0,0]].forEach(([x,z],index)=>{cone[index*3]=origin.x+x;cone[index*3+1]=origin.y+.12;cone[index*3+2]=origin.z+z;});debug.vision.geometry.attributes.position.needsUpdate=true;debug.aimRadius.position.copy(targetPoint);debug.aimRadius.scale.setScalar(Math.max(.35,(enemy.debugError||.05)*10));debug.memory.position.set(enemy.lastSeenPosition.x,groundHeightAt(enemy.lastSeenPosition.x,enemy.lastSeenPosition.z)+.08,enemy.lastSeenPosition.z);debug.sprite.position.copy(enemy.group.position).add(new THREE.Vector3(0,7,0));const reaction=Math.max(0,Math.ceil((enemy.reactionEndsAt-performance.now())/100)/10);const text=`${enemy.aiState}  LOS:${enemy.hasLineOfSight?'Y':'N'}  REACT:${reaction.toFixed(1)}\nAMMO ${enemy.ammo}/${enemy.magazine}  HITS ${enemy.consecutiveHits}  ERR ${(enemy.debugError||0).toFixed(3)}`;if(text!==debug.lastText){debug.lastText=text;const c=debug.context;c.clearRect(0,0,320,110);c.fillStyle='rgba(4,10,20,.88)';c.fillRect(0,0,320,110);c.strokeStyle=enemy.hasLineOfSight?'#67e85d':'#ff405c';c.strokeRect(2,2,316,106);c.fillStyle='#f4fbff';c.font='bold 18px monospace';text.split('\n').forEach((line,index)=>c.fillText(line,10,33+index*34));debug.texture.needsUpdate=true;}}
const enemySpawns = [
  [-252,0,-43], [-171,0,47], [-58,0,48], [57,0,-43], [176,0,-32], [273,0,32],
  [-277,18,-33],[-220,24,49],[-69,14,24],[69,14,-24],[195,9,-55],[245,9,55]
].map(([x,y,z]) => new THREE.Vector3(x, y, z));
const eliteTypes=['shield','grappleSniper','rusher','scout','medic','drone'];
const eliteProfiles={
  shield:{name:'SHIELD CARRIER',color:0x50e5ff,health:240,speed:1.55,reward:260},grappleSniper:{name:'GRAPPLING SNIPER',color:0xff4fba,health:155,speed:2.7,reward:235},rusher:{name:'SHOTGUN RUSHER',color:0xff7043,health:185,speed:4.1,reward:220},scout:{name:'INVISIBLE SCOUT',color:0xa96cff,health:115,speed:3.2,reward:210},medic:{name:'MEDIC',color:0x67e8a5,health:165,speed:2.35,reward:230},drone:{name:'DRONE OPERATOR',color:0xffc857,health:175,speed:2.1,reward:245},
};

function createEnemy(position, index, eliteType=null) {
  const group = new THREE.Group(); group.position.copy(position); world.add(group); registerArenaRenderable(group,position.x);
  const elite=eliteProfiles[eliteType];const factionColor=elite?.color||(index%2?0xd15b68:ART_PALETTE.enemyAccent);
  const uniform = new THREE.MeshStandardMaterial({ color:elite?.color||(index%2?0x374758:0x465061), roughness:.62, metalness:.18, transparent:eliteType==='scout', opacity:eliteType==='scout'?.48:1 });
  const armor = new THREE.MeshStandardMaterial({ color:ART_PALETTE.structurePrimary, roughness:.48, metalness:.52, transparent:eliteType==='scout', opacity:eliteType==='scout'?.58:1 });
  const jointMat = new THREE.MeshStandardMaterial({ color:ART_PALETTE.grip, roughness:.78, metalness:.12, transparent:eliteType==='scout', opacity:eliteType==='scout'?.5:1 });
  const visorMat = new THREE.MeshStandardMaterial({ color:factionColor, emissive:factionColor, emissiveIntensity:1.25, roughness:.28, metalness:.18 });
  const torsoPivot=new THREE.Group();torsoPivot.position.y=3.38;group.add(torsoPivot);
  const torso = new THREE.Mesh(chamferedBoxGeometry([1.3,1.86,.78],.13), uniform); torsoPivot.add(torso);
  const armorPlate = new THREE.Mesh(chamferedBoxGeometry([1.08,1.08,.2],.07), armor); armorPlate.position.set(0,.08,.48); torsoPivot.add(armorPlate);
  const chestLight=new THREE.Mesh(chamferedBoxGeometry([.5,.13,.035],.025),visorMat);chestLight.position.set(0,.13,.595);torsoPivot.add(chestLight);
  const pelvis=new THREE.Mesh(chamferedBoxGeometry([.94,.48,.62],.1),armor);pelvis.position.y=2.25;group.add(pelvis);
  const neck=new THREE.Mesh(new THREE.CylinderGeometry(.17,.21,.3,8),jointMat);neck.position.y=4.5;group.add(neck);
  const headPivot=new THREE.Group();headPivot.position.y=4.96;group.add(headPivot);
  const head = new THREE.Mesh(new THREE.IcosahedronGeometry(.5,1), armor);head.scale.set(1,.88,.92);headPivot.add(head);
  const visor = new THREE.Mesh(chamferedBoxGeometry([.7,.15,.075],.035), visorMat);visor.position.set(0,.02,.44);headPivot.add(visor);
  const antenna=new THREE.Mesh(new THREE.CylinderGeometry(.025,.025,.38,6),mats.steel);antenna.position.set(.32,.53,0);headPivot.add(antenna);
  const makeLimb=(side)=>{const legPivot=new THREE.Group();legPivot.position.set(side*.34,2.08,0);group.add(legPivot);const joint=new THREE.Mesh(new THREE.SphereGeometry(.2,8,6),jointMat);joint.position.y=-.12;legPivot.add(joint);const leg=new THREE.Mesh(chamferedBoxGeometry([.43,1.72,.5],.08),uniform);leg.position.y=-.78;legPivot.add(leg);const boot=new THREE.Mesh(chamferedBoxGeometry([.5,.38,.72],.09),armor);boot.position.set(0,-1.68,.1);legPivot.add(boot);return{pivot:legPivot,mesh:leg,parts:[leg,joint,boot]};};
  const leftLimb=makeLimb(-1),rightLimb=makeLimb(1);const leftLeg=leftLimb.mesh,rightLeg=rightLimb.mesh;
  const makeArm=(side)=>{const pivot=new THREE.Group();pivot.position.set(side*.82,4.05,0);group.add(pivot);const shoulder=new THREE.Mesh(new THREE.IcosahedronGeometry(.34,1),armor);pivot.add(shoulder);const arm=new THREE.Mesh(chamferedBoxGeometry([.34,1.32,.4],.07),uniform);arm.position.y=-.72;pivot.add(arm);const hand=new THREE.Mesh(new THREE.SphereGeometry(.18,8,6),jointMat);hand.position.y=-1.45;pivot.add(hand);return{pivot,parts:[shoulder,arm,hand]};};
  const leftArm=makeArm(-1),rightArm=makeArm(1);leftArm.pivot.rotation.x=-.28;rightArm.pivot.rotation.x=-.5;
  const weaponMount=new THREE.Group();weaponMount.position.set(.58,3.32,.44);weaponMount.rotation.x=-.17;group.add(weaponMount);
  const rifle = new THREE.Mesh(chamferedBoxGeometry([.2,.23,1.34],.045), mats.black);weaponMount.add(rifle);
  const rifleAccent=new THREE.Mesh(chamferedBoxGeometry([.22,.08,.48],.02),visorMat);rifleAccent.position.set(0,.12,.1);weaponMount.add(rifleAccent);
  const barrel=new THREE.Mesh(new THREE.CylinderGeometry(.035,.045,.55,8),mats.steel);barrel.position.z=.87;barrel.rotation.x=Math.PI/2;weaponMount.add(barrel);
  const muzzle = new THREE.PointLight(0xff6b48, 0, 6); muzzle.position.set(0,-.04,1.17); weaponMount.add(muzzle);
  const pingShell = new THREE.Mesh(new THREE.SphereGeometry(1.45,12,8),new THREE.MeshBasicMaterial({color:0xe7ff57,wireframe:true,transparent:true,opacity:.72,depthTest:false})); pingShell.position.y=3.25; pingShell.scale.y=1.7; pingShell.visible=false; pingShell.renderOrder=20; group.add(pingShell);
  const enemy = { kind:'enemy', combatRole:COMBAT_ROLES.robot, canShoot:true, group, body:torso, head, visor, torsoPivot,headPivot,leftArm:leftArm.pivot,rightArm:rightArm.pivot,leftLegPivot:leftLimb.pivot,rightLegPivot:rightLimb.pivot,weaponMount,muzzlePoint:muzzle, health:elite?.health||140,maxHealth:elite?.health||140, alive:true, index, arena:arenaIndexFromX(position.x), spawn:position.clone(), nextShot:performance.now() + 1200 + index * 130, phase:index * 1.7, speed:elite?.speed||(2.2 + index * .04), muzzle, pingShell, aimDirection:new THREE.Vector3(0,0,1), lastSeenPosition:position.clone(), lastSeenAt:0, spottedAt:0, nextPerceptionAt:0, hasLineOfSight:false, burstRemaining:0, burstNextAt:0, recoveryUntil:0, repositionUntil:0, strafeDirection:index%2?1:-1, robotTarget:null, nextTargetDecisionAt:0, eliteType,eliteName:elite?.name,reward:elite?.reward||125,shieldHealth:eliteType==='shield'?180:0,aiState:AI_STATES.patrol,ammo:12,magazine:12,reloadEndsAt:0,reactionEndsAt:0,aimConfidence:0,consecutiveHits:0,spawnAwareAt:performance.now()+900,lastDirection:new THREE.Vector3(),lastHurtAt:0 };
  enemy.debug=createAiDebugHelper(enemy);
  if(eliteType==='shield'){const shield=new THREE.Mesh(new THREE.BoxGeometry(2.15,3.3,.14),new THREE.MeshStandardMaterial({color:0x50e5ff,emissive:0x146684,emissiveIntensity:.8,transparent:true,opacity:.62}));shield.position.set(0,2.8,.88);group.add(shield);enemy.shield=shield;}
  if(eliteType==='grappleSniper'){const laserGeometry=new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(.55,3.15,.9),new THREE.Vector3(.55,3.15,35)]);const laser=new THREE.Line(laserGeometry,new THREE.LineBasicMaterial({color:0xff405c,transparent:true,opacity:.72}));laser.visible=false;group.add(laser);enemy.laser=laser;}
  if(eliteType==='medic'){const cross=new THREE.Mesh(new THREE.TorusGeometry(.42,.1,6,4),new THREE.MeshBasicMaterial({color:0x67e8a5}));cross.position.set(0,3.55,.57);cross.rotation.z=Math.PI/4;group.add(cross);}
  if(eliteType==='drone'){const drone=new THREE.Group();const droneCore=new THREE.Mesh(new THREE.OctahedronGeometry(.42),new THREE.MeshStandardMaterial({color:0xffc857,emissive:0xff7043,emissiveIntensity:.8}));drone.add(droneCore);world.add(drone);registerArenaRenderable(drone,position.x);enemy.drone={group:drone,operator:enemy,phase:index,alive:true};enemyDrones.push(enemy.drone);}
  enemy.hitboxes={
    body:addCombatHitbox(enemy,hitboxGeometry.enemyBody,[0,2.85,0],'body'),
    head:addCombatHitbox(enemy,hitboxGeometry.enemyHead,[0,0,0],'head',headPivot),
  };
  for (const part of [torso,armorPlate,chestLight,head,visor,pelvis,...leftLimb.parts,...rightLimb.parts,...leftArm.parts,...rightArm.parts]) part.castShadow=true;
  enemies.push(enemy);
}
enemySpawns.forEach((position,index)=>createEnemy(position,index,index<6?null:eliteTypes[index-6]));

// Three distinct first-person weapons, built from lightweight procedural geometry.
const weapon = new THREE.Group();
camera.add(weapon);
weapon.position.set(.42, -.4, -.72);
weapon.rotation.set(-.035, -.04, 0);

function weaponPart(group, geometry, material, position, rotation = [0, 0, 0], materialZone = null, componentRole = null) {
  const part = new THREE.Mesh(geometry, material);
  part.position.set(...position); part.rotation.set(...rotation); group.add(part);
  part.castShadow = false;
  if(materialZone)part.userData.materialZone=materialZone;
  if(componentRole){part.userData.weaponComponent=componentRole;const highDetail=/side-panel|top-rib|status-notch|flute|shroud-ring|cheek-rest|butt-pad|stock-adjuster|floorplate|charge-window|trigger-guard|grip-rib|safety-selector/.test(componentRole);const essential=/optic|lens|muzzle|slide|bolt|pump|cylinder|feed-cover|charging-handle|trigger|bipod|arming|applicator|guard/.test(componentRole);part.userData.weaponDetailLevel=essential?0:highDetail?2:1;}
  return part;
}

function finishWeapon(group, muzzlePosition, flashSize = .16, definition = group.userData.visualDefinition || {}) {
  const scopeProfile=definition.scopeProfile||{sightAnchor:[0,.2,-.2],eyeRelief:.42};
  const points=definition.attachmentPoints||{};
  const muzzlePoint=new THREE.Object3D();muzzlePoint.name='muzzle-anchor';muzzlePoint.position.set(...muzzlePosition);group.add(muzzlePoint);
  const sightPoint=new THREE.Object3D();sightPoint.name='sight-anchor';sightPoint.position.set(...(scopeProfile.sightAnchor||[0,.2,-.2]));group.add(sightPoint);
  const makePoint=(name,position)=>{const point=new THREE.Object3D();point.name=name;point.position.set(...position);group.add(point);return point;};
  makePoint('casing-ejection',points.ejection||[.13,.08,-.08]);makePoint('left-hand',points.leftHand||[0,-.11,-.48]);makePoint('right-hand',points.rightHand||[0,-.24,.03]);makePoint('charm-anchor',points.charm||[.25,-.05,.14]);makePoint('magazine-anchor',points.magazine||[0,-.24,.02]);
  const socketNames={optic:'socket-optic',muzzle:'socket-muzzle',underbarrel:'socket-underbarrel',magazine:'socket-magazine',stock:'socket-stock',sideRailLeft:'socket-side-left',sideRailRight:'socket-side-right'};
  const socketMap={};for(const [key,position] of Object.entries(definition.attachmentSockets||{})){const point=makePoint(socketNames[key]||`socket-${key}`,position);point.userData.attachmentSocket=key;socketMap[key]=point.name;}
  const trigger=weaponPart(group,chamferedBoxGeometry([.035,.075,.025],.006),mats.steel,[0,-.13,-.02],[-.28,0,0],'metal','trigger');trigger.name='mechanical-trigger';
  const ejectionPort=weaponPart(group,chamferedBoxGeometry([.012,.085,.19],.004),mats.black,[.105,.075,-.12],[0,0,0],'metal','ejection-port');ejectionPort.name='ejection-port';
  const chargingHandle=weaponPart(group,new THREE.CylinderGeometry(.012,.012,.13,6),mats.steel,[.13,.12,.03],[0,0,Math.PI/2],'metal','charging-handle');chargingHandle.name='mechanical-charging-handle';
  const action=definition.animationProfile?.mechanicalAction;
  let actionPart=null;
  if(action==='slide')actionPart=weaponPart(group,chamferedBoxGeometry([.205,.055,.34],.018),mats.metal,[0,.145,-.16],[0,0,0],'metal','slide');
  else if(action==='cylinder')actionPart=weaponPart(group,new THREE.CylinderGeometry(.13,.13,.19,12),mats.metal,[0,.015,-.03],[0,0,Math.PI/2],'metal','cylinder');
  else if(action==='bolt')actionPart=weaponPart(group,new THREE.CylinderGeometry(.025,.025,.2,8),mats.steel,[.125,.105,-.04],[0,0,Math.PI/2],'metal','bolt');
  else if(action==='pump')actionPart=weaponPart(group,chamferedBoxGeometry([.22,.15,.28],.025),mats.black,[0,-.055,-.46],[0,0,0],'grip','pump');
  else if(action==='feed-cover')actionPart=weaponPart(group,chamferedBoxGeometry([.23,.045,.35],.012),mats.metal,[0,.145,-.08],[0,0,0],'metal','feed-cover');
  else if(action==='spin'||action==='energy-chamber'||action==='oscillator')actionPart=weaponPart(group,new THREE.TorusGeometry(.105,.018,7,16),weaponGlowMaterial(definition.effectColors?.energy||0x50e5ff),[0,.04,muzzlePosition[2]+.16],[Math.PI/2,0,0],'energy',action);
  else if(action==='arming')actionPart=weaponPart(group,new THREE.TorusGeometry(.065,.01,6,12),mats.steel,[.08,.24,-.09],[Math.PI/2,0,0],'metal','arming-ring');
  else if(action==='applicator')actionPart=weaponPart(group,chamferedBoxGeometry([.2,.05,.16],.012),mats.steel,[0,.17,-.08],[0,0,0],'metal','applicator');
  else if(action==='melee')actionPart=weaponPart(group,chamferedBoxGeometry([.08,.04,.14],.01),mats.steel,[0,.03,-.08],[0,0,0],'metal','guard');
  if(actionPart){actionPart.name=`mechanical-${action==='feed-cover'?'heat-vents':action}`;actionPart.userData.basePosition=actionPart.position.clone();actionPart.userData.baseRotation=actionPart.rotation.clone();}
  if(action==='bolt'){const knob=weaponPart(actionPart,new THREE.SphereGeometry(.038,8,6),mats.black,[0,.1,0],[0,0,0],'grip','bolt-knob');knob.name='bolt-knob';}
  const bipodParts=[];if(definition.specialParts?.some(part=>part.includes('bipod'))){for(const side of [-1,1]){const leg=weaponPart(group,new THREE.CylinderGeometry(.012,.016,.46,6),mats.steel,[side*.12,-.17,-.64],[0,0,side*.18],'metal','bipod-leg');leg.name=`mechanical-bipod-${side<0?'left':'right'}`;leg.userData.baseRotation=leg.rotation.clone();bipodParts.push(leg);}}
  trigger.userData.baseRotation=trigger.rotation.clone();chargingHandle.userData.basePosition=chargingHandle.position.clone();
  const light = new THREE.PointLight(0xffa73d, 0, 3.5);
  muzzlePoint.add(light);
  const flash = weaponPart(muzzlePoint, new THREE.PlaneGeometry(flashSize, flashSize), new THREE.MeshBasicMaterial({ color:0xffdda0, transparent:true, opacity:0, side:THREE.DoubleSide, blending:THREE.AdditiveBlending, depthWrite:false }), [0,0,0]);
  group.userData.muzzle = light; group.userData.flash = flash;
  group.userData.visualAnimation=createVisualAnimationState();
  const identityParts=[];group.traverse(part=>{if(!part.userData?.animatedWeaponPart)return;part.userData.basePosition=part.position.clone();part.userData.baseRotation=part.rotation.clone();identityParts.push(part);});
  group.userData.mechanicalParts={trigger,action:actionPart,chargingHandle,bipodParts,identityParts};
  group.userData.attachmentPoints={root:'',muzzle:'muzzle-anchor',sight:'sight-anchor',ejection:'casing-ejection',leftHand:'left-hand',rightHand:'right-hand',charm:'charm-anchor',magazine:'magazine-anchor'};
  group.userData.attachmentSockets=socketMap;
  return group;
}

function beginWeaponVisualAnimation(gun,name,durationMs=null,now=performance.now()){
  const definition=gun?.model?.userData.visualDefinition;const state=gun?.model?.userData.visualAnimation;if(!definition||!state)return;
  const timing=durationMs||definition.animationProfile?.timings?.[name]||definition.animationProfile?.timings?.mechanical||180;beginVisualAnimation(state,name,now,timing);
}
function resetWeaponVisualAnimation(gun){
  const model=gun?.model;if(!model)return;resetVisualAnimation(model.userData.visualAnimation);const parts=model.userData.mechanicalParts;if(!parts)return;
  if(parts.trigger?.userData.baseRotation)parts.trigger.rotation.copy(parts.trigger.userData.baseRotation);if(parts.action?.userData.basePosition)parts.action.position.copy(parts.action.userData.basePosition);if(parts.action?.userData.baseRotation)parts.action.rotation.copy(parts.action.userData.baseRotation);if(parts.chargingHandle?.userData.basePosition)parts.chargingHandle.position.copy(parts.chargingHandle.userData.basePosition);for(const leg of parts.bipodParts||[])if(leg.userData.baseRotation)leg.rotation.copy(leg.userData.baseRotation);for(const part of parts.identityParts||[]){part.position.copy(part.userData.basePosition);part.rotation.copy(part.userData.baseRotation);}
}
function updateWeaponMechanicalAnimation(gun,now){
  const state=gun?.model?.userData.visualAnimation;const parts=gun?.model?.userData.mechanicalParts;if(!state||!parts)return;const sample=sampleVisualAnimation(state,now);const p=sample.progress;const impulse=Math.sin(Math.PI*p);const action=gun.model.userData.visualDefinition?.animationProfile?.mechanicalAction;
  if(parts.trigger?.userData.baseRotation)parts.trigger.rotation.x=parts.trigger.userData.baseRotation.x-(sample.state==='fire'?impulse*.28:0);
  if(parts.action?.userData.basePosition){parts.action.position.copy(parts.action.userData.basePosition);parts.action.rotation.copy(parts.action.userData.baseRotation);if(sample.state==='fire'){if(['slide','bolt','pump','applicator'].includes(action))parts.action.position.z+=impulse*(action==='pump'?.16:.1);if(['spin','energy-chamber','oscillator','cylinder'].includes(action))parts.action.rotation.z+=p*Math.PI*2;if(action==='melee')parts.action.rotation.x-=impulse*.5;}else if(sample.state==='reload'||sample.state==='emptyReload'){if(action==='feed-cover')parts.action.rotation.x-=Math.sin(Math.PI*Math.min(1,p*1.35))*1.05;if(action==='cylinder')parts.action.position.x+=Math.sin(Math.PI*p)*.18;if(action==='arming')parts.action.rotation.z+=Math.sin(Math.PI*p)*1.2;if(action==='pump'||action==='bolt')parts.action.position.z+=Math.sin(Math.PI*p)*.13;}}
  if(parts.chargingHandle?.userData.basePosition){parts.chargingHandle.position.copy(parts.chargingHandle.userData.basePosition);if(sample.state==='emptyReload'||(sample.state==='reload'&&p>.62))parts.chargingHandle.position.z+=Math.sin(Math.PI*Math.min(1,(p-.62)/.38))*.1;}
  const bipodDeployed=Boolean(state.aiming&&gun===loadout[state.weaponIndex]);for(const [index,leg] of (parts.bipodParts||[]).entries()){if(!leg.userData.baseRotation)continue;leg.rotation.copy(leg.userData.baseRotation);const deployment=bipodDeployed?(sample.state==='aimEnter'?Math.sin(Math.PI*.5*Math.min(1,p)):1):sample.state==='aimExit'?Math.cos(Math.PI*.5*Math.min(1,p)):0;leg.rotation.z+=(index?1:-1)*deployment*.42;}
  for(const [index,part] of (parts.identityParts||[]).entries()){const motion=part.userData.animatedWeaponPart;part.position.copy(part.userData.basePosition);part.rotation.copy(part.userData.baseRotation);if(motion==='core')part.rotation.y+=now*.002;if(motion==='orbit')part.rotation.z+=now*.0015+index*.4;if(motion==='counter-orbit')part.rotation.z-=now*.0018+index*.3;if(motion==='float')part.position.y+=Math.sin(now*.003+index*1.7)*.012;if(motion==='dial'&&sample.state==='fire')part.rotation.x+=p*Math.PI*.7;}
  if(sample.complete&&sample.state!=='idle')beginVisualAnimation(state,'idle',now,gun.model.userData.visualDefinition?.animationProfile?.timings?.idle||1200);
}

const weaponAccentMaterials=new Map();
const weaponGlowMaterials=new Map();
const scopeLensMaterials=new Map();
function weaponAccentMaterial(color){
  if(!weaponAccentMaterials.has(color))weaponAccentMaterials.set(color,new THREE.MeshStandardMaterial({color,roughness:.46,metalness:.48}));
  return weaponAccentMaterials.get(color);
}
function weaponGlowMaterial(color){
  if(!weaponGlowMaterials.has(color))weaponGlowMaterials.set(color,new THREE.MeshStandardMaterial({color,emissive:color,emissiveIntensity:.72,roughness:.3,metalness:.28}));
  return weaponGlowMaterials.get(color);
}
function scopeLensMaterial(tint='#73b5bd',opacity=.12){
  const key=`${tint}:${opacity}`;
  if(!scopeLensMaterials.has(key))scopeLensMaterials.set(key,new THREE.MeshPhysicalMaterial({
    color:new THREE.Color(tint),transparent:true,opacity,depthWrite:false,side:THREE.DoubleSide,
    roughness:.06,metalness:0,transmission:.92,thickness:.006,ior:1.46,clearcoat:.35,clearcoatRoughness:.08,
  }));
  return scopeLensMaterials.get(key);
}
function addClearScopeHousing(gun,{radius,length,position,material,lensTint='#73b5bd',lensOpacity=.12}){
  const housing=weaponPart(gun,new THREE.CylinderGeometry(radius,radius*1.03,length,16,1,true),material,position,[Math.PI/2,0,0],'scopeHousing','optic-housing');
  housing.name='scope-housing-open';housing.userData.scopeHousing=true;housing.userData.openEnded=true;housing.userData.centralAperture=true;
  for(const [side,z] of [['front',position[2]-length*.5],['rear',position[2]+length*.5]]){
    const lens=weaponPart(gun,new THREE.CircleGeometry(radius*.82,24),scopeLensMaterial(lensTint,Math.min(.16,lensOpacity)),[position[0],position[1],z],[0,0,0],'scopeLens','optic-lens');
    lens.name=`scope-lens-${side}`;lens.renderOrder=3;lens.userData.scopeLens=true;lens.userData.clearAperture=true;
  }
  return housing;
}
function addWeaponOptic(gun,visual,box,glow){
  if(visual.opticStyle==='reflex'||visual.opticStyle==='compact'){
    const opticLength=visual.opticStyle==='reflex'?.18:.25;
    const windowZ=-.18-opticLength*.38;
    box([.17,.06,opticLength],[0,.23,-.18],mats.black);
    box([.018,.115,.024],[-.06,.3,windowZ],mats.black);box([.018,.115,.024],[.06,.3,windowZ],mats.black);box([.138,.018,.024],[0,.355,windowZ],mats.black);
    const lens=weaponPart(gun,new THREE.PlaneGeometry(.102,.092),scopeLensMaterial(visual.scopeProfile?.lensTint,Math.min(.16,visual.scopeProfile?.lensOpacity||.12)),[0,.3,windowZ-.002],[0,0,0],'scopeLens','optic-lens');
    lens.name='scope-lens-window';lens.renderOrder=3;lens.userData.scopeLens=true;lens.userData.clearAperture=true;
  }else if(visual.opticStyle==='scope'||visual.opticStyle==='advanced-scope'){
    const length=visual.opticStyle==='advanced-scope'?.5:.38;
    addClearScopeHousing(gun,{radius:visual.opticStyle==='advanced-scope'?.075:.064,length,position:[0,.23,-.2],material:mats.black,lensTint:visual.scopeProfile?.lensTint,lensOpacity:visual.scopeProfile?.lensOpacity});
    for(const z of [-.2-length*.3,-.2+length*.3])weaponPart(gun,new THREE.TorusGeometry(.08,.018,8,14),mats.steel,[0,.23,z],[Math.PI/2,0,0]);
    box([.18,.045,.17],[0,.16,-.2],mats.steel);
    if(visual.opticStyle==='advanced-scope')box([.035,.1,.13],[.095,.26,-.08],glow);
  }
}

function addClearOptic(group,profile,kit){addWeaponOptic(group,profile,kit.box,kit.glow);}

function addReceiver(group,profile,{box,accent,glow}){
  const length=Math.min(.66,.42+profile.receiverScale*.15);const side=.105+(profile.variant%3)*.008;
  box([.018,.105,length],[side,.025,-.11],accent,[0,0,0],'receiver','receiver-side-panel');
  box([.018,.105,length],[-side,.025,-.11],profile.variant%2?glow:accent,[0,0,0],profile.variant%2?'accent':'receiver','receiver-side-panel');
  box([.155,.018,length*.78],[0,.135,-.14],accent,[0,0,0],'receiver','receiver-top-rib');
  for(let index=0;index<2+(profile.variant%2);index++)box([.024,.065,.012],[side+.012,.02,-.28+index*.15],glow,[0,0,0],'accent','receiver-status-notch');
}

function addBarrel(group,profile,{box,tube,glow}){
  const long=['sniper','lmg','rail'].includes(profile.profileKind);const z=long?-.78:-.54;
  if(/fluted|heatshield|coil|chamber|accelerator|speaker|emitter/.test(profile.barrelStyle)){
    const count=profile.profileKind==='lmg'?4:3;for(let index=0;index<count;index++){const offset=(index-(count-1)/2)*.055;box([.022,.018,long?.56:.36],[offset,.095,z],index===Math.floor(count/2)?glow:mats.steel,[0,0,0],index===Math.floor(count/2)?'energy':'barrel','barrel-flute');}
  }
  if(/heat|vented|shrouded|smoothbore/.test(profile.barrelStyle)){for(const ringZ of [z-.14,z+.03])weaponPart(group,new THREE.TorusGeometry(long?.083:.067,.012,6,12),mats.steel,[0,.04,ringZ],[Math.PI/2,0,0],'barrel','barrel-shroud-ring');}
  if(profile.profileKind==='shotgun'&&profile.magazineStyle==='tube')tube(.025,.58,[0,-.04,-.68],mats.steel,'magazine','tube-magazine-detail');
}

function addStock(group,profile,{box,accent}){
  if(profile.stockStyle==='none')return;
  const back=profile.profileKind==='sniper'?.67:.64;
  box([profile.profileKind==='lmg'?.31:.25,.06,.11],[0,.1,back],accent,[0,0,0],'stock','cheek-rest');
  box([profile.profileKind==='lmg'?.32:.28,.25,.055],[0,-.03,back+.12],mats.black,[0,0,0],'grip','butt-pad');
  if(profile.stockStyle.includes('precision'))box([.055,.2,.05],[.1,-.12,back+.04],mats.steel,[0,0,0],'metal','stock-adjuster');
}

function addMagazine(group,profile,{box,glow}){
  if(['none','tube','cylinder'].includes(profile.magazineStyle))return;
  const width=profile.magazineStyle==='box-belt'?.31:profile.magazineStyle==='dual-well'?.26:.16;
  box([width,.035,.2],[0,-.405,.025],mats.steel,[0,0,0],'metal','magazine-floorplate');
  if(['cell','boba-cup'].includes(profile.magazineStyle))box([Math.max(.08,width*.55),.13,.025],[.001,-.245,-.085],glow,[0,0,0],'energy','magazine-charge-window');
}

function addGrip(group,profile,{box,accent}){
  if(['knife','launcher'].includes(profile.profileKind)&&profile.visualKind!=='launcher')return;
  const triggerGuard=weaponPart(group,new THREE.TorusGeometry(.075,.012,6,12,Math.PI),mats.steel,[0,-.13,-.015],[0,Math.PI/2,0],'metal','trigger-guard');triggerGuard.scale.y=.75;
  for(let index=0;index<3;index++)box([.13,.012,.025],[0,-.25-index*.055,.115-index*.009],index===1?accent:mats.rubber,[-.16,0,0],index===1?'accent':'grip','grip-rib');
}

function addMechanicalParts(group,profile,{box,tube,glow}){
  box([.026,.045,.065],[-.115,.02,.02],profile.variant%2?glow:mats.steel,[0,0,.35],profile.variant%2?'accent':'metal','safety-selector');
  const parts=new Set(profile.specialParts||[]);
  if(parts.has('waveform-display')||parts.has('frequency-display')||parts.has('corruption-display'))box([.022,.105,.2],[.145,.075,-.03],glow,[0,0,0],'energy','status-display');
  if(parts.has('transmitter-prongs'))for(const x of [-.1,.1])tube(.018,.48,[x,.09,-.73],glow,'energy','transmitter-prong');
  if(parts.has('charge-coil')||parts.has('charging-coils'))for(const [index,z] of [-.34,-.5,-.66].entries()){const coil=weaponPart(group,new THREE.TorusGeometry(.12-index*.008,.016,8,16),index===1?glow:mats.steel,[0,.04,z],[Math.PI/2,0,0],index===1?'energy':'metal','charge-coil');coil.userData.animatedWeaponPart=index===1?'orbit':null;}
  if(parts.has('gravity-core')||parts.has('phase-core')){const core=weaponPart(group,new THREE.IcosahedronGeometry(.085,1),glow,[0,.03,-.42],[0,0,0],'energy','contained-core');core.userData.animatedWeaponPart='core';for(const rotation of [[Math.PI/2,0,0],[0,Math.PI/2,0]]){const ring=weaponPart(group,new THREE.TorusGeometry(.14,.012,7,16),mats.steel,[0,.03,-.42],rotation,'metal','orbit-ring');ring.userData.animatedWeaponPart='orbit';}}
  if(parts.has('portal-rings'))for(const [z,scale] of [[-.55,1],[-.72,.78]]){const ring=weaponPart(group,new THREE.TorusGeometry(.16*scale,.018,8,18),glow,[0,.04,z],[Math.PI/2,0,0],'energy','portal-ring');ring.userData.animatedWeaponPart='counter-orbit';}
  if(parts.has('fragment-panels')||parts.has('floating-components'))for(const [x,y,z] of [[-.16,.08,-.2],[.17,-.02,-.37],[-.14,-.08,-.54]]){const fragment=weaponPart(group,new THREE.OctahedronGeometry(.045),x>0?glow:mats.steel,[x,y,z],[0,0,0],x>0?'energy':'metal','floating-fragment');fragment.userData.animatedWeaponPart='float';}
  if(parts.has('fire-rate-dial')){const dial=weaponPart(group,new THREE.CylinderGeometry(.07,.07,.035,12),glow,[.14,.03,-.04],[0,0,Math.PI/2],'energy','fire-rate-dial');dial.userData.animatedWeaponPart='dial';}
  if(parts.has('dual-magazine-wells'))for(const x of [-.1,.1])box([.11,.33,.16],[x,-.27,.02],x<0?mats.black:glow,[-.05,0,x*.2],x<0?'magazine':'energy','dual-magazine');
  if(parts.has('kinetic-collector'))weaponPart(group,new THREE.TorusGeometry(.17,.03,8,18),glow,[0,.02,-.22],[Math.PI/2,0,0],'energy','kinetic-collector');
  if(parts.has('element-canisters'))for(const [x,color] of [[-.11,0x50e5ff],[0,0xff7043],[.11,0xa96cff]]){const material=weaponGlowMaterial(color);tube(.035,.28,[x,-.1,-.24],material,'energy','element-canister');}
  if(parts.has('guidance-fins'))for(const x of [-.14,.14])box([.1,.025,.24],[x,.04,-.72],glow,[0,0,x<0?-.18:.18],'energy','guidance-fin');
  if(parts.has('tracking-sensors'))for(const x of [-.12,.12])weaponPart(group,new THREE.SphereGeometry(.038,8,6),glow,[x,.14,-.28],[0,0,0],'energy','tracking-sensor');
  if(parts.has('heat-dial')||parts.has('heat-vents'))for(let index=0;index<3;index++)box([.02,.08,.14],[.14,.04,-.18-index*.16],index===1?glow:mats.steel,[0,0,0],index===1?'energy':'metal','heat-vent');
  if(parts.has('slice-indicators'))for(let index=0;index<4;index++)weaponPart(group,new THREE.CylinderGeometry(.018,.018,.012,8),glow,[.2,.03,-.02-index*.08],[Math.PI/2,0,0],'accent','slice-indicator');
  if(parts.has('water-tank')){const tankMaterial=new THREE.MeshPhysicalMaterial({color:0x38c8f4,transparent:true,opacity:.32,transmission:.66,depthWrite:false,roughness:.12,metalness:0});weaponPart(group,new THREE.CylinderGeometry(.065,.065,.25,10),tankMaterial,[-.13,-.04,.02],[0,0,0],'energy','water-tank');}
  if(parts.has('fish-fins'))for(const [x,rotation] of [[-.2,.65],[.2,-.65]]){const fin=weaponPart(group,new THREE.ConeGeometry(.07,.22,3),glow,[x,-.01,-.24],[0,0,rotation], 'accent','fish-fin');fin.userData.animatedWeaponPart='float';}
  if(parts.has('moving-eyes')){const pupil=weaponPart(group,new THREE.SphereGeometry(.017,7,5),mats.black,[.151,.122,-.526],[0,0,0],'metal','moving-eye');pupil.userData.animatedWeaponPart='float';}
  if(parts.has('heat-dial'))weaponPart(group,new THREE.CylinderGeometry(.055,.055,.025,10),glow,[.18,.08,-.05],[0,0,Math.PI/2],'energy','heat-dial');
  if(parts.has('revolver-cylinder')||parts.has('visible-cylinder'))for(let index=0;index<6;index++){const angle=index/6*Math.PI*2;weaponPart(group,new THREE.CircleGeometry(.016,7),mats.black,[.101,.015+Math.sin(angle)*.072,-.03+Math.cos(angle)*.072],[0,Math.PI/2,0],'metal','cylinder-chamber');}
  if(parts.has('hammer'))box([.07,.09,.06],[0,.13,.14],mats.steel,[-.25,0,0],'metal','hammer');
}

function addWeaponDetails(group,profile,kit){
  addReceiver(group,profile,kit);addBarrel(group,profile,kit);addStock(group,profile,kit);addMagazine(group,profile,kit);addGrip(group,profile,kit);addMechanicalParts(group,profile,kit);
}

function addMuzzleDevice(group,profile,kit,muzzlePosition){
  const {tube,glow}=kit;const next=[...muzzlePosition];
  if(profile.muzzleStyle==='suppressor'){tube(.064,.42,[muzzlePosition[0],muzzlePosition[1],muzzlePosition[2]-.2],mats.black,'barrel','suppressor');next[2]-=.41;}
  else if(profile.muzzleStyle==='bell'){weaponPart(group,new THREE.CylinderGeometry(.13,.075,.24,10),mats.steel,[muzzlePosition[0],muzzlePosition[1],muzzlePosition[2]-.11],[Math.PI/2,0,0],'barrel','acoustic-bell');next[2]-=.23;}
  else if(profile.muzzleStyle==='emitter'){for(const z of [muzzlePosition[2]-.04,muzzlePosition[2]-.12])weaponPart(group,new THREE.TorusGeometry(.095,.022,8,14),glow,[muzzlePosition[0],muzzlePosition[1],z],[Math.PI/2,0,0],'energy','emitter-ring');next[2]-=.16;}
  else{const radius=profile.muzzleStyle==='choke'?.085:.065;const length=profile.muzzleStyle==='choke'?.19:.13;const brake=weaponPart(group,new THREE.CylinderGeometry(radius*.82,radius,length,8,1,true),mats.steel,[muzzlePosition[0],muzzlePosition[1],muzzlePosition[2]-length*.45],[Math.PI/2,0,0],'barrel','muzzle-device');brake.name='muzzle-brake';brake.userData.openEnded=true;next[2]-=length*.9;}
  return next;
}
function addWeaponIdentityDetails(gun,config,visual,accent,box,tube,muzzlePosition){
  const profile=WEAPON_VISUALS[visual.profileKind];
  if(!profile||(['knife','grenade','mine','medkit'].includes(config.kind)&&!config.modelKind))return muzzlePosition;
  const glow=weaponGlowMaterial(accent.color.getHex());
  const kit={box,tube,accent,glow};
  addWeaponDetails(gun,visual,kit);
  if(config.modelKind){
    if(!gun.userData.customOptic)addClearOptic(gun,visual,kit);
    return addMuzzleDevice(gun,visual,kit,muzzlePosition);
  }
  const panelLength=Math.min(.58,profile.receiver*(.48+visual.variant*.025));
  const panelY=.015+(visual.variant%3)*.025;
  box([.024,.11,panelLength],[.115,panelY,-.12],glow);
  if(visual.variant%2===0)box([.024,.11,panelLength],[-.115,panelY,-.12],glow);
  for(let index=0;index<visual.panelCount;index++){
    const z=-.38+index*(.45/Math.max(1,visual.panelCount-1));
    box([.21,.016,.022],[0,.13,z],index%2?mats.steel:accent);
  }
  if(profile.rail){
    box([.105,.03,Math.min(.76,profile.receiver*.9)],[0,.155,-.18],mats.black);
    for(let index=0;index<visual.railCount;index++)box([.135,.018,.024],[0,.18,-.48+index*(.52/Math.max(1,visual.railCount-1))],mats.steel);
  }

  addClearOptic(gun,visual,kit);
  if(visual.opticStyle==='iron'||visual.opticStyle==='bead'){
    box([.035,.07,.035],[0,.2,muzzlePosition[2]+.12],glow);
  }

  if(visual.stockStyle!=='none'){
    if(['skeleton','folding','brace'].includes(visual.stockStyle)){
      const spread=visual.stockStyle==='folding'?.12:.1;const length=profile.stock||.38;
      box([.035,.04,length],[spread,.045,.48],mats.steel,[.04,0,.05]);
      box([.035,.04,length],[-spread,-.055,.48],mats.steel,[-.04,0,-.05]);
      box([.27,visual.stockStyle==='brace'?.18:.28,.09],[0,-.01,.7],mats.black,[-.08,0,0]);
    }else{
      const width=visual.stockStyle==='heavy'?.34:.28;const height=visual.stockStyle==='precision'?.34:.27;
      box([width,height,profile.stock||.42],[0,-.01,.5],mats.black,[-.06,0,0]);
      if(visual.stockStyle==='shoulder')box([width+.05,height+.08,.1],[0,-.04,.73],accent);
    }
  }

  if(visual.magazineStyle==='drum'||visual.magazineStyle==='cylinder'){
    const radius=visual.magazineStyle==='drum'?.19:.13;
    weaponPart(gun,new THREE.CylinderGeometry(radius,radius,.22,12),visual.magazineStyle==='drum'?mats.black:mats.steel,[0,-.18,-.02],[0,0,Math.PI/2]);
  }else if(visual.magazineStyle==='box-belt'){
    box([.34,.32,.38],[0,-.25,.02],mats.metal);box([.36,.05,.2],[0,-.08,-.04],glow);
  }else if(visual.magazineStyle==='quad'){
    box([.24,.46,.2],[0,-.33,-.05],mats.black,[-.05,0,0]);box([.26,.05,.16],[0,-.18,-.05],glow);
  }else if(visual.magazineStyle==='cell'){
    box([.14,.35,.2],[0,-.23,.03],glow,[-.08,0,0]);box([.17,.055,.23],[0,-.06,.03],mats.steel);
  }else if(['box','straight','curved'].includes(visual.magazineStyle)){
    const angle=visual.magazineStyle==='curved'?-.16:visual.magazineStyle==='box'?-.06:0;
    box([.16,visual.magazineStyle==='straight'?.4:.32,.2],[0,-.24,.03],mats.black,[angle,0,0]);
  }

  if(visual.signature==='crystal'){
    for(const x of [-.12,.12]){const shard=weaponPart(gun,new THREE.ConeGeometry(.045,.25,4),glow,[x,.08,-.52],[Math.PI/2,0,Math.PI/4]);shard.scale.x=.55;}
  }else if(visual.signature==='sonic'){
    for(const z of [-.38,-.58])weaponPart(gun,new THREE.TorusGeometry(.14,.018,8,16),glow,[0,.04,z],[Math.PI/2,0,0]);
  }else if(visual.signature==='coil'){
    for(let index=0;index<3;index++)weaponPart(gun,new THREE.TorusGeometry(.13,.02,8,14),index===1?glow:mats.steel,[0,.04,-.35-index*.16],[Math.PI/2,0,0]);
  }else if(visual.signature==='phase'||visual.signature==='orbital'){
    const ring=weaponPart(gun,new THREE.TorusGeometry(.18,.025,8,18),glow,[0,.04,-.48],[Math.PI/2,visual.signature==='orbital'?.45:0,0]);ring.scale.y=visual.signature==='phase'?.72:1;
  }else if(visual.signature==='sensor'){
    box([.035,.24,.035],[.13,.27,-.08],mats.steel);box([.1,.08,.035],[.13,.39,-.08],glow);
  }else if(visual.signature==='thermal'){
    for(let index=0;index<3;index++)box([.26,.025,.04],[0,.14,-.38-index*.13],index===1?glow:mats.steel);
  }else if(visual.signature==='kinetic'||visual.signature==='armored'){
    box([.035,.18,.38],[.15,0,-.28],mats.steel,[0,0,.1]);box([.035,.18,.38],[-.15,0,-.28],mats.steel,[0,0,-.1]);
  }else if(visual.signature==='split'){
    tube(.025,.42,[-.09,.08,-.55],glow);tube(.025,.42,[.09,.08,-.55],glow);
  }else if(visual.signature==='faceted'){
    weaponPart(gun,new THREE.OctahedronGeometry(.11),glow,[.14,.02,-.22]);
  }else if(visual.signature==='offset'){
    box([.1,.18,.28],[.15,.02,-.22],glow);
  }else if(visual.signature==='caged'||visual.signature==='ribbed'||visual.signature==='vented'){
    for(let index=0;index<3;index++)box([.26,.02,.028],[0,.14,-.24-index*.13],index===1?glow:mats.steel);
  }

  return addMuzzleDevice(gun,visual,kit,muzzlePosition);
}

function buildAK() {
  const gun = new THREE.Group();
  weaponPart(gun, new THREE.BoxGeometry(.17, .2, .72), mats.black, [0, .01, -.07]);
  weaponPart(gun, new THREE.BoxGeometry(.155, .17, .38), mats.rust, [0, -.01, .47], [-.05, 0, 0]);
  weaponPart(gun, new THREE.BoxGeometry(.13, .15, .42), mats.rust, [0, -.03, -.56]);
  weaponPart(gun, new THREE.CylinderGeometry(.033, .045, .62, 10), mats.metal, [0, .045, -.91], [Math.PI / 2, 0, 0]);
  weaponPart(gun, new THREE.BoxGeometry(.13, .38, .2), mats.metal, [0, -.26, .02], [-.2, 0, 0]);
  weaponPart(gun, new THREE.BoxGeometry(.06, .1, .18), mats.black, [0, .15, -.16]);
  return finishWeapon(gun, [0, .045, -1.23], .18);
}

function buildShotgun() {
  const gun = new THREE.Group();
  weaponPart(gun, new THREE.BoxGeometry(.2, .22, .58), mats.black, [0, 0, .02]);
  weaponPart(gun, new THREE.BoxGeometry(.18, .2, .52), mats.rust, [0, -.03, .5], [-.08, 0, 0]);
  weaponPart(gun, new THREE.CylinderGeometry(.047, .047, .92, 12), mats.metal, [0, .055, -.7], [Math.PI / 2, 0, 0]);
  weaponPart(gun, new THREE.CylinderGeometry(.055, .055, .65, 12), mats.black, [0, -.055, -.56], [Math.PI / 2, 0, 0]);
  weaponPart(gun, new THREE.BoxGeometry(.23, .19, .33), mats.rust, [0, -.03, -.42]);
  weaponPart(gun, new THREE.BoxGeometry(.17, .31, .18), mats.rust, [0, -.22, .09], [-.2, 0, 0]);
  return finishWeapon(gun, [0, .055, -1.17], .24);
}

function buildUzi() {
  const gun = new THREE.Group();
  weaponPart(gun, new THREE.BoxGeometry(.21, .34, .48), mats.black, [0, -.02, -.12]);
  weaponPart(gun, new THREE.BoxGeometry(.15, .44, .16), mats.metal, [0, -.35, -.02], [-.05, 0, 0]);
  weaponPart(gun, new THREE.BoxGeometry(.15, .33, .17), mats.black, [0, -.3, -.28], [-.18, 0, 0]);
  weaponPart(gun, new THREE.CylinderGeometry(.038, .045, .36, 10), mats.metal, [0, .03, -.53], [Math.PI / 2, 0, 0]);
  weaponPart(gun, new THREE.BoxGeometry(.05, .08, .12), mats.metal, [0, .2, -.14]);
  const stock = weaponPart(gun, new THREE.TorusGeometry(.21, .018, 6, 12, Math.PI), mats.metal, [0, .03, .21], [0, Math.PI / 2, 0]);
  stock.scale.z = 1.5;
  return finishWeapon(gun, [0, .03, -.73], .14);
}

function buildArmoryWeapon(config) {
  const visual=weaponVisualDefinition(config);
  const kind=visual.visualKind;
  const color=config.color||0x596463;
  const gun = new THREE.Group();
  const accent = weaponAccentMaterial(color);
  let muzzlePosition = [0, .03, -.95];
  let flashSize = .16;
  const box = (size, pos, material = mats.black, rot, zone=null, role=null) => weaponPart(gun, chamferedBoxGeometry(size,.025), material, pos, rot, zone, role);
  const tube = (radius, length, pos, material = mats.metal, zone=null, role=null) => weaponPart(gun, new THREE.CylinderGeometry(radius, radius * 1.08, length, 10), material, pos, [Math.PI / 2, 0, 0], zone, role);

  if (kind === 'pizza') {
    const crust=new THREE.MeshStandardMaterial({color:0xd9913b,roughness:.82});
    const cheese=new THREE.MeshStandardMaterial({color:0xffd84e,emissive:0xff8a18,emissiveIntensity:.18,roughness:.7});
    box([.62,.11,.58],[0,-.16,-.02],new THREE.MeshStandardMaterial({color:0xc89a63,roughness:.88}),[0,0,0],'receiver','pizza-box-receiver');
    const pizzaMagazine=weaponPart(gun,new THREE.CylinderGeometry(.34,.34,.07,20),crust,[0,.05,-.22],[Math.PI/2,0,0],'magazine','rotating-pizza-magazine');pizzaMagazine.userData.animatedWeaponPart='dial';
    weaponPart(gun,new THREE.CylinderGeometry(.29,.29,.075,20),cheese,[0,.05,-.225],[Math.PI/2,0,0],'accent','cheese-chamber');
    for(const [x,y] of [[-.12,.13],[.1,.15],[.14,-.06],[-.08,-.1]]) weaponPart(gun,new THREE.SphereGeometry(.045,8,6),new THREE.MeshStandardMaterial({color:0xd52d36}),[x,y,-.27]);
    box([.16,.08,.2],[0,.12,.06],new THREE.MeshStandardMaterial({color:0xd93a2f,roughness:.7}),[0,0,0],'accent','pizza-box-latch'); box([.15,.34,.18],[0,-.39,.2],mats.black,[-.18,0,0],'grip','pizza-grip');
    muzzlePosition=[0,.05,-.48];flashSize=.2;
  } else if (kind === 'fish') {
    const fish=new THREE.MeshStandardMaterial({color:0xff334b,emissive:0x761322,emissiveIntensity:.18,roughness:.55});
    const body=weaponPart(gun,new THREE.SphereGeometry(.24,16,10),fish,[0,.03,-.28]);body.scale.set(1.05,.62,1.75);
    weaponPart(gun,new THREE.ConeGeometry(.24,.38,3),fish,[0,.03,.22],[Math.PI/2,0,0]);
    weaponPart(gun,new THREE.SphereGeometry(.038,8,6),mats.cream,[.13,.12,-.5]);weaponPart(gun,new THREE.SphereGeometry(.018,8,6),mats.black,[.151,.122,-.523]);
    if(config.special==='redHerring'){
      for(const x of [-.17,.17])weaponPart(gun,new THREE.ConeGeometry(.08,.28,3),fish,[x,-.02,-.2],[0,0,x<0?-.6:.6]);
      box([.26,.12,.22],[0,-.19,-.08],mats.dark);box([.18,.055,.24],[0,-.1,-.08],weaponGlowMaterial(config.color));muzzlePosition=[0,.03,-.58];flashSize=.02;
    }else{
      tube(.03,.34,[0,.02,-.65],new THREE.MeshStandardMaterial({color:0x4ae6ff,emissive:0x1686aa,emissiveIntensity:.45}));
      box([.12,.34,.17],[0,-.27,-.04],mats.black,[-.2,0,0]);muzzlePosition=[0,.02,-.86];flashSize=.16;
    }
  } else if (kind === 'toaster') {
    const chrome=new THREE.MeshStandardMaterial({color:0xcbd3d9,roughness:.18,metalness:.88});
    box([.56,.4,.48],[0,.02,-.17],chrome);box([.43,.025,.12],[0,.235,-.17],mats.black);box([.43,.025,.12],[0,.235,-.34],mats.black);
    for(const x of [-.16,.16])box([.13,.28,.08],[x,.34,-.25],new THREE.MeshStandardMaterial({color:0xc87832,roughness:.85}));
    box([.14,.36,.18],[0,-.31,.02],mats.black,[-.18,0,0]);muzzlePosition=[0,.13,-.52];flashSize=.28;
  } else if (kind === 'baguette') {
    const bread=new THREE.MeshStandardMaterial({color:0xd89c4a,roughness:.92});
    tube(.12,1.65,[0,.03,-.52],bread);for(const z of [-.15,-.45,-.75])box([.16,.025,.1],[0,.15,z],mats.cream,[0,0,.42]);
    addClearScopeHousing(gun,{radius:.09,length:.34,position:[0,.22,-.28],material:new THREE.MeshStandardMaterial({color:0xff4f86,roughness:.28,metalness:.12}),lensTint:visual.scopeProfile.lensTint,lensOpacity:visual.scopeProfile.lensOpacity});
    gun.userData.customOptic=true;
    for(const z of [-.43,-.13])weaponPart(gun,new THREE.TorusGeometry(.105,.018,8,14),bread,[0,.22,z],[Math.PI/2,0,0]);
    weaponPart(gun,new THREE.TorusGeometry(.11,.045,7,14,Math.PI*1.45),bread,[.17,.05,.02],[0,Math.PI/2,0]);
    box([.14,.36,.18],[0,-.27,.22],mats.black,[-.18,0,0]);muzzlePosition=[0,.03,-1.35];flashSize=.15;
  } else if (kind === 'chicken') {
    const yellow=new THREE.MeshStandardMaterial({color:0xffdb35,roughness:.75});
    const body=weaponPart(gun,new THREE.SphereGeometry(.26,14,10),yellow,[0,.02,-.2]);body.scale.set(.7,1,1.55);
    weaponPart(gun,new THREE.ConeGeometry(.075,.26,4),new THREE.MeshStandardMaterial({color:0xff7d25}),[0,.02,-.68],[Math.PI/2,0,Math.PI/4]);
    weaponPart(gun,new THREE.SphereGeometry(.032,8,6),mats.black,[.12,.12,-.46]);box([.13,.38,.19],[0,-.3,.08],mats.black,[-.15,0,0]);
    addClearScopeHousing(gun,{radius:.072,length:.42,position:[0,.24,-.2],material:mats.black,lensTint:visual.scopeProfile.lensTint,lensOpacity:visual.scopeProfile.lensOpacity});
    gun.userData.customOptic=true;
    box([.16,.045,.15],[0,.17,-.2],mats.steel);
    muzzlePosition=[0,.02,-.86];flashSize=.3;
  } else if (kind === 'banana') {
    const peel=new THREE.MeshStandardMaterial({color:0xffe14f,emissive:0x8d5a00,emissiveIntensity:.18,roughness:.68});
    box([.22,.22,.56],[0,.04,-.18],peel);weaponPart(gun,new THREE.TorusGeometry(.2,.055,7,18,Math.PI*.8),peel,[0,.03,-.46],[Math.PI/2,0,.32]);
    weaponPart(gun,new THREE.CylinderGeometry(.17,.17,.16,12),mats.metal,[0,.02,.12],[Math.PI/2,0,0]);box([.13,.38,.18],[0,-.3,.05],mats.black,[-.18,0,0]);muzzlePosition=[0,.04,-.77];flashSize=.16;
  } else if (kind === 'disco') {
    weaponPart(gun,new THREE.IcosahedronGeometry(.29,1),new THREE.MeshStandardMaterial({color:0xf5f5ff,metalness:.95,roughness:.08}),[0,.04,-.34]);
    for(const colorValue of [0xff4fba,0x50e5ff,0xffc857]) weaponPart(gun,new THREE.TorusGeometry(.31,.018,6,20),new THREE.MeshBasicMaterial({color:colorValue}),[0,.04,-.34],[Math.random()*Math.PI,Math.random()*Math.PI,0]);
    box([.17,.38,.19],[0,-.29,.02],mats.black,[-.18,0,0]);muzzlePosition=[0,.04,-.68];flashSize=.25;
  } else if (kind === 'cake') {
    const frosting=new THREE.MeshStandardMaterial({color:0xff75c8,emissive:0x8e205c,emissiveIntensity:.2,roughness:.74});
    weaponPart(gun,new THREE.CylinderGeometry(.28,.32,.28,16),frosting,[0,.02,-.2],[Math.PI/2,0,0]);
    for(const x of [-.13,0,.13]){tube(.018,.23,[x,.27,-.2],new THREE.MeshStandardMaterial({color:0x50e5ff}));weaponPart(gun,new THREE.SphereGeometry(.025,6,5),new THREE.MeshBasicMaterial({color:0xffc857}),[x,.4,-.2]);}
    box([.28,.3,.56],[0,-.1,.2],accent);box([.16,.37,.2],[0,-.34,.24],mats.black,[-.18,0,0]);muzzlePosition=[0,.03,-.58];flashSize=.34;
  } else if (kind === 'boba') {
    const cup=new THREE.MeshPhysicalMaterial({color:0x65eaff,transparent:true,opacity:.48,roughness:.12,metalness:.05});
    weaponPart(gun,new THREE.CylinderGeometry(.23,.18,.58,16),cup,[0,0,-.08]);for(const [x,y,z] of [[-.1,-.18,-.21],[.08,-.16,-.15],[.02,-.2,.02],[-.06,-.12,.08]])weaponPart(gun,new THREE.SphereGeometry(.045,8,6),mats.black,[x,y,z]);
    tube(.035,.92,[0,.27,-.44],new THREE.MeshStandardMaterial({color:0xff5fae}),);box([.15,.38,.18],[0,-.33,.1],mats.black,[-.18,0,0]);muzzlePosition=[0,.27,-.9];flashSize=.18;
  } else if (kind === 'gnome') {
    weaponPart(gun,new THREE.CylinderGeometry(.18,.24,.34,10),new THREE.MeshStandardMaterial({color:0x337ac4}),[0,-.04,-.15]);
    weaponPart(gun,new THREE.SphereGeometry(.17,12,9),mats.cream,[0,.2,-.15]);weaponPart(gun,new THREE.ConeGeometry(.2,.48,10),new THREE.MeshStandardMaterial({color:0xff334b}),[0,.49,-.15]);
    box([.18,.35,.18],[0,-.31,.06],mats.black,[-.2,0,0]);muzzlePosition=[0,.2,-.42];flashSize=.13;
  } else if (kind === 'sock') {
    const cloth=new THREE.MeshStandardMaterial({color:0x9b6cff,roughness:.96});
    const body=weaponPart(gun,new THREE.SphereGeometry(.24,12,9),cloth,[0,.03,-.28]);body.scale.set(.68,.85,1.65);box([.28,.36,.28],[0,-.27,.05],cloth,[-.15,0,0]);
    for(const x of [-.09,.09])weaponPart(gun,new THREE.SphereGeometry(.045,8,6),new THREE.MeshStandardMaterial({color:x<0?0xffc857:0x50e5ff}),[x,.14,-.51]);
    box([.25,.035,.08],[0,-.02,-.55],mats.black);muzzlePosition=[0,-.01,-.69];flashSize=.25;
  } else if (kind === 'condiment') {
    for(const [x,c] of [[-.13,0xe73535],[.13,0xffd23f]]){weaponPart(gun,new THREE.CylinderGeometry(.09,.12,.54,12),new THREE.MeshStandardMaterial({color:c,roughness:.62}),[x,.02,-.2]);weaponPart(gun,new THREE.ConeGeometry(.055,.18,10),new THREE.MeshStandardMaterial({color:c}),[x,.39,-.2]);}
    box([.32,.11,.23],[0,-.29,-.02],mats.black);muzzlePosition=[0,.4,-.2];flashSize=.2;
  } else if (kind === 'cart') {
    const chrome=new THREE.MeshStandardMaterial({color:0xaeb8c2,metalness:.84,roughness:.22});
    box([.56,.38,.62],[0,.05,-.22],chrome);box([.46,.3,.54],[0,.09,-.26],mats.dark);for(const x of [-.21,.21])for(const z of [-.02,-.43])weaponPart(gun,new THREE.TorusGeometry(.07,.025,7,12),mats.black,[x,-.24,z],[Math.PI/2,0,0]);
    box([.18,.38,.2],[0,-.33,.12],mats.black,[-.18,0,0]);muzzlePosition=[0,.04,-.62];flashSize=.3;
  } else if (kind === 'unicorn') {
    const toy=new THREE.MeshStandardMaterial({color:0xffd9f4,roughness:.58});
    const body=weaponPart(gun,new THREE.SphereGeometry(.24,14,10),toy,[0,.02,-.23]);body.scale.set(.8,.85,1.55);weaponPart(gun,new THREE.ConeGeometry(.07,.42,10),new THREE.MeshStandardMaterial({color:0xffc857,emissive:0xff63cf,emissiveIntensity:.4}),[0,.27,-.48],[.55,0,0]);
    for(const [x,c] of [[-.17,0x50e5ff],[0,0xff4fba],[.17,0xffc857]])tube(.028,.65,[x,.16,-.42],new THREE.MeshBasicMaterial({color:c}));box([.15,.38,.18],[0,-.3,.04],mats.black,[-.18,0,0]);muzzlePosition=[0,.07,-.82];flashSize=.28;
  } else if (kind === 'medkit') {
    box([.42, .28, .52], [0, -.02, -.08], new THREE.MeshStandardMaterial({ color:0xe6edf0, roughness:.7 }));
    box([.08, .18, .535], [0, -.02, -.085], new THREE.MeshBasicMaterial({ color:0xff3e6c }));
    box([.2, .07, .54], [0, -.02, -.086], new THREE.MeshBasicMaterial({ color:0xff3e6c }));
    box([.3, .08, .12], [0, .18, -.08], mats.dark);
    muzzlePosition = [0, .02, -.42]; flashSize = .01;
  } else if (kind === 'knife') {
    const bladeMaterial=new THREE.MeshStandardMaterial({color:0xcbd3d1,roughness:.2,metalness:.85});
    if(visual.meleeStyle==='tuning-fork'){
      box([.11,.15,.5],[0,-.03,.18],mats.black,[-.2,0,0]);box([.34,.06,.1],[0,.03,-.08],accent);
      for(const x of [-.095,.095])box([.055,.085,.72],[x,.05,-.48],x<0?bladeMaterial:accent);muzzlePosition=[0,.05,-.87];
    }else if(visual.meleeStyle==='hook'){
      box([.1,.13,.82],[0,-.02,-.12],mats.black);weaponPart(gun,new THREE.TorusGeometry(.2,.05,8,18,Math.PI*1.4),accent,[.02,.03,-.55],[Math.PI/2,0,-.4]);muzzlePosition=[.18,.03,-.72];
    }else if(visual.meleeStyle==='katana'){
      box([.1,.14,.43],[0,-.03,.2],mats.black,[-.18,0,0]);box([.38,.055,.1],[0,.03,-.08],accent);box([.075,.045,.98],[0,.055,-.59],bladeMaterial,[0,0,-.02]);box([.02,.052,.82],[.045,.057,-.55],accent);muzzlePosition=[0,.055,-1.1];
    }else if(visual.meleeStyle==='hammer'){
      box([.11,.14,.92],[0,-.02,-.16],mats.black);box([.62,.28,.3],[0,.02,-.68],accent);box([.18,.32,.34],[-.34,.02,-.68],mats.steel);muzzlePosition=[0,.02,-.88];
    }else if(visual.meleeStyle==='baton'){
      tube(.065,.95,[0,.03,-.28],mats.black);for(const z of [-.08,-.35,-.62])weaponPart(gun,new THREE.TorusGeometry(.08,.02,8,14),accent,[0,.03,z],[Math.PI/2,0,0]);muzzlePosition=[0,.03,-.78];
    }else if(visual.meleeStyle==='glass-blade'){
      box([.12,.17,.42],[0,-.04,.18],mats.black,[-.28,0,0]);box([.36,.05,.1],[0,.03,-.06],accent);const blade=weaponPart(gun,new THREE.ConeGeometry(.15,.92,4),weaponGlowMaterial(config.color||0xb9f5ff),[0,.05,-.55],[Math.PI/2,0,Math.PI/4]);blade.scale.x=.36;muzzlePosition=[0,.05,-1.02];
    }else if(visual.meleeStyle==='gauntlet'){
      box([.42,.28,.5],[0,-.02,-.02],accent);box([.38,.24,.34],[0,-.2,.14],mats.black,[-.3,0,0]);for(const x of [-.15,-.05,.05,.15])box([.065,.08,.34],[x,.07,-.39],mats.steel);muzzlePosition=[0,.06,-.58];
    }else if(visual.meleeStyle==='axe'){
      box([.1,.14,.92],[0,-.02,-.13],mats.black);const head=weaponPart(gun,new THREE.ConeGeometry(.28,.52,3),bladeMaterial,[.05,.03,-.68],[0,0,-Math.PI/2]);head.scale.z=.3;box([.18,.2,.3],[-.18,.03,-.68],accent);muzzlePosition=[0,.03,-.9];
    }else if(visual.meleeStyle==='whip'){
      box([.13,.18,.42],[0,-.04,.2],mats.black,[-.25,0,0]);for(let index=0;index<7;index++){const t=index/6;weaponPart(gun,new THREE.SphereGeometry(.055-index*.004,7,5),index%2?mats.steel:accent,[Math.sin(t*Math.PI)*.22,.04+t*.09,-.08-t*.86]);}muzzlePosition=[0,.13,-.98];
    }else if(visual.meleeStyle==='saber'){
      box([.13,.17,.48],[0,-.04,.18],mats.black,[-.18,0,0]);box([.34,.06,.1],[0,.03,-.08],mats.steel);tube(.055,.92,[0,.055,-.57],weaponGlowMaterial(config.color||0xe7ff57));muzzlePosition=[0,.055,-1.05];
    }else{
      box([.12,.18,.42],[0,-.05,.18],mats.black,[-.35,0,0]);box([.045,.34,.08],[0,.02,-.06],accent,[0,0,Math.PI/2]);const blade=weaponPart(gun,new THREE.ConeGeometry(.09,.78,4),bladeMaterial,[0,.06,-.48],[Math.PI/2,0,Math.PI/4]);blade.scale.x=.45;muzzlePosition=[0,.06,-.9];
    }
    flashSize=.01;
  } else if (kind === 'grenade') {
    if(config.special==='resonanceDisc'){
      weaponPart(gun,new THREE.CylinderGeometry(.28,.28,.1,18),accent,[0,.02,-.16],[Math.PI/2,0,0]);weaponPart(gun,new THREE.TorusGeometry(.2,.035,8,20),weaponGlowMaterial(config.color),[0,.02,-.22]);muzzlePosition=[0,.02,-.45];
    }else if(config.special==='updraft'){
      weaponPart(gun,new THREE.CylinderGeometry(.16,.2,.58,12),accent,[0,.02,-.08]);for(const y of [-.18,.16])weaponPart(gun,new THREE.TorusGeometry(.18,.022,8,14),mats.steel,[0,y,-.08],[Math.PI/2,0,0]);muzzlePosition=[0,.02,-.45];
    }else if(config.special==='breachCharge'){
      box([.46,.18,.52],[0,0,-.08],mats.dark);box([.32,.06,.38],[0,.13,-.08],accent);for(const x of [-.17,.17])box([.06,.1,.08],[x,-.12,-.2],mats.steel);muzzlePosition=[0,0,-.43];
    }else{
      const body=weaponPart(gun,visual.variant%2?new THREE.IcosahedronGeometry(.23,1):new THREE.SphereGeometry(.22,10,8),accent,[0,-.02,-.12]);body.rotation.z=visual.variant*.17;
      box([.12,.1,.13],[0,.22,-.12],mats.metal);weaponPart(gun,new THREE.TorusGeometry(.08,.012,6,12),mats.cream,[.08,.31,-.12],[Math.PI/2,0,0]);muzzlePosition=[0,.02,-.5];
    }
    flashSize=.05;
  } else if(kind==='mine'){
    if(config.special==='mirrorDrone'){
      weaponPart(gun,new THREE.OctahedronGeometry(.24),accent,[0,.02,-.16]);for(const x of [-.32,.32])box([.34,.035,.16],[x,.02,-.16],mats.steel);weaponPart(gun,new THREE.TorusGeometry(.27,.025,8,18),weaponGlowMaterial(config.color),[0,.02,-.16],[Math.PI/2,0,0]);
    }else if(config.special==='phaseBeacon'){
      weaponPart(gun,new THREE.TorusGeometry(.28,.07,8,20),accent,[0,.04,-.16],[Math.PI/2,0,0]);weaponPart(gun,new THREE.OctahedronGeometry(.12),weaponGlowMaterial(config.color),[0,.04,-.16]);box([.3,.1,.34],[0,-.18,-.08],mats.dark);
    }else if(config.special==='ammoSynth'){
      box([.46,.34,.5],[0,-.02,-.08],mats.dark);for(const x of [-.13,0,.13])box([.07,.24,.34],[x,.08,-.12],x===0?weaponGlowMaterial(config.color):mats.steel);box([.3,.07,.18],[0,.24,-.05],accent);
    }else{
      weaponPart(gun,new THREE.CylinderGeometry(.29,.34,.14,12),mats.dark,[0,-.03,-.14]);weaponPart(gun,new THREE.TorusGeometry(.24,.035,8,18),accent,[0,.06,-.14],[Math.PI/2,0,0]);for(let index=0;index<4;index++){const angle=index*Math.PI/2;box([.08,.05,.27],[Math.cos(angle)*.28,-.08,-.14+Math.sin(angle)*.28],mats.steel,[0,-angle,0]);}
    }
    muzzlePosition=[0,.02,-.5];flashSize=.02;
  } else if (kind === 'pistol') {
    box([.19, .19, .58], [0, .05, -.17], accent);
    box([.15, .39, .2], [0, -.24, .02], mats.black, [-.16, 0, 0]);
    tube(.034, .3, [0, .06, -.6]);
    box([.045, .07, .1], [0, .18, -.22], mats.cream);
    muzzlePosition = [0, .06, -.76];
  } else if (kind === 'smg') {
    box([.2, .29, .6], [0, 0, -.1], accent);
    box([.14, .42, .17], [0, -.32, -.02], mats.metal, [-.07, 0, 0]);
    box([.15, .32, .18], [0, -.26, -.3], mats.black, [-.17, 0, 0]);
    tube(.037, .42, [0, .04, -.61]);
    box([.06, .09, .14], [0, .2, -.14], mats.black);
    muzzlePosition = [0, .04, -.83];
  } else if (kind === 'shotgun') {
    box([.2, .22, .58], [0, 0, .02], mats.black);
    box([.18, .19, .5], [0, -.02, .5], accent, [-.08, 0, 0]);
    tube(.048, .95, [0, .06, -.72]); tube(.054, .72, [0, -.055, -.61], mats.black);
    box([.23, .19, .33], [0, -.03, -.43], accent);
    muzzlePosition = [0, .06, -1.2]; flashSize = .24;
  } else if (kind === 'sniper') {
    box([.18, .2, .78], [0, 0, -.04], accent);
    box([.16, .19, .5], [0, -.01, .57], mats.dark, [-.06, 0, 0]);
    tube(.035, 1.08, [0, .035, -.96]);
    box([.12, .32, .17], [0, -.25, .08], mats.metal, [-.14, 0, 0]);
    muzzlePosition = [0, .035, -1.51]; flashSize = .2;
  } else if (kind === 'lmg') {
    box([.23, .28, .82], [0, 0, -.08], accent);
    box([.2, .22, .48], [0, -.02, .57], mats.dark);
    tube(.05, .9, [0, .04, -.93]);
    box([.34, .38, .34], [0, -.28, -.02], mats.metal);
    box([.12, .27, .17], [0, -.23, .28], mats.black, [-.2, 0, 0]);
    muzzlePosition = [0, .04, -1.39]; flashSize = .2;
  } else if (kind === 'minigun') {
    box([.32, .38, .55], [0, 0, .04], accent);
    for (let i = 0; i < 5; i++) {
      const angle = i / 5 * Math.PI * 2;
      tube(.025, .88, [Math.cos(angle) * .09, Math.sin(angle) * .09, -.68], mats.metal);
    }
    tube(.15, .18, [0, 0, -.28], mats.black);
    box([.18, .33, .2], [0, -.3, .16], mats.black, [-.2, 0, 0]);
    muzzlePosition = [0, 0, -1.13]; flashSize = .22;
  } else if (kind === 'crossbow') {
    box([.13, .17, .92], [0, 0, -.1], accent);
    box([.14, .18, .44], [0, 0, .56], mats.rust);
    box([1.05, .055, .08], [0, .04, -.48], mats.dark, [0, 0, .12]);
    box([1.05, .055, .08], [0, .04, -.48], mats.dark, [0, 0, -.12]);
    tube(.018, .72, [0, .08, -.56], mats.cream);
    muzzlePosition = [0, .08, -.94]; flashSize = .08;
  } else if (kind === 'launcher') {
    box([.28, .31, .64], [0, 0, -.04], accent);
    tube(.13, .68, [0, .04, -.67], mats.black);
    tube(.155, .18, [0, .04, -1.08], mats.metal);
    box([.16, .36, .21], [0, -.29, .14], mats.dark, [-.18, 0, 0]);
    muzzlePosition = [0, .04, -1.18]; flashSize = .26;
  } else if (kind === 'flame') {
    box([.25, .3, .58], [0, 0, -.1], accent);
    tube(.055, .72, [0, .03, -.74], mats.black);
    tube(.11, .5, [.16, -.16, .15], mats.rust);
    tube(.11, .5, [-.16, -.16, .15], mats.rust);
    box([.15, .35, .17], [0, -.27, -.19], mats.dark, [-.12, 0, 0]);
    muzzlePosition = [0, .03, -1.12]; flashSize = .32;
  } else if (kind === 'rail') {
    box([.24, .27, .95], [0, 0, -.14], accent);
    tube(.04, 1.12, [0, .04, -.91], mats.cream);
    for (const z of [-.34, -.58, -.82]) weaponPart(gun, new THREE.TorusGeometry(.14, .025, 8, 16), mats.metal, [0, .04, z], [Math.PI / 2, 0, 0]);
    box([.17, .37, .2], [0, -.29, .17], mats.black, [-.16, 0, 0]);
    muzzlePosition = [0, .04, -1.48]; flashSize = .25;
  } else if (kind === 'void') {
    const chrome = new THREE.MeshStandardMaterial({ color:0xb9c5c7, roughness:.12, metalness:.92 });
    tube(.15, .9, [0, .02, -.3], chrome); tube(.19, .24, [0, .02, -.82], mats.black);
    weaponPart(gun, new THREE.SphereGeometry(.16, 16, 12), new THREE.MeshPhysicalMaterial({ color:0x010103, roughness:.02, metalness:.1, transmission:.25 }), [0, .02, -1.0]);
    box([.17, .38, .19], [0, -.29, .15], chrome, [-.16,0,0]);
    muzzlePosition = [0,.02,-1.13]; flashSize = .12;
  } else if (kind === 'recoil') {
    const brass = new THREE.MeshStandardMaterial({ color:0xb87827, roughness:.3, metalness:.8 });
    box([.3,.34,.66],[0,0,-.08],brass); tube(.12,.55,[0,.03,-.65],mats.black);
    for (const z of [-.31,-.5,-.69]) weaponPart(gun,new THREE.TorusGeometry(.18,.028,8,18),mats.rust,[0,.03,z],[Math.PI/2,0,0]);
    box([.18,.42,.22],[0,-.33,.12],brass,[-.2,0,0]);
    muzzlePosition=[0,.03,-.98]; flashSize=.3;
  } else if (kind === 'brass') {
    const brass = new THREE.MeshStandardMaterial({ color:0xd09a3d, roughness:.25, metalness:.78 });
    for (const x of [-.1,0,.1]) tube(.035,.78,[x,.04,-.46],brass);
    tube(.2,.35,[0,.04,-.96],brass); box([.27,.3,.52],[0,0,.08],mats.rust);
    for (const z of [-.05,-.28]) weaponPart(gun,new THREE.TorusGeometry(.16,.022,7,16),brass,[0,.05,z],[Math.PI/2,0,0]);
    box([.16,.38,.2],[0,-.3,.18],brass,[-.15,0,0]);
    muzzlePosition=[0,.04,-1.17]; flashSize=.34;
  } else if (kind === 'magnet') {
    const blue = new THREE.MeshStandardMaterial({ color:0x276c8b, emissive:0x139ed1, emissiveIntensity:.55, roughness:.25, metalness:.72 });
    box([.28,.27,.84],[0,0,-.1],mats.dark); tube(.045,.9,[-.1,.05,-.76],blue); tube(.045,.9,[.1,.05,-.76],blue);
    for (const z of [-.35,-.7]) box([.38,.06,.1],[0,.05,z],blue);
    box([.17,.38,.2],[0,-.3,.18],mats.black,[-.17,0,0]);
    muzzlePosition=[0,.05,-1.22]; flashSize=.2;
  } else if (kind === 'wire') {
    box([.23,.28,.82],[0,0,-.1],mats.black); tube(.055,.7,[0,.04,-.78],accent);
    weaponPart(gun,new THREE.TorusGeometry(.21,.065,10,22),accent,[0,-.18,.05],[Math.PI/2,0,0]);
    box([.17,.4,.2],[0,-.32,.21],mats.dark,[-.16,0,0]);
    box([.08,.1,.2],[0,.19,-.18],new THREE.MeshBasicMaterial({color:0xe7ff57}));
    muzzlePosition=[0,.04,-1.15]; flashSize=.13;
  } else {
    box([.18, .21, .74], [0, 0, -.08], accent);
    box([.16, .18, .42], [0, -.01, .51], mats.dark, [-.05, 0, 0]);
    box([.13, .36, .19], [0, -.27, .02], mats.metal, [-.18, 0, 0]);
    tube(.035, .68, [0, .04, -.8]);
    box([.06, .1, .18], [0, .16, -.18], mats.black);
    muzzlePosition = [0, .04, -1.15];
  }
  muzzlePosition=addWeaponIdentityDetails(gun,config,visual,accent,box,tube,muzzlePosition);
  gun.userData.visualDefinition={...visual,...(WEAPON_VISUALS[visual.profileKind]||{})};
  const finished=finishWeapon(gun,muzzlePosition,flashSize,gun.userData.visualDefinition);
  if(!config.modelKind)finished.scale.set(visual.widthScale,.96+(visual.variant%4)*.025,.94+(visual.hash%7)*.025);
  return finished;
}

function blueprint(config) {
  const balanced=applyWeaponBalance(config);
  const {magSize,reserve}=balanced;
  return {
    pellets:1, spread:.004, reloadTime:1700, recoil:.12, automatic:false, tone:88,
    ...config,...balanced,magSize,ammo:magSize,reserve,maxReserve:reserve,
    model:buildArmoryWeapon(config),
  };
}

const loadout = [
  // NORMAL // dependable ballistic hardware. The first three form the starter sniper kit.
  blueprint({ id:'sledge', name:'SLEDGE BOLT-ACTION', category:'NORMAL', weaponClass:'HEAVY SNIPER', caliber:'.338', trait:'08× OPTIC // MANUAL BOLT', kind:'sniper', color:0x555b50, price:0, magSize:5, reserve:35, damage:135, headDamage:300, spread:.00035, fireRate:1050, reloadTime:2400, recoil:.38, tone:38, scoped:true }),
  blueprint({ id:'helix', name:'HELIX DMR', category:'NORMAL', weaponClass:'MARKSMAN RIFLE', caliber:'7.62', trait:'04× OPTIC // HEADSHOT BIAS', kind:'sniper', color:0x88704e, price:0, magSize:12, reserve:72, damage:68, headDamage:165, spread:.0011, fireRate:280, recoil:.18, scoped:true }),
  blueprint({ id:'phantom', name:'PHANTOM SUPPRESSED', category:'NORMAL', weaponClass:'SILENCED SIDEARM', caliber:'9 MM', trait:'NO MUZZLE REPORT', kind:'pistol', color:0x303b3d, price:0, magSize:15, reserve:90, damage:32, headDamage:84, spread:.004, fireRate:185, recoil:.06, tone:140, silent:true }),
  blueprint({ id:'p12', name:'P12 VANGUARD', category:'NORMAL', weaponClass:'SERVICE PISTOL', caliber:'9 MM', trait:'CRISP // LOW RECOIL', kind:'pistol', price:450, magSize:12, damage:36, headDamage:92, spread:.003, fireRate:190, recoil:.055, tone:112 }),
  blueprint({ id:'apex9', name:'APEX-9 SMG', category:'NORMAL', weaponClass:'SUBMACHINE GUN', caliber:'9 MM', trait:'CLOSE-RANGE FLANKER', kind:'smg', price:800, magSize:32, damage:21, headDamage:48, spread:.012, fireRate:66, recoil:.06, automatic:true, tone:155 }),
  blueprint({ id:'specter', name:'SPECTER CARBINE', category:'NORMAL', weaponClass:'BURST CARBINE', caliber:'5.56', trait:'CONTROLLED MID-RANGE', kind:'rifle', price:1200, magSize:30, damage:34, headDamage:86, spread:.003, fireRate:105, recoil:.09, automatic:true, tone:105 }),
  blueprint({ id:'broadside', name:'BROADSIDE SHOTGUN', category:'NORMAL', weaponClass:'PUMP SHOTGUN', caliber:'12 GA', trait:'WIDE 8-PELLET SPREAD', kind:'shotgun', price:1600, magSize:8, reserve:48, damage:18, headDamage:31, pellets:8, spread:.045, fireRate:720, recoil:.28, tone:52 }),
  blueprint({ id:'riot', name:'RIOT SWEEPER', category:'NORMAL', weaponClass:'AUTO SHOTGUN', caliber:'12 GA', trait:'DRUM MAG // FULL AUTO', kind:'shotgun', price:2300, magSize:20, reserve:80, damage:11, headDamage:19, pellets:7, spread:.052, fireRate:150, recoil:.16, automatic:true, tone:62 }),
  blueprint({ id:'ironclad', name:'IRONCLAD LMG', category:'NORMAL', weaponClass:'BELT-FED LMG', caliber:'7.62', trait:'SUSTAINED SUPPRESSION', kind:'lmg', price:3000, magSize:100, reserve:300, damage:29, headDamage:66, spread:.014, fireRate:78, reloadTime:3900, recoil:.085, automatic:true, tone:96 }),
  blueprint({ id:'centurion', name:'CENTURION REVOLVER', category:'NORMAL', weaponClass:'HEAVY REVOLVER', caliber:'.454', trait:'SIX SHOTS // MASSIVE IMPACT', kind:'pistol', color:0x907653, price:3500, magSize:6, reserve:42, damage:78, headDamage:175, spread:.004, fireRate:340, reloadTime:2200, recoil:.25, tone:55 }),

  // WEIRD // acoustic and kinetic prototypes.
  blueprint({ id:'doppler', name:'THE DOPPLER CANNON', category:'WEIRD', weaponClass:'MOTION-SONIC CANNON', caliber:'WAVE', trait:'RICOCHET SOUND ORB', kind:'brass', color:0x3f91aa, price:4200, magSize:12, reserve:60, damage:20, headDamage:20, spread:0, fireRate:520, recoil:.15, tone:210, effect:'acoustic' }),
  blueprint({ id:'feedback', name:'THE FEEDBACK LOOP', category:'WEIRD', weaponClass:'TRANSCEIVER RIFLE', caliber:'LINK', trait:'CONNECT 2 NODES // DAMAGE WIRE', kind:'wire', color:0x9b3fc4, price:4800, magSize:6, reserve:30, damage:22, headDamage:22, spread:0, fireRate:420, effect:'wire', pendingAnchor:null }),
  blueprint({ id:'reverb', name:'THE REVERB RIFLE', category:'WEIRD', weaponClass:'ECHO SNIPER', caliber:'ECHO', trait:'08× OPTIC // CHAIN AMPLIFIER', kind:'sniper', color:0x654c8d, price:5400, magSize:8, reserve:48, damage:58, headDamage:145, spread:.0005, fireRate:500, recoil:.17, scoped:true, tone:72 }),
  blueprint({ id:'white-noise', name:'WHITE NOISE EMITTER', category:'WEIRD', weaponClass:'DISTORTION PROJECTOR', caliber:'NOISE', trait:'CONTINUOUS DISRUPTION CONE', kind:'flame', color:0xb5b9ba, price:6000, magSize:80, reserve:320, damage:8, headDamage:8, pellets:5, spread:.075, fireRate:52, recoil:.02, automatic:true, tone:190, range:32 }),
  blueprint({ id:'subwoofer', name:'THE SUB-WOOFER', category:'WEIRD', weaponClass:'BASS REPULSOR', caliber:'SUB', trait:'KNOCKBACK // RECOIL BOOST', kind:'recoil', color:0x3f6387, price:6800, magSize:3, reserve:18, damage:0, headDamage:0, spread:0, fireRate:950, recoil:.46, tone:34, effect:'repulsor' }),
  blueprint({ id:'pitch', name:'THE PITCH SHIFTER', category:'WEIRD', weaponClass:'TRACKING BEAM', caliber:'HZ', trait:'HIGH-FREQUENCY BEAM', kind:'rail', color:0x2cb1a2, price:7500, magSize:20, reserve:100, damage:40, headDamage:82, spread:0, fireRate:120, recoil:.035, automatic:true, tone:230, effect:'pierce' }),
  blueprint({ id:'scalpel', name:'THE SONIC SCALPEL', category:'WEIRD', weaponClass:'PIERCING SONIC RIFLE', caliber:'ULTRA', trait:'PIERCES TARGETS // IGNORES COVER', kind:'rail', color:0x9ad7df, price:8200, magSize:7, reserve:35, damage:62, headDamage:124, spread:0, fireRate:520, recoil:.1, tone:245, effect:'pierce', scoped:true }),
  blueprint({ id:'resonance-spike', name:'THE RESONANCE SPIKE', category:'WEIRD', weaponClass:'TUNING-FORK LAUNCHER', caliber:'SPIKE', trait:'PULSING BLAST // 16M', kind:'launcher', color:0xc4923f, price:9000, magSize:4, reserve:24, damage:110, headDamage:110, spread:.006, fireRate:780, recoil:.26, tone:64, effect:'explosive', blastRadius:16 }),
  blueprint({ id:'decibel', name:'THE DECIBEL INJECTOR', category:'WEIRD', weaponClass:'KINETIC DART GUN', caliber:'DART', trait:'STEP-TRIGGERED KINETICS', kind:'crossbow', color:0x8a4f3c, price:9800, magSize:5, reserve:35, damage:52, headDamage:105, spread:.002, fireRate:360, recoil:.05, silent:true, tone:40 }),
  blueprint({ id:'ultrasound', name:'ULTRASOUND CARBINE', category:'WEIRD', weaponClass:'SENSOR CARBINE', caliber:'ULTRA', trait:'SKELETAL TAGGING ROUNDS', kind:'rifle', color:0x3aa6b7, price:10500, magSize:28, reserve:140, damage:27, headDamage:68, spread:.005, fireRate:85, recoil:.065, automatic:true, silent:true, tone:220 }),

  // CRAZY // volatile arena-changing hardware.
  blueprint({ id:'singularity', name:'THE SINGULARITY CORE', category:'CRAZY', weaponClass:'GRAVITY LAUNCHER', caliber:'GRAV', trait:'22M COLLAPSE FIELD', kind:'launcher', color:0x402e62, price:12000, magSize:2, reserve:12, damage:155, headDamage:155, spread:.003, fireRate:1200, recoil:.34, tone:30, effect:'explosive', blastRadius:22 }),
  blueprint({ id:'echo-chamber', name:'THE ECHO CHAMBER', category:'CRAZY', weaponClass:'ABSORPTION CANNON', caliber:'BUBBLE', trait:'STORES IMPACT // DETONATES', kind:'launcher', color:0x35616b, price:13000, magSize:3, reserve:15, damage:135, headDamage:135, spread:.004, fireRate:900, recoil:.25, effect:'explosive', blastRadius:19 }),
  blueprint({ id:'glitch', name:'THE GLITCH TRIGGER', category:'CRAZY', weaponClass:'CORRUPTION RAY', caliber:'ERR', trait:'DATA-SCRAMBLE IMPACT', kind:'rail', color:0xc3357f, price:14000, magSize:9, reserve:45, damage:48, headDamage:96, spread:0, fireRate:320, recoil:.08, effect:'pierce' }),
  blueprint({ id:'tectonic', name:'TECTONIC REBOUNDER', category:'CRAZY', weaponClass:'RICOCHET CANNON', caliber:'TUNGSTEN', trait:'DAMAGE GROWS PER BOUNCE', kind:'brass', color:0x9a5634, price:15000, magSize:8, reserve:40, damage:20, headDamage:20, spread:0, fireRate:700, recoil:.2, effect:'acoustic' }),
  blueprint({ id:'chrono', name:'THE CHRONO-STUTTER', category:'CRAZY', weaponClass:'TEMPORAL RIFLE', caliber:'4 SEC', trait:'TEMPORAL DISPLACEMENT ROUND', kind:'rail', color:0x5270ad, price:16000, magSize:4, reserve:24, damage:82, headDamage:164, spread:0, fireRate:850, recoil:.14, scoped:true, effect:'pierce' }),
  blueprint({ id:'phase', name:'THE PHASE DISPLACER', category:'CRAZY', weaponClass:'PORTAL PROJECTOR', caliber:'PHASE', trait:'QUANTUM POSITION ROUND', kind:'void', color:0x7446a8, price:17500, magSize:3, reserve:15, damage:105, headDamage:190, spread:0, fireRate:1000, recoil:.18, effect:'pierce' }),
  blueprint({ id:'babel', name:'THE BABEL RAY', category:'CRAZY', weaponClass:'COMMS DISRUPTOR', caliber:'BABEL', trait:'IFF SCRAMBLE PAYLOAD', kind:'rail', color:0xd35858, price:18500, magSize:12, reserve:60, damage:44, headDamage:88, spread:.001, fireRate:260, recoil:.07, automatic:false }),
  blueprint({ id:'overflow', name:'KINETIC OVERFLOW', category:'CRAZY', weaponClass:'SHIELD-FED PLASMA', caliber:'PLASMA', trait:'RAPID PLASMA OUTPUT', kind:'rail', color:0x44d17d, price:20000, magSize:60, reserve:240, damage:23, headDamage:51, spread:.008, fireRate:62, recoil:.045, automatic:true, tone:175 }),
  blueprint({ id:'symphony', name:'SYMPHONY OF DESTRUCTION', category:'CRAZY', weaponClass:'ORBITAL MORTAR', caliber:'ORBITAL', trait:'CRESCENDO BARRAGE // 26M', kind:'launcher', color:0xc19b45, price:22000, magSize:1, reserve:8, damage:240, headDamage:240, spread:.002, fireRate:1800, recoil:.5, tone:26, effect:'explosive', blastRadius:26 }),
  blueprint({ id:'poltergeist', name:'THE POLTERGEIST', category:'CRAZY', weaponClass:'KINETIC WAVE GUN', caliber:'FORCE', trait:'INVISIBLE REPULSOR WAVE', kind:'recoil', color:0xbfc7c8, price:24000, magSize:5, reserve:25, damage:0, headDamage:0, spread:.002, fireRate:650, recoil:.32, silent:true, effect:'repulsor' }),

  // CUSTOM // hot-swappable player blueprints.
  blueprint({ id:'frame-alpha', name:'MODULAR FRAME-ALPHA', category:'CUSTOM', weaponClass:'ADAPTIVE PLATFORM', caliber:'5.56/BEAM', trait:'BALANCED MODULAR FRAME', kind:'rifle', color:0x6b7b83, price:11500, magSize:30, reserve:150, damage:35, headDamage:84, spread:.003, fireRate:92, recoil:.08, automatic:true }),
  blueprint({ id:'frankenstein', name:'THE FRANKENSTEIN', category:'CUSTOM', weaponClass:'SCOPED AUTO SHOTGUN', caliber:'12 GA', trait:'04× OPTIC // FULL AUTO', kind:'shotgun', color:0x785640, price:13000, magSize:12, reserve:60, damage:13, headDamage:23, pellets:8, spread:.035, fireRate:180, recoil:.18, automatic:true, scoped:true }),
  blueprint({ id:'chimera', name:'THE CHIMERA SMG', category:'CUSTOM', weaponClass:'DUAL-FEED SMG', caliber:'9 MM/SONIC', trait:'BALLISTIC + TRACKING FEED', kind:'smg', color:0x667b4e, price:14500, magSize:48, reserve:192, damage:24, headDamage:55, spread:.009, fireRate:65, recoil:.055, automatic:true }),
  blueprint({ id:'aegis', name:'THE AEGIS CARBINE', category:'CUSTOM', weaponClass:'KINETIC-COLLECTOR AR', caliber:'5.56/RAIL', trait:'RAIL SECONDARY PLATFORM', kind:'rail', color:0x3c7182, price:16000, magSize:24, reserve:120, damage:42, headDamage:100, spread:.002, fireRate:120, recoil:.1, automatic:true, effect:'pierce' }),
  blueprint({ id:'overclocked', name:'THE OVERCLOCKED VARIANT', category:'CUSTOM', weaponClass:'VARIABLE-RATE CHASSIS', caliber:'CASLESS', trait:'990 RPM // HEAT-RISK TUNE', kind:'smg', color:0xad543e, price:17500, magSize:42, reserve:210, damage:22, headDamage:49, spread:.011, fireRate:60, recoil:.055, automatic:true, tone:168 }),
  blueprint({ id:'catalyst', name:'THE CATALYST RIFLE', category:'CUSTOM', weaponClass:'ELEMENTAL PRIMER', caliber:'PRIMER', trait:'SHOCK DETONATION BARREL', kind:'launcher', color:0x4e87a8, price:19000, magSize:8, reserve:40, damage:92, headDamage:120, spread:.003, fireRate:520, recoil:.18, effect:'explosive', blastRadius:12 }),
  blueprint({ id:'splicer', name:'THE SPLICER', category:'CUSTOM', weaponClass:'CHAIN SUPPORT RIFLE', caliber:'LINK', trait:'CHAIN ENERGY PROJECTOR', kind:'magnet', color:0x4f9d77, price:20500, magSize:2, reserve:20, damage:0, headDamage:0, spread:0, fireRate:420, recoil:.1, effect:'magnet', linkA:null }),
  blueprint({ id:'hybrid-bolt', name:'THE HYBRID BOLT', category:'CUSTOM', weaponClass:'CHARGED PLASMA SNIPER', caliber:'PLASMA', trait:'12× OPTIC // CHARGED SHOT', kind:'sniper', color:0x485ca5, price:22500, magSize:4, reserve:24, damage:175, headDamage:360, spread:.0002, fireRate:1250, reloadTime:2500, recoil:.42, scoped:true, effect:'pierce' }),
  blueprint({ id:'bastion', name:'THE BASTION LMG', category:'CUSTOM', weaponClass:'BIPOD HEAVY LMG', caliber:'7.62', trait:'DEPLOYABLE SUSTAINED FIRE', kind:'lmg', color:0x59664a, price:24500, magSize:160, reserve:480, damage:31, headDamage:70, spread:.013, fireRate:76, reloadTime:4400, recoil:.08, automatic:true }),
  blueprint({ id:'vector', name:'THE VECTOR BLUEPRINT', category:'CUSTOM', weaponClass:'GUIDED SMART-GUN', caliber:'SMART', trait:'CURVED GUIDANCE ROUNDS', kind:'rail', color:0x397d8d, price:27000, magSize:20, reserve:100, damage:52, headDamage:112, spread:.001, fireRate:210, recoil:.07, scoped:true }),
];

// SLOT ARSENAL // forty role-locked weapons with bespoke combat hooks.
loadout.push(
  blueprint({id:'harmonic-rail',name:'HARMONIC RAIL',category:'PRIMARY',weaponClass:'CHARGE SNIPER',caliber:'HARMONIC',trait:'CHARGE // THIN-WALL PIERCE // FULL CHARGE REVEALS',slot:0,kind:'sniper',color:0x55ddea,price:28500,magSize:4,reserve:24,damage:92,headDamage:210,spread:.00025,fireRate:950,reloadTime:2500,recoil:.34,scoped:true,effect:'pierce',special:'harmonic'}),
  blueprint({id:'twinbeat-rifle',name:'TWINBEAT RIFLE',category:'PRIMARY',weaponClass:'MARK-BURST RIFLE',caliber:'TWIN',trait:'FIRST HIT MARKS // SECOND HIT DETONATES',slot:0,kind:'sniper',color:0xff5b9f,price:29200,magSize:12,reserve:72,damage:48,headDamage:105,spread:.001,fireRate:240,recoil:.12,scoped:true,special:'twinbeat'}),
  blueprint({id:'ricochet-longshot',name:'RICOCHET LONGSHOT',category:'PRIMARY',weaponClass:'BANK-SHOT SNIPER',caliber:'RICO',trait:'AIM BOUNCE PREVIEW // HARD-SURFACE BANK',slot:0,kind:'sniper',color:0xffc857,price:30000,magSize:5,reserve:30,damage:105,headDamage:220,spread:.0005,fireRate:850,recoil:.31,scoped:true,special:'ricochet'}),
  blueprint({id:'meteor-driver',name:'METEOR DRIVER',category:'PRIMARY',weaponClass:'AIRBORNE HEAVY SNIPER',caliber:'METEOR',trait:'FALLING ACCURACY // DESCENT DAMAGE',slot:0,kind:'sniper',color:0xff7043,price:30800,magSize:4,reserve:24,damage:126,headDamage:275,spread:.00045,fireRate:1050,reloadTime:2700,recoil:.42,scoped:true,special:'meteor'}),
  blueprint({id:'glasswire-dmr',name:'GLASSWIRE DMR',category:'PRIMARY',weaponClass:'LINK MARKSMAN',caliber:'WIRE',trait:'CONSECUTIVE HITS LINK HOSTILES',slot:0,kind:'sniper',color:0x9f7cff,price:31600,magSize:14,reserve:84,damage:52,headDamage:116,spread:.0012,fireRate:260,recoil:.13,scoped:true,special:'glasswire'}),
  blueprint({id:'stormcoil-carbine',name:'STORMCOIL CARBINE',category:'PRIMARY',weaponClass:'SPRINT-CHARGE CARBINE',caliber:'COIL',trait:'SPRINT STORES POWER // BOOSTED BURST',slot:0,kind:'rifle',color:0x4dd9ff,price:32400,magSize:30,reserve:150,damage:34,headDamage:78,spread:.003,fireRate:92,recoil:.08,automatic:true,special:'stormcoil'}),
  blueprint({id:'aftershock-cannon',name:'AFTERSHOCK CANNON',category:'PRIMARY',weaponClass:'KINETIC SNIPER',caliber:'SHOCK',trait:'IMPACT SHOCKWAVE // COVER DISPLACEMENT',slot:0,kind:'sniper',color:0xe29250,price:33200,magSize:5,reserve:30,damage:112,headDamage:235,spread:.0006,fireRate:920,recoil:.37,scoped:true,special:'aftershock'}),
  blueprint({id:'null-choir',name:'NULL CHOIR',category:'PRIMARY',weaponClass:'TRACELESS SNIPER',caliber:'NULL',trait:'NO TRACER // NEAR-SILENT // SLOW BOLT',slot:0,kind:'sniper',color:0x303647,price:34000,magSize:5,reserve:30,damage:122,headDamage:268,spread:.00035,fireRate:1350,reloadTime:2800,recoil:.27,scoped:true,silent:true,special:'nullChoir'}),
  blueprint({id:'prism-scattergun',name:'PRISM SCATTERGUN',category:'PRIMARY',weaponClass:'SPLITTING ENERGY SHOTGUN',caliber:'PRISM',trait:'WALL IMPACT SPLITS PELLETS',slot:0,kind:'shotgun',color:0xe778ff,price:34800,magSize:8,reserve:48,damage:17,headDamage:29,pellets:7,spread:.042,fireRate:600,recoil:.25,special:'prism'}),
  blueprint({id:'orbit-breaker',name:'ORBIT BREAKER',category:'PRIMARY',weaponClass:'GUIDED ORBIT RIFLE',caliber:'ORBIT',trait:'SCOPE MARK // CURVING PROJECTILE',slot:0,kind:'rail',color:0x6c8cff,price:35600,magSize:7,reserve:42,damage:118,headDamage:230,spread:0,fireRate:760,recoil:.24,scoped:true,special:'orbitBreaker'}),

  blueprint({id:'echo-9',name:'ECHO-9',category:'SECONDARY',weaponClass:'SONIC PISTOL',caliber:'9 MM',trait:'3 HITS TRIGGER REVEAL BURST',slot:1,kind:'pistol',color:0x50e5ff,price:12800,magSize:15,reserve:90,damage:29,headDamage:70,spread:.004,fireRate:165,recoil:.055,special:'echo9'}),
  blueprint({id:'kickback-compact',name:'KICKBACK COMPACT',category:'SECONDARY',weaponClass:'RECOIL PISTOL',caliber:'.50',trait:'PUSHES TARGET + SHOOTER',slot:1,kind:'pistol',color:0xf18d46,price:13600,magSize:7,reserve:42,damage:62,headDamage:132,spread:.005,fireRate:330,recoil:.26,special:'kickback'}),
  blueprint({id:'counterbeat-revolver',name:'COUNTERBEAT REVOLVER',category:'SECONDARY',weaponClass:'COUNTER-SHOT REVOLVER',caliber:'.44',trait:'BONUS DAMAGE AFTER ENEMY SHOT',slot:1,kind:'pistol',color:0xc9a55a,price:14400,magSize:6,reserve:42,damage:67,headDamage:145,spread:.004,fireRate:360,recoil:.23,special:'counterbeat'}),
  blueprint({id:'arc-wasp',name:'ARC WASP',category:'SECONDARY',weaponClass:'CHAIN MACHINE PISTOL',caliber:'ARC',trait:'ELECTRICAL ROUNDS CHAIN NEARBY',slot:1,kind:'pistol',color:0x55c8ff,price:15200,magSize:24,reserve:120,damage:20,headDamage:42,spread:.012,fireRate:68,recoil:.05,automatic:true,special:'arcWasp'}),
  blueprint({id:'needlepoint',name:'NEEDLEPOINT',category:'SECONDARY',weaponClass:'SILENT PRECISION PISTOL',caliber:'NEEDLE',trait:'LOW BODY DAMAGE // 5× HEAD MULTIPLIER',slot:1,kind:'pistol',color:0x92a59f,price:16000,magSize:10,reserve:70,damage:18,headDamage:105,spread:.0018,fireRate:220,recoil:.035,silent:true,special:'needlepoint'}),
  blueprint({id:'stutter-pistol',name:'STUTTER PISTOL',category:'SECONDARY',weaponClass:'DELAY-ECHO PISTOL',caliber:'STUTTER',trait:'EACH SHOT REPEATS AFTER 0.18S',slot:1,kind:'pistol',color:0xa86eff,price:16800,magSize:12,reserve:72,damage:31,headDamage:68,spread:.004,fireRate:260,recoil:.07,special:'stutter'}),
  blueprint({id:'mag-lock-sidearm',name:'MAG-LOCK SIDEARM',category:'SECONDARY',weaponClass:'SLOWING PISTOL',caliber:'MAG',trait:'REPEATED HITS REDUCE MOVEMENT',slot:1,kind:'pistol',color:0x4488aa,price:17600,magSize:14,reserve:84,damage:27,headDamage:62,spread:.004,fireRate:175,recoil:.055,special:'magLock'}),
  blueprint({id:'blink-derringer',name:'BLINK DERRINGER',category:'SECONDARY',weaponClass:'PHASE DERRINGER',caliber:'BLINK',trait:'TWO SHOTS // BACKSTEP TELEPORT',slot:1,kind:'pistol',color:0xff67ca,price:18400,magSize:2,reserve:28,damage:82,headDamage:175,spread:.004,fireRate:240,reloadTime:1400,recoil:.18,special:'blinkDerringer'}),
  blueprint({id:'tracker-6',name:'TRACKER-6',category:'SECONDARY',weaponClass:'RADAR TAG PISTOL',caliber:'TAG',trait:'IMPACTS ATTACH RADAR TRANSMITTER',slot:1,kind:'pistol',color:0xe7ff57,price:19200,magSize:6,reserve:48,damage:38,headDamage:84,spread:.003,fireRate:260,recoil:.08,special:'tracker6'}),
  blueprint({id:'last-word',name:'LAST WORD',category:'SECONDARY',weaponClass:'FINISHER PISTOL',caliber:'.45',trait:'FINAL ROUND BOOST // KILL QUICK-LOAD',slot:1,kind:'pistol',color:0xd8c18a,price:20000,magSize:8,reserve:56,damage:43,headDamage:96,spread:.0035,fireRate:245,reloadTime:1900,recoil:.1,special:'lastWord'}),

  blueprint({id:'tuning-fork-blades',name:'TUNING-FORK BLADES',category:'MELEE',weaponClass:'SLIDE WAVE BLADES',caliber:'SONIC',trait:'SLIDING ATTACK RELEASES KNOCKBACK',slot:2,kind:'knife',color:0x50e5ff,price:10800,magSize:1,reserve:0,damage:78,headDamage:78,fireRate:310,ammoCost:0,effect:'melee',range:3.7,special:'tuningBlades'}),
  blueprint({id:'railhook',name:'RAILHOOK',category:'MELEE',weaponClass:'MAGNETIC HOOK',caliber:'HOOK',trait:'PULLS PLAYER TOWARD TARGET OR SURFACE',slot:2,kind:'knife',color:0x8296aa,price:11600,magSize:1,reserve:0,damage:64,headDamage:64,fireRate:620,ammoCost:0,effect:'melee',range:9,special:'railhook'}),
  blueprint({id:'phase-katana',name:'PHASE KATANA',category:'MELEE',weaponClass:'SHIELD-PHASE BLADE',caliber:'PHASE',trait:'CHARGED STRIKE BYPASSES DEFENSE',slot:2,kind:'knife',color:0x9b6cff,price:12400,magSize:1,reserve:0,damage:112,headDamage:112,fireRate:520,ammoCost:0,effect:'melee',range:4.1,special:'phaseKatana'}),
  blueprint({id:'reverb-hammer',name:'REVERB HAMMER',category:'MELEE',weaponClass:'GROUND-SLAM HAMMER',caliber:'BASS',trait:'CIRCULAR SHOCKWAVE SLAM',slot:2,kind:'knife',color:0xe4984f,price:13200,magSize:1,reserve:0,damage:125,headDamage:125,fireRate:850,ammoCost:0,effect:'melee',range:4,special:'reverbHammer'}),
  blueprint({id:'coil-baton',name:'COIL BATON',category:'MELEE',weaponClass:'UTILITY-DISRUPT BATON',caliber:'ARC',trait:'HITS DISABLE ENEMY EQUIPMENT',slot:2,kind:'knife',color:0x46ddff,price:14000,magSize:1,reserve:0,damage:69,headDamage:69,fireRate:280,ammoCost:0,effect:'melee',range:3.6,special:'coilBaton'}),
  blueprint({id:'glass-fang',name:'GLASS FANG',category:'MELEE',weaponClass:'CLOAK KNIFE',caliber:'GLASS',trait:'NEAR-INVISIBLE WHILE CROUCHED',slot:2,kind:'knife',color:0xb9f5ff,price:14800,magSize:1,reserve:0,damage:96,headDamage:96,fireRate:300,ammoCost:0,effect:'melee',range:3.4,special:'glassFang'}),
  blueprint({id:'momentum-gauntlets',name:'MOMENTUM GAUNTLETS',category:'MELEE',weaponClass:'VELOCITY FISTS',caliber:'KINETIC',trait:'DAMAGE SCALES WITH MOVEMENT SPEED',slot:2,kind:'knife',color:0xff6b35,price:15600,magSize:1,reserve:0,damage:46,headDamage:46,fireRate:210,ammoCost:0,effect:'melee',range:3.1,special:'momentumGauntlets'}),
  blueprint({id:'piston-axe',name:'PISTON AXE',category:'MELEE',weaponClass:'LAUNCH AXE',caliber:'PISTON',trait:'HEAVY HIT LAUNCHES TARGET UPWARD',slot:2,kind:'knife',color:0xb86736,price:16400,magSize:1,reserve:0,damage:138,headDamage:138,fireRate:780,ammoCost:0,effect:'melee',range:4,special:'pistonAxe'}),
  blueprint({id:'cable-whip',name:'CABLE WHIP',category:'MELEE',weaponClass:'LONG-RANGE WHIP',caliber:'CABLE',trait:'PULLS ITEMS + EXPLOSIVES',slot:2,kind:'knife',color:0x7f91a4,price:17200,magSize:1,reserve:0,damage:61,headDamage:61,fireRate:410,ammoCost:0,effect:'melee',range:7.5,special:'cableWhip'}),
  blueprint({id:'signal-saber',name:'SIGNAL SABER',category:'MELEE',weaponClass:'TIMED DEFLECTION BLADE',caliber:'SIGNAL',trait:'SWING WINDOW DEFLECTS ONE SHOT',slot:2,kind:'knife',color:0xe7ff57,price:18000,magSize:1,reserve:0,damage:88,headDamage:88,fireRate:470,ammoCost:0,effect:'melee',range:3.8,special:'signalSaber'}),

  blueprint({id:'resonance-disc',name:'RESONANCE DISC',category:'OTHER',weaponClass:'PULSE DISC',caliber:'DISC',trait:'RICOCHET // STICK // 3 SLOWING PULSES',slot:3,kind:'grenade',color:0x50e5ff,price:11800,magSize:2,reserve:4,damage:18,headDamage:18,fireRate:850,reloadTime:2200,effect:'utilityGrenade',blastRadius:15,throwSpeed:27,fuseTime:1900,sticky:true,special:'resonanceDisc'}),
  blueprint({id:'hardlight-wall',name:'HARDLIGHT WALL',category:'OTHER',weaponClass:'DEPLOYABLE BARRIER',caliber:'WALL',trait:'BLOCKS BULLETS // PLAYERS PASS THROUGH',slot:3,kind:'mine',color:0x58dfff,price:12600,magSize:2,reserve:3,damage:0,headDamage:0,fireRate:900,reloadTime:2000,effect:'hardlightWall',cooldownDuration:6500}),
  blueprint({id:'mute-grenade',name:'MUTE GRENADE',category:'OTHER',weaponClass:'STEALTH GRENADE',caliber:'MUTE',trait:'HIDES FOOTSTEPS + RADAR ACTIVITY',slot:3,kind:'grenade',color:0x657080,price:13400,magSize:2,reserve:4,damage:0,headDamage:0,fireRate:850,reloadTime:2100,effect:'utilityGrenade',blastRadius:16,throwSpeed:26,fuseTime:1400,special:'muteGrenade'}),
  blueprint({id:'polarity-snare',name:'POLARITY SNARE',category:'OTHER',weaponClass:'MAGNETIC SNARE',caliber:'POLAR',trait:'PULLS ENEMIES + GRENADES + ITEMS',slot:3,kind:'grenade',color:0x9b6cff,price:14200,magSize:2,reserve:4,damage:12,headDamage:12,fireRate:900,reloadTime:2300,effect:'utilityGrenade',blastRadius:17,throwSpeed:24,fuseTime:1500,special:'polaritySnare'}),
  blueprint({id:'updraft-canister',name:'UPDRAFT CANISTER',category:'OTHER',weaponClass:'WIND COLUMN',caliber:'UP',trait:'VERTICAL LAUNCH FIELD',slot:3,kind:'grenade',color:0x9eefff,price:15000,magSize:2,reserve:4,damage:0,headDamage:0,fireRate:900,reloadTime:2200,effect:'utilityGrenade',blastRadius:8,throwSpeed:23,fuseTime:1200,special:'updraft'}),
  blueprint({id:'mirror-drone',name:'MIRROR DRONE',category:'OTHER',weaponClass:'DECOY SWARM',caliber:'MIRROR',trait:'PROJECTS MOVING PLAYER COPIES',slot:3,kind:'mine',color:0xff78d2,price:15800,magSize:2,reserve:3,damage:0,headDamage:0,fireRate:1000,reloadTime:2400,effect:'mirrorDrone',cooldownDuration:8000}),
  blueprint({id:'nanite-mist',name:'NANITE MIST',category:'OTHER',weaponClass:'HEALING CLOUD',caliber:'NANITE',trait:'SLOW AREA HEALING',slot:3,kind:'grenade',color:0x67e8a5,price:16600,magSize:2,reserve:4,damage:0,headDamage:0,fireRate:900,reloadTime:2200,effect:'utilityGrenade',blastRadius:10,throwSpeed:21,fuseTime:900,special:'naniteMist'}),
  blueprint({id:'breach-charge',name:'BREACH CHARGE',category:'OTHER',weaponClass:'REMOTE DEMOLITION',caliber:'BREACH',trait:'REMOTE DETONATE // BONUS VS BARRIERS',slot:3,kind:'grenade',color:0xff6338,price:17400,magSize:2,reserve:4,damage:190,headDamage:190,fireRate:800,reloadTime:2600,effect:'utilityGrenade',blastRadius:13,throwSpeed:20,fuseTime:12000,sticky:true,special:'breachCharge'}),
  blueprint({id:'phase-beacon',name:'PHASE BEACON',category:'OTHER',weaponClass:'RETURN BEACON',caliber:'PHASE',trait:'10S POSITION RETURN // NO HEAL',slot:3,kind:'mine',color:0xa477ff,price:18200,magSize:2,reserve:3,damage:0,headDamage:0,fireRate:650,reloadTime:2200,effect:'phaseBeacon',cooldownDuration:7500}),
  blueprint({id:'ammo-synthesizer',name:'AMMO SYNTHESIZER',category:'OTHER',weaponClass:'AMMO FABRICATOR',caliber:'SYNTH',trait:'GENERATES AMMO // RADAR BROADCAST',slot:3,kind:'mine',color:0xffc857,price:19000,magSize:2,reserve:3,damage:0,headDamage:0,fireRate:900,reloadTime:2400,effect:'ammoSynth',cooldownDuration:9000}),
);

// FIRST EXPANSION // movement-first weapons selected from the concept backlog.
loadout.push(
  blueprint({id:'glassline-sniper',name:'GLASSLINE SNIPER',category:'PRIMARY',weaponClass:'FRACTURE SNIPER',caliber:'CRYSTAL',trait:'MARK // REPEAT HIT SHATTERS // HEADSHOT BURST',slot:0,kind:'sniper',color:0x8eeeff,price:23800,magSize:5,reserve:30,damage:108,headDamage:238,spread:.00035,fireRate:880,reloadTime:2400,recoil:.3,scoped:true,special:'glassline'}),
  blueprint({id:'comet-shorty',name:'COMET SHORTY',category:'SECONDARY',weaponClass:'RECOIL SHOTGUN',caliber:'12 GA COMPACT',trait:'TWO SHELLS // RECOIL PROPULSION',slot:1,kind:'shotgun',color:0xff7a45,price:14200,magSize:2,reserve:24,damage:18,headDamage:27,pellets:7,spread:.052,fireRate:520,reloadTime:1550,recoil:.34,special:'cometShorty'})
);

// SILLY / CHAOS // playful hardware with practical crowd-control and movement utility.
loadout.push(
  blueprint({id:'pizza-party-launcher',name:'PIZZA PARTY LAUNCHER',category:'SILLY',weaponClass:'RICOCHET FOOD LAUNCHER',caliber:'EXTRA LARGE',trait:'2 BOUNCES // 8-SLICE SPLIT // PINEAPPLE CRIT',slot:3,kind:'grenade',modelKind:'pizza',color:0xff7b3f,price:9800,magSize:2,reserve:8,damage:56,headDamage:92,fireRate:780,reloadTime:2100,recoil:.15,effect:'explosive',blastRadius:7,throwSpeed:31,fuseTime:9000,special:'pizzaParty'}),
  blueprint({id:'red-fish-blaster',name:'RED FISH BLASTER',category:'SILLY',weaponClass:'CHARGED WATER SIDEARM',caliber:'SPLASH',trait:'RMB CHARGE // WET + KNOCKBACK',slot:1,kind:'pistol',modelKind:'fish',color:0xff334b,price:7200,magSize:12,reserve:72,damage:27,headDamage:68,spread:.004,fireRate:190,reloadTime:1600,recoil:.07,tone:240,special:'redFish'}),
  blueprint({id:'red-herring',name:'RED HERRING',category:'SILLY',weaponClass:'AI DISTRACTION OTHER',caliber:'FLOP',trait:'5S DECOY // RADAR-HIDING RED SMOKE',slot:3,kind:'grenade',modelKind:'fish',color:0xff2948,price:8600,magSize:2,reserve:6,damage:0,headDamage:0,fireRate:900,reloadTime:2200,recoil:.08,effect:'utilityGrenade',blastRadius:13,throwSpeed:24,fuseTime:5000,special:'redHerring'}),
  blueprint({id:'tactical-toaster',name:'TACTICAL TOASTER',category:'SILLY',weaponClass:'TWO-SLICE SIDEARM',caliber:'WHOLE WHEAT',trait:'HOLD FIRE // PERFECT TOAST WINDOW // GOLDEN WAFFLE',slot:1,kind:'shotgun',modelKind:'toaster',color:0xd7e2ea,price:9400,magSize:2,reserve:28,damage:18,headDamage:28,pellets:5,spread:.048,fireRate:560,reloadTime:1750,recoil:.22,tone:170,special:'toaster'}),
  blueprint({id:'baguette-bolt-action',name:'BAGUETTE BOLT-ACTION',category:'SILLY',weaponClass:'ARTISAN BREAD SNIPER',caliber:'BREADSTICK',trait:'JAM-JAR SCOPE // CRUMB TRAIL // CRUNCH CRIT',slot:0,kind:'sniper',modelKind:'baguette',color:0xd89c4a,price:13800,magSize:5,reserve:35,damage:116,headDamage:275,spread:.00045,fireRate:980,reloadTime:2350,recoil:.31,tone:62,scoped:true,special:'baguette'}),
  blueprint({id:'rubber-chicken-railgun',name:'RUBBER CHICKEN RAILGUN',category:'SILLY',weaponClass:'SCREAM-CHARGE RAILGUN',caliber:'SQUEAK',trait:'HOLD FIRE // FULL CHARGE PIERCES // FEATHER BURST',slot:0,kind:'rail',modelKind:'chicken',color:0xffdc38,price:16800,magSize:4,reserve:24,damage:72,headDamage:158,spread:0,fireRate:980,reloadTime:2300,recoil:.28,tone:320,effect:'pierce',scoped:true,special:'rubberChicken'}),
  blueprint({id:'banana-peel-revolver',name:'BANANA PEEL REVOLVER',category:'SILLY',weaponClass:'SLIP-HAZARD REVOLVER',caliber:'BANANA',trait:'MISSES BECOME TRAPS // CRITS POP TARGETS UP',slot:1,kind:'pistol',modelKind:'banana',color:0xffdf32,price:10200,magSize:6,reserve:42,damage:32,headDamage:74,spread:.006,fireRate:310,reloadTime:2050,recoil:.18,tone:190,special:'bananaPeel'}),
  blueprint({id:'disco-ball-mortar',name:'DISCO BALL MORTAR',category:'SILLY',weaponClass:'REVEAL PARTY OTHER',caliber:'4/4',trait:'STICKY LIGHT SCAN // SPEED AURA // FINALE PULSE',slot:3,kind:'grenade',modelKind:'disco',color:0xc779ff,price:12600,magSize:2,reserve:5,damage:52,headDamage:52,fireRate:1000,reloadTime:2500,recoil:.13,effect:'utilityGrenade',blastRadius:15,throwSpeed:23,fuseTime:900,sticky:true,special:'discoBall'}),
  blueprint({id:'birthday-cake-cannon',name:'BIRTHDAY CAKE CANNON',category:'SILLY',weaponClass:'STICKY PARTY LAUNCHER',caliber:'CAKE',trait:'CANDLE FUSE // CONFETTI BLAST // SELF HEAL',slot:0,kind:'launcher',modelKind:'cake',color:0xff75c8,price:15000,magSize:3,reserve:15,damage:138,headDamage:138,spread:.004,fireRate:930,reloadTime:2550,recoil:.3,tone:132,effect:'cakeExplosive',blastRadius:14,throwSpeed:27,fuseTime:1700,sticky:true,special:'cakeCannon'}),
  blueprint({id:'bubble-tea-smg',name:'BUBBLE TEA SMG',category:'SILLY',weaponClass:'STICKY PEARL SMG',caliber:'BOBA',trait:'BOUNCE PEARLS // RAPID HITS MAKE SLOW PUDDLES',slot:0,kind:'smg',modelKind:'boba',color:0x65eaff,price:11200,magSize:36,reserve:180,damage:20,headDamage:44,spread:.011,fireRate:68,reloadTime:1750,recoil:.05,tone:260,automatic:true,special:'bubbleTea'}),
  blueprint({id:'garden-gnome-launcher',name:'GARDEN GNOME LAUNCHER',category:'SILLY',weaponClass:'RECOVERABLE TURRET OTHER',caliber:'GNOME',trait:'TEMP TURRET // F PICKUP REFUNDS CHARGE',slot:3,kind:'mine',modelKind:'gnome',color:0xff3c55,price:13400,magSize:2,reserve:4,damage:13,headDamage:13,fireRate:950,reloadTime:2400,recoil:.1,effect:'gnomeTurret',cooldownDuration:2500,special:'gnomeTurret'}),
  blueprint({id:'sock-puppet-shotgun',name:'SOCK PUPPET SHOTGUN',category:'SILLY',weaponClass:'LINT-CLOUD SIDEARM',caliber:'BUTTON',trait:'RMB BITE CHARGE // REPEAT HITS CAUSE SNEEZE',slot:1,kind:'shotgun',modelKind:'sock',color:0x9b6cff,price:10800,magSize:5,reserve:40,damage:14,headDamage:21,pellets:6,spread:.06,fireRate:470,reloadTime:1850,recoil:.16,tone:205,special:'sockPuppet'}),
  blueprint({id:'condiment-blasters',name:'KETCHUP + MUSTARD BLASTERS',category:'SILLY',weaponClass:'DUAL CONDIMENT SIDEARMS',caliber:'SAUCE',trait:'TRACK + SLIP // HOT DOG COMBO',slot:1,kind:'pistol',modelKind:'condiment',color:0xffc82e,price:11800,magSize:18,reserve:90,damage:23,headDamage:52,spread:.008,fireRate:125,reloadTime:1900,recoil:.06,tone:225,automatic:true,special:'condiments'}),
  blueprint({id:'shopping-cart-cannon',name:'SHOPPING CART CANNON',category:'SILLY',weaponClass:'GROWING KINETIC CANNON',caliber:'AISLE 9',trait:'COLLECTS PROPS // RAMP LAUNCH // HUGE KNOCKBACK',slot:0,kind:'launcher',modelKind:'cart',color:0xaeb8c2,price:15800,magSize:3,reserve:15,damage:72,headDamage:72,spread:0,fireRate:1050,reloadTime:2700,recoil:.38,tone:74,special:'shoppingCart'}),
  blueprint({id:'unicorn-sprinkler',name:'UNICORN SPRINKLER',category:'SILLY',weaponClass:'RAINBOW WATER CANNON',caliber:'MAGIC',trait:'RAMPING STREAM // SPEED TRAIL // GRENADE DEFLECT',slot:0,kind:'flame',modelKind:'unicorn',color:0xff8fdd,price:14600,magSize:80,reserve:320,damage:7,headDamage:7,pellets:2,spread:.022,fireRate:55,reloadTime:2300,recoil:.025,tone:290,automatic:true,range:48,special:'unicorn'})
);

// Starter utility kit: familiar baseline gear remains available beside the expanded arsenal.
loadout.push(
  blueprint({ id:'combat-knife', name:'COMBAT KNIFE', category:'GEAR', weaponClass:'MELEE', caliber:'STEEL', trait:'3.2M LUNGE // NO AMMO', kind:'knife', color:0x667172, price:0, magSize:1, reserve:0, damage:92, headDamage:92, spread:0, fireRate:480, reloadTime:0, recoil:.04, silent:true, ammoCost:0, effect:'melee', range:3.2 }),
  blueprint({ id:'shock-baton', name:'SHOCK BATON', category:'GEAR', weaponClass:'MELEE', caliber:'ARC', trait:'FAST SWING // 3.4M REACH', kind:'knife', color:0x50e5ff, price:1400, magSize:1, reserve:0, damage:72, headDamage:72, spread:0, fireRate:260, reloadTime:0, recoil:.035, silent:true, ammoCost:0, effect:'melee', range:3.4 }),
  blueprint({ id:'resonance-blade', name:'RESONANCE BLADE', category:'GEAR', weaponClass:'MELEE', caliber:'SONIC EDGE', trait:'HEAVY STRIKE // 3.8M REACH', kind:'knife', color:0x9b6cff, price:2800, magSize:1, reserve:0, damage:140, headDamage:140, spread:0, fireRate:620, reloadTime:0, recoil:.06, silent:true, ammoCost:0, effect:'melee', range:3.8 }),
  blueprint({ id:'frag-bomb', name:'FRAG BOMB', category:'GEAR', weaponClass:'THROWN EXPLOSIVE', caliber:'FRAG', trait:'DOTTED ARC // 1.8S FUSE // 14M BLAST', kind:'grenade', color:0x536044, price:0, magSize:1, reserve:6, damage:125, headDamage:125, spread:.008, fireRate:900, reloadTime:2600, recoil:.2, tone:42, effect:'explosive', blastRadius:14, throwSpeed:28, fuseTime:1800 }),
  blueprint({ id:'pulse-charge', name:'PULSE CHARGE', category:'GEAR', weaponClass:'THROWN EXPLOSIVE', caliber:'PULSE', trait:'DOTTED ARC // 2.2S FUSE // 20M BLAST', kind:'grenade', color:0xff4fba, price:2400, magSize:1, reserve:4, damage:165, headDamage:165, spread:.006, fireRate:1200, reloadTime:3200, recoil:.25, tone:34, effect:'explosive', blastRadius:20, throwSpeed:25, fuseTime:2200 }),
  blueprint({ id:'medkit', name:'FIELD MEDKIT', category:'GEAR', weaponClass:'SUPPORT OTHER', caliber:'MED', trait:'RESTORES 45 HEALTH', kind:'medkit', color:0xe6edf0, price:1200, magSize:2, reserve:4, damage:0, headDamage:0, spread:0, fireRate:1100, reloadTime:1300, recoil:0, silent:true, effect:'heal', healAmount:45 }),
  blueprint({ id:'gravity-bomb', name:'STICKY GRAVITY BOMB', category:'GEAR', weaponClass:'TACTICAL OTHER', caliber:'GRAV', trait:'STICKS // 3S PULL FIELD // 35% SLOW', kind:'grenade', color:0x9b6cff, price:3200, magSize:2, reserve:4, damage:24, headDamage:24, spread:0, fireRate:900, reloadTime:2800, recoil:.12, tone:38, effect:'gravityBomb', blastRadius:15, throwSpeed:24, fuseTime:1500, sticky:true, cooldownDuration:6500 }),
  blueprint({ id:'adrenaline-medkit', name:'ADRENALINE MEDKIT', category:'GEAR', weaponClass:'SUSTAINED OTHER', caliber:'MED+', trait:'HEAL 50 OVER 3S // +15% SPEED', kind:'medkit', color:0x67e8a5, price:2600, magSize:2, reserve:4, damage:0, headDamage:0, spread:0, fireRate:900, reloadTime:1800, recoil:0, silent:true, effect:'adrenaline', healAmount:50, healDuration:3000, speedDuration:6000, cooldownDuration:8000 }),
  blueprint({ id:'shock-mine', name:'PROXIMITY SHOCK MINE', category:'GEAR', weaponClass:'DEFENSIVE OTHER', caliber:'ARC', trait:'4.5M SENSOR // 1.5S STUN', kind:'mine', color:0x50e5ff, price:2900, magSize:2, reserve:4, damage:28, headDamage:28, spread:0, fireRate:800, reloadTime:2200, recoil:0, silent:true, effect:'shockMine', stunDuration:1500, triggerRadius:4.5, cooldownDuration:5500 }),
);

const rarityData = {
  common:{ label:'COMMON', color:0x55aaff, refund:75 },
  rare:{ label:'RARE', color:0xa65cff, refund:150 },
  legendary:{ label:'LEGENDARY', color:0xff455c, refund:350 },
  exotic:{ label:'EXOTIC', color:0xffc857, refund:650 },
};
const cosmeticCatalog = [
  { id:'matte-graphite', case:'standard', rarity:'common', name:'MATTE GRAPHITE SNIPER', slot:0, icon:'⌁', color:0x42505b },
  { id:'coastal-blue', case:'standard', rarity:'common', name:'COASTAL BLUE WRAP', slot:0, icon:'⌁', color:0x3476a8 },
  { id:'field-knife', case:'standard', rarity:'common', name:'FIELD KNIFE WRAP', slot:2, icon:'†', color:0x6f826b },
  { id:'olive-utility', case:'standard', rarity:'common', name:'OLIVE UTILITY CASE', slot:3, icon:'✚', color:0x65724c },
  { id:'violet-sidearm', case:'standard', rarity:'rare', name:'VIOLET CIRCUIT SIDEARM', slot:1, icon:'⌐', color:0x8d54d6, emissive:0x58259c },
  { id:'chroma-medkit', case:'standard', rarity:'rare', name:'CHROMA MEDKIT SKIN', slot:3, icon:'✚', color:0x42d9c4, emissive:0x167c83 },
  { id:'neon-paintball', case:'standard', rarity:'rare', name:'NEON PAINTBALL GUN', slot:0, icon:'⌁', color:0xff4fba, emissive:0x7f165d, trail:0xff4fba },
  { id:'vertigo-barrett', case:'standard', rarity:'legendary', name:'BARRETT | VERTIGO GRID', slot:0, icon:'⌁', color:0x50e5ff, emissive:0x175f8a, trail:0x50e5ff },
  { id:'reactor-edge', case:'standard', rarity:'legendary', name:'REACTOR EDGE KNIFE', slot:2, icon:'†', color:0xff5a35, emissive:0x9d2317 },
  { id:'aurora-charge', case:'standard', rarity:'exotic', name:'AURORA GRAVITY CHARGE', slot:3, icon:'◉', color:0xffd45a, emissive:0x9b4dff, trail:0xffc857 },
  { id:'cobalt-grid', case:'elite', rarity:'common', name:'COBALT GRID RIFLE', slot:0, icon:'⌁', color:0x2876cf },
  { id:'carbon-rose', case:'elite', rarity:'common', name:'CARBON ROSE SIDEARM', slot:1, icon:'⌐', color:0x9d3e68 },
  { id:'mint-mine', case:'elite', rarity:'common', name:'MINT SHOCK MINE', slot:3, icon:'◉', color:0x45d7a2 },
  { id:'arctic-knife', case:'elite', rarity:'common', name:'ARCTIC KNIFE', slot:2, icon:'†', color:0xb7eaff },
  { id:'hyperwave', case:'elite', rarity:'rare', name:'HYPERWAVE SNIPER', slot:0, icon:'⌁', color:0x6d55ff, emissive:0x3523a8, trail:0x9b6cff },
  { id:'prismatic-med', case:'elite', rarity:'rare', name:'PRISMATIC ADRENALINE', slot:3, icon:'✚', color:0x67e8a5, emissive:0xff4fba },
  { id:'laser-tag-pistol', case:'elite', rarity:'rare', name:'LASER TAG SIDEARM', slot:1, icon:'⌐', color:0xff5366, emissive:0x8a1429, trail:0xff5366 },
  { id:'glass-barrett', case:'elite', rarity:'legendary', name:'VERTIGO GLASS BARRETT', slot:0, icon:'⌁', color:0x7cecff, emissive:0x25759c, trail:0xe8ffff },
  { id:'molten-carbine', case:'elite', rarity:'legendary', name:'FOUNDRY MOLTEN CARBINE', slot:0, icon:'⌁', color:0xff5a18, emissive:0xb52005, trail:0xff7a22 },
  { id:'jungle-relic', case:'elite', rarity:'legendary', name:'JUNGLE RELIC BLADE', slot:2, icon:'†', color:0xb8d957, emissive:0x466b18 },
  { id:'pink-pixel-sword', case:'elite', rarity:'exotic', name:'PINK PIXEL SWORD', slot:2, icon:'⚔', color:0xff4fba, emissive:0x9b2fff, trail:0xff4fba },
  { id:'unicorn-shorty', case:'elite', rarity:'exotic', name:'UNICORN SHORTY | HYPERPOP', slot:1, icon:'⌐', color:0xffe3f7, emissive:0x50e5ff, trail:0xff75d1 },
  { id:'golden-pizza', case:'standard', rarity:'legendary', name:'GOLDEN PIZZA DELIVERY', slot:3, icon:'◉', color:0xffc857, emissive:0xff6b28, trail:0xffc857 },
  { id:'radioactive-fish', case:'standard', rarity:'rare', name:'RADIOACTIVE RED FISH', slot:1, icon:'⌐', color:0x9dff47, emissive:0x2c9b35, trail:0x9dff47 },
  { id:'diamond-toaster', case:'elite', rarity:'legendary', name:'DIAMOND TACTICAL TOASTER', slot:1, icon:'⌐', color:0xd9fbff, emissive:0x42cfff, trail:0xd9fbff },
  { id:'strawberry-boba', case:'standard', rarity:'rare', name:'STRAWBERRY BUBBLE TEA', slot:0, icon:'⌁', color:0xff7ca8, emissive:0xa22c68, trail:0xff7ca8 },
  { id:'galaxy-chicken', case:'elite', rarity:'exotic', name:'GALAXY RUBBER CHICKEN', slot:0, icon:'⌁', color:0x7047ff, emissive:0xff49d5, trail:0x50e5ff },
];
const abilityCatalog = {
  kinetic:{ name:'KINETIC SLINGSHOT', cooldown:9000 },
  snapshot:{ name:'THERMAL SNAPSHOT', cooldown:12000 },
  nova:{ name:'REPULSION NOVA', cooldown:11000 },
  rewind:{ name:'QUANTUM REWIND', cooldown:18000 },
  grapple:{ name:'GRAPPLE SLINGSHOT', cooldown:7000 },
  camo:{ name:'TEMPORAL PHASE CAMO', cooldown:14000 },
  decoy:{ name:'DECOY PROJECTION', cooldown:18000 },
  vector:{ name:'VECTOR DASH', cooldown:7000 },
  ramp:{ name:'HARDLIGHT RAMP', cooldown:15000 },
};
const passiveCatalog = {
  aero:{ name:'AERO-STABILIZER', icon:'◇' }, velocity:{ name:'VELOCITY CONVERSION', icon:'⚡' }, shadow:{ name:'SHADOW STEP', icon:'◒' }, apex:{ name:'APEX PREDATOR', icon:'⌖' }, resilience:{ name:'TACTICAL RESILIENCE', icon:'⬡' },
  momentum:{ name:'MOMENTUM CONSERVATION', icon:'↻' }, lightweight:{ name:'LIGHTWEIGHT FRAME', icon:'»' }, rebound:{ name:'REBOUND SHIELD', icon:'◎' },
  highground:{ name:'HIGH GROUND', icon:'△' }, softlanding:{ name:'SOFT LANDING', icon:'⌄' },
};

const quickSlotIds = ['specter', 'phantom', 'combat-knife', 'frag-bomb'];
const quickSlots = quickSlotIds.map(id => loadout.findIndex(gun => gun.id === id));
loadout.forEach(item => weapon.add(item.model));

const starterIds = ['specter', 'phantom', 'combat-knife', 'frag-bomb', 'sledge'];
const defaultSettings = Object.freeze({
  callsign:'ZERO SIGNAL', masterVolume:.75, musicVolume:.18, effectsVolume:.7,
  mouseSensitivity:1, scopeSensitivity:.35, fov:72, graphicsQuality:'high',
  shadowQuality:'high', cameraShake:.75, crosshairColor:'#e7ff57', crosshairSize:1,
  showDamageNumbers:true, showFps:false, enemyDifficulty:'normal', reduceMotion:matchMedia('(prefers-reduced-motion: reduce)').matches,
  disableCameraRoll:false, reducedUiMotion:false, scopeDebug:false, parkourAssist:false, parkourDebug:false, aiDebug:false, otherPlayerKillFx:'reduced', cosmeticQuality:'high', reducedCosmeticMotion:false,
  musicEnabled:false, bloom:true, adaptiveQuality:true,
});
const defaultStats = Object.freeze({
  xp:0, totalCreditsEarned:0, eliminations:0, dummyEliminations:0, hostileEliminations:0,
  headshots:0, bestMatchHeadshots:0, longestShot:0, fastestTargetClear:0, exoticRewards:0, contractsCompleted:0, deaths:0, weaponUses:{}, abilityUses:{}, bestMovementCombo:0, totalStyleScore:0, executions:0,
  lobbyParkourCompletions:0, lobbyParkourBestTime:0, lobbyParkourLastFullRewardAt:0,
  hubVisits:0, hubDailyRewardDate:'', lobbySecrets:{}, parkourBest:{}, parkourAssistedBest:{}, parkourMedals:{}, parkourAssistedMedals:{}, parkourCompletions:0, traversalTutorials:{},
  parkourDailyClaims:{}, parkourCollectibles:{}, parkourGhosts:{},
});
const defaultFactoryProgress = Object.freeze({ level:1, bestWave:0, repairs:0, defenseRuns:0, emergencyIndex:0, emergencyProgress:0 });
const localChallenges = [
  { id:'dummies', description:'Eliminate 10 dummies', target:10, reward:300, icon:'⌖' },
  { id:'scopedHeadshots', description:'Land 5 scoped headshots', target:5, reward:350, icon:'◉' },
  { id:'slideCancels', description:'Complete 3 slide-cancel jumps', target:3, reward:250, icon:'↯' },
  { id:'longKill', description:'Get an elimination beyond 60 meters', target:1, reward:400, icon:'⟷' },
  { id:'airKill', description:'Eliminate a target after using a launch pad', target:1, reward:425, icon:'⇧' },
  { id:'thermalReveal', description:'Reveal 3 enemies with Thermal Snapshot', target:3, reward:300, icon:'◈' },
  { id:'novaDeflect', description:'Deflect an explosive with Repulsion Nova', target:1, reward:375, icon:'✺' },
  { id:'cache', description:'Open one field cache', target:1, reward:250, icon:'◇' },
  { id:'secondaryKill', description:'Eliminate an enemy using a Secondary weapon', target:1, reward:350, icon:'⌐' },
  { id:'survivor', description:'Complete a contract without dying', target:1, reward:500, icon:'⬡' },
];
function localDateKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
}
function challengeIdsForDate(dateKey) {
  let seed = [...dateKey].reduce((value,char)=>(value*31+char.charCodeAt(0))>>>0,2166136261);
  const pool = localChallenges.map(challenge=>challenge.id);
  for (let index=pool.length-1; index>0; index--) { seed=(seed*1664525+1013904223)>>>0; const swap=seed%(index+1); [pool[index],pool[swap]]=[pool[swap],pool[index]]; }
  return pool.slice(0,3);
}
function normalizedChallengeState(savedState) {
  const date=localDateKey();
  if (savedState?.date===date) return { date, progress:{ ...(savedState.progress||{}) }, completed:[...new Set(savedState.completed||[])] };
  return { date, progress:{}, completed:[] };
}
function readProgress() {
  try {
    const saved = JSON.parse(localStorage.getItem('resonance-engine-progress'));
    const savedQ = abilityCatalog[saved?.abilities?.q] ? saved.abilities.q : abilityCatalog[saved?.ability] ? saved.ability : 'kinetic';
    let savedE = abilityCatalog[saved?.abilities?.e] ? saved.abilities.e : 'snapshot';
    if (savedE === savedQ) savedE = savedQ === 'snapshot' ? 'nova' : 'snapshot';
    const migratedPassives = Array.isArray(saved?.passives) ? saved.passives : passiveCatalog[saved?.passive] ? [saved.passive] : ['aero','velocity','shadow'];
    const passives = [...new Set(migratedPassives.filter(id => passiveCatalog[id]))].slice(0,3);
    return {
      cash:Math.max(0,Number(saved?.cash)||0), unlocked:new Set([...starterIds,...(saved?.unlocked||[])]), equipped:saved?.equipped||[],
      cosmetics:new Set(saved?.cosmetics||[]), equippedCosmetics:{ ...(saved?.equippedCosmetics||{}) }, abilities:{q:savedQ,e:savedE},
      passives:passives.length?passives:['aero'], settings:{...defaultSettings,...(saved?.settings||{})},
      stats:{...defaultStats,...(saved?.stats||{}),weaponUses:{...(saved?.stats?.weaponUses||{})},abilityUses:{...(saved?.stats?.abilityUses||{})},lobbySecrets:{...(saved?.stats?.lobbySecrets||{})},parkourBest:{...(saved?.stats?.parkourBest||{})},parkourAssistedBest:{...(saved?.stats?.parkourAssistedBest||{})},parkourMedals:{...(saved?.stats?.parkourMedals||{})},parkourAssistedMedals:{...(saved?.stats?.parkourAssistedMedals||{})},parkourDailyClaims:{...(saved?.stats?.parkourDailyClaims||{})},parkourCollectibles:{...(saved?.stats?.parkourCollectibles||{})},parkourGhosts:{...(saved?.stats?.parkourGhosts||{})},traversalTutorials:{...(saved?.stats?.traversalTutorials||{})}},
      favoriteWeapon:loadout.some(gun=>gun.id===saved?.favoriteWeapon)?saved.favoriteWeapon:'specter',
      challengeState:normalizedChallengeState(saved?.challengeState), unopenedCrates:Math.max(0,Number(saved?.unopenedCrates)||0),
      weaponMastery:{ ...(saved?.weaponMastery||{}) }, blueprintFragments:Math.max(0,Number(saved?.blueprintFragments)||0), discoveredWeapons:new Set([...(saved?.discoveredWeapons||[]),...starterIds]),
      executions:{ ...(saved?.executions||{}) }, factory:{ ...defaultFactoryProgress,...(saved?.factory||{}) }, discoveries:{ ...(saved?.discoveries||{}) },
      cosmeticState:createCosmeticProgress({...saved?.cosmeticState,owned:[...(saved?.cosmeticState?.owned||[]),...(saved?.cosmetics||[])]}),
    };
  } catch {
    return { cash:0, unlocked:new Set(starterIds), equipped:[], cosmetics:new Set(), equippedCosmetics:{}, abilities:{q:'kinetic',e:'snapshot'}, passives:['aero','velocity','shadow'], settings:{...defaultSettings}, stats:{...defaultStats,weaponUses:{},abilityUses:{},lobbySecrets:{},parkourBest:{},parkourAssistedBest:{},parkourMedals:{},parkourAssistedMedals:{},parkourDailyClaims:{},parkourCollectibles:{},parkourGhosts:{},traversalTutorials:{}}, favoriteWeapon:'specter', challengeState:normalizedChallengeState(), unopenedCrates:0, weaponMastery:{}, blueprintFragments:0, discoveredWeapons:new Set(starterIds), executions:{}, factory:{...defaultFactoryProgress}, discoveries:{}, cosmeticState:createCosmeticProgress() };
  }
}
const progress = readProgress();
const startupQuality=new URLSearchParams(location.search).get('quality');
if(QUALITY_PRESETS[startupQuality])progress.settings.graphicsQuality=startupQuality;
progress.equipped.slice(0, 4).forEach((id, slot) => {
  const index = loadout.findIndex(gun => gun.id === id);
  if (index >= 0 && progress.unlocked.has(id) && slotForGun(loadout[index]) === slot) quickSlots[slot] = index;
});
loadout.forEach((item, index) => { item.model.visible = index === quickSlots[0]; });

const ui = {
  menu: document.querySelector('#menu'), hud: document.querySelector('#hud'), deploy: document.querySelector('#deploy'), mouseLockGate:document.querySelector('#mouse-lock-gate'),
  ammo: document.querySelector('#ammo'), reserve: document.querySelector('#reserve'), weaponName: document.querySelector('#weapon-name'), caliber: document.querySelector('#caliber'), weaponTrait: document.querySelector('#weapon-trait'), targets: document.querySelector('#targets-left'), enemies: document.querySelector('#enemies-left'), cash: document.querySelector('#cash'),
  crosshair: document.querySelector('#crosshair'), jumpCharge:document.querySelector('#jump-charge'), scope: document.querySelector('#scope'), scopeLabel:document.querySelector('#scope > b'), scopeDebug:document.querySelector('#scope-debug'), scopeDebugOutput:document.querySelector('#scope-debug output'), aimFeedback:document.querySelector('#aim-feedback'), aimFeedbackLabel:document.querySelector('#aim-feedback span'), fpsDisplay:document.querySelector('#fps-display'), hitmarker: document.querySelector('#hitmarker'), damage: document.querySelector('#damage-number'),
  combo:document.querySelector('#movement-combo'), comboLevel:document.querySelector('#combo-level'), comboScore:document.querySelector('#combo-score'), comboMeter:document.querySelector('#combo-meter'), comboAction:document.querySelector('#combo-action'), masteryHud:document.querySelector('#mastery-hud'), masteryName:document.querySelector('#mastery-name'), masteryMeter:document.querySelector('#mastery-meter'), executionFeed:document.querySelector('#execution-feed'),
  prompt: document.querySelector('#prompt'), interaction: document.querySelector('#interaction'), status: document.querySelector('#status'), complete: document.querySelector('#complete'),
  restart: document.querySelector('#restart'), completeReturnLobby:document.querySelector('#complete-return-lobby'), accuracy: document.querySelector('#accuracy'), rounds: document.querySelector('#rounds'), completeStatOneLabel:document.querySelector('#complete-stat-one-label'), completeStatTwoLabel:document.querySelector('#complete-stat-two-label'),
  health: document.querySelector('#health'), healthBar: document.querySelector('#health-bar'), shield: document.querySelector('#shield'), shieldBar: document.querySelector('#shield-bar'), damageFlash: document.querySelector('#damage-flash'),
  death: document.querySelector('#death'), deathKills: document.querySelector('#death-kills'), deathCash: document.querySelector('#death-cash'), redeploy: document.querySelector('#redeploy'),
  countdown: document.querySelector('#countdown'), countdownNumber: document.querySelector('#countdown-number'), matchClock: document.querySelector('#match-clock'), clockPanel: document.querySelector('.match-clock'), completeTitle: document.querySelector('#complete-title'),
  arenaName: document.querySelector('#arena-name'), arenaHint:document.querySelector('.arena-display small'),
  lobbyCash: document.querySelector('#lobby-cash'), lobbyTabs: [...document.querySelectorAll('[data-lobby-tab]')], lobbyPanels: [...document.querySelectorAll('[data-panel]')], shopFilters: [...document.querySelectorAll('[data-shop-filter]')], lobbyShopGrid: document.querySelector('#lobby-shop-grid'), lobbyInventoryGrid: document.querySelector('#lobby-inventory-grid'), lobbyLoadout: document.querySelector('#lobby-loadout'), cosmeticInventory:document.querySelector('#cosmetic-inventory'), caseButtons:[...document.querySelectorAll('[data-buy-case]')], caseOffers:[...document.querySelectorAll('.case-offer')], crateResult: document.querySelector('#crate-result'),
  cosmeticTabs:[...document.querySelectorAll('[data-cosmetic-tab]')], cosmeticWeaponFilter:document.querySelector('#cosmetic-weapon-filter'), cosmeticRarityFilter:document.querySelector('#cosmetic-rarity-filter'), cosmeticCollectionFilter:document.querySelector('#cosmetic-collection-filter'), cosmeticOwnedFilter:document.querySelector('#cosmetic-owned-filter'), weaponInventoryPane:document.querySelector('#weapon-inventory-pane'), cosmeticInventoryPane:document.querySelector('#cosmetic-inventory-pane'), cosmeticCatalogGrid:document.querySelector('#cosmetic-catalog-grid'), cosmeticShopTabs:[...document.querySelectorAll('[data-cosmetic-shop]')], cosmeticShopGrid:document.querySelector('#cosmetic-shop-grid'), cosmeticShards:document.querySelector('#cosmetic-shards'), kitKeyCount:document.querySelector('#kit-key-count'), vaultKeyCount:document.querySelector('#vault-key-count'),
  profileCallsign:document.querySelector('#profile-callsign'), profileLevel:document.querySelector('#profile-level'), profileXpBar:document.querySelector('#profile-xp-bar'), profilePanelCallsign:document.querySelector('#profile-panel-callsign'), profileStats:document.querySelector('#profile-stats'), editCallsign:document.querySelector('#edit-callsign'),
  unopenedCrates:document.querySelector('#unopened-crates'), audioToggle:document.querySelector('#audio-toggle'), fullscreenToggle:document.querySelector('#fullscreen-toggle'), settingsShortcut:document.querySelector('#settings-shortcut'), settingsFullscreen:document.querySelector('#settings-fullscreen'), resetSettings:document.querySelector('#reset-settings'), settingsInputs:[...document.querySelectorAll('[data-setting]')],
  reactor:document.querySelector('#resonance-reactor'), notifications:document.querySelector('#lobby-notifications'), loadoutReady:document.querySelector('#loadout-ready'), lobbyModeName:document.querySelector('#lobby-mode-name'),
  playRouteModal:document.querySelector('#play-route-modal'), playRouteOverview:document.querySelector('#play-route-overview'), mainMapRoute:document.querySelector('#main-map-route'), duelRoute:document.querySelector('#duel-route'), playRouteClose:document.querySelector('#play-route-close'), mainMapBack:document.querySelector('#main-map-route-back'), duelBack:document.querySelector('#duel-route-back'), mainRouteButtons:[...document.querySelectorAll('[data-match-route="main"]')], mainMapButtons:[...document.querySelectorAll('[data-main-map]')], duelRouteButtons:[...document.querySelectorAll('[data-match-route="duels"]')], minigameRouteButtons:[...document.querySelectorAll('[data-match-route="minigames"]')], duelSizeButtons:[...document.querySelectorAll('[data-duel-size]')],
  multiplayerPanel:document.querySelector('#private-match-panel'), multiplayerName:document.querySelector('#multiplayer-name'), multiplayerRoomCode:document.querySelector('#private-room-code'), multiplayerCodeDisplay:document.querySelector('#private-room-code-display'), multiplayerRoomResult:document.querySelector('#private-room-result'), multiplayerStatus:document.querySelector('#multiplayer-status'), multiplayerConnectionLight:document.querySelector('#multiplayer-connection-light'), createPrivateMatch:document.querySelector('#create-private-match'), joinPrivateMatch:document.querySelector('#join-private-match'), copyPrivateRoomCode:document.querySelector('#copy-private-room-code'), cancelPrivateMatch:document.querySelector('#cancel-private-match'),
  playModeButtons:[...document.querySelectorAll('[data-play-mode]')], openShop:document.querySelector('[data-open-shop]'),
  heroCanvas:document.querySelector('#lobby-weapon-canvas'), heroFamily:document.querySelector('#hero-family'), heroWeaponName:document.querySelector('#hero-weapon-name'), heroCosmetic:document.querySelector('#hero-cosmetic'), heroScope:document.querySelector('#hero-scope'), heroBarrel:document.querySelector('#hero-barrel'), heroMagazine:document.querySelector('#hero-magazine'), heroTrait:document.querySelector('#hero-trait'), inspectWeapon:document.querySelector('#inspect-weapon'), changeLoadout:document.querySelector('#change-loadout'), randomizePreview:document.querySelector('#randomize-preview'), favoritePreview:document.querySelector('#favorite-preview'),
  liveLoadout:document.querySelector('#lobby-live-loadout'), buildSummary:document.querySelector('#lobby-build-summary'), abilitySummary:document.querySelector('#lobby-ability-summary'), passiveSummary:document.querySelector('#lobby-passive-summary'),
  featured:{ panel:document.querySelector('#featured-weapon-panel'), prev:document.querySelector('#featured-prev'), next:document.querySelector('#featured-next'), className:document.querySelector('#featured-class'), name:document.querySelector('#featured-name'), description:document.querySelector('#featured-description'), damage:document.querySelector('#featured-damage'), rate:document.querySelector('#featured-rate'), mag:document.querySelector('#featured-mag'), range:document.querySelector('#featured-range'), price:document.querySelector('#featured-price'), inspect:document.querySelector('#featured-inspect'), buy:document.querySelector('#featured-buy') },
  challengeList:document.querySelector('#challenge-list'), challengeReset:document.querySelector('#challenge-reset'),
  collectionGrid:document.querySelector('#collection-grid'), collectionSummary:document.querySelector('#collection-summary'), collectionFilters:[...document.querySelectorAll('[data-collection-filter]')], fragmentBalance:document.querySelector('#fragment-balance'),
  factoryStatus:document.querySelector('#factory-status'), factoryLevel:document.querySelector('#factory-level'), factoryBestWave:document.querySelector('#factory-best-wave'), factoryRepairs:document.querySelector('#factory-repairs'), factoryFragments:document.querySelector('#factory-fragments'), factoryDeploy:document.querySelector('#factory-deploy'), factoryEmergencyName:document.querySelector('#factory-emergency-name'), factoryEmergencyDescription:document.querySelector('#factory-emergency-description'), factoryEmergencyProgress:document.querySelector('#factory-emergency-progress'), factoryResearchList:document.querySelector('#factory-research-list'), factoryObjective:document.querySelector('#factory-objective'), factoryWave:document.querySelector('#factory-wave'), factoryHealth:document.querySelector('#factory-health'), factoryEmergencyHud:document.querySelector('#factory-emergency-hud'),
  trophyWall:document.querySelector('#trophy-wall'),
  rangePanel:document.querySelector('#firing-range-panel'), exitRange:document.querySelector('#exit-firing-range'), rangeDistanceLabel:document.querySelector('#range-distance-label'), rangeDistanceButtons:[...document.querySelectorAll('[data-range-distance]')], rangeMoving:document.querySelector('#range-moving-targets'), rangeReset:document.querySelector('#range-reset-stats'), rangeAccuracy:document.querySelector('#range-accuracy'), rangeEliminations:document.querySelector('#range-eliminations'), rangeClearTime:document.querySelector('#range-clear-time'),
  lobbyParkourPanel:document.querySelector('#lobby-parkour-panel'), exitLobbyParkour:document.querySelector('#exit-lobby-parkour'), restartLobbyParkour:document.querySelector('#restart-lobby-parkour'), parkourRunTime:document.querySelector('#parkour-run-time'), parkourBestTime:document.querySelector('#parkour-best-time'), chillSecretCount:document.querySelector('#chill-secret-count'),
  parkourPanel:document.querySelector('#parkour-panel'), parkourCourseName:document.querySelector('#parkour-course-name'), parkourVariant:document.querySelector('#parkour-variant'), parkourCheckpoint:document.querySelector('#parkour-checkpoint'), parkourTime:document.querySelector('#parkour-time'), parkourBest:document.querySelector('#parkour-best'), parkourPace:document.querySelector('#parkour-pace'), parkourCollectibles:document.querySelector('#parkour-collectibles'), parkourProgress:document.querySelector('#parkour-progress-bar'), exitParkour:document.querySelector('#exit-parkour'), resetParkour:document.querySelector('#reset-parkour'),
  unboxing:document.querySelector('#unboxing'), unboxSpinner:document.querySelector('#unbox-spinner'), caseStage:document.querySelector('#case-opening-stage'), spinnerTrack:document.querySelector('#spinner-track'), unboxReveal:document.querySelector('#unbox-reveal'), rewardCard:document.querySelector('#reward-card'), rewardIcon:document.querySelector('#reward-icon'), rewardName:document.querySelector('#reward-name'), rewardSlot:document.querySelector('#reward-slot'), rewardRarity:document.querySelector('#reward-rarity'), rewardDuplicate:document.querySelector('#reward-duplicate'), rewardParticles:document.querySelector('#reward-particles'), equipReward:document.querySelector('#equip-reward'), previewReward:document.querySelector('#preview-reward'), openAnother:document.querySelector('#open-another'), closeReward:document.querySelector('#close-reward'), skipUnbox:document.querySelector('#skip-unbox'), rewardKitContents:document.querySelector('#reward-kit-contents'),
  abilityOptions:[...document.querySelectorAll('[data-ability]')], passiveOptions:[...document.querySelectorAll('[data-passive]')], abilityDockOptions:[...document.querySelectorAll('[data-ability-dock]')], abilityNames:{q:document.querySelector('#ability-name-q'),e:document.querySelector('#ability-name-e')}, abilityStates:{q:document.querySelector('#ability-state-q'),e:document.querySelector('#ability-state-e')}, abilityCooldowns:{q:document.querySelector('#ability-cooldown-q'),e:document.querySelector('#ability-cooldown-e')}, passiveIndicators:document.querySelector('#passive-indicators'), camoOverlay:document.querySelector('#camo-overlay'),
  modeDisplay: document.querySelector('#mode-display'), modeName: document.querySelector('#mode-name'), modeHint:document.querySelector('#mode-display small'), controlsHint:document.querySelector('.controls-hint'), cashHint:document.querySelector('.cash-display small'),
  armory: document.querySelector('#armory'), armoryGrid: document.querySelector('#armory-grid'), armoryCash: document.querySelector('#armory-cash'), closeArmory: document.querySelector('#close-armory'),
  radar: document.querySelector('#radar'), radarPlayer:document.querySelector('.radar-player'), blips: [], enemyBlips: [],
  weaponSlots: [document.querySelector('#weapon-slot-0'), document.querySelector('#weapon-slot-1'), document.querySelector('#weapon-slot-2'), document.querySelector('#weapon-slot-3')]
};

ui.caseButtons.forEach(button=>{
  const price=CASES[button.dataset.buyCase]?.cost??ORIGINAL_CRATE_PRICES[button.dataset.buyCase];
  if(price===undefined)return;
  button.dataset.cost=String(price);
  const priceLabel=button.querySelector('b');
  if(priceLabel&&price>0&&button.dataset.buyCase!=='kit')priceLabel.textContent=`◆${price}`;
});
const caseSpotlightPrice=ui.openShop?.querySelector('b');
if(caseSpotlightPrice)caseSpotlightPrice.textContent=`FROM ◆${Math.min(...Object.values(CASES).filter(item=>item.cost>0).map(item=>item.cost))}`;

dummies.forEach(() => { const blip = document.createElement('span'); blip.className = 'radar-blip'; ui.radar.append(blip); ui.blips.push(blip); });
enemies.forEach(() => { const blip = document.createElement('span'); blip.className = 'radar-blip enemy'; ui.radar.append(blip); ui.enemyBlips.push(blip); });

const state = {
  started: false, locked: false, softMouseLook:false, position: new THREE.Vector3(0, 1.75, 235), velocity: new THREE.Vector3(), vault:null, wallRunning:false, traversal:createTraversalState(), onlineSnapshot:null,
  yaw: 0, pitch: 0, eyeHeight: 1.75, onGround: true, crouching: false, sliding: false, slideUntil: 0, health: 100, shield: 50, reboundTriggered:false, dead: false, hostileMode: false, firingRange:false, lobbyParkour:false, lobbyParkourStartedAt:0, lobbyParkourFinished:false, lobbyParkourCheckpoint:0, rangeMovingTargets:false, rangeDistance:60, rangeStartedAt:0, rangeKills:0, rangeLastClear:0, airbornePeakY:1.75, matchHeadshots:0, activeArena: 0, weaponIndex: quickSlots[0], reloading: false, reloadTimer: null, mouseDown: false, aiming: false, aimBlend:0, aimProfile:'hip', secondaryAction:false, throwPreview:false, placementPreview:false, placementValid:false, placementPoint:new THREE.Vector3(), crosshairKick:0, spawnGraceUntil:0, lastShot: 0, lastHazardDamage:0, lastDamageAt:0, lastEnemyShotAt:0, lastLaunchAt:0, matchDeaths:0, swapUntil:0, abilityCooldownEnds:{q:0,e:0}, abilityVisual:null, camoUntil:0, grapple:null, rewind:null, velocityBoostUntil:0, comboReloadUntil:0, lastRampBoost:0, lastSlideCancelAt:0, lastGrappleReleaseAt:0, lastThermalAt:0, shots: 0, hits: 0, kills: 0, enemyKills: 0, targets: dummies.length, hostiles: enemies.length, nearestLoot: null, nearestWire: null, nearestGnome:null, nearestControl:null, nearestPickup:null, nearestLobbyControl:null, zipline: null, impulseUntil: 0, speedBoostUntil:0, healRemaining:0, healEnds:0, shake: 0, armoryOpen: false, completed: false, countdownActive:false, countdownTimer:null, matchStart:0, matchDuration:300000, chargingGun:null, chargeStarted:0, saberGuardUntil:0, saberCooldownUntil:0, phaseBeacon:null, revealedUntil:0, gameMode:'contract', factoryDefense:null, parkour:null, shotSequence:0,
};
let selectedLobbySlot = 0;
let selectedAbilityDock = 'q';
let activeShopFilter = 'all';
let activeCollectionFilter = 'all';
let activeCosmeticTab = 'weapons';
let activeCosmeticShop = 'featured';
let selectedPlayMode = 'main';
let featuredWeaponIndex = Math.max(0, loadout.findIndex(gun=>gun.id==='specter'));
let crateOpening = false;
let pendingCaseId = null;
let pendingTransactionId = null;
let pendingRevealTimer = 0;
let selectedDuelSize = 1;
let selectedParkourCourse = 0;
const parkourGates=[];
const parkourCollectibles=[];
let parkourGhost=null;
let parkourVariantVisual=null;
const parkourRouteCatalog=PARKOUR_ROUTES;
const keys = new Set();
const clock = new THREE.Clock();
const cosmeticRewardService=createOfflineRewardService({
  readState:()=>progress.cosmeticState,
  writeState:value=>{progress.cosmeticState=value;saveProgress();},
  readBalance:()=>progress.cash,
  writeBalance:value=>{progress.cash=value;saveProgress();},
  random:secureRandom,
});
for(const transaction of Object.values(progress.cosmeticState.transactions))if(transaction.status==='selected')cosmeticRewardService.finalizeCase(transaction.id);
const remotePlayers = new Map();
const onlineMatch = new OnlineMatchClient({
  onStatus:message=>setMultiplayerStatus(message),
  onPhase:(phase,serverState)=>handleOnlinePhase(phase,serverState),
  onShot:event=>handleOnlineShot(event),
  onElimination:event=>handleOnlineElimination(event),
  onPlayerRemoved:sessionId=>removeRemotePlayer(sessionId),
  onMatchEnd:event=>completeOnlineMatch(event),
  onDisconnected:code=>handleOnlineDisconnect(code),
});
const raycaster = new THREE.Raycaster();
const enemyRaycaster = new THREE.Raycaster();
const scopeDebugProjection=new THREE.Vector3();
const voidZones = [];
const acousticWaves = [];
const magnetLinks = [];
const activeWires = [];
const thrownExplosives = [];
const blastEffects = [];
const gravityWells = [];
const shockMines = [];
const activeDecoys = [];
const hardlightRamps = [];
const fractureMarks = [];
const hardlightWalls = [];
const utilityFields = [];
const ammoSynths = [];
const chaosParticles = [];
const temporaryBeams = [];
const tracerPool=[];
const casingPool=[];
const impactPool=[];
const killFxPool=[];
const killFxLedger=new Set();
const killFxViewDirection=new THREE.Vector3(),killFxToEffect=new THREE.Vector3();
let tracerCursor=0,casingCursor=0,impactCursor=0;
let killFxCursor=0;
const movementCombo = { score:0, tier:0, expiresAt:0, lastActionAt:0, lastPosition:new THREE.Vector3(), lastDirection:new THREE.Vector3(), actionTimes:new Map(), rewarded:new Set(), styleScore:0 };
const sharedBlastGeometry=new THREE.SphereGeometry(1,14,9);
const sharedChaosBoxGeometry=new THREE.BoxGeometry(.1,.1,.18);
const sharedChaosSphereGeometry=new THREE.SphereGeometry(.075,6,4);
const sharedDebrisGeometry=new THREE.BoxGeometry(.34,.22,.18);
const sharedCasingGeometry=new THREE.CylinderGeometry(.025,.025,.12,7);
const sharedCasingMaterial=new THREE.MeshStandardMaterial({color:0xc58a39,metalness:.82,roughness:.3});
const sharedImpactGeometry=new THREE.IcosahedronGeometry(.075,0);
for(let index=0;index<40;index++){
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.BufferAttribute(new Float32Array(6),3));
  const line=new THREE.Line(geometry,new THREE.LineBasicMaterial({color:ART_PALETTE.interactive,transparent:true,opacity:.95,blending:THREE.AdditiveBlending,depthWrite:false}));line.visible=false;line.frustumCulled=false;world.add(line);tracerPool.push({line,expires:0});
}
for(let index=0;index<20;index++){
  const casing=new THREE.Mesh(sharedCasingGeometry,sharedCasingMaterial);casing.visible=false;casing.castShadow=false;world.add(casing);casingPool.push({mesh:casing,velocity:new THREE.Vector3(),life:0});
}
for(let index=0;index<32;index++){
  const impact=new THREE.Mesh(sharedImpactGeometry,new THREE.MeshBasicMaterial({color:ART_PALETTE.interactive,transparent:true,opacity:0,blending:THREE.AdditiveBlending,depthWrite:false}));impact.visible=false;world.add(impact);impactPool.push({mesh:impact,life:0});
}
const sharedKillFxRingGeometry=new THREE.TorusGeometry(1,.045,7,28);
const sharedKillFxCoreGeometry=new THREE.IcosahedronGeometry(.42,1);
const sharedKillFxParticleGeometry=new THREE.BoxGeometry(.13,.13,.13);
for(let poolIndex=0;poolIndex<4;poolIndex++){
  const group=new THREE.Group();group.visible=false;group.frustumCulled=false;world.add(group);
  const ringMaterial=new THREE.MeshBasicMaterial({color:0x50e5ff,transparent:true,opacity:0,depthWrite:false,blending:THREE.AdditiveBlending});const ring=new THREE.Mesh(sharedKillFxRingGeometry,ringMaterial);ring.rotation.x=Math.PI/2;group.add(ring);
  const ringB=new THREE.Mesh(sharedKillFxRingGeometry,ringMaterial.clone());ringB.rotation.y=Math.PI/2;group.add(ringB);
  const coreMaterial=new THREE.MeshBasicMaterial({color:0x9b6cff,transparent:true,opacity:0,depthWrite:false,blending:THREE.AdditiveBlending});const core=new THREE.Mesh(sharedKillFxCoreGeometry,coreMaterial);group.add(core);
  const particles=[];for(let index=0;index<22;index++){const material=new THREE.MeshBasicMaterial({color:0x50e5ff,transparent:true,opacity:0,depthWrite:false,blending:THREE.AdditiveBlending});const mesh=new THREE.Mesh(sharedKillFxParticleGeometry,material);mesh.visible=false;group.add(mesh);particles.push({mesh,seed:new THREE.Vector3()});}
  killFxPool.push({group,ring,ringB,core,particles,started:0,duration:0,mode:'neonEcho',budget:0,remote:false});
}
const bananaPeels = [];
const gnomeTurrets = [];
const shoppingCarts = [];
const trajectoryPositions = new Float32Array(36 * 3);
const trajectoryGeometry = new THREE.BufferGeometry();
trajectoryGeometry.setAttribute('position', new THREE.BufferAttribute(trajectoryPositions, 3));
trajectoryGeometry.setDrawRange(0, 0);
const trajectoryDots = new THREE.Points(trajectoryGeometry, new THREE.PointsMaterial({ color:0xffe36b, size:.24, transparent:true, opacity:.9, sizeAttenuation:true }));
trajectoryDots.visible = false; trajectoryDots.frustumCulled = false; world.add(trajectoryDots);
const trajectoryLanding=new THREE.Mesh(new THREE.RingGeometry(.36,.52,24),new THREE.MeshBasicMaterial({color:0xffe36b,transparent:true,opacity:.88,side:THREE.DoubleSide,depthWrite:false}));
trajectoryLanding.rotation.x=-Math.PI/2;trajectoryLanding.visible=false;trajectoryLanding.frustumCulled=false;world.add(trajectoryLanding);
const placementPreview=new THREE.Mesh(new THREE.RingGeometry(.55,.78,28),new THREE.MeshBasicMaterial({color:0x67e8a5,transparent:true,opacity:.72,side:THREE.DoubleSide,depthWrite:false}));
placementPreview.rotation.x=-Math.PI/2;placementPreview.visible=false;placementPreview.frustumCulled=false;world.add(placementPreview);

const masteryThresholds=[0,150,400,800,1350,2100,3000,4100,5400,7000];
const masteryRewards={2:'WEAPON CHARM',3:'ALTERNATE COLOR',5:'INSPECT ANIMATION',7:'PROJECTILE TRAIL',10:'ANIMATED MASTERY SKIN'};
const fragmentBlueprintCatalog=[
  {id:'singularity',cost:12},{id:'hybrid-bolt',cost:10},{id:'rubber-chicken-railgun',cost:9},{id:'pizza-party-launcher',cost:7},{id:'comet-shorty',cost:6},
];
fragmentBlueprintCatalog.forEach(entry=>{const gun=loadout.find(item=>item.id===entry.id);if(gun)gun.fragmentCost=entry.cost;});
const executionCatalog={
  airHeadshot:'AIRBORNE HEADSHOT',longScoped:'LONG-RANGE PRECISION',secondary:'SECONDARY FINISHER',meleeGrapple:'GRAPPLE EXECUTION',slideCancel:'SLIDE-CANCEL FINISH',throughCover:'WALLBREAKER',piercingDouble:'DOUBLE PIERCE',maxCombo:'PERFECT RESONANCE',lastRound:'FINAL ROUND',thermal:'THERMAL EXECUTION',movingPlatform:'MOVING PLATFORM SHOT',environmental:'ENVIRONMENTAL ELIMINATION',ricochet:'BANK SHOT',deflection:'RETURN TO SENDER',
};
const factoryEmergencyCatalog=[
  {name:'CONVEYOR JAM',description:'Clear the obstruction at the orange Assembly Line terminal.',control:'conveyor'},
  {name:'POWER FAILURE',description:'Restore power at the cyan generator terminal.',control:'power'},
  {name:'COOLING PIPE BREAK',description:'Seal the leaking steam manifold before storage overheats.',control:'steam'},
  {name:'RESONANCE LEAK',description:'Stabilize the violet reactor console before the next wave.',control:'reactor'},
];

function masteryFor(gun){const stored=progress.weaponMastery[gun.id]||{};return {xp:Math.max(0,Number(stored.xp)||0)};}
function masteryLevelForXp(xp){let level=1;for(let index=1;index<masteryThresholds.length;index++)if(xp>=masteryThresholds[index])level=index+1;return level;}
function masteryProgress(gun){const xp=masteryFor(gun).xp;const level=masteryLevelForXp(xp);const floor=masteryThresholds[level-1]||0;const ceiling=masteryThresholds[level]||floor;return {xp,level,ratio:level>=10?1:(xp-floor)/Math.max(1,ceiling-floor),next:ceiling};}
function gainWeaponXp(gun,amount,reason='COMBAT'){
  if(!gun||amount<=0)return;const before=masteryProgress(gun);const entry=progress.weaponMastery[gun.id]||{xp:0};entry.xp=Math.max(0,(Number(entry.xp)||0)+Math.round(amount));progress.weaponMastery[gun.id]=entry;progress.discoveredWeapons.add(gun.id);const after=masteryProgress(gun);
  if(after.level>before.level){const reward=masteryRewards[after.level]||'GOLDEN BADGE PROGRESS';if([3,7,10].includes(after.level)){progress.blueprintFragments++;lobbyNotify(`MASTERY FRAGMENT // ${gun.name}`,'rare');}lobbyNotify(`${gun.name} // MASTERY ${after.level} // ${reward}`,'success');pulseReactor('success');}
  if(gun===loadout[state.weaponIndex])updateMasteryHud();scheduleProgressSave();
}
function updateMasteryHud(){if(!ui.masteryHud)return;const gun=loadout[state.weaponIndex];const mastery=masteryProgress(gun);setTextIfChanged(ui.masteryName,`${gun.name} // LV ${mastery.level}`);setStyleIfChanged(ui.masteryMeter,'width',`${Math.round(mastery.ratio*100)}%`);}
function awardBlueprintFragments(amount,reason){if(amount<=0)return;progress.blueprintFragments+=amount;lobbyNotify(`+${amount} BLUEPRINT FRAGMENT${amount===1?'':'S'} // ${reason}`,'rare');scheduleProgressSave();renderCollectionBook();renderFactoryPanel();}

const comboTiers=[{name:'FLOW',score:0},{name:'ACCELERATED',score:90},{name:'OVERDRIVE',score:220},{name:'HYPERSPEED',score:420},{name:'PERFECT RESONANCE',score:700}];
function comboTierForScore(score){let tier=0;comboTiers.forEach((entry,index)=>{if(score>=entry.score)tier=index;});return tier;}
function addMovementCombo(action,points=45,now=performance.now()){
  const previous=movementCombo.actionTimes.get(action)||0;if(now-previous<520)return;movementCombo.actionTimes.set(action,now);const previousTier=movementCombo.tier;movementCombo.score=Math.min(999,movementCombo.score+points);movementCombo.styleScore+=points;movementCombo.tier=comboTierForScore(movementCombo.score);movementCombo.expiresAt=now+3300;movementCombo.lastActionAt=now;
  state.abilityCooldownEnds.q=Math.max(now,state.abilityCooldownEnds.q-points*5);state.abilityCooldownEnds.e=Math.max(now,state.abilityCooldownEnds.e-points*5);state.comboReloadUntil=now+(movementCombo.tier>=2?3000:1200);
  if(movementCombo.tier>previousTier&&!movementCombo.rewarded.has(movementCombo.tier)){movementCombo.rewarded.add(movementCombo.tier);addCash(10+movementCombo.tier*10,`${comboTiers[movementCombo.tier].name} STYLE`);}
  updateMovementComboHud(action);
}
function breakMovementCombo(reason='CHAIN ENDED'){
  if(movementCombo.score>0){progress.stats.bestMovementCombo=Math.max(progress.stats.bestMovementCombo,movementCombo.score);progress.stats.totalStyleScore+=movementCombo.styleScore;scheduleProgressSave();}
  movementCombo.score=0;movementCombo.tier=0;movementCombo.expiresAt=0;movementCombo.styleScore=0;movementCombo.rewarded.clear();updateMovementComboHud(reason);
}
function updateMovementComboHud(action='BUILD MOMENTUM'){
  if(!ui.combo)return;const tier=comboTiers[movementCombo.tier];ui.combo.classList.toggle('active',movementCombo.score>0);ui.combo.dataset.tier=String(movementCombo.tier+1);setTextIfChanged(ui.comboLevel,tier.name);setTextIfChanged(ui.comboScore,movementCombo.score);const next=comboTiers[movementCombo.tier+1]?.score||999;const previous=tier.score;setStyleIfChanged(ui.comboMeter,'width',`${THREE.MathUtils.clamp((movementCombo.score-previous)/Math.max(1,next-previous)*100,0,100)}%`);setTextIfChanged(ui.comboAction,action.replaceAll('_',' '));
}
function updateMovementCombo(now){if(!state.started||state.dead)return;if(movementCombo.score&&now>=movementCombo.expiresAt)breakMovementCombo('FLOW LOST');const horizontal=Math.hypot(state.velocity.x,state.velocity.z);if(movementCombo.score&&horizontal<.6&&now-movementCombo.lastActionAt>1250)breakMovementCombo('MOMENTUM STOPPED');if(!state.onGround&&horizontal>11){const current=new THREE.Vector3(state.velocity.x,0,state.velocity.z).normalize();if(movementCombo.lastDirection.lengthSq()&&current.dot(movementCombo.lastDirection)<.3)addMovementCombo('AERIAL DIRECTION SHIFT',38,now);movementCombo.lastDirection.copy(current);}else if(state.onGround)movementCombo.lastDirection.set(0,0,0);}

const executionTimes=new Map();
function recordExecution(id,gun=loadout[state.weaponIndex]){
  const label=executionCatalog[id];const now=performance.now();if(!label||now-(executionTimes.get(id)||0)<900)return;executionTimes.set(id,now);const count=(progress.executions[id]||0)+1;progress.executions[id]=count;progress.stats.executions++;addCash(35,`EXECUTION // ${label}`);gainWeaponXp(gun,55,'EXECUTION');if(count===1)awardBlueprintFragments(1,label);
  if(ui.executionFeed){const toast=document.createElement('div');toast.className='execution-toast';toast.innerHTML=`EXECUTION // <b>${label}</b> // +◆35`;ui.executionFeed.replaceChildren(toast);setTimeout(()=>toast.remove(),2300);}scheduleProgressSave();
}

function renderCollectionBook(){
  if(!ui.collectionGrid)return;const owned=loadout.filter(gun=>progress.unlocked.has(gun.id)).length;const discovered=loadout.filter(gun=>progress.discoveredWeapons.has(gun.id)).length;const mastered=loadout.filter(gun=>masteryProgress(gun).level>=10).length;const mapDiscoveries=Object.values(progress.discoveries).reduce((sum,items)=>sum+(Array.isArray(items)?items.length:0),0);ui.collectionSummary.innerHTML=`<span>DISCOVERED<b>${discovered} / ${loadout.length}</b></span><span>OWNED<b>${owned}</b></span><span>MAX MASTERY<b>${mastered}</b></span><span>EXECUTIONS<b>${progress.stats.executions}</b></span><span>MAP LOCATIONS<b>${mapDiscoveries} / 12</b></span>`;setTextIfChanged(ui.fragmentBalance,progress.blueprintFragments);ui.collectionGrid.replaceChildren();
  const familyColor={NORMAL:'#6bbcff',WEIRD:'#50e5ff',CRAZY:'#ff7043',CUSTOM:'#a96cff',SILLY:'#ff4fba',GEAR:'#67e8a5',PRIMARY:'#50e5ff',SECONDARY:'#ff4fba',MELEE:'#67e8a5',OTHER:'#ffc857'};
  loadout.filter(gun=>activeCollectionFilter==='all'||gun.category.toLowerCase()===activeCollectionFilter).forEach(gun=>{const found=progress.discoveredWeapons.has(gun.id);const ownedGun=progress.unlocked.has(gun.id);const mastery=masteryProgress(gun);const card=document.createElement('article');card.className=`collection-card ${ownedGun?'owned':found?'discovered':'missing'}`;card.style.setProperty('--category',familyColor[gun.category]||'#50e5ff');card.innerHTML=`${gun.fragmentCost&&!ownedGun?`<b class="blueprint-lock">${progress.blueprintFragments}/${gun.fragmentCost} FRAG</b>`:''}<small>${found?`${gun.category} // ${gun.weaponClass}`:'UNIDENTIFIED BLUEPRINT'}</small><h3>${found?gun.name:'ENCRYPTED ITEM'}</h3><em>${ownedGun?'OWNED':found?'DISCOVERED // NOT OWNED':'FIND OR TEST TO DISCOVER'}</em><div class="mastery-track"><i style="width:${mastery.ratio*100}%"></i></div><strong>MASTERY ${mastery.level} // ${mastery.xp} XP</strong>`;ui.collectionGrid.append(card);});
}
const mapDiscoveryCatalog={
  vertigo:[{id:'centerSpire',name:'CENTER SPIRE',position:new THREE.Vector3(-220,24,49)},{id:'sunkenNexus',name:'SUNKEN NEXUS',position:new THREE.Vector3(-220,0,5)},{id:'westSpine',name:'WEST SPINE',position:new THREE.Vector3(-300,6,0)},{id:'nexusControl',name:'GRAVITY CONTROL',position:new THREE.Vector3(-220,0,5)}],
  outpost:[{id:'fallenTitan',name:'FALLEN TITAN',position:new THREE.Vector3(0,8,0)},{id:'canopy',name:'CANOPY WALK',position:new THREE.Vector3(0,18,-66)},{id:'ravine',name:'RAVINE CACHE',position:new THREE.Vector3(0,0,-10)},{id:'sporeRoute',name:'SPORE ROUTE',position:new THREE.Vector3(-18,0,58)}],
  foundry:[{id:'assembly',name:'ASSEMBLY LINE',position:new THREE.Vector3(220,9,0)},{id:'vents',name:'VENTILATION SHAFT',position:new THREE.Vector3(290,5,0)},{id:'smelter',name:'SMELTER CROSSING',position:new THREE.Vector3(150,4.5,0)},{id:'factoryTerminals',name:'MAINTENANCE BANK',position:new THREE.Vector3(215,0,63)}],
};
function updateMapDiscoveries(now){if(now<(state.nextDiscoveryCheck||0))return;state.nextDiscoveryCheck=now+500;const arena=arenaDefinitions[state.activeArena];const entries=mapDiscoveryCatalog[arena.id]||[];const found=new Set(progress.discoveries[arena.id]||[]);for(const entry of entries){if(found.has(entry.id)||state.position.distanceTo(entry.position)>7)continue;found.add(entry.id);progress.discoveries[arena.id]=[...found];addCash(30,`DISCOVERY // ${entry.name}`);lobbyNotify(`MAP DISCOVERY // ${entry.name}`,'info');if(found.size===entries.length)awardBlueprintFragments(2,`${arena.name} PAGE COMPLETE`);scheduleProgressSave();}}
function renderFactoryPanel(){
  if(!ui.factoryStatus)return;const emergency=factoryEmergencyCatalog[progress.factory.emergencyIndex%factoryEmergencyCatalog.length];setTextIfChanged(ui.factoryStatus,progress.factory.emergencyProgress>0?'MAINTENANCE IN PROGRESS':'SYSTEMS READY');setTextIfChanged(ui.factoryLevel,String(progress.factory.level).padStart(2,'0'));setTextIfChanged(ui.factoryBestWave,String(progress.factory.bestWave).padStart(2,'0'));setTextIfChanged(ui.factoryRepairs,String(progress.factory.repairs).padStart(2,'0'));setTextIfChanged(ui.factoryFragments,String(progress.blueprintFragments).padStart(2,'0'));setTextIfChanged(ui.factoryEmergencyName,emergency.name);setTextIfChanged(ui.factoryEmergencyDescription,emergency.description);setStyleIfChanged(ui.factoryEmergencyProgress,'width',`${progress.factory.emergencyProgress}%`);
  ui.factoryResearchList.replaceChildren();fragmentBlueprintCatalog.forEach(entry=>{const gun=loadout.find(item=>item.id===entry.id);if(!gun)return;const owned=progress.unlocked.has(entry.id);const row=document.createElement('div');row.className='research-row';row.innerHTML=`<span>${gun.name}<small>${owned?'ASSEMBLED':`${progress.blueprintFragments} / ${entry.cost} FRAGMENTS`}</small></span><button type="button" ${owned||progress.blueprintFragments<entry.cost?'disabled':''}>${owned?'OWNED':'RESEARCH'}</button>`;row.querySelector('button').addEventListener('click',()=>{if(owned||progress.blueprintFragments<entry.cost)return;progress.blueprintFragments-=entry.cost;progress.unlocked.add(entry.id);progress.discoveredWeapons.add(entry.id);saveProgress();renderFactoryPanel();renderCollectionBook();renderLobbyShop();lobbyNotify(`BLUEPRINT ASSEMBLED // ${gun.name}`,'success');});ui.factoryResearchList.append(row);});
}

function showMouseLockPrompt(message='CLICK GAME TO CAPTURE MOUSE // MOVE TO LOOK // ESC RELEASES') {
  if(!ui.prompt)return;ui.prompt.textContent=message;ui.prompt.classList.toggle('show',state.started&&!state.locked&&!state.completed&&!state.armoryOpen&&!state.dead);
}
function showMouseLockGate(){
  state.softMouseLook=false;state.locked=document.pointerLockElement===canvas;document.body.classList.toggle('mouse-locked',state.locked);ui.mouseLockGate?.classList.toggle('hidden',!state.started||state.locked||state.completed||state.armoryOpen||state.dead);if(!state.locked)showMouseLockPrompt();
}
function enableFallbackMouseLook(){
  if(!state.started||state.completed||state.armoryOpen||state.dead)return;state.softMouseLook=true;state.locked=true;ui.mouseLockGate?.classList.add('hidden');ui.prompt?.classList.remove('show');document.body.classList.add('mouse-locked');ui.status.textContent='MOUSE LOOK ACTIVE // BROWSER FALLBACK';canvas.focus({preventScroll:true});
}
function requestLock() {
  if (!state.started || state.completed || state.armoryOpen || state.dead) return;
  if(document.pointerLockElement===canvas)return;
  canvas.focus({preventScroll:true});
  try{
    const attempt = canvas.requestPointerLock();
    if (attempt?.catch) attempt.catch(enableFallbackMouseLook);
  }catch{enableFallbackMouseLook();}
}
function selectArena(index, announce = true) {
  clearTraversalInput({grounded:true});
  state.activeArena = (index + arenaDefinitions.length) % arenaDefinitions.length;
  syncArenaVisibility(state.activeArena);
  const arena = arenaDefinitions[state.activeArena];
  state.eyeHeight = 1.75; state.crouching = false; state.sliding = false;state.vault=null;
  state.position.copy(arena.spawn); state.position.y = groundHeightAt(state.position.x, state.position.z) + state.eyeHeight;
  state.velocity.set(0, 0, 0); state.yaw = 0; state.pitch = 0;
  if(state.started)state.spawnGraceUntil=performance.now()+2200;
  state.targets=dummies.filter(dummy=>dummy.arena===state.activeArena&&dummy.alive).length;state.hostiles=enemies.filter(enemy=>enemy.arena===state.activeArena&&enemy.alive).length;
  ui.targets.textContent=String(state.targets).padStart(2,'0');ui.enemies.textContent=String(state.hostiles).padStart(2,'0');
  ui.arenaName.textContent = arena.name;
  const atmosphere=ARENA_ATMOSPHERES[state.activeArena];
  skyUniforms.horizonColor.value.setHex(atmosphere.horizon);skyUniforms.zenithColor.value.setHex(atmosphere.zenith);skyUniforms.sunColor.value.setHex(atmosphere.sun);skyUniforms.sunDirection.value.set(...atmosphere.sunDirection).normalize();
  scene.fog.color.setHex(atmosphere.fog);scene.fog.density=SCENERY_CONFIG.fogDensity[state.activeArena];mats.sand.color.setHex(atmosphere.ground);sun.color.setHex(atmosphere.sun);
  sun.position.copy(skyUniforms.sunDirection.value).multiplyScalar(220);sun.position.y=Math.max(125,sun.position.y);
  if (announce && state.started) ui.status.textContent = `DEPLOYED // ${arena.name}`;
}
function formatTrialTime(milliseconds){
  if(!Number.isFinite(milliseconds)||milliseconds<0)return '—';
  const total=Math.max(0,milliseconds)/1000;const minutes=Math.floor(total/60);const seconds=(total-minutes*60).toFixed(2).padStart(5,'0');
  return minutes?`${minutes}:${seconds}`:seconds;
}
function parkourBestFor(course,assisted=progress.settings.parkourAssist){return (assisted?progress.stats.parkourAssistedBest:progress.stats.parkourBest)[course.id];}
function parkourCourseAt(index=selectedParkourCourse){return PARKOUR_COURSES[Math.min(PARKOUR_COURSES.length-1,Math.max(0,index))];}
function routeForVariant(courseIndex,variant){
  const route=parkourRouteCatalog[courseIndex];if(!variant?.modifiers?.reverse)return{spawn:[...route.spawn],checkpoints:route.checkpoints.map(point=>[...point])};
  return{spawn:[...route.checkpoints.at(-1)],checkpoints:[...route.checkpoints.slice(0,-1)].reverse().map(point=>[...point]).concat([[...route.spawn]])};
}
function disposeParkourObject(object){world.remove(object);object.traverse(child=>{child.geometry?.dispose?.();child.material?.dispose?.();});}
function clearParkourArtifacts(){
  for(const gate of parkourGates){world.remove(gate.group);gate.group.traverse(child=>{child.geometry?.dispose?.();child.material?.dispose?.();});}
  parkourGates.length=0;
  for(const collectible of parkourCollectibles)disposeParkourObject(collectible.group);parkourCollectibles.length=0;
  if(parkourGhost){disposeParkourObject(parkourGhost.mesh);parkourGhost=null;}
  if(parkourVariantVisual){disposeParkourObject(parkourVariantVisual);parkourVariantVisual=null;}
}
function createParkourGates(courseIndex,points){
  const course=parkourCourseAt(courseIndex);const color=new THREE.Color(PARKOUR_SURFACE_COLORS.checkpoint);
  points.forEach((point,index)=>{
    const group=new THREE.Group();const floor=groundHeightAt(point[0],point[1]);group.position.set(point[0],floor+1.8,point[1]);
    const ringMaterial=new THREE.MeshBasicMaterial({color,transparent:true,opacity:index===0?.95:.2,side:THREE.DoubleSide,depthWrite:false,blending:THREE.AdditiveBlending});
    const ring=new THREE.Mesh(new THREE.TorusGeometry(2.15,.13,8,30),ringMaterial);group.add(ring);
    const inner=new THREE.Mesh(new THREE.TorusGeometry(1.72,.025,6,24),new THREE.MeshBasicMaterial({color:0xffffff,transparent:true,opacity:index===0?.7:.12,depthWrite:false}));group.add(inner);
    const beam=new THREE.Mesh(new THREE.CylinderGeometry(.035,.035,6,6),new THREE.MeshBasicMaterial({color,transparent:true,opacity:index===0?.46:.08,depthWrite:false}));beam.position.y=1.2;group.add(beam);
    const next=points[index+1]||point;group.rotation.y=Math.atan2(next[0]-point[0],next[1]-point[1]);group.userData.arenaIndex=course.arena;world.add(group);parkourGates.push({group,ring,inner,beam,index});
  });
}
function createParkourCollectibles(trial){
  const count=trial.course.collectibleCount;const material=new THREE.MeshStandardMaterial({color:PARKOUR_SURFACE_COLORS.secret,emissive:0x8a5313,emissiveIntensity:1.2,metalness:.45,roughness:.24});
  for(let index=0;index<count;index++){
    const point=trial.routePoints[Math.min(trial.routePoints.length-1,Math.floor((index+.5)*trial.routePoints.length/count))];const floor=groundHeightAt(point[0],point[1]);const group=new THREE.Group();group.position.set(point[0],floor+1.25,point[1]);group.userData.arenaIndex=trial.course.arena;
    const core=new THREE.Mesh(new THREE.OctahedronGeometry(.38,0),material.clone());const ring=new THREE.Mesh(new THREE.TorusGeometry(.7,.045,6,20),material.clone());ring.rotation.x=Math.PI/2;group.add(core,ring);world.add(group);parkourCollectibles.push({group,core,ring,index,collected:false,baseY:group.position.y});
  }
}
function createPersonalGhost(trial){
  const record=progress.stats.parkourGhosts[trial.course.id];if(!record?.samples?.length||record.variantId!==trial.variant.id)return;
  const material=new THREE.MeshBasicMaterial({color:trial.course.color,transparent:true,opacity:.26,depthWrite:false,blending:THREE.AdditiveBlending});const mesh=new THREE.Mesh(new THREE.CapsuleGeometry(.42,1.05,4,8),material);mesh.userData.arenaIndex=trial.course.arena;mesh.visible=false;world.add(mesh);parkourGhost={mesh,samples:record.samples};
}
function createParkourVariantVisual(trial){
  if(!trial.variant.modifiers.risingDanger)return;
  const material=new THREE.MeshBasicMaterial({color:0x42d9ff,transparent:true,opacity:.34,depthWrite:false,side:THREE.DoubleSide});const water=new THREE.Mesh(new THREE.CircleGeometry(108,32),material);water.rotation.x=-Math.PI/2;water.position.set(0,-5,0);water.userData.arenaIndex=trial.course.arena;water.renderOrder=2;world.add(water);parkourVariantVisual=water;
}
function setParkourGateState(activeIndex){
  parkourGates.forEach((gate,index)=>{const passed=index<activeIndex;const active=index===activeIndex;gate.group.visible=!passed;gate.ring.material.opacity=active?.98:.18;gate.inner.material.opacity=active?.78:.1;gate.beam.material.opacity=active?.5:.06;gate.group.scale.setScalar(active?1.06:.88);});
}
function currentParkourElapsed(now=performance.now()){
  if(!state.parkour||!state.matchStart)return 0;return Math.max(0,now-state.matchStart+state.parkour.penaltyMs);
}
function updateParkourHud(now=performance.now()){
  if(state.gameMode!=='parkour'||!state.parkour)return;const {course,checkpointIndex,routePoints,variant,collected}=state.parkour;const elapsed=currentParkourElapsed(now);const seconds=elapsed/1000;const medal=parkourMedalForTime(course,seconds);
  setTextIfChanged(ui.parkourCourseName,course.name);setTextIfChanged(ui.parkourVariant,`${variant.name}${state.parkour.assisted?' // ASSISTED':''}`);setTextIfChanged(ui.parkourCheckpoint,`${checkpointIndex} / ${routePoints.length}`);setTextIfChanged(ui.parkourTime,formatTrialTime(elapsed));setTextIfChanged(ui.parkourBest,formatTrialTime(parkourBestFor(course,state.parkour.assisted)));setTextIfChanged(ui.parkourPace,(medal==='unranked'?'GOLD':medal).toUpperCase());setTextIfChanged(ui.parkourCollectibles,`${collected.size} / ${course.collectibleCount}`);setStyleIfChanged(ui.parkourProgress,'width',`${checkpointIndex/routePoints.length*100}%`);
}
function finishParkourRecovery(now=performance.now()){
  if(!state.parkour?.recoveryPending)return;const trial=state.parkour;const pending=trial.recoveryPending;trial.recoveryPending=null;
  if(pending.restart){restartParkourRun();ui.status.textContent=`${pending.reason} // NO-MISTAKES RESTART`;return;}
  const safe=trial.safePoint;state.position.set(safe.x,groundHeightAt(safe.x,safe.z,safe.y+2)+state.eyeHeight,safe.z);state.velocity.set(0,0,0);state.onGround=true;state.airbornePeakY=state.position.y;state.health=100;state.shield=50;updateVitals();ui.status.textContent=`${pending.reason} // +3.00S PENALTY // CHECKPOINT RESTORED`;state.shake=.025;
}
function resetParkourToCheckpoint(reason='FALL RECOVERY'){
  if(state.gameMode!=='parkour'||!state.parkour||state.parkour.recoveryPending)return;const trial=state.parkour;const now=performance.now();const restart=Boolean(trial.variant.modifiers.restartOnFall);if(!restart)trial.penaltyMs+=3000;trial.recoveryPending={reason,restart,completeAt:now+(trial.course.id==='neon-velocity'?850:950)};state.velocity.set(0,0,0);state.onGround=false;state.wallRunning=false;state.eyeHeight=1.75;state.crouching=false;state.sliding=false;state.zipline=null;state.vault=null;resetTraversalAtCheckpoint(state.traversal,now);state.traversal.cameraRoll=0;camera.rotation.z=0;stopJumpChargeAudio();releaseGrapple();ui.status.textContent=`${reason} // RECOVERING TO LAST CHECKPOINT`;state.shake=.045;
}
function completeParkour(now=performance.now()){
  if(!state.parkour||state.completed)return;const trial=state.parkour;const {course}=trial;const elapsed=currentParkourElapsed(now);const medal=parkourMedalForTime(course,elapsed/1000);const bestTable=trial.assisted?progress.stats.parkourAssistedBest:progress.stats.parkourBest;const medalTable=trial.assisted?progress.stats.parkourAssistedMedals:progress.stats.parkourMedals;const previous=bestTable[course.id];const personalBest=!previous||elapsed<previous;const reward=parkourRewardForCompletion(course,medal,Date.now(),progress.stats.parkourDailyClaims);
  if(personalBest){bestTable[course.id]=Math.round(elapsed);medalTable[course.id]=medal;if(!trial.assisted)progress.stats.parkourGhosts[course.id]={variantId:trial.variant.id,samples:trial.ghostSamples.slice(0,600)};}progress.stats.parkourDailyClaims[course.id]=reward.day;progress.stats.parkourCollectibles[course.id]=Math.max(Number(progress.stats.parkourCollectibles[course.id])||0,trial.collected.size);progress.stats.parkourCompletions++;addCash(reward.amount,`${course.name} // ${medal.toUpperCase()}${trial.assisted?' ASSISTED':''}${reward.daily?' DAILY':''}`);if(medal==='gold'&&!progress.cosmeticState.kitKeyAwards[course.id]){progress.cosmeticState.kitKeyAwards[course.id]=true;progress.cosmeticState.kitKeys++;lobbyNotify(`GOLD MEDAL // +1 RARE KIT KEY`,'exotic');}saveProgress();
  state.completed=true;state.mouseDown=false;clearTraversalInput();setAiming(false);document.exitPointerLock();ui.mouseLockGate?.classList.add('hidden');ui.complete.classList.remove('hidden');ui.completeReturnLobby?.classList.remove('hidden');ui.completeTitle.innerHTML=`${medal.toUpperCase()}<br />${personalBest?'NEW BEST':`+◆${reward.amount}`}`;ui.completeStatOneLabel.textContent='TIME';ui.completeStatTwoLabel.textContent='CHECKPOINTS';ui.accuracy.textContent=formatTrialTime(elapsed);ui.rounds.textContent=String(trial.routePoints.length);ui.restart.innerHTML='RUN AGAIN <b>↻</b>';updateParkourHud(now);
}
function updateParkour(now,dt){
  if(state.gameMode!=='parkour'||!state.parkour||state.countdownActive||state.completed)return;const trial=state.parkour;if(trial.recoveryPending){if(now>=trial.recoveryPending.completeAt)finishParkourRecovery(now);return;}const elapsed=currentParkourElapsed(now);const gate=parkourGates[trial.checkpointIndex];
  parkourGates.forEach((item,index)=>{if(!item.group.visible)return;item.ring.rotation.z+=dt*(index===trial.checkpointIndex?2.7:.7);item.inner.rotation.z-=dt*(index===trial.checkpointIndex?1.9:.4);if(index===trial.checkpointIndex)item.group.scale.setScalar(1.04+Math.sin(now*.008)*.045);});
  for(const item of parkourCollectibles){if(item.collected)continue;item.group.position.y=item.baseY+Math.sin(now*.004+item.index)*.18;item.core.rotation.y+=dt*2;item.ring.rotation.z+=dt*1.5;if(item.group.position.distanceTo(state.position)<2.15){item.collected=true;item.group.visible=false;trial.collected.add(item.index);createPulseBlast(item.group.position,2.8,PARKOUR_SURFACE_COLORS.secret);ui.status.textContent=`${trial.course.collectibleName} ${trial.collected.size} / ${trial.course.collectibleCount}`;uiSound('reward');}}
  if(now-trial.lastGhostSampleAt>=150&&trial.ghostSamples.length<600){trial.lastGhostSampleAt=now;trial.ghostSamples.push([Math.round(elapsed),Number(state.position.x.toFixed(2)),Number(state.position.y.toFixed(2)),Number(state.position.z.toFixed(2)),Number(state.yaw.toFixed(3))]);}
  if(parkourGhost){const samples=parkourGhost.samples;let sample=samples.at(-1);for(let index=1;index<samples.length;index++){if(samples[index][0]<elapsed)continue;const previous=samples[index-1];const next=samples[index];const blend=THREE.MathUtils.clamp((elapsed-previous[0])/Math.max(1,next[0]-previous[0]),0,1);parkourGhost.mesh.position.set(THREE.MathUtils.lerp(previous[1],next[1],blend),THREE.MathUtils.lerp(previous[2],next[2],blend)-.9,THREE.MathUtils.lerp(previous[3],next[3],blend));parkourGhost.mesh.rotation.y=THREE.MathUtils.lerp(previous[4],next[4],blend);sample=null;break;}if(sample){parkourGhost.mesh.position.set(sample[1],sample[2]-.9,sample[3]);parkourGhost.mesh.rotation.y=sample[4];}parkourGhost.mesh.visible=true;}
  const feetY=state.position.y-state.eyeHeight;
  if(trial.embedded&&feetY<3&&now-trial.lastVariantResetAt>900){trial.lastVariantResetAt=now;resetParkourToCheckpoint('CHILL DECK RECOVERY');return;}
  if(trial.variant.modifiers.risingDanger&&parkourVariantVisual){const waterLevel=-5+Math.min(1,elapsed/90000)*5.25;parkourVariantVisual.position.y=waterLevel;parkourVariantVisual.material.opacity=.25+Math.sin(now*.004)*.08;if(feetY<waterLevel&&now-trial.lastVariantResetAt>900){trial.lastVariantResetAt=now;resetParkourToCheckpoint('RISING WATER');return;}}
  if(trial.variant.modifiers.floorIsLava&&state.onGround&&feetY<.18&&now-trial.lastVariantResetAt>900){const nearSafePoint=[[trial.spawnPoint.x,trial.spawnPoint.z],...trial.routePoints].some(point=>Math.hypot(state.position.x-point[0],state.position.z-point[1])<4.2);if(!nearSafePoint){trial.lastVariantResetAt=now;resetParkourToCheckpoint('FLOOR IS LAVA');return;}}
  if(!gate)return;const horizontal=Math.hypot(state.position.x-gate.group.position.x,state.position.z-gate.group.position.z);const vertical=Math.abs(state.position.y-gate.group.position.y);if(horizontal>2.8||vertical>3.5)return;
  const finalGate=trial.checkpointIndex===trial.routePoints.length-1;if(finalGate&&trial.variant.modifiers.collectiblesRequired&&trial.collected.size<trial.course.collectibleCount){ui.status.textContent=`FINISH LOCKED // FIND ${trial.course.collectibleCount-trial.collected.size} ${trial.course.collectibleName}${trial.course.collectibleCount-trial.collected.size===1?'':'S'}`;return;}
  trial.checkpointIndex++;trial.safePoint.set(gate.group.position.x,gate.group.position.y-state.eyeHeight,gate.group.position.z);setParkourGateState(trial.checkpointIndex);addMovementCombo(`CHECKPOINT ${trial.checkpointIndex}`,65,now);state.speedBoostUntil=Math.max(state.speedBoostUntil,now+900);createPulseBlast(gate.group.position,4,trial.course.color);ui.status.textContent=`CHECKPOINT ${trial.checkpointIndex} / ${trial.routePoints.length} // FLOW BOOST`;updateParkourHud(now);if(trial.checkpointIndex>=trial.routePoints.length)completeParkour(now);
}
function beginParkourRun(courseIndex=selectedParkourCourse){
  selectedParkourCourse=courseIndex;const course=parkourCourseAt(courseIndex);const variant=activeParkourVariant(course);const route=routeForVariant(courseIndex,variant);selectedPlayMode='parkour';closePlayRoute();clearParkourArtifacts();selectArena(1,false);setLobbyCourseActive(true);state.lobbyParkour=true;state.gameMode='parkour';setLobbyPortalVisibility(false);state.firingRange=false;state.hostileMode=false;state.factoryDefense=null;state.completed=false;state.dead=false;state.matchDeaths=0;state.matchHeadshots=0;state.started=true;state.health=100;state.shield=50;state.matchDuration=0;state.parkour={course,courseIndex,variant,embedded:true,assisted:Boolean(progress.settings.parkourAssist),routePoints:route.checkpoints,spawnPoint:new THREE.Vector3(route.spawn[0],0,route.spawn[1]),checkpointIndex:0,penaltyMs:0,safePoint:new THREE.Vector3(route.spawn[0],0,route.spawn[1]),collected:new Set(),ghostSamples:[],lastGhostSampleAt:0,lastVariantResetAt:0,machineryOffset:secureRandom()*Math.PI*2,recoveryPending:null};state.parkour.safePoint.y=groundHeightAt(route.spawn[0],route.spawn[1]);state.parkour.spawnPoint.y=state.parkour.safePoint.y;state.position.set(route.spawn[0],state.parkour.safePoint.y+state.eyeHeight,route.spawn[1]);state.velocity.set(0,0,0);state.yaw=Math.atan2(-(route.checkpoints[0][0]-route.spawn[0]),-(route.checkpoints[0][1]-route.spawn[1]));state.pitch=0;createParkourGates(courseIndex,route.checkpoints);createParkourCollectibles(state.parkour);createPersonalGhost(state.parkour);createParkourVariantVisual(state.parkour);setParkourGateState(0);equipQuickSlot(2);
  document.body.classList.add('trial-mode','parkour-mode');ui.factoryObjective?.classList.add('hidden');ui.rangePanel.classList.add('hidden');ui.lobbyParkourPanel?.classList.add('hidden');ui.parkourPanel.classList.remove('hidden');ui.modeName.textContent='PARKOUR';ui.modeHint.textContent=variant.modifiers.disableGrapple?'NO GRAPPLE VARIANT':'MOVEMENT ABILITIES ON';ui.arenaHint.textContent='CHILL DECK COURSE';ui.cashHint.textContent='ARMORY LOCKED';ui.modeDisplay.classList.remove('hostile');ui.modeDisplay.classList.add('peaceful');ui.menu.classList.add('hidden');ui.hud.classList.remove('hidden');ui.hud.setAttribute('aria-hidden','false');ui.complete.classList.add('hidden');ui.completeReturnLobby?.classList.add('hidden');ui.completeStatOneLabel.textContent='ACCURACY';ui.completeStatTwoLabel.textContent='ROUNDS';ui.restart.innerHTML='RUN IT AGAIN <b>↻</b>';beginContractCountdown();updateParkourHud();ui.status.textContent=`${course.name} // ${variant.name} // FOLLOW THE CYAN GATE`;stopMenuMusic();uiSound('deploy');showMouseLockGate();
}
function restartParkourRun(){
  if(!state.parkour)return;const courseIndex=state.parkour.courseIndex;ui.complete.classList.add('hidden');state.completed=false;state.dead=false;state.started=false;clearParkourArtifacts();beginParkourRun(courseIndex);
}
function exitParkour(){
  if(state.gameMode!=='parkour')return;const returnToHub=returnToHubAfterParkour;returnToHubAfterParkour=false;if(state.countdownTimer){clearInterval(state.countdownTimer);state.countdownTimer=null;}clearParkourArtifacts();breakMovementCombo('TRIAL ENDED');clearTraversalInput();state.started=false;state.mouseDown=false;state.softMouseLook=false;state.locked=false;state.completed=false;state.dead=false;state.countdownActive=false;state.matchStart=0;state.gameMode='contract';state.parkour=null;state.lobbyParkour=false;state.matchDuration=300000;keys.clear();setAiming(false);ui.mouseLockGate?.classList.add('hidden');document.body.classList.remove('mouse-locked','trial-mode');document.exitPointerLock();ui.parkourPanel.classList.add('hidden');ui.hud.classList.add('hidden');ui.hud.setAttribute('aria-hidden','true');ui.prompt.classList.remove('show');ui.death.classList.add('hidden');ui.complete.classList.add('hidden');ui.completeReturnLobby?.classList.add('hidden');ui.modeHint.innerHTML='<kbd>H</kbd> TOGGLE HOSTILES';ui.arenaHint.innerHTML='<kbd>M</kbd> SWITCH MAP';ui.cashHint.innerHTML='<kbd>B</kbd> FIELD ARMORY';restorePlayLaunchButton();renderLobbySummary();renderProfile();if(returnToHub){enterLobbyParkour('chill');ui.status.textContent='CHILL DECK // PARKOUR RECORD SAVED';return;}setLobbyCourseActive(false);ui.menu.classList.remove('hidden');showLobbyTab('play');lobbyNotify('PARKOUR TRIAL SAVED // WELCOME BACK TO THE LOBBY','success');if(progress.settings.musicEnabled)ensureMenuMusic();
}
function setPlayRouteView(view='overview'){
  ui.playRouteOverview?.classList.toggle('hidden',view!=='overview');ui.mainMapRoute?.classList.toggle('hidden',view!=='maps');ui.duelRoute?.classList.toggle('hidden',view!=='duels');
}
function openPlayRoute(view='overview'){
  setPlayRouteView(view);ui.playRouteModal?.classList.remove('hidden');ui.playRouteModal?.setAttribute('aria-hidden','false');uiSound('select');
}
function closePlayRoute(){ui.playRouteModal?.classList.add('hidden');ui.playRouteModal?.setAttribute('aria-hidden','true');setPlayRouteView('overview');}
function restorePlayLaunchButton(){
  ui.deploy.disabled=false;ui.deploy.querySelector('small').textContent='CHOOSE A MODE';ui.deploy.querySelector('span').textContent='PLAY';ui.deploy.querySelector('em').textContent='MAIN GAME // DUELS // CHILL DECK →';ui.lobbyModeName.textContent='CHOOSE YOUR MODE';
}
function beginContractCountdown() {
  if (state.countdownTimer) clearInterval(state.countdownTimer);
  let count = 3;
  state.countdownActive = true; state.matchStart = 0; ui.countdownNumber.textContent = String(count); ui.countdown.classList.remove('hidden');
  state.countdownTimer = setInterval(() => {
    count--;
    if (count > 0) { ui.countdownNumber.textContent = String(count); return; }
    clearInterval(state.countdownTimer); state.countdownTimer = null; state.countdownActive = false; state.matchStart = performance.now();state.spawnGraceUntil=state.matchStart+2500;
    ui.countdown.classList.add('hidden'); ui.status.textContent = state.gameMode==='parkour'?'PARKOUR LIVE // FOLLOW THE BRIGHT GATE':'CONTRACT LIVE // FIVE MINUTES';
  }, 1000);
}
function configureFiringRange(distance=state.rangeDistance) {
  state.rangeDistance=distance;const targets=dummies.filter(dummy=>dummy.arena===0);const centerX=arenaDefinitions[0].spawn.x;const startZ=arenaDefinitions[0].spawn.z;
  targets.forEach((dummy,index)=>{if(dummy.respawnTimer){clearTimeout(dummy.respawnTimer);dummy.respawnTimer=null;}const x=centerX+(index-1)*8;const z=startZ-distance;const y=groundHeightAt(x,z);dummy.rangeBaseX=x;dummy.rangeBaseZ=z;dummy.baseY=y;dummy.group.position.set(x,y,z);dummy.group.rotation.set(0,0,0);dummy.health=100;dummy.alive=true;ui.blips[dummy.index].classList.remove('down');});
  state.targets=targets.length;ui.targets.textContent=String(state.targets).padStart(2,'0');ui.rangeDistanceLabel.textContent=`${distance}M`;ui.rangeDistanceButtons.forEach(button=>button.classList.toggle('active',Number(button.dataset.rangeDistance)===distance));
}
function restoreFiringRangeTargets(){for(const dummy of dummies.filter(item=>item.arena===0)){if(dummy.respawnTimer){clearTimeout(dummy.respawnTimer);dummy.respawnTimer=null;}const point=dummySpawns[dummy.index];dummy.rangeBaseX=null;dummy.rangeBaseZ=null;dummy.group.position.copy(point);dummy.baseY=point.y;dummy.group.rotation.set(0,0,0);dummy.health=100;dummy.alive=true;ui.blips[dummy.index].classList.remove('down');}state.targets=dummies.filter(dummy=>dummy.arena===state.activeArena&&dummy.alive).length;ui.targets.textContent=String(state.targets).padStart(2,'0');}
function resetFiringRangeTest() {
  state.shots=0;state.hits=0;state.rangeKills=0;state.rangeLastClear=0;state.rangeStartedAt=performance.now();state.matchHeadshots=0;configureFiringRange(state.rangeDistance);
  for(const slot of quickSlots){const gun=loadout[slot];gun.ammo=gun.magSize;gun.reserve=gun.maxReserve;}updateAmmo();updateFiringRangeHUD();ui.status.textContent='FIRING RANGE // TEST RESET';
}
function updateFiringRangeHUD(){if(!state.firingRange)return;ui.rangeAccuracy.textContent=`${Math.round(state.hits/Math.max(1,state.shots)*100)}%`;ui.rangeEliminations.textContent=String(state.rangeKills);ui.rangeClearTime.textContent=state.rangeLastClear?`${(state.rangeLastClear/1000).toFixed(2)}S`:'—';ui.matchClock.textContent='PRACTICE';}
function enterFiringRange() {
  selectedPlayMode='target';state.firingRange=true;state.completed=false;state.dead=false;state.hostileMode=false;state.matchDeaths=0;state.matchHeadshots=0;state.started=true;selectArena(0,false);equipQuickSlot(0);resetFiringRangeTest();
  ui.modeName.textContent='PEACEFUL';ui.modeDisplay.classList.remove('hostile');ui.modeDisplay.classList.add('peaceful');ui.menu.classList.add('hidden');ui.hud.classList.remove('hidden');ui.hud.setAttribute('aria-hidden','false');ui.rangePanel.classList.remove('hidden');ui.status.textContent='LOBBY FIRING RANGE // CLICK TO CONTROL';stopMenuMusic();uiSound('deploy');showMouseLockGate();
}
function exitFiringRange() {
  if(!state.firingRange)return;const returnToHub=returnToHubAfterRange;returnToHubAfterRange=false;if(state.countdownTimer){clearInterval(state.countdownTimer);state.countdownTimer=null;}clearTraversalInput();progress.stats.bestMatchHeadshots=Math.max(progress.stats.bestMatchHeadshots,state.matchHeadshots);saveProgress();restoreFiringRangeTargets();selectedPlayMode='hostile';state.firingRange=false;state.started=false;state.mouseDown=false;state.softMouseLook=false;state.locked=false;state.completed=false;state.dead=false;state.countdownActive=false;state.matchDuration=300000;keys.clear();setAiming(false);ui.mouseLockGate?.classList.add('hidden');document.body.classList.remove('mouse-locked');document.exitPointerLock();
  ui.rangePanel.classList.add('hidden');ui.armory.classList.add('hidden');ui.armory.setAttribute('aria-hidden','true');state.armoryOpen=false;ui.hud.classList.add('hidden');ui.hud.setAttribute('aria-hidden','true');ui.prompt.classList.remove('show');ui.death.classList.add('hidden');ui.complete.classList.add('hidden');if(returnToHub){enterLobbyParkour('atrium');ui.status.textContent='CENTRAL HUB // FIRING RANGE RESULTS SAVED';return;}ui.menu.classList.remove('hidden');restorePlayLaunchButton();showLobbyTab('play');renderLobbySummary();renderProfile();lobbyNotify('FIRING RANGE RESULTS SAVED','success');if(progress.settings.musicEnabled)ensureMenuMusic();
}
let returnToHubAfterRange=false;
let returnToHubAfterParkour=false;
function setLobbyCourseActive(active){
  lobbyCourse.group.visible=active;lobbyCourse.colliders.forEach(collider=>{collider.active=active;});lobbyCourse.surfaces.forEach(surface=>{surface.active=active;});renderer.shadowMap.needsUpdate=true;
}
function setLobbyPortalVisibility(visible){lobbyCourse.portals.forEach(portal=>{portal.group.visible=visible;});}
function claimHubDailyReward(){const day=localDateKey();if(progress.stats.hubDailyRewardDate===day){ui.status.textContent='DAILY REWARD // ALREADY CLAIMED';return;}progress.stats.hubDailyRewardDate=day;addCash(125,'CENTRAL HUB DAILY REWARD');saveProgress();createPulseBlast(state.position.clone().setY(state.position.y-.6),4,HUB_NAVIGATION_COLORS.information);ui.status.textContent='DAILY REWARD CLAIMED // +◆125';uiSound('reward');}
function launchModeFromHub(mode){exitLobbyParkour();startDeployment(mode);}
function openPlayRouteFromHub(view){exitLobbyParkour();showLobbyTab('play');openPlayRoute(view);}
function enterRangeFromHub(){returnToHubAfterRange=true;exitLobbyParkour();enterFiringRange();}
function announceTycoonAccess(){ui.status.textContent='PUBLIC TYCOON DISTRICT // ONLINE PERSISTENCE REQUIRED';lobbyNotify('PUBLIC TYCOON DISTRICT // SERVER MILESTONE','info');}
function openLobbyDestination(tab){exitLobbyParkour();showLobbyTab(tab);}
function openCosmeticPreviewRoom(){exitLobbyParkour();showLobbyTab('play');setLobbyPreviewWeapon(quickSlots[0]);if(lobbyPreview){lobbyPreview.yaw=-.65;lobbyPreview.zoom=4.7;}lobbyNotify('COSMETIC PREVIEW ROOM // DRAG, ZOOM, INSPECT, FIRE, RELOAD, OR SCOPE','info');}
function openParkourFromDeck(courseIndex){
  // A physical portal is already a deliberate course selection. Start the
  // linked trial immediately so the deck never drops the player back into an
  // unrelated menu between connected spaces.
  returnToHubAfterParkour=true;selectedParkourCourse=courseIndex;beginParkourRun(courseIndex);
}
function activateLobbySecret(id,label){
  if(progress.stats.lobbySecrets[id]){ui.status.textContent=`${label} SECRET // ALREADY DISCOVERED`;return;}
  progress.stats.lobbySecrets[id]=true;const found=Object.keys(progress.stats.lobbySecrets).filter(key=>progress.stats.lobbySecrets[key]).length;addCash(25,`${label} SECRET`);
  if(found===LOBBY_SECRET_TOTAL)addCash(75,'CHILL DECK TREASURE VAULT');
  saveProgress();updateParkourPanel(state.lobbyParkourFinished?progress.stats.lobbyParkourBestTime:performance.now()-state.lobbyParkourStartedAt);createPulseBlast(state.position.clone().setY(state.position.y-.6),3.6,PARKOUR_SURFACE_COLORS.secret);ui.status.textContent=found===LOBBY_SECRET_TOTAL?`TREASURE VAULT OPEN // ALL ${LOBBY_SECRET_TOTAL} SECRETS // +◆100`:`${label} SECRET ${found} / ${LOBBY_SECRET_TOTAL} // +◆25`;uiSound('reward');
  if(id==='pizza'){
    for(let index=0;index<12;index++){const slice=new THREE.Mesh(new THREE.ConeGeometry(.22,.55,3),lobbyCourseMaterials.secret);slice.position.set(state.position.x+(index%4-1.5)*1.1,state.position.y+4+Math.floor(index/4)*.8,state.position.z+(index%3-1)*.8);slice.rotation.set(Math.PI/2,index*.8,index*.35);lobbyCourse.group.add(slice);setTimeout(()=>{lobbyCourse.group.remove(slice);slice.geometry.dispose();},1800+index*60);}
  }
}
function updateParkourPanel(elapsed=0){
  if(ui.parkourRunTime)setTextIfChanged(ui.parkourRunTime,formatParkourTime(elapsed));
  if(ui.parkourBestTime)setTextIfChanged(ui.parkourBestTime,progress.stats.lobbyParkourBestTime?formatParkourTime(progress.stats.lobbyParkourBestTime):'—');
  if(ui.chillSecretCount)setTextIfChanged(ui.chillSecretCount,`${Object.values(progress.stats.lobbySecrets).filter(Boolean).length} / ${LOBBY_SECRET_TOTAL}`);
}
function resetLobbyParkourRun(announce=true,spawnPoint=lobbyCourse.courseSpawn){
  const atriumSpawn=spawnPoint===lobbyCourse.spawn;state.vault=null;state.zipline=null;state.wallRunning=false;state.eyeHeight=1.75;state.crouching=false;state.sliding=false;state.onGround=true;state.velocity.set(0,0,0);resetTraversalAtCheckpoint(state.traversal,performance.now());stopJumpChargeAudio();state.position.copy(spawnPoint);state.airbornePeakY=state.position.y;state.yaw=0;state.pitch=-.05;state.lobbyParkourStartedAt=performance.now();state.lobbyParkourFinished=false;state.lobbyParkourCheckpoint=atriumSpawn?0:1;updateParkourPanel(0);camera.position.copy(state.position);camera.rotation.set(state.pitch,state.yaw,0);if(announce)ui.status.textContent='CHILL DECK // EASY RUN STARTED';
}
function enterLobbyParkour(destination='atrium'){
  closePlayRoute();selectedPlayMode='parkour';state.started=true;state.gameMode='lobbyParkour';state.firingRange=false;state.lobbyParkour=true;state.hostileMode=false;state.completed=false;state.dead=false;state.countdownActive=false;state.softMouseLook=false;state.locked=false;selectArena(1,false);setLobbyCourseActive(true);setLobbyPortalVisibility(true);resetLobbyParkourRun(false,destination==='chill'?lobbyCourse.chillReturn:lobbyCourse.spawn);progress.stats.hubVisits=(progress.stats.hubVisits||0)+1;saveProgress();
  document.body.classList.add('parkour-mode');ui.modeName.textContent='CENTRAL HUB';ui.modeHint.textContent='COMBAT DISABLED';ui.controlsHint.innerHTML='<kbd>WASD</kbd> EXPLORE <kbd>F</kbd> USE TERMINAL <kbd>SPACE</kbd> JUMP + VAULT <kbd>ESC</kbd> RELEASE MOUSE';ui.cashHint.textContent='HUB DESTINATIONS';ui.modeDisplay.classList.remove('hostile');ui.modeDisplay.classList.add('peaceful');ui.menu.classList.add('hidden');ui.hud.classList.remove('hidden');ui.hud.setAttribute('aria-hidden','false');ui.rangePanel.classList.add('hidden');ui.lobbyParkourPanel?.classList.remove('hidden');ui.matchClock.textContent='FREE ROAM';ui.clockPanel.classList.remove('danger');ui.status.textContent=destination==='chill'?'CHILL DECK // SOCIAL + PARKOUR':'RESONANCE CENTRAL HUB // FOLLOW THE COLORED FLOOR LINES';weapon.visible=false;stopMenuMusic();uiSound('deploy');showMouseLockGate();
}
function exitLobbyParkour(){
  if(!state.lobbyParkour)return;setLobbyCourseActive(false);clearTraversalInput();state.lobbyParkour=false;state.started=false;state.gameMode='contract';state.mouseDown=false;state.softMouseLook=false;state.locked=false;state.vault=null;state.completed=false;state.dead=false;state.countdownActive=false;keys.clear();setAiming(false);document.body.classList.remove('mouse-locked','parkour-mode');ui.mouseLockGate?.classList.add('hidden');document.exitPointerLock();ui.lobbyParkourPanel?.classList.add('hidden');ui.hud.classList.add('hidden');ui.hud.setAttribute('aria-hidden','true');ui.prompt.classList.remove('show');ui.menu.classList.remove('hidden');ui.modeHint.innerHTML='<kbd>H</kbd> TOGGLE HOSTILES';ui.controlsHint.innerHTML='<kbd>WASD</kbd> MOVE <kbd>Q/E</kbd> ABILITIES <kbd>F</kbd> INTERACT <kbd>LMB</kbd> FIRE <kbd>RMB</kbd> AIM';ui.cashHint.innerHTML='<kbd>B</kbd> FIELD ARMORY';weapon.visible=true;selectArena(0,false);restorePlayLaunchButton();showLobbyTab('play');renderLobbySummary();renderProfile();lobbyNotify('WELCOME BACK // CHILL DECK PROGRESS SAVED','success');if(progress.settings.musicEnabled)ensureMenuMusic();
}
function startDeployment(mode=selectedPlayMode,arenaIndex=null) {
  if(mode==='target'){enterFiringRange();return;}
  if(mode==='parkour'){enterLobbyParkour();return;}
  selectedPlayMode=mode;closePlayRoute();restorePlayLaunchButton();
  if(mode==='factory')selectArena(2,false);else if(mode==='quick')selectArena(Math.floor(secureRandom()*arenaDefinitions.length),false);else if(mode==='main'&&Number.isInteger(arenaIndex)&&arenaIndex>=0&&arenaIndex<arenaDefinitions.length)selectArena(arenaIndex,false);else selectArena(state.activeArena,false);
  state.gameMode=mode==='factory'?'factoryDefense':'contract';state.firingRange=false;state.hostileMode=true;state.softMouseLook=false;state.locked=false; state.matchDeaths=0;state.matchHeadshots=0; state.started=true; equipQuickSlot(0);resetDestructibleCover();
  if(mode==='factory')initializeFactoryDefense();else{state.factoryDefense=null;ui.factoryObjective?.classList.add('hidden');}
  ui.modeName.textContent=state.hostileMode?'HOSTILE':'PEACEFUL'; ui.modeDisplay.classList.toggle('hostile',state.hostileMode); ui.modeDisplay.classList.toggle('peaceful',!state.hostileMode);
  ui.menu.classList.add('hidden'); ui.hud.classList.remove('hidden'); beginContractCountdown();
  ui.status.textContent = `${mode==='factory'?'FACTORY DEFENSE':mode==='quick'?'QUICK CONTRACT':'MAIN GAME'} // CLICK TO CONTROL`; stopMenuMusic(); uiSound('deploy'); showMouseLockGate();
}

function setMultiplayerStatus(message, connected = onlineMatch.connected) {
  setTextIfChanged(ui.multiplayerStatus,message);
  ui.multiplayerConnectionLight?.classList.toggle('online',connected);
  setTextIfChanged(ui.multiplayerConnectionLight,connected?'ONLINE':'OFFLINE');
}

function setMultiplayerBusy(busy) {
  ui.multiplayerPanel?.classList.toggle('busy',busy);
  if(ui.createPrivateMatch)ui.createPrivateMatch.disabled=busy;
  if(ui.joinPrivateMatch)ui.joinPrivateMatch.disabled=busy;
}

async function createPrivateMatch() {
  if(selectedDuelSize!==1){setMultiplayerStatus(`${selectedDuelSize}V${selectedDuelSize} IS LOCKED // START WITH 1V1`,false);return;}
  setMultiplayerBusy(true);setMultiplayerStatus('CONTACTING AUTHORITATIVE SERVER…',false);
  try{
    const result=await onlineMatch.create(ui.multiplayerName?.value||progress.settings.callsign);
    if(ui.multiplayerCodeDisplay)ui.multiplayerCodeDisplay.textContent=result.roomCode;
    if(ui.multiplayerRoomCode)ui.multiplayerRoomCode.value=result.roomCode;
    ui.multiplayerRoomResult?.classList.remove('hidden');ui.cancelPrivateMatch?.classList.remove('hidden');
    setMultiplayerStatus('ROOM READY // SHARE THE CODE // WAITING FOR OPPONENT',true);
  }catch(error){console.error('Private room creation failed',error);setMultiplayerStatus(`COULD NOT CREATE ROOM // ${error?.message||'SERVER OFFLINE'}`,false);}
  finally{setMultiplayerBusy(false);}
}

async function joinPrivateMatch() {
  if(selectedDuelSize!==1){setMultiplayerStatus(`${selectedDuelSize}V${selectedDuelSize} IS LOCKED // START WITH 1V1`,false);return;}
  setMultiplayerBusy(true);setMultiplayerStatus('JOINING PRIVATE ROOM…',false);
  try{
    const result=await onlineMatch.join(ui.multiplayerRoomCode?.value,ui.multiplayerName?.value||progress.settings.callsign);
    if(ui.multiplayerCodeDisplay)ui.multiplayerCodeDisplay.textContent=result.roomCode;
    ui.multiplayerRoomResult?.classList.remove('hidden');ui.cancelPrivateMatch?.classList.remove('hidden');
    setMultiplayerStatus('CONNECTED // WAITING FOR SERVER COUNTDOWN',true);
  }catch(error){console.error('Private room join failed',error);setMultiplayerStatus(`JOIN FAILED // ${error?.message||'CHECK THE CODE'}`,false);}
  finally{setMultiplayerBusy(false);}
}

function setOnlineActorsHidden(hidden) {
  dummies.forEach(dummy=>{dummy.group.visible=!hidden&&dummy.arena===state.activeArena&&dummy.alive;});
  enemies.forEach(enemy=>{enemy.group.visible=!hidden&&enemy.arena===state.activeArena&&enemy.alive;});
}

function beginOnlineDeployment() {
  if(state.started&&state.gameMode==='multiplayer')return;
  closePlayRoute();selectedPlayMode='duel';state.started=true;state.gameMode='multiplayer';state.firingRange=false;state.lobbyParkour=false;state.hostileMode=false;state.completed=false;state.dead=false;state.countdownActive=false;state.softMouseLook=false;state.locked=false;state.mouseDown=false;state.onlineSnapshot=null;
  selectArena(0,false);const specterIndex=loadout.findIndex(gun=>gun.id==='specter');if(specterIndex>=0)switchWeapon(specterIndex,false);setOnlineActorsHidden(true);
  document.body.classList.add('online-mode');
  ui.menu.classList.add('hidden');ui.hud.classList.remove('hidden');ui.hud.setAttribute('aria-hidden','false');ui.complete.classList.add('hidden');ui.death.classList.add('hidden');ui.rangePanel.classList.add('hidden');ui.parkourPanel.classList.add('hidden');ui.lobbyParkourPanel?.classList.add('hidden');
  ui.modeName.textContent='ONLINE 1V1';ui.modeHint.textContent='SERVER AUTHORITATIVE';ui.arenaHint.textContent='VERTIGO GRID';ui.cashHint.textContent='SPECTER LOADOUT';ui.controlsHint.innerHTML='<kbd>WASD</kbd> MOVE <kbd>SHIFT</kbd> SPRINT <kbd>SPACE</kbd> JUMP <kbd>R</kbd> RELOAD <kbd>LMB</kbd> FIRE <kbd>RMB</kbd> AIM';ui.modeDisplay.classList.add('hostile');ui.modeDisplay.classList.remove('peaceful');ui.status.textContent='PRIVATE DUEL // SERVER COUNTDOWN';
  stopMenuMusic();uiSound('deploy');weapon.visible=true;showMouseLockGate();
}

function handleOnlinePhase(phase) {
  if(phase==='waiting'){setMultiplayerStatus('ROOM READY // WAITING FOR ONE OPPONENT',true);return;}
  if(phase==='countdown'){beginOnlineDeployment();ui.status.textContent='PRIVATE DUEL // GET READY';return;}
  if(phase==='playing'){beginOnlineDeployment();ui.countdown.classList.add('hidden');ui.status.textContent='PRIVATE DUEL LIVE // FIRST TO 5 // SERVER VALIDATES EVERY HIT';return;}
  if(phase==='ended'){ui.status.textContent='PRIVATE DUEL COMPLETE // SERVER VERIFYING RESULT';return;}
}

function ensureRemotePlayer(snapshot) {
  if(snapshot.sessionId===onlineMatch.sessionId)return null;
  let remote=remotePlayers.get(snapshot.sessionId);
  if(!remote){remote=createRemotePlayer(snapshot.name);remote.position.set(snapshot.x,snapshot.y-1.75,snapshot.z);world.add(remote);remotePlayers.set(snapshot.sessionId,remote);}
  return remote;
}

function removeRemotePlayer(sessionId) {
  const remote=remotePlayers.get(sessionId);if(!remote)return;disposeRemotePlayer(remote);remotePlayers.delete(sessionId);
}

function clearRemotePlayers(){for(const sessionId of [...remotePlayers.keys()])removeRemotePlayer(sessionId);}

function updateOnlineCamera(dt) {
  camera.position.copy(state.position);camera.rotation.set(state.pitch,state.yaw,0);
  const gun=loadout[state.weaponIndex];const profile=aimProfileForGun(gun);const targetFov=state.aiming?(profile.targetFov||Math.max(40,progress.settings.fov-(profile.zoom||0))):progress.settings.fov;camera.fov=THREE.MathUtils.damp(camera.fov,targetFov,profile.transition,dt);camera.updateProjectionMatrix();
  const ads=state.aiming?[.08,-.34,-.61]:[.42,-.4,-.72];if(!state.reloading){weapon.position.x=THREE.MathUtils.damp(weapon.position.x,ads[0],14,dt);weapon.position.y=THREE.MathUtils.damp(weapon.position.y,ads[1],14,dt);weapon.position.z=THREE.MathUtils.damp(weapon.position.z,ads[2],14,dt);}
}

function updateOnlineMatch(now,dt) {
  const command=networkInputFromControls(keys,state.yaw,state.pitch,state.aiming);const snapshot=onlineMatch.tick(now,command);if(!snapshot)return;
  state.onlineSnapshot=snapshot;const self=snapshot.players.find(player=>player.sessionId===snapshot.selfSessionId);if(!self)return;
  state.position.set(self.x,self.y,self.z);state.velocity.set(self.vx,self.vy,self.vz);state.onGround=self.onGround;state.health=self.health;state.shield=self.shield;state.reloading=self.reloading;
  const gun=loadout[state.weaponIndex];gun.ammo=self.ammo;gun.reserve=self.reserve;updateVitals();updateAmmo();setTextIfChanged(ui.enemies,String(snapshot.players.filter(player=>player.sessionId!==snapshot.selfSessionId&&player.alive).length).padStart(2,'0'));setTextIfChanged(ui.targets,String(self.kills).padStart(2,'0'));
  if(!self.alive){state.mouseDown=false;setAiming(false);enforceScopeClearance(gun,false);setTextIfChanged(ui.status,`ELIMINATED // RESPAWN IN ${Math.max(0,Math.ceil((self.respawnAt-Date.now())/1000))}`);}
  else{enforceScopeClearance(gun,true);if(ui.status.textContent.startsWith('ELIMINATED'))setTextIfChanged(ui.status,'RESPAWNED // DUEL LIVE');}
  const activeIds=new Set();for(const player of snapshot.players){if(player.sessionId===snapshot.selfSessionId)continue;activeIds.add(player.sessionId);const remote=ensureRemotePlayer(player);if(remote)updateRemotePlayer(remote,player,dt);}for(const sessionId of [...remotePlayers.keys()])if(!activeIds.has(sessionId))removeRemotePlayer(sessionId);
  if(snapshot.phase==='countdown'){const remaining=Math.max(1,Math.ceil((snapshot.countdownEndsAt-Date.now())/1000));setTextIfChanged(ui.countdownNumber,remaining);ui.countdown.classList.remove('hidden');setTextIfChanged(ui.matchClock,'00:03');}
  else ui.countdown.classList.add('hidden');
  if(snapshot.phase==='playing'){const remaining=Math.max(0,snapshot.matchEndsAt-Date.now());const seconds=Math.ceil(remaining/1000);setTextIfChanged(ui.matchClock,`${String(Math.floor(seconds/60)).padStart(2,'0')}:${String(seconds%60).padStart(2,'0')}`);ui.clockPanel.classList.toggle('danger',remaining<=30000);}
  updateOnlineCamera(dt);
}

function fireOnlineWeapon() {
  const snapshot=state.onlineSnapshot;const self=snapshot?.players.find(player=>player.sessionId===snapshot.selfSessionId);if(!self?.alive||snapshot.phase!=='playing'||self.reloading||self.ammo<=0)return;
  const now=performance.now();const gun=loadout[state.weaponIndex];if(now-state.lastShot<gun.fireRate)return;state.lastShot=now;state.shots++;state.crosshairKick=Math.min(1.2,state.crosshairKick+Math.max(.15,gun.recoil*1.8));const direction=new THREE.Vector3();camera.getWorldDirection(direction);onlineMatch.fire(direction);shotSound(gun);weapon.rotation.x=-.035-gun.recoil;gun.model.userData.muzzle.intensity=20;gun.model.userData.flash.material.opacity=1;spawnCasing(gun);const tracer=equippedTracer();addBeam(camera.position.clone(),camera.position.clone().addScaledVector(direction,120),tracer?new THREE.Color(tracer.color).getHex():0xffc857,80);ui.crosshair.classList.remove('fire');void ui.crosshair.offsetWidth;ui.crosshair.classList.add('fire');
}

function handleOnlineShot(event) {
  if(!state.started||state.gameMode!=='multiplayer'||event.shooterSessionId===onlineMatch.sessionId)return;const remote=remotePlayers.get(event.shooterSessionId);if(!remote)return;markRemotePlayerFired(remote);const start=remote.position.clone().add(new THREE.Vector3(.3,1.05,-.4).applyAxisAngle(new THREE.Vector3(0,1,0),remote.rotation.y));const direction=new THREE.Vector3(event.direction.x,event.direction.y,event.direction.z);addBeam(start,start.clone().addScaledVector(direction,120),0xff6b72,95);if(event.hitSessionId===onlineMatch.sessionId){ui.damageFlash.classList.remove('show');void ui.damageFlash.offsetWidth;ui.damageFlash.classList.add('show');}
}

function handleOnlineElimination(event){if(state.gameMode!=='multiplayer')return;const localKill=event.shooterSessionId===onlineMatch.sessionId;ui.status.textContent=localKill?`ELIMINATION CONFIRMED // ${event.targetName}`:`${event.targetName} // OPERATOR DOWN`;const targetSnapshot=state.onlineSnapshot?.players.find(player=>player.sessionId===event.targetSessionId);const remote=remotePlayers.get(event.targetSessionId);const point=remote?.position?.clone?.()||(targetSnapshot?new THREE.Vector3(targetSnapshot.x,targetSnapshot.y,targetSnapshot.z):state.position.clone());const fx=localKill?equippedKillFx():cosmeticById(event.killFxId);if(fx)triggerKillFx(fx,point,`online-${event.eliminationId||`${event.shooterSessionId}-${event.targetSessionId}-${event.respawnAt}`}`,{remote:!localKill});}

function completeOnlineMatch(result = null) {
  if(state.gameMode!=='multiplayer'||state.completed)return;
  state.completed=true;state.mouseDown=false;clearTraversalInput();setAiming(false);ui.mouseLockGate?.classList.add('hidden');ui.prompt?.classList.remove('show');document.exitPointerLock();
  const snapshot=state.onlineSnapshot;const selfSessionId=snapshot?.selfSessionId||onlineMatch.sessionId;
  const self=snapshot?.players.find(player=>player.sessionId===selfSessionId);const opponent=snapshot?.players.find(player=>player.sessionId!==selfSessionId);
  const resultSelf=result?.scores?.find(score=>score.sessionId===selfSessionId);const resultOpponent=result?.scores?.find(score=>score.sessionId!==selfSessionId);
  const winnerSessionId=result?.winnerSessionId??snapshot?.winnerSessionId??'';const won=Boolean(winnerSessionId&&winnerSessionId===selfSessionId);const draw=!winnerSessionId;
  ui.complete.classList.remove('hidden');ui.completeReturnLobby?.classList.remove('hidden');ui.completeTitle.innerHTML=draw?'DUEL<br />DRAW':won?'DUEL<br />VICTORY':'DUEL<br />DEFEAT';ui.completeStatOneLabel.textContent='YOUR KILLS';ui.completeStatTwoLabel.textContent='OPPONENT';ui.accuracy.textContent=String(resultSelf?.kills??self?.kills??0);ui.rounds.textContent=String(resultOpponent?.kills??opponent?.kills??0);ui.restart.innerHTML='RETURN TO LOBBY <b>←</b>';
}

async function exitOnlineMatch(message='PRIVATE ROOM CLOSED') {
  if(state.gameMode!=='multiplayer'&&!onlineMatch.connected)return;await onlineMatch.leave();clearRemotePlayers();clearTraversalInput();state.started=false;state.gameMode='contract';state.onlineSnapshot=null;state.mouseDown=false;state.softMouseLook=false;state.locked=false;state.completed=false;state.dead=false;state.reloading=false;state.countdownActive=false;keys.clear();setAiming(false);document.body.classList.remove('mouse-locked','online-mode');document.exitPointerLock();ui.countdown.classList.add('hidden');ui.complete.classList.add('hidden');ui.completeReturnLobby?.classList.add('hidden');ui.hud.classList.add('hidden');ui.hud.setAttribute('aria-hidden','true');ui.menu.classList.remove('hidden');ui.cancelPrivateMatch?.classList.add('hidden');ui.multiplayerRoomResult?.classList.add('hidden');ui.controlsHint.innerHTML='<kbd>WASD</kbd> MOVE <kbd>Q/E</kbd> ABILITIES <kbd>F</kbd> INTERACT <kbd>LMB</kbd> FIRE <kbd>RMB</kbd> AIM';setOnlineActorsHidden(false);syncArenaVisibility(state.activeArena);restorePlayLaunchButton();showLobbyTab('play');renderLobbySummary();setMultiplayerStatus('START THE MULTIPLAYER SERVER, THEN CREATE A ROOM OR JOIN A FRIEND.',false);lobbyNotify(message,'info');if(progress.settings.musicEnabled)ensureMenuMusic();
}

function handleOnlineDisconnect(code){if(state.gameMode==='multiplayer')void exitOnlineMatch(`ONLINE CONNECTION CLOSED // ${code}`);else{clearRemotePlayers();setMultiplayerStatus(`CONNECTION CLOSED // ${code}`,false);ui.cancelPrivateMatch?.classList.add('hidden');}}

ui.deploy.addEventListener('click',()=>openPlayRoute('overview'));
ui.mainRouteButtons.forEach(button=>button.addEventListener('click',()=>openPlayRoute('maps')));
ui.mainMapButtons.forEach(button=>button.addEventListener('click',()=>startDeployment('main',Number(button.dataset.mainMap))));
ui.duelRouteButtons.forEach(button=>button.addEventListener('click',()=>openPlayRoute('duels')));
ui.minigameRouteButtons.forEach(button=>button.addEventListener('click',()=>{openPlayRoute('overview');lobbyNotify('FOUR MINI GAMES // COMING IN A LATER UPDATE','info');}));
ui.duelSizeButtons.forEach(button=>button.addEventListener('click',()=>{selectedDuelSize=Number(button.dataset.duelSize);ui.duelSizeButtons.forEach(option=>option.classList.toggle('selected',option===button));setMultiplayerStatus(selectedDuelSize===1?'PRIVATE 1V1 READY // CREATE OR JOIN WITH A CODE':`${selectedDuelSize}V${selectedDuelSize} LOCKED // PROVE 1V1 NETCODE FIRST`,onlineMatch.connected);lobbyNotify(`${selectedDuelSize}V${selectedDuelSize} DUELS SELECTED // ${selectedDuelSize===1?'PRIVATE ROOMS LIVE':'COMING AFTER 1V1'}`,'info');}));
if(ui.multiplayerName)ui.multiplayerName.value=String(progress.settings.callsign||'OPERATOR').slice(0,18);
ui.multiplayerRoomCode?.addEventListener('input',()=>{ui.multiplayerRoomCode.value=ui.multiplayerRoomCode.value.replace(/[^a-zA-Z0-9]/g,'').toUpperCase().slice(0,5);});
ui.createPrivateMatch?.addEventListener('click',createPrivateMatch);ui.joinPrivateMatch?.addEventListener('click',joinPrivateMatch);ui.cancelPrivateMatch?.addEventListener('click',()=>void exitOnlineMatch('PRIVATE ROOM LEFT'));
ui.copyPrivateRoomCode?.addEventListener('click',async()=>{const code=ui.multiplayerCodeDisplay?.textContent||'';try{await navigator.clipboard.writeText(code);setMultiplayerStatus('ROOM CODE COPIED // SEND IT TO YOUR OPPONENT',true);}catch{if(ui.multiplayerRoomCode){ui.multiplayerRoomCode.focus();ui.multiplayerRoomCode.select();}setMultiplayerStatus('ROOM CODE SELECTED // COPY IT NOW',true);}});
ui.playRouteClose?.addEventListener('click',closePlayRoute);ui.mainMapBack?.addEventListener('click',()=>setPlayRouteView('overview'));ui.duelBack?.addEventListener('click',()=>setPlayRouteView('overview'));
ui.playRouteModal?.addEventListener('click',event=>{if(event.target===ui.playRouteModal)closePlayRoute();});
ui.playModeButtons.forEach(button=>button.addEventListener('click',()=>startDeployment(button.dataset.playMode)));
ui.factoryDeploy?.addEventListener('click',()=>startDeployment('factory'));
ui.exitRange?.addEventListener('click',exitFiringRange);ui.exitLobbyParkour?.addEventListener('click',exitLobbyParkour);ui.restartLobbyParkour?.addEventListener('click',()=>resetLobbyParkourRun());ui.exitParkour?.addEventListener('click',exitParkour);ui.resetParkour?.addEventListener('click',restartParkourRun);ui.rangeDistanceButtons.forEach(button=>button.addEventListener('click',()=>{configureFiringRange(Number(button.dataset.rangeDistance));resetFiringRangeTest();}));ui.rangeMoving?.addEventListener('click',()=>{state.rangeMovingTargets=!state.rangeMovingTargets;ui.rangeMoving.textContent=`MOVING TARGETS // ${state.rangeMovingTargets?'ON':'OFF'}`;ui.rangeMoving.classList.toggle('active',state.rangeMovingTargets);});ui.rangeReset?.addEventListener('click',resetFiringRangeTest);

function toggleHostileMode() {
  if (!state.started || state.dead || state.countdownActive) return;
  if(state.gameMode==='multiplayer'){ui.status.textContent='ONLINE DUEL // COMBAT RULES ARE SERVER LOCKED';return;}
  if(state.lobbyParkour){ui.status.textContent='CHILL DECK // COMBAT STAYS OFF';return;}if(state.gameMode==='parkour'){ui.status.textContent='PARKOUR TRIAL // COMBAT STATE LOCKED';return;}if(state.firingRange){ui.status.textContent='FIRING RANGE // HOSTILES DISABLED';return;}if(state.gameMode==='factoryDefense'){ui.status.textContent='FACTORY DEFENSE // HOSTILES REQUIRED';return;}
  state.hostileMode = !state.hostileMode;
  ui.modeName.textContent = state.hostileMode ? 'HOSTILE' : 'PEACEFUL';
  ui.modeDisplay.classList.toggle('hostile', state.hostileMode); ui.modeDisplay.classList.toggle('peaceful', !state.hostileMode);
  ui.status.textContent = state.hostileMode ? 'HOSTILE MODE // ENEMIES ENGAGED' : 'PEACEFUL MODE // ENEMIES PASSIVE';
  if (state.hostileMode){state.spawnGraceUntil=performance.now()+1400;enemies.forEach((enemy,index)=>{enemy.nextShot=performance.now()+650+index*120;enemy.spottedAt=0;enemy.burstRemaining=0;});}
}

function beginCrouchOrSlide() {
  if (!state.started || state.dead || state.armoryOpen || state.zipline) return;
  if(state.traversal.ledgeHang){state.traversal.ledgeHang=null;state.velocity.y=-2;ui.status.textContent='LEDGE DROP';return;}
  if(state.traversal.wallRun)endWallRun(performance.now(),'WALL RUN // DROPPED');
  if(!state.onGround){state.traversal.rollQueuedUntil=performance.now()+280;traversalHint('landingRoll','CROUCH BEFORE LANDING TO ROLL');return;}
  const movingKeys = keys.has('KeyW') || keys.has('KeyA') || keys.has('KeyS') || keys.has('KeyD') || keys.has('ArrowUp') || keys.has('ArrowLeft') || keys.has('ArrowDown') || keys.has('ArrowRight');
  const horizontalSpeed = Math.hypot(state.velocity.x,state.velocity.z);
  if (!movingKeys && horizontalSpeed < 2) return;
  const direction = new THREE.Vector3(state.velocity.x,0,state.velocity.z);
  if (direction.lengthSq()<1) direction.set(0,0,-1).applyAxisAngle(new THREE.Vector3(0,1,0),state.yaw);
  direction.normalize();
  const extreme = keys.has('ShiftLeft') || keys.has('ShiftRight');
  const slideSpeed = Math.max(horizontalSpeed*(extreme?1.55:1.35),extreme?40:24);
  state.velocity.x=direction.x*slideSpeed; state.velocity.z=direction.z*slideSpeed;
  state.sliding=true; state.slideUntil=performance.now()+(extreme?1150:900); state.onGround=true; state.shake=Math.max(state.shake,.035);
  if(extreme||horizontalSpeed>18)addMovementCombo('SPRINT → POWER SLIDE',extreme?65:45);
  ui.status.textContent=extreme?'EXTREME POWER SLIDE':'MOMENTUM SLIDE';
}

let jumpChargeAudio=null;
function traversalHint(id,message){
  if((progress.stats.traversalTutorials[id]||0)>=3)return;
  ui.status.textContent=message;
}
function completeTraversalTutorial(id){
  const current=progress.stats.traversalTutorials[id]||0;if(current>=3)return;
  progress.stats.traversalTutorials[id]=current+1;saveProgress();
}
function stopJumpChargeAudio(){
  if(!jumpChargeAudio)return;const {oscillator,gain}=jumpChargeAudio;jumpChargeAudio=null;
  try{const now=audioContext?.currentTime||0;gain.gain.cancelScheduledValues(now);gain.gain.setTargetAtTime(.0001,now,.025);oscillator.stop(now+.1);}catch{}
}
function startJumpChargeAudio(){
  const context=ensureAudio();if(!context||progress.settings.effectsVolume<=0)return;
  stopJumpChargeAudio();const oscillator=context.createOscillator();const gain=context.createGain();oscillator.type='sine';oscillator.frequency.value=105;gain.gain.value=.008*progress.settings.masterVolume*progress.settings.effectsVolume;oscillator.connect(gain).connect(context.destination);oscillator.start();jumpChargeAudio={oscillator,gain};
}
function clearTraversalInput({grounded=state.onGround,now=performance.now()}={}){
  clearTraversalState(state.traversal,{grounded,now});state.wallRunning=false;stopJumpChargeAudio();
  ui.jumpCharge?.classList.remove('active','full');ui.jumpCharge?.style.setProperty('--charge','0');
}
function traversalInputBlocked(){return !state.started||!state.locked||state.countdownActive||state.completed||state.dead||state.armoryOpen||state.gameMode==='multiplayer'||Boolean(state.zipline);}
function beginTraversalCharge(now=performance.now(),event=null){
  const kind=state.traversal.wallRun?'wall':'ground';const started=beginJumpCharge(state.traversal,now,{kind,blocked:traversalInputBlocked(),repeated:Boolean(event?.repeat),typing:isTypingTarget(event?.target)});
  if(!started)return false;startJumpChargeAudio();ui.jumpCharge?.classList.add('active');traversalHint('chargedJump','HOLD SPACE TO CHARGE');return true;
}
function releaseTraversalCharge(now=performance.now(),event=null){
  if(isTypingTarget(event?.target)){clearTraversalInput();return null;}
  const released=releaseJumpCharge(state.traversal,now,{assist:progress.settings.parkourAssist});stopJumpChargeAudio();ui.jumpCharge?.classList.remove('active','full');
  if(released)traversalHint('chargedJump','RELEASE SPACE TO JUMP');return released;
}

canvas.addEventListener('pointerdown',event=>{if(event.button===0)requestLock();});
ui.mouseLockGate?.addEventListener('click',requestLock);
ui.prompt?.addEventListener('pointerdown',event=>{event.preventDefault();event.stopPropagation();requestLock();});
ui.prompt?.addEventListener('keydown',event=>{if(event.code==='Enter'||event.code==='Space'){event.preventDefault();requestLock();}});
document.addEventListener('pointerlockchange', () => {
  if(document.pointerLockElement===canvas)state.softMouseLook=false;
  state.locked = document.pointerLockElement === canvas||state.softMouseLook;
  if (!state.locked) { state.mouseDown = false; state.chargingGun = null; setAiming(false); clearTraversalInput(); }
  document.body.classList.toggle('mouse-locked',state.locked);
  if(state.locked){ui.mouseLockGate?.classList.add('hidden');ui.prompt.textContent='';ui.prompt.classList.remove('show');canvas.focus({preventScroll:true});}
  else showMouseLockGate();
});
document.addEventListener('pointerlockerror',enableFallbackMouseLook);
document.addEventListener('mousemove', (e) => {
  if (!state.locked) return;
  const profile=aimProfileForGun(loadout[state.weaponIndex]);
  const adsSensitivity=profile.scope?progress.settings.scopeSensitivity:THREE.MathUtils.lerp(1,progress.settings.scopeSensitivity,profile.sensitivityWeight||.45);
  const sensitivity = .0018 * progress.settings.mouseSensitivity * THREE.MathUtils.lerp(1,adsSensitivity,state.aimBlend);
  state.yaw -= e.movementX * sensitivity;
  state.pitch -= e.movementY * sensitivity * .92;
  state.pitch = THREE.MathUtils.clamp(state.pitch, -1.48, 1.48);
});
document.addEventListener('keydown', (e) => {
  if(isTypingTarget(e.target))return;
  keys.add(e.code);
  if (e.code === 'Space' || e.code.startsWith('Arrow')) e.preventDefault();
  if(e.code==='Space')beginTraversalCharge(performance.now(),e);
  if(e.code==='Escape'&&state.softMouseLook){state.softMouseLook=false;state.locked=false;document.body.classList.remove('mouse-locked');showMouseLockGate();}
  if (e.code === 'KeyR'&&!state.lobbyParkour) reload();
  if (e.code === 'Digit1'&&!state.lobbyParkour) equipQuickSlot(0);
  if (e.code === 'Digit2'&&!state.lobbyParkour) equipQuickSlot(1);
  if (e.code === 'Digit3'&&!state.lobbyParkour) equipQuickSlot(2);
  if (e.code === 'Digit4'&&!state.lobbyParkour) equipQuickSlot(3);
  if (e.code === 'KeyB' && !e.repeat && state.gameMode!=='parkour') toggleArmory();
  if (e.code === 'KeyF' && !e.repeat && state.gameMode!=='multiplayer') searchNearbyLoot();
  if (e.code === 'KeyM' && !e.repeat && state.started && !state.firingRange && !state.lobbyParkour && !['parkour','multiplayer'].includes(state.gameMode) && !state.dead && !state.armoryOpen) selectArena(state.activeArena + 1);
  if (e.code === 'KeyH' && !e.repeat) toggleHostileMode();
  if (e.code === 'KeyC' && !e.repeat) beginCrouchOrSlide();
  if (e.code === 'KeyQ' && !e.repeat&&!state.lobbyParkour&&state.gameMode!=='multiplayer') useAbility('q');
  if (e.code === 'KeyE' && !e.repeat&&!state.lobbyParkour&&state.gameMode!=='multiplayer') useAbility('e');
});
document.addEventListener('keyup', (e) => {keys.delete(e.code);if(e.code==='Space')releaseTraversalCharge(performance.now(),e);});

const aimProfiles={
  hip:{id:'hip',zoom:0,transition:14,moveScale:1,spreadMultiplier:1,sensitivityWeight:0},
  sniper:{id:'sniper',scope:true,targetFov:20,transition:8,moveScale:.62,spreadMultiplier:.08,sensitivityWeight:1},
  rifle:{id:'rifle',zoom:10,transition:12,moveScale:.82,spreadMultiplier:.34,sensitivityWeight:.58},
  smg:{id:'smg',zoom:6,transition:17,moveScale:.94,spreadMultiplier:.58,sensitivityWeight:.34},
  pistol:{id:'pistol',zoom:5,transition:16,moveScale:.96,spreadMultiplier:.42,sensitivityWeight:.3},
  shotgun:{id:'shotgun',zoom:4,transition:12,moveScale:.9,spreadMultiplier:.72,sensitivityWeight:.3},
  heavy:{id:'heavy',zoom:8,transition:5.5,moveScale:.65,spreadMultiplier:.3,sensitivityWeight:.7},
  experimental:{id:'experimental',zoom:8,transition:9,moveScale:.8,spreadMultiplier:.24,sensitivityWeight:.65},
  utility:{id:'utility',zoom:0,transition:15,moveScale:1,spreadMultiplier:1,sensitivityWeight:0,canAim:false},
  melee:{id:'melee',zoom:0,transition:15,moveScale:1,spreadMultiplier:1,sensitivityWeight:0,canAim:false},
};
function isPlaceableWeapon(gun){return ['mine','medkit'].includes(gun.kind)||['shockMine','hardlightWall','gnomeTurret','phaseBeacon','ammoSynth'].includes(gun.effect);}
function aimProfileForGun(gun) {
  if(!gun)return aimProfiles.hip;
  let base=aimProfiles.rifle;
  if(gun.kind==='grenade'||isPlaceableWeapon(gun))base=aimProfiles.utility;
  else if(gun.kind==='knife'||gun.effect==='melee')base=aimProfiles.melee;
  else if(gun.kind==='sniper')base=aimProfiles.sniper;
  else if(gun.kind==='pistol')base=aimProfiles.pistol;
  else if(gun.kind==='smg')base=aimProfiles.smg;
  else if(gun.kind==='shotgun')base=aimProfiles.shotgun;
  else if(gun.kind==='lmg'||/HEAVY|MORTAR|CANNON/.test(gun.weaponClass||''))base=aimProfiles.heavy;
  else if(['rail','launcher','flame','recoil','void','magnet','wire','brass','crossbow'].includes(gun.kind)||gun.effect)base=aimProfiles.experimental;
  const scope=gun.model.userData.visualDefinition?.scopeProfile;if(!scope||base.canAim===false)return base;
  const transitionMs=progress.settings.reduceMotion?scope.reducedMotionTransitionMs:scope.aimTransitionMs;
  if(gun._aimProfileSource!==`${base.id}:${transitionMs}:${scope.cameraFov}`){gun._aimProfileSource=`${base.id}:${transitionMs}:${scope.cameraFov}`;gun._resolvedAimProfile={...base,scope:scope.type==='sniper',targetFov:scope.cameraFov||base.targetFov,transition:Math.max(4,2200/Math.max(80,transitionMs))};}
  return gun._resolvedAimProfile;
}
function adsPositionForGun(gun){
  const model=gun?.model;const definition=model?.userData.visualDefinition;const sight=model?.getObjectByName(model.userData.attachmentPoints?.sight||'sight-anchor');if(!sight||!definition?.scopeProfile)return[0,-.3,-.6];
  model.updateMatrix();const offset=model.userData.adsAnchorOffset||(model.userData.adsAnchorOffset=new THREE.Vector3());offset.copy(sight.position).applyMatrix4(model.matrix).applyQuaternion(weapon.quaternion);const correction=sightAnchorCorrection(offset,definition.scopeProfile);const position=model.userData.adsPosition||(model.userData.adsPosition=[0,0,0]);position[0]=correction.x;position[1]=correction.y;position[2]=correction.z;return position;
}
function updateScopeDebugOverlay(gun){
  const show=Boolean(progress.settings.scopeDebug&&state.aiming);ui.scopeDebug?.classList.toggle('active',show);ui.scopeDebug?.setAttribute('aria-hidden',String(!show));if(!show)return;const sight=gun?.model.getObjectByName(gun.model.userData.attachmentPoints?.sight||'sight-anchor');if(!sight)return;sight.getWorldPosition(scopeDebugProjection).project(camera);const x=(scopeDebugProjection.x*.5+.5)*innerWidth;const y=(-scopeDebugProjection.y*.5+.5)*innerHeight;const error=Math.hypot(x-innerWidth*.5,y-innerHeight*.5);ui.scopeDebug.style.setProperty('--anchor-x',`${x.toFixed(1)}px`);ui.scopeDebug.style.setProperty('--anchor-y',`${y.toFixed(1)}px`);setTextIfChanged(ui.scopeDebugOutput,`SHOT RAY + RETICLE // CENTERED · SIGHT ERROR ${error.toFixed(1)}PX`);
}
function enforceScopeClearance(gun=loadout[state.weaponIndex],playerVisible=true){
  if(!gun?.model)return{scopeActive:false,weaponVisible:false};
  const profile=aimProfileForGun(gun);const definition=gun.model.userData.visualDefinition;const scopeActive=Boolean(state.aiming&&profile.scope);
  const visibility=scopeDecorationVisibility(definition?.scopeProfile,state.aiming,state.aimBlend);
  weapon.visible=Boolean(playerVisible&&!state.lobbyParkour&&visibility.firstPersonWeapon);
  gun.model.traverse(child=>{if(child.userData?.scopeUnsafe)child.visible=child.name==='cosmetic-charm'?visibility.charm:visibility.decorations;});
  if(scopeActive){gun.model.userData.muzzle.intensity=0;gun.model.userData.flash.material.opacity=0;}
  return{scopeActive,weaponVisible:weapon.visible,charmVisible:visibility.charm,decorationsVisible:visibility.decorations};
}
function updateAimPresentation(dt) {
  const gun=loadout[state.weaponIndex];const profile=aimProfileForGun(gun);const targetBlend=state.aiming?1:0;
  state.aimBlend=THREE.MathUtils.damp(state.aimBlend,targetBlend,profile.transition,dt);state.crosshairKick=THREE.MathUtils.damp(state.crosshairKick,0,10,dt);
  state.aimProfile=state.aiming?profile.id:'hip';ui.crosshair.dataset.profile=state.aiming?profile.id:(gun.kind==='shotgun'?'shotgun':'hip');
  const pace=Math.hypot(state.velocity.x,state.velocity.z);const movementSpread=Math.min(9,pace*.16)+(state.onGround?0:5)+(state.sliding?3:0)+state.crosshairKick*14;
  ui.crosshair.style.setProperty('--spread',`${movementSpread.toFixed(1)}px`);ui.crosshair.style.setProperty('--shotgun-ring',String(state.aiming?.78:1.08));
  const showScope=Boolean(state.aiming&&profile.scope);ui.scope.classList.toggle('active',showScope);ui.scope.setAttribute('aria-hidden',String(!showScope));ui.crosshair.classList.toggle('scoped',showScope);ui.crosshair.classList.toggle('ads',state.aiming&&!showScope);document.body.classList.toggle('precision-scope',showScope);
  const definition=gun.model.userData.visualDefinition;enforceScopeClearance(gun);
  if(showScope)setTextIfChanged(ui.scopeLabel,`${String(definition?.scopeProfile?.magnification||8).padStart(2,'0')}×   //   HOLD BREATH`);
  updateScopeDebugOverlay(gun);
  let feedback='';let meter=state.aiming?state.aimBlend*100:0;
  if(state.throwPreview){feedback='THROW ARC // LMB RELEASE';meter=100;}
  else if(state.placementPreview){
    const forward=new THREE.Vector3();camera.getWorldDirection(forward);forward.y=0;if(forward.lengthSq()<.01)forward.set(0,0,-1);forward.normalize();
    const point=state.position.clone().addScaledVector(forward,4.2);const floor=groundHeightAt(point.x,point.z,state.position.y+.8);point.y=floor+.035;
    state.placementValid=!collides(point.x,point.z,floor+.6);state.placementPoint.copy(point);placementPreview.position.copy(point);placementPreview.visible=true;placementPreview.material.color.setHex(state.placementValid?0x67e8a5:0xff445d);
    feedback=state.placementValid?'PLACEMENT VALID // LMB DEPLOY':'PLACEMENT BLOCKED';meter=state.placementValid?100:0;
  } else placementPreview.visible=false;
  if(!feedback&&state.secondaryAction&&profile.id==='melee'){feedback='GUARD / HEAVY STRIKE READY';meter=100;}
  if(!feedback&&state.chargingGun===gun){meter=Math.min(100,(performance.now()-state.chargeStarted)/(gun.special==='toaster'?10.5:12.5));feedback=`CHARGE // ${Math.round(meter)}%`;}
  if(!feedback&&state.aiming){feedback=profile.id==='sniper'?'MAGNIFIED PRECISION // 08×':profile.id==='shotgun'?'PELLET CONE // TIGHTENED':profile.id==='heavy'?'HEAVY STABILITY // HOLD POSITION':profile.id==='experimental'?(state.chargingGun?'CHARGE BUILDING':'EXPERIMENTAL GUIDANCE'):`${profile.id.toUpperCase()} AIM // STABILIZED`;}
  ui.aimFeedback?.classList.toggle('active',Boolean(feedback));if(ui.aimFeedback){setTextIfChanged(ui.aimFeedbackLabel,feedback);ui.aimFeedback.style.setProperty('--aim-meter',`${Math.round(meter)}%`);}
}
function setAiming(active) {
  const gun = loadout[state.weaponIndex];
  const profile=aimProfileForGun(gun);
  const prepareOnly=['redFish','sockPuppet'].includes(gun.special);
  if(active&&prepareOnly&&state.locked&&!state.reloading){gun.prepareStarted=performance.now();ui.status.textContent=`${gun.name} // PREPARING`;}
  if(!active&&prepareOnly&&gun.prepareStarted){gun.chargeScale=THREE.MathUtils.clamp((performance.now()-gun.prepareStarted)/900,.2,1);gun.prepareStarted=0;ui.status.textContent=`${gun.name} // ${(gun.chargeScale*100).toFixed(0)}% READY`;}
  const allowed=Boolean(active&&state.locked&&!state.lobbyParkour&&!state.countdownActive&&!state.reloading&&!state.armoryOpen&&!state.dead&&!state.completed);
  const wasAiming=state.aiming;state.secondaryAction=allowed;state.aiming=Boolean(allowed&&profile.canAim!==false&&!prepareOnly);if(state.aiming!==wasAiming)beginWeaponVisualAnimation(gun,state.aiming?'aimEnter':'aimExit');
  state.throwPreview=Boolean(allowed&&gun.kind==='grenade');state.placementPreview=Boolean(allowed&&isPlaceableWeapon(gun));
  if(active&&state.locked&&(gun.kind==='knife'||gun.effect==='melee')&&performance.now()>=state.saberCooldownUntil){state.saberGuardUntil=performance.now()+520;ui.status.textContent=`${gun.name} // GUARD READY`;}
  trajectoryDots.visible = state.throwPreview || (state.aiming && gun.special === 'ricochet');
  if(!allowed){trajectoryLanding.visible=false;placementPreview.visible=false;ui.scope.classList.remove('active');ui.scope.setAttribute('aria-hidden','true');ui.scopeDebug?.classList.remove('active');ui.scopeDebug?.setAttribute('aria-hidden','true');ui.crosshair.classList.remove('scoped','ads');ui.aimFeedback?.classList.remove('active');document.body.classList.remove('precision-scope');}
  enforceScopeClearance(gun);
}
document.addEventListener('contextmenu', (e) => e.preventDefault());
document.addEventListener('mousedown', (e) => {
  if (e.button === 2) setAiming(true);
  if (e.button === 0 && state.locked&&!state.lobbyParkour) {
    state.mouseDown = true;
    const gun = loadout[state.weaponIndex];
    if (['harmonic','toaster','rubberChicken'].includes(gun.special) && !state.reloading && gun.ammo > 0) {
      state.chargingGun = gun; state.chargeStarted = performance.now(); ui.status.textContent = `${gun.name} // CHARGING`; if(gun.category==='SILLY')chaosSound(gun.special==='rubberChicken'?'squeak':'charge',260);
    } else fire();
  }
});
document.addEventListener('mouseup', (e) => {
  if (e.button === 2) setAiming(false);
  if (e.button === 0) {
    state.mouseDown = false;
    if (state.chargingGun) {
      const gun = state.chargingGun; gun.chargeScale = THREE.MathUtils.clamp((performance.now() - state.chargeStarted) / (gun.special==='toaster'?1050:1250), .18, 1);
      state.chargingGun = null; fire();
    }
  }
});
document.addEventListener('wheel', (e) => {
  if (!state.locked||state.lobbyParkour) return;
  const current = Math.max(0, quickSlots.indexOf(state.weaponIndex));
  equipQuickSlot((current + (e.deltaY > 0 ? 1 : quickSlots.length - 1)) % quickSlots.length);
}, { passive: true });

function releaseGrapple(message = '') {
  if (!state.grapple) return;
  const wasOrbital=state.grapple.orbital;state.lastGrappleReleaseAt=performance.now();if(!state.dead)addMovementCombo(wasOrbital?'KINETIC SLINGSHOT RELEASE':'GRAPPLE RELEASE',wasOrbital?85:65);
  world.remove(state.grapple.line); state.grapple.line.geometry.dispose(); state.grapple.line.material.dispose(); state.grapple = null;
  if (message) ui.status.textContent = message;
  refreshAbilityHUD(performance.now());
}

function activateGrapple(now, slot = 'q', orbital = false) {
  if(state.gameMode==='parkour'&&state.parkour?.variant?.modifiers?.disableGrapple){ui.status.textContent='GROUNDED VARIANT // GRAPPLE DISABLED';return false;}
  const hit = centerShotHits([...activeOccluders(), ground], 90)[0];
  if (!hit) { ui.status.textContent = 'GRAPPLE // NO VALID SURFACE'; return false; }
  const geometry = new THREE.BufferGeometry().setFromPoints([camera.position, hit.point]);
  const line = new THREE.Line(geometry, new THREE.LineBasicMaterial({ color:orbital ? 0xff4fba : 0x50e5ff, transparent:true, opacity:.9 })); world.add(line);
  const radial = hit.point.clone().sub(state.position); radial.y = 0;
  const tangent = new THREE.Vector3(-radial.z, 0, radial.x).normalize();
  const look = new THREE.Vector3(); camera.getWorldDirection(look); look.y = 0;
  if (tangent.dot(look) < 0) tangent.negate();
  if (orbital) state.velocity.addScaledVector(tangent, 20);
  state.grapple = { anchor:hit.point.clone(), line, expires:now + (orbital ? 2300 : 2400), slot, orbital, orbitSign:tangent, ropeLength:Math.max(4,hit.point.distanceTo(state.position)) };
  state.impulseUntil = now + (orbital ? 2850 : 2350);
  addMovementCombo(orbital?'KINETIC SLINGSHOT':'GRAPPLE',orbital?65:50,now);
  ui.status.textContent = `${orbital ? 'KINETIC ORBIT' : 'GRAPPLE LOCK'} // ${Math.round(camera.position.distanceTo(hit.point))}M`; return true;
}

function activateCamo(now) {
  state.camoUntil = now + 3500; ui.camoOverlay.classList.add('active'); ui.status.textContent = 'TEMPORAL CAMO // PRIMARY LOCKED'; return true;
}

function activateDecoy(now) {
  const forward = new THREE.Vector3(); camera.getWorldDirection(forward); forward.y = 0; if (!forward.lengthSq()) forward.set(0,0,-1); forward.normalize();
  const position = state.position.clone().addScaledVector(forward, 3.5); position.y = groundHeightAt(position.x, position.z);
  const group = new THREE.Group(); group.position.copy(position); group.rotation.y = state.yaw; world.add(group);
  const hologramMaterial = new THREE.MeshBasicMaterial({ color:0x50e5ff, transparent:true, opacity:.32, depthWrite:false, wireframe:true });
  const torso = new THREE.Mesh(new THREE.BoxGeometry(1.15, 1.9, .65), hologramMaterial); torso.position.y = 2.8; group.add(torso);
  const head = new THREE.Mesh(new THREE.SphereGeometry(.45, 10, 7), hologramMaterial); head.position.y = 4.15; group.add(head);
  const legs = new THREE.Mesh(new THREE.BoxGeometry(.95, 1.8, .5), hologramMaterial); legs.position.y = 1.05; group.add(legs);
  const rifle = new THREE.Mesh(new THREE.BoxGeometry(.14, .15, 1.6), hologramMaterial); rifle.position.set(.46,2.9,.6); rifle.rotation.x = -.18; group.add(rifle);
  activeDecoys.push({ group, expires:now + 10000, arena:state.activeArena, phase:secureRandom() * Math.PI * 2 });
  if (activeDecoys.length > 3) removeDecoy(activeDecoys[0]);
  ui.status.textContent = 'DECOY DEPLOYED // COUNTER-PING ARMED'; return true;
}

function removeDecoy(decoy) {
  const index = activeDecoys.indexOf(decoy); if (index >= 0) activeDecoys.splice(index,1);
  world.remove(decoy.group); decoy.group.traverse(child => { child.geometry?.dispose(); child.material?.dispose(); });
}

function activateThermalSnapshot(now) {
  const forward = new THREE.Vector3(); camera.getWorldDirection(forward); forward.y = 0; forward.normalize();
  let revealed = 0;state.lastThermalAt=now;
  for (const enemy of enemies) {
    if (!enemy.alive || enemy.arena !== state.activeArena) continue;
    const offset = enemy.group.position.clone().sub(state.position); offset.y = 0;
    const distance = offset.length();
    if (distance > 95 || distance < .01 || forward.dot(offset.normalize()) < Math.cos(THREE.MathUtils.degToRad(55))) continue;
    enemy.pingedUntil = now + 4000; revealed++;
  }
  const pulseEnd = state.position.clone().addScaledVector(forward, 28).add(new THREE.Vector3(0,1.2,0));
  addBeam(camera.position.clone(), pulseEnd, 0xff6b35, 280);
  ui.status.textContent = `THERMAL SNAPSHOT // ${revealed} HOSTILE${revealed === 1 ? '' : 'S'} REVEALED`;
  if(revealed)recordChallenge('thermalReveal',revealed);
  return true;
}

function activateRepulsionNova(now) {
  const radius = 15;
  let repelled = 0; let deflected = 0;
  for (const enemy of enemies) {
    if (!enemy.alive || enemy.arena !== state.activeArena) continue;
    const push = enemy.group.position.clone().sub(state.position); push.y = 0; const distance = push.length();
    if (!distance || distance > radius) continue;
    if(enemy.eliteType==='shield'){enemy.shieldDisabledUntil=now+2200;enemy.shield.visible=false;setTimeout(()=>{if(enemy.alive&&enemy.shieldHealth>0)enemy.shield.visible=true;},2250);}
    const destination = enemy.group.position.clone().addScaledVector(push.normalize(), 15 * (1 - distance / (radius * 1.4)));
    if (!collides(destination.x,destination.z)) enemy.group.position.copy(destination);
    enemy.stunnedUntil = now + 900; repelled++;
  }
  for (const explosive of thrownExplosives) {
    const push = explosive.group.position.clone().sub(state.position); const distance = push.length();
    if (!distance || distance > radius) continue;
    explosive.stuck = false; explosive.velocity.copy(push.normalize().multiplyScalar(28)); explosive.velocity.y = Math.max(8, explosive.velocity.y); explosive.detonatesAt += 900; deflected++;
  }
  for (const wave of acousticWaves) {
    if (wave.mesh.position.distanceTo(state.position) > radius) continue;
    wave.velocity.multiplyScalar(-1.35); deflected++;
  }
  const blast = new THREE.Mesh(new THREE.SphereGeometry(1,18,12),new THREE.MeshBasicMaterial({color:0x9b6cff,wireframe:true,transparent:true,opacity:.9}));
  blast.position.copy(state.position).add(new THREE.Vector3(0,-state.eyeHeight+.6,0)); world.add(blast); queueBlast(blast,radius);
  ui.status.textContent = `REPULSION NOVA // ${repelled} PUSHED // ${deflected} DEFLECTED`; if(deflected)recordChallenge('novaDeflect',deflected); return true;
}

function removeRewindAnchor() {
  if (!state.rewind) return;
  world.remove(state.rewind.marker); state.rewind.marker.geometry.dispose(); state.rewind.marker.material.dispose(); state.rewind = null;
}

function activateQuantumRewind(now, slot) {
  if (state.rewind) {
    const anchor = state.rewind;
    state.position.copy(anchor.position); state.velocity.set(0,0,0); state.health = anchor.health; updateVitals();
    removeRewindAnchor(); state.abilityCooldownEnds[slot] = now + abilityCatalog.rewind.cooldown;
    ui.status.textContent = 'QUANTUM REWIND // POSITION + HEALTH RESTORED'; return true;
  }
  const marker = new THREE.Mesh(new THREE.TorusGeometry(.85,.08,8,28),new THREE.MeshBasicMaterial({color:0xffc857,transparent:true,opacity:.9}));
  marker.rotation.x = Math.PI / 2; marker.position.copy(state.position).add(new THREE.Vector3(0,-state.eyeHeight+.08,0)); world.add(marker);
  state.rewind = { position:state.position.clone(), health:state.health, expires:now + 5000, marker, slot };
  ui.status.textContent = 'QUANTUM ANCHOR // PRESS AGAIN WITHIN 5S'; return true;
}

function activateVectorDash(now) {
  const direction=new THREE.Vector3();camera.getWorldDirection(direction);direction.normalize();
  state.velocity.addScaledVector(direction,24);state.velocity.y=Math.max(state.velocity.y,direction.y*24+2);state.onGround=false;state.airbornePeakY=state.position.y;state.impulseUntil=now+620;state.shake=Math.max(state.shake,.07);
  createPulseBlast(state.position.clone().add(new THREE.Vector3(0,-state.eyeHeight+.2,0)),5,0x50e5ff);ui.status.textContent='VECTOR DASH // MOMENTUM PRESERVED';return true;
}

function removeHardlightRamp(ramp) {
  const rampIndex=hardlightRamps.indexOf(ramp);if(rampIndex>=0)hardlightRamps.splice(rampIndex,1);
  const surfaceIndex=platformSurfaces.indexOf(ramp.surface);if(surfaceIndex>=0)platformSurfaces.splice(surfaceIndex,1);
  const occluderIndex=occluders.indexOf(ramp.mesh);if(occluderIndex>=0)occluders.splice(occluderIndex,1);
  world.remove(ramp.mesh);ramp.mesh.geometry.dispose();ramp.mesh.material.dispose();ramp.edges.geometry.dispose();ramp.edges.material.dispose();
}

function activateHardlightRamp(now) {
  const forward=new THREE.Vector3(0,0,-1).applyAxisAngle(new THREE.Vector3(0,1,0),state.yaw).normalize();
  const length=10;const width=5;const rise=5.5;const center=state.position.clone().addScaledVector(forward,length/2+1.5);const baseHeight=groundHeightAt(center.x,center.z);
  if(collides(center.x,center.z,baseHeight+1)){ui.status.textContent='HARDLIGHT RAMP // PLACEMENT BLOCKED';return false;}
  const depth=Math.hypot(length,rise);const material=new THREE.MeshStandardMaterial({color:0x50e5ff,emissive:0x176f9d,emissiveIntensity:.8,transparent:true,opacity:.58,metalness:.22,roughness:.18,side:THREE.DoubleSide});
  const rampMesh=new THREE.Mesh(new THREE.BoxGeometry(width,.34,depth),material);rampMesh.position.set(center.x,(baseHeight+baseHeight+rise)/2-.12,center.z);rampMesh.rotation.order='YXZ';rampMesh.rotation.y=state.yaw+Math.PI;rampMesh.rotation.x=-Math.atan2(rise,length);rampMesh.userData.arena=state.activeArena;world.add(rampMesh);
  const edges=new THREE.LineSegments(new THREE.EdgesGeometry(rampMesh.geometry),new THREE.LineBasicMaterial({color:0xe8ffff,transparent:true,opacity:.9}));rampMesh.add(edges);
  const surface={type:'orientedRamp',x:center.x,z:center.z,w:width,length,angle:state.yaw+Math.PI,startHeight:baseHeight,endHeight:baseHeight+rise,arena:state.activeArena,mesh:rampMesh};platformSurfaces.push(surface);occluders.push(rampMesh);
  hardlightRamps.push({mesh:rampMesh,edges,surface,expires:now+8000});createPulseBlast(state.position.clone().add(new THREE.Vector3(0,-state.eyeHeight+.15,0)),4.5,0x50e5ff);ui.status.textContent='HARDLIGHT RAMP // 8 SECONDS';return true;
}

function useAbility(slot) {
  if (!state.started || state.countdownActive || state.dead || state.completed || state.armoryOpen) return;
  const id = progress.abilities[slot]; const ability = abilityCatalog[id]; const now = performance.now();
  if (state.grapple?.slot === slot) { releaseGrapple('SLINGSHOT RELEASE // MOMENTUM HELD'); return; }
  if (id === 'rewind' && state.rewind?.slot === slot) { activateQuantumRewind(now,slot); refreshAbilityHUD(now); return; }
  if (now < state.abilityCooldownEnds[slot]) { ui.status.textContent = `${ability.name} // ${((state.abilityCooldownEnds[slot]-now)/1000).toFixed(1)}S`; return; }
  const activated = id === 'kinetic' ? activateGrapple(now,slot,true) : id === 'snapshot' ? activateThermalSnapshot(now) : id === 'nova' ? activateRepulsionNova(now) : id === 'rewind' ? activateQuantumRewind(now,slot) : id === 'grapple' ? activateGrapple(now,slot,false) : id === 'camo' ? activateCamo(now) : id === 'vector' ? activateVectorDash(now) : id === 'ramp' ? activateHardlightRamp(now) : activateDecoy(now);
  if (activated) { const profile=ABILITY_VISUAL_PROFILES[id];state.abilityVisual=profile?{id,profile,phase:'cast',startedAt:now,endsAt:now+1000}:null;document.body.dataset.abilityVisual=id;document.body.dataset.abilityPhase='cast';progress.stats.abilityUses[id]=(progress.stats.abilityUses[id]||0)+1; saveProgress(); }
  if (activated && id !== 'rewind') state.abilityCooldownEnds[slot] = now + ability.cooldown*(state.parkour?.variant?.modifiers?.grappleCooldownScale&&['kinetic','grapple'].includes(id)?state.parkour.variant.modifiers.grappleCooldownScale:1);
  refreshAbilityHUD(now);
}

function hasPassive(id) { return progress.passives.includes(id); }

function refillActiveSniper(reason) {
  const gun = loadout[state.weaponIndex];
  if (!hasPassive('momentum') || gun.kind !== 'sniper' || gun.ammo >= gun.magSize || gun.reserve <= 0) return;
  gun.ammo++; gun.reserve--; updateAmmo(); ui.status.textContent = `${reason} // +1 ${gun.name}`;
}

function triggerVelocityConversion(reason) {
  if (!hasPassive('velocity')) return;
  state.velocityBoostUntil = performance.now() + 3000; ui.status.textContent = `${reason} // VELOCITY CONVERSION 3S`;
}

function refreshAbilityHUD(now) {
  for (const slot of ['q','e']) {
    const id = progress.abilities[slot]; const ability = abilityCatalog[id];
    const remaining = Math.max(0, state.abilityCooldownEnds[slot] - now); const cooldownProgress = remaining / ability.cooldown;
    ui.abilityNames[slot].textContent = ability.name;
    ui.abilityCooldowns[slot].style.setProperty('--ability-progress', cooldownProgress); ui.abilityCooldowns[slot].classList.toggle('running', remaining > 0);
    const rewinding = id === 'rewind' && state.rewind?.slot === slot;
    const active = id === 'camo' && now < state.camoUntil ? `${Math.max(0,(state.camoUntil-now)/1000).toFixed(1)}S CLOAK` : state.grapple?.slot === slot ? 'TETHERED // PRESS TO RELEASE' : rewinding ? `RETURN ${(state.rewind.expires-now)/1000 < 0 ? '0.0' : ((state.rewind.expires-now)/1000).toFixed(1)}S` : remaining > 0 ? `${(remaining/1000).toFixed(1)}S COOLDOWN` : 'READY';
    ui.abilityStates[slot].textContent = active;
  }
}

function updateAbilitySystems(dt, now) {
  if(state.abilityVisual){const elapsed=now-state.abilityVisual.startedAt;state.abilityVisual.phase=elapsed<180?'anticipation':elapsed<760?'active':'end';document.body.dataset.abilityPhase=state.abilityVisual.phase;if(now>=state.abilityVisual.endsAt){state.abilityVisual=null;delete document.body.dataset.abilityVisual;delete document.body.dataset.abilityPhase;}}
  if (state.grapple) {
    const pull = state.grapple.anchor.clone().sub(state.position); const distance = pull.length();
    state.grapple.line.geometry.setFromPoints([camera.position.clone(), state.grapple.anchor]);
    if (now >= state.grapple.expires || distance < 3.6) releaseGrapple('SLINGSHOT RELEASE // MOMENTUM HELD');
    else {
      const radial = pull.normalize();
      if(state.grapple.orbital){const strength=20+Math.min(14,distance*.2);state.velocity.addScaledVector(radial,strength*dt);state.velocity.addScaledVector(state.grapple.orbitSign,24*dt);}
      else {
        // A traversal grapple is a taut rope: remove only outward radial speed,
        // then let gravity and player momentum create a predictable swing.
        const radialSpeed=state.velocity.dot(radial);if(distance>=state.grapple.ropeLength*.96&&radialSpeed<0)state.velocity.addScaledVector(radial,-radialSpeed);
        const tension=Math.max(0,distance-state.grapple.ropeLength*.82);state.velocity.addScaledVector(radial,(8+tension*5.5)*dt);
        const cameraForward=new THREE.Vector3();camera.getWorldDirection(cameraForward);cameraForward.y=0;if(cameraForward.lengthSq())state.velocity.addScaledVector(cameraForward.normalize(),5.5*dt);
      }
      state.impulseUntil = Math.max(state.impulseUntil,now+220);
    }
  }
  if (state.rewind) {
    state.rewind.marker.rotation.z += dt * 3.5; state.rewind.marker.scale.setScalar(.9 + Math.sin(now*.01)*.12);
    if (now >= state.rewind.expires) { const slot=state.rewind.slot; removeRewindAnchor(); state.abilityCooldownEnds[slot]=now+abilityCatalog.rewind.cooldown; ui.status.textContent='QUANTUM ANCHOR EXPIRED'; }
  }
  const camouflaged = now < state.camoUntil; ui.camoOverlay.classList.toggle('active', camouflaged);
  for (const decoy of [...activeDecoys]) {
    if(decoy.moving){
      decoy.group.position.x+=Math.sin(now*.0015+decoy.phase)*dt*2.4;
      decoy.group.position.z+=Math.cos(now*.0015+decoy.phase)*dt*2.4;
    }
    decoy.group.position.y = groundHeightAt(decoy.group.position.x,decoy.group.position.z) + Math.sin(now * .004 + decoy.phase) * .06;
    decoy.group.visible = Math.sin(now * .018 + decoy.phase) > -.78;
    if (now >= decoy.expires) removeDecoy(decoy);
  }
  for(const ramp of [...hardlightRamps]){const remaining=Math.max(0,ramp.expires-now);ramp.mesh.material.opacity=.32+.26*Math.min(1,remaining/1200);ramp.edges.material.opacity=.45+.45*Math.min(1,remaining/1200);if(now>=ramp.expires)removeHardlightRamp(ramp);}
}

const PLAYER_RADIUS=.45;
const PLAYER_HEAD_CLEARANCE=.16;
const MAX_STEP_HEIGHT=.58;
function colliderIsActive(collider){return collider.active&&(!state.lobbyParkour||collider.lobbyOnly)&&collider.mesh?.visible!==false&&!collider.mesh?.userData.voided;}
function outsidePlayableBounds(x,z){
  if(state.lobbyParkour){const bounds=CHILL_DECK_LAYOUT.hubBounds,margin=CHILL_DECK_LAYOUT.resetMargin;return x<bounds.minX-margin||x>bounds.maxX+margin||z<bounds.minZ-margin||z>bounds.maxZ+margin;}
  return Math.abs(x)>345||Math.abs(z)>345;
}
function collides(x, z, height = null) {
  if(outsidePlayableBounds(x,z))return true;
  return colliders.some(c => colliderIsActive(c) && x > c.minX - PLAYER_RADIUS && x < c.maxX + PLAYER_RADIUS && z > c.minZ - PLAYER_RADIUS && z < c.maxZ + PLAYER_RADIUS && (height === null || (height+4.8>c.minY+.04&&height<c.maxY-.04)));
}

function activeOccluders() { return occluders.filter(object => object.visible && !object.userData.voided); }
function activeShootables() { return shootables.filter(object => (object.userData.target?.arena ?? object.userData.arena ?? state.activeArena)===state.activeArena); }

function surfaceHeightAt(surface,x,z) {
  if(surface.active===false||(state.lobbyParkour&&!surface.lobbyOnly)||surface.mesh?.visible===false||surface.mesh?.userData.voided)return null;
  if (surface.type === 'rect' && Math.abs(x - surface.x) <= surface.w / 2 && Math.abs(z - surface.z) <= surface.d / 2) return surface.height;
  if(surface.type==='orientedRect'){
    const dx=x-surface.x;const dz=z-surface.z;const localX=dx*Math.cos(surface.angle)-dz*Math.sin(surface.angle);const localZ=dx*Math.sin(surface.angle)+dz*Math.cos(surface.angle);
    if(Math.abs(localX)<=surface.w/2&&Math.abs(localZ)<=surface.d/2)return surface.height;
  }
  if (surface.type === 'ring') {const radius=Math.hypot(x-surface.x,z-surface.z);if(radius>=surface.inner&&radius<=surface.outer)return surface.height;}
  if (surface.type === 'ramp') {
    const along=surface.axis==='x'?x-surface.x:z-surface.z;const across=surface.axis==='x'?z-surface.z:x-surface.x;
    if(Math.abs(along)<=surface.length/2&&Math.abs(across)<=surface.w/2)return THREE.MathUtils.lerp(surface.startHeight,surface.endHeight,THREE.MathUtils.clamp(along/surface.length+.5,0,1));
  }
  if(surface.type==='orientedRamp'){
    const dx=x-surface.x;const dz=z-surface.z;const along=dx*Math.sin(surface.angle)+dz*Math.cos(surface.angle);const across=dx*Math.cos(surface.angle)-dz*Math.sin(surface.angle);
    if(Math.abs(along)<=surface.length/2&&Math.abs(across)<=surface.w/2)return THREE.MathUtils.lerp(surface.startHeight,surface.endHeight,THREE.MathUtils.clamp(along/surface.length+.5,0,1));
  }
  if(surface.type==='disc'&&Math.hypot(x-surface.x,z-surface.z)<=surface.radius)return surface.height;
  return null;
}

function groundHeightAt(x, z, maximumHeight = Infinity) {
  let height = maximumHeight>=0?0:-25;
  for (const surface of platformSurfaces) {
    const candidate=surfaceHeightAt(surface,x,z);if(candidate!==null&&candidate<=maximumHeight+.001)height=Math.max(height,candidate);
  }
  const hole = voidZones.find(zone => zone.floor && performance.now() < zone.expires && Math.hypot(x - zone.point.x, z - zone.point.z) <= zone.radius);
  if (hole) return -25;
  return height;
}

function coveredRampCollision(x,z){
  return platformSurfaces.some(surface=>{if(surface.type!=='orientedRamp'||!surface.covered||surface.active===false)return false;const dx=x-surface.x;const dz=z-surface.z;const along=dx*Math.sin(surface.angle)+dz*Math.cos(surface.angle);const across=dx*Math.cos(surface.angle)-dz*Math.sin(surface.angle);return Math.abs(along)<surface.length/2-.35&&Math.abs(across)>surface.w/2-PLAYER_RADIUS&&Math.abs(across)<surface.w/2+1.1;});
}
function playerCollidesAt(x,z,eyeY,eyeHeight=state.eyeHeight){
  if(outsidePlayableBounds(x,z)||coveredRampCollision(x,z))return true;
  const feet=eyeY-eyeHeight;const head=eyeY+PLAYER_HEAD_CLEARANCE;
  const capsule={x,z,radius:PLAYER_RADIUS,feet,head};
  if(colliders.some(c=>colliderIsActive(c)&&capsuleIntersectsAabb(capsule,c)))return true;
  return activeSolidActors().some(actor=>{
    const base=actor.group.position.y,maxY=base+(actor.kind==='dummy'?7.75:5.65);
    return feet<maxY-.08&&head>base+.08&&circlesOverlap({x,z,radius:PLAYER_RADIUS},{x:actor.group.position.x,z:actor.group.position.z,radius:actor.kind==='dummy'?1.12:.72},.05);
  });
}
function activeSolidActors(exclude=null){
  if(state.lobbyParkour)return[];
  return [...dummies,...enemies].filter(actor=>actor!==exclude&&actor.alive&&actor.arena===state.activeArena&&actor.group.visible!==false);
}
function actorPlacementBlocked(actor,x,z,ignoredActor=null){
  if(collides(x,z,actor.group.position.y))return true;
  const body={x,z,radius:.72};
  if(!state.dead&&circlesOverlap(body,{x:state.position.x,z:state.position.z,radius:PLAYER_RADIUS},.12))return true;
  return activeSolidActors(actor).some(other=>other!==ignoredActor&&circlesOverlap(body,{x:other.group.position.x,z:other.group.position.z,radius:other.kind==='dummy'?1.12:.72},.08));
}
function actorMoveCollides(actor,x,z){return actorPlacementBlocked(actor,x,z);}
function separateActiveActors(){
  const actors=activeSolidActors();
  for(let pass=0;pass<2;pass++){
    if(!state.dead)for(const actor of actors){
      if(actor.kind==='dummy'||Math.abs(actor.group.position.y-(state.position.y-state.eyeHeight))>6)continue;
      const result=separateCirclePair({x:state.position.x,z:state.position.z,radius:PLAYER_RADIUS,fixed:true},{x:actor.group.position.x,z:actor.group.position.z,radius:.72},.12);
      if(result.overlap&&!actorPlacementBlocked(actor,result.b.x,result.b.z)){actor.group.position.x=result.b.x;actor.group.position.z=result.b.z;}
    }
    for(let index=0;index<actors.length;index++)for(let otherIndex=index+1;otherIndex<actors.length;otherIndex++){
      const a=actors[index],b=actors[otherIndex];if(Math.abs(a.group.position.y-b.group.position.y)>6)continue;
      const result=separateCirclePair({x:a.group.position.x,z:a.group.position.z,radius:a.kind==='dummy'?1.12:.72,fixed:a.kind==='dummy'},{x:b.group.position.x,z:b.group.position.z,radius:b.kind==='dummy'?1.12:.72,fixed:b.kind==='dummy'},.08);
      if(!result.overlap)continue;
      if(a.kind!=='dummy'&&!actorPlacementBlocked(a,result.a.x,result.a.z,b)){a.group.position.x=result.a.x;a.group.position.z=result.a.z;}
      if(b.kind!=='dummy'&&!actorPlacementBlocked(b,result.b.x,result.b.z,a)){b.group.position.x=result.b.x;b.group.position.z=result.b.z;}
    }
  }
}
function ceilingHeightForSweep(x,z,previousHead,nextHead){
  let ceiling=Infinity;
  for(const collider of colliders){if(!colliderIsActive(collider)||x<=collider.minX-PLAYER_RADIUS||x>=collider.maxX+PLAYER_RADIUS||z<=collider.minZ-PLAYER_RADIUS||z>=collider.maxZ+PLAYER_RADIUS)continue;if(previousHead<=collider.minY+.05&&nextHead>=collider.minY-.02)ceiling=Math.min(ceiling,collider.minY);}
  for(const surface of platformSurfaces){if(!['ramp','orientedRamp'].includes(surface.type))continue;const floor=surfaceHeightAt(surface,x,z);if(floor===null)continue;const underside=floor-.82;if(previousHead<=underside+.05&&nextHead>=underside-.02)ceiling=Math.min(ceiling,underside);if(surface.covered){const roof=floor+surface.ceilingClearance;if(previousHead<=roof+.05&&nextHead>=roof-.02)ceiling=Math.min(ceiling,roof);}}
  return ceiling;
}
function playerStandingOnSurface(surface){const height=surfaceHeightAt(surface,state.position.x,state.position.z);return height!==null&&state.onGround&&Math.abs((state.position.y-state.eyeHeight)-height)<.22;}

function isOnRamp(x, z) {
  return platformSurfaces.some(surface => {
    if (surface.type === 'orientedRamp') {
      const dx=x-surface.x; const dz=z-surface.z;
      const along=dx*Math.sin(surface.angle)+dz*Math.cos(surface.angle); const across=dx*Math.cos(surface.angle)-dz*Math.sin(surface.angle);
      return Math.abs(along)<=surface.length/2 && Math.abs(across)<=surface.w/2;
    }
    if (surface.type !== 'ramp') return false;
    const along = surface.axis === 'x' ? x - surface.x : z - surface.z;
    const across = surface.axis === 'x' ? z - surface.z : x - surface.x;
    return Math.abs(along) <= surface.length / 2 && Math.abs(across) <= surface.w / 2;
  });
}

function tryStartVault(direction,now=performance.now()){
  if(!state.onGround||state.vault||state.zipline||state.crouching||direction.lengthSq()<.2)return false;
  const travel=direction.clone().setY(0).normalize();const feetY=state.position.y-state.eyeHeight;let candidate=null;const reach=LOBBY_PARKOUR.vaultReach*(progress.settings.parkourAssist?1.25:1);
  for(const collider of colliders){
    if(!colliderIsActive(collider))continue;
    let intersectsApproach=false;
    for(let distance=.28;distance<=reach;distance+=.18){const x=state.position.x+travel.x*distance;const z=state.position.z+travel.z*distance;if(x>collider.minX-PLAYER_RADIUS&&x<collider.maxX+PLAYER_RADIUS&&z>collider.minZ-PLAYER_RADIUS&&z<collider.maxZ+PLAYER_RADIUS){intersectsApproach=true;break;}}
    if(!intersectsApproach)continue;
    const alongX=Math.abs(travel.x)>=Math.abs(travel.z);const depth=alongX?collider.maxX-collider.minX:collider.maxZ-collider.minZ;
    const exitX=alongX?(travel.x>=0?collider.maxX+PLAYER_RADIUS+.2:collider.minX-PLAYER_RADIUS-.2):state.position.x+travel.x*(depth+PLAYER_RADIUS+.65);
    const exitZ=!alongX?(travel.z>=0?collider.maxZ+PLAYER_RADIUS+.2:collider.minZ-PLAYER_RADIUS-.2):state.position.z+travel.z*(depth+PLAYER_RADIUS+.65);
    const landingFloor=groundHeightAt(exitX,exitZ,feetY+MAX_STEP_HEIGHT+.12);const landingEye=landingFloor+state.eyeHeight;const obstacleHeight=collider.maxY-feetY;
    const middleX=(state.position.x+exitX)/2;const middleZ=(state.position.z+exitZ)/2;const clearanceEye=collider.maxY+state.eyeHeight+.18;
    const landingClear=!playerCollidesAt(exitX,exitZ,landingEye);const ceilingClear=!playerCollidesAt(middleX,middleZ,clearanceEye);
    const pathClear=[.25,.5,.75].every(t=>!playerCollidesAt(THREE.MathUtils.lerp(state.position.x,exitX,t),THREE.MathUtils.lerp(state.position.z,exitZ,t),Math.max(state.position.y,landingEye)+Math.sin(t*Math.PI)*(obstacleHeight+.45)));
    const movingSpeed=collider.dynamicVelocity||0;const hazardous=Boolean(collider.hazardous||collider.mesh?.userData.hazardous);
    if(!vaultCandidateValid({height:obstacleHeight,width:depth,landingClear,ceilingClear,pathClear,movingSpeed,hazardous,playerHeight:state.eyeHeight}))continue;
    candidate={collider,exit:new THREE.Vector3(exitX,landingEye,exitZ)};break;
  }
  if(!candidate)return false;
  const start=state.position.clone();const requiredEye=candidate.collider.maxY+state.eyeHeight+.16;const apex=Math.max(.42,requiredEye-Math.max(start.y,candidate.exit.y));const horizontalSpeed=Math.hypot(state.velocity.x,state.velocity.z);
  state.vault={kind:'vault',start,end:candidate.exit,started:now,duration:300,blockFireUntil:now+150,apex,direction:travel,speed:Math.max(7,horizontalSpeed*.82)};state.sliding=false;state.onGround=false;state.velocity.set(0,0,0);state.airbornePeakY=Math.max(state.airbornePeakY,start.y+apex);completeTraversalTutorial('vault');addMovementCombo('WALL VAULT',45,now);ui.status.textContent='VAULT // CLEAR';return true;
}
function tryStartMantle(direction,now=performance.now()){
  if(state.vault||state.zipline||direction.lengthSq()<.2)return false;
  const travel=direction.clone().setY(0).normalize();const feetY=state.position.y-state.eyeHeight;
  for(const collider of colliders){
    if(!colliderIsActive(collider))continue;const probeX=state.position.x+travel.x*1.05;const probeZ=state.position.z+travel.z*1.05;
    if(probeX<=collider.minX-PLAYER_RADIUS||probeX>=collider.maxX+PLAYER_RADIUS||probeZ<=collider.minZ-PLAYER_RADIUS||probeZ>=collider.maxZ+PLAYER_RADIUS)continue;
    const climb=collider.maxY-feetY;
    const landingX=THREE.MathUtils.clamp(probeX,collider.minX+PLAYER_RADIUS+.08,collider.maxX-PLAYER_RADIUS-.08);const landingZ=THREE.MathUtils.clamp(probeZ,collider.minZ+PLAYER_RADIUS+.08,collider.maxZ-PLAYER_RADIUS-.08);
    const support=groundHeightAt(landingX,landingZ,collider.maxY+.08);if(Math.abs(support-collider.maxY)>.18)continue;
    const end=new THREE.Vector3(landingX,support+state.eyeHeight,landingZ);const standingRoom=!playerCollidesAt(end.x,end.z,end.y);const pathClear=!playerCollidesAt((state.position.x+end.x)/2,(state.position.z+end.z)/2,collider.maxY+state.eyeHeight+.12);
    if(!mantleCandidateValid({height:climb,standingRoom,pathClear,hazardous:Boolean(collider.hazardous||collider.mesh?.userData.hazardous),playerHeight:state.eyeHeight}))continue;
    const start=state.position.clone();state.vault={kind:'mantle',start,end,started:now,duration:550,blockFireUntil:now+260,apex:Math.max(.5,collider.maxY+state.eyeHeight-start.y+.12),direction:travel,speed:Math.max(5.5,Math.hypot(state.velocity.x,state.velocity.z)*.6)};state.velocity.set(0,0,0);endWallRun(now);completeTraversalTutorial('mantle');addMovementCombo('LEDGE MANTLE',55,now);ui.status.textContent='LEDGE GRAB // PULL UP';return true;
  }
  return false;
}
function tryStartLedgeGrab(direction,now=performance.now()){
  if(state.onGround||state.vault||state.zipline||state.traversal.ledgeHang||state.velocity.y>0||direction.lengthSq()<.2)return false;
  const travel=direction.clone().setY(0).normalize();const feetY=state.position.y-state.eyeHeight;const reach=progress.settings.parkourAssist?1.35:1.05;
  for(const collider of colliders){
    if(!colliderIsActive(collider))continue;const probeX=state.position.x+travel.x*reach;const probeZ=state.position.z+travel.z*reach;
    if(probeX<=collider.minX-PLAYER_RADIUS||probeX>=collider.maxX+PLAYER_RADIUS||probeZ<=collider.minZ-PLAYER_RADIUS||probeZ>=collider.maxZ+PLAYER_RADIUS)continue;
    const climb=collider.maxY-feetY;const landingX=THREE.MathUtils.clamp(probeX,collider.minX+PLAYER_RADIUS+.08,collider.maxX-PLAYER_RADIUS-.08);const landingZ=THREE.MathUtils.clamp(probeZ,collider.minZ+PLAYER_RADIUS+.08,collider.maxZ-PLAYER_RADIUS-.08);const support=groundHeightAt(landingX,landingZ,collider.maxY+.08);const end=new THREE.Vector3(landingX,support+state.eyeHeight,landingZ);const standingRoom=Math.abs(support-collider.maxY)<.18&&!playerCollidesAt(end.x,end.z,end.y);traversalHint('ledgeGrab','LOOK AT THE LEDGE TO GRAB');
    if(!ledgeGrabValid({descending:true,approachingFront:true,topAboveFeet:climb,standingRoom,underside:state.position.y>collider.maxY+state.eyeHeight,thin:Math.max(collider.maxX-collider.minX,collider.maxZ-collider.minZ)<.5,hazardous:Boolean(collider.hazardous||collider.mesh?.userData.hazardous),playerHeight:state.eyeHeight}))continue;
    const hang=new THREE.Vector3(state.position.x,state.position.y,state.position.z);hang.x=landingX-travel.x*(PLAYER_RADIUS+.18);hang.z=landingZ-travel.z*(PLAYER_RADIUS+.18);hang.y=collider.maxY-.2;
    if(playerCollidesAt(hang.x,hang.z,hang.y))continue;
    state.traversal.ledgeHang={collider,hang,end,direction:travel,startedAt:now};state.position.copy(hang);state.velocity.set(0,0,0);endWallRun(now);completeTraversalTutorial('ledgeGrab');ui.status.textContent='LEDGE GRAB // RELEASE SPACE TO CLIMB // C CROUCH TO DROP';return true;
  }
  return false;
}
function updateVaultMotion(now){
  const vault=state.vault;if(!vault)return false;const t=THREE.MathUtils.clamp((now-vault.started)/vault.duration,0,1);const eased=t*t*(3-2*t);state.position.lerpVectors(vault.start,vault.end,eased);state.position.y+=Math.sin(t*Math.PI)*vault.apex;camera.position.copy(state.position);camera.rotation.set(state.pitch,state.yaw,0);
  if(t>=1){state.position.copy(vault.end);state.velocity.set(vault.direction.x*vault.speed,0,vault.direction.z*vault.speed);state.vault=null;state.onGround=true;state.airbornePeakY=state.position.y;}return true;
}

function updateLedgeHang(move,now){
  const hang=state.traversal.ledgeHang;if(!hang)return false;state.velocity.set(0,0,0);state.onGround=false;
  const lateral=((keys.has('KeyD')||keys.has('ArrowRight'))?1:0)-((keys.has('KeyA')||keys.has('ArrowLeft'))?1:0);if(lateral){const tangent=new THREE.Vector3(-hang.direction.z,0,hang.direction.x);const candidate=state.position.clone().addScaledVector(tangent,lateral*.065);if(!playerCollidesAt(candidate.x,candidate.z,candidate.y)){state.position.copy(candidate);hang.hang.copy(candidate);hang.end.addScaledVector(tangent,lateral*.065);}}
  const release=state.traversal.bufferedJump;if(release&&now<=release.expiresAt){consumeBufferedJump(state.traversal,now);const start=state.position.clone();state.vault={kind:'mantle',start,end:hang.end.clone(),started:now,duration:550,blockFireUntil:now+260,apex:Math.max(.45,hang.end.y-start.y+.12),direction:hang.direction.clone(),speed:6};state.traversal.ledgeHang=null;completeTraversalTutorial('mantle');ui.status.textContent='MANTLE // PULLING UP';return true;}
  camera.position.copy(state.position);camera.rotation.set(state.pitch,state.yaw,state.traversal.cameraRoll);return true;
}

function wallContactForPlayer(velocityDirection){
  const feet=state.position.y-state.eyeHeight;const right=new THREE.Vector3(velocityDirection.z,0,-velocityDirection.x);let best=null;
  for(const collider of colliders){
    if(!colliderIsActive(collider)||collider.wallRunnable!==true)continue;const height=collider.maxY-collider.minY;const width=collider.maxX-collider.minX;const depth=collider.maxZ-collider.minZ;const length=Math.max(width,depth);
    if(!wallSurfaceEligible({height,length,runnable:true,moving:Boolean(collider.dynamic),curved:Boolean(collider.curved)}))continue;
    const samples=[feet+.5,feet+1.05,feet+1.55].filter(y=>y>collider.minY+.08&&y<collider.maxY-.08).length;if(samples<2)continue;
    const faces=[{distance:Math.abs(state.position.x-collider.minX),normal:new THREE.Vector3(-1,0,0),within:state.position.z>collider.minZ-.25&&state.position.z<collider.maxZ+.25},{distance:Math.abs(state.position.x-collider.maxX),normal:new THREE.Vector3(1,0,0),within:state.position.z>collider.minZ-.25&&state.position.z<collider.maxZ+.25},{distance:Math.abs(state.position.z-collider.minZ),normal:new THREE.Vector3(0,0,-1),within:state.position.x>collider.minX-.25&&state.position.x<collider.maxX+.25},{distance:Math.abs(state.position.z-collider.maxZ),normal:new THREE.Vector3(0,0,1),within:state.position.x>collider.minX-.25&&state.position.x<collider.maxX+.25}];
    const face=faces.filter(item=>item.within&&item.distance<=TRAVERSAL_CONFIG.wallDetectionDistance+(progress.settings.parkourAssist?.12:0)).sort((a,b)=>a.distance-b.distance)[0];if(!face)continue;
    const tangent=new THREE.Vector3(-face.normal.z,0,face.normal.x);const alongDot=Math.abs(velocityDirection.dot(tangent));const sideDot=face.normal.dot(right);if(alongDot<.62||Math.abs(sideDot)<.38)continue;
    if(!best||face.distance<best.distance)best={collider,wallId:collider.traversalId||(collider.traversalId=`wall-${colliders.indexOf(collider)}`),normal:face.normal,tangent,alongDot,distance:face.distance,side:Math.sign(sideDot)||1};
  }
  return best;
}
function endWallRun(now=performance.now(),message=''){
  const run=state.traversal.wallRun;if(!run)return;state.traversal.lastWallId=run.wallId;state.traversal.lastWallEndedAt=now;state.traversal.wallRun=null;state.wallRunning=false;if(message)ui.status.textContent=message;
}
function updateWallRun(move,extremeRunning,now,dt){
  const speed=Math.hypot(state.velocity.x,state.velocity.z);const velocityDirection=speed>.1?new THREE.Vector3(state.velocity.x,0,state.velocity.z).normalize():new THREE.Vector3(0,0,-1).applyAxisAngle(new THREE.Vector3(0,1,0),state.yaw);const contact=wallContactForPlayer(velocityDirection);let run=state.traversal.wallRun;
  if(run){const sameContact=contact?.wallId===run.wallId;const forward=new THREE.Vector3(0,0,-1).applyAxisAngle(new THREE.Vector3(0,1,0),state.yaw);const turnedAway=Math.abs(forward.dot(run.tangent))<.42;if(state.onGround||!sameContact||speed<8||turnedAway||now-run.startedAt>=TRAVERSAL_CONFIG.wallRunDurationMs||state.crouching){endWallRun(now);run=null;}}
  if(!run&&extremeRunning&&!state.onGround&&!contact)traversalHint('wallRun','SPRINT BESIDE THE WALL');
  if(!run&&contact&&extremeRunning&&!canStartWallRun(state.traversal,{wallId:contact.wallId,now,airborne:!state.onGround,speed,alongDot:contact.alongDot}))traversalHint('wallRun','KEEP MOVING FORWARD');
  if(!run&&contact&&extremeRunning&&canStartWallRun(state.traversal,{wallId:contact.wallId,now,airborne:!state.onGround,speed,alongDot:contact.alongDot})){run={...contact,startedAt:now};state.traversal.wallRun=run;state.wallRunning=true;if(state.traversal.charging&&state.traversal.chargeKind!=='wall'){state.traversal.chargeKind='wall';state.traversal.chargeStartedAt=now;}chaosSound('crunch',110,.18);completeTraversalTutorial('wallRun');addMovementCombo('WALL RUN',55,now);ui.status.textContent='RELEASE SPACE TO WALL JUMP';}
  if(!run)return false;
  const along=state.velocity.dot(run.tangent);const direction=Math.sign(along)||1;const retained=Math.max(13,Math.abs(along));state.velocity.x=run.tangent.x*retained*direction-run.normal.x*1.25;state.velocity.z=run.tangent.z*retained*direction-run.normal.z*1.25;state.velocity.y=Math.max(state.velocity.y,-1.4);if(now-state.traversal.lastParticleAt>95){state.traversal.lastParticleAt=now;const feet=state.position.clone();feet.y-=state.eyeHeight-.08;spawnImpact(feet,PARKOUR_SURFACE_COLORS.checkpoint);}state.wallRunning=true;return true;
}

function performWallJump(release,now){
  const run=state.traversal.wallRun;if(!run)return false;const forward=run.tangent.clone().multiplyScalar(Math.sign(state.velocity.dot(run.tangent))||1);const velocity=wallJumpVelocity({normal:run.normal,forward,horizontalSpeed:Math.hypot(state.velocity.x,state.velocity.z),charge:release.amount,chain:state.traversal.wallJumpChain});state.velocity.set(velocity.x,velocity.y,velocity.z);state.traversal.wallJumpChain++;state.traversal.lastWallJumpId=run.wallId;state.traversal.wallDetachUntil=now+TRAVERSAL_CONFIG.wallDetachMs;endWallRun(now);state.onGround=false;state.airbornePeakY=state.position.y;completeTraversalTutorial('wallJump');addMovementCombo('WALL JUMP',75,now);ui.status.textContent='WALL JUMP // MOMENTUM HELD';return true;
}

function performChargedJump(release,move,parkourModifiers,now){
  const eased=release.eased;const slideJump=state.sliding;const direction=move.lengthSq()>.1?move.clone().setY(0).normalize():new THREE.Vector3(0,0,-1).applyAxisAngle(new THREE.Vector3(0,1,0),state.yaw);const speed=Math.hypot(state.velocity.x,state.velocity.z);const forwardBoost=eased*(speed>20?5.2:2.8);state.velocity.x+=direction.x*forwardBoost;state.velocity.z+=direction.z*forwardBoost;state.velocity.y=(7.2+eased*3.45)*(parkourModifiers.jumpScale||1);state.onGround=false;state.airbornePeakY=state.position.y;state.sliding=false;
  if(slideJump){const timing=Math.max(0,1-(state.slideUntil-now)/340);const bonus=(1.05+timing*.07)/(1+state.traversal.slideJumpChain*.11);state.velocity.x*=bonus;state.velocity.z*=bonus;state.traversal.slideJumpChain++;state.traversal.lastSlideJumpAt=now;state.lastSlideCancelAt=now;refillActiveSniper('SLIDE-JUMP REFILL');triggerVelocityConversion('SLIDE-JUMP');recordChallenge('slideCancels');addMovementCombo('CHARGED SLIDE JUMP',75,now);}else addMovementCombo(`${release.tier.toUpperCase()} CHARGED JUMP`,35+Math.round(eased*25),now);
  completeTraversalTutorial('chargedJump');movementJumpSound(eased);ui.status.textContent=`${release.tier.toUpperCase()} JUMP // ${(release.amount*100).toFixed(0)}%`;return true;
}

function closestPointOnTraversalSegment(point,start,end){const delta=end.clone().sub(start);const amount=THREE.MathUtils.clamp(point.clone().sub(start).dot(delta)/Math.max(.001,delta.lengthSq()),0,1);return{point:start.clone().addScaledVector(delta,amount),amount};}
function updateAttachedTraversal(dt,now){
  const grind=state.traversal.railGrind;if(grind){const release=state.traversal.bufferedJump;grind.amount+=dt*Math.max(17,Math.hypot(state.velocity.x,state.velocity.z))/grind.rail.length;const balanceInput=((keys.has('KeyD')||keys.has('ArrowRight'))?1:0)-((keys.has('KeyA')||keys.has('ArrowLeft'))?1:0);grind.balance=THREE.MathUtils.damp(grind.balance||0,balanceInput*.55,8,dt);const point=grind.rail.start.clone().lerp(grind.rail.end,grind.amount);point.addScaledVector(new THREE.Vector3(-grind.rail.direction.z,0,grind.rail.direction.x),grind.balance);state.position.set(point.x,point.y+state.eyeHeight+.16,point.z);state.velocity.copy(grind.rail.direction).multiplyScalar(22);state.onGround=false;state.impulseUntil=now+180;if(release||grind.amount>=1){if(release)consumeBufferedJump(state.traversal,now);state.traversal.railGrind=null;state.velocity.y=release?7.8:3.5;state.velocity.addScaledVector(grind.rail.direction,release?4:0);completeTraversalTutorial('railGrind');addMovementCombo('RAIL RELEASE',70,now);}camera.position.copy(state.position);camera.rotation.set(state.pitch,state.yaw,state.traversal.cameraRoll+grind.balance*.045);return true;}
  const swing=state.traversal.barSwing;if(swing){const elapsed=(now-swing.startedAt)/1000;const phase=Math.min(1.35,elapsed*2.35);const center=swing.anchor;const forward=swing.forward;state.position.copy(center).addScaledVector(forward,Math.sin(phase)*2.1);state.position.y=center.y-1.15+Math.cos(phase)*.38;state.velocity.set(0,0,0);state.onGround=false;const release=state.traversal.bufferedJump;if(release||keys.has('KeyC')||phase>=1.32){if(release)consumeBufferedJump(state.traversal,now);state.traversal.barSwing=null;const releaseDirection=new THREE.Vector3();camera.getWorldDirection(releaseDirection);releaseDirection.y=0;if(!releaseDirection.lengthSq())releaseDirection.copy(forward);releaseDirection.normalize();const timingBonus=Math.sin(Math.min(Math.PI/2,phase))*3;state.velocity.copy(releaseDirection).multiplyScalar(15+timingBonus+(release?.eased||0)*6);state.velocity.y=release?6.7+(release.eased*1.5):-2;state.impulseUntil=now+650;completeTraversalTutorial(swing.type);addMovementCombo(swing.type==='swingingPole'?'POLE LAUNCH':'MONKEY RELEASE',65,now);}camera.position.copy(state.position);camera.rotation.set(state.pitch,state.yaw,state.traversal.cameraRoll);return true;}
  return false;
}
function tryTicTacJump(release,now){
  if(state.onGround||now<state.traversal.wallDetachUntil)return false;const feet=state.position.y-state.eyeHeight;
  for(const wall of traversalObstacles.walls){if(!wall.collider.ticTac||!obstacleActive(wall)||wall.id===state.traversal.lastWallJumpId)continue;const c=wall.collider;if(feet>c.maxY||state.position.y<c.minY)continue;const faces=[{d:Math.abs(state.position.x-c.minX),n:new THREE.Vector3(-1,0,0)},{d:Math.abs(state.position.x-c.maxX),n:new THREE.Vector3(1,0,0)},{d:Math.abs(state.position.z-c.minZ),n:new THREE.Vector3(0,0,-1)},{d:Math.abs(state.position.z-c.maxZ),n:new THREE.Vector3(0,0,1)}].sort((a,b)=>a.d-b.d);if(faces[0].d>1)return false;const look=new THREE.Vector3(0,0,-1).applyAxisAngle(new THREE.Vector3(0,1,0),state.yaw);const strength=8.5+release.eased*2;state.velocity.set(faces[0].n.x*strength+look.x*8,8.2+release.eased*1.5,faces[0].n.z*strength+look.z*8);state.traversal.lastWallJumpId=wall.id;state.traversal.wallDetachUntil=now+TRAVERSAL_CONFIG.wallDetachMs;completeTraversalTutorial('ticTac');addMovementCombo('TIC-TAC KICK',60,now);ui.status.textContent='TIC-TAC // KICKED CLEAR';return true;}
  return false;
}
function updateTraversalObstacles(now,dt){
  if(!state.started||state.dead||state.completed||state.armoryOpen)return;
  for(const beam of traversalObstacles.rotatingBeams){if(!obstacleActive(beam))continue;const wasStanding=playerStandingOnSurface(beam.surface);const angle=(now*.00055)%(Math.PI*2),delta=angle-beam.lastAngle;if(wasStanding){const offset=state.position.clone().sub(beam.origin);const cos=Math.cos(delta),sin=Math.sin(delta);state.position.x=beam.origin.x+offset.x*cos-offset.z*sin;state.position.z=beam.origin.z+offset.x*sin+offset.z*cos;}beam.lastAngle=angle;beam.item.rotation.y=angle;beam.surface.angle=angle;const halfX=Math.abs(Math.cos(angle))*beam.length/2+Math.abs(Math.sin(angle))*.5,halfZ=Math.abs(Math.sin(angle))*beam.length/2+Math.abs(Math.cos(angle))*.5;beam.collider.minX=beam.origin.x-halfX;beam.collider.maxX=beam.origin.x+halfX;beam.collider.minZ=beam.origin.z-halfZ;beam.collider.maxZ=beam.origin.z+halfZ;}
  for(const ladder of traversalObstacles.ladders){if(!obstacleActive(ladder))continue;const nextY=ladder.origin.y+Math.sin(now*.0011)*ladder.range;const carry=Math.abs(state.position.x-ladder.origin.x)<1.2&&Math.abs(state.position.z-ladder.origin.z)<1&&state.position.y>ladder.collider.minY-.4&&state.position.y<ladder.collider.maxY+1;ladder.item.position.y=nextY;ladder.collider.minY+=nextY-ladder.lastY;ladder.collider.maxY+=nextY-ladder.lastY;if(carry){state.position.y+=nextY-ladder.lastY;if(keys.has('KeyW')){state.position.y+=dt*4.5;state.velocity.y=Math.max(0,state.velocity.y);state.onGround=false;}}ladder.lastY=nextY;}
  for(const platform of traversalObstacles.crumbling){if(!obstacleActive(platform))continue;const standing=platform.surface.active!==false&&playerStandingOnSurface(platform.surface);if(standing&&!platform.touchedAt){platform.touchedAt=now;ui.status.textContent='CRUMBLING PLATFORM // MOVE';}if(platform.touchedAt&&now-platform.touchedAt>650&&platform.surface.active!==false){platform.surface.active=false;platform.collider.active=false;platform.resetAt=now+3200;}if(platform.surface.active===false){platform.item.position.y=THREE.MathUtils.damp(platform.item.position.y,platform.originY-7,2.4,dt);if(now>=platform.resetAt){platform.item.position.y=platform.originY;platform.surface.active=true;platform.collider.active=true;platform.touchedAt=0;}}}
  if(!state.traversal.railGrind&&!state.traversal.barSwing&&!state.vault){for(const rail of traversalObstacles.rails){if(!obstacleActive(rail)||state.onGround||state.velocity.y>1)continue;const closest=closestPointOnTraversalSegment(state.position,rail.start,rail.end);if(closest.point.distanceTo(state.position)<1.15){state.traversal.railGrind={rail,amount:closest.amount};state.velocity.copy(rail.direction).multiplyScalar(Math.max(17,Math.hypot(state.velocity.x,state.velocity.z)));completeTraversalTutorial('railGrind');ui.status.textContent='RAIL GRIND // RELEASE SPACE TO EXIT';break;}}}
  if(!state.traversal.barSwing&&!state.traversal.railGrind&&state.traversal.charging&&!state.onGround){for(const obstacle of [...traversalObstacles.bars,...traversalObstacles.poles]){if(!obstacleActive(obstacle))continue;const closest=closestPointOnTraversalSegment(state.position,obstacle.start,obstacle.end);if(closest.point.distanceTo(state.position)>2.3)continue;const forward=new THREE.Vector3();camera.getWorldDirection(forward);forward.y=0;if(!forward.lengthSq())forward.set(0,0,-1);state.traversal.barSwing={type:obstacle.type,anchor:closest.point,forward:forward.normalize(),startedAt:now};state.velocity.set(0,0,0);ui.status.textContent=`${obstacle.type==='swingingPole'?'SWINGING POLE':'MONKEY BARS'} // RELEASE SPACE`;break;}}
  for(const pad of traversalObstacles.precisionPads){if(!obstacleActive(pad)||now<pad.cooldown||!state.onGround)continue;const feet=state.position.y-state.eyeHeight,horizontal=Math.hypot(state.position.x-pad.position.x,state.position.z-pad.position.z);if(horizontal>pad.radius||Math.abs(feet-pad.position.y)>.8)continue;pad.cooldown=now+1200;const precision=1-horizontal/pad.radius;const direction=new THREE.Vector3(state.velocity.x,0,state.velocity.z);if(direction.lengthSq()<.1)direction.set(0,0,-1).applyAxisAngle(new THREE.Vector3(0,1,0),state.yaw);direction.normalize();state.velocity.addScaledVector(direction,4+precision*5);state.speedBoostUntil=now+800;createPulseBlast(pad.position,2.5,PARKOUR_SURFACE_COLORS.boost);addMovementCombo('PRECISION LANDING',Math.round(35+precision*30),now);}
  for(const ring of traversalObstacles.rings){if(!obstacleActive(ring)||now<ring.cooldown||ring.item.position.distanceTo(state.position)>2.3)continue;ring.cooldown=now+1100;const speed=Math.max(20,Math.hypot(state.velocity.x,state.velocity.z)*1.08);state.velocity.x=ring.direction.x*speed;state.velocity.z=ring.direction.z*speed;state.velocity.y=Math.max(state.velocity.y,ring.direction.y*speed);state.impulseUntil=now+700;addMovementCombo('MOMENTUM RING',60,now);}
  for(const vent of traversalObstacles.airVents){if(!obstacleActive(vent))continue;const horizontal=Math.hypot(state.position.x-vent.position.x,state.position.z-vent.position.z),height=state.position.y-vent.position.y;if(horizontal<vent.radius&&height>0&&height<vent.height){state.velocity.y=Math.min(8.5,state.velocity.y+26*dt);state.velocity.x+=((keys.has('KeyD')?1:0)-(keys.has('KeyA')?1:0))*5*dt;state.velocity.z+=((keys.has('KeyS')?1:0)-(keys.has('KeyW')?1:0))*5*dt;state.onGround=false;}}
  for(const wall of traversalObstacles.bounceWalls){if(!obstacleActive(wall)||now<wall.cooldown)continue;const c=wall.collider;if(state.position.x<c.minX-1||state.position.x>c.maxX+1||state.position.z<c.minZ-1||state.position.z>c.maxZ+1||state.position.y<c.minY||state.position.y>c.maxY+state.eyeHeight)continue;wall.cooldown=now+650;const speed=Math.max(15,Math.hypot(state.velocity.x,state.velocity.z));state.velocity.set(wall.direction.x*speed,Math.max(6,wall.direction.y*speed),wall.direction.z*speed);state.onGround=false;state.impulseUntil=now+450;addMovementCombo('BOUNCE WALL',55,now);}
  for(const treasure of traversalObstacles.treasures){if(!obstacleActive(treasure)||treasure.collected)continue;treasure.group.position.y=treasure.baseY+Math.sin(now*.003)*.18;treasure.core.rotation.y+=dt*1.8;treasure.ring.rotation.z+=dt;if(treasure.group.position.distanceTo(state.position)<1.8){treasure.collected=true;treasure.group.visible=false;const key=`treasure-${treasure.label}`;const first=!progress.stats.parkourCollectibles[key];progress.stats.parkourCollectibles[key]=1;if(first)addCash(25,treasure.label);saveProgress();ui.status.textContent=`OPTIONAL TREASURE // ${treasure.label}${first?' // +◆25':' // FOUND'}`;}}
}

function updatePlayer(dt) {
  const now = performance.now();
  if(state.gameMode==='parkour'&&state.parkour?.recoveryPending){state.velocity.set(0,0,0);camera.position.copy(state.position);camera.rotation.set(state.pitch,state.yaw,0);return;}
  if (state.zipline) {
    const progress = Math.min(1, (performance.now() - state.zipline.started) / state.zipline.duration);
    state.position.lerpVectors(state.zipline.from, state.zipline.to, progress); state.position.y += Math.sin(progress * Math.PI) * 1.2;
    camera.position.copy(state.position); camera.rotation.set(state.pitch, state.yaw, 0);
    if (progress >= 1) { state.zipline = null; state.velocity.set(0, 0, 0); state.onGround = false; }
    return;
  }
  if(updateAttachedTraversal(dt,now))return;
  const parkourModifiers=state.gameMode==='parkour'?(state.parkour?.variant?.modifiers||{}):{};
  const move = new THREE.Vector3((keys.has('KeyD') || keys.has('ArrowRight') ? 1 : 0) - (keys.has('KeyA') || keys.has('ArrowLeft') ? 1 : 0), 0, (keys.has('KeyS') || keys.has('ArrowDown') ? 1 : 0) - (keys.has('KeyW') || keys.has('ArrowUp') ? 1 : 0));
  if(updateLedgeHang(move,now))return;
  if(state.vault){updateVaultMotion(now);return;}
  const wasOnGround=state.onGround;if(state.onGround)state.traversal.lastGroundedAt=now;else state.airbornePeakY=Math.max(state.airbornePeakY,state.position.y);
  const chargeAmount=updateJumpCharge(state.traversal,now);const easedCharge=smoothCharge(chargeAmount);if(ui.jumpCharge){const color=chargeAmount>=1?'#ffc857':chargeAmount>=.75?'#a96cff':chargeAmount>=.28?'#50e5ff':'#ffffff';ui.jumpCharge.style.setProperty('--charge',String(chargeAmount));ui.jumpCharge.style.setProperty('--charge-color',color);ui.jumpCharge.classList.toggle('active',state.traversal.charging);ui.jumpCharge.classList.toggle('full',state.traversal.maxChargePulse);ui.jumpCharge.setAttribute('aria-hidden',String(!state.traversal.charging));}
  if(jumpChargeAudio){jumpChargeAudio.oscillator.frequency.setTargetAtTime(105+easedCharge*210,audioContext.currentTime,.035);jumpChargeAudio.gain.gain.setTargetAtTime((.008+easedCharge*.012)*progress.settings.masterVolume*progress.settings.effectsVolume,audioContext.currentTime,.04);}
  if(state.traversal.charging&&now-state.traversal.lastParticleAt>160-easedCharge*90){state.traversal.lastParticleAt=now;const feet=state.position.clone();feet.y-=state.eyeHeight-.08;const particleColor=chargeAmount>=.85?PARKOUR_SURFACE_COLORS.secret:chargeAmount>=.5?PARKOUR_SURFACE_COLORS.grapple:PARKOUR_SURFACE_COLORS.checkpoint;spawnImpact(feet,particleColor);if(chargeAmount>.8)spawnImpact(feet.clone().add(new THREE.Vector3(.18,0,-.14)),particleColor);const facing=new THREE.Vector3(0,0,-1).applyAxisAngle(new THREE.Vector3(0,1,0),state.yaw);const probe=state.position.clone().addScaledVector(facing,1.4);const feetY=state.position.y-state.eyeHeight;const vaultAhead=state.onGround&&colliders.some(collider=>colliderIsActive(collider)&&probe.x>collider.minX-PLAYER_RADIUS&&probe.x<collider.maxX+PLAYER_RADIUS&&probe.z>collider.minZ-PLAYER_RADIUS&&probe.z<collider.maxZ+PLAYER_RADIUS&&collider.maxY-feetY>=state.eyeHeight*.25&&collider.maxY-feetY<=state.eyeHeight*.7);if(vaultAhead)traversalHint('vault','RELEASE SPACE NEAR THE BARRIER TO VAULT');else if(chargeAmount>.2)traversalHint('chargedJump','RELEASE SPACE TO JUMP');}
  const impulseActive = now < state.impulseUntil;
  const extremeRunning = (keys.has('ShiftLeft') || keys.has('ShiftRight')) && move.lengthSq() > 0;
  const activeWeapon = loadout[state.weaponIndex];
  if (activeWeapon.special === 'stormcoil' && extremeRunning) activeWeapon.sprintCharge = Math.min(1, (activeWeapon.sprintCharge || 0) + dt * .28);
  if (state.chargingGun === activeWeapon) ui.status.textContent = `HARMONIC RAIL // ${Math.min(100, Math.round((now-state.chargeStarted)/12.5))}%`;
  if (state.sliding && (now >= state.slideUntil || Math.hypot(state.velocity.x, state.velocity.z) < 6)) state.sliding = false;
  state.crouching = keys.has('KeyC') && !state.sliding;
  const requestedEyeHeight=state.sliding?.88:state.crouching?1.08:1.75;
  if(Math.abs(requestedEyeHeight-state.eyeHeight)>.001){const feet=state.position.y-state.eyeHeight;const candidateEye=feet+requestedEyeHeight;if(requestedEyeHeight<state.eyeHeight||!playerCollidesAt(state.position.x,state.position.z,candidateEye,requestedEyeHeight)){state.eyeHeight=requestedEyeHeight;if(state.onGround)state.position.y=candidateEye;}else state.crouching=true;}
  if (state.sliding) {
    if (move.lengthSq()) {
      move.normalize().applyAxisAngle(new THREE.Vector3(0, 1, 0), state.yaw);
      const slideSpeed = Math.hypot(state.velocity.x, state.velocity.z);
      state.velocity.x = THREE.MathUtils.damp(state.velocity.x, move.x * slideSpeed, 1.3, dt);
      state.velocity.z = THREE.MathUtils.damp(state.velocity.z, move.z * slideSpeed, 1.3, dt);
    }
    state.velocity.x = THREE.MathUtils.damp(state.velocity.x, 0, 1.05, dt);
    state.velocity.z = THREE.MathUtils.damp(state.velocity.z, 0, 1.05, dt);
    if (isOnRamp(state.position.x,state.position.z) && now-state.lastRampBoost > 3200) { state.lastRampBoost=now; triggerVelocityConversion('RAMP CHAIN');addMovementCombo('RAMP SLIDE',55,now); }
  } else if (!impulseActive && move.lengthSq()) {
    move.normalize().applyAxisAngle(new THREE.Vector3(0, 1, 0), state.yaw);
    const heldItem = loadout[state.weaponIndex];
    const adrenalineBoost = now < state.speedBoostUntil ? 1.15 : 1;
    const camoBoost = now < state.camoUntil ? 1.2 : 1;
    const meleeBoost = heldItem.effect === 'melee' ? 1.08 : 1;
    const aimMovementScale=state.aiming?aimProfileForGun(activeWeapon).moveScale:1;
    const speed = (state.crouching ? 7.5 : extremeRunning ? 34 : 16) * adrenalineBoost * camoBoost * meleeBoost * aimMovementScale * (parkourModifiers.speedScale||1);
    state.velocity.x = THREE.MathUtils.damp(state.velocity.x, move.x * speed, extremeRunning ? 9 : 14, dt);
    state.velocity.z = THREE.MathUtils.damp(state.velocity.z, move.z * speed, extremeRunning ? 9 : 14, dt);
  } else if (!impulseActive) {
    state.velocity.x = THREE.MathUtils.damp(state.velocity.x, 0, state.crouching ? 15 : 11, dt);
    state.velocity.z = THREE.MathUtils.damp(state.velocity.z, 0, state.crouching ? 15 : 11, dt);
  }
  const traversalDirection=move.lengthSq()>.1?move.clone().setY(0).normalize():new THREE.Vector3(0,0,-1).applyAxisAngle(new THREE.Vector3(0,1,0),state.yaw);
  const buffered=state.traversal.bufferedJump;if(buffered&&now>buffered.expiresAt)consumeBufferedJump(state.traversal,now);
  if(state.traversal.bufferedJump){
    let consumed=false;
    if(state.traversal.wallRun)consumed=performWallJump(state.traversal.bufferedJump,now);
    else if(state.onGround||now-state.traversal.lastGroundedAt<=TRAVERSAL_CONFIG.coyoteMs+(progress.settings.parkourAssist?70:0)){consumed=tryStartVault(traversalDirection,now)||tryStartMantle(traversalDirection,now)||performChargedJump(state.traversal.bufferedJump,traversalDirection,parkourModifiers,now);}
    else if(state.velocity.y<=1)consumed=tryTicTacJump(state.traversal.bufferedJump,now)||tryStartMantle(traversalDirection,now);
    if(consumed){consumeBufferedJump(state.traversal,now);if(state.vault){updateVaultMotion(now);return;}}
  }
  if(!state.onGround&&parkourModifiers.crosswind)state.velocity.x+=Math.sin(now*.0013)*parkourModifiers.crosswind*dt;
  const wallRunning=updateWallRun(move,extremeRunning,now,dt);
  if(!state.onGround&&!wallRunning&&state.velocity.y<=0&&tryStartLedgeGrab(traversalDirection,now))return;
  state.velocity.y -= 18 * (parkourModifiers.gravityScale||1) * (wallRunning?TRAVERSAL_CONFIG.wallRunGravityScale:1) * dt;
  const travelX=state.velocity.x*dt;const travelZ=state.velocity.z*dt;const subdivisions=Math.max(1,Math.ceil(Math.hypot(travelX,travelZ)/.32));
  const stepX=travelX/subdivisions;const stepZ=travelZ/subdivisions;
  for(let step=0;step<subdivisions;step++){
    const feet=state.position.y-state.eyeHeight;
    const candidateX=state.position.x+stepX;const xGround=groundHeightAt(candidateX,state.position.z,feet+MAX_STEP_HEIGHT);
    const xEye=state.onGround&&xGround>feet+.015?xGround+state.eyeHeight:state.position.y;
    if(!playerCollidesAt(candidateX,state.position.z,xEye)){state.position.x=candidateX;if(state.onGround&&xGround>feet+.015)state.position.y=xEye;}else{if(Math.hypot(state.velocity.x,state.velocity.z)>18)breakMovementCombo('WALL IMPACT');state.velocity.x=0;}
    const adjustedFeet=state.position.y-state.eyeHeight;const candidateZ=state.position.z+stepZ;const zGround=groundHeightAt(state.position.x,candidateZ,adjustedFeet+MAX_STEP_HEIGHT);
    const zEye=state.onGround&&zGround>adjustedFeet+.015?zGround+state.eyeHeight:state.position.y;
    if(!playerCollidesAt(state.position.x,candidateZ,zEye)){state.position.z=candidateZ;if(state.onGround&&zGround>adjustedFeet+.015)state.position.y=zEye;}else{if(Math.hypot(state.velocity.x,state.velocity.z)>18)breakMovementCombo('WALL IMPACT');state.velocity.z=0;}
  }
  if(progress.settings.parkourAssist&&state.gameMode==='parkour'&&!state.onGround&&state.velocity.y<0){
    let best=null;for(const target of parkourLandingTargets){if(target.arena!==state.activeArena||target.surface.active===false)continue;const y=surfaceHeightAt(target.surface,target.x,target.z);const candidate={...target,y};const distance=Math.max(0,Math.hypot(target.x-state.position.x,target.z-state.position.z)-target.radius);if(distance<=1.15&&(!best||distance<best.distance))best={target:candidate,distance};}
    if(best){const correction=assistedLandingDelta({enabled:true,position:{x:state.position.x,y:state.position.y,z:state.position.z,eyeHeight:state.eyeHeight},velocity:state.velocity,target:best.target,maxStep:Math.min(.12,dt*3.6)});if(correction.active&&!playerCollidesAt(state.position.x+correction.x,state.position.z+correction.z,state.position.y)){state.position.x+=correction.x;state.position.z+=correction.z;}}
  }
  const previousEyeY=state.position.y;const previousFeet=previousEyeY-state.eyeHeight;let intendedEyeY=previousEyeY+state.velocity.y*dt;
  if(state.velocity.y>0){const ceiling=ceilingHeightForSweep(state.position.x,state.position.z,previousEyeY+PLAYER_HEAD_CLEARANCE,intendedEyeY+PLAYER_HEAD_CLEARANCE);if(Number.isFinite(ceiling)){intendedEyeY=ceiling-PLAYER_HEAD_CLEARANCE;state.velocity.y=0;}}
  const intendedFeet=intendedEyeY-state.eyeHeight;const support=groundHeightAt(state.position.x,state.position.z,previousFeet+MAX_STEP_HEIGHT);
  const crossedFloor=state.velocity.y<=0&&previousFeet>=support-.08&&intendedFeet<=support;
  const retainedGround=state.onGround&&support>=previousFeet-MAX_STEP_HEIGHT&&intendedFeet<=support+.12;
  if(crossedFloor||retainedGround){
    const floorY=support+state.eyeHeight;const landing=!state.onGround||!wasOnGround;const fallDistance=Math.max(0,state.airbornePeakY-floorY);state.position.y=floorY;
    if(landing){const rolled=now<=state.traversal.rollQueuedUntil&&Math.hypot(state.velocity.x,state.velocity.z)>12;if(rolled){state.velocity.x*=.97;state.velocity.z*=.97;state.impulseUntil=now+420;completeTraversalTutorial('landingRoll');addMovementCombo('LANDING ROLL',45,now);ui.status.textContent='LANDING ROLL // MOMENTUM SAVED';}else if(fallDistance>18){breakMovementCombo('HARD LANDING');const training=state.gameMode==='parkour'||state.lobbyParkour;const rawDamage=training?0:Math.min(32,(fallDistance-18)*.62);const finalDamage=hasPassive('softlanding')?rawDamage*.28:rawDamage;if(finalDamage>=1)damagePlayer(Math.round(finalDamage));const retention=hasPassive('softlanding')?.96:.7;state.velocity.x*=retention;state.velocity.z*=retention;state.shake=Math.max(state.shake,hasPassive('softlanding')?.025:.075);if(hasPassive('softlanding'))state.impulseUntil=now+450;}state.traversal.rollQueuedUntil=0;state.traversal.wallJumpChain=0;state.traversal.lastWallJumpId=null;if(now-state.traversal.lastSlideJumpAt>900)state.traversal.slideJumpChain=0;endWallRun(now);}
    state.velocity.y=0;state.onGround=true;state.traversal.lastGroundedAt=now;state.airbornePeakY=floorY;
  } else {state.position.y=intendedEyeY;state.onGround=false;}
  if (state.position.y < -12) { if(state.gameMode==='parkour')resetParkourToCheckpoint('FALL RECOVERY');else if(state.lobbyParkour)resetLobbyParkourRun(false);else damagePlayer(100);return; }
  const inLava=zone => state.position.y <= (zone.maxY ?? 4) && (zone.type==='rect' ? Math.abs(state.position.x-zone.x)<=zone.w/2 && Math.abs(state.position.z-zone.z)<=zone.d/2 : Math.hypot(state.position.x-zone.x,state.position.z-zone.z)<zone.radius);
  if (state.activeArena === 2 && now - state.lastHazardDamage > 500 && lavaHazards.some(inLava)) {
    state.lastHazardDamage = now;if(state.gameMode==='parkour')resetParkourToCheckpoint('MOLTEN RESET');else{damagePlayer(12);ui.status.textContent = 'MOLTEN HAZARD // MOVE';}
  }
  for (const pad of jumpPads) {
    const padFeet=state.position.y-state.eyeHeight;if (now < pad.cooldown || Math.hypot(state.position.x - pad.x, state.position.z - pad.z) > (pad.radius||3.2)+.2 || Math.abs(padFeet-(pad.surfaceY??.375))>.9 || !state.onGround) continue;
    const delta=new THREE.Vector3(pad.targetX-state.position.x,0,pad.targetZ-state.position.z);
    if (pad.launchMode==='horizontal') {
      const floor=groundHeightAt(state.position.x,state.position.z);const launch=guidedLaunchVelocity({from:{x:state.position.x,y:floor,z:state.position.z},to:{x:pad.targetX,y:pad.targetHeight,z:pad.targetZ}});
      state.velocity.set(launch.x,launch.y,launch.z); state.impulseUntil=now+launch.flightTime*1000;
    } else {
      const floor=groundHeightAt(state.position.x,state.position.z); const heightDelta=Math.max(0,pad.targetHeight-floor);
      const verticalVelocity=Math.sqrt(2*18*(heightDelta+6)); const flight=(verticalVelocity+Math.sqrt(Math.max(0,verticalVelocity*verticalVelocity-36*heightDelta)))/18;
      state.velocity.set(delta.x/Math.max(.8,flight),verticalVelocity,delta.z/Math.max(.8,flight)); state.impulseUntil=now+flight*1000;
    }
    state.position.y+=.3; state.onGround=false; state.airbornePeakY=state.position.y; state.lastLaunchAt=now; pad.cooldown=now+2600;
    ui.status.textContent = `${pad.launchMode==='horizontal'?'PISTON PLATE':'LAUNCH PAD'} // AIRBORNE`;
    addMovementCombo(pad.launchMode==='horizontal'?'HORIZONTAL PISTON':'LAUNCH PAD',pad.launchMode==='horizontal'?70:60,now);
    refillActiveSniper('LAUNCH PAD REFILL');
    triggerVelocityConversion('LAUNCH PAD');
    break;
  }
  const pace = Math.hypot(state.velocity.x, state.velocity.z);
  const bobAmount = state.sliding ? .006 : state.crouching ? .012 : .032;
  const bob = state.onGround && pace > .3 ? Math.sin(now * .011 * Math.min(pace / 7, 2.4)) * bobAmount : 0;const chargeCrouch=state.traversal.charging?easedCharge*.075:0;
  camera.position.set(state.position.x, state.position.y + bob-chargeCrouch, state.position.z);
  const shake = state.shake * progress.settings.cameraShake;
  const rollTarget=cameraRollTarget(state.traversal.wallRun?.side||0,{disabled:progress.settings.disableCameraRoll,reducedMotion:progress.settings.reduceMotion});state.traversal.cameraRoll=THREE.MathUtils.damp(state.traversal.cameraRoll,rollTarget,10,dt);
  camera.rotation.set(state.pitch + (Math.random() - .5) * shake, state.yaw + (Math.random() - .5) * shake, state.traversal.cameraRoll+(Math.random() - .5) * shake);
  state.shake = THREE.MathUtils.damp(state.shake, 0, 14, dt);
  const activeAimProfile=aimProfileForGun(activeWeapon);
  const adsFov=activeAimProfile.targetFov||Math.max(40,progress.settings.fov-(activeAimProfile.zoom||0));
  const unscopedFov=state.sliding?Math.min(105,progress.settings.fov+17):extremeRunning&&pace>12?Math.min(102,progress.settings.fov+13):progress.settings.fov;
  const targetFov=THREE.MathUtils.lerp(unscopedFov,adsFov,state.aimBlend);
  camera.fov = THREE.MathUtils.damp(camera.fov, targetFov, activeAimProfile.transition, dt);
  if (Math.abs(camera.fov - targetFov) > .01) camera.updateProjectionMatrix();
  const heldGun = loadout[state.weaponIndex];
  const viewModel=heldGun.model.userData.visualDefinition?.viewModelProfile;const hip=viewModel?.hip||[heldGun.kind==='pistol'?.57:.42,heldGun.kind==='pistol'?-.32:-.4,-.72];const hipY=state.sliding?Math.min(hip[1]-.1,-.55):state.crouching?Math.min(hip[1]-.07,-.47):hip[1];const adsPosition=adsPositionForGun(heldGun);
  const weaponTargetX=THREE.MathUtils.lerp(hip[0],adsPosition[0],state.aimBlend);const traversalLower=(state.traversal.charging?easedCharge*.1:state.traversal.wallRun?.06:0)*(1-state.aimBlend);const weaponTargetY=THREE.MathUtils.lerp(hipY,adsPosition[1],state.aimBlend)-bob*.7*(1-state.aimBlend)-traversalLower;const weaponTargetZ=THREE.MathUtils.lerp(hip[2],adsPosition[2],state.aimBlend);
  if(!state.reloading){if(state.aiming&&state.aimBlend>.995)weapon.position.set(weaponTargetX,weaponTargetY,weaponTargetZ);else{weapon.position.x=THREE.MathUtils.damp(weapon.position.x,weaponTargetX,activeAimProfile.transition,dt);weapon.position.y=THREE.MathUtils.damp(weapon.position.y,weaponTargetY,activeAimProfile.transition,dt);weapon.position.z=THREE.MathUtils.damp(weapon.position.z,weaponTargetZ,activeAimProfile.transition,dt);}}
  ui.crosshair.classList.toggle('airborne', !state.onGround && heldGun.kind === 'sniper' && !state.aiming && !hasPassive('aero'));
}

let audioContext;
let menuMusicNodes=[];
function ensureAudio() { const AudioEngine=globalThis.AudioContext||globalThis.webkitAudioContext; if(!AudioEngine)return null; audioContext||=new AudioEngine(); if(audioContext.state==='suspended')audioContext.resume(); return audioContext; }
function uiSound(type='select') {
  const context=ensureAudio(); if(!context||progress.settings.masterVolume<=0||progress.settings.effectsVolume<=0)return;
  const frequencies={hover:420,select:620,equip:760,purchase:510,error:130,reward:880,deploy:230,back:320}; const now=context.currentTime; const osc=context.createOscillator(); const gain=context.createGain();
  osc.type=type==='error'?'square':'sine'; osc.frequency.setValueAtTime(frequencies[type]||520,now); osc.frequency.exponentialRampToValueAtTime(Math.max(70,(frequencies[type]||520)*(type==='deploy'?.45:1.3)),now+.08);
  gain.gain.setValueAtTime(.035*progress.settings.masterVolume*progress.settings.effectsVolume,now); gain.gain.exponentialRampToValueAtTime(.0001,now+.095); osc.connect(gain).connect(context.destination); osc.start(now); osc.stop(now+.1);
}
function movementJumpSound(charge=0) {
  const context=ensureAudio();if(!context||progress.settings.masterVolume<=0||progress.settings.effectsVolume<=0)return;
  const now=context.currentTime;const oscillator=context.createOscillator();const gain=context.createGain();oscillator.type='triangle';oscillator.frequency.setValueAtTime(180+charge*210,now);oscillator.frequency.exponentialRampToValueAtTime(310+charge*300,now+.11);gain.gain.setValueAtTime((.025+charge*.025)*progress.settings.masterVolume*progress.settings.effectsVolume,now);gain.gain.exponentialRampToValueAtTime(.0001,now+.14);oscillator.connect(gain).connect(context.destination);oscillator.start(now);oscillator.stop(now+.15);
}
function ensureMenuMusic() {
  if(!progress.settings.musicEnabled||menuMusicNodes.length||state.started)return;
  const context=ensureAudio(); if(!context)return; const master=context.createGain(); master.gain.value=.018*progress.settings.masterVolume*progress.settings.musicVolume; master.connect(context.destination);
  [55,82.41].forEach((frequency,index)=>{const osc=context.createOscillator();osc.type=index?'sine':'triangle';osc.frequency.value=frequency;osc.detune.value=index?7:-4;osc.connect(master);osc.start();menuMusicNodes.push(osc);}); menuMusicNodes.push(master);
}
function stopMenuMusic(){menuMusicNodes.forEach(node=>{try{node.stop?.();}catch{}try{node.disconnect?.();}catch{}});menuMusicNodes=[];}
function toggleMenuMusic(){progress.settings.musicEnabled=!progress.settings.musicEnabled;if(progress.settings.musicEnabled)ensureMenuMusic();else stopMenuMusic();applySettings();saveProgress();uiSound('select');}
function shotSound(gun) {
  if(progress.settings.masterVolume<=0||progress.settings.effectsVolume<=0)return;
  ensureAudio(); if(!audioContext)return;
  const now = audioContext.currentTime;
  const osc = audioContext.createOscillator();
  const gain = audioContext.createGain();
  osc.type = gun.silent ? 'sine' : gun.weaponClass.includes('SHOTGUN') || gun.weaponClass === 'BREAK ACTION' ? 'square' : 'sawtooth'; osc.frequency.setValueAtTime(gun.tone, now); osc.frequency.exponentialRampToValueAtTime(35, now + .09);
  const effectsGain=progress.settings.masterVolume*progress.settings.effectsVolume;
  gain.gain.setValueAtTime((gun.silent ? .035 : gun.weaponClass.includes('SHOTGUN') || gun.weaponClass === 'BREAK ACTION' ? .22 : .14)*effectsGain, now); gain.gain.exponentialRampToValueAtTime(.001, now + .11);
  osc.connect(gain).connect(audioContext.destination); osc.start(now); osc.stop(now + .12);
  if(gun.category==='SILLY')chaosSound(gun.special==='baguette'?'crunch':gun.special==='rubberChicken'?'squeak':'pop',gun.tone||210,.42);
}

function chaosSound(kind='pop',pitch=220,volume=1) {
  if(progress.settings.masterVolume<=0||progress.settings.effectsVolume<=0)return;
  ensureAudio();if(!audioContext)return;const now=audioContext.currentTime;const gain=audioContext.createGain();gain.gain.setValueAtTime(.045*volume*progress.settings.masterVolume*progress.settings.effectsVolume,now);gain.gain.exponentialRampToValueAtTime(.001,now+.22);gain.connect(audioContext.destination);
  const osc=audioContext.createOscillator();osc.type=kind==='crunch'?'square':kind==='squeak'?'sine':'triangle';osc.frequency.setValueAtTime(Math.max(55,pitch),now);
  if(kind==='squeak')osc.frequency.exponentialRampToValueAtTime(Math.max(440,pitch*2.3),now+.18);else if(kind==='crunch')osc.frequency.exponentialRampToValueAtTime(48,now+.08);else osc.frequency.exponentialRampToValueAtTime(Math.max(70,pitch*.55),now+.16);
  osc.connect(gain);osc.start(now);osc.stop(now+.23);
}

function createChaosBurst(point,colors=[0xff4fba,0x50e5ff,0xffc857,0xe7ff57],count=14,spread=7) {
  const cap=progress.settings.graphicsQuality==='low'?60:100;count=Math.min(count,progress.settings.graphicsQuality==='low'?10:22);
  while(chaosParticles.length>=cap){const old=chaosParticles.shift();world.remove(old.mesh);old.mesh.material.dispose();}
  for(let index=0;index<count;index++){
    const color=colors[index%colors.length];const geometry=index%3===0?sharedChaosBoxGeometry:sharedChaosSphereGeometry;const material=new THREE.MeshBasicMaterial({color,transparent:true,opacity:1});const mesh=new THREE.Mesh(geometry,material);mesh.position.copy(point);mesh.userData.sharedGeometry=true;world.add(mesh);
    chaosParticles.push({mesh,velocity:new THREE.Vector3((Math.random()-.5)*spread,Math.random()*spread*.8+1,(Math.random()-.5)*spread),life:.65+Math.random()*.45});
  }
}

function throwVector(gun) {
  const direction = new THREE.Vector3(); camera.getWorldDirection(direction);
  const origin = camera.position.clone().addScaledVector(direction, 1.05);
  const velocity = direction.multiplyScalar(gun.throwSpeed || 28); velocity.y += 4.5;
  return { origin, velocity };
}

function pointInsideActiveCollider(point) {
  return colliders.some(collider => collider.active && point.x > collider.minX && point.x < collider.maxX && point.y > collider.minY && point.y < collider.maxY && point.z > collider.minZ && point.z < collider.maxZ);
}

function updateThrowTrajectory() {
  const gun = loadout[state.weaponIndex];
  if (state.aiming && gun.special === 'ricochet') {
    trajectoryLanding.visible=false;
    const direction = new THREE.Vector3(); camera.getWorldDirection(direction);
    const firstRay = new THREE.Raycaster(camera.position, direction, 0, gun.range || 220);
    const first = firstRay.intersectObjects(activeOccluders(), false)[0];
    const points = [camera.position.clone()];
    if (first) {
      points.push(first.point.clone());
      const normal = first.face.normal.clone().transformDirection(first.object.matrixWorld);
      const reflected = direction.clone().reflect(normal).normalize();
      const secondRay = new THREE.Raycaster(first.point.clone().addScaledVector(reflected,.08), reflected, 0, 120);
      const second = secondRay.intersectObjects([...activeShootables(),...activeOccluders()], false)[0];
      points.push(second?.point.clone() || first.point.clone().addScaledVector(reflected,70));
    } else points.push(camera.position.clone().addScaledVector(direction,160));
    let count=0;
    for (let segment=0; segment<points.length-1 && count<36; segment++) {
      const distance=points[segment].distanceTo(points[segment+1]); const samples=Math.min(36-count,Math.max(2,Math.ceil(distance/5)));
      for (let step=0; step<samples; step++) {
        const point=points[segment].clone().lerp(points[segment+1],step/samples);
        trajectoryPositions[count*3]=point.x; trajectoryPositions[count*3+1]=point.y; trajectoryPositions[count*3+2]=point.z; count++;
      }
    }
    trajectoryGeometry.setDrawRange(0,count); trajectoryGeometry.attributes.position.needsUpdate=true; return;
  }
  if (!state.throwPreview){trajectoryLanding.visible=false;return;}
  const { origin, velocity } = throwVector(gun);
  if(gun.special==='pizzaParty'){
    const point=origin.clone();const motion=velocity.clone();let count=0;let bounces=0;
    for(let index=0;index<36;index++){motion.y-=18*.085;point.addScaledVector(motion,.085);const floor=groundHeightAt(point.x,point.z,point.y+.4)+.12;if(point.y<=floor){point.y=floor;motion.y=Math.abs(motion.y)*.42;motion.x*=.78;motion.z*=.78;bounces++;}if(pointInsideActiveCollider(point)){motion.x*=-.55;motion.z*=-.55;motion.y=Math.max(2,Math.abs(motion.y)*.35);bounces++;}trajectoryPositions[count*3]=point.x;trajectoryPositions[count*3+1]=point.y;trajectoryPositions[count*3+2]=point.z;count++;if(bounces>=2)break;}
    trajectoryGeometry.setDrawRange(0,count);trajectoryGeometry.attributes.position.needsUpdate=true;trajectoryLanding.position.copy(point);trajectoryLanding.position.y+=.025;trajectoryLanding.visible=true;return;
  }
  let count = 0;let landingPoint=origin.clone();const point=origin.clone();const motion=velocity.clone();
  for (let index = 0; index < 36; index++) {
    motion.y-=18*.085;point.addScaledVector(motion,.085);landingPoint.copy(point);
    trajectoryPositions[index * 3] = point.x; trajectoryPositions[index * 3 + 1] = point.y; trajectoryPositions[index * 3 + 2] = point.z; count++;
    const floor=groundHeightAt(point.x,point.z,point.y+.4)+.12;if(index>1&&(point.y<=floor||pointInsideActiveCollider(point))){landingPoint.y=Math.max(floor,landingPoint.y);break;}
  }
  trajectoryGeometry.setDrawRange(0, count); trajectoryGeometry.attributes.position.needsUpdate = true;
  trajectoryLanding.position.copy(landingPoint);trajectoryLanding.position.y+=.025;trajectoryLanding.visible=true;
}

function throwExplosive(gun) {
  const { origin, velocity } = throwVector(gun);
  const color = gun.effect === 'gravityBomb' ? 0x9b6cff : gun.id === 'pulse-charge' ? 0xff4fba : gun.color||0xffc857;
  const group = new THREE.Group(); group.position.copy(origin); world.add(group);
  const shellGeometry=gun.special==='pizzaParty'?new THREE.CylinderGeometry(.34,.34,.07,18):gun.special==='redHerring'?new THREE.ConeGeometry(.16,.52,8):gun.special==='discoBall'?new THREE.IcosahedronGeometry(.27,1):gun.special==='cakeCannon'?new THREE.CylinderGeometry(.3,.34,.24,14):new THREE.SphereGeometry(.24,10,8);
  const shell = new THREE.Mesh(shellGeometry, new THREE.MeshStandardMaterial({ color, emissive:color, emissiveIntensity:.28, metalness:gun.special==='discoBall'?.9:.55, roughness:.38 })); if(gun.special==='pizzaParty'||gun.special==='cakeCannon')shell.rotation.x=Math.PI/2;group.add(shell);
  const band = new THREE.Mesh(new THREE.TorusGeometry(.25, .035, 6, 14), new THREE.MeshBasicMaterial({ color:0xffffff })); band.rotation.x = Math.PI / 2; group.add(band);
  const light = new THREE.PointLight(color, 4, 5); group.add(light);
  thrownExplosives.push({ group, velocity, gun, detonatesAt:performance.now() + (gun.fuseTime || 1800), bounces:0, stuck:false, nextNoise:performance.now()+420 });
  setAiming(false); ui.status.textContent = `${gun.name} THROWN // ${gun.sticky ? 'SEEKING SURFACE' : 'FUSE LIVE'}`;
  if (gun.ammo <= 0) setTimeout(() => { if (loadout[state.weaponIndex] === gun && gun.ammo <= 0) reload(); }, 320);
}

function splitPizzaProjectile(projectile) {
  const point=projectile.group.position.clone();const index=thrownExplosives.indexOf(projectile);if(index>=0)thrownExplosives.splice(index,1);world.remove(projectile.group);projectile.group.traverse(child=>{child.geometry?.dispose();child.material?.dispose();});
  createChaosBurst(point,[0xffd84e,0xff5538,0x7bdc3b],26,10);chaosSound('pop',310,1.4);
  for(let slice=0;slice<8;slice++){
    const direction=new THREE.Vector3(Math.cos(slice*Math.PI/4),.1,Math.sin(slice*Math.PI/4));const end=point.clone().addScaledVector(direction,13);addBeam(point,end,slice%2?0xff5538:0xffd84e,240);
    for(const target of [...dummies,...enemies]){if(!target.alive||target.arena!==state.activeArena)continue;const relative=target.group.position.clone().sub(point);const forward=relative.dot(direction);if(forward<0||forward>13)continue;const closest=point.clone().addScaledVector(direction,forward);if(target.group.position.distanceTo(closest)>2.4)continue;target.lastDamagingGun=projectile.gun;damageTarget(target,18);}
  }
  ui.status.textContent='PIZZA PARTY // EIGHT-SLICE SPLIT';
}

function detonateThrownExplosive(projectile) {
  const index = thrownExplosives.indexOf(projectile); if (index >= 0) thrownExplosives.splice(index, 1);
  const point = projectile.group.position.clone(); world.remove(projectile.group);
  const radius = projectile.gun.blastRadius || 14;
  for(const cover of destructibleCover)if(!cover.destroyed&&cover.arena===state.activeArena&&cover.mesh.position.distanceTo(point)<=radius*1.15)damageCover(cover,projectile.gun.damage,projectile.gun,point);
  for(const shortcut of traversalObstacles.breakables){if(shortcut.broken||shortcut.arena!==state.activeArena||shortcut.item.position.distanceTo(point)>radius*1.2)continue;shortcut.broken=true;shortcut.item.visible=false;shortcut.collider.active=false;createPulseBlast(shortcut.item.position,5,PARKOUR_SURFACE_COLORS.secret);ui.status.textContent='BREAKABLE SHORTCUT // OPEN';}
  if (projectile.gun.effect === 'utilityGrenade' && projectile.gun.special !== 'breachCharge') {
    if (projectile.gun.special === 'polaritySnare') createGravityWell(point,{blastRadius:radius});
    createUtilityField(point,projectile.gun);
    createPulseBlast(point,radius,projectile.gun.color||0x50e5ff);
    ui.status.textContent=`${projectile.gun.name} // FIELD ACTIVE`; return;
  }
  for (const target of [...dummies, ...enemies]) {
    if (!target.alive) continue;
    const targetPoint = target.group.position.clone().add(new THREE.Vector3(0, target.kind === 'enemy' ? 2.5 : 4, 0));
    const distance = targetPoint.distanceTo(point); if (distance > radius) continue;
    const damage = Math.max(12, Math.round(projectile.gun.damage * (1 - distance / (radius * 1.25))));
    target.lastShotMeta={distance:camera.position.distanceTo(targetPoint),headshot:false,scoped:false,gun:projectile.gun,shotId:++state.shotSequence,lastRound:projectile.gun.ammo===0,airborne:!state.onGround};target.lastDamagingGun=projectile.gun;damageTarget(target, damage);
  }
  if (projectile.gun.effect === 'gravityBomb') createGravityWell(point, projectile.gun);
  if(projectile.gun.special==='cakeCannon'&&state.position.distanceTo(point)<=radius){state.health=Math.min(100,state.health+18);updateVitals();ui.status.textContent='BIRTHDAY BLAST // +18 HEALTH';createChaosBurst(point,[0xff75c8,0x50e5ff,0xffc857,0xe7ff57],32,12);chaosSound('pop',392,1.5);}
  if(state.gameMode==='parkour'&&state.parkour?.variant?.modifiers?.bombJump&&projectile.gun.id==='frag-bomb'){
    const launch=state.position.clone().sub(point);const distance=launch.length();if(distance<=radius){launch.y=0;if(launch.lengthSq()<.01)launch.set(0,0,1);launch.normalize();state.velocity.x+=launch.x*(22-distance);state.velocity.z+=launch.z*(22-distance);state.velocity.y=Math.max(state.velocity.y,10.5+(radius-distance)*.45);state.onGround=false;state.impulseUntil=performance.now()+900;state.airbornePeakY=state.position.y;addMovementCombo('TRAINING BOMB JUMP',80);ui.status.textContent='BOMB JUMP // HARMLESS TRAINING BLAST';}
  }
  if (projectile.gun.special === 'breachCharge') {
    for (const wall of [...hardlightWalls]) if (wall.mesh.position.distanceTo(point)<=radius*1.35) removeHardlightWall(wall);
  }
  const blastColor = projectile.gun.effect === 'gravityBomb' ? 0x9b6cff : projectile.gun.id === 'pulse-charge' ? 0xff4fba : 0xffb13b;
  const blast = new THREE.Mesh(new THREE.SphereGeometry(1, 18, 12), new THREE.MeshBasicMaterial({ color:blastColor, wireframe:true, transparent:true, opacity:.9 }));
  blast.position.copy(point); world.add(blast); queueBlast(blast,radius);
  ui.status.textContent = `${projectile.gun.name} // DETONATED`;
}

function updateThrownExplosives(dt) {
  const now = performance.now();
  for (const projectile of [...thrownExplosives]) {
    if(projectile.gun.special==='redHerring'){projectile.group.rotation.z=Math.sin(now*.018)*.7;if(now>=projectile.nextNoise){projectile.nextNoise=now+720;chaosSound('squeak',150+Math.random()*180,.75);createChaosBurst(projectile.group.position,[0xff2948,0xffffff],3,2);}}
    if (projectile.stuck) {
      if(projectile.stuckTarget?.alive)projectile.group.position.copy(targetCenter(projectile.stuckTarget));
      projectile.group.rotation.y += dt * 2.5;
      if (now >= projectile.detonatesAt) detonateThrownExplosive(projectile);
      continue;
    }
    projectile.velocity.y -= 18 * dt;
    const next = projectile.group.position.clone().addScaledVector(projectile.velocity, dt);
    if(['pizzaParty','cakeCannon'].includes(projectile.gun.special)){
      const struck=[...dummies,...enemies].find(target=>target.alive&&target.arena===state.activeArena&&!projectile.hitTargets?.has(target)&&targetCenter(target).distanceTo(next)<1.35);
      if(struck){projectile.hitTargets||=new Set();projectile.hitTargets.add(struck);const critical=projectile.gun.special==='pizzaParty'&&next.y-struck.group.position.y>(struck.kind==='enemy'?3.35:5.05);struck.lastDamagingGun=projectile.gun;damageTarget(struck,projectile.gun.special==='pizzaParty'?(critical?projectile.gun.headDamage:projectile.gun.damage):42);createChaosBurst(targetCenter(struck),projectile.gun.special==='pizzaParty'?[0xffd84e,0xff5538]:[0xff75c8,0x50e5ff,0xffc857],18,8);
        if(projectile.gun.special==='pizzaParty'){struck.slowUntil=now+1800;projectile.velocity.multiplyScalar(-.55);projectile.velocity.y=Math.max(4,Math.abs(projectile.velocity.y));projectile.bounces++;if(critical){createPulseBlast(next,8,0xffe23f);createChaosBurst(next,[0xffe23f,0x8bd83d,0xffffff],28,11);for(const other of [...dummies,...enemies])if(other.alive&&other!==struck&&other.group.position.distanceTo(next)<8)damageTarget(other,34);ui.status.textContent='PINEAPPLE CRITICAL // TROPICAL BLAST';}}
        else{projectile.group.position.copy(next);projectile.velocity.set(0,0,0);projectile.stuck=true;projectile.stuckTarget=struck;projectile.detonatesAt=Math.min(projectile.detonatesAt,now+1200);ui.status.textContent='BIRTHDAY CAKE // CANDLES LIT';continue;}}
    }
    const floor = groundHeightAt(next.x, next.z,next.y+.5) + .24;
    if (next.y <= floor) {
      next.y = floor;
      if (projectile.gun.sticky && !(projectile.gun.special==='resonanceDisc'&&projectile.bounces<1)) {
        projectile.group.position.copy(next); projectile.velocity.set(0, 0, 0); projectile.stuck = true;
        ui.status.textContent = `${projectile.gun.name} // ARMED`;
      } else if (Math.abs(projectile.velocity.y) > 2 && projectile.bounces < 3) {
        projectile.velocity.y = Math.abs(projectile.velocity.y) * .42; projectile.velocity.x *= .72; projectile.velocity.z *= .72; projectile.bounces++;
        if(projectile.gun.special==='pizzaParty'&&projectile.bounces>=2){projectile.group.position.copy(next);splitPizzaProjectile(projectile);continue;}
      } else { projectile.velocity.y = 0; projectile.velocity.x *= .9; projectile.velocity.z *= .9; }
    }
    if (!projectile.stuck && pointInsideActiveCollider(next) && projectile.gun.sticky && !(projectile.gun.special==='resonanceDisc'&&projectile.bounces<1)) {
      projectile.velocity.set(0, 0, 0); projectile.stuck = true; ui.status.textContent = `${projectile.gun.name} // ARMED`;
    } else if (!projectile.stuck && pointInsideActiveCollider(next)) { projectile.velocity.x *= -.3; projectile.velocity.z *= -.3; projectile.velocity.y = Math.max(2, Math.abs(projectile.velocity.y) * .3); projectile.bounces++; if(projectile.gun.special==='pizzaParty'&&projectile.bounces>=2){projectile.group.position.copy(next);splitPizzaProjectile(projectile);continue;} }
    else projectile.group.position.copy(next);
    projectile.group.rotation.x += dt * 8; projectile.group.rotation.z += dt * 5;
    if (now >= projectile.detonatesAt || Math.abs(next.x) > 345 || Math.abs(next.z) > 345) detonateThrownExplosive(projectile);
  }
  for (const blast of [...blastEffects]) {
    blast.age += dt; const progress = blast.age / .36;
    blast.mesh.scale.setScalar(1 + progress * blast.radius); blast.mesh.material.opacity = Math.max(0, .9 * (1 - progress));
    if (progress < 1) continue;
    world.remove(blast.mesh);if(!blast.mesh.userData.sharedGeometry)blast.mesh.geometry.dispose();blast.mesh.material.dispose();blastEffects.splice(blastEffects.indexOf(blast), 1);
  }
}

function createUtilityField(point,gun) {
  const group=new THREE.Group(); group.position.copy(point); world.add(group);
  const radius=gun.blastRadius||10; const color=gun.color||0x50e5ff;
  const ring=new THREE.Mesh(new THREE.RingGeometry(radius*.75,radius,40),new THREE.MeshBasicMaterial({color,side:THREE.DoubleSide,transparent:true,opacity:.28,depthWrite:false})); ring.rotation.x=-Math.PI/2; ring.position.y=.08; group.add(ring);
  const column=new THREE.Mesh(new THREE.CylinderGeometry(radius*.92,radius*.92,gun.special==='updraft'?16:.18,32,1,true),new THREE.MeshBasicMaterial({color,transparent:true,opacity:gun.special==='updraft'?.09:.045,side:THREE.DoubleSide,depthWrite:false})); column.position.y=gun.special==='updraft'?8:.1; group.add(column);
  const durations={resonanceDisc:3200,redHerring:5200,discoBall:6200,bubblePuddle:5200,mustardTrail:4800,unicornTrail:4200};
  utilityFields.push({group,ring,column,point:point.clone(),gun,radius,expires:performance.now()+(durations[gun.special]||7000),nextPulse:0,pulses:0,launched:new Map(),finale:false});
}

function removeHardlightWall(wall) {
  const index=hardlightWalls.indexOf(wall); if(index>=0) hardlightWalls.splice(index,1);
  const occluderIndex=occluders.indexOf(wall.mesh); if(occluderIndex>=0) occluders.splice(occluderIndex,1);
  world.remove(wall.mesh); wall.mesh.geometry.dispose(); wall.mesh.material.dispose();
}

function fire(scheduledAt = null) {
  if(state.gameMode==='multiplayer'){fireOnlineWeapon();return;}
  if (!state.started || state.lobbyParkour || state.countdownActive || state.reloading || state.completed || state.dead || state.armoryOpen) return;
  const gun = loadout[state.weaponIndex];
  const now = scheduledAt ?? performance.now();
  if(state.vault&&now<(state.vault.blockFireUntil||0))return;
  if (gun.special === 'breachCharge') {
    const placed = thrownExplosives.filter(projectile => projectile.gun === gun && projectile.stuck);
    if (placed.length) { placed.forEach(detonateThrownExplosive); ui.status.textContent='BREACH CHARGE // REMOTE DETONATION'; return; }
  }
  if (gun.effect === 'phaseBeacon' && state.phaseBeacon && now < state.phaseBeacon.expires) { returnToPhaseBeacon(); return; }
  if (now < state.swapUntil) { ui.status.textContent = 'WEAPON NOT READY'; return; }
  if (now < state.camoUntil && quickSlots.indexOf(state.weaponIndex) === 0) { ui.status.textContent = 'TEMPORAL CAMO // PRIMARY LOCKED'; return; }
  if (now < (gun.cooldownEnds || 0)) { ui.status.textContent = `${gun.name} // COOLDOWN ${((gun.cooldownEnds - now) / 1000).toFixed(1)}S`; return; }
  if (now - state.lastShot < gun.fireRate) return;
  if(state.placementPreview&&isPlaceableWeapon(gun)&&!state.placementValid){ui.status.textContent=`${gun.name} // PLACEMENT BLOCKED`;return;}
  if (gun.effect === 'heal' && state.health >= 100) { ui.status.textContent = 'HEALTH ALREADY FULL'; return; }
  const ammoCost = gun.ammoCost ?? 1;
  if (gun.ammo < ammoCost) { reload(); return; }
  const lastRound=gun.ammo===ammoCost;const shotId=++state.shotSequence;state.lastShot = now; gun.ammo -= ammoCost; state.shots++;state.crosshairKick=Math.min(1.2,state.crosshairKick+Math.max(.15,gun.recoil*1.8)); progress.stats.weaponUses[gun.id]=(progress.stats.weaponUses[gun.id]||0)+1;progress.discoveredWeapons.add(gun.id); updateAmmo(); shotSound(gun);
  beginWeaponVisualAnimation(gun,'fire',gun.model.userData.visualDefinition?.animationProfile?.timings?.mechanical,now);
  if (gun.cooldownDuration) { gun.cooldownEnds = now + gun.cooldownDuration; updateHotbarIndicators(now); }
  weapon.rotation.x = -.035 - gun.recoil;
  const scopedFlashScale=state.aiming&&aimProfileForGun(gun).scope ? 0 : 1;gun.model.userData.muzzle.intensity = (gun.name === 'SHOTGUN' ? 32 : 20)*scopedFlashScale;
  gun.model.userData.flash.material.opacity = scopedFlashScale;
  gun.model.userData.flash.rotation.z = Math.random() * Math.PI;
  spawnCasing(gun);
  if(gun.special==='cometShorty'){
    const recoilDirection=new THREE.Vector3();camera.getWorldDirection(recoilDirection);state.velocity.addScaledVector(recoilDirection,-14);state.impulseUntil=now+620;
    if(recoilDirection.y<-.08){state.onGround=false;state.airbornePeakY=state.position.y;}state.shake=Math.max(state.shake,.13);ui.status.textContent='COMET RECOIL // MOMENTUM ADDED';
  }
  if(gun.special==='condiments'){gun.condimentMode=gun.condimentMode==='mustard'?'ketchup':'mustard';ui.status.textContent=`CONDIMENT BLASTERS // ${gun.condimentMode.toUpperCase()}`;}
  const activeSlot = quickSlots.indexOf(state.weaponIndex); const cosmetic = activeSlot >= 0 ? cosmeticForSlot(activeSlot) : null;const tracer=equippedTracer();
  if ((tracer||cosmetic?.trail) && !['grenade','medkit','mine','knife'].includes(gun.kind)) {
    const trailDirection = new THREE.Vector3(); camera.getWorldDirection(trailDirection);
    addBeam(camera.position.clone(), camera.position.clone().addScaledVector(trailDirection, 120), tracer?new THREE.Color(tracer.color).getHex():cosmetic.trail, 95);
  }
  ui.crosshair.classList.remove('fire'); void ui.crosshair.offsetWidth; ui.crosshair.classList.add('fire');
  if(gun.special==='cakeCannon'){throwExplosive(gun);return;}
  if(gun.special==='shoppingCart'){launchShoppingCart(gun);return;}
  if (gun.kind === 'grenade') { throwExplosive(gun); return; }
  if (['void','repulsor','acoustic','magnet','wire','melee','heal','adrenaline','shockMine','hardlightWall','mirrorDrone','phaseBeacon','ammoSynth','gnomeTurret'].includes(gun.effect)) { fireExperimental(gun); return; }
  if (gun.special === 'ricochet') { fireRicochetShot(gun); return; }
  if (gun.special === 'orbitBreaker') { fireOrbitBreaker(gun); return; }
  const damageByTarget = new Map();
  const currentShootables=activeShootables();
  const walls=activeOccluders();
  const raycastObjects=gun.effect==='explosive'?[...currentShootables,...walls,ground]:[...currentShootables,...walls];
  for (let pellet = 0; pellet < gun.pellets; pellet++) {
    const airbornePenalty = !state.onGround && gun.kind === 'sniper' && gun.special !== 'meteor' && !state.aiming && !hasPassive('aero') ? 3.5 : 1;
    const wallRunPenalty=state.wallRunning&&!hasPassive('aero')?1.4:1;
    const shotSpread = gun.spread*(state.aiming?aimProfileForGun(gun).spreadMultiplier:1)*airbornePenalty*wallRunPenalty;
    const aim = new THREE.Vector2((Math.random() - .5) * shotSpread, (Math.random() - .5) * shotSpread);
    raycaster.setFromCamera(aim, camera);
    raycaster.far = gun.range || Infinity;
    const hits = raycaster.intersectObjects(raycastObjects, false);
    if (!hits.length) {
      const missPoint=camera.position.clone();const missDirection=new THREE.Vector3();camera.getWorldDirection(missDirection);missPoint.addScaledVector(missDirection,Math.min(gun.range||45,45));missPoint.y=Math.max(groundHeightAt(missPoint.x,missPoint.z)+.08,missPoint.y);
      if(gun.special==='bananaPeel')createBananaPeel(missPoint,gun);
      if(gun.special==='bubbleTea')createSillyField(missPoint,gun,'bubblePuddle',4.5);
      if(gun.special==='condiments'&&gun.condimentMode==='mustard')createSillyField(missPoint,gun,'mustardTrail',3.2);
      if(gun.special==='unicorn')createSillyField(state.position.clone(),gun,'unicornTrail',3.8);
      continue;
    }
    spawnImpact(hits[0].point,hits[0].object.userData.target?(gun.color||ART_PALETTE.playerAccent):ART_PALETTE.interactive);
    if (gun.effect === 'explosive') {
      const impact = hits[0].point;
      for(const cover of destructibleCover)if(!cover.destroyed&&cover.arena===state.activeArena&&cover.mesh.position.distanceTo(impact)<=gun.blastRadius)damageCover(cover,gun.damage,gun,impact);
      [...dummies, ...enemies].filter(target => target.alive).forEach(target => {
        const distance = target.group.position.distanceTo(impact);
        if (distance <= gun.blastRadius){target.lastShotMeta={distance:camera.position.distanceTo(impact),headshot:false,scoped:state.aiming,gun,shotId,lastRound,airborne:!state.onGround};damageByTarget.set(target, Math.round(gun.damage * (1 - distance / (gun.blastRadius * 1.4))));}
      });
      continue;
    }
    if (gun.special === 'prism' && hits[0].object.userData.collider) prismSplitImpact(hits[0].point, gun);
    const pelletHits = gun.effect === 'pierce'||gun.kind==='sniper'||gun.kind==='rail'||gun.weaponClass.includes('SHOTGUN') ? hits : [hits[0]];
    const seen = new Set(); let piercedWall=false;let throughCover=false;
    for (const hit of pelletHits) {
      if (hit.object.userData.collider) {
        const cover=hit.object.userData.cover;if(cover){const destroyed=damageCover(cover,gun.damage,gun,hit.point);if(destroyed&&(gun.effect==='pierce'||gun.kind==='sniper'||gun.kind==='rail'||gun.weaponClass.includes('SHOTGUN'))){throughCover=true;continue;}}
        if(gun.special==='glassline')glasslineSurfaceImpact(hit.point,gun,now);
        if(gun.special==='bananaPeel')createBananaPeel(hit.point,gun);
        if(gun.special==='bubbleTea'){bubbleTeaBounceImpact(hit,gun);createSillyField(hit.point,gun,'bubblePuddle',4.5);}
        if(gun.special==='condiments'&&gun.condimentMode==='mustard')createSillyField(hit.point,gun,'mustardTrail',3.2);
        if(gun.special==='rubberChicken'){createChaosBurst(hit.point,[0xffdc38,0xffffff],18,6);chaosSound('squeak',420,1.2);}
        if(gun.special==='harmonic'&&!piercedWall&&(gun.chargeScale||0)>.65){piercedWall=true;continue;}
        break;
      }
      if (hit.object.userData.wireAnchor) { damageWireAnchor(hit.object.userData.wireAnchor, Math.max(10, gun.damage)); break; }
      const target = hit.object.userData.target;
      if (!target?.alive || seen.has(target)) continue;
      seen.add(target);
      const isHeadshot=isHeadshotHit(hit,target);
      let damage = isHeadshot ? gun.headDamage : gun.damage;
      if (gun.special === 'harmonic') damage *= .55 + (gun.chargeScale || .18) * .9;
      if(gun.special==='rubberChicken')damage*=.55+(gun.chargeScale||.18)*1.05;
      if(gun.special==='toaster'){const charge=gun.chargeScale||.18;if(charge>.4&&charge<.82)damage*=1.45;else if(charge>=.95)damage*=.72;if(charge>.35&&Math.random()<.08){damage*=2;ui.status.textContent='GOLDEN WAFFLE // CRITICAL BREAKFAST';createChaosBurst(hit.point,[0xffc857,0xffffff],20,8);}}
      if (gun.special === 'meteor' && !state.onGround && state.velocity.y < 0) damage *= 1.5;
      if (gun.special === 'stormcoil') damage *= 1 + (gun.sprintCharge || 0) * .8;
      if (gun.special === 'counterbeat' && now-state.lastEnemyShotAt < 850) damage *= 1.65;
      if (gun.special === 'lastWord' && gun.ammo === 0) damage *= 1.8;
      if(hasPassive('highground')){const elevation=camera.position.y-targetCenter(target).y;if(elevation>=6)damage*=1+THREE.MathUtils.clamp(elevation/90,.035,.09);}
      target.lastShotMeta = { distance:camera.position.distanceTo(hit.point), headshot:isHeadshot, scoped:state.aiming, gun, shotId, lastRound, airborne:!state.onGround, throughCover, ricochet:gun.special==='ricochet', thermal:now<(target.pingedUntil||0), movingPlatform:platformSurfaces.some(surface=>surface.dynamic&&playerStandingOnSurface(surface)) };
      damageByTarget.set(target, gun.effect === 'pierce' ? Math.max(damageByTarget.get(target) || 0, damage) : (damageByTarget.get(target) || 0) + damage);
    }
  }
  raycaster.far = Infinity;
  if (gun.special === 'harmonic') {
    if ((gun.chargeScale || 0) >= .98) { state.revealedUntil=now+3500; ui.status.textContent='FULL HARMONIC DISCHARGE // POSITION REVEALED'; }
    gun.chargeScale=0;
  }
  if(gun.special==='rubberChicken'){if((gun.chargeScale||0)>.92){createChaosBurst(camera.position.clone().add(new THREE.Vector3(0,-.2,0)),[0xffdc38,0xffffff,0xff4fba],24,9);ui.status.textContent='RUBBER CHICKEN // FULL SCREAM PIERCE';}gun.chargeScale=0;}
  if(gun.special==='toaster'){if((gun.chargeScale||0)>=.95){createSillyField(state.position.clone(),gun,'toastSmoke',4);ui.status.textContent='BURNT TOAST // SMOKE SCREEN';}else if((gun.chargeScale||0)>.4)ui.status.textContent='PERFECTLY COOKED // BONUS DAMAGE';gun.chargeScale=0;}
  if (gun.special === 'stormcoil') gun.sprintCharge=0;
  if (damageByTarget.size) state.hits++;
  damageByTarget.forEach((damage, target) => {
    const resolved = applyWeaponHitSpecial(gun,target,damage,now);
    target.lastDamagingGun=gun; damageTarget(target,Math.round(applyEliteDefense(target,resolved,gun,now)));
  });
}

function applyEliteDefense(target,damage,gun,now=performance.now()){
  if(target.eliteType!=='shield'||target.shieldHealth<=0||now<(target.shieldDisabledUntil||0))return damage;const forward=new THREE.Vector3(0,0,1).applyQuaternion(target.group.quaternion);const toShooter=camera.position.clone().sub(target.group.position).setY(0).normalize();if(forward.dot(toShooter)<.15)return damage;const heavy=gun.kind==='sniper'||gun.kind==='rail'||gun.effect==='pierce';target.shieldHealth-=damage*(heavy?1.25:.6);target.shield.material.emissiveIntensity=2;setTimeout(()=>{if(target.shield)target.shield.material.emissiveIntensity=.8;},90);ui.status.textContent=`SHIELD CARRIER // FRONT ARMOR ${Math.max(0,Math.ceil(target.shieldHealth))}`;if(target.shieldHealth<=0){target.shield.visible=false;target.stunnedUntil=now+800;ui.status.textContent='SHIELD CARRIER // SHIELD BROKEN';}return damage*(heavy?.38:.1);
}

function targetCenter(target) {
  return target.group.position.clone().add(new THREE.Vector3(0,target.kind==='enemy'?2.7:4.3,0));
}

function pushTarget(target, direction, strength=6) {
  const flat=direction.clone(); flat.y=0; if (!flat.lengthSq()) return; flat.normalize();
  const destination=target.group.position.clone().addScaledVector(flat,strength);
  if (!collides(destination.x,destination.z)) target.group.position.copy(destination);
}

function removeFractureMark(mark) {
  const index=fractureMarks.indexOf(mark);if(index>=0)fractureMarks.splice(index,1);
  if(mark.target)mark.target.glasslineMark=null;
  mark.mesh.parent?.remove(mark.mesh);mark.mesh.geometry.dispose();mark.mesh.material.dispose();
}

function createFractureMark(point,target=null,expires=performance.now()+5000) {
  while(fractureMarks.length>=12)removeFractureMark(fractureMarks[0]);
  const material=new THREE.MeshBasicMaterial({color:0x9ff6ff,wireframe:true,transparent:true,opacity:.9,depthWrite:false});const visual=new THREE.Mesh(new THREE.OctahedronGeometry(target?.kind === 'enemy' ? .34 : .46,1),material);
  if(target){visual.position.set(0,target.kind==='enemy'?3.1:4.35,.42);target.group.add(visual);}else{visual.position.copy(point);world.add(visual);}
  const mark={mesh:visual,target,point:point.clone(),expires};fractureMarks.push(mark);if(target)target.glasslineMark=mark;return mark;
}

function glasslineShatter(point,gun,excludedTarget=null) {
  createPulseBlast(point,6.5,0x9ff6ff);
  for(const other of [...dummies,...enemies]){if(!other.alive||other===excludedTarget||other.arena!==state.activeArena)continue;const distance=targetCenter(other).distanceTo(point);if(distance<=6.5){other.lastDamagingGun=gun;damageTarget(other,Math.max(8,Math.round(38*(1-distance/9))));}}
}

function glasslineSurfaceImpact(point,gun,now) {
  const existing=fractureMarks.find(mark=>!mark.target&&mark.expires>now&&mark.point.distanceTo(point)<1.4);
  if(existing){const shatterPoint=existing.point.clone();removeFractureMark(existing);glasslineShatter(shatterPoint,gun);ui.status.textContent='GLASSLINE // SURFACE SHATTER';}
  else{createFractureMark(point,null,now+5000);ui.status.textContent='GLASSLINE // SURFACE FRACTURED';}
}

function applyWeaponHitSpecial(gun,target,damage,now=performance.now()) {
  if(gun.special==='glassline'){
    const headshot=Boolean(target.lastShotMeta?.headshot);const existing=target.glasslineMark;
    if(headshot||(existing&&existing.expires>now)){if(existing)removeFractureMark(existing);glasslineShatter(targetCenter(target),gun,target);damage+=headshot?34:52;ui.status.textContent=`GLASSLINE // ${headshot?'HEADSHOT ':''}SHATTER`;}
    else{createFractureMark(targetCenter(target),target,now+5000);target.pingedUntil=now+1800;ui.status.textContent='GLASSLINE // FRACTURE MARKED';}
  }
  if (gun.special === 'twinbeat') {
    if (target.twinbeatMarkedUntil > now) { damage += 52; target.twinbeatMarkedUntil=0; ui.status.textContent='TWINBEAT // SECOND BEAT DETONATED'; }
    else { target.twinbeatMarkedUntil=now+4000; target.pingedUntil=now+4000; ui.status.textContent='TWINBEAT // TARGET MARKED'; }
  }
  if (gun.special === 'glasswire') {
    const previous=gun.lastWireTarget;
    if (previous?.alive && previous!==target && now-(gun.lastWireAt||0)<4200) {
      addBeam(targetCenter(previous),targetCenter(target),0xa981ff,420); damage+=24; damageTarget(previous,24);
      ui.status.textContent='GLASSWIRE // ENERGY LINK';
    }
    gun.lastWireTarget=target; gun.lastWireAt=now;
  }
  if (gun.special === 'aftershock') {
    const point=target.group.position.clone();
    for (const other of [...dummies,...enemies]) {
      if (!other.alive || other===target || other.group.position.distanceTo(point)>8) continue;
      const direction=other.group.position.clone().sub(point); pushTarget(other,direction,5); damageTarget(other,18);
    }
    createPulseBlast(point,8,0xff9b50);
  }
  if (gun.special === 'echo9') {
    target.echo9Hits=(target.echo9Hits||0)+1;
    if (target.echo9Hits>=3) { target.echo9Hits=0; target.pingedUntil=now+4000; createPulseBlast(target.group.position,6,0x50e5ff); ui.status.textContent='ECHO-9 // SONIC REVEAL BURST'; }
  }
  if (gun.special === 'kickback') {
    const direction=new THREE.Vector3(); camera.getWorldDirection(direction); pushTarget(target,direction,8); state.velocity.addScaledVector(direction,-8); state.impulseUntil=now+350;
  }
  if (gun.special === 'arcWasp') {
    if((target.wetUntil||0)>now)damage*=1.25;
    const chainRadius=(target.wetUntil||0)>now?11:7;const chained=[...dummies,...enemies].find(other=>other.alive&&other!==target&&other.group.position.distanceTo(target.group.position)<chainRadius);
    if (chained) { addBeam(targetCenter(target),targetCenter(chained),0x55c8ff,160); damageTarget(chained,Math.max(8,Math.round(damage*(((target.wetUntil||0)>now)?.62:.45)))); }
  }
  if (gun.special === 'stutter') {
    const echoDamage=Math.max(8,Math.round(damage*.42)); const center=targetCenter(target);
    setTimeout(()=>{ if (!target.alive) return; addBeam(camera.position.clone(),center,0xa86eff,90); damageTarget(target,echoDamage); },180);
  }
  if (gun.special === 'magLock') { target.magLockHits=(target.magLockHits||0)+1; if (target.magLockHits>=2) target.slowUntil=now+2200; }
  if (gun.special === 'blinkDerringer' && gun.ammo===0) {
    const direction=new THREE.Vector3(); camera.getWorldDirection(direction); direction.y=0; direction.normalize();
    const destination=state.position.clone().addScaledVector(direction,-3.5);
    if (!collides(destination.x,destination.z)) state.position.copy(destination); ui.status.textContent='BLINK DERRINGER // PHASE BACKSTEP';
  }
  if (gun.special === 'tracker6') { target.pingedUntil=now+6000; ui.status.textContent='TRACKER-6 // TRANSMITTER ATTACHED'; }
  if(gun.special==='redFish'){
    const charge=gun.chargeScale||.2;damage*=.8+charge;target.wetUntil=now+5000;target.slowUntil=now+900+charge*800;
    if(charge>.55){const direction=target.group.position.clone().sub(state.position);pushTarget(target,direction,4+charge*8);createChaosBurst(targetCenter(target),[0x50e5ff,0xffffff],18,8);ui.status.textContent='RED FISH // CHARGED WATER BLAST';}gun.chargeScale=0;
  }
  if(gun.special==='baguette'){
    createChaosBurst(targetCenter(target),[0xd89c4a,0xffe8aa],target.lastShotMeta?.headshot?22:9,target.lastShotMeta?.headshot?9:4);
    if(target.lastShotMeta?.headshot){chaosSound('crunch',88,1.5);ui.status.textContent='BAGUETTE CRUNCH // HEADSHOT';}
  }
  if(gun.special==='bananaPeel'&&target.lastShotMeta?.headshot){target.group.position.y+=2.4;target.stunnedUntil=now+520;createChaosBurst(targetCenter(target),[0xffe14f,0xffffff],16,8);ui.status.textContent='BANANA CRITICAL // TARGET POPPED';}
  if(gun.special==='bubbleTea'){
    target.bobaHits=(target.bobaHits||0)+1;if(target.bobaHits>=5){target.bobaHits=0;createSillyField(target.group.position.clone(),gun,'bubblePuddle',5.2);ui.status.textContent='BUBBLE TEA // STICKY PUDDLE';}
    createChaosBurst(targetCenter(target),[0x3a263f,0xff75c8,0x65eaff],4,3);
  }
  if(gun.special==='sockPuppet'){
    const charge=gun.chargeScale||.2;damage*=.9+charge*.45;target.sneezeHits=(target.sneezeHits||0)+1;
    if(target.sneezeHits>=4){target.sneezeHits=0;target.stunnedUntil=now+650;createChaosBurst(targetCenter(target),[0xd8d2ff,0xffffff],20,7);chaosSound('squeak',360,1);ui.status.textContent='SOCK PUPPET // SNEEZE DISRUPTION';}gun.chargeScale=0;
  }
  if(gun.special==='condiments'){
    if(gun.condimentMode==='ketchup'){target.ketchupUntil=now+4200;target.pingedUntil=now+4200;createChaosBurst(targetCenter(target),[0xff3038],7,4);}
    else{target.mustardUntil=now+4200;target.slowUntil=now+900;createSillyField(target.group.position.clone(),gun,'mustardTrail',3.2);createChaosBurst(targetCenter(target),[0xffd83d],7,4);}
    if((target.ketchupUntil||0)>now&&(target.mustardUntil||0)>now){target.ketchupUntil=0;target.mustardUntil=0;damage+=54;createPulseBlast(targetCenter(target),7,0xff8a2f);createChaosBurst(targetCenter(target),[0xff3038,0xffd83d],24,10);chaosSound('pop',196,1.5);ui.status.textContent='HOT DOG COMBO // SAUCE DETONATION';}
  }
  if(gun.special==='unicorn'){
    if(gun.streamTarget===target&&now-(gun.streamAt||0)<280)gun.streamHits=(gun.streamHits||0)+1;else gun.streamHits=1;gun.streamTarget=target;gun.streamAt=now;damage*=1+Math.min(.9,gun.streamHits*.055);
    target.wetUntil=now+1800;createChaosBurst(targetCenter(target),[0xff4fba,0x50e5ff,0xffc857,0x77ff8f],3,2.5);
    const direction=new THREE.Vector3();camera.getWorldDirection(direction);for(const explosive of thrownExplosives)if(explosive.group.position.distanceTo(targetCenter(target))<8)explosive.velocity.addScaledVector(direction,5);
    if(gun.streamHits>=14){gun.streamHits=0;createPulseBlast(targetCenter(target),9,0xfff2ff);createChaosBurst(targetCenter(target),[0xff4fba,0x50e5ff,0xffc857,0x77ff8f],28,11);ui.status.textContent='UNICORN SPRINKLER // RAINBOW SHOCKWAVE';}
  }
  return damage;
}

function queueBlast(mesh,radius){
  const cap=progress.settings.graphicsQuality==='low'?10:20;while(blastEffects.length>=cap){const old=blastEffects.shift();world.remove(old.mesh);if(!old.mesh.userData.sharedGeometry)old.mesh.geometry.dispose();old.mesh.material.dispose();}blastEffects.push({mesh,age:0,radius});
}
function createPulseBlast(point,radius,color) {
  const blast=new THREE.Mesh(sharedBlastGeometry,new THREE.MeshBasicMaterial({color,wireframe:true,transparent:true,opacity:.85}));blast.userData.sharedGeometry=true;
  blast.position.copy(point); world.add(blast); queueBlast(blast,radius);
}

function fireRicochetShot(gun) {
  const direction=new THREE.Vector3(); camera.getWorldDirection(direction);
  const firstRay=new THREE.Raycaster(camera.position,direction,0,gun.range||240);
  const first=firstRay.intersectObjects([...activeShootables(),...activeOccluders()],false)[0];
  if (!first) return;
  addBeam(camera.position.clone(),first.point,0xffc857,150);
  let target=first.object.userData.target; let hit=first;
  if (!target && first.face) {
    const normal=first.face.normal.clone().transformDirection(first.object.matrixWorld);
    const reflected=direction.clone().reflect(normal).normalize();
    const origin=first.point.clone().addScaledVector(reflected,.08);
    const secondRay=new THREE.Raycaster(origin,reflected,0,150);
    const second=secondRay.intersectObjects([...activeShootables(),...activeOccluders()],false)[0];
    if (second) { addBeam(first.point,second.point,0xffc857,190); target=second.object.userData.target; hit=second; }
  }
  if (!target?.alive) { ui.status.textContent='RICOCHET LONGSHOT // BANK SHOT'; return; }
  const headshot=isHeadshotHit(hit,target);
  target.lastShotMeta={distance:camera.position.distanceTo(hit.point),headshot,scoped:state.aiming,gun}; target.lastDamagingGun=gun;
  state.hits++; damageTarget(target,headshot?gun.headDamage:gun.damage); ui.status.textContent='RICOCHET LONGSHOT // BANK HIT';
}

function fireOrbitBreaker(gun) {
  const hits=centerShotHits([...activeShootables(),...activeOccluders(),ground],260); const mark=hits[0]?.point;
  if (!mark) { ui.status.textContent='ORBIT BREAKER // NO GUIDANCE POINT'; return; }
  let target=hits[0]?.object.userData.target;
  if (!target?.alive) target=[...dummies,...enemies].filter(item=>item.alive&&item.group.position.distanceTo(mark)<20).sort((a,b)=>a.group.position.distanceTo(mark)-b.group.position.distanceTo(mark))[0];
  const end=target?.alive?targetCenter(target):mark.clone(); const middle=camera.position.clone().lerp(end,.5).add(new THREE.Vector3(8,6,0));
  const curve=new THREE.QuadraticBezierCurve3(camera.position.clone(),middle,end); const geometry=new THREE.BufferGeometry().setFromPoints(curve.getPoints(28));
  const beam=new THREE.Line(geometry,new THREE.LineBasicMaterial({color:0x6c8cff,transparent:true,opacity:.95})); world.add(beam);
  queueTemporaryBeam(beam,260);
  if (target?.alive) { target.lastShotMeta={distance:camera.position.distanceTo(end),headshot:false,scoped:state.aiming,gun}; target.lastDamagingGun=gun; state.hits++; damageTarget(target,gun.damage); ui.status.textContent='ORBIT BREAKER // GUIDED HIT'; }
}

function prismSplitImpact(point,gun) {
  const target=[...dummies,...enemies].filter(item=>item.alive&&item.group.position.distanceTo(point)<10).sort((a,b)=>a.group.position.distanceTo(point)-b.group.position.distanceTo(point))[0];
  if (!target) return; addBeam(point,targetCenter(target),0xe778ff,110); target.lastDamagingGun=gun; damageTarget(target,Math.max(7,Math.round(gun.damage*.55)));
}

function bubbleTeaBounceImpact(hit,gun) {
  if(!hit.face)return;const incoming=new THREE.Vector3();camera.getWorldDirection(incoming);const normal=hit.face.normal.clone().transformDirection(hit.object.matrixWorld);const reflected=incoming.reflect(normal).normalize();const origin=hit.point.clone().addScaledVector(reflected,.1);const bounceRay=new THREE.Raycaster(origin,reflected,0,36);const bounce=bounceRay.intersectObjects([...activeShootables(),...activeOccluders()],false)[0];const end=bounce?.point.clone()||origin.clone().addScaledVector(reflected,18);addBeam(hit.point,end,[0x3a263f,0xff75c8,0x65eaff][Math.floor(Math.random()*3)],130);const target=bounce?.object.userData.target;if(target?.alive){target.lastDamagingGun=gun;damageTarget(target,Math.max(6,Math.round(gun.damage*.55)));target.bobaHits=(target.bobaHits||0)+1;}createChaosBurst(hit.point,[0x3a263f,0xff75c8,0x65eaff],5,3);
}

function addBeam(from, to, color, duration = 130) {
  const entry=tracerPool[tracerCursor++%tracerPool.length];const positions=entry.line.geometry.attributes.position.array;
  positions[0]=from.x;positions[1]=from.y;positions[2]=from.z;positions[3]=to.x;positions[4]=to.y;positions[5]=to.z;entry.line.geometry.attributes.position.needsUpdate=true;
  entry.line.material.color.setHex(color);entry.line.material.opacity=.95;entry.line.visible=true;entry.expires=performance.now()+duration;
}
function queueTemporaryBeam(beam,duration){
  while(temporaryBeams.length>=36){const old=temporaryBeams.shift();world.remove(old.beam);old.beam.geometry.dispose();old.beam.material.dispose();}temporaryBeams.push({beam,expires:performance.now()+duration});
}
function updateTemporaryBeams(now){
  for(const entry of tracerPool){if(!entry.line.visible)continue;const remaining=entry.expires-now;if(remaining<=0){entry.line.visible=false;continue;}entry.line.material.opacity=Math.min(.95,remaining/75);}
  for(let index=temporaryBeams.length-1;index>=0;index--){const item=temporaryBeams[index];if(item.expires>now)continue;temporaryBeams.splice(index,1);world.remove(item.beam);item.beam.geometry.dispose();item.beam.material.dispose();}
}

function spawnImpact(point,color=ART_PALETTE.interactive){
  const entry=impactPool[impactCursor++%impactPool.length];entry.mesh.position.copy(point);entry.mesh.material.color.setHex(color);entry.mesh.material.opacity=1;entry.mesh.scale.setScalar(1);entry.mesh.visible=true;entry.life=.22;
}
function spawnCasing(gun){
  if(['grenade','medkit','mine','knife','void','flame'].includes(gun.kind))return;
  if(state.aiming&&aimProfileForGun(gun).scope)return;
  const point=gun.model.getObjectByName(gun.model.userData.attachmentPoints?.ejection||'casing-ejection');if(!point)return;const entry=casingPool[casingCursor++%casingPool.length];point.getWorldPosition(entry.mesh.position);entry.mesh.quaternion.copy(camera.quaternion);entry.mesh.rotation.z+=Math.random()*Math.PI;
  entry.velocity.set(.9+Math.random()*.8,1.2+Math.random()*.8,-.2+(Math.random()-.5)*.4).applyQuaternion(camera.quaternion);entry.life=.9;entry.mesh.visible=progress.settings.graphicsQuality!=='low';
}
function updatePooledEffects(dt){
  for(const entry of casingPool){if(entry.life<=0)continue;entry.life-=dt;entry.velocity.y-=8.5*dt;entry.mesh.position.addScaledVector(entry.velocity,dt);entry.mesh.rotation.x+=dt*11;entry.mesh.rotation.z+=dt*8;if(entry.mesh.position.y<.05){entry.mesh.position.y=.05;entry.velocity.y=Math.abs(entry.velocity.y)*.28;entry.velocity.multiplyScalar(.72);}if(entry.life<=0)entry.mesh.visible=false;}
  for(const entry of impactPool){if(entry.life<=0)continue;entry.life-=dt;const t=Math.max(0,entry.life/.22);entry.mesh.material.opacity=t;entry.mesh.scale.setScalar(1+(1-t)*4);if(entry.life<=0)entry.mesh.visible=false;}
  const now=performance.now();camera.getWorldDirection(killFxViewDirection);for(const effect of killFxPool){if(!effect.group.visible)continue;const elapsedMs=now-effect.started;const profile=effect.profile||EFFECT_PROFILES.standard;effect.phase=effectPhaseAt(profile,elapsedMs);const elapsed=elapsedMs/effect.duration;if(effect.phase==='complete'){effect.group.visible=false;effect.phase='idle';effect.particles.forEach(particle=>{particle.mesh.visible=false;particle.mesh.material.opacity=0;});continue;}if(killFxToEffect.subVectors(effect.group.position,camera.position).dot(killFxViewDirection)<-3)continue;const anticipation=Math.min(1,elapsedMs/profile.anticipationMs),dissipationStart=profile.anticipationMs+profile.mainMs,fade=elapsedMs<=dissipationStart?1:Math.max(0,1-(elapsedMs-dissipationStart)/profile.dissipationMs),energy=anticipation*fade;effect.ring.material.opacity=.72*energy;effect.ringB.material.opacity=.48*energy;effect.core.material.opacity=.8*energy;effect.ring.scale.setScalar(.18+anticipation*.2+elapsed*3);effect.ringB.scale.setScalar(.12+anticipation*.18+elapsed*2.2);effect.ring.rotation.z+=dt*2.4;effect.ringB.rotation.z-=dt*1.8;
    const inward=effect.mode==='blackHole'||effect.mode==='resonanceCollapse';for(let index=0;index<effect.particles.length;index++){const particle=effect.particles[index];if(index>=effect.budget){particle.mesh.visible=false;continue;}particle.mesh.visible=true;const travel=inward?Math.max(.08,1-elapsed):elapsed;particle.mesh.position.copy(particle.seed).multiplyScalar(travel*(effect.mode==='ancientBloom'?2.2:3.6));particle.mesh.position.y+=effect.mode==='ancientBloom'?elapsed*2.8:effect.mode==='fishSplash'?Math.sin(elapsed*Math.PI)*2.5:elapsed*.65;particle.mesh.rotation.x+=dt*(5+index%5);particle.mesh.rotation.y+=dt*(3+index%7);particle.mesh.material.opacity=fade;particle.mesh.scale.setScalar(effect.mode==='pixelShatter'?.8+elapsed*.8:.7);}
    if(effect.mode==='fishSplash')effect.core.scale.set(1.7,.65,.5).multiplyScalar(.65+Math.sin(elapsed*Math.PI)*.75);else if(effect.mode==='pizzaParty')effect.core.scale.set(1.35,.25,1.35).multiplyScalar(.7+Math.sin(elapsed*Math.PI));else if(effect.mode==='comicExplosion')effect.core.scale.set(1.6,1.1,.22).multiplyScalar(.55+elapsed*1.4);else if(effect.mode==='blackHole')effect.core.scale.setScalar(.25+Math.sin(elapsed*Math.PI)*1.15);else effect.core.scale.setScalar(.35+Math.sin(elapsed*Math.PI)*1.35);
  }
}

function triggerKillFx(item,position,eliminationId,{preview=false,remote=false}={}){
  if(!item||item.type!=='killFx'||!position)return false;if(remote&&progress.settings.otherPlayerKillFx==='off')return false;if(!preview&&position.distanceTo(camera.position)>130)return false;const id=preview?`preview-${performance.now()}-${killFxCursor}`:eliminationId;if(!shouldTriggerKillFx(killFxLedger,{confirmed:true,type:'elimination',eliminationId:id}))return false;if(killFxLedger.size>256)killFxLedger.clear();
  const effect=killFxPool[killFxCursor++%killFxPool.length];const colors=item.colors||['#50e5ff','#9b6cff'];const profile=EFFECT_PROFILES[item.effect]||EFFECT_PROFILES.standard;const quality=qualityVisualFallback(progress.settings.graphicsQuality);effect.group.position.copy(position);effect.group.visible=true;effect.started=performance.now();effect.duration=profile.durationMs;effect.profile=profile;effect.phase='anticipation';effect.mode=item.effect;effect.remote=remote;effect.budget=Math.min(profile.particleLimit,Math.max(4,Math.round(killFxParticleBudget(progress.settings.cosmeticQuality,remote&&progress.settings.otherPlayerKillFx==='reduced')*quality.particleScale)));effect.ring.material.color.set(colors[0]);effect.ringB.material.color.set(colors[1]||colors[0]);effect.core.material.color.set(item.effect==='blackHole'?0x05030d:colors[1]||colors[0]);effect.core.material.blending=item.effect==='blackHole'?THREE.NormalBlending:THREE.AdditiveBlending;
  effect.particles.forEach((particle,index)=>{const angle=(index/effect.particles.length)*Math.PI*2+(index%3)*.24;const radius=.65+(index%5)*.28;particle.seed.set(Math.cos(angle)*radius,.15+(index%4)*.18,Math.sin(angle)*radius);particle.mesh.material.color.set(colors[index%colors.length]);particle.mesh.material.opacity=1;particle.mesh.visible=index<effect.budget;});
  if(position.distanceTo(camera.position)<55)chaosSound(item.effect==='pizzaParty'?'pop':item.effect==='fishSplash'?'splash':'zap',item.rarity==='exotic'?330:245,.42);return true;
}
function previewKillFx(item=equippedKillFx(),position=null){if(!item){lobbyNotify('EQUIP A KILL FX TO USE THE PREVIEW CHAMBER','warning');return false;}const point=position||state.position.clone().add(new THREE.Vector3(0,-state.eyeHeight+.2,-4).applyAxisAngle(new THREE.Vector3(0,1,0),state.yaw));const played=triggerKillFx(item,point,`preview-${Date.now()}`,{preview:true});if(played){lobbyNotify(`PREVIEW // ${item.name} // NO REWARDS OR STATS`,'info');pulseReactor('reward',900);}return played;}

function centerShotHits(objects, far = 200) {
  raycaster.setFromCamera(new THREE.Vector2(0, 0), camera); raycaster.far = far;
  const hits = raycaster.intersectObjects(objects, false); raycaster.far = Infinity;
  return hits;
}

function fireExperimental(gun) {
  if (gun.regeneration && !gun.lastRegeneration) gun.lastRegeneration = performance.now();
  if (gun.effect === 'void') fireVoidGun(gun);
  if (gun.effect === 'repulsor') fireRepulsor();
  if (gun.effect === 'acoustic') fireAcousticWave();
  if (gun.effect === 'magnet') fireMagnetNode(gun);
  if (gun.effect === 'wire') fireWireNode(gun);
  if (gun.effect === 'melee') fireMelee(gun);
  if (gun.effect === 'heal') useMedkit(gun);
  if (gun.effect === 'adrenaline') useAdrenalineMedkit(gun);
  if (gun.effect === 'shockMine') placeShockMine(gun);
  if (gun.effect === 'hardlightWall') deployHardlightWall(gun);
  if (gun.effect === 'mirrorDrone') deployMirrorDrones();
  if (gun.effect === 'phaseBeacon') usePhaseBeacon(gun);
  if (gun.effect === 'ammoSynth') deployAmmoSynth(gun);
  if (gun.effect === 'gnomeTurret') deployGnomeTurret(gun);
}

function createSillyField(point,gun,special,radius=5) {
  const placed=point.clone();placed.y=groundHeightAt(placed.x,placed.z)+.09;createUtilityField(placed,{...gun,special,blastRadius:radius,color:special==='mustardTrail'?0xffd83d:special==='unicornTrail'?0xff75d1:special==='toastSmoke'?0x757575:gun.color});
}

function createBananaPeel(point,gun) {
  const placed=point.clone();placed.y=groundHeightAt(placed.x,placed.z)+.08;const group=new THREE.Group();group.position.copy(placed);world.add(group);const material=new THREE.MeshStandardMaterial({color:0xffdf32,emissive:0x7d5800,emissiveIntensity:.18,side:THREE.DoubleSide,roughness:.75});
  for(let index=0;index<3;index++){const peel=new THREE.Mesh(new THREE.ConeGeometry(.12,.68,5,1,true),material.clone());peel.rotation.set(Math.PI/2,index*Math.PI*2/3,index%2?.32:-.32);peel.position.set(Math.cos(index*Math.PI*2/3)*.16,.03,Math.sin(index*Math.PI*2/3)*.16);group.add(peel);}
  bananaPeels.push({group,gun,expires:performance.now()+18000,armedAt:performance.now()+350});while(bananaPeels.length>18){const old=bananaPeels.shift();world.remove(old.group);old.group.traverse(child=>{child.geometry?.dispose();child.material?.dispose();});}
}

function deployGnomeTurret(gun) {
  const direction=new THREE.Vector3();camera.getWorldDirection(direction);direction.y=0;direction.normalize();const point=state.placementPreview&&state.placementValid?state.placementPoint.clone():state.position.clone().addScaledVector(direction,2.5);point.y=groundHeightAt(point.x,point.z,state.position.y+.8)+.65;
  const group=new THREE.Group();group.position.copy(point);world.add(group);const body=new THREE.Mesh(new THREE.CylinderGeometry(.28,.38,.75,10),new THREE.MeshStandardMaterial({color:0x3483d5,roughness:.65}));group.add(body);const face=new THREE.Mesh(new THREE.SphereGeometry(.27,12,9),new THREE.MeshStandardMaterial({color:0xffd3ac,roughness:.8}));face.position.y=.48;group.add(face);const hat=new THREE.Mesh(new THREE.ConeGeometry(.34,.82,10),new THREE.MeshStandardMaterial({color:0xff334b,emissive:0x781020,emissiveIntensity:.18}));hat.position.y=1.02;group.add(hat);const muzzle=new THREE.PointLight(0xffc857,0,5);muzzle.position.set(0,.52,-.34);group.add(muzzle);
  gnomeTurrets.push({group,gun,muzzle,health:70,arena:state.activeArena,nextShot:performance.now()+500,nextShout:performance.now()+900,expires:performance.now()+15000,refundable:true});while(gnomeTurrets.length>4)removeGnomeTurret(gnomeTurrets[0]);ui.status.textContent='GARDEN GNOME // ANGRY TURRET DEPLOYED';
}

function removeGnomeTurret(gnome) {const index=gnomeTurrets.indexOf(gnome);if(index>=0)gnomeTurrets.splice(index,1);world.remove(gnome.group);gnome.group.traverse(child=>{child.geometry?.dispose();child.material?.dispose();});}

function launchShoppingCart(gun) {
  const direction=new THREE.Vector3();camera.getWorldDirection(direction);const group=new THREE.Group();group.position.copy(camera.position).addScaledVector(direction,1.2);world.add(group);const basket=new THREE.Mesh(new THREE.BoxGeometry(1.1,.68,1.35),new THREE.MeshStandardMaterial({color:0x9aa8b7,metalness:.8,roughness:.25,wireframe:true}));group.add(basket);for(const x of [-.42,.42])for(const z of [-.42,.42]){const wheel=new THREE.Mesh(new THREE.TorusGeometry(.13,.045,7,12),mats.black);wheel.position.set(x,-.42,z);wheel.rotation.y=Math.PI/2;group.add(wheel);}
  shoppingCarts.push({group,gun,velocity:direction.multiplyScalar(33).add(new THREE.Vector3(0,3,0)),spawned:performance.now(),expires:performance.now()+6500,collected:0,hit:new Set()});chaosSound('crunch',72,1.2);ui.status.textContent='SHOPPING CART // AISLE CLEAR';
}

function updateChaosSystems(dt) {
  const now=performance.now();
  for(const particle of [...chaosParticles]){particle.life-=dt;particle.velocity.y-=9*dt;particle.mesh.position.addScaledVector(particle.velocity,dt);particle.mesh.rotation.x+=dt*7;particle.mesh.rotation.z+=dt*5;particle.mesh.material.opacity=Math.max(0,particle.life*1.4);if(particle.life>0)continue;world.remove(particle.mesh);particle.mesh.material.dispose();chaosParticles.splice(chaosParticles.indexOf(particle),1);}
  for(const peel of [...bananaPeels]){peel.group.rotation.y+=dt*.8;if(now>=peel.armedAt){const victim=enemies.find(enemy=>enemy.alive&&enemy.arena===state.activeArena&&enemy.group.position.distanceTo(peel.group.position)<1.25);if(victim){victim.stunnedUntil=now+750;victim.slowUntil=now+1700;pushTarget(victim,new THREE.Vector3(Math.sin(now),0,Math.cos(now)),7);createChaosBurst(peel.group.position,[0xffdf32,0xffffff],14,7);chaosSound('squeak',310,1.1);peel.expires=0;ui.status.textContent='BANANA PEEL // HOSTILE SLIPPED';}}
    if(now<peel.expires)continue;world.remove(peel.group);peel.group.traverse(child=>{child.geometry?.dispose();child.material?.dispose();});bananaPeels.splice(bananaPeels.indexOf(peel),1);}
  for(const gnome of [...gnomeTurrets]){gnome.muzzle.intensity=THREE.MathUtils.damp(gnome.muzzle.intensity,0,22,dt);const target=enemies.filter(enemy=>enemy.alive&&enemy.arena===state.activeArena&&enemy.group.position.distanceTo(gnome.group.position)<42).sort((a,b)=>a.group.position.distanceTo(gnome.group.position)-b.group.position.distanceTo(gnome.group.position))[0];if(target){const look=target.group.position.clone();look.y=gnome.group.position.y;gnome.group.lookAt(look);if(now>=gnome.nextShot){gnome.nextShot=now+720;gnome.muzzle.intensity=8;addBeam(gnome.group.position.clone().add(new THREE.Vector3(0,.55,0)),targetCenter(target),0xffc857,120);target.lastDamagingGun=gnome.gun;damageTarget(target,gnome.gun.damage);createChaosBurst(targetCenter(target),[0xffc857,0xff334b],4,3);}}if(now>=gnome.nextShout){gnome.nextShout=now+2500;chaosSound('squeak',180+Math.random()*100,.65);}if(now<gnome.expires&&gnome.health>0)continue;createChaosBurst(gnome.group.position,[0xff334b,0x3483d5,0xffffff],18,8);removeGnomeTurret(gnome);}
  for(const cart of [...shoppingCarts]){cart.velocity.y-=15*dt;const next=cart.group.position.clone().addScaledVector(cart.velocity,dt);const floor=groundHeightAt(next.x,next.z)+.55;if(next.y<=floor){next.y=floor;if(cart.velocity.y< -4&&Math.hypot(cart.velocity.x,cart.velocity.z)>18)cart.velocity.y=5;else cart.velocity.y=0;cart.velocity.x*=.992;cart.velocity.z*=.992;}if(pointInsideActiveCollider(next)){cart.velocity.x*=-.35;cart.velocity.z*=-.35;createChaosBurst(next,[0xaeb8c2,0xffc857],10,5);}cart.group.position.copy(next);cart.group.rotation.x+=dt*3.4;const age=Math.min(1,(now-cart.spawned)/900);cart.group.scale.setScalar(.35+age*1.25);
    for(const peel of [...bananaPeels])if(peel.group.position.distanceTo(cart.group.position)<1.8){cart.collected++;peel.expires=0;createChaosBurst(peel.group.position,[0xffdf32],6,4);}
    for(const target of [...dummies,...enemies])if(target.alive&&target.arena===state.activeArena&&!cart.hit.has(target)&&targetCenter(target).distanceTo(cart.group.position)<1.65){cart.hit.add(target);target.lastDamagingGun=cart.gun;damageTarget(target,cart.gun.damage+cart.collected*18);pushTarget(target,cart.velocity,10+cart.collected*2);createChaosBurst(targetCenter(target),[0xaeb8c2,0xffc857,0xff4fba],20,10);chaosSound('crunch',68,1.4);}
    if(now<cart.expires&&Math.abs(cart.group.position.x)<345&&Math.abs(cart.group.position.z)<345)continue;world.remove(cart.group);cart.group.traverse(child=>{child.geometry?.dispose();child.material?.dispose();});shoppingCarts.splice(shoppingCarts.indexOf(cart),1);}
}

function fireMelee(gun) {
  const hits = centerShotHits([...activeShootables(), ...activeOccluders()], gun.range || 3.2);
  const hit = hits[0];
  const target = hit?.object.userData.target;
  weapon.rotation.z = -.58;
  const now=performance.now();
  if (gun.special === 'signalSaber' && now >= state.saberCooldownUntil) { state.saberGuardUntil=now+420; ui.status.textContent='SIGNAL SABER // DEFLECT WINDOW'; }
  if (gun.special === 'railhook' && hit) {
    const pull=hit.point.clone().sub(state.position); const distance=Math.min(18,pull.length());
    state.velocity.addScaledVector(pull.normalize(),distance*1.25); state.velocity.y=Math.max(state.velocity.y,4); state.onGround=false; state.impulseUntil=now+700;
  }
  if (gun.special === 'cableWhip') for (const explosive of thrownExplosives) explosive.velocity.add(state.position.clone().sub(explosive.group.position).normalize().multiplyScalar(12));
  if (gun.special === 'reverbHammer') {
    createPulseBlast(state.position.clone().add(new THREE.Vector3(0,-state.eyeHeight,0)),9,0xe4984f);
    for (const other of [...dummies,...enemies]) if (other.alive&&other.group.position.distanceTo(state.position)<9) { pushTarget(other,other.group.position.clone().sub(state.position),5); damageTarget(other,Math.round(gun.damage*.55)); }
  }
  if (!target?.alive) { ui.status.textContent = gun.special==='railhook'&&hit?'RAILHOOK // MOMENTUM PULL':'MELEE SWING // MISS'; return; }
  state.hits++;
  addBeam(camera.position.clone(), hit.point, 0xdce4df, 75);
  let damage=gun.damage;
  if (gun.special === 'momentumGauntlets') damage*=1+Math.min(1.5,Math.hypot(state.velocity.x,state.velocity.z)/24);
  if (gun.special === 'phaseKatana') damage*=1.2;
  if (gun.special === 'tuningBlades' && state.sliding) {
    createPulseBlast(target.group.position,6,0x50e5ff);
    for (const other of [...dummies,...enemies]) if (other.alive&&other.group.position.distanceTo(target.group.position)<6) pushTarget(other,other.group.position.clone().sub(target.group.position),7);
  }
  if (gun.special === 'coilBaton') { target.stunnedUntil=now+900; target.utilityDisabledUntil=now+4500; }
  if (gun.special === 'pistonAxe') {
    const baseY=target.group.position.y; target.group.position.y+=3.5; target.stunnedUntil=now+700;
    setTimeout(()=>{if(target.alive) target.group.position.y=baseY;},650);
  }
  if (gun.special === 'cableWhip') pushTarget(target,state.position.clone().sub(target.group.position),6);
  target.lastDamagingGun=gun; damageTarget(target,Math.round(damage));
  ui.status.textContent = 'MELEE HIT // CLOSE QUARTERS';
}

function useMedkit(gun) {
  const restored = Math.min(gun.healAmount || 45, 100 - state.health);
  state.health += restored;
  updateVitals();
  ui.status.textContent = `MEDKIT USED // +${restored} HEALTH`;
  if (gun.ammo <= 0) setTimeout(() => { if (loadout[state.weaponIndex] === gun) reload(); }, 300);
}

function useAdrenalineMedkit(gun) {
  state.healRemaining = Math.min(gun.healAmount || 50, 100 - state.health);
  state.healEnds = performance.now() + (gun.healDuration || 3000);
  state.speedBoostUntil = performance.now() + (gun.speedDuration || 6000);
  ui.status.textContent = 'ADRENALINE ACTIVE // HEALING + SPEED';
  if (gun.ammo <= 0) setTimeout(() => { if (loadout[state.weaponIndex] === gun) reload(); }, 300);
}

function placeShockMine(gun) {
  const direction = new THREE.Vector3(); camera.getWorldDirection(direction); direction.y = 0; direction.normalize();
  const point = state.placementPreview&&state.placementValid?state.placementPoint.clone():state.position.clone().addScaledVector(direction, 1.8); point.y = groundHeightAt(point.x, point.z,state.position.y+.8) + .08;
  const group = new THREE.Group(); group.position.copy(point); world.add(group);
  const disc = new THREE.Mesh(new THREE.CylinderGeometry(.48, .58, .12, 12), new THREE.MeshStandardMaterial({ color:0x142b36, emissive:0x50e5ff, emissiveIntensity:.38, metalness:.8, roughness:.28 })); group.add(disc);
  const sensor = new THREE.Mesh(new THREE.RingGeometry(.18, .34, 18), new THREE.MeshBasicMaterial({ color:0x50e5ff, side:THREE.DoubleSide, transparent:true, opacity:.9 })); sensor.rotation.x = -Math.PI / 2; sensor.position.y = .08; group.add(sensor);
  shockMines.push({ group, gun, armedAt:performance.now() + 500, phase:Math.random() * Math.PI * 2 });
  if (shockMines.length > 5) removeShockMine(shockMines[0]);
  ui.status.textContent = `SHOCK MINE ARMED // ${shockMines.length} ACTIVE`;
  if (gun.ammo <= 0) setTimeout(() => { if (loadout[state.weaponIndex] === gun) reload(); }, 300);
}

function removeShockMine(mine) {
  const index = shockMines.indexOf(mine); if (index >= 0) shockMines.splice(index, 1);
  world.remove(mine.group); mine.group.traverse(child => { child.geometry?.dispose(); child.material?.dispose(); });
}

function deployHardlightWall(gun) {
  const forward=new THREE.Vector3(); camera.getWorldDirection(forward); forward.y=0; forward.normalize();
  const point=state.placementPreview&&state.placementValid?state.placementPoint.clone():state.position.clone().addScaledVector(forward,6); point.y=groundHeightAt(point.x,point.z,state.position.y+.8)+2.5;
  const wall=new THREE.Mesh(new THREE.BoxGeometry(7,5,.18),new THREE.MeshStandardMaterial({color:0x58dfff,emissive:0x1b6f96,emissiveIntensity:.55,transparent:true,opacity:.38,metalness:.2,roughness:.18}));
  wall.position.copy(point); wall.rotation.y=state.yaw; wall.userData.collider={bulletOnly:true}; world.add(wall); occluders.push(wall);
  hardlightWalls.push({mesh:wall,expires:performance.now()+7000}); ui.status.textContent='HARDLIGHT WALL // 7 SECONDS';
}

function deployMirrorDrones() {
  const right=new THREE.Vector3(1,0,0).applyAxisAngle(new THREE.Vector3(0,1,0),state.yaw);
  for (let index=-1;index<=1;index++) { activateDecoy(performance.now()); const decoy=activeDecoys[activeDecoys.length-1]; if(decoy) { decoy.group.position.addScaledVector(right,index*2.2); decoy.moving=true; } }
  ui.status.textContent='MIRROR DRONE // THREE COPIES ACTIVE';
}

function usePhaseBeacon() {
  const point=state.position.clone(); const group=new THREE.Group(); group.position.copy(point); world.add(group);
  const ring=new THREE.Mesh(new THREE.TorusGeometry(.72,.08,8,24),new THREE.MeshBasicMaterial({color:0xa477ff,transparent:true,opacity:.9})); ring.rotation.x=Math.PI/2; group.add(ring);
  const light=new THREE.PointLight(0xa477ff,5,8); group.add(light);
  state.phaseBeacon={point,group,ring,expires:performance.now()+10000}; ui.status.textContent='PHASE BEACON // FIRE AGAIN TO RETURN';
}

function removePhaseBeacon() {
  if(!state.phaseBeacon) return; world.remove(state.phaseBeacon.group); state.phaseBeacon.group.traverse(child=>{child.geometry?.dispose();child.material?.dispose();}); state.phaseBeacon=null;
}

function returnToPhaseBeacon() {
  const beacon=state.phaseBeacon; if(!beacon) return; state.position.copy(beacon.point); state.velocity.set(0,0,0); removePhaseBeacon(); ui.status.textContent='PHASE BEACON // POSITION RESTORED';
}

function deployAmmoSynth(gun) {
  const direction=new THREE.Vector3(); camera.getWorldDirection(direction); direction.y=0; direction.normalize();
  const point=state.placementPreview&&state.placementValid?state.placementPoint.clone():state.position.clone().addScaledVector(direction,2.4); point.y=groundHeightAt(point.x,point.z,state.position.y+.8)+.6;
  const group=new THREE.Group(); group.position.copy(point); world.add(group);
  const caseMesh=new THREE.Mesh(new THREE.BoxGeometry(1.25,1.1,1.25),new THREE.MeshStandardMaterial({color:0x493b22,emissive:0xffc857,emissiveIntensity:.35,metalness:.7,roughness:.3})); group.add(caseMesh);
  const ring=new THREE.Mesh(new THREE.TorusGeometry(.75,.055,7,24),new THREE.MeshBasicMaterial({color:0xffc857})); ring.rotation.x=Math.PI/2; ring.position.y=.65; group.add(ring);
  const blip=document.createElement('span'); blip.className='radar-blip enemy pinged'; ui.radar.append(blip);
  ammoSynths.push({group,ring,blip,gun,expires:performance.now()+12000,nextAmmo:performance.now()+1500}); ui.status.textContent='AMMO SYNTHESIZER // BROADCASTING 12S';
}

function createGravityWell(point, gun) {
  const group = new THREE.Group(); group.position.copy(point); world.add(group);
  const core = new THREE.Mesh(new THREE.SphereGeometry(.5, 18, 12), new THREE.MeshBasicMaterial({ color:0x140424 })); group.add(core);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(2.2, .08, 8, 32), new THREE.MeshBasicMaterial({ color:0x9b6cff, transparent:true, opacity:.9 })); ring.rotation.x = Math.PI / 2; group.add(ring);
  const light = new THREE.PointLight(0x9b6cff, 8, gun.blastRadius * 1.3); group.add(light);
  gravityWells.push({ group, ring, point:point.clone(), radius:gun.blastRadius || 15, expires:performance.now() + 3000 });
}

function updateUtilitySystems(dt) {
  const now = performance.now();
  if (state.healRemaining > 0 && now < state.healEnds && state.health < 100) {
    const amount = Math.min(state.healRemaining, (50 / 3) * dt, 100 - state.health);
    state.health += amount; state.healRemaining -= amount; updateVitals();
  } else if (now >= state.healEnds) state.healRemaining = 0;
  for (const well of [...gravityWells]) {
    const life = Math.max(0, well.expires - now) / 3000;
    well.ring.rotation.z += dt * 4; well.ring.scale.setScalar(1 + Math.sin(now * .012) * .14); well.ring.material.opacity = .3 + life * .65;
    for (const enemy of enemies) {
      if (!enemy.alive || enemy.arena !== state.activeArena) continue;
      const pull = well.point.clone().sub(enemy.group.position); pull.y = 0; const distance = pull.length();
      if (!distance || distance > well.radius) continue;
      enemy.group.position.addScaledVector(pull.normalize(), (4 + (1 - distance / well.radius) * 8) * dt); enemy.slowUntil = now + 180;
    }
    for (const explosive of thrownExplosives) {
      const pull=well.point.clone().sub(explosive.group.position); const distance=pull.length();
      if (distance>0&&distance<well.radius*1.25) explosive.velocity.addScaledVector(pull.normalize(),18*dt);
    }
    if (now < well.expires) continue;
    world.remove(well.group); well.group.traverse(child => { child.geometry?.dispose(); child.material?.dispose(); }); gravityWells.splice(gravityWells.indexOf(well), 1);
  }
  for (const mine of [...shockMines]) {
    mine.group.rotation.y += dt * 1.8; mine.group.scale.setScalar(.96 + Math.sin(now * .009 + mine.phase) * .06);
    if (now < mine.armedAt) continue;
    const enemy = enemies.find(target => target.alive && target.arena === state.activeArena && target.group.position.distanceTo(mine.group.position) <= (mine.gun.triggerRadius || 4.5));
    if (!enemy) continue;
    enemy.stunnedUntil = now + (mine.gun.stunDuration || 1500); damageTarget(enemy, mine.gun.damage || 28);
    const blast = new THREE.Mesh(new THREE.SphereGeometry(1, 14, 9), new THREE.MeshBasicMaterial({ color:0x50e5ff, wireframe:true, transparent:true, opacity:.9 }));
    blast.position.copy(mine.group.position); world.add(blast); queueBlast(blast,5); removeShockMine(mine);
    ui.status.textContent = 'SHOCK MINE TRIGGERED // TARGET STUNNED';
  }
  for (const wall of [...hardlightWalls]) {
    wall.mesh.material.opacity=.28+Math.sin(now*.012)*.1;
    if(now>=wall.expires) removeHardlightWall(wall);
  }
  for (const field of [...utilityFields]) {
    field.ring.rotation.z+=dt*(field.gun.special==='discoBall'?3.8:.6); field.ring.material.opacity=.16+Math.sin(now*.008)*.1;
    const playerInside=Math.hypot(state.position.x-field.point.x,state.position.z-field.point.z)<=field.radius;
    if (field.gun.special==='resonanceDisc' && now>=field.nextPulse && field.pulses<3) {
      field.nextPulse=now+850; field.pulses++; field.ring.scale.setScalar(.65); setTimeout(()=>field.ring?.scale.setScalar(1),120);
      for(const enemy of enemies) if(enemy.alive&&enemy.group.position.distanceTo(field.point)<=field.radius){enemy.slowUntil=now+1400;enemy.pingedUntil=now+1800;}
    }
    if (field.gun.special==='muteGrenade' && playerInside) state.mutedUntil=now+180;
    if (field.gun.special==='redHerring' && playerInside) state.mutedUntil=now+220;
    if(field.gun.special==='discoBall'){
      if(playerInside)state.speedBoostUntil=Math.max(state.speedBoostUntil,now+240);
      if(now>=field.nextPulse){field.nextPulse=now+620;field.pulses++;const color=[0xff4fba,0x50e5ff,0xffc857,0xe7ff57][field.pulses%4];createPulseBlast(field.point,field.radius,color);for(const enemy of enemies)if(enemy.alive&&enemy.arena===state.activeArena&&enemy.group.position.distanceTo(field.point)<=field.radius)enemy.pingedUntil=now+1200;}
    }
    if(field.gun.special==='bubblePuddle')for(const target of [...dummies,...enemies])if(target.alive&&target.group.position.distanceTo(field.point)<=field.radius)target.slowUntil=now+240;
    if(field.gun.special==='mustardTrail')for(const target of [...dummies,...enemies])if(target.alive&&target.group.position.distanceTo(field.point)<=field.radius){target.slowUntil=now+260;if(!field.launched.has(target)){field.launched.set(target,true);pushTarget(target,new THREE.Vector3(Math.sin(now),0,Math.cos(now)),5);}}
    if(field.gun.special==='unicornTrail'&&playerInside)state.speedBoostUntil=Math.max(state.speedBoostUntil,now+260);
    if (field.gun.special==='updraft') {
      if(playerInside){state.velocity.y=Math.max(state.velocity.y,13);state.onGround=false;state.impulseUntil=now+300;}
      for(const enemy of enemies) if(enemy.alive&&enemy.group.position.distanceTo(field.point)<=field.radius){
        if(!field.launched.has(enemy)) field.launched.set(enemy,enemy.group.position.y);
        enemy.group.position.y=Math.min(field.launched.get(enemy)+7,enemy.group.position.y+dt*10); enemy.stunnedUntil=now+220;
      }
    }
    if (field.gun.special==='naniteMist') {
      if(playerInside&&state.health<100){state.health=Math.min(100,state.health+12*dt);updateVitals();}
      for(const target of [...dummies,...enemies]) if(target.alive&&target.group.position.distanceTo(field.point)<=field.radius) target.health=Math.min(target.kind==='enemy'?140:100,target.health+6*dt);
    }
    if(now<field.expires) continue;
    if(field.gun.special==='discoBall'&&!field.finale){field.finale=true;createChaosBurst(field.point,[0xff4fba,0x50e5ff,0xffc857,0xe7ff57],30,12);createPulseBlast(field.point,field.radius,0xffffff);for(const target of [...dummies,...enemies])if(target.alive&&target.group.position.distanceTo(field.point)<=field.radius){target.lastDamagingGun=field.gun;damageTarget(target,field.gun.damage||52);}chaosSound('pop',330,1.7);}
    if(field.gun.special==='updraft')field.launched.forEach((baseY,target)=>{if(target.alive) target.group.position.y=baseY;});
    world.remove(field.group); field.group.traverse(child=>{child.geometry?.dispose();child.material?.dispose();}); utilityFields.splice(utilityFields.indexOf(field),1);
  }
  for (const synth of [...ammoSynths]) {
    synth.ring.rotation.z+=dt*2.6; synth.group.scale.setScalar(.96+Math.sin(now*.01)*.04);
    const relative=synth.group.position.clone().sub(state.position); const radarScale=136/700; synth.blip.style.left=`${68+THREE.MathUtils.clamp(relative.x*radarScale,-62,62)}px`; synth.blip.style.top=`${68+THREE.MathUtils.clamp(relative.z*radarScale,-62,62)}px`;
    if(now>=synth.nextAmmo){
      synth.nextAmmo=now+1500; const active=loadout[state.weaponIndex]; active.reserve=Math.min(active.maxReserve,active.reserve+Math.max(1,Math.ceil(active.magSize*.08))); updateAmmo(); ui.status.textContent='AMMO SYNTHESIZER // AMMO GENERATED';
    }
    if(now<synth.expires) continue;
    world.remove(synth.group); synth.group.traverse(child=>{child.geometry?.dispose();child.material?.dispose();}); synth.blip.remove(); ammoSynths.splice(ammoSynths.indexOf(synth),1);
  }
  if(state.phaseBeacon){
    state.phaseBeacon.ring.rotation.z+=dt*2;
    if(now>=state.phaseBeacon.expires){removePhaseBeacon();ui.status.textContent='PHASE BEACON // WINDOW EXPIRED';}
  }
  ui.radar.style.opacity=now<(state.mutedUntil||0)?'.18':'1';
}

function fireVoidGun() {
  const hits = centerShotHits([...activeOccluders(), ground], 180);
  if (!hits.length) { ui.status.textContent = 'VOID SHOT // NO GEOMETRY'; return; }
  const hit = hits[0]; const collider = hit.object.userData.collider;
  if (hit.object === ground) hit.point.y = groundHeightAt(hit.point.x,hit.point.z)+.04;
  const visual = new THREE.Mesh(new THREE.SphereGeometry(2.5, 20, 14), new THREE.MeshBasicMaterial({ color:0x000000, side:THREE.DoubleSide }));
  visual.position.copy(hit.point); world.add(visual);
  const zone = { point:hit.point.clone(), radius:2.5, floor:hit.object === ground, collider, mesh:hit.object, visual, expires:performance.now()+5000 };
  voidZones.push(zone);
  if (collider) { collider.active = false; hit.object.userData.voided = true; hit.object.visible = false; }
  addBeam(camera.position.clone(), hit.point, 0x000000, 220);
  ui.status.textContent = 'GEOMETRY ERASED // RESTORE IN 5.0';
  setTimeout(() => restoreVoidZone(zone), 5000);
}

function insideCollider(position, collider) {
  return collider && position.x > collider.minX && position.x < collider.maxX && position.z > collider.minZ && position.z < collider.maxZ && position.y > collider.minY - .5 && position.y < collider.maxY + 2;
}

function restoreVoidZone(zone) {
  const index = voidZones.indexOf(zone); if (index >= 0) voidZones.splice(index, 1);
  world.remove(zone.visual); zone.visual.geometry.dispose(); zone.visual.material.dispose();
  if (zone.collider) {
    zone.collider.active = true; zone.mesh.userData.voided = false; zone.mesh.visible = true;
    if (insideCollider(state.position, zone.collider)) damagePlayer(100);
    enemies.filter(enemy => enemy.alive && insideCollider(enemy.group.position.clone().add(new THREE.Vector3(0,2,0)), zone.collider)).forEach(enemy => damageTarget(enemy, 999));
  } else if (zone.floor && Math.hypot(state.position.x-zone.point.x,state.position.z-zone.point.z) < zone.radius && state.position.y < zone.point.y + 1.5) damagePlayer(100);
  ui.status.textContent = 'VOID GEOMETRY RESTORED';
}

function fireRepulsor() {
  const direction = new THREE.Vector3(); camera.getWorldDirection(direction);
  state.velocity.addScaledVector(direction, -45); state.velocity.y += 5.5; state.onGround = false; state.impulseUntil = performance.now() + 950; state.shake = .2;
  const hits = centerShotHits([...activeShootables(), ...activeOccluders()], 90);
  const hit = hits[0]; const target = hit?.object.userData.target;
  if (target?.alive && target.kind === 'enemy') {
    for (let step = 0; step < 15; step++) {
      const nextX = target.group.position.x + direction.x; const nextZ = target.group.position.z + direction.z;
      if (collides(nextX,nextZ)) break; target.group.position.x = nextX; target.group.position.z = nextZ;
    }
    target.stunnedUntil = performance.now() + 700;
  }
  if (hit) addBeam(camera.position.clone(), hit.point, 0xffb34d, 100);
  ui.status.textContent = target?.kind === 'enemy' ? 'KINETIC HIT // TARGET REPULSED' : 'RECOIL BOOST // 45 M/S';
}

function fireAcousticWave() {
  const direction = new THREE.Vector3(); camera.getWorldDirection(direction);
  const material = new THREE.MeshBasicMaterial({ color:0xf2b84b, transparent:true, opacity:.55, wireframe:true });
  const visual = new THREE.Mesh(new THREE.SphereGeometry(.72, 12, 8), material);
  visual.position.copy(camera.position).addScaledVector(direction, 1.2); world.add(visual);
  acousticWaves.push({ mesh:visual, velocity:direction.multiplyScalar(30), distance:0, bounces:0, hitTargets:new Set() });
  ui.status.textContent = 'ACOUSTIC WAVE // LIVE';
}

function endpointPosition(endpoint) {
  return endpoint.target?.alive ? endpoint.target.group.position.clone().add(new THREE.Vector3(0,3,0)) : endpoint.point.clone();
}

function clearMagnetNode(gun) {
  if (gun.linkA?.node) { world.remove(gun.linkA.node); gun.linkA.node.geometry.dispose(); gun.linkA.node.material.dispose(); }
  gun.linkA = null;
}

function failMagnetLink(gun) {
  clearMagnetNode(gun); ui.status.textContent = 'MAGNET LINK FAILED // RELOADING';
  if (gun.ammo > 0) gun.ammo = 0; updateAmmo(); setTimeout(reload, 30);
}

function fireMagnetNode(gun) {
  const hits = centerShotHits([...activeShootables(), ...activeOccluders(), ground], 90);
  if (!hits.length) { if (gun.linkA) failMagnetLink(gun); else ui.status.textContent = 'POSITIVE NODE MISSED'; return; }
  const hit = hits[0];
  const endpoint = { target:hit.object.userData.target || null, point:hit.point.clone() };
  const node = new THREE.Mesh(new THREE.SphereGeometry(.22,10,8), new THREE.MeshBasicMaterial({ color:gun.linkA ? 0xff4f64 : 0x49cfff })); node.position.copy(hit.point); world.add(node); endpoint.node = node;
  if (!gun.linkA) { gun.linkA = endpoint; ui.status.textContent = '[ + ] NODE SET // PLACE [ − ]'; return; }
  const first = gun.linkA; const distance = endpointPosition(first).distanceTo(endpointPosition(endpoint));
  if (distance > 30 || (!first.target && !endpoint.target)) { world.remove(node); failMagnetLink(gun); return; }
  const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints([endpointPosition(first),endpointPosition(endpoint)]), new THREE.LineBasicMaterial({ color:0x42cfff, transparent:true, opacity:.9 })); world.add(line);
  magnetLinks.push({ a:first, b:endpoint, line, started:performance.now(), duration:700, resolved:false });
  if (first.node) world.remove(first.node); world.remove(node); gun.linkA = null;
  ui.status.textContent = 'MAGNET LINK LOCKED // ATTRACTION';
  if (gun.ammo <= 0) setTimeout(reload, 760);
}

function makeWireAnchor(point) {
  const mesh = new THREE.Mesh(new THREE.OctahedronGeometry(.28), new THREE.MeshStandardMaterial({ color:0xe7ff57, emissive:0xe7ff57, emissiveIntensity:.8 }));
  mesh.position.copy(point); world.add(mesh);
  const anchor = { mesh, point:point.clone(), hp:50, wire:null }; mesh.userData.wireAnchor = anchor; mesh.userData.arena=state.activeArena; shootables.push(mesh);
  return anchor;
}

function fireWireNode(gun) {
  const hits = centerShotHits([...activeOccluders(), ground], 70);
  if (!hits.length) { ui.status.textContent = 'ANCHOR MISSED'; return; }
  const anchor = makeWireAnchor(hits[0].point);
  if (!gun.pendingAnchor) { gun.pendingAnchor = anchor; ui.status.textContent = 'FIRST ANCHOR SET // PLACE SECOND'; return; }
  const first = gun.pendingAnchor; const distance = first.point.distanceTo(anchor.point); gun.pendingAnchor = null;
  if (distance > 20) { removeLooseAnchor(first); removeLooseAnchor(anchor); ui.status.textContent = 'WIRE FAILED // OVER 20 METERS'; return; }
  const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints([first.point,anchor.point]), new THREE.LineBasicMaterial({ color:0xe7ff57, transparent:true, opacity:.85 })); world.add(line);
  const wire = { a:first, b:anchor, line, triggered:new Map() }; first.wire = wire; anchor.wire = wire; activeWires.push(wire);
  if (activeWires.length > 3) removeWire(activeWires[0]);
  ui.status.textContent = `WIRE ACTIVE // ${activeWires.length} OF 3`;
  if (gun.ammo <= 0) setTimeout(reload, 50);
}

function removeLooseAnchor(anchor) {
  const index = shootables.indexOf(anchor.mesh); if (index >= 0) shootables.splice(index,1);
  world.remove(anchor.mesh); anchor.mesh.geometry.dispose(); anchor.mesh.material.dispose();
}

function removeWire(wire) {
  const index = activeWires.indexOf(wire); if (index >= 0) activeWires.splice(index,1);
  removeLooseAnchor(wire.a); removeLooseAnchor(wire.b); world.remove(wire.line); wire.line.geometry.dispose(); wire.line.material.dispose();
}

function damageWireAnchor(anchor, damage) {
  anchor.hp -= damage;
  if (anchor.hp <= 0) { if (anchor.wire) removeWire(anchor.wire); else removeLooseAnchor(anchor); ui.status.textContent = 'WIRE ANCHOR DESTROYED'; }
}

function damageTarget(target, damage) {
  const paidDamage = Math.min(target.health, damage);
  target.health -= damage;if(target.kind==='enemy'){target.lastHurtAt=performance.now();if(target.alive&&target.aiState!==AI_STATES.reload&&Math.random()<.36){target.aiState=AI_STATES.takeCover;target.repositionUntil=performance.now()+700+Math.random()*700;target.aimConfidence=0;}}
  addCash(Math.max(2, Math.round(paidDamage * (target.kind === 'enemy' ? .62 : .45))), target.kind === 'enemy' ? 'HOSTILE HIT' : 'TARGET HIT');
  const shot = target.lastShotMeta; target.lastShotMeta = null;
  target.lastKillMeta = shot;
  if(shot?.gun)gainWeaponXp(shot.gun,Math.max(2,paidDamage*.3)+(shot.headshot?8:0),'DAMAGE');
  if(shot){progress.stats.longestShot=Math.max(progress.stats.longestShot,shot.distance||0);if(shot.headshot){progress.stats.headshots++;state.matchHeadshots++;if(shot.scoped)recordChallenge('scopedHeadshots');}}
  if (shot?.scoped && shot.distance >= 60) {
    const bonus = shot.headshot ? 140 : 60;
    addCash(bonus, `${shot.headshot ? 'LONG HEADSHOT' : 'LONG SHOT'} // ${Math.round(shot.distance)}M`);
  }
  target.body.material.emissive.setHex(0xff3b16); target.body.material.emissiveIntensity = .8;
  setTimeout(() => { target.body.material.emissiveIntensity = 0; }, 90);
  target.group.rotation.z += (Math.random() - .5) * .12;
  ui.hitmarker.classList.remove('show'); ui.damage.classList.remove('show'); void ui.hitmarker.offsetWidth;
  ui.hitmarker.classList.add('show'); ui.damage.textContent = damage; ui.damage.classList.add('show');
  if (target.health <= 0) target.kind === 'enemy' ? downEnemy(target) : downDummy(target);
}

function triggerLastWordReload(target) {
  const gun=target.lastDamagingGun; target.lastDamagingGun=null;
  if(gun?.special!=='lastWord') return;
  const amount=Math.min(gun.magSize-gun.ammo,gun.reserve); gun.ammo+=amount; gun.reserve-=amount;
  if(gun===loadout[state.weaponIndex]) updateAmmo(); ui.status.textContent='LAST WORD // ELIMINATION QUICK-LOAD';
}

function triggerApexPredator(target) {
  const shot = target.lastKillMeta;
  if (!hasPassive('apex') || loadout[state.weaponIndex].kind !== 'sniper' || !shot?.scoped || shot.distance < 60) return;
  state.lastDamageAt = 0; state.shield = Math.min(50,state.shield + 4); updateVitals(); ui.status.textContent = `APEX PREDATOR // SHIELD REGEN ACTIVE // ${Math.round(shot.distance)}M`;
}

const shotKillCounts=new Map();
function evaluateExecutionChallenges(target,shot){
  if(!shot)return;const now=performance.now();const gun=shot.gun||loadout[state.weaponIndex];if(shot.airborne&&shot.headshot)recordExecution('airHeadshot',gun);if(shot.scoped&&shot.distance>=60)recordExecution('longScoped',gun);if(slotForGun(gun)===1)recordExecution('secondary',gun);if(gun.effect==='melee'&&now-state.lastGrappleReleaseAt<2600)recordExecution('meleeGrapple',gun);if(now-state.lastSlideCancelAt<1800)recordExecution('slideCancel',gun);if(shot.throughCover)recordExecution('throughCover',gun);if(shot.ricochet)recordExecution('ricochet',gun);if(shot.lastRound)recordExecution('lastRound',gun);if(shot.thermal)recordExecution('thermal',gun);if(shot.movingPlatform)recordExecution('movingPlatform',gun);if(now-(target.lastEnvironmentalDamage||0)<1200)recordExecution('environmental',gun);if(movementCombo.tier>=4)recordExecution('maxCombo',gun);if(shot.shotId){const count=(shotKillCounts.get(shot.shotId)||0)+1;shotKillCounts.set(shot.shotId,count);if(count>=2)recordExecution('piercingDouble',gun);setTimeout(()=>shotKillCounts.delete(shot.shotId),1500);}if(shot.airborne){addMovementCombo(shot.headshot?'AIRBORNE TRICK SHOT':'AIRBORNE ELIMINATION',shot.headshot?100:70,now);}gainWeaponXp(gun,110+(shot.headshot?35:0)+(shot.distance>=60?30:0),'ELIMINATION');target.lastKillMeta=null;
}

function downDummy(dummy) {
  dummy.alive = false; state.targets--; state.kills++;
  const killShot=dummy.lastKillMeta;
  triggerLastWordReload(dummy);
  triggerApexPredator(dummy);
  evaluateExecutionChallenges(dummy,killShot);
  progress.stats.eliminations++;progress.stats.dummyEliminations++;recordChallenge('dummies');
  if(state.firingRange){const clearedAt=performance.now();state.rangeKills++;state.rangeLastClear=clearedAt-state.rangeStartedAt;state.rangeStartedAt=clearedAt;if(!progress.stats.fastestTargetClear||state.rangeLastClear<progress.stats.fastestTargetClear)progress.stats.fastestTargetClear=state.rangeLastClear;updateFiringRangeHUD();}
  if(killShot?.distance>=60)recordChallenge('longKill');if(performance.now()-state.lastLaunchAt<5000)recordChallenge('airKill');
  addCash(90, 'TARGET DOWN');
  const gun = loadout[state.weaponIndex];
  gun.reserve = Math.min(gun.maxReserve, gun.reserve + gun.magSize);
  updateAmmo();
  ui.targets.textContent = String(state.targets).padStart(2, '0');
  ui.blips[dummy.index].classList.add('down');
  ui.status.textContent = '+$90 TARGET BONUS // RESUPPLIED';
  dummy.respawnTimer=setTimeout(() => respawnDummy(dummy), 2200);
}

function respawnDummy(dummy) {
  const choices = dummySpawns.filter((_, index) => (index < 3 ? 0 : index < 6 ? 1 : 2) === dummy.arena);
  const point = state.firingRange&&dummy.rangeBaseX!=null ? new THREE.Vector3(dummy.rangeBaseX,groundHeightAt(dummy.rangeBaseX,dummy.rangeBaseZ),dummy.rangeBaseZ) : choices[Math.floor(Math.random() * choices.length)] || dummySpawns[dummy.index];
  dummy.group.position.copy(point); dummy.baseY = point.y; dummy.group.rotation.set(0, Math.atan2(state.position.x - point.x, state.position.z - point.z), 0);
  dummy.health = 100; dummy.alive = true;if(dummy.arena===state.activeArena)state.targets++;
  dummy.respawnTimer=null;
  ui.targets.textContent = String(state.targets).padStart(2, '0'); ui.blips[dummy.index].classList.remove('down');
  ui.status.textContent = 'NEW TARGET DEPLOYED';
}

function downEnemy(enemy,awardPlayer=true,attacker=null) {
  enemy.alive = false;enemy.robotTarget=null;enemy.aiState=AI_STATES.patrol;enemy.burstRemaining=0;state.hostiles--;
  if(awardPlayer){
    state.kills++;state.enemyKills++;
    const killShot=enemy.lastKillMeta;
    triggerLastWordReload(enemy);
    triggerApexPredator(enemy);
    evaluateExecutionChallenges(enemy,killShot);
    progress.stats.eliminations++;progress.stats.hostileEliminations++;if(killShot?.distance>=60)recordChallenge('longKill');if(performance.now()-state.lastLaunchAt<5000)recordChallenge('airKill');if(slotForGun(killShot?.gun||loadout[state.weaponIndex])===1)recordChallenge('secondaryKill');
    addCash(enemy.reward||125, enemy.eliteType?`${enemy.eliteName} DOWN`:'HOSTILE DOWN');
    const fx=equippedKillFx();if(fx){enemy.eliminationSerial=(enemy.eliminationSerial||0)+1;triggerKillFx(fx,enemy.group.position.clone().add(new THREE.Vector3(0,.35,0)),`enemy-${enemy.index}-${enemy.eliminationSerial}`);}
    ui.status.textContent = `+$${enemy.reward||125} ${enemy.eliteType?enemy.eliteName:'HOSTILE'} ELIMINATED`;
  }else{
    enemy.lastKillMeta=null;enemy.lastShotMeta=null;
    if(attacker)attacker.robotTarget=null;
    ui.status.textContent='ROBOT SKIRMISH // HOSTILE DISABLED';
  }
  ui.enemies.textContent = String(state.hostiles).padStart(2, '0'); ui.enemyBlips[enemy.index].classList.add('down');
  if(state.gameMode!=='factoryDefense')enemy.respawnTimer = setTimeout(() => respawnEnemy(enemy), 5200);
}

function respawnEnemy(enemy) {
  const spawn = enemySpawns[enemy.index];
  const now=performance.now(),profile=enemyDifficultyProfiles[progress.settings.enemyDifficulty]||enemyDifficultyProfiles.normal;
  enemy.group.position.copy(spawn); enemy.group.rotation.set(0, 0, 0); enemy.health = enemy.maxHealth||140; enemy.alive = true; enemy.pingedUntil = 0; enemy.pingShell.visible = false;enemy.spottedAt=0;enemy.lastSeenAt=0;enemy.hasLineOfSight=false;enemy.burstRemaining=0;enemy.robotTarget=null;enemy.nextTargetDecisionAt=0;enemy.shieldHealth=enemy.eliteType==='shield'?180:0;enemy.aiState=AI_STATES.patrol;enemy.magazine=profile.magazine;enemy.ammo=profile.magazine;enemy.reloadEndsAt=0;enemy.reactionEndsAt=0;enemy.aimConfidence=0;enemy.consecutiveHits=0;enemy.spawnAwareAt=now+profile.spawnAwarenessMs;if(enemy.shield)enemy.shield.visible=true;if(enemy.drone)enemy.drone.alive=true;
  enemy.nextShot = now + 1800; enemy.respawnTimer = null;if(enemy.arena===state.activeArena)state.hostiles++;
  ui.enemies.textContent = String(state.hostiles).padStart(2, '0'); ui.enemyBlips[enemy.index].classList.remove('down');
  ui.status.textContent = 'HOSTILE REINFORCEMENT INBOUND';
}

function reload() {
  if(state.gameMode==='multiplayer'){if(state.completed)return;setAiming(false);onlineMatch.reload();ui.status.textContent='RELOAD REQUEST // SERVER VALIDATING';return;}
  const gun = loadout[state.weaponIndex];
  if (state.reloading || gun.ammo === gun.magSize || gun.reserve === 0 || state.completed || state.dead) return;
  setAiming(false);
  const sillyReloads={pizzaParty:'FRESH PIZZA // DELIVERY BOX LOADED',redFish:'FISHBOWL DIP // WATER REFILLED',toaster:'TWO SLICES // PUSHED DOWN',baguette:'PAPER WRAP // FRESH BAGUETTE',bananaPeel:'SIX TINY BANANAS // CYLINDER LOADED',bubbleTea:'GIANT STRAW // INSERTED',sockPuppet:'COLORFUL BUTTONS // FED',condiments:'KETCHUP + MUSTARD // SHAKE SHAKE'};
  state.reloading = true; ui.status.textContent = sillyReloads[gun.special]||`RELOADING // ${gun.name}`; weapon.rotation.z = -.35; weapon.position.y = -.63;if(gun.category==='SILLY')chaosSound('pop',180,.65);
  const reloadDuration = gun.reloadTime * (performance.now() < state.velocityBoostUntil||performance.now()<state.comboReloadUntil ? .75 : 1);
  beginWeaponVisualAnimation(gun,gun.ammo===0?'emptyReload':'reload',reloadDuration);
  state.reloadTimer = setTimeout(() => {
    const needed = gun.magSize - gun.ammo; const amount = Math.min(needed, gun.reserve);
    gun.ammo += amount; gun.reserve -= amount; state.reloading = false; state.reloadTimer = null;
    weapon.rotation.z = 0; weapon.position.y = -.4; ui.status.textContent = 'RANGE LIVE'; updateAmmo();
  }, reloadDuration);
}

function slotForGun(gun) {
  if (Number.isInteger(gun.slot)) return gun.slot;
  if (gun.id === 'combat-knife' || gun.effect === 'melee') return 2;
  if (gun.id === 'frag-bomb' || ['explosive','heal','gravityBomb','adrenaline','shockMine'].includes(gun.effect) || gun.kind === 'launcher' || gun.kind === 'grenade' || gun.kind === 'medkit' || gun.kind === 'mine') return 3;
  if (gun.kind === 'pistol') return 1;
  return 0;
}

function updateQuickSlotUI() {
  const roleNames = ['PRIMARY', 'SECONDARY', 'MELEE', 'OTHER'];
  ui.weaponSlots.forEach((slot, slotIndex) => {
    const gun = loadout[quickSlots[slotIndex]];
    slot.classList.toggle('active', quickSlots[slotIndex] === state.weaponIndex);
    const iconClass = slotIndex === 0 ? 'primary' : slotIndex === 1 ? 'secondary' : slotIndex === 2 ? 'melee' : gun.kind === 'medkit' ? 'medkit' : gun.kind === 'mine' ? 'mine' : 'utility';
    const meta = slotIndex === 0 ? `${gun.ammo}/${gun.reserve}` : slotIndex === 1 ? '▮▮▮ RAPID' : slotIndex === 2 ? 'ϟ +8% MOVE' : `×${gun.ammo + gun.reserve}`;
    slot.innerHTML = `<kbd>${slotIndex + 1}</kbd><i class="slot-icon ${iconClass}" aria-hidden="true"></i><span class="slot-copy"><small>${roleNames[slotIndex]}</small><b>${gun.name.replace(/^THE /, '')}</b></span><em class="slot-meta">${meta}</em>${slotIndex === 3 ? '<i class="slot-cooldown" aria-hidden="true"></i>' : ''}`;
    slot._meta=slot.querySelector('.slot-meta'); slot._cooldown=slot.querySelector('.slot-cooldown');
  });
}

function updateHotbarIndicators(now = performance.now()) {
  ui.weaponSlots.forEach((slot, slotIndex) => {
    const gun = loadout[quickSlots[slotIndex]];
    const meta = slot._meta;
    if (meta) setTextIfChanged(meta,slotIndex === 0 ? `${gun.ammo}/${gun.reserve}` : slotIndex === 1 ? '▮▮▮ RAPID' : slotIndex === 2 ? 'ϟ +8% MOVE' : `×${gun.ammo + gun.reserve}`);
    const cooldown = slot._cooldown;
    if (!cooldown) return;
    const remaining = Math.max(0, (gun.cooldownEnds || 0) - now);
    const progress = gun.cooldownDuration ? remaining / gun.cooldownDuration : 0;
    cooldown.style.setProperty('--cooldown', `${progress * 360}deg`);
    cooldown.classList.toggle('running', progress > 0);
  });
}

function equipQuickSlot(slotIndex) {
  const index = quickSlots[slotIndex];
  if (index >= 0) switchWeapon(index, false);
}

function switchWeapon(index, assignToSlot = true) {
  if (index < 0 || index >= loadout.length || state.completed) return;
  if(state.gameMode==='multiplayer'&&loadout[index].id!=='specter'){ui.status.textContent='PRIVATE 1V1 // SERVER LOADOUT LOCKED TO SPECTER';return;}
  if (!progress.unlocked.has(loadout[index].id)) { ui.status.textContent = `${loadout[index].name} // LOCKED`; return; }
  if (assignToSlot) { const slot = slotForGun(loadout[index]); quickSlots[slot] = index; applyCosmeticToSlot(slot); }
  if (index === state.weaponIndex){updateQuickSlotUI();return;}
  setAiming(false);
  if (state.reloadTimer) clearTimeout(state.reloadTimer);
  state.reloading = false; state.reloadTimer = null; state.mouseDown = false; state.chargingGun=null;
  const previousGun=loadout[state.weaponIndex];resetWeaponVisualAnimation(previousGun);previousGun.model.visible = false;
  state.weaponIndex = index;
  loadout[index].model.visible = true;
  resetWeaponVisualAnimation(loadout[index]);beginWeaponVisualAnimation(loadout[index],'equip');
  refreshActiveWeaponCharm();
  weapon.rotation.set(-.035, -.04, .32); weapon.position.y = -.62;
  const swapMultiplier = (hasPassive('lightweight') ? .6 : 1) * (performance.now() < state.velocityBoostUntil ? .75 : 1);
  state.swapUntil = performance.now() + 320 * swapMultiplier;
  updateQuickSlotUI();
  ui.status.textContent = `${loadout[index].name} // DRAWING`;
  updateAmmo();
}

function setTextIfChanged(element,value){const text=String(value);if(element&&element.textContent!==text)element.textContent=text;}
function setStyleIfChanged(element,property,value){if(element&&element.style[property]!==value)element.style[property]=value;}
function updateAmmo() {
  const gun = loadout[state.weaponIndex];
  setTextIfChanged(ui.ammo,String(gun.ammo).padStart(2,'0'));setTextIfChanged(ui.reserve,String(gun.reserve).padStart(2,'0'));
  setTextIfChanged(ui.weaponName,gun.name);setTextIfChanged(ui.caliber,gun.caliber);setTextIfChanged(ui.weaponTrait,gun.trait||gun.weaponClass);
  updateHotbarIndicators();updateMasteryHud();
}

function updateVitals() {
  const health = Math.max(0, Math.round(state.health)); const shield = Math.max(0, Math.round(state.shield));
  setTextIfChanged(ui.health,health);setStyleIfChanged(ui.healthBar,'width',`${health}%`);
  setTextIfChanged(ui.shield,shield);setStyleIfChanged(ui.shieldBar,'width',`${shield*2}%`);
}

function saveProgress() {
  try {
    localStorage.setItem('resonance-engine-progress', JSON.stringify({
      cash:progress.cash, unlocked:[...progress.unlocked], equipped:quickSlots.map(index=>loadout[index].id), cosmetics:[...progress.cosmetics],
      equippedCosmetics:progress.equippedCosmetics, abilities:progress.abilities, passives:progress.passives, settings:progress.settings,
      stats:progress.stats, favoriteWeapon:progress.favoriteWeapon, challengeState:progress.challengeState, unopenedCrates:progress.unopenedCrates,
      weaponMastery:progress.weaponMastery, blueprintFragments:progress.blueprintFragments, discoveredWeapons:[...progress.discoveredWeapons], executions:progress.executions, factory:progress.factory, discoveries:progress.discoveries,
      cosmeticState:progress.cosmeticState,
    }));
  } catch { /* Progress still works for this session. */ }
}
let deferredProgressSave=0;
function scheduleProgressSave(){if(deferredProgressSave)return;deferredProgressSave=setTimeout(()=>{deferredProgressSave=0;saveProgress();},260);}

function lobbyNotify(message,type='info') {
  if (!ui.notifications) return;
  const notification=document.createElement('div'); notification.className=`lobby-notice ${type}`;
  notification.textContent=message; ui.notifications.append(notification);
  setTimeout(()=>{ notification.classList.add('out'); setTimeout(()=>notification.remove(),260); },3200);
}

function pulseReactor(stateName,duration=720) {
  if (!ui.reactor) return;
  ui.reactor.classList.remove('error','reward','success'); void ui.reactor.offsetWidth; ui.reactor.classList.add(stateName);
  clearTimeout(pulseReactor.timer); pulseReactor.timer=setTimeout(()=>ui.reactor?.classList.remove(stateName),duration);
}

function animateNumber(element,toValue) {
  if (!element) return;
  const fromValue=Number(element.dataset.value??toValue); const target=Math.floor(toValue); element.dataset.value=String(target);
  if (progress.settings.reduceMotion || fromValue===target) { element.textContent=String(target).padStart(4,'0'); return; }
  const started=performance.now();
  const frame=now=>{ const t=Math.min(1,(now-started)/430); const eased=1-Math.pow(1-t,3); element.textContent=String(Math.round(THREE.MathUtils.lerp(fromValue,target,eased))).padStart(4,'0'); if(t<1) requestAnimationFrame(frame); };
  requestAnimationFrame(frame);
}

function recordChallenge(id,amount=1) {
  const challenge=localChallenges.find(item=>item.id===id); const activeIds=challengeIdsForDate(progress.challengeState.date);
  if (!challenge || !activeIds.includes(id) || progress.challengeState.completed.includes(id)) return;
  progress.challengeState.progress[id]=Math.min(challenge.target,(Number(progress.challengeState.progress[id])||0)+amount);
  if (progress.challengeState.progress[id]>=challenge.target) {
    progress.challengeState.completed.push(id); progress.cash+=challenge.reward; progress.stats.totalCreditsEarned+=challenge.reward; progress.stats.xp+=challenge.reward;
    progress.stats.contractsCompleted++; lobbyNotify(`CONTRACT COMPLETE // +◆${challenge.reward}`,'success'); pulseReactor('success',1050);
    const activeIds=challengeIdsForDate(progress.challengeState.date);if(activeIds.every(challengeId=>progress.challengeState.completed.includes(challengeId))&&progress.cosmeticState.dailyRewardDate!==progress.challengeState.date){progress.cosmeticState.dailyRewardDate=progress.challengeState.date;const daily=COSMETICS.find(item=>item.rarity==='common'&&!progress.cosmeticState.owned.includes(item.id))||COSMETICS.find(item=>item.rarity==='common');cosmeticRewardService.grant(daily.id,'daily-challenges');lobbyNotify(`DAILY COSMETIC // ${daily.name}`,'rare');}
  }
  saveProgress(); updateCashUI(); renderChallenges(); renderProfile();
}

function renderChallenges() {
  if (!ui.challengeList) return;
  if (progress.challengeState.date!==localDateKey()) progress.challengeState=normalizedChallengeState();
  ui.challengeList.replaceChildren();
  challengeIdsForDate(progress.challengeState.date).forEach(id=>{
    const challenge=localChallenges.find(item=>item.id===id); const value=Math.min(challenge.target,Number(progress.challengeState.progress[id])||0); const complete=progress.challengeState.completed.includes(id);
    const card=document.createElement('article'); card.className=`challenge-card ${complete?'complete':''}`;
    card.innerHTML=`<i>${challenge.icon}</i><div><small>${complete?'CONTRACT COMPLETE':'LOCAL DAILY CONTRACT'}</small><h3>${challenge.description}</h3><span><b style="width:${value/challenge.target*100}%"></b></span><em>${value} / ${challenge.target}</em></div><strong>+◆${challenge.reward}</strong>`;
    ui.challengeList.append(card);
  });
  const tomorrow=new Date(); tomorrow.setHours(24,0,0,0); const remaining=Math.max(0,tomorrow-Date.now());
  if (ui.challengeReset) ui.challengeReset.textContent=`RESET // ${Math.floor(remaining/3600000)}H ${Math.floor(remaining/60000)%60}M`;
}

function favoriteWeaponFromStats() {
  const entries=Object.entries(progress.stats.weaponUses||{}).sort((a,b)=>b[1]-a[1]);
  return loadout.find(gun=>gun.id===(entries[0]?.[0]||progress.favoriteWeapon))||loadout[quickSlots[0]];
}

function renderProfile() {
  const level=Math.floor(progress.stats.xp/1000)+1; const levelProgress=progress.stats.xp%1000; const callsign=String(progress.settings.callsign||defaultSettings.callsign).trim().slice(0,18)||defaultSettings.callsign;
  ui.profileCallsign.textContent=callsign.toUpperCase(); ui.profilePanelCallsign.textContent=callsign.toUpperCase(); ui.profileLevel.textContent=String(level).padStart(2,'0'); ui.profileXpBar.style.width=`${levelProgress/10}%`;
  const abilityEntry=Object.entries(progress.stats.abilityUses||{}).sort((a,b)=>b[1]-a[1])[0]; const favorite=favoriteWeaponFromStats();
  ui.profileStats.innerHTML=`<span>EXPERIENCE<b>${progress.stats.xp.toLocaleString()} XP</b></span><span>TOTAL CREDITS EARNED<b>◆${Math.floor(progress.stats.totalCreditsEarned).toLocaleString()}</b></span><span>ELIMINATIONS<b>${progress.stats.eliminations}</b></span><span>HEADSHOTS<b>${progress.stats.headshots}</b></span><span>LONGEST CONFIRMED SHOT<b>${Math.round(progress.stats.longestShot)}M</b></span><span>BEST MOVEMENT COMBO<b>${progress.stats.bestMovementCombo}</b></span><span>EXECUTIONS<b>${progress.stats.executions}</b></span><span>BLUEPRINT FRAGMENTS<b>${progress.blueprintFragments}</b></span><span>FAVORITE WEAPON<b>${favorite.name}</b></span><span>CONTRACTS COMPLETED<b>${progress.stats.contractsCompleted}</b></span><span>MOST-USED ABILITY<b>${abilityEntry?abilityCatalog[abilityEntry[0]]?.name||'—':'—'}</b></span>`;
  renderTrophyWall();
}

function renderTrophyWall() {
  if(!ui.trophyWall)return;
  const rareCount=cosmeticCatalog.filter(item=>progress.cosmetics.has(item.id)&&['rare','legendary','exotic'].includes(item.rarity)).length;
  const trophies=[
    {icon:'⌖',name:'LONG SIGHT',value:progress.stats.longestShot?`${Math.round(progress.stats.longestShot)}M`:'LOCKED',unlocked:progress.stats.longestShot>0},
    {icon:'◉',name:'HEADHUNTER',value:progress.stats.bestMatchHeadshots?`${progress.stats.bestMatchHeadshots} IN ONE MATCH`:'LOCKED',unlocked:progress.stats.bestMatchHeadshots>0},
    {icon:'⏱',name:'RANGE ZERO',value:progress.stats.fastestTargetClear?`${(progress.stats.fastestTargetClear/1000).toFixed(1)}S CLEAR`:'LOCKED',unlocked:progress.stats.fastestTargetClear>0},
    {icon:'✦',name:'HOSTILE BREAKER',value:progress.stats.hostileEliminations?`${progress.stats.hostileEliminations} DEFEATED`:'LOCKED',unlocked:progress.stats.hostileEliminations>0},
    {icon:'◇',name:'VAULT CURATOR',value:rareCount?`${rareCount} RARE+ ITEMS`:'LOCKED',unlocked:rareCount>0},
    {icon:'◆',name:'EXOTIC SIGNAL',value:progress.stats.exoticRewards?`${progress.stats.exoticRewards} DISCOVERED`:'LOCKED',unlocked:progress.stats.exoticRewards>0},
  ];
  ui.trophyWall.innerHTML=trophies.map(trophy=>`<article class="${trophy.unlocked?'unlocked':'locked'}"><i>${trophy.icon}</i><span><small>${trophy.unlocked?'ACHIEVEMENT RECORDED':'UNKNOWN TROPHY'}</small><b>${trophy.name}</b><em>${trophy.value}</em></span></article>`).join('');
}

function applySettings() {
  const settings=progress.settings;
  if(!enemyDifficultyProfiles[settings.enemyDifficulty])settings.enemyDifficulty='normal';
  if(!QUALITY_PRESETS[settings.graphicsQuality])settings.graphicsQuality='high';
  if(!['low','medium','high'].includes(settings.cosmeticQuality))settings.cosmeticQuality='high';
  if(!['full','reduced','off'].includes(settings.otherPlayerKillFx))settings.otherPlayerKillFx='reduced';
  document.body.classList.toggle('reduce-motion',Boolean(settings.reduceMotion));
  document.body.classList.toggle('reduce-ui-motion',Boolean(settings.reducedUiMotion));
  document.body.classList.toggle('damage-numbers-off',!settings.showDamageNumbers);
  document.documentElement.style.setProperty('--crosshair-color',settings.crosshairColor);
  document.documentElement.style.setProperty('--crosshair-size',String(settings.crosshairSize));
  const preset=QUALITY_PRESETS[settings.graphicsQuality];renderer.shadowMap.enabled=settings.shadowQuality!=='off'&&preset.shadowMap>0;
  world.traverse(object=>{if(!object.isMesh||object.userData.shadowRequested===undefined)return;object.geometry.computeBoundingSphere();const large=(object.geometry.boundingSphere?.radius||0)>4;const full=['high','ultra'].includes(settings.graphicsQuality)&&['high','ultra'].includes(settings.shadowQuality);object.castShadow=renderer.shadowMap.enabled&&(full||large);object.receiveShadow=renderer.shadowMap.enabled&&(full||large);});
  const shadowSize=settings.shadowQuality==='ultra'?2048:settings.shadowQuality==='high'?preset.shadowMap:Math.min(512,preset.shadowMap);if(shadowSize)sun.shadow.mapSize.set(shadowSize,shadowSize);renderer.shadowMap.needsUpdate=true;
  sun.intensity=settings.graphicsQuality==='low'?3.35:3.85;hemi.intensity=settings.graphicsQuality==='low'?1.88:2.05;bloomPass.enabled=Boolean(settings.bloom&&preset.bloom);bloomPass.strength=settings.graphicsQuality==='medium'?.12:.18;
  scenicClouds.forEach(cloud=>{cloud.visible=settings.graphicsQuality!=='low';});
  const weaponDetailLimit=settings.graphicsQuality==='low'?0:settings.graphicsQuality==='medium'?1:2;const applyWeaponDetailQuality=object=>{if(object.userData?.weaponDetailLevel!==undefined)object.visible=object.userData.weaponDetailLevel<=weaponDetailLimit;};
  for(const gun of loadout)gun.model.traverse(applyWeaponDetailQuality);world.traverse(applyWeaponDetailQuality);
  const qualityCap=configuredPixelRatioMaximum(); if(renderPixelRatio>qualityCap||['high','ultra'].includes(settings.graphicsQuality)){renderPixelRatio=qualityCap;renderer.setPixelRatio(renderPixelRatio);renderer.setSize(innerWidth,innerHeight);composer.setPixelRatio(renderPixelRatio);composer.setSize(innerWidth,innerHeight);}
  ui.settingsInputs.forEach(input=>{ const value=settings[input.dataset.setting]; if(input.type==='checkbox') input.checked=Boolean(value); else input.value=String(value); });
  ui.audioToggle.classList.toggle('active',Boolean(settings.musicEnabled)); ui.audioToggle.setAttribute('aria-pressed',String(Boolean(settings.musicEnabled)));
  ui.fpsDisplay?.classList.toggle('visible',Boolean(settings.showFps));
  if(!settings.scopeDebug){ui.scopeDebug?.classList.remove('active');ui.scopeDebug?.setAttribute('aria-hidden','true');}
  parkourDebugGroup.visible=Boolean(settings.parkourDebug||settings.parkourAssist);aiDebugGroup.visible=Boolean(settings.aiDebug);
  renderProfile();
}

function configuredPixelRatioMaximum() {
  return Math.min(maximumPixelRatio,QUALITY_PRESETS[progress.settings.graphicsQuality]?.pixelRatio||QUALITY_PRESETS.high.pixelRatio);
}

async function toggleFullscreen() {
  try { if(document.fullscreenElement) await document.exitFullscreen(); else await document.documentElement.requestFullscreen(); }
  catch { lobbyNotify('FULLSCREEN IS NOT AVAILABLE IN THIS BROWSER','warning'); pulseReactor('error'); }
}

function cosmeticForSlot(slot) {
  const id = progress.equippedCosmetics[slot];
  return cosmeticCatalog.find(item => item.id === id && progress.cosmetics.has(id)) || null;
}

function skinForWeapon(weaponId) {
  const id=progress.cosmeticState.equippedSkins[weaponId];const skin=cosmeticById(id);
  return skin?.type==='skin'&&progress.cosmeticState.owned.includes(id)&&skin.compatibleWeapons.includes(weaponId)?skin:null;
}

function equippedTracer(){const item=cosmeticById(progress.cosmeticState.equippedTracer);return item?.type==='tracer'&&progress.cosmeticState.owned.includes(item.id)?item:null;}
function equippedKillFx(){const item=cosmeticById(progress.cosmeticState.equippedKillFx);return item?.type==='killFx'&&progress.cosmeticState.owned.includes(item.id)?item:null;}

function clearWeaponCharm(gun){const previous=gun?.model.getObjectByName('cosmetic-charm');if(previous){previous.removeFromParent();previous.traverse(child=>{child.geometry?.dispose?.();child.material?.dispose?.();});}}
function clearWeaponSkinAttachment(gun){const previous=gun?.model.getObjectByName('cosmetic-skin-detail');if(previous){previous.removeFromParent();previous.traverse(child=>{child.geometry?.dispose?.();child.material?.dispose?.();});}}
function rebuildWeaponSkinAttachment(gun,skin){
  clearWeaponSkinAttachment(gun);if(!skin?.design||progress.settings.cosmeticQuality==='low')return;const group=new THREE.Group();group.name='cosmetic-skin-detail';group.userData.cosmeticAttachment=true;group.userData.scopeUnsafe=true;group.userData.detail=skin.design.detail;const emissive=new THREE.MeshStandardMaterial({color:skin.design.edgeColor,emissive:skin.emissiveColor,emissiveIntensity:.58,metalness:.42,roughness:.3});const secondary=new THREE.MeshStandardMaterial({color:skin.design.secondaryColor,roughness:skin.roughness,metalness:skin.metalness});
  const add=(geometry,material,position,rotation=[0,0,0])=>{const mesh=new THREE.Mesh(geometry,material);mesh.position.set(...position);mesh.rotation.set(...rotation);mesh.userData.cosmeticAttachment=true;group.add(mesh);return mesh;};const muzzle=gun.model.getObjectByName(gun.model.userData.attachmentPoints?.muzzle||'muzzle-anchor')?.position||new THREE.Vector3(0,.04,-1.1);
  if(skin.design.attachment==='muzzle-ring'){add(new THREE.TorusGeometry(.105,.018,7,18),emissive,[muzzle.x,muzzle.y,muzzle.z+.04],[0,0,0]);for(let index=0;index<5;index++)add(new THREE.BoxGeometry(.025,.035,.025),emissive,[.18,index*.04-.03,.12-index*.06]);}
  else if(skin.design.attachment==='flowers'){for(let index=0;index<4;index++){const bloom=add(new THREE.ConeGeometry(.045,.11,6),index%2?emissive:secondary,[.14,(index%2)*.08,-.12-index*.18],[0,0,index*.7]);bloom.userData.bloom=true;}}
  else if(skin.design.attachment==='heat-vents'){for(let index=0;index<3;index++){const vent=add(new THREE.BoxGeometry(.035,.11,.18),emissive,[.16,.03,-.18-index*.2]);vent.userData.vent=true;}add(new THREE.TorusGeometry(.085,.015,7,18),secondary,[-.15,.09,.05],[0,Math.PI/2,0]);}
  else if(skin.design.attachment==='equalizer'){for(let index=0;index<5;index++){const bar=add(new THREE.BoxGeometry(.024,.04+index%3*.035,.055),index%2?emissive:secondary,[.15,-.02+index%3*.018,.08-index*.08]);bar.userData.equalizer=index;}}
  else if(skin.design.attachment==='orbit'){const planet=add(new THREE.SphereGeometry(.055,9,7),emissive,[.16,.12,.02]);const orbit=add(new THREE.TorusGeometry(.1,.009,6,18),secondary,[.16,.12,.02],[1.1,0,.4]);orbit.userData.orbit=true;planet.userData.star=true;}
  else if(skin.design.attachment==='pizza-oven'){add(new THREE.TorusGeometry(.11,.025,7,18),emissive,[muzzle.x,muzzle.y,muzzle.z+.03]);for(let index=0;index<3;index++)add(new THREE.CylinderGeometry(.026,.026,.012,8),secondary,[.14,(index-1)*.075,.04-index*.12],[Math.PI/2,0,0]);}
  else if(skin.design.attachment==='fish'){const eye=add(new THREE.SphereGeometry(.045,8,6),secondary,[.115,.1,muzzle.z+.2]);eye.userData.eye=true;const fin=add(new THREE.ConeGeometry(.065,.18,4),emissive,[.14,-.04,.05],[0,0,-1.3]);fin.userData.fin=true;const tail=add(new THREE.ConeGeometry(.11,.24,3),emissive,[0,.01,.62],[Math.PI/2,0,0]);tail.userData.tail=true;}
  gun.model.add(group);
}
function rebuildWeaponCharm(gun) {
  clearWeaponCharm(gun);
  const charm=cosmeticById(progress.cosmeticState.equippedCharm);if(!charm||charm.type!=='charm'||!progress.cosmeticState.owned.includes(charm.id))return;
  const group=new THREE.Group();group.name='cosmetic-charm';group.userData.cosmeticAttachment=true;group.userData.scopeUnsafe=true;group.position.set(0,0,0);group.scale.setScalar(.72);
  const material=new THREE.MeshStandardMaterial({color:charm.color||'#50e5ff',metalness:.45,roughness:.38,emissive:charm.color||'#50e5ff',emissiveIntensity:.16});
  const token=new THREE.Mesh(charm.shape==='gear'?new THREE.TorusGeometry(.065,.022,6,10):charm.shape==='hook'?new THREE.TorusGeometry(.055,.014,6,10,Math.PI*1.55):new THREE.IcosahedronGeometry(.065,0),material);token.castShadow=false;token.userData.cosmeticAttachment=true;group.add(token);
  const cord=new THREE.Mesh(new THREE.CylinderGeometry(.006,.006,.12,5),new THREE.MeshStandardMaterial({color:0x202631,roughness:.9}));cord.position.y=.1;cord.userData.cosmeticAttachment=true;group.add(cord);const anchor=gun.model.getObjectByName(gun.model.userData.attachmentPoints?.charm||'charm-anchor');(anchor||gun.model).add(group);
}

function applyCosmeticToGun(gun,legacyCosmetic=null) {
  if(!gun)return;const skin=skinForWeapon(gun.id);clearWeaponSkinAttachment(gun);
  gun.model.traverse(child => {
    if (!child.isMesh || child.userData.cosmeticAttachment || !child.material?.clone) return;
    if (!child.userData.cosmeticBaseMaterial) child.userData.cosmeticBaseMaterial = child.material.clone();
    else if (child.material !== child.userData.cosmeticBaseMaterial) child.material.dispose?.();
    const material = child.userData.cosmeticBaseMaterial.clone();
    if(child.userData.scopeLens){
      if(skin?.design?.scopeColor&&material.color)material.color.set(skin.design.scopeColor);
      material.transparent=true;material.opacity=Math.min(.16,child.userData.cosmeticBaseMaterial.opacity||.12);material.depthWrite=false;
      if('metalness'in material)material.metalness=0;if('roughness'in material)material.roughness=.06;if('transmission'in material)material.transmission=Math.max(.9,child.userData.cosmeticBaseMaterial.transmission||0);
      child.material=material;return;
    }
    if(skin){
      const accent=(Math.abs(Math.round((child.position.x+child.position.y+child.position.z)*100))%3)===0;const inferred=child.position.z<-.68?'barrel':child.position.y>.13?'scopeHousing':child.position.y<-.17?'magazine':Math.abs(child.position.x)>.16?'accent':'receiver';const component=child.userData.materialZone||inferred;const componentColors={receiver:accent?skin.design?.secondaryColor:skin.baseColor,stock:skin.design?.stockColor||skin.design?.secondaryColor,magazine:skin.design?.magazineColor||skin.design?.secondaryColor,accent:skin.accentColor,energy:skin.emissiveColor,scopeHousing:skin.design?.scopeColor||skin.design?.secondaryColor,barrel:skin.design?.muzzleColor||skin.design?.edgeColor,metal:skin.design?.edgeColor,grip:skin.design?.gripColor};const componentColor=componentColors[component]||skin.design?.edgeColor;
      if(material.color)material.color.set(componentColor||(accent?skin.accentColor:skin.baseColor));
      if(material.emissive){material.emissive.set(skin.emissiveColor);material.emissiveIntensity=['accent','energy'].includes(component)?(skin.animated?.strength||.28):.045;}
      if('roughness'in material&&component!=='grip')material.roughness=skin.roughness;if('metalness'in material&&!['grip'].includes(component))material.metalness=skin.metalness;
    }else if (legacyCosmetic && material.color) {
      material.color.lerp(new THREE.Color(legacyCosmetic.color), .72);
      if (legacyCosmetic.emissive && material.emissive) { material.emissive.setHex(legacyCosmetic.emissive); material.emissiveIntensity = Math.max(.55, material.emissiveIntensity || 0); }
    }
    child.material = material;
  });
  rebuildWeaponSkinAttachment(gun,skin);
}

function applyCosmeticToSlot(slot) {
  const gun = loadout[quickSlots[slot]]; if (!gun) return;
  applyCosmeticToGun(gun,cosmeticForSlot(slot));
}

function applyEquippedCosmetics() {
  loadout.forEach(gun=>applyCosmeticToGun(gun));for(let slot=0;slot<quickSlots.length;slot++)applyCosmeticToSlot(slot);refreshActiveWeaponCharm();
}
function refreshActiveWeaponCharm(){loadout.forEach(clearWeaponCharm);rebuildWeaponCharm(loadout[state.weaponIndex]);}
function updateAnimatedWeaponSkin(now){const gun=loadout[state.weaponIndex];const charm=gun?.model.getObjectByName('cosmetic-charm');const quality=qualityVisualFallback(progress.settings.graphicsQuality);const reduced=progress.settings.reducedCosmeticMotion||progress.settings.cosmeticQuality==='low'||!quality.skinAnimation;if(charm&&!reduced){charm.rotation.z=Math.sin(now*.004)*.12;charm.rotation.x=Math.cos(now*.003)*.06;}const skin=skinForWeapon(gun?.id);if(!skin?.animated||reduced)return;const pulse=(Math.sin(now*.001*skin.animated.speed*Math.PI*2)+1)*.5;gun.model.traverse(child=>{if(!child.isMesh)return;if(child.userData.equalizer!==undefined)child.scale.y=.7+pulse*(.45+child.userData.equalizer*.08);if(child.userData.orbit)child.rotation.z+=.008;if(child.userData.tail||child.userData.fin)child.rotation.z=Math.sin(now*.005)*.16+(child.userData.tail?0:-1.3);if(child.userData.bloom)child.scale.setScalar(.8+pulse*.35);if(child.userData.vent)child.position.x=.16+pulse*.018;if(child.userData.cosmeticAttachment||!child.material?.emissive)return;const accent=(Math.abs(Math.round((child.position.x+child.position.y+child.position.z)*100))%3)===0;if(accent)child.material.emissiveIntensity=.12+pulse*skin.animated.strength;});}

function equipCosmetic(cosmetic) {
  if (!cosmetic || !progress.cosmetics.has(cosmetic.id)) return;
  progress.equippedCosmetics[cosmetic.slot] = cosmetic.id; applyCosmeticToSlot(cosmetic.slot); saveProgress();
  announceCrate(`${cosmetic.name} // EQUIPPED TO ${['PRIMARY','SECONDARY','MELEE','OTHER'][cosmetic.slot]}`);
  lobbyNotify(`COSMETIC EQUIPPED // ${cosmetic.name}`,cosmetic.rarity==='common'?'success':cosmetic.rarity); uiSound('equip'); renderLobbyInventory(); renderLobbySummary();
}

function equipCatalogItem(cosmetic,weaponId=loadout[quickSlots[selectedLobbySlot]]?.id) {
  if(!cosmetic)return false;const result=equipCatalogCosmetic(progress.cosmeticState,cosmetic.id,weaponId);if(!result.ok){lobbyNotify('COSMETIC IS LOCKED OR INCOMPATIBLE','warning');return false;}
  progress.cosmeticState=result.state;if(cosmetic.type==='skin'){const gun=loadout.find(item=>item.id===weaponId);applyCosmeticToGun(gun);}else if(cosmetic.type==='charm')refreshActiveWeaponCharm();
  saveProgress();lobbyNotify(`EQUIPPED // ${cosmetic.name}`,cosmetic.rarity);uiSound('equip');renderCosmeticInventory();renderLobbySummary();return true;
}

function updateCashUI() {
  const value = Math.floor(progress.cash).toString().padStart(4, '0');
  ui.cash.textContent = value; ui.armoryCash.textContent = value; animateNumber(ui.lobbyCash,progress.cash);
  ui.caseButtons.forEach(button => {const definition=CASES[button.dataset.buyCase];const hasKey=Boolean(definition?.key&&(progress.cosmeticState[definition.key]||0)>0);button.disabled=crateOpening||(!hasKey&&(definition?.cost===0||progress.cash<Number(button.dataset.cost)));});
  if (ui.featured?.buy) renderFeaturedWeapon();
}

const slotNames=['PRIMARY','SECONDARY','MELEE','OTHER'];
const slotIcons=['⌖','⌐','†','◇'];
let lobbyPreview=null;
let lobbyPreviewWeaponIndex=quickSlots[0];

function initLobbyPreview() {
  if (!ui.heroCanvas || lobbyPreview) return;
  const previewRenderer=new THREE.WebGLRenderer({canvas:ui.heroCanvas,alpha:true,antialias:true,powerPreference:'high-performance'});
  previewRenderer.setClearColor(0x000000,0); previewRenderer.outputColorSpace=THREE.SRGBColorSpace; previewRenderer.toneMapping=THREE.ACESFilmicToneMapping; previewRenderer.toneMappingExposure=1.35;
  const previewScene=new THREE.Scene(); const previewCamera=new THREE.PerspectiveCamera(34,2,0.01,60); previewCamera.position.set(0,.35,5); previewCamera.lookAt(0,0,0);
  const hemiPreview=new THREE.HemisphereLight(0xc9f7ff,0x26113e,2.8);previewScene.add(hemiPreview);
  const key=new THREE.DirectionalLight(0x65eaff,5); key.position.set(3,4,5); previewScene.add(key);
  const rim=new THREE.PointLight(0xff4fba,25,12); rim.position.set(-3,1,-2); previewScene.add(rim);
  const group=new THREE.Group(); previewScene.add(group);
  const platformMaterial=new THREE.MeshBasicMaterial({color:0x50e5ff,transparent:true,opacity:.7});
  const platform=new THREE.Mesh(new THREE.TorusGeometry(1.6,.018,8,64),platformMaterial); platform.rotation.x=Math.PI/2; platform.position.y=-1.05; previewScene.add(platform);
  const positions=new Float32Array(72*3); for(let i=0;i<72;i++){const radius=1.3+Math.random()*1.5;positions[i*3]=Math.cos(i*.79)*radius;positions[i*3+1]=-1+Math.random()*2.4;positions[i*3+2]=(Math.random()-.5)*2.4;}
  const particlesGeometry=new THREE.BufferGeometry(); particlesGeometry.setAttribute('position',new THREE.BufferAttribute(positions,3));
  const particlesMaterial=new THREE.PointsMaterial({color:0x50e5ff,size:.028,transparent:true,opacity:.72,depthWrite:false}); const particles=new THREE.Points(particlesGeometry,particlesMaterial); previewScene.add(particles);
  lobbyPreview={renderer:previewRenderer,scene:previewScene,camera:previewCamera,group,platform,particles,key,rim,hemi:hemiPreview,yaw:-.55,pitch:-.08,zoom:5,dragging:false,lastX:0,lastY:0,weapon:null,previewSkin:null,mechanicalParts:[],aiming:false,action:null,actionStartedAt:0,actionUntil:0};
  const canvas=ui.heroCanvas;
  canvas.addEventListener('pointerdown',event=>{lobbyPreview.dragging=true;lobbyPreview.lastX=event.clientX;lobbyPreview.lastY=event.clientY;try{canvas.setPointerCapture(event.pointerId);}catch{/* Synthetic and interrupted pointers can lack capture state. */}});
  canvas.addEventListener('pointermove',event=>{if(!lobbyPreview.dragging)return;lobbyPreview.yaw+=(event.clientX-lobbyPreview.lastX)*.009;lobbyPreview.pitch=THREE.MathUtils.clamp(lobbyPreview.pitch+(event.clientY-lobbyPreview.lastY)*.006,-.55,.55);lobbyPreview.lastX=event.clientX;lobbyPreview.lastY=event.clientY;});
  canvas.addEventListener('pointerup',event=>{lobbyPreview.dragging=false;try{if(canvas.hasPointerCapture(event.pointerId))canvas.releasePointerCapture(event.pointerId);}catch{/* Pointer was already released. */}});
  canvas.addEventListener('pointercancel',()=>{lobbyPreview.dragging=false;});
  canvas.addEventListener('wheel',event=>{event.preventDefault();lobbyPreview.zoom=THREE.MathUtils.clamp(lobbyPreview.zoom+event.deltaY*.003,3.6,7);},{passive:false});
  setLobbyPreviewWeapon(quickSlots[0]);
}

function setLobbyPreviewWeapon(index,previewSkin=null) {
  if (!loadout[index]) return;
  lobbyPreviewWeaponIndex=index;
  const gun=loadout[index]; const cosmeticSlot=quickSlots.indexOf(index); const cosmetic=previewSkin||skinForWeapon(gun.id)||(cosmeticSlot>=0?cosmeticForSlot(cosmeticSlot):null);
  if (lobbyPreview) {
    lobbyPreview.aiming=false;
    const aimButton=document.querySelector('#preview-scope');if(aimButton){aimButton.classList.remove('active');aimButton.textContent='AIM PREVIEW';}
    lobbyPreview.group.traverse(child=>{if(child.isMesh&&child.material?.dispose)child.material.dispose();});
    lobbyPreview.group.clear();
    const clone=gun.model.clone(true); clone.traverse(child=>{if(child.isMesh&&child.material?.clone){child.material=child.material.clone();if(child.userData.scopeLens){child.material.transparent=true;child.material.opacity=Math.min(.16,child.material.opacity||.12);child.material.depthWrite=false;if('metalness'in child.material)child.material.metalness=0;if('transmission'in child.material)child.material.transmission=Math.max(.9,child.material.transmission||0);}else if(previewSkin&&child.material.color){const accent=(Math.abs(Math.round((child.position.x+child.position.y+child.position.z)*100))%3)===0;const zone=child.userData.materialZone||'receiver';const color=zone==='energy'?previewSkin.emissiveColor:zone==='accent'?previewSkin.accentColor:zone==='receiver'?(accent?previewSkin.accentColor:previewSkin.baseColor):previewSkin.design?.[`${zone}Color`]||previewSkin.design?.edgeColor||previewSkin.baseColor;child.material.color.set(color);if(child.material.emissive){child.material.emissive.set(previewSkin.emissiveColor);child.material.emissiveIntensity=['energy','accent'].includes(zone)?.45:.06;}if('roughness'in child.material)child.material.roughness=previewSkin.roughness;if('metalness'in child.material)child.material.metalness=previewSkin.metalness;}}if(child.isLight)child.intensity=Math.min(child.intensity,.4);});
    clone.updateMatrixWorld(true); const box=new THREE.Box3().setFromObject(clone); const center=box.getCenter(new THREE.Vector3()); const size=box.getSize(new THREE.Vector3()); clone.position.sub(center); clone.scale.setScalar(3.15/Math.max(size.x,size.y,size.z,1));
    const mechanicalParts=[];clone.traverse(child=>{if(!child.name?.startsWith('mechanical-'))return;mechanicalParts.push({part:child,basePosition:child.position.clone(),baseRotation:child.rotation.clone()});});
    lobbyPreview.group.add(clone); lobbyPreview.weapon=clone;lobbyPreview.previewSkin=previewSkin;lobbyPreview.mechanicalParts=mechanicalParts; const previewColor=cosmetic?.emissiveColor||cosmetic?.trail||cosmetic?.emissive||cosmetic?.color||gun.color||0x50e5ff;
    lobbyPreview.platform.material.color.set(previewColor); lobbyPreview.particles.material.color.set(previewColor);
  }
  const equipped=quickSlots[0]===index;
  ui.heroFamily.textContent=`${equipped?'EQUIPPED PRIMARY':'ARMORY PREVIEW'} // ${gun.category}`; ui.heroWeaponName.textContent=gun.name;
  ui.heroCosmetic.textContent=cosmetic?`${cosmetic.name} // ${cosmetic.animated?'ANIMATED FINISH':cosmetic.trail?'TRAIL ONLINE':'STATIC FINISH'}`:'FACTORY FINISH // NO TRAIL';
  const visual=gun.model.userData.visualDefinition;ui.heroScope.textContent=`${String(visual.opticStyle||'IRON').toUpperCase().replaceAll('-',' ')} // ${String(visual.animationProfile?.mechanicalAction||'FIXED').toUpperCase().replaceAll('-',' ')}`;
  ui.heroBarrel.textContent=`${String(visual.barrelStyle||gun.caliber||'TUNED').toUpperCase().replaceAll('-',' ')}`; ui.heroMagazine.textContent=gun.ammoCost===0?'ENERGY EDGE':`${gun.magSize} ROUNDS // ${String(visual.magazineStyle||'MAG').toUpperCase().replaceAll('-',' ')}`; ui.heroTrait.textContent=`${gun.weaponClass} // ${String(visual.receiverStyle||'PROCEDURAL').toUpperCase().replaceAll('-',' ')}`;
}

function renderLobbyPreview(time,dt) {
  if (!lobbyPreview || state.started || !ui.lobbyPanels.find(panel=>panel.dataset.panel==='play')?.classList.contains('active')) return;
  const {renderer:previewRenderer,camera:previewCamera,group,particles,platform}=lobbyPreview; const rect=ui.heroCanvas.getBoundingClientRect();
  const width=Math.max(2,Math.round(rect.width)); const height=Math.max(2,Math.round(rect.height)); const previewCap=progress.settings.graphicsQuality==='low'?.8:progress.settings.graphicsQuality==='medium'?1:1.35;const ratio=Math.min(devicePixelRatio,previewCap);
  if(ui.heroCanvas.width!==Math.round(width*ratio)||ui.heroCanvas.height!==Math.round(height*ratio)){previewRenderer.setPixelRatio(ratio);previewRenderer.setSize(width,height,false);previewCamera.aspect=width/height;previewCamera.updateProjectionMatrix();}
  const now=performance.now();if(!lobbyPreview.dragging&&!lobbyPreview.aiming&&!progress.settings.reduceMotion)lobbyPreview.yaw+=dt*.16;const actionActive=now<lobbyPreview.actionUntil;const actionDuration=Math.max(1,lobbyPreview.actionUntil-lobbyPreview.actionStartedAt);const actionProgress=THREE.MathUtils.clamp((now-lobbyPreview.actionStartedAt)/actionDuration,0,1);const actionImpulse=Math.sin(Math.PI*actionProgress);if(actionActive&&lobbyPreview.action==='fire')group.position.z=Math.sin(now*.08)*.08;else group.position.z=THREE.MathUtils.damp(group.position.z,0,14,dt);const actionRoll=actionActive&&lobbyPreview.action==='reload'?actionImpulse*-.65:0;
  for(const entry of lobbyPreview.mechanicalParts||[]){const {part,basePosition,baseRotation}=entry;part.position.copy(basePosition);part.rotation.copy(baseRotation);if(!actionActive)continue;if(lobbyPreview.action==='fire'){if(/slide|bolt|pump/.test(part.name))part.position.z+=actionImpulse*.13;if(/cylinder|spin|energy-chamber|oscillator/.test(part.name))part.rotation.z+=actionProgress*Math.PI*2;if(part.name==='mechanical-trigger')part.rotation.x-=actionImpulse*.28;}else if(lobbyPreview.action==='reload'){if(/heat-vents/.test(part.name))part.rotation.x-=actionImpulse*1.05;if(/bolt|pump|charging-handle/.test(part.name))part.position.z+=actionImpulse*.14;if(/cylinder/.test(part.name))part.position.x+=actionImpulse*.18;}}
  group.rotation.set(lobbyPreview.aiming?0:lobbyPreview.pitch,lobbyPreview.aiming?0:lobbyPreview.yaw,-.08+actionRoll); previewCamera.position.z=THREE.MathUtils.damp(previewCamera.position.z,lobbyPreview.aiming?4.15:lobbyPreview.zoom,8,dt);
  particles.visible=progress.settings.graphicsQuality!=='low';particles.rotation.y=time*.08; platform.rotation.z=time*.13; previewRenderer.render(lobbyPreview.scene,previewCamera);
}

function renderLobbySummary() {
  if (!ui.liveLoadout) return;
  ui.liveLoadout.replaceChildren();
  quickSlots.forEach((weaponIndex,slot)=>{
    const gun=loadout[weaponIndex]; const cosmetic=skinForWeapon(gun.id)||cosmeticForSlot(slot); const button=document.createElement('button'); button.type='button'; button.className=`live-slot slot-${slot} ${cosmetic?.rarity||'common'}`;
    button.innerHTML=`<kbd>${slot+1}</kbd><i>${slotIcons[slot]}</i><span><small>${slotNames[slot]}</small><b>${gun.name}</b><em>${cosmetic?.name||'FACTORY FINISH'}</em></span><strong>${slot===3?(gun.effect==='melee'?'NO AMMO':gun.caliber):gun.magSize+' / '+gun.caliber}</strong>`;
    button.title=`Open ${slotNames[slot].toLowerCase()} inventory`; button.addEventListener('click',()=>{selectedLobbySlot=slot;showLobbyTab('inventory');}); ui.liveLoadout.append(button);
  });
  ui.abilitySummary.innerHTML=['q','e'].map(slot=>{const ability=abilityCatalog[progress.abilities[slot]];return `<span class="ability-${slot}" title="${ability.name}: ${(ability.cooldown/1000).toFixed(0)} second cooldown"><kbd>${slot.toUpperCase()}</kbd><b>${ability.name}</b><em>${(ability.cooldown/1000).toFixed(0)}S</em></span>`;}).join('');
  ui.passiveSummary.innerHTML=progress.passives.map(id=>`<i title="${passiveCatalog[id].name}">${passiveCatalog[id].icon}<small>${passiveCatalog[id].name}</small></i>`).join('');
  ui.unopenedCrates.textContent=`${progress.unopenedCrates} READY`; ui.loadoutReady.textContent=`${quickSlots.filter(index=>index>=0).length}/4 LOADOUT ONLINE`;
  setLobbyPreviewWeapon(quickSlots[0]);
}

function featuredRange(gun) { return gun.scoped?'LONG':gun.weaponClass.includes('SHOTGUN')||gun.effect==='melee'?'CLOSE':gun.range&&gun.range<30?'CLOSE':'MID'; }
function renderFeaturedWeapon() {
  if (!ui.featured?.name) return;
  const gun=loadout[featuredWeaponIndex]; const owned=progress.unlocked.has(gun.id); const price=directPrice(gun); const familyColors={NORMAL:'#6bbcff',WEIRD:'#50e5ff',CRAZY:'#ff5a35',CUSTOM:'#b58aff',SILLY:'#ff67c9',GEAR:'#67e8a5'};
  ui.featured.panel.style.setProperty('--family',familyColors[gun.category]||'#50e5ff'); ui.featured.className.textContent=`${gun.category} // ${gun.weaponClass}`; ui.featured.name.textContent=gun.name; ui.featured.description.textContent=gun.trait||gun.weaponClass;
  ui.featured.damage.textContent=gun.damage; ui.featured.rate.textContent=gun.automatic?Math.round(60000/gun.fireRate):'SEMI'; ui.featured.mag.textContent=gun.magSize; ui.featured.range.textContent=featuredRange(gun);
  const fragmentLocked=Boolean(gun.fragmentCost&&!owned);ui.featured.price.textContent=owned?'OWNED':fragmentLocked?`${progress.blueprintFragments}/${gun.fragmentCost} FRAG`:`◆${price}`; ui.featured.buy.textContent=owned?'EQUIP':fragmentLocked?'RESEARCH':'BUY'; ui.featured.buy.classList.toggle('cant-afford',!owned&&(fragmentLocked?progress.blueprintFragments<gun.fragmentCost:progress.cash<price));
}

function changeFeatured(direction=1) { featuredWeaponIndex=(featuredWeaponIndex+direction+loadout.length)%loadout.length; renderFeaturedWeapon(); }

function directPrice(gun) {
  return directWeaponPrice(gun.price);
}

function shopType(gun) {
  return ['primary', 'secondary', 'melee', 'extra'][slotForGun(gun)];
}

function announceCrate(message) {
  ui.crateResult.textContent = message; ui.crateResult.classList.remove('show'); void ui.crateResult.offsetWidth; ui.crateResult.classList.add('show');
  clearTimeout(announceCrate.timer); announceCrate.timer = setTimeout(() => ui.crateResult.classList.remove('show'), 2600);
}

function renderLobbyShop() {
  ui.lobbyShopGrid.replaceChildren();
  loadout.filter(gun => activeShopFilter === 'all' || activeShopFilter==='silly'&&gun.category==='SILLY' || shopType(gun) === activeShopFilter).forEach(gun => {
    const owned = progress.unlocked.has(gun.id);
    const price = directPrice(gun);
    const card = document.createElement('article');
    card.className = `lobby-card ${gun.category.toLowerCase()}`;
    const fragmentLocked=Boolean(gun.fragmentCost&&!owned);card.innerHTML = `<small>${shopType(gun).toUpperCase()} // ${gun.weaponClass}</small><h3>${gun.name}</h3><footer><b>${owned ? 'OWNED' : fragmentLocked?`${progress.blueprintFragments}/${gun.fragmentCost} FRAG`:`$${price}`}</b><button type="button" ${owned ? 'disabled' : ''}>${owned ? 'OWNED' : fragmentLocked?'FACTORY RESEARCH':'BUY DIRECT'}</button></footer>`;
    card.querySelector('button').addEventListener('click', () => {
      if(fragmentLocked){showLobbyTab('factory');return;}
      if (owned || progress.cash < price) { announceCrate(`NEED $${Math.max(0, price - progress.cash)} MORE FOR ${gun.name}`); return; }
      progress.cash -= price; progress.unlocked.add(gun.id);progress.discoveredWeapons.add(gun.id); saveProgress(); updateCashUI();
      announceCrate(`DIRECT UNLOCK // ${gun.name}`); lobbyNotify(`WEAPON UNLOCKED // ${gun.name}`,'success'); pulseReactor('success'); uiSound('purchase'); renderLobbyShop(); renderLobbyInventory(); renderArmory();
    });
    ui.lobbyShopGrid.append(card);
  });
}

function renderLobbyInventory() {
  const roleNames = ['PRIMARY', 'SECONDARY', 'MELEE', 'OTHER'];
  ui.lobbyLoadout.replaceChildren();
  quickSlots.forEach((weaponIndex, slotIndex) => {
    const button = document.createElement('button'); button.type = 'button';
    button.className = `loadout-slot ${slotIndex === selectedLobbySlot ? 'active' : ''}`;
    button.innerHTML = `<kbd>${slotIndex + 1}</kbd><small>${roleNames[slotIndex]}</small><b>${loadout[weaponIndex].name}</b>`;
    button.addEventListener('click', () => { selectedLobbySlot = slotIndex; renderLobbyInventory(); });
    ui.lobbyLoadout.append(button);
  });
  ui.cosmeticInventory.replaceChildren();
  const ownedCosmetics = cosmeticCatalog.filter(item => item.slot === selectedLobbySlot && progress.cosmetics.has(item.id));
  if (!ownedCosmetics.length) {
    const empty = document.createElement('span'); empty.className = 'cosmetic-empty'; empty.textContent = 'NO CASE REWARDS FOR THIS SLOT — OPEN A CASE IN THE SHOP'; ui.cosmeticInventory.append(empty);
  }
  ownedCosmetics.forEach(cosmetic => {
    const button = document.createElement('button'); button.type = 'button';
    button.className = `cosmetic-chip ${cosmetic.rarity} ${progress.equippedCosmetics[selectedLobbySlot] === cosmetic.id ? 'equipped' : ''}`;
    button.textContent = `${cosmetic.icon} ${cosmetic.name}`; button.addEventListener('click', () => equipCosmetic(cosmetic)); ui.cosmeticInventory.append(button);
  });
  ui.lobbyInventoryGrid.replaceChildren();
  loadout.filter(gun => progress.unlocked.has(gun.id) && slotForGun(gun) === selectedLobbySlot).forEach(gun => {
    const index = loadout.indexOf(gun);
    const card = document.createElement('button'); card.type = 'button';
    card.className = `lobby-card inventory-card ${gun.category.toLowerCase()} ${quickSlots.includes(index) ? 'equipped' : ''}`;
    const itemStat = selectedLobbySlot === 3 ? `STACK ${gun.magSize + gun.maxReserve}${gun.cooldownDuration ? ` // ${(gun.cooldownDuration / 1000).toFixed(1)}S COOLDOWN` : ''}` : selectedLobbySlot === 2 ? '+8% MOVE WHILE HELD' : `MAG ${gun.magSize} // RESERVE ${gun.maxReserve}`;
    card.innerHTML = `<small>${gun.category === 'GEAR' ? 'UTILITY GEAR' : gun.category}</small><h3>${gun.name}</h3><small>${gun.trait || gun.weaponClass}</small><em>${itemStat}</em>`;
    card.addEventListener('click', () => {
      const previous = quickSlots[selectedLobbySlot];
      const duplicateSlot = quickSlots.indexOf(index);
      if (duplicateSlot >= 0 && duplicateSlot !== selectedLobbySlot) quickSlots[duplicateSlot] = previous;
      quickSlots[selectedLobbySlot] = index;
      applyCosmeticToSlot(selectedLobbySlot);
      if (selectedLobbySlot === 0 || state.weaponIndex === previous) switchWeapon(index, false); else updateQuickSlotUI();
      saveProgress(); lobbyNotify(`LOADOUT CHANGED // ${gun.name}`,'info'); uiSound('equip'); renderLobbyInventory(); renderLobbySummary();
    });
    ui.lobbyInventoryGrid.append(card);
  });
  renderCosmeticInventory();
}

function cosmeticEquipped(item){
  if(item.type==='skin')return Object.values(progress.cosmeticState.equippedSkins).includes(item.id);
  if(item.type==='charm')return progress.cosmeticState.equippedCharm===item.id;if(item.type==='tracer')return progress.cosmeticState.equippedTracer===item.id;if(item.type==='killFx')return progress.cosmeticState.equippedKillFx===item.id;return false;
}
function compatibleWeaponFor(item){
  const selected=loadout[quickSlots[selectedLobbySlot]];if(item.type!=='skin')return selected;
  return item.compatibleWeapons.includes(selected?.id)&&progress.unlocked.has(selected.id)?selected:loadout.find(gun=>item.compatibleWeapons.includes(gun.id)&&progress.unlocked.has(gun.id));
}
function cosmeticCard(item,{shopMode=null}={}){
  const owned=progress.cosmeticState.owned.includes(item.id);const equipped=cosmeticEquipped(item);const weapon=compatibleWeaponFor(item);const card=document.createElement('article');card.className=`cosmetic-card ${owned?'owned':'unowned'} ${equipped?'equipped':''}`;card.style.setProperty('--rarity',RARITIES[item.rarity].color);
  card.style.setProperty('--preview-a',item.baseColor||item.colors?.[0]||COLLECTIONS[item.collection]?.colors?.[0]||'#111827');card.style.setProperty('--preview-b',item.accentColor||item.colors?.[1]||COLLECTIONS[item.collection]?.colors?.[1]||RARITIES[item.rarity].color);
  const compatible=item.compatibleWeapons?.map(id=>loadout.find(gun=>gun.id===id)?.name||id).join(' // ')||'GLOBAL COSMETIC';
  card.innerHTML=`${progress.cosmeticState.newItems.includes(item.id)?'<b class="new-ribbon">NEW</b>':''}<button class="favorite-cosmetic" type="button" title="Favorite">${progress.cosmeticState.favorites.includes(item.id)?'★':'☆'}</button><i>${item.icon}</i><div class="cosmetic-preview-swatch"></div><small>${RARITIES[item.rarity].label} // ${COLLECTIONS[item.collection]?.name||item.collection}</small><h3>${item.name}</h3><p>${compatible}${item.design?.inspect?`<br />INSPECT // ${item.design.inspect}`:''}</p><footer></footer>`;
  card.querySelector('.favorite-cosmetic').addEventListener('click',()=>{const favorites=new Set(progress.cosmeticState.favorites);favorites.has(item.id)?favorites.delete(item.id):favorites.add(item.id);progress.cosmeticState.favorites=[...favorites];saveProgress();renderCosmeticInventory();renderCosmeticShop();});
  const footer=card.querySelector('footer');const preview=document.createElement('button');preview.type='button';preview.textContent='PREVIEW';preview.addEventListener('click',()=>previewCosmetic(item));footer.append(preview);
  if(shopMode){const action=document.createElement('button');action.type='button';if(shopMode==='craft'){const cost=item.duplicateShards*5;action.textContent=owned?'OWNED':`${cost} SHARDS`;action.disabled=owned;action.addEventListener('click',()=>{const result=craftCosmetic(progress.cosmeticState,item.id);if(!result.ok){lobbyNotify(result.error==='INSUFFICIENT_SHARDS'?`NEED ${result.cost-progress.cosmeticState.shards} MORE SHARDS`:'COSMETIC ALREADY OWNED','warning');return;}progress.cosmeticState=result.state;saveProgress();renderCosmeticShop();renderCosmeticInventory();lobbyNotify(`CRAFTED // ${item.name}`,'success');});}else{action.textContent=owned?'OWNED':`◆${item.directPrice}`;action.disabled=owned;action.addEventListener('click',()=>{const result=directPurchaseCosmetic({state:progress.cosmeticState,balance:progress.cash,cosmeticId:item.id});if(!result.ok){lobbyNotify(result.error==='ALREADY_OWNED'?'ALREADY OWNED':`NEED ◆${Math.max(0,item.directPrice-progress.cash)} MORE`,'warning');return;}progress.cosmeticState=result.state;progress.cash=result.balance;saveProgress();updateCashUI();renderCosmeticShop();renderCosmeticInventory();lobbyNotify(`DIRECT PURCHASE // ${item.name}`,'success');uiSound('purchase');});}footer.append(action);
  }else{const action=document.createElement('button');action.type='button';action.textContent=equipped?'EQUIPPED':owned?'EQUIP':'LOCKED';action.disabled=!owned||equipped||(item.type==='skin'&&!weapon);action.addEventListener('click',()=>equipCatalogItem(item,weapon?.id));footer.append(action);}
  return card;
}
function previewCosmetic(item){
  if(item.type==='skin'){const gun=compatibleWeaponFor(item)||loadout.find(entry=>item.compatibleWeapons.includes(entry.id));const index=loadout.indexOf(gun);if(!ui.unboxing.classList.contains('hidden'))closeCaseReveal();showLobbyTab('play');if(index>=0)setLobbyPreviewWeapon(index,item);lobbyNotify(`${item.name} // 3D VIEWER UPDATED`,'info');return;}
  if(item.type==='killFx'){previewKillFx(item);return;}lobbyNotify(`${item.name} // ${item.type.toUpperCase()} PREVIEW`,'info');pulseReactor('reward',650);
}
function renderCosmeticInventory(){
  if(!ui.cosmeticCatalogGrid)return;const weapons=activeCosmeticTab==='weapons';ui.weaponInventoryPane.classList.toggle('hidden',!weapons);ui.cosmeticInventoryPane.classList.toggle('hidden',weapons);ui.cosmeticTabs.forEach(button=>button.classList.toggle('active',button.dataset.cosmeticTab===activeCosmeticTab));if(weapons)return;
  ui.cosmeticCatalogGrid.replaceChildren();if(activeCosmeticTab==='kit'){COSMETIC_KITS.forEach(kit=>{const owned=progress.cosmeticState.ownedKits.includes(kit.id);const card=document.createElement('article');card.className=`cosmetic-card ${owned?'owned':'unowned'}`;card.style.setProperty('--rarity',RARITIES[kit.rarity].color);card.innerHTML=`<i>▦</i><small>${RARITIES[kit.rarity].label} // COMPLETE KIT</small><h3>${kit.name}</h3><p>${kit.itemIds.map(id=>cosmeticById(id)?.name).join(' // ')}</p><footer><button type="button">${owned?'OWNED':'LOCKED'}</button></footer>`;ui.cosmeticCatalogGrid.append(card);});return;}
  if(activeCosmeticTab==='collection'){Object.entries(COLLECTIONS).forEach(([id,collection])=>{const all=COSMETICS.filter(item=>item.collection===id);const count=all.filter(item=>progress.cosmeticState.owned.includes(item.id)).length;const card=document.createElement('article');card.className=`cosmetic-card ${count?'owned':'unowned'}`;card.style.setProperty('--rarity',collection.colors[1]);card.innerHTML=`<i>▤</i><small>COLLECTION PROGRESS</small><h3>${collection.name}</h3><p>${count} / ${all.length} ITEMS OWNED</p>`;ui.cosmeticCatalogGrid.append(card);});return;}
  let items=COSMETICS.filter(item=>item.type===activeCosmeticTab);const weaponFilter=ui.cosmeticWeaponFilter.value;const rarityFilter=ui.cosmeticRarityFilter.value;const collectionFilter=ui.cosmeticCollectionFilter.value;const ownedFilter=ui.cosmeticOwnedFilter.value;
  if(weaponFilter!=='all')items=items.filter(item=>!item.compatibleWeapons||item.compatibleWeapons.includes(weaponFilter));if(rarityFilter!=='all')items=items.filter(item=>item.rarity===rarityFilter);if(collectionFilter!=='all')items=items.filter(item=>item.collection===collectionFilter);
  if(ownedFilter==='owned')items=items.filter(item=>progress.cosmeticState.owned.includes(item.id));if(ownedFilter==='unowned')items=items.filter(item=>!progress.cosmeticState.owned.includes(item.id));if(ownedFilter==='new')items=items.filter(item=>progress.cosmeticState.newItems.includes(item.id));if(ownedFilter==='favorite')items=items.filter(item=>progress.cosmeticState.favorites.includes(item.id));
  items.forEach(item=>ui.cosmeticCatalogGrid.append(cosmeticCard(item)));if(!items.length)ui.cosmeticCatalogGrid.innerHTML='<span class="cosmetic-empty">NO COSMETICS MATCH THESE FILTERS.</span>';
}
function renderCosmeticShop(){
  if(!ui.cosmeticShopGrid)return;ui.cosmeticShopGrid.replaceChildren();ui.cosmeticShopTabs.forEach(button=>button.classList.toggle('active',button.dataset.cosmeticShop===activeCosmeticShop));let items=COSMETICS;
  if(activeCosmeticShop==='featured')items=['vertigo-phantom-skin','jungle-relic-skin','molten-steel-skin','nebula-skin','pizza-weapon-skin','fish-splash-fx'].map(cosmeticById);else if(activeCosmeticShop==='daily'){const seed=[...localDateKey()].reduce((sum,char)=>sum+char.charCodeAt(0),0);items=Array.from({length:6},(_,index)=>COSMETICS[(seed+index*11)%COSMETICS.length]);}else items=items.filter(item=>!progress.cosmeticState.owned.includes(item.id));items.slice(0,['featured','daily'].includes(activeCosmeticShop)?6:18).forEach(item=>ui.cosmeticShopGrid.append(cosmeticCard(item,{shopMode:activeCosmeticShop==='craft'?'craft':'direct'})));
  ui.cosmeticShards.textContent=String(progress.cosmeticState.shards);ui.kitKeyCount.textContent=`${progress.cosmeticState.kitKeys} KIT KEY${progress.cosmeticState.kitKeys===1?'':'S'}`;ui.vaultKeyCount.textContent=`${progress.cosmeticState.mapVaultKeys} KEY${progress.cosmeticState.mapVaultKeys===1?'':'S'}`;document.querySelectorAll('[data-pity]').forEach(label=>{label.textContent=`${progress.cosmeticState.pity[label.dataset.pity]||0}/20`;});
}

function showLobbyTab(tab) {
  ui.lobbyTabs.forEach(button => button.classList.toggle('active', button.dataset.lobbyTab === tab));
  ui.lobbyPanels.forEach(panel => panel.classList.toggle('active', panel.dataset.panel === tab));
  ui.menu.dataset.activePanel=tab; uiSound('select');
  if (tab === 'shop') {renderLobbyShop();renderCosmeticShop();}
  if (tab === 'inventory') renderLobbyInventory();
  if (tab === 'build') renderBuildSelection();
  if (tab === 'challenges') { renderChallenges(); renderProfile(); }
  if (tab === 'collection') renderCollectionBook();
  if (tab === 'factory') renderFactoryPanel();
  if (tab === 'settings') applySettings();
  if (tab === 'play') renderLobbySummary();
}

function renderBuildSelection() {
  ui.abilityDockOptions.forEach(button => button.classList.toggle('active',button.dataset.abilityDock===selectedAbilityDock));
  ui.abilityOptions.forEach(button => {
    button.classList.toggle('selected-q',button.dataset.ability===progress.abilities.q);
    button.classList.toggle('selected-e',button.dataset.ability===progress.abilities.e);
  });
  ui.passiveOptions.forEach(button => button.classList.toggle('selected',progress.passives.includes(button.dataset.passive)));
  for (const slot of ['q','e']) ui.abilityNames[slot].textContent=abilityCatalog[progress.abilities[slot]].name;
  const container=ui.passiveIndicators.querySelector('div'); container.replaceChildren();
  progress.passives.forEach(id => {
    const perk=passiveCatalog[id]; const chip=document.createElement('span'); chip.className='passive-chip'; chip.title=perk.name; chip.innerHTML=`<i>${perk.icon}</i><b>${perk.name}</b>`; container.append(chip);
  });
  renderLobbySummary();
}

ui.abilityDockOptions.forEach(button => button.addEventListener('click',()=>{ selectedAbilityDock=button.dataset.abilityDock; renderBuildSelection(); }));
ui.abilityOptions.forEach(button => button.addEventListener('click', () => {
  const id=button.dataset.ability; const other=selectedAbilityDock==='q'?'e':'q';
  if (progress.abilities[other]===id) progress.abilities[other]=progress.abilities[selectedAbilityDock];
  progress.abilities[selectedAbilityDock]=id; state.abilityCooldownEnds[selectedAbilityDock]=0;
  saveProgress(); lobbyNotify(`${selectedAbilityDock.toUpperCase()} ABILITY // ${abilityCatalog[id].name}`,'info'); uiSound('equip'); renderBuildSelection(); refreshAbilityHUD(performance.now());
}));
ui.passiveOptions.forEach(button => button.addEventListener('click', () => {
  const id=button.dataset.passive; const index=progress.passives.indexOf(id);
  if (index>=0 && progress.passives.length>1) progress.passives.splice(index,1);
  else if (index<0) { if (progress.passives.length>=3) progress.passives.shift(); progress.passives.push(id); }
  saveProgress(); lobbyNotify(`PASSIVES UPDATED // ${progress.passives.length}/3 ONLINE`,'info'); uiSound('equip'); renderBuildSelection();
}));

if(ui.cosmeticWeaponFilter){loadout.forEach(gun=>{const option=document.createElement('option');option.value=gun.id;option.textContent=gun.name;ui.cosmeticWeaponFilter.append(option);});}
if(ui.cosmeticCollectionFilter){Object.entries(COLLECTIONS).forEach(([id,collection])=>{const option=document.createElement('option');option.value=id;option.textContent=collection.name;ui.cosmeticCollectionFilter.append(option);});}
ui.cosmeticTabs.forEach(button=>button.addEventListener('click',()=>{activeCosmeticTab=button.dataset.cosmeticTab;renderCosmeticInventory();}));
[ui.cosmeticWeaponFilter,ui.cosmeticRarityFilter,ui.cosmeticCollectionFilter,ui.cosmeticOwnedFilter].forEach(filter=>filter?.addEventListener('change',renderCosmeticInventory));
ui.cosmeticShopTabs.forEach(button=>button.addEventListener('click',()=>{activeCosmeticShop=button.dataset.cosmeticShop;renderCosmeticShop();}));

ui.lobbyTabs.forEach(button => button.addEventListener('click', () => showLobbyTab(button.dataset.lobbyTab)));
document.querySelector('[data-lobby-action="chill"]')?.addEventListener('click',()=>enterLobbyParkour('atrium'));
ui.shopFilters.forEach(button => button.addEventListener('click', () => {
  activeShopFilter = button.dataset.shopFilter;
  ui.shopFilters.forEach(filter => filter.classList.toggle('active', filter === button));
  renderLobbyShop();
}));
ui.collectionFilters.forEach(button=>button.addEventListener('click',()=>{activeCollectionFilter=button.dataset.collectionFilter;ui.collectionFilters.forEach(filter=>filter.classList.toggle('active',filter===button));renderCollectionBook();}));

ui.settingsShortcut?.addEventListener('click',()=>showLobbyTab('settings'));
ui.editCallsign?.addEventListener('click',()=>{showLobbyTab('settings');document.querySelector('#callsign-setting')?.focus();});
ui.openShop?.addEventListener('click',()=>showLobbyTab('shop'));
ui.buildSummary?.addEventListener('click',()=>showLobbyTab('build'));
ui.changeLoadout?.addEventListener('click',()=>{selectedLobbySlot=0;showLobbyTab('inventory');});
ui.inspectWeapon?.addEventListener('click',()=>{if(!lobbyPreview)return;setLobbyPreviewWeapon(lobbyPreviewWeaponIndex,lobbyPreview.previewSkin);lobbyPreview.yaw=-.9;lobbyPreview.aiming=false;lobbyPreview.action='inspect';lobbyPreview.actionStartedAt=performance.now();lobbyPreview.actionUntil=lobbyPreview.actionStartedAt+1200;const skin=lobbyPreview.previewSkin||skinForWeapon(loadout[lobbyPreviewWeaponIndex]?.id);lobbyNotify(`INSPECT // ${skin?.design?.inspect||'MECHANICAL CHECK'}`,'info');uiSound('select');});
document.querySelector('#preview-fire')?.addEventListener('click',()=>{if(!lobbyPreview)return;lobbyPreview.action='fire';lobbyPreview.actionStartedAt=performance.now();lobbyPreview.actionUntil=lobbyPreview.actionStartedAt+320;lobbyPreview.platform.material.opacity=1;uiSound('select');});
document.querySelector('#preview-reload')?.addEventListener('click',()=>{if(!lobbyPreview)return;lobbyPreview.action='reload';lobbyPreview.actionStartedAt=performance.now();lobbyPreview.actionUntil=lobbyPreview.actionStartedAt+900;uiSound('equip');});
document.querySelector('#preview-scope')?.addEventListener('click',event=>{if(!lobbyPreview)return;lobbyPreview.aiming=!lobbyPreview.aiming;if(lobbyPreview.aiming){lobbyPreview.yaw=0;lobbyPreview.pitch=0;}event.currentTarget.classList.toggle('active',lobbyPreview.aiming);event.currentTarget.textContent=lobbyPreview.aiming?'EXIT AIM':'AIM PREVIEW';uiSound('select');});
document.querySelectorAll('[data-preview-light]').forEach(button=>button.addEventListener('click',()=>{if(!lobbyPreview)return;const mode=button.dataset.previewLight;if(mode==='dark'){lobbyPreview.hemi.intensity=.65;lobbyPreview.key.intensity=1.6;lobbyPreview.rim.intensity=16;}else if(mode==='map'){const atmosphere=ARENA_ATMOSPHERES[state.activeArena];lobbyPreview.hemi.intensity=1.8;lobbyPreview.key.intensity=4;lobbyPreview.key.color.setHex(atmosphere.sun);lobbyPreview.rim.intensity=20;}else{lobbyPreview.hemi.intensity=2.8;lobbyPreview.key.intensity=5;lobbyPreview.key.color.setHex(0x65eaff);lobbyPreview.rim.intensity=25;}uiSound('select');}));
ui.randomizePreview?.addEventListener('click',()=>{const owned=loadout.map((gun,index)=>progress.unlocked.has(gun.id)?index:-1).filter(index=>index>=0);setLobbyPreviewWeapon(owned[Math.floor(secureRandom()*owned.length)]);uiSound('select');});
ui.favoritePreview?.addEventListener('click',()=>{
  const favorite=favoriteWeaponFromStats(); const index=loadout.indexOf(favorite); if(index<0||!progress.unlocked.has(favorite.id)){lobbyNotify('FAVORITE BLUEPRINT IS STILL LOCKED','warning');pulseReactor('error');uiSound('error');return;}
  const slot=slotForGun(favorite); const previous=quickSlots[slot]; quickSlots[slot]=index; if(slot===0||state.weaponIndex===previous)switchWeapon(index,false); saveProgress(); setLobbyPreviewWeapon(index); renderLobbySummary(); lobbyNotify(`FAVORITE EQUIPPED // ${favorite.name}`,'success'); uiSound('equip');
});
ui.featured.prev?.addEventListener('click',()=>changeFeatured(-1));
ui.featured.next?.addEventListener('click',()=>changeFeatured(1));
ui.featured.inspect?.addEventListener('click',()=>{setLobbyPreviewWeapon(featuredWeaponIndex);uiSound('select');});
ui.featured.buy?.addEventListener('click',()=>{
  const gun=loadout[featuredWeaponIndex]; const price=directPrice(gun); const owned=progress.unlocked.has(gun.id);
  if(!owned){if(gun.fragmentCost){showLobbyTab('factory');return;}if(progress.cash<price){lobbyNotify(`INSUFFICIENT CREDITS // NEED ◆${price-progress.cash}`,'warning');pulseReactor('error');uiSound('error');return;}progress.cash-=price;progress.unlocked.add(gun.id);progress.discoveredWeapons.add(gun.id);saveProgress();updateCashUI();renderLobbyShop();lobbyNotify(`WEAPON UNLOCKED // ${gun.name}`,'success');pulseReactor('success');uiSound('purchase');renderFeaturedWeapon();return;}
  const slot=slotForGun(gun);const previous=quickSlots[slot];const duplicate=quickSlots.indexOf(featuredWeaponIndex);if(duplicate>=0&&duplicate!==slot)quickSlots[duplicate]=previous;quickSlots[slot]=featuredWeaponIndex;applyCosmeticToSlot(slot);if(slot===0||state.weaponIndex===previous)switchWeapon(featuredWeaponIndex,false);saveProgress();renderLobbySummary();renderFeaturedWeapon();lobbyNotify(`EQUIPPED // ${gun.name}`,'success');uiSound('equip');
});
ui.audioToggle?.addEventListener('click',toggleMenuMusic);
ui.fullscreenToggle?.addEventListener('click',toggleFullscreen); ui.settingsFullscreen?.addEventListener('click',toggleFullscreen);
ui.resetSettings?.addEventListener('click',()=>{progress.settings={...defaultSettings};stopMenuMusic();applySettings();saveProgress();lobbyNotify('SETTINGS RESTORED TO DEFAULTS','info');uiSound('back');});
ui.settingsInputs.forEach(input=>{
  const update=()=>{const key=input.dataset.setting;progress.settings[key]=input.type==='checkbox'?input.checked:input.type==='range'?Number(input.value):input.value;if(key==='callsign')progress.settings.callsign=String(progress.settings.callsign).trimStart().slice(0,18);applySettings();if(key==='cosmeticQuality'||key==='reducedCosmeticMotion')applyEquippedCosmetics();saveProgress();};
  input.addEventListener(input.type==='text'?'change':'input',update);
});
document.addEventListener('fullscreenchange',()=>{const active=Boolean(document.fullscreenElement);ui.fullscreenToggle?.classList.toggle('active',active);ui.settingsFullscreen?.classList.toggle('active',active);});
document.addEventListener('pointerover',event=>{const button=event.target.closest('button');if(!button||button.disabled)return;if(audioContext?.state==='running')uiSound('hover');if(button===ui.deploy)ui.reactor?.classList.add('play-hover');});
document.addEventListener('pointerout',event=>{if(event.target.closest('button')===ui.deploy)ui.reactor?.classList.remove('play-hover');});
document.addEventListener('pointermove',event=>{const card=event.target.closest('.lobby-card');if(!card)return;const bounds=card.getBoundingClientRect();card.style.setProperty('--tilt-x',`${((event.clientY-bounds.top)/bounds.height-.5)*-3}deg`);card.style.setProperty('--tilt-y',`${((event.clientX-bounds.left)/bounds.width-.5)*4}deg`);});
document.addEventListener('pointerdown',()=>{if(progress.settings.musicEnabled)ensureMenuMusic();},{once:true});
setInterval(()=>{if(!state.started&&ui.menu.dataset.activePanel==='play')changeFeatured(1);},15000);
function secureRandom() {
  if (!globalThis.crypto?.getRandomValues) return Math.random();
  const values = new Uint32Array(1); crypto.getRandomValues(values); return values[0] / 4294967296;
}

function spinnerCard(reward,winner=false){return `<article class="spin-card ${reward.rarity} ${winner?'winner':''}"><i>${reward.icon||'▦'}</i><b>${reward.name}</b><small>${RARITIES[reward.rarity].label}</small></article>`;}
let pendingReward=null;
function setCrateVisualStage(stage,caseType=pendingCaseId){if(!ui.caseStage)return;const profile=CRATE_VISUAL_PROFILES[caseType]||CRATE_VISUAL_PROFILES.standard;ui.caseStage.dataset.visualStage=stage;ui.caseStage.dataset.shell=profile.shell;ui.caseStage.dataset.locks=String(profile.locks);ui.caseStage.dataset.panels=String(profile.panels);}
function closeCaseReveal(){clearTimeout(pendingRevealTimer);pendingRevealTimer=0;setCrateVisualStage('cleanup');ui.unboxing.classList.add('hidden');ui.caseStage?.classList.remove('opening','opened');ui.caseOffers.forEach(offer=>offer.classList.remove('opening'));crateOpening=false;pendingReward=null;pendingTransactionId=null;pendingCaseId=null;ui.equipReward.textContent='EQUIP';updateCashUI();renderCosmeticShop();}
function revealCaseReward(){
  if(!pendingTransactionId)return;clearTimeout(pendingRevealTimer);pendingRevealTimer=0;const result=cosmeticRewardService.finalizeCase(pendingTransactionId);if(!result.ok){closeCaseReveal();lobbyNotify('CASE REWARD COULD NOT BE FINALIZED','warning');return;}
  const transaction=result.transaction;pendingReward=transaction.rewardKind==='kit'?kitById(transaction.rewardId):cosmeticById(transaction.rewardId);const rarity=RARITIES[transaction.rarity];if(transaction.rarity==='exotic'&&!result.replayed)progress.stats.exoticRewards++;
  saveProgress();updateCashUI();renderLobbyInventory();renderCosmeticShop();setCrateVisualStage('reveal');ui.caseStage?.classList.add('opened');ui.unboxSpinner.classList.add('hidden');ui.unboxReveal.classList.remove('hidden');ui.spinnerTrack.classList.add('revealed');
  ui.rewardCard.className=`reward-card ${transaction.rarity}`;ui.rewardIcon.textContent=pendingReward.icon||'▦';ui.rewardName.textContent=pendingReward.name;ui.rewardSlot.textContent=transaction.rewardKind==='kit'?`COMPLETE KIT // ${result.reward.itemIds.length} ITEMS`:`${pendingReward.type.replace('killFx','KILL FX').toUpperCase()} // ${COLLECTIONS[pendingReward.collection].name}`;ui.rewardRarity.textContent=`RARITY: ${rarity.label}`;
  ui.rewardDuplicate.textContent=result.reward.shards?`DUPLICATES CONVERTED // +${result.reward.shards} COSMETIC SHARDS`:`${result.reward.newItems.length} NEW ITEM${result.reward.newItems.length===1?'':'S'} ADDED TO INVENTORY`;
  ui.rewardKitContents.replaceChildren();result.reward.itemIds.forEach(id=>{const item=cosmeticById(id);const chip=document.createElement('span');chip.textContent=`${item.icon} ${item.name}`;ui.rewardKitContents.append(chip);});
  ui.rewardParticles.style.setProperty('--reward-color',rarity.color);ui.rewardParticles.replaceChildren();const particleScale=qualityVisualFallback(progress.settings.graphicsQuality).particleScale;const baseCount=transaction.rarity==='exotic'?44:transaction.rarity==='legendary'?34:22;const count=progress.settings.reducedUiMotion?0:Math.round(baseCount*particleScale);for(let index=0;index<count;index++){const particle=document.createElement('i');particle.style.setProperty('--angle',`${index*(360/count)}deg`);particle.style.animationDelay=`${(index%5)*.03}s`;ui.rewardParticles.append(particle);}
  lobbyNotify(`${rarity.label} REWARD // ${pendingReward.name}`,transaction.rarity);pulseReactor('reward',1400);uiSound('reward');renderProfile();
}
function openCase(caseType){
  if(crateOpening||!CASES[caseType])return;if(state.gameMode==='multiplayer'){lobbyNotify('ONLINE REWARDS REQUIRE SERVER AUTHORITY','warning');return;}const definition=CASES[caseType];const useKey=Boolean(definition.key&&(progress.cosmeticState[definition.key]||0)>0);const transactionId=globalThis.crypto?.randomUUID?.()||`case-${Date.now()}-${Math.floor(secureRandom()*1e6)}`;
  const result=cosmeticRewardService.beginCase(caseType,transactionId,{useKey});if(!result.ok){const message=result.error==='MISSING_KEY'?'EARN A MAP VAULT KEY FROM MAP CHALLENGES':`NEED ◆${Math.max(0,definition.cost-progress.cash)} MORE`;announceCrate(message);lobbyNotify(message,'warning');pulseReactor('error');uiSound('error');return;}
  crateOpening=true;pendingCaseId=caseType;pendingTransactionId=transactionId;const transaction=result.transaction;pendingReward=transaction.rewardKind==='kit'?kitById(transaction.rewardId):cosmeticById(transaction.rewardId);saveProgress();updateCashUI();renderCosmeticShop();ui.caseOffers.forEach(offer=>offer.classList.toggle('opening',offer.dataset.case===caseType));if(ui.caseStage){ui.caseStage.dataset.case=caseType;setCrateVisualStage('entrance',caseType);ui.caseStage.classList.remove('opening','opened');void ui.caseStage.offsetWidth;ui.caseStage.classList.add('opening');}
  const candidates=transaction.rewardKind==='kit'?COSMETIC_KITS:COSMETICS.filter(item=>(!definition.rewardType||item.type===definition.rewardType)&&(!definition.collections||definition.collections.includes(item.collection)));const winnerIndex=36;const sequence=Array.from({length:43},()=>candidates[Math.floor(secureRandom()*candidates.length)]);sequence[winnerIndex]=pendingReward;ui.spinnerTrack.innerHTML=sequence.map((reward,index)=>spinnerCard(reward,index===winnerIndex)).join('');ui.spinnerTrack.classList.remove('revealed');ui.spinnerTrack.style.transition='none';ui.spinnerTrack.style.transform='translateX(30px)';ui.unboxReveal.classList.add('hidden');ui.unboxSpinner.classList.remove('hidden');ui.unboxing.classList.remove('hidden');uiSound('purchase');void ui.spinnerTrack.offsetWidth;
  requestAnimationFrame(()=>requestAnimationFrame(()=>{setCrateVisualStage('spinner',caseType);ui.spinnerTrack.style.transition=progress.settings.reduceMotion?'transform .25s ease-out':'transform 4.35s cubic-bezier(.08,.72,.08,1)';ui.spinnerTrack.style.transform=`translateX(${-winnerIndex*150-70}px)`;}));pendingRevealTimer=setTimeout(revealCaseReward,progress.settings.reduceMotion?350:4550);
}
function equipPendingReward(){if(!pendingReward)return;if(pendingReward.itemIds){for(const id of pendingReward.itemIds){const item=cosmeticById(id);if(!item||!['skin','charm','tracer','killFx'].includes(item.type))continue;const weapon=compatibleWeaponFor(item);if(item.type!=='skin'||weapon)equipCatalogItem(item,weapon?.id);}}else equipCatalogItem(pendingReward,compatibleWeaponFor(pendingReward)?.id);ui.equipReward.textContent='EQUIPPED';}
ui.caseButtons.forEach(button=>button.addEventListener('click',()=>openCase(button.dataset.buyCase)));ui.skipUnbox.addEventListener('click',()=>{if(crateOpening&&!ui.unboxSpinner.classList.contains('hidden'))revealCaseReward();});ui.equipReward.addEventListener('click',equipPendingReward);ui.previewReward.addEventListener('click',()=>{if(pendingReward?.itemIds)previewCosmetic(cosmeticById(pendingReward.itemIds[0]));else if(pendingReward)previewCosmetic(pendingReward);});ui.openAnother.addEventListener('click',()=>{const caseId=pendingCaseId;closeCaseReveal();openCase(caseId);});ui.closeReward.addEventListener('click',closeCaseReveal);

function updateLootInteraction() {
  state.nearestLoot = null; state.nearestWire = null; state.nearestGnome=null;state.nearestControl=null;state.nearestPickup=null;state.nearestLobbyControl=null;state.nearestReturnPortal=null;
  if(state.gameMode==='parkour'&&state.parkour){const portal=parkourReturnPortals.find(item=>item.courseIndex===state.parkour.courseIndex);if(portal&&portal.group.position.distanceTo(state.position)<portal.radius+1.25)state.nearestReturnPortal=portal;}
  if(state.lobbyParkour&&state.gameMode!=='parkour'){let controlDistance=3.1;for(const control of lobbyCourse.interactives){const distance=control.group.position.distanceTo(state.position);if(distance<controlDistance){controlDistance=distance;state.nearestLobbyControl=control;}}}
  let nearestDistance = 4.2;
  for (const crate of lootCrates) {
    if (crate.opened || crate.arena!==state.activeArena) continue;
    const distance = crate.group.position.distanceTo(state.position);
    if (distance < nearestDistance) { nearestDistance = distance; state.nearestLoot = crate; }
  }
  if(!state.nearestLoot){let pickupDistance=4;for(const station of weaponPickupStations){if(!station.available||station.arena!==state.activeArena)continue;const distance=station.group.position.distanceTo(state.position);if(distance<pickupDistance){pickupDistance=distance;state.nearestPickup=station;}}}
  if(!state.nearestLoot&&!state.nearestPickup){let controlDistance=3.4;for(const control of environmentalControls){if(control.arena!==state.activeArena||control.factoryOnly&&state.gameMode!=='factoryDefense')continue;const distance=control.group.position.distanceTo(state.position);if(distance<controlDistance){controlDistance=distance;state.nearestControl=control;}}}
  if(!state.nearestLoot&&!state.nearestPickup&&!state.nearestControl){let gnomeDistance=3.2;for(const gnome of gnomeTurrets){if(!gnome.refundable||gnome.arena!==state.activeArena)continue;const distance=gnome.group.position.distanceTo(state.position);if(distance<gnomeDistance){gnomeDistance=distance;state.nearestGnome=gnome;}}}
  if (!state.nearestLoot&&!state.nearestPickup&&!state.nearestControl&&!state.nearestGnome) {
    let wireDistance=3.2;
    for (const wire of activeWires) {
      const distance=pointToSegmentDistance(state.position,wire.a.point,wire.b.point);
      if (distance<wireDistance) { wireDistance=distance; state.nearestWire=wire; }
    }
  }
  const visible = Boolean((state.nearestReturnPortal || state.nearestLobbyControl || state.nearestLoot || state.nearestPickup || state.nearestControl || state.nearestGnome || state.nearestWire) && state.started && !state.dead && !state.armoryOpen);
  ui.interaction.classList.toggle('show', visible);
  ui.interaction.innerHTML = visible ? state.nearestReturnPortal ? '<kbd>F</kbd> RETURN TO CHILL DECK' : state.nearestLobbyControl ? `<kbd>F</kbd> ${state.nearestLobbyControl.label}` : state.nearestLoot ? '<kbd>F</kbd> SEARCH WEAPON CRATE' : state.nearestPickup ? `<kbd>F</kbd> TAKE ${state.nearestPickup.label}` : state.nearestControl ? `<kbd>F</kbd> ${state.nearestControl.label}` : state.nearestGnome ? '<kbd>F</kbd> PICK UP GNOME (+1)' : '<kbd>F</kbd> RIDE WIRE ZIPLINE' : '';
}

function searchNearbyLoot() {
  if(state.nearestReturnPortal){exitParkour();return;}
  if(state.nearestLobbyControl){const control=state.nearestLobbyControl;state.nearestLobbyControl=null;control.action();return;}
  const crate = state.nearestLoot;
  if(!crate&&state.nearestPickup){collectPowerWeapon(state.nearestPickup);state.nearestPickup=null;return;}
  if(!crate&&state.nearestControl){activateEnvironmentalControl(state.nearestControl);state.nearestControl=null;return;}
  if(!crate&&state.nearestGnome){const gnome=state.nearestGnome;gnome.gun.ammo=Math.min(gnome.gun.magSize,gnome.gun.ammo+1);updateAmmo();removeGnomeTurret(gnome);state.nearestGnome=null;ui.status.textContent='GNOME RECOVERED // CHARGE REFUNDED';chaosSound('pop',280,.8);return;}
  if (!crate && state.nearestWire) { useWireZipline(state.nearestWire); return; }
  if (!crate || crate.opened || state.dead || state.armoryOpen) return;
  crate.opened = true; crate.lid.rotation.x = -.65; crate.lid.position.set(0, 1.35, -.38); crate.glow.intensity = 0; crate.core.visible = false; crate.ring.visible = false;
  const gun = loadout[state.weaponIndex];
  gun.reserve = gun.maxReserve; addCash(150, 'FIELD SUPPLY CACHE'); updateAmmo();awardBlueprintFragments(1,'TREASURE CACHE');
  recordChallenge('cache');
  ui.status.textContent = 'FIELD CACHE // AMMO + $150';
  ui.interaction.classList.remove('show'); renderArmory();
}

function useWireZipline(wire) {
  const distanceA=state.position.distanceTo(wire.a.point); const destination=distanceA<state.position.distanceTo(wire.b.point)?wire.b.point:wire.a.point;
  const from=state.position.clone(); const to=destination.clone().add(new THREE.Vector3(0,1.2,0));
  state.zipline={from,to,started:performance.now(),duration:Math.max(350,from.distanceTo(to)/10.5*1000)};
  addMovementCombo('WIRE ZIP-LINE',65);
  ui.status.textContent='WIRE ZIPLINE // +50% SPEED'; ui.interaction.classList.remove('show');
}

let activeCreditPop=null;let creditPopTotal=0;let creditPopTimer=0;
function addCash(amount, reason) {
  progress.cash += amount; if(amount>0){progress.stats.totalCreditsEarned+=amount;progress.stats.xp+=amount;} updateCashUI(); scheduleProgressSave();
  creditPopTotal+=amount;
  if(!activeCreditPop){activeCreditPop=document.createElement('span');activeCreditPop.className='credit-pop';ui.hud.append(activeCreditPop);}
  activeCreditPop.textContent=`+$${creditPopTotal} // ${reason}`;clearTimeout(creditPopTimer);creditPopTimer=setTimeout(()=>{activeCreditPop?.remove();activeCreditPop=null;creditPopTotal=0;},850);
  if (state.armoryOpen) renderArmory();
}

function renderArmory() {
  ui.armoryGrid.replaceChildren();
  let activeCategory = '';
  loadout.forEach((gun, index) => {
    if (gun.category === 'GEAR') return;
    if (gun.category !== activeCategory) {
      activeCategory = gun.category;
      let categoryEnd=index;while(categoryEnd+1<loadout.length&&loadout[categoryEnd+1].category===gun.category)categoryEnd++;
      const heading = document.createElement('div');
      heading.className = `armory-section-title category-${gun.category.toLowerCase()}`;
      heading.innerHTML = `<span>${String(index + 1).padStart(2, '0')}—${String(categoryEnd + 1).padStart(2, '0')}</span><b>${gun.category} WEAPONS</b>`;
      ui.armoryGrid.append(heading);
    }
    const owned = progress.unlocked.has(gun.id);
    const equipped = state.weaponIndex === index;
    const price = directPrice(gun);
    const fragmentLocked=Boolean(gun.fragmentCost&&!owned);const affordable = fragmentLocked?progress.blueprintFragments>=gun.fragmentCost:progress.cash >= price;
    const card = document.createElement('button');
    card.type = 'button';
    card.className = `weapon-card ${owned ? 'owned' : 'locked'} ${equipped ? 'equipped' : ''} ${!owned && !affordable ? 'cant-afford' : ''}`;
    const action = equipped ? 'EQUIPPED' : owned ? 'EQUIP WEAPON' : fragmentLocked?`RESEARCH // ${progress.blueprintFragments}/${gun.fragmentCost} FRAG`:affordable ? `BUY DIRECT // $${price}` : `NEED $${price}`;
    card.innerHTML = `<span class="card-index">${String(index + 1).padStart(2, '0')}</span><span class="card-class">${gun.category} // ${gun.weaponClass}</span><h3>${gun.name}</h3><div class="card-stats"><span>POWER<b>${Math.min(999, gun.headDamage)}</b></span><span>RATE<b>${gun.automatic ? Math.round(60000 / gun.fireRate) : 'SEMI'}</b></span><span>MAG<b>${gun.magSize}</b></span></div><span class="card-action"><b>${action}</b><i>${owned ? '→' : '◇'}</i></span>`;
    card.addEventListener('click', () => {
      if (!owned) {
        if(fragmentLocked){ui.status.textContent='BLUEPRINT REQUIRES FACTORY RESEARCH';return;}
        if (progress.cash < price) { ui.status.textContent = `NEED $${price - progress.cash} MORE`; return; }
        progress.cash -= price; progress.unlocked.add(gun.id);progress.discoveredWeapons.add(gun.id); saveProgress(); updateCashUI();
        ui.status.textContent = `${gun.name} // UNLOCKED`;
      }
      switchWeapon(index); renderArmory();
    });
    ui.armoryGrid.append(card);
  });
}

function toggleArmory(force) {
  if (!state.started || state.dead || state.lobbyParkour || state.gameMode==='parkour') return;
  if(state.gameMode==='multiplayer'){ui.status.textContent='PRIVATE 1V1 // ARMORY LOCKED DURING MATCH';return;}
  setAiming(false);
  state.armoryOpen = typeof force === 'boolean' ? force : !state.armoryOpen;
  state.mouseDown = false; keys.clear(); clearTraversalInput();
  ui.armory.classList.toggle('hidden', !state.armoryOpen);
  ui.armory.setAttribute('aria-hidden', String(!state.armoryOpen));
  ui.prompt.classList.remove('show');
  if (state.armoryOpen) { state.softMouseLook=false;state.locked=false;document.body.classList.remove('mouse-locked');ui.mouseLockGate?.classList.add('hidden');document.exitPointerLock(); renderArmory(); }
  else requestLock();
}

ui.closeArmory.addEventListener('click', () => toggleArmory(false));
function initializeFactoryDefense(){
  const now=performance.now();progress.factory.defenseRuns++;state.factoryDefense={wave:1,storage:100,nextWaveAt:0,nextStorageDamage:now+1200,emergencyResolved:false};for(const enemy of enemies){if(enemy.arena!==2)continue;if(enemy.respawnTimer)clearTimeout(enemy.respawnTimer);enemy.respawnTimer=null;enemy.group.position.copy(enemy.spawn);enemy.group.rotation.set(0,0,0);enemy.health=enemy.maxHealth;enemy.alive=true;enemy.spottedAt=0;enemy.lastSeenAt=0;enemy.burstRemaining=0;if(enemy.shield){enemy.shieldHealth=180;enemy.shield.visible=true;}ui.enemyBlips[enemy.index]?.classList.remove('down');}state.hostiles=enemies.filter(enemy=>enemy.arena===2&&enemy.alive).length;setTextIfChanged(ui.enemies,String(state.hostiles).padStart(2,'0'));ui.factoryObjective?.classList.remove('hidden');updateFactoryObjective();saveProgress();
}
function updateFactoryObjective(){if(!state.factoryDefense)return;setTextIfChanged(ui.factoryWave,`WAVE ${state.factoryDefense.wave} / 5`);setTextIfChanged(ui.factoryHealth,`STORAGE ${Math.max(0,Math.round(state.factoryDefense.storage))}%`);const emergency=factoryEmergencyCatalog[progress.factory.emergencyIndex%factoryEmergencyCatalog.length];setTextIfChanged(ui.factoryEmergencyHud,state.factoryDefense.emergencyResolved?'MAINTENANCE COMPLETE':`${emergency.name} // ${progress.factory.emergencyProgress}%`);}
function spawnFactoryWave(wave){for(const enemy of enemies){if(enemy.arena!==2)continue;enemy.group.position.copy(enemy.spawn);enemy.group.rotation.set(0,0,0);enemy.health=(enemy.maxHealth||140)*(1+(wave-1)*.12);enemy.alive=true;enemy.spottedAt=0;enemy.lastSeenAt=0;enemy.burstRemaining=0;enemy.nextShot=performance.now()+900+enemy.index*60;if(enemy.shield){enemy.shieldHealth=180+(wave-1)*15;enemy.shield.visible=true;}ui.enemyBlips[enemy.index]?.classList.remove('down');}state.hostiles=enemies.filter(enemy=>enemy.arena===2&&enemy.alive).length;setTextIfChanged(ui.enemies,String(state.hostiles).padStart(2,'0'));ui.status.textContent=`FACTORY WAVE ${wave} // DEFEND STORAGE`;}
function updateFactoryDefense(now){
  const defense=state.factoryDefense;if(state.gameMode!=='factoryDefense'||!defense||state.completed)return;const alive=enemies.filter(enemy=>enemy.arena===2&&enemy.alive);if(now>=defense.nextStorageDamage){defense.nextStorageDamage=now+1000;const breach=alive.filter(enemy=>enemy.group.position.distanceTo(new THREE.Vector3(220,0,72))<13).length;const emergencyDrain=defense.emergencyResolved?0:.35;if(breach||emergencyDrain){defense.storage=Math.max(0,defense.storage-breach*3-emergencyDrain);updateFactoryObjective();}}
  if(defense.storage<=0){damagePlayer(200);ui.status.textContent='FACTORY STORAGE LOST';return;}if(alive.length===0&&!defense.nextWaveAt){if(defense.wave>=5){const oldLevel=progress.factory.level;progress.factory.bestWave=Math.max(progress.factory.bestWave,5);progress.factory.level=Math.max(progress.factory.level,1+Math.floor(progress.factory.bestWave/3));awardBlueprintFragments(3,'FACTORY DEFENSE CLEAR');if(progress.factory.level>oldLevel){cosmeticRewardService.grant('overdrive-carbine-skin','factory-milestone');lobbyNotify('FACTORY MILESTONE // OVERDRIVE COSMETIC','legendary');}saveProgress();completeExercise('FACTORY SECURED');return;}defense.nextWaveAt=now+3200;ui.status.textContent='WAVE CLEAR // REPAIR WINDOW';}
  if(defense.nextWaveAt&&now>=defense.nextWaveAt){defense.wave++;defense.nextWaveAt=0;progress.factory.bestWave=Math.max(progress.factory.bestWave,defense.wave);spawnFactoryWave(defense.wave);saveProgress();updateFactoryObjective();}
}
function completeExercise(title = 'RANGE CLEARED') {
  if (state.completed) return;
  if (state.countdownTimer) clearInterval(state.countdownTimer);
  state.completed = true; state.mouseDown = false; clearTraversalInput(); setAiming(false); document.exitPointerLock(); ui.complete.classList.remove('hidden');
  addCash(500, 'CONTRACT COMPLETE');
  progress.stats.contractsCompleted++;progress.stats.bestMatchHeadshots=Math.max(progress.stats.bestMatchHeadshots,state.matchHeadshots);if(state.gameMode==='contract'){progress.cosmeticState.mapVaultKeys++;lobbyNotify('MATCH VICTORY // +1 MAP VAULT KEY','rare');}if(state.matchDeaths===0)recordChallenge('survivor'); saveProgress();
  ui.completeTitle.innerHTML = title.replace(' ', '<br />');ui.completeReturnLobby?.classList.add('hidden');ui.completeStatOneLabel.textContent='ACCURACY';ui.completeStatTwoLabel.textContent='ROUNDS';ui.restart.innerHTML='RUN IT AGAIN <b>↻</b>';
  ui.accuracy.textContent = `${Math.round((state.hits / Math.max(1, state.shots)) * 100)}%`; ui.rounds.textContent = state.shots;
}
ui.restart.addEventListener('click', () => {if(state.gameMode==='parkour')restartParkourRun();else if(state.gameMode==='multiplayer')void exitOnlineMatch('DUEL COMPLETE // BACK IN LOBBY');else location.reload();});
ui.completeReturnLobby?.addEventListener('click',()=>{if(state.gameMode==='multiplayer')void exitOnlineMatch('DUEL COMPLETE // BACK IN LOBBY');else exitParkour();});

function updateContractClock(now) {
  if (!state.started || state.completed) return;
  if(state.gameMode==='multiplayer')return;
  if(state.gameMode==='parkour'){setTextIfChanged(ui.matchClock,formatTrialTime(currentParkourElapsed(now)));ui.clockPanel.classList.remove('danger');updateParkourHud(now);return;}
  if(state.lobbyParkour){setTextIfChanged(ui.matchClock,'FREE ROAM');ui.clockPanel.classList.remove('danger');return;}
  if (state.firingRange) { ui.matchClock.textContent='PRACTICE'; ui.clockPanel.classList.remove('danger'); return; }
  if (state.countdownActive) return;
  if (!state.matchStart) return;
  const remaining = Math.max(0, state.matchDuration - (now - state.matchStart));
  const totalSeconds = Math.ceil(remaining / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  setTextIfChanged(ui.matchClock,`${String(minutes).padStart(2,'0')}:${String(seconds).padStart(2,'0')}`);
  ui.clockPanel.classList.toggle('danger', remaining <= 30000);
  if (remaining <= 0 && !state.dead) completeExercise('TIME EXPIRED');
}

function updateLobbyParkour(now,dt){
  if(!state.lobbyParkour)return;lobbyCourse.goalRing.rotation.z+=dt*.72;lobbyCourse.loungeRing.rotation.z-=dt*.28;
  lobbyCourse.animated.forEach(item=>{if(!item.noFloat)item.object.position.y=item.baseY+Math.sin(now*.0018+item.phase)*.18;item.core.rotation.y+=dt*1.3;item.core.rotation.x+=dt*.35;if(item.orbit)item.orbit.rotation.z+=dt*.9;if(item.orbitB)item.orbitB.rotation.x+=dt*.65;});
  lobbyCourse.interactives.forEach(item=>{item.halo.rotation.z+=dt*.8;item.halo.scale.setScalar(1+Math.sin(now*.003+item.phase)*.08);});
  lobbyCourse.portals.forEach(item=>{item.ring.rotation.z+=dt*(.7+item.phase*.08);item.group.scale.setScalar(1+Math.sin(now*.003+item.phase)*.035);});
  const fishExcited=now<lobbyCourse.fishExcitedUntil;
  lobbyCourse.fish.forEach(item=>{const wave=now*.0012+item.phase;item.group.position.x=item.originX+Math.sin(wave)*(item.swimRange||.65)*(fishExcited?1.55:1);item.group.rotation.y=Math.cos(wave)>0?0:Math.PI;item.group.position.y=item.originY+Math.sin(now*.002+item.phase)*.22;});
  lobbyCourse.aquariumLights.forEach((light,index)=>{const mode=lobbyCourse.aquariumLightMode;light.material.emissiveIntensity=.55+(mode===0?Math.sin(now*.002+index)*.22:mode===1?(index%2?.95:.25):Math.sin(now*.006+index*1.7)*.45+.55);light.scale.setScalar(1+(mode===2?Math.sin(now*.006+index)*.22:0));});
  lobbyCourse.stageLights.forEach((light,index)=>{const speed=[.0018,.0042,.007][lobbyCourse.stageMode]||.002;const pulse=.78+Math.sin(now*speed+index*.85)*.28;light.scale.setScalar(Math.max(.5,pulse));light.rotation.y+=dt*(.4+lobbyCourse.stageMode*.45);});
  lobbyCourse.doors.forEach(door=>{const nearby=door.alwaysOpen||Math.hypot(state.position.x-door.position.x,state.position.z-door.position.z)<7;const offset=nearby?door.openOffset:0;door.left.position.x=THREE.MathUtils.damp(door.left.position.x,door.closedLeft-offset,8,dt);door.right.position.x=THREE.MathUtils.damp(door.right.position.x,door.closedRight+offset,8,dt);});
  lobbyCourse.traffic.forEach(item=>{const travel=(now*.012*item.speed+item.phase*17)%150-75;item.group.position.x=item.origin.x+travel;item.group.position.z=item.origin.z+Math.sin(now*.00045+item.phase)*10;item.group.rotation.y=Math.sin(now*.00045+item.phase)*.16;});
  lobbyCourse.colorTiles.forEach(item=>{const close=Math.hypot(state.position.x-item.x,state.position.z-item.z)<.85;item.mesh.scale.y=THREE.MathUtils.damp(item.mesh.scale.y,close?3.2:1,9,dt);if(close)item.mesh.rotation.y+=dt*.8;});
  for(const pad of lobbyCourse.pads){if(now<pad.cooldown||!state.onGround||Math.hypot(state.position.x-pad.x,state.position.z-pad.z)>pad.radius)continue;pad.cooldown=now+1100;if(pad.type==='jump'){state.velocity.y=10.5;state.onGround=false;state.position.y+=.2;state.airbornePeakY=state.position.y;ui.status.textContent='BLUE JUMP PAD // MOVEMENT TRAINING';}else{state.velocity.z=Math.min(state.velocity.z,-31);state.impulseUntil=now+900;state.speedBoostUntil=now+1200;ui.status.textContent='GREEN BOOST STRIP // FLOW SPEED';}addMovementCombo(pad.type==='jump'?'TRAINING LAUNCH':'TRAINING BOOST',40,now);}
  if(state.gameMode==='parkour')return;
  if(!state.lobbyParkourFinished)updateParkourPanel(now-state.lobbyParkourStartedAt);
  const feetY=state.position.y-state.eyeHeight;
  lobbyCourse.checkpoints.forEach((checkpoint,index)=>{if(index<=state.lobbyParkourCheckpoint||!state.onGround)return;const horizontal=Math.hypot(state.position.x-checkpoint.x,state.position.z-checkpoint.z);if(horizontal<3.2&&Math.abs(state.position.y-checkpoint.y)<.6){state.lobbyParkourCheckpoint=index;ui.status.textContent=`CHILL DECK // CHECKPOINT ${index}/${lobbyCourse.checkpoints.length-1}`;}});
  const hubBounds=CHILL_DECK_LAYOUT.hubBounds,resetMargin=CHILL_DECK_LAYOUT.resetMargin;
  if(state.position.y<1.5||state.position.x>hubBounds.maxX+resetMargin||state.position.x<hubBounds.minX-resetMargin||state.position.z>hubBounds.maxZ+resetMargin||state.position.z<hubBounds.minZ-resetMargin){const checkpoint=lobbyCourse.checkpoints[state.lobbyParkourCheckpoint]||lobbyCourse.spawn;state.vault=null;state.velocity.set(0,0,0);state.eyeHeight=1.75;state.position.copy(checkpoint);state.onGround=true;state.airbornePeakY=state.position.y;resetTraversalAtCheckpoint(state.traversal,now);stopJumpChargeAudio();ui.status.textContent='SOFT RESET // CHECKPOINT RESTORED';return;}
  if(state.lobbyParkourFinished||Math.hypot(state.position.x-lobbyCourse.goal.x,state.position.z-lobbyCourse.goal.z)>lobbyCourse.goalRadius||Math.abs(feetY-lobbyCourse.goal.y)>.65)return;
  const elapsed=now-state.lobbyParkourStartedAt;const reward=parkourReward(Date.now(),progress.stats.lobbyParkourLastFullRewardAt);state.lobbyParkourFinished=true;progress.stats.lobbyParkourCompletions++;if(!progress.stats.lobbyParkourBestTime||elapsed<progress.stats.lobbyParkourBestTime)progress.stats.lobbyParkourBestTime=elapsed;if(reward.fullReward)progress.stats.lobbyParkourLastFullRewardAt=Date.now();addCash(reward.amount,reward.fullReward?'CHILL DECK CLEAR':'CHILL DECK REPEAT');saveProgress();updateParkourPanel(elapsed);lobbyCourse.goalRing.scale.setScalar(1.35);setTimeout(()=>lobbyCourse.goalRing.scale.setScalar(1),500);ui.status.textContent=`COURSE COMPLETE // ${formatParkourTime(elapsed)} // +◆${reward.amount} // RESTART WHEN READY`;uiSound('reward');
}

function updateDummies(time, dt) {
  for (const dummy of dummies) {
    if(dummy.arena!==state.activeArena) continue;
    if (dummy.alive) {
      if(state.firingRange&&dummy.rangeBaseX!=null){const movingOffset=state.rangeMovingTargets?Math.sin(time*1.8+dummy.phase)*4:0;dummy.group.position.x=THREE.MathUtils.damp(dummy.group.position.x,dummy.rangeBaseX+movingOffset,7,dt);dummy.group.position.z=THREE.MathUtils.damp(dummy.group.position.z,dummy.rangeBaseZ,8,dt);}
      dummy.group.position.y = dummy.baseY + Math.sin(time * 1.4 + dummy.phase) * .035;
      dummy.group.rotation.z = THREE.MathUtils.damp(dummy.group.rotation.z, 0, 5, dt);
    } else {
      dummy.group.rotation.x = THREE.MathUtils.damp(dummy.group.rotation.x, -Math.PI / 2, 3, dt);
      dummy.group.position.y = THREE.MathUtils.damp(dummy.group.position.y, .35, 3, dt);
    }
  }
}

function updateLootCrates(time) {
  for (const crate of lootCrates) {
    if (crate.opened || crate.arena!==state.activeArena) continue;
    const pulse = .5 + Math.sin(time * 3 + crate.phase) * .5;
    crate.core.rotation.y += .025; crate.core.rotation.x += .012;
    crate.core.position.y = 1.42 + Math.sin(time * 2.5 + crate.phase) * .08;
    crate.ring.rotation.z += .012; crate.ring.scale.setScalar(.92 + pulse * .18);
    crate.glow.intensity = 3 + pulse * 3;
  }
}

function updateArenaEnvironment(time, now, dt) {
  for(const portal of parkourReturnPortals){if(portal.courseIndex!==state.activeArena)continue;portal.ring.rotation.z+=dt*.7;portal.group.scale.setScalar(1+Math.sin(now*.0025+portal.courseIndex)*.035);}
  if(state.activeArena===2){
    for(const piston of courseMachinery.pistons){
      const cycle=((now/8000)+piston.phase)%1;const warning=cycle>=.55&&cycle<.69;let pressure=0;if(cycle>=.69&&cycle<.77)pressure=(cycle-.69)/.08;else if(cycle>=.77&&cycle<.86)pressure=1;else if(cycle>=.86&&cycle<.96)pressure=1-(cycle-.86)/.1;
      const nextY=THREE.MathUtils.lerp(piston.originY,1.2,pressure);const delta=nextY-piston.lastY;piston.item.position.y=nextY;piston.collider.minY+=delta;piston.collider.maxY+=delta;piston.lastY=nextY;piston.warning.intensity=warning?5:.15;piston.warning.color.setHex(warning?PARKOUR_SURFACE_COLORS.hazard:PARKOUR_SURFACE_COLORS.boost);
    }
    for(const fan of courseMachinery.fans){const cycle=((now/9000)+fan.phase)%1;fan.spinning=cycle<.38;if(fan.spinning)fan.group.rotation.z+=dt*1.75;fan.group.children.forEach((child,index)=>{if(index<4)child.material.emissiveIntensity=fan.spinning?.58:.18;});}
    for(const conveyor of courseConveyors){if(playerStandingOnSurface(conveyor.surface))state.position.addScaledVector(conveyor.direction,conveyor.speed*dt);conveyor.item.material.emissiveIntensity=.28+Math.sin(now*.004)*.08;}
  }
  if(state.activeArena===2) for (const crane of movingCranes) {
    const modifiers=state.parkour?.variant?.modifiers||{};const machineryScale=modifiers.machineryScale||1;const phaseOffset=modifiers.randomMachinery?(state.parkour.machineryOffset||0):0;
    let offset;
    if(crane.routeTransport){
      const cycle=((now*machineryScale+phaseOffset*1000)%crane.period)/crane.period;
      if(cycle<.25)offset=-crane.range;else if(cycle<.5)offset=THREE.MathUtils.lerp(-crane.range,crane.range,(cycle-.25)/.25);else if(cycle<.75)offset=crane.range;else offset=THREE.MathUtils.lerp(crane.range,-crane.range,(cycle-.75)/.25);
      const stopped=cycle<.25||(cycle>=.5&&cycle<.75);crane.item.material.emissive?.setHex(stopped?PARKOUR_SURFACE_COLORS.boost:PARKOUR_SURFACE_COLORS.moving);crane.item.material.emissiveIntensity=stopped?.42:.16;crane.gates.forEach(gate=>{gate.visible=!stopped;});if(crane.warning){crane.warning.color.setHex(stopped?PARKOUR_SURFACE_COLORS.boost:PARKOUR_SURFACE_COLORS.hazard);crane.warning.intensity=stopped?4.2:1.6;}
    }else offset = Math.sin(now*machineryScale / crane.period * Math.PI * 2 + crane.phase + phaseOffset) * crane.range;
    const nextX=crane.originX+(crane.axis==='x'?offset:0);const nextZ=crane.originZ+(crane.axis==='z'?offset:0);const carry=playerStandingOnSurface(crane.surface);
    if(carry){const carried=movingPlatformCarry(state.position,{x:nextX-crane.lastX,z:nextZ-crane.lastZ});state.position.set(carried.x,carried.y,carried.z);}
    crane.item.position.x=nextX;crane.item.position.z=nextZ;crane.surface.x=nextX;crane.surface.z=nextZ;crane.lastX=nextX;crane.lastZ=nextZ;
    crane.collider.minX = crane.item.position.x - crane.width / 2; crane.collider.maxX = crane.item.position.x + crane.width / 2;
    crane.collider.minZ = crane.item.position.z - crane.depth / 2; crane.collider.maxZ = crane.item.position.z + crane.depth / 2;
  }
  if(state.activeArena===0) for (const block of movingDataBlocks) {
    const rise=(Math.sin(time*1.05+block.phase)+1)/2;
    const wasStanding=playerStandingOnSurface(block.surface);
    block.item.position.y=THREE.MathUtils.lerp(-block.height/2+.15,block.baseY,rise);
    block.item.rotation.y=Math.sin(time*.35+block.phase)*.08;
    block.collider.minY=block.item.position.y-block.height/2; block.collider.maxY=block.item.position.y+block.height/2;
    const nextTop=block.collider.maxY;block.surface.height=nextTop;if(wasStanding)state.position.y+=nextTop-block.lastTop;block.lastTop=nextTop;
  }
  if(state.activeArena===2) for (const platter of assemblyPlatters) {
    platter.item.rotation.y+=.35*(1+platter.phase*.08)*dt;
    const occupied=state.started && state.activeArena===2 && state.onGround && platter.surface.active && Math.hypot(state.position.x-platter.x,state.position.z-platter.z)<platter.radius-.5 && Math.abs(state.position.y-(platter.height+state.eyeHeight))<1.2;
    if (occupied && !platter.occupiedSince) platter.occupiedSince=now;
    if (!occupied && !platter.tipUntil) platter.occupiedSince=0;
    if (occupied && now-platter.occupiedSince>1900 && !platter.tipUntil) { platter.tipUntil=now+1900; platter.surface.active=false; ui.status.textContent='ASSEMBLY PLATTER // TURNOVER'; }
    if (platter.tipUntil) {
      platter.item.rotation.x=THREE.MathUtils.damp(platter.item.rotation.x,1.48,8,dt);
      if (now>=platter.tipUntil) { platter.tipUntil=0; platter.occupiedSince=0; platter.surface.active=true; }
    } else platter.item.rotation.x=THREE.MathUtils.damp(platter.item.rotation.x,0,7,dt);
  }
  if(state.activeArena===2) for (const vent of steamVents) {
    const pulse = .5 + Math.sin(time * 1.8 + vent.phase) * .5;
    vent.cloud.position.y = 3.2 + pulse * 2.8; vent.cloud.scale.set(1.1 + pulse * .8, .6 + pulse * .6, .9 + pulse * .7);
    vent.cloud.material.opacity = .08 + pulse * .22;
  }
  if(state.activeArena===2) mats.lava.emissiveIntensity = 1.7 + Math.sin(time * 3.2) * .45;
}

const enemyDifficultyProfiles=ENEMY_DIFFICULTY_PROFILES;
function enemyHasLineOfSight(enemy, distance, targetPoint = state.position) {
  const origin=enemy.group.position.clone().add(new THREE.Vector3(0,3.65,0));const direction=targetPoint.clone().sub(origin).normalize();
  enemyRaycaster.set(origin,direction);enemyRaycaster.far=Math.max(0,distance-.6);const blocked=enemyRaycaster.intersectObjects(activeOccluders(),false).length>0;enemyRaycaster.far=Infinity;return !blocked;
}
function nearestEnemyDistraction(enemy){
  let choice=null;const consider=(kind,item,height)=>{if(!item)return;const distance=item.group.position.distanceTo(enemy.group.position);if(distance<150&&(!choice||distance<choice.distance))choice={kind,item,height,distance};};
  for(const item of activeDecoys)if(item.arena===state.activeArena)consider('decoy',item,2.7);
  for(const item of thrownExplosives)if(item.gun.special==='redHerring')consider('herring',item,.5);
  for(const item of gnomeTurrets)if(item.health>0&&item.arena===state.activeArena)consider('gnome',item,.55);
  return choice;
}
function selectRobotRival(enemy,now){
  if(state.gameMode==='factoryDefense')return null;
  if(enemy.robotTarget&&!isArmedRobot(enemy.robotTarget))enemy.robotTarget=null;
  if(now<enemy.nextTargetDecisionAt)return enemy.robotTarget;
  enemy.nextTargetDecisionAt=now+2500+Math.random()*1700;
  const rival=nearestRobotRival(enemy,enemies);
  const skirmishTurn=(enemy.index+Math.floor(now/6000))%3===0;
  enemy.robotTarget=rival&&(skirmishTurn||Math.random()<.2)?rival:null;
  return enemy.robotTarget;
}
function damageEnemyFromRobot(target,amount,attacker,now){
  if(!isArmedRobot(target)||target===attacker)return;
  let remaining=amount;
  if(target.shieldHealth>0){const absorbed=Math.min(target.shieldHealth,remaining);target.shieldHealth-=absorbed;remaining-=absorbed;if(target.shield&&target.shieldHealth<=0)target.shield.visible=false;}
  target.health-=remaining;target.lastRivalHitAt=now;
  target.body.material.emissive.setHex(0xff5b3d);target.body.material.emissiveIntensity=.7;
  setTimeout(()=>{if(target.body?.material)target.body.material.emissiveIntensity=0;},90);
  if(target.health<=0)downEnemy(target,false,attacker);
}
function fireEnemyShot(enemy,difficulty,distance,diversion,now,robotTarget=null){
  if(!isArmedRobot(enemy))return false;
  const origin=new THREE.Vector3();enemy.muzzle.getWorldPosition(origin);const direction=enemy.aimDirection.clone();const playerSpeed=robotTarget?0:Math.hypot(state.velocity.x,state.velocity.z);
  let error=aimErrorRadius(difficulty,{distance,targetSpeed:playerSpeed,npcMoving:enemy.isMoving,targetSliding:state.sliding,targetAirborne:!state.onGround,recentlyHurt:now-(enemy.lastHurtAt||0)<900,confidence:enemy.aimConfidence});if(enemy.eliteType==='rusher')error+=distance>28?.1:.02;if(enemy.eliteType==='grappleSniper')error*=.92;if(enemy.eliteType==='scout')error*=1.2;enemy.debugError=error;
  if(diversion)error*=.72;if(robotTarget)error*=1.12;const forcedMiss=!diversion&&shouldForceMiss(difficulty,enemy.consecutiveHits,Math.random());const missSide=((enemy.index+(enemy.ammo||0))%2?1:-1);if(forcedMiss){const lateral=new THREE.Vector3(-direction.z,0,direction.x).normalize();direction.addScaledVector(lateral,Math.max(error,.022)*missSide);}else{direction.x+=(Math.random()-.5)*error;direction.y+=(Math.random()-.5)*error*.75;direction.z+=(Math.random()-.5)*error;}direction.normalize();
  enemyRaycaster.set(origin,direction);enemyRaycaster.far=170;const obstruction=enemyRaycaster.intersectObjects(activeOccluders(),false)[0];enemyRaycaster.far=Infinity;
  const wallDistance=obstruction?origin.distanceTo(obstruction.point):170;const end=obstruction?.point.clone()||origin.clone().addScaledVector(direction,170);addBeam(origin,end,ART_PALETTE.enemyAccent,150);if(obstruction)spawnImpact(obstruction.point,ART_PALETTE.enemyAccent);
  enemy.muzzle.intensity=22;state.lastEnemyShotAt=now;
  let hit=false;
  if(diversion){const target=diversion.item.group.position.clone().add(new THREE.Vector3(0,diversion.height,0));const along=target.clone().sub(origin).dot(direction);const closest=origin.clone().addScaledVector(direction,THREE.MathUtils.clamp(along,0,wallDistance));hit=along>0&&along<wallDistance&&closest.distanceTo(target)<.9;}
  else if(robotTarget){const center=robotTarget.group.position.clone().add(new THREE.Vector3(0,3.05,0));const along=center.clone().sub(origin).dot(direction);const closest=origin.clone().addScaledVector(direction,THREE.MathUtils.clamp(along,0,wallDistance));hit=along>0&&along<wallDistance&&closest.distanceTo(center)<.82;}
  else if(now>=state.spawnGraceUntil){const center=state.position.clone();center.y=state.position.y-state.eyeHeight+.9;const along=center.clone().sub(origin).dot(direction);const closest=origin.clone().addScaledVector(direction,THREE.MathUtils.clamp(along,0,wallDistance));hit=along>0&&along<wallDistance&&closest.distanceTo(center)<.68;}
  if(forcedMiss)hit=false;if(!hit){enemy.consecutiveHits=0;return false;}
  enemy.consecutiveHits++;
  if(diversion){enemy.pingedUntil=now+3000;if(diversion.kind==='gnome'){diversion.item.health-=18;ui.status.textContent='GNOME UNDER FIRE // HOSTILE DISTRACTED';}else if(diversion.kind==='herring')ui.status.textContent='RED HERRING // HOSTILE TOOK THE BAIT';else ui.status.textContent='DECOY HIT // HOSTILE PINGED 3S';}
  else if(robotTarget)damageEnemyFromRobot(robotTarget,Math.max(4,Math.round((difficulty.damageMin+Math.random()*(difficulty.damageMax-difficulty.damageMin))*.78)),enemy,now);
  else damagePlayer(Math.round(difficulty.damageMin+Math.random()*(difficulty.damageMax-difficulty.damageMin)));
  return true;
}

function updateEnemies(time, dt) {
  const now=performance.now();const difficulty=enemyDifficultyProfiles[progress.settings.enemyDifficulty]||enemyDifficultyProfiles.normal;let playerAttackers=0;
  for(const enemy of enemies){
    const debugVisible=progress.settings.aiDebug&&enemy.arena===state.activeArena&&enemy.alive;for(const debugObject of [enemy.debug.line,enemy.debug.vision,enemy.debug.aimRadius,enemy.debug.memory,enemy.debug.sprite])debugObject.visible=debugVisible;if(enemy.arena!==state.activeArena)continue;enemy.muzzle.intensity=THREE.MathUtils.damp(enemy.muzzle.intensity,0,32,dt);enemy.pingShell.visible=now<(enemy.pingedUntil||0);enemy.pingShell.rotation.y+=dt*2.6;if(enemy.laser)enemy.laser.visible=false;
    if(enemy.drone){enemy.drone.group.visible=enemy.alive&&enemy.drone.alive;enemy.drone.group.position.set(enemy.group.position.x+Math.cos(time*1.4+enemy.phase)*3.2,enemy.group.position.y+5.8+Math.sin(time*2)*.4,enemy.group.position.z+Math.sin(time*1.4+enemy.phase)*3.2);enemy.drone.group.rotation.y+=dt*2.4;if(enemy.alive&&state.hostileMode&&enemy.drone.group.position.distanceTo(state.position)<52&&enemyHasLineOfSight(enemy,enemy.group.position.distanceTo(state.position))&&now>(enemy.drone.nextPing||0)){enemy.drone.nextPing=now+3200;state.revealedUntil=now+2200;ui.status.textContent='SCOUT DRONE // POSITION MARKED';}}
    if(!enemy.alive){enemy.aiState=AI_STATES.patrol;enemy.group.rotation.x=THREE.MathUtils.damp(enemy.group.rotation.x,-Math.PI/2,4,dt);continue;}
    enemy.group.rotation.z=THREE.MathUtils.damp(enemy.group.rotation.z,0,6,dt);if(!state.started||state.dead||state.armoryOpen)continue;if(now<(enemy.stunnedUntil||0)||now<(enemy.pinnedUntil||0))continue;
    if(enemy.magazine!==difficulty.magazine){enemy.magazine=difficulty.magazine;enemy.ammo=Math.min(enemy.ammo,difficulty.magazine);}if(updateReload(enemy,difficulty,now)){enemy.visor.material.color.setHex(0xff334f);}const reloading=enemy.aiState===AI_STATES.reload;
    const diversion=nearestEnemyDistraction(enemy);const robotTarget=diversion?null:selectRobotRival(enemy,now);const targetPoint=diversion?diversion.item.group.position.clone().add(new THREE.Vector3(0,diversion.height,0)):robotTarget?robotTarget.group.position.clone().add(new THREE.Vector3(0,3.05,0)):state.position.clone();const flatDelta=targetPoint.clone().sub(enemy.group.position);flatDelta.y=0;const distance=flatDelta.length();
    const heldWeapon=loadout[state.weaponIndex];const shadowStepping=hasPassive('shadow')&&(heldWeapon.effect==='melee'||state.sliding);const glassFangHidden=heldWeapon.special==='glassFang'&&state.crouching;
    const noticeRange=diversion?160:robotTarget?110:now<state.revealedUntil?280:now<state.camoUntil?35:now<(state.mutedUntil||0)?42:glassFangHidden?24:shadowStepping?(state.sliding?18:70):hasPassive('lightweight')?125:190;
    const detectable=state.hostileMode&&distance<noticeRange;
    const eliteReaction=enemy.eliteType==='grappleSniper'?1.35:enemy.eliteType==='rusher'?1.08:1;if(now>=enemy.nextPerceptionAt){enemy.nextPerceptionAt=now+105+enemy.index*13;const previousLos=enemy.hasLineOfSight;enemy.hasLineOfSight=detectable&&enemyHasLineOfSight(enemy,distance,targetPoint);if(enemy.hasLineOfSight){enemy.lastSeenPosition.copy(targetPoint);enemy.lastSeenAt=now;if(!previousLos){enemy.spottedAt=now;const facing=new THREE.Vector3(Math.sin(enemy.group.rotation.y),0,Math.cos(enemy.group.rotation.y));const behind=facing.dot(flatDelta.clone().normalize())<-.25;enemy.reactionEndsAt=now+sampleReactionDelay(difficulty,Math.random(),{behind,far:distance>75,movingFast:Math.hypot(state.velocity.x,state.velocity.z)>13,hurt:now-(enemy.lastHurtAt||0)<800})*eliteReaction;enemy.aiState=AI_STATES.react;enemy.aimConfidence=0;enemy.burstRemaining=0;enemy.visor.material.color.setHex(0xffc857);}}else if(previousLos){enemy.aiState=AI_STATES.search;enemy.burstRemaining=0;enemy.consecutiveHits=0;}}
    const investigating=state.hostileMode&&enemy.lastSeenAt&&now-enemy.lastSeenAt<difficulty.memoryMs;const active=detectable&&(enemy.hasLineOfSight||investigating);
    if(active){
      const navigationPoint=enemy.hasLineOfSight?targetPoint:enemy.lastSeenPosition;const nav=navigationPoint.clone().sub(enemy.group.position);nav.y=0;const navDistance=nav.length()||1;nav.normalize();
      const desiredYaw=Math.atan2(nav.x,nav.z);enemy.group.rotation.y=stepAngle(enemy.group.rotation.y,desiredYaw,difficulty.turnSpeed*dt);const speedScale=now<(enemy.slowUntil||0)?.45:1;enemy.isMoving=false;const preferredRange=enemy.eliteType==='rusher'?8:enemy.eliteType==='grappleSniper'?58:enemy.eliteType==='medic'?34:23;
      if(navDistance>preferredRange&&!(now<enemy.repositionUntil&&Math.random()<.025)){const strafe=(now<enemy.repositionUntil?enemy.strafeDirection:Math.sin(time*.8+enemy.phase))*(distance<70?.62:.2);const moveX=nav.x+nav.z*strafe;const moveZ=nav.z-nav.x*strafe;const nextX=enemy.group.position.x+moveX*enemy.speed*speedScale*dt;const nextZ=enemy.group.position.z+moveZ*enemy.speed*speedScale*dt;if(!actorMoveCollides(enemy,nextX,enemy.group.position.z)){enemy.group.position.x=nextX;enemy.isMoving=true;}if(!actorMoveCollides(enemy,enemy.group.position.x,nextZ)){enemy.group.position.z=nextZ;enemy.isMoving=true;}}
      if(enemy.eliteType==='medic'&&now>(enemy.nextHeal||0)){const patient=enemies.find(other=>other!==enemy&&other.alive&&other.arena===enemy.arena&&other.health<other.maxHealth&&other.group.position.distanceTo(enemy.group.position)<20);if(patient){patient.health=Math.min(patient.maxHealth,patient.health+18);addBeam(enemy.group.position.clone().add(new THREE.Vector3(0,3,0)),patient.group.position.clone().add(new THREE.Vector3(0,3,0)),0x67e8a5,260);enemy.nextHeal=now+3200;}else enemy.nextHeal=now+900;}
      const origin=enemy.group.position.clone().add(new THREE.Vector3(0,3.65,0));const visibleAim=(enemy.hasLineOfSight?targetPoint:enemy.lastSeenPosition).clone();visibleAim.y-=robotTarget?0:.7;const desired=visibleAim.sub(origin).normalize();const currentYaw=Math.atan2(enemy.aimDirection.x,enemy.aimDirection.z),targetAimYaw=Math.atan2(desired.x,desired.z),currentPitch=Math.asin(THREE.MathUtils.clamp(enemy.aimDirection.y,-1,1)),targetPitch=Math.asin(THREE.MathUtils.clamp(desired.y,-1,1)),aimYaw=stepAngle(currentYaw,targetAimYaw,difficulty.turnSpeed*dt),aimPitch=THREE.MathUtils.clamp(targetPitch,currentPitch-difficulty.verticalTurnSpeed*dt,currentPitch+difficulty.verticalTurnSpeed*dt);enemy.aimDirection.set(Math.sin(aimYaw)*Math.cos(aimPitch),Math.sin(aimPitch),Math.cos(aimYaw)*Math.cos(aimPitch)).normalize();enemy.aimConfidence=enemy.hasLineOfSight?Math.min(1,enemy.aimConfidence+dt*(enemy.isMoving?.22:.48)):Math.max(0,enemy.aimConfidence-dt*1.8);
      const reacted=enemy.spottedAt&&now>=enemy.reactionEndsAt&&now>=enemy.spawnAwareAt;const takingCover=enemy.aiState===AI_STATES.takeCover&&now<enemy.repositionUntil;if(enemy.hasLineOfSight&&!reloading&&!takingCover&&reacted&&enemy.aiState!==AI_STATES.fire)enemy.aiState=AI_STATES.aim;else if(!enemy.hasLineOfSight&&!reloading&&!takingCover)enemy.aiState=AI_STATES.investigate;
      const hasAttackSlot=Boolean(diversion||robotTarget||playerAttackers<difficulty.attackerLimit),weaponRange=enemy.eliteType==='rusher'?28:145;const canFire=isArmedRobot(enemy)&&!reloading&&!takingCover&&enemy.ammo>0&&enemy.hasLineOfSight&&distance<weaponRange&&reacted&&hasAttackSlot&&(robotTarget||now>=Math.max(state.spawnGraceUntil,state.aiMercyUntil||0));if(canFire&&!diversion&&!robotTarget)playerAttackers++;if(enemy.laser&&enemy.hasLineOfSight&&enemy.spottedAt&&now>enemy.reactionEndsAt-500)enemy.laser.visible=true;
      if(!reloading&&enemy.ammo<=0){beginReload(enemy,difficulty,now);enemy.visor.material.color.setHex(0x50e5ff);}
      if(canFire&&enemy.burstRemaining===0&&now>=enemy.nextShot&&now>=enemy.recoveryUntil){const burst=enemy.eliteType==='grappleSniper'||enemy.eliteType==='rusher'?1:difficulty.burstMin+Math.floor(Math.random()*(difficulty.burstMax-difficulty.burstMin+1));enemy.burstRemaining=Math.min(enemy.ammo,burst);enemy.burstNextAt=now+170+Math.random()*100;enemy.aiState=AI_STATES.fire;enemy.visor.material.color.setHex(0xffde6a);}
      if(canFire&&enemy.burstRemaining>0&&now>=enemy.burstNextAt){enemy.ammo=Math.max(0,enemy.ammo-1);fireEnemyShot(enemy,difficulty,distance,diversion,now,robotTarget);enemy.burstRemaining--;enemy.burstNextAt=now+difficulty.shotGap+Math.random()*90;if(enemy.ammo<=0){beginReload(enemy,difficulty,now);enemy.visor.material.color.setHex(0x50e5ff);}else if(enemy.burstRemaining===0){enemy.aiState=AI_STATES.aim;const weaponPause=enemy.eliteType==='grappleSniper'?1200:enemy.eliteType==='rusher'?700:0;enemy.recoveryUntil=now+weaponPause+difficulty.pauseMin+Math.random()*(difficulty.pauseMax-difficulty.pauseMin);enemy.nextShot=enemy.recoveryUntil;enemy.repositionUntil=now+500+Math.random()*900;if(Math.random()<.55)enemy.strafeDirection*=-1;enemy.visor.material.color.setHex(0xff334f);}}
    }else{
      if(!investigating){enemy.spottedAt=0;enemy.burstRemaining=0;enemy.aiState=reloading?AI_STATES.reload:AI_STATES.patrol;enemy.visor.material.color.setHex(reloading?0x50e5ff:0xff334f);}else if(!reloading)enemy.aiState=AI_STATES.search;const patrolX=enemy.spawn.x+Math.cos(time*.16+enemy.phase)*10;const patrolZ=enemy.spawn.z+Math.sin(time*.16+enemy.phase)*10;const dx=patrolX-enemy.group.position.x;const dz=patrolZ-enemy.group.position.z;enemy.group.rotation.y=stepAngle(enemy.group.rotation.y,Math.atan2(dx,dz),difficulty.turnSpeed*.45*dt);const length=Math.hypot(dx,dz)||1;const nextX=enemy.group.position.x+dx/length*enemy.speed*.35*dt;const nextZ=enemy.group.position.z+dz/length*enemy.speed*.35*dt;if(!actorMoveCollides(enemy,nextX,enemy.group.position.z))enemy.group.position.x=nextX;if(!actorMoveCollides(enemy,enemy.group.position.x,nextZ))enemy.group.position.z=nextZ;
    }
    enemy.weaponMount.rotation.z=THREE.MathUtils.damp(enemy.weaponMount.rotation.z,enemy.aiState===AI_STATES.reload?-.75:0,8,dt);updateAiDebugHelper(enemy,enemy.hasLineOfSight?targetPoint:enemy.lastSeenPosition);
    const gait=enemy.isMoving?Math.sin(time*7.2+enemy.phase)*.46:0;
    enemy.leftLegPivot.rotation.x=THREE.MathUtils.damp(enemy.leftLegPivot.rotation.x,gait,9,dt);enemy.rightLegPivot.rotation.x=THREE.MathUtils.damp(enemy.rightLegPivot.rotation.x,-gait,9,dt);
    enemy.leftArm.rotation.x=THREE.MathUtils.damp(enemy.leftArm.rotation.x,-.3-gait*.45,8,dt);enemy.rightArm.rotation.x=THREE.MathUtils.damp(enemy.rightArm.rotation.x,-.5+gait*.32,8,dt);
    enemy.torsoPivot.position.y=3.38+(enemy.isMoving?Math.abs(Math.sin(time*7.2+enemy.phase))*.05:Math.sin(time*1.5+enemy.phase)*.018);
    enemy.headPivot.rotation.y=THREE.MathUtils.damp(enemy.headPivot.rotation.y,enemy.hasLineOfSight?Math.sin(time*.7+enemy.phase)*.06:Math.sin(time*.35+enemy.phase)*.16,5,dt);
  }
  separateActiveActors();
}

function damagePlayer(amount) {
  if (state.dead) return;
  const now=performance.now(); state.lastDamageAt=now;if(amount>=18)state.aiMercyUntil=Math.max(state.aiMercyUntil||0,now+420);if(amount>=22)breakMovementCombo('HEAVY DAMAGE');
  if(now<state.saberGuardUntil&&now>=state.saberCooldownUntil){state.saberGuardUntil=0;state.saberCooldownUntil=now+2400;createPulseBlast(state.position,5,0xe7ff57);ui.status.textContent='SIGNAL SABER // PROJECTILE DEFLECTED';return;}
  const shieldBefore = state.shield;
  const shieldDamage = Math.min(state.shield, amount); state.shield -= shieldDamage;
  state.health = Math.max(0, state.health - (amount - shieldDamage)); updateVitals();
  ui.damageFlash.classList.remove('show'); void ui.damageFlash.offsetWidth; ui.damageFlash.classList.add('show');
  state.shake=Math.max(state.shake,state.aiming?(hasPassive('resilience') ? .044 : .11):.075);
  ui.status.textContent = `TAKING FIRE // ${state.health} HEALTH`;
  if (shieldBefore > 0 && state.shield <= 0 && hasPassive('rebound') && !state.reboundTriggered) triggerReboundShield();
  if (state.health <= 0) playerDeath();
}

function updateShieldRegeneration(dt,now) {
  if (!state.started || state.dead || state.shield>=50 || now-state.lastDamageAt<5000) return;
  state.shield=Math.min(50,state.shield+8*dt); updateVitals();
  if (state.shield>0) state.reboundTriggered=false;
}

function triggerReboundShield() {
  state.reboundTriggered = true; const now = performance.now(); const radius = 13;
  for (const enemy of enemies) {
    if (!enemy.alive || enemy.arena !== state.activeArena) continue;
    const push = enemy.group.position.clone().sub(state.position); push.y = 0; const distance = push.length(); if (!distance || distance > radius) continue;
    const destination = enemy.group.position.clone().addScaledVector(push.normalize(), 10 * (1 - distance / (radius * 1.4)));
    if (!collides(destination.x,destination.z)) enemy.group.position.copy(destination); enemy.stunnedUntil = now + 800;
  }
  const blast = new THREE.Mesh(new THREE.SphereGeometry(1,18,12),new THREE.MeshBasicMaterial({color:0x50e5ff,wireframe:true,transparent:true,opacity:.9}));
  blast.position.copy(state.position).add(new THREE.Vector3(0,-state.eyeHeight+.6,0)); world.add(blast); queueBlast(blast,radius);
  ui.status.textContent = 'REBOUND SHIELD // KINETIC PUSH';
}

function playerDeath() {
  state.dead = true;state.vault=null;clearTraversalInput();resetWeaponVisualAnimation(loadout[state.weaponIndex]);state.abilityVisual=null;delete document.body.dataset.abilityVisual;delete document.body.dataset.abilityPhase;state.softMouseLook=false;state.locked=false;ui.mouseLockGate?.classList.add('hidden');document.body.classList.remove('mouse-locked');breakMovementCombo('OPERATOR DOWN');state.matchDeaths++; progress.stats.deaths++; saveProgress(); state.mouseDown = false; state.camoUntil = 0; releaseGrapple(); removeRewindAnchor(); setAiming(false); keys.clear(); document.exitPointerLock();
  ui.deathKills.textContent = state.enemyKills; ui.deathCash.textContent = `$${progress.cash}`;
  ui.death.classList.remove('hidden'); ui.interaction.classList.remove('show');
}

function redeployPlayer() {
  state.dead = false; state.health = 100; state.shield = 50; state.lastDamageAt=0; state.spawnGraceUntil=performance.now()+3000; state.reboundTriggered = false; state.camoUntil = 0; state.healRemaining = 0; state.speedBoostUntil = 0; state.eyeHeight = 1.75; state.crouching = false; state.sliding = false;
  state.position.copy(arenaDefinitions[state.activeArena].spawn); state.position.y = groundHeightAt(state.position.x, state.position.z) + state.eyeHeight; state.velocity.set(0, 0, 0);
  state.hostileMode = false; ui.modeName.textContent = 'PEACEFUL'; ui.modeDisplay.classList.remove('hostile'); ui.modeDisplay.classList.add('peaceful');
  updateVitals(); ui.death.classList.add('hidden');
  enemies.forEach((enemy, index) => {
    if (enemy.respawnTimer) clearTimeout(enemy.respawnTimer); enemy.respawnTimer = null;
    const profile=enemyDifficultyProfiles[progress.settings.enemyDifficulty]||enemyDifficultyProfiles.normal,now=performance.now();enemy.group.position.copy(enemySpawns[index]); enemy.group.rotation.set(0, 0, 0); enemy.health = enemy.maxHealth||140; enemy.alive = true; enemy.pingedUntil = 0; enemy.pingShell.visible = false; enemy.nextShot = now + 1800 + index * 180;enemy.spottedAt=0;enemy.lastSeenAt=0;enemy.hasLineOfSight=false;enemy.burstRemaining=0;enemy.robotTarget=null;enemy.nextTargetDecisionAt=0;enemy.aiState=AI_STATES.patrol;enemy.magazine=profile.magazine;enemy.ammo=profile.magazine;enemy.reloadEndsAt=0;enemy.reactionEndsAt=0;enemy.aimConfidence=0;enemy.consecutiveHits=0;enemy.spawnAwareAt=now+profile.spawnAwarenessMs;if(enemy.shield){enemy.shieldHealth=180;enemy.shield.visible=true;}if(enemy.drone)enemy.drone.alive=true;
    ui.enemyBlips[index].classList.remove('down');
  });
  state.hostiles = enemies.filter(enemy=>enemy.arena===state.activeArena).length; ui.enemies.textContent = String(state.hostiles).padStart(2, '0');
  const gun = loadout[state.weaponIndex]; gun.ammo = gun.magSize; gun.reserve = gun.maxReserve; updateAmmo();
  ui.status.textContent = 'REDEPLOYED // CLICK TO CONTROL'; showMouseLockGate();
}

ui.redeploy.addEventListener('click', redeployPlayer);

function removeAcousticWave(wave) {
  const index = acousticWaves.indexOf(wave); if (index >= 0) acousticWaves.splice(index,1);
  world.remove(wave.mesh); wave.mesh.geometry.dispose(); wave.mesh.material.dispose();
}

function pointToSegmentDistance(point, a, b) {
  const ab = b.clone().sub(a); const lengthSq = ab.lengthSq();
  if (!lengthSq) return point.distanceTo(a);
  const t = THREE.MathUtils.clamp(point.clone().sub(a).dot(ab) / lengthSq, 0, 1);
  return point.distanceTo(a.clone().addScaledVector(ab,t));
}

function updateAcousticWaves(dt) {
  for (const wave of [...acousticWaves]) {
    let next = wave.mesh.position.clone().addScaledVector(wave.velocity,dt);
    const collider = colliders.find(item => item.active && next.x>item.minX && next.x<item.maxX && next.z>item.minZ && next.z<item.maxZ && next.y>item.minY-.5 && next.y<item.maxY+.5);
    if (collider) {
      if (wave.bounces >= 2) { removeAcousticWave(wave); continue; }
      const distances = [Math.abs(next.x-collider.minX),Math.abs(next.x-collider.maxX),Math.abs(next.z-collider.minZ),Math.abs(next.z-collider.maxZ)];
      const side = distances.indexOf(Math.min(...distances));
      if (side < 2) wave.velocity.x *= -1; else wave.velocity.z *= -1;
      wave.bounces++; next = wave.mesh.position.clone().addScaledVector(wave.velocity,dt*.4);
      wave.mesh.material.color.setHex(wave.bounces === 2 ? 0xff6338 : 0xe7ff57);
    }
    wave.mesh.position.copy(next); wave.distance += wave.velocity.length()*dt; wave.mesh.scale.setScalar(1 + wave.distance*.055);
    for (const target of [...dummies,...enemies]) {
      if (!target.alive || wave.hitTargets.has(target)) continue;
      const targetPoint = target.group.position.clone().add(new THREE.Vector3(0,target.kind==='enemy'?2.8:4.5,0));
      if (targetPoint.distanceTo(wave.mesh.position) > 1.4 + wave.distance*.06) continue;
      wave.hitTargets.add(target); damageTarget(target,Math.min(40,20+wave.bounces*10));
      if (wave.bounces >= 2 && target.kind === 'enemy') target.slowUntil = performance.now()+1500;
      removeAcousticWave(wave); break;
    }
    if (wave.distance >= 12 && acousticWaves.includes(wave)) removeAcousticWave(wave);
  }
}

function updateMagnetLinks() {
  const now = performance.now();
  for (const link of [...magnetLinks]) {
    const aPosition = endpointPosition(link.a); const bPosition = endpointPosition(link.b); const midpoint = aPosition.clone().add(bPosition).multiplyScalar(.5);
    if (link.a.target?.alive) link.a.target.group.position.lerp(link.b.target?.alive ? midpoint : bPosition, .13);
    if (link.b.target?.alive) link.b.target.group.position.lerp(link.a.target?.alive ? midpoint : aPosition, .13);
    link.line.geometry.setFromPoints([endpointPosition(link.a),endpointPosition(link.b)]);
    if (now-link.started < link.duration) continue;
    for (const endpoint of [link.a,link.b]) {
      if (!endpoint.target?.alive) continue;
      if (link.a.target && link.b.target) damageTarget(endpoint.target,50);
      else endpoint.target.pinnedUntil = now+2000;
    }
    world.remove(link.line); link.line.geometry.dispose(); link.line.material.dispose(); magnetLinks.splice(magnetLinks.indexOf(link),1);
  }
}

function updateWireTraps() {
  const now = performance.now();
  for (const wire of activeWires) {
    for (const enemy of enemies) {
      if (!enemy.alive || enemy.arena !== state.activeArena || now < (wire.triggered.get(enemy)||0)) continue;
      const point = enemy.group.position.clone().add(new THREE.Vector3(0,1.5,0));
      if (pointToSegmentDistance(point,wire.a.point,wire.b.point) > 1.1) continue;
      wire.triggered.set(enemy,now+3200); enemy.stunnedUntil=now+850; enemy.slowUntil=now+3000; damageTarget(enemy,15);
      ui.status.textContent='WIRE TRAP // HOSTILE TRIPPED';
    }
  }
}

function updateRegeneratingAmmo(now) {
  for (const gun of loadout) {
    if (!gun.regeneration || gun.ammo >= gun.magSize) continue;
    gun.lastRegeneration ||= now;
    if (now-gun.lastRegeneration < gun.regeneration) continue;
    gun.ammo++; gun.lastRegeneration=now;
    if (gun===loadout[state.weaponIndex]) { updateAmmo(); ui.status.textContent=`VOID CHARGE REGENERATED // ${gun.ammo}`; }
  }
}

function updateExperimentalSystems(dt) {
  updateAcousticWaves(dt); updateMagnetLinks(); updateWireTraps(); updateThrownExplosives(dt); updateThrowTrajectory(); updateUtilitySystems(dt); updateChaosSystems(dt);
  const now=performance.now();for(const mark of [...fractureMarks]){mark.mesh.rotation.x+=dt*2.2;mark.mesh.rotation.y+=dt*3.1;mark.mesh.material.opacity=.55+Math.sin(now*.012)*.32;if(now>=mark.expires||mark.target&&!mark.target.alive)removeFractureMark(mark);}
}

function updateRadar(now=performance.now()) {
  const placeBlip = (target, blip) => {
    const active=target.arena===state.activeArena; blip.style.display=active?'':'none'; if(!active) return;
    const scale = 136 / 700;
    blip.style.left = `${68 + THREE.MathUtils.clamp((target.group.position.x-state.position.x) * scale, -62, 62)}px`;
    blip.style.top = `${68 + THREE.MathUtils.clamp((target.group.position.z-state.position.z) * scale, -62, 62)}px`;
  };
  dummies.forEach((dummy, i) => placeBlip(dummy, ui.blips[i]));
  enemies.forEach((enemy, i) => { placeBlip(enemy, ui.enemyBlips[i]); ui.enemyBlips[i].classList.toggle('pinged', now < (enemy.pingedUntil || 0)); });
  ui.radarPlayer.style.transform = `translate(-50%,-50%) rotate(${-state.yaw}rad)`;
}

let lastUiFrame=0;
let performanceWindowStart=performance.now();
let performanceFrameCount=0;
let fastPerformanceWindows=0;
let measuredFps=0;
let renderPaused=false;
function tuneRenderQuality(now) {
  performanceFrameCount++;
  const elapsed=now-performanceWindowStart; if(elapsed<2200) return;
  const fps=performanceFrameCount*1000/elapsed;
  measuredFps=measuredFps?THREE.MathUtils.lerp(measuredFps,fps,.45):fps;if(ui.fpsDisplay&&progress.settings.showFps)ui.fpsDisplay.textContent=`${Math.round(measuredFps)} FPS // ${renderPixelRatio.toFixed(2)}× // ${renderer.info.render.calls} DC`;
  if(!progress.settings.adaptiveQuality){performanceWindowStart=now;performanceFrameCount=0;return;}
  const pixelRatioMaximum=configuredPixelRatioMaximum();
  const pixelRatioMinimum=progress.settings.graphicsQuality==='low'?.48:progress.settings.graphicsQuality==='medium'?.58:.7;
  if(renderPixelRatio>pixelRatioMaximum){renderPixelRatio=pixelRatioMaximum;renderer.setPixelRatio(renderPixelRatio);composer.setPixelRatio(renderPixelRatio);}
  if(fps<48&&renderPixelRatio>pixelRatioMinimum){renderPixelRatio=Math.max(pixelRatioMinimum,renderPixelRatio-.14);renderer.setPixelRatio(renderPixelRatio);composer.setPixelRatio(renderPixelRatio);fastPerformanceWindows=0;}
  else if(fps>58&&renderPixelRatio<pixelRatioMaximum){fastPerformanceWindows++;if(fastPerformanceWindows>=3){renderPixelRatio=Math.min(pixelRatioMaximum,renderPixelRatio+.08);renderer.setPixelRatio(renderPixelRatio);composer.setPixelRatio(renderPixelRatio);fastPerformanceWindows=0;}}
  else fastPerformanceWindows=0;
  performanceWindowStart=now; performanceFrameCount=0;
}

function animate() {
  if(!renderPaused)requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), .05);
  const time = clock.elapsedTime;
  const now = performance.now();
  if(!state.started){renderLobbyPreview(time,dt);return;}
  const currentGun = loadout[state.weaponIndex];weapon.rotation.x=THREE.MathUtils.damp(weapon.rotation.x,-.035,18,dt);weapon.rotation.z=THREE.MathUtils.damp(weapon.rotation.z,currentGun.kind==='pistol'?.07:0,10,dt);
  sky.position.copy(camera.position);tuneRenderQuality(now);updateTemporaryBeams(now);updatePooledEffects(dt);updateAimPresentation(dt);
  const onlineMode=state.gameMode==='multiplayer';
  if(onlineMode)updateOnlineMatch(now,dt);
  const simulationActive=!state.countdownActive&&!state.completed&&!state.armoryOpen&&!state.dead;
  const visualActive=!state.completed&&!state.armoryOpen&&!state.dead;
  if(visualActive)updateArenaEnvironment(time,now,dt);
  if(simulationActive&&!onlineMode){updateAbilitySystems(dt,now);updateShieldRegeneration(dt,now);updateTraversalObstacles(now,dt);updatePlayer(dt);updateParkour(now,dt);updateLobbyParkour(now,dt);}
  if(simulationActive&&state.mouseDown&&state.locked&&currentGun.automatic){let catchUpShots=0;while(now-state.lastShot>=currentGun.fireRate&&catchUpShots<3){const previousShot=state.lastShot;fire(Math.max(state.lastShot+currentGun.fireRate,now-currentGun.fireRate*2));if(state.lastShot===previousShot)break;catchUpShots++;}}
  if(visualActive&&!onlineMode){updateDummies(time,dt);updateLootCrates(time);updateWorldSystems(time,now,dt);}
  if(simulationActive&&!onlineMode){updateEnemies(time,dt);updateExperimentalSystems(dt);updateMovementCombo(now);updateFactoryDefense(now);}
  if(now-lastUiFrame>=100){lastUiFrame=now;updateContractClock(now);if(state.firingRange)updateFiringRangeHUD();if(!onlineMode){refreshAbilityHUD(now);updateRegeneratingAmmo(now);updateHotbarIndicators(now);updateLootInteraction();updateRadar(now);updateMapDiscoveries(now);}}
  updateScopeDebugOverlay(currentGun);
  updateWeaponMechanicalAnimation(currentGun,now);
  updateAnimatedWeaponSkin(now);
  currentGun.model.userData.muzzle.intensity = THREE.MathUtils.damp(currentGun.model.userData.muzzle.intensity, 0, 38, dt);
  currentGun.model.userData.flash.material.opacity = THREE.MathUtils.damp(currentGun.model.userData.flash.material.opacity, 0, 45, dt);
  if(bloomPass.enabled)composer.render();else renderer.render(scene, camera);
}

camera.position.copy(state.position);
applyEquippedCosmetics();
applySettings();
initLobbyPreview();
updateAmmo();
updateQuickSlotUI();
updateCashUI();
renderBuildSelection();
renderLobbySummary();
renderFeaturedWeapon();
renderChallenges();
renderProfile();
renderCollectionBook();
renderFactoryPanel();
ui.targets.textContent = String(state.targets).padStart(2, '0');
ui.enemies.textContent = String(state.hostiles).padStart(2, '0');
syncArenaVisibility(state.activeArena);
if(new URLSearchParams(location.search).has('diagnostics')){
  const diagnosticParams=new URLSearchParams(location.search);
  const collisionChecks=()=>{
    const platform=platformSurfaces.find(surface=>surface.arena===state.activeArena&&surface.type==='rect'&&surface.collider&&surface.height>4&&surface.mesh?.visible!==false);
    const ramp=platformSurfaces.find(surface=>surface.arena===state.activeArena&&['ramp','orientedRamp'].includes(surface.type)&&surface.active!==false);
    const wall=colliders.find(collider=>colliderIsActive(collider)&&collider.minY<=.1&&collider.maxY>=4&&Math.min(collider.maxX-collider.minX,collider.maxZ-collider.minZ)<5);
    if(!platform)return{available:false};
    const underFeet=platform.height-3;const underside=platform.collider.minY;const rampSamples=[];if(ramp)for(let index=0;index<=10;index++){const along=(index/10-.5)*ramp.length;const x=ramp.type==='ramp'?(ramp.axis==='x'?ramp.x+along:ramp.x):ramp.x+Math.sin(ramp.angle)*along;const z=ramp.type==='ramp'?(ramp.axis==='z'?ramp.z+along:ramp.z):ramp.z+Math.cos(ramp.angle)*along;rampSamples.push(surfaceHeightAt(ramp,x,z));}
    let highSpeedWallBlocked=false;if(wall){const alongX=wall.maxX-wall.minX<wall.maxZ-wall.minZ;const fixedX=(wall.minX+wall.maxX)/2;const fixedZ=(wall.minZ+wall.maxZ)/2;const start=alongX?wall.minX-2:wall.minZ-2;const end=alongX?wall.maxX+2:wall.maxZ+2;for(let point=start;point<=end;point+=.32)if(playerCollidesAt(alongX?point:fixedX,alongX?fixedZ:point,Math.max(1.75,wall.minY+1.2))){highSpeedWallBlocked=true;break;}}
    return{arena:arenaDefinitions[state.activeArena].id,available:true,underPlatformGround:groundHeightAt(platform.x,platform.z,underFeet+MAX_STEP_HEIGHT),platformTop:platform.height,underPlatformPreserved:groundHeightAt(platform.x,platform.z,underFeet+MAX_STEP_HEIGHT)<platform.height,ceilingStops:Math.abs(ceilingHeightForSweep(platform.x,platform.z,underside-.8,underside+.4)-underside)<.001,topLandingSurface:groundHeightAt(platform.x,platform.z,platform.height+.1),edgeDrops:surfaceHeightAt(platform,platform.x+platform.w/2+1,platform.z)===null,rampContinuous:rampSamples.every((height,index)=>height!==null&&(index===0||Math.abs(height-rampSamples[index-1])<=Math.abs(ramp.endHeight-ramp.startHeight)/10+.02)),highSpeedWallBlocked,movingSurfaceRegistered:platformSurfaces.some(surface=>surface.arena===state.activeArena&&surface.dynamic&&surface.mesh?.visible!==false),coveredRampRegistered:platformSurfaces.some(surface=>surface.arena===state.activeArena&&surface.covered),overheadColliderRegistered:colliders.some(collider=>colliderIsActive(collider)&&collider.minY>2)};
  };
  const routeClearance=(start,end)=>{
    const samples=sampleSegment({x:start[0],z:start[1]},{x:end[0],z:end[1]},.38);let minimumSupport=Infinity;const blocked=[];
    for(const point of samples){const support=groundHeightAt(point.x,point.z,6);minimumSupport=Math.min(minimumSupport,support);if(support<3.85||playerCollidesAt(point.x,point.z,support+1.75)){const capsule={x:point.x,z:point.z,radius:PLAYER_RADIUS,feet:support,head:support+1.75+PLAYER_HEAD_CLEARANCE};const reasons=colliders.filter(collider=>colliderIsActive(collider)&&capsuleIntersectsAabb(capsule,collider)).slice(0,3).map(collider=>collider.mesh?.userData?.hubRoom||collider.mesh?.userData?.upperFloor||collider.mesh?.userData?.secretRoute||`${collider.kind}:${Number(collider.minX.toFixed(1))},${Number(collider.minZ.toFixed(1))}`);if(!reasons.length&&coveredRampCollision(point.x,point.z))reasons.push('covered-ramp');if(!reasons.length&&outsidePlayableBounds(point.x,point.z))reasons.push('world-bounds');blocked.push([Number(point.x.toFixed(2)),Number(point.z.toFixed(2)),Number(support.toFixed(2)),...reasons]);}}
    return{clear:blocked.length===0,minimumSupport,blocked:blocked.slice(0,5),samples:samples.length};
  };
  const hubRouteChecks=()=>({
    connections:HUB_CONNECTIONS.map(connection=>{const [x,,z]=connection.position,[w,,d]=connection.size;const alongX=connection.axis?connection.axis==='x':w>d;const inset=1.1;return{id:connection.id,...routeClearance(alongX?[x-w/2+inset,z]:[x,z-d/2+inset],alongX?[x+w/2-inset,z]:[x,z+d/2-inset])};}),
    parkourAccess:HUB_PARKOUR_PORTALS.map(portal=>{const atrium=routeClearance([CHILL_DECK_LAYOUT.crossroads[0],CHILL_DECK_LAYOUT.crossroads[2]],[CHILL_DECK_LAYOUT.courseSpawn[0],CHILL_DECK_LAYOUT.crossroads[2]]);const staging=routeClearance([CHILL_DECK_LAYOUT.courseSpawn[0],CHILL_DECK_LAYOUT.crossroads[2]],[CHILL_DECK_LAYOUT.courseSpawn[0],CHILL_DECK_LAYOUT.concourseZ]);const concourse=routeClearance([CHILL_DECK_LAYOUT.courseSpawn[0],CHILL_DECK_LAYOUT.concourseZ],[portal.x,CHILL_DECK_LAYOUT.concourseZ]);return{id:PARKOUR_COURSES[portal.courseIndex].id,clear:atrium.clear&&staging.clear&&concourse.clear,minimumSupport:Math.min(atrium.minimumSupport,staging.minimumSupport,concourse.minimumSupport),blocked:[...atrium.blocked,...staging.blocked,...concourse.blocked].slice(0,5),samples:atrium.samples+staging.samples+concourse.samples};}),
  });
  Object.defineProperty(globalThis,'__resonanceDiagnostics',{configurable:true,value:{
    snapshot:()=>({position:state.position.toArray(),velocity:state.velocity.toArray(),onGround:state.onGround,vaulting:Boolean(state.vault),mode:state.gameMode,weapon:loadout[state.weaponIndex].id,aiming:state.aiming,aimProfile:state.aimProfile,fov:camera.fov,mouseLook:state.locked,inputMode:document.pointerLockElement===canvas?'pointer-lock':state.softMouseLook?'fallback':'released',fps:measuredFps,drawCalls:renderer.info.render.calls,difficulty:progress.settings.enemyDifficulty}),
    graphics:()=>{const materials=new Set();let meshes=0,instances=0,shadowCasters=0;scene.traverse(object=>{if(object.isMesh){meshes++;if(Array.isArray(object.material))object.material.forEach(material=>materials.add(material));else if(object.material)materials.add(object.material);if(object.isInstancedMesh)instances+=object.count;if(object.castShadow)shadowCasters++;}});return{quality:progress.settings.graphicsQuality,bloom:bloomPass.enabled,pixelRatio:renderPixelRatio,meshes,materials:materials.size,instances,shadowCasters,drawCalls:renderer.info.render.calls,triangles:renderer.info.render.triangles,pools:{tracers:tracerPool.length,casings:casingPool.length,impacts:impactPool.length,killFx:killFxPool.length}};},
    weaponVisuals:()=>loadout.map(gun=>{const definition=gun.model.userData.visualDefinition;const componentRoles=new Set(),materialZones=new Set();let details=0,visibleDetails=0;gun.model.traverse(child=>{if(child.userData?.weaponComponent)componentRoles.add(child.userData.weaponComponent);if(child.userData?.materialZone)materialZones.add(child.userData.materialZone);if(child.userData?.weaponDetailLevel!==undefined){details++;if(child.visible)visibleDetails++;}});return{id:gun.id,kind:gun.kind,parts:gun.model.children.filter(child=>child.isMesh).length,attachments:Object.keys(gun.model.userData.attachmentPoints||{}),sockets:Object.keys(gun.model.userData.attachmentSockets||{}),muzzle:gun.model.getObjectByName(gun.model.userData.attachmentPoints?.muzzle||'muzzle-anchor')?.position.toArray()||null,sight:gun.model.getObjectByName(gun.model.userData.attachmentPoints?.sight||'sight-anchor')?.position.toArray()||null,signature:definition?.signature,fingerprint:definition?.fingerprint,receiverStyle:definition?.receiverStyle,barrelStyle:definition?.barrelStyle,magazineStyle:definition?.magazineStyle,opticStyle:definition?.opticStyle,specialParts:definition?.specialParts||[],componentRoles:[...componentRoles],materialZones:[...materialZones],details,visibleDetails,meleeStyle:definition?.meleeStyle,mechanicalAction:definition?.animationProfile?.mechanicalAction,animationState:gun.model.userData.visualAnimation?.state,materialProfile:definition?.materialProfile,soundProfile:definition?.soundProfile};}),
    scopeProfiles:()=>loadout.map(gun=>{const definition=gun.model.userData.visualDefinition;const sight=gun.model.getObjectByName(gun.model.userData.attachmentPoints?.sight||'sight-anchor');const ads=[...adsPositionForGun(gun)];gun.model.updateMatrix();const offset=sight?new THREE.Vector3().copy(sight.position).applyMatrix4(gun.model.matrix).applyQuaternion(weapon.quaternion):new THREE.Vector3();const transitionVisibility=[0,.01,.12,.44,1].map(blend=>scopeDecorationVisibility(definition?.scopeProfile,true,blend));let lensCount=0,opaqueLensCount=0,openHousingCount=0;gun.model.traverse(child=>{if(child.userData?.scopeLens){lensCount++;if(!child.material?.transparent||child.material.opacity>=.2||child.material.depthWrite)opaqueLensCount++;}if(child.userData?.scopeHousing&&child.userData?.openEnded)openHousingCount++;});return{id:gun.id,type:definition?.scopeProfile?.type,opticStyle:definition?.opticStyle,magnification:definition?.scopeProfile?.magnification,sightAnchor:sight?.position.toArray()||null,ads,centerError:Math.hypot(ads[0]+offset.x,ads[1]+offset.y),eyeReliefError:Math.abs(ads[2]+offset.z+(definition?.scopeProfile?.eyeRelief||.42)),blocksCenter:Boolean(definition?.scopeProfile?.blocksCenter),clearAperture:Boolean(definition?.scopeProfile?.clearAperture),lensCount,opaqueLensCount,openHousingCount,visibility:transitionVisibility.at(-1),transitionVisibility};}),
    visualSystems:()=>({quality:qualityVisualFallback(progress.settings.graphicsQuality),crateProfiles:CRATE_VISUAL_PROFILES,effectProfiles:EFFECT_PROFILES,abilityProfiles:ABILITY_VISUAL_PROFILES,activeCrateStage:ui.caseStage?.dataset.visualStage||'idle',activeAbility:state.abilityVisual?{id:state.abilityVisual.id,phase:state.abilityVisual.phase}:null,activeKillFx:killFxPool.filter(effect=>effect.group.visible).map(effect=>({mode:effect.mode,phase:effect.phase,budget:effect.budget}))}),
    startVisualValidation:()=>{startDeployment('main');if(state.countdownTimer){clearInterval(state.countdownTimer);state.countdownTimer=null;}state.countdownActive=false;state.locked=true;ui.countdown.classList.add('hidden');ui.mouseLockGate?.classList.add('hidden');updateAimPresentation(.25);return{started:state.started,mode:state.gameMode,arena:arenaDefinitions[state.activeArena].id,weapon:loadout[state.weaponIndex].id};},
    setScopeDebug:(active=true)=>{progress.settings.scopeDebug=Boolean(active);applySettings();return progress.settings.scopeDebug;},
    testWeaponAnimation:(id,name='fire',sampleProgress=.5)=>{const index=loadout.findIndex(gun=>gun.id===id);if(index<0)return null;progress.unlocked.add(id);switchWeapon(index,false);const gun=loadout[index];const definition=gun.model.userData.visualDefinition;const duration=definition.animationProfile.timings[name]||definition.animationProfile.timings.mechanical||180;const now=performance.now();beginWeaponVisualAnimation(gun,name,duration,now-duration*THREE.MathUtils.clamp(sampleProgress,0,1));updateWeaponMechanicalAnimation(gun,now);const parts=gun.model.userData.mechanicalParts;return{id,state:gun.model.userData.visualAnimation.state,action:definition.animationProfile.mechanicalAction,actionPosition:parts.action?.position.toArray()||null,actionRotation:parts.action?.rotation.toArray()||null,triggerRotation:parts.trigger?.rotation.toArray()||null,chargingHandle:parts.chargingHandle?.position.toArray()||null};},
    previewVisualEffect:(effectId='neon-echo-fx')=>{const item=cosmeticById(effectId);const point=state.position.clone().add(new THREE.Vector3(0,-state.eyeHeight+.15,-4));const played=triggerKillFx(item,point,`diagnostic-${effectId}-${performance.now()}`,{preview:true});updatePooledEffects(.016);return{played,active:killFxPool.filter(effect=>effect.group.visible).map(effect=>({mode:effect.mode,phase:effect.phase,budget:effect.budget,duration:effect.duration}))};},
    setGraphicsQuality:(quality)=>{if(!QUALITY_PRESETS[quality])return false;progress.settings.graphicsQuality=quality;applySettings();return true;},
    pauseRendering:()=>{renderPaused=true;return true;},
    resumeRendering:()=>{if(renderPaused){renderPaused=false;clock.getDelta();requestAnimationFrame(animate);}return true;},
    systems:()=>({combo:{score:movementCombo.score,tier:movementCombo.tier,name:comboTiers[movementCombo.tier].name},mastery:masteryProgress(loadout[state.weaponIndex]),fragments:progress.blueprintFragments,destructible:{total:destructibleCover.length,active:destructibleCover.filter(cover=>!cover.destroyed).length},pickups:weaponPickupStations.length,controls:environmentalControls.length,elites:enemies.filter(enemy=>enemy.eliteType).map(enemy=>enemy.eliteName),ai:{shooters:enemies.filter(isArmedRobot).length,robotRoles:[...new Set(enemies.map(enemy=>enemy.combatRole))],targetRoles:[...new Set(dummies.map(dummy=>dummy.combatRole))],armedTargets:dummies.filter(dummy=>dummy.canShoot).length,difficulty:{...enemyDifficultyProfiles[progress.settings.enemyDifficulty]}},collectionCards:ui.collectionGrid?.children.length||0,factory:{...progress.factory},mode:state.gameMode}),
    seedCosmeticPreview:()=>{progress.cash=10000;progress.cosmeticState=createCosmeticProgress({owned:['vertigo-phantom-skin','floating-city-charm','cyan-laser-tracer','neon-echo-fx'],equippedSkins:{sledge:'vertigo-phantom-skin'},equippedCharm:'floating-city-charm',equippedTracer:'cyan-laser-tracer',equippedKillFx:'neon-echo-fx',shards:160,kitKeys:1,mapVaultKeys:1,pity:{standard:7,neon:3,kit:0,mapVault:4,silly:11},favorites:['vertigo-phantom-skin'],newItems:['neon-echo-fx']});saveProgress();updateCashUI();renderCosmeticInventory();renderCosmeticShop();return{cash:progress.cash,shards:progress.cosmeticState.shards,owned:progress.cosmeticState.owned.length};},
    openCosmeticShop:()=>{showLobbyTab('shop');return{cases:ui.caseOffers.length,cards:ui.cosmeticShopGrid?.children.length||0,shards:progress.cosmeticState.shards};},
    holdCaseReveal:()=>{clearTimeout(pendingRevealTimer);pendingRevealTimer=0;return Boolean(crateOpening);},
    testRobotFriendlyFire:()=>{const attacker=enemies.find(enemy=>enemy.alive&&enemy.arena===state.activeArena);const target=enemies.find(enemy=>enemy!==attacker&&enemy.alive&&enemy.arena===state.activeArena);if(!attacker||!target)return null;const before=target.health;damageEnemyFromRobot(target,5,attacker,performance.now());return{attacker:attacker.combatRole,target:target.combatRole,damage:before-target.health,practiceTargetsArmed:dummies.filter(dummy=>dummy.canShoot).length};},
    testCombo:()=>{addMovementCombo('DIAGNOSTIC SLIDE',100);addMovementCombo('DIAGNOSTIC LAUNCH',140,performance.now()+600);return{score:movementCombo.score,tier:movementCombo.tier};},
    testCover:()=>{const cover=destructibleCover.find(item=>item.arena===state.activeArena&&!item.destroyed);if(!cover)return null;damageCover(cover,cover.maxHealth,loadout.find(gun=>gun.id==='sledge'),cover.mesh.position);const result={destroyed:cover.destroyed,colliderActive:cover.collider.active,visible:cover.mesh.visible};resetDestructibleCover();return result;},
    startFactory:()=>{startDeployment('factory');return{mode:state.gameMode,wave:state.factoryDefense?.wave,hostiles:state.hostiles,objectiveVisible:!ui.factoryObjective?.classList.contains('hidden')};},
    startLobbyParkour:()=>{enterLobbyParkour();return{mode:state.gameMode,visible:lobbyCourse.group.visible,colliders:lobbyCourse.colliders.filter(item=>item.active).length,surfaces:lobbyCourse.surfaces.filter(item=>item.active).length,position:state.position.toArray()};},
    activateLobbyPortal:(courseIndex=0)=>{if(!state.lobbyParkour)enterLobbyParkour('chill');openParkourFromDeck(courseIndex);if(state.countdownTimer){clearInterval(state.countdownTimer);state.countdownTimer=null;}state.countdownActive=false;state.matchStart=performance.now();ui.countdown.classList.add('hidden');return{mode:state.gameMode,course:state.parkour?.course.id,arena:state.activeArena,returnToHub:returnToHubAfterParkour,position:state.position.toArray()};},
    lobbyParkour:()=>({active:state.lobbyParkour,finished:state.lobbyParkourFinished,checkpoint:state.lobbyParkourCheckpoint,visible:lobbyCourse.group.visible,colliders:lobbyCourse.colliders.filter(item=>item.active).length,surfaces:lobbyCourse.surfaces.filter(item=>item.active).length,interactives:lobbyCourse.interactives.map(item=>item.id),secrets:{...progress.stats.lobbySecrets},secretTotal:LOBBY_SECRET_TOTAL,pads:lobbyCourse.pads.map(item=>item.type),portals:lobbyCourse.portals.length,courseZones:HUB_PARKOUR_PORTALS.map(portal=>({id:portal.id,zone:portal.zone,x:portal.x,z:portal.z,insideChillDeck:portal.insideChillDeck,insideMainLobby:portal.insideMainLobby,connected:portal.connected})),completions:progress.stats.lobbyParkourCompletions,best:progress.stats.lobbyParkourBestTime,hub:{areas:HUB_AREAS.map(area=>area.id),rooms:HUB_AREAS.map(area=>({id:area.id,indoor:area.indoor,wallSegments:hubRoomWallSegments(area).length})),connections:HUB_CONNECTIONS.map(connection=>connection.id),promenade:HUB_PROMENADE_SEGMENTS.map(segment=>segment.id),upperFloor:{slabs:HUB_UPPER_FLOOR.slabs.map(slab=>slab.id),stairs:HUB_UPPER_FLOOR.stairs.map(stair=>stair.id)},wings:HUB_PRIMARY_WINGS.map(wing=>({id:wing.id,direction:wing.direction,terminals:[...wing.terminalIds]})),doors:lobbyCourse.doors.length,signs:lobbyCourse.signs.length,traffic:lobbyCourse.traffic.length,aquariumFish:lobbyCourse.fish.length,spawn:lobbyCourse.spawn.toArray(),courseSpawn:lobbyCourse.courseSpawn.toArray(),socialSpawn:lobbyCourse.chillReturn.toArray(),terminalColliders:lobbyCourse.colliders.filter(item=>item.kind==='terminal').length}}),
    hubChecks:()=>({spawnSupported:Math.abs(groundHeightAt(lobbyCourse.spawn.x,lobbyCourse.spawn.z,lobbyCourse.spawn.y)-4)<.08,chillSpawnSupported:Math.abs(groundHeightAt(lobbyCourse.chillReturn.x,lobbyCourse.chillReturn.z,lobbyCourse.chillReturn.y)-4)<.08,areas:HUB_AREAS.map(area=>({id:area.id,height:groundHeightAt(area.position[0],area.position[2],6)})),connections:HUB_CONNECTIONS.map(connection=>({id:connection.id,height:groundHeightAt(connection.position[0],connection.position[2],6)})),promenade:HUB_PROMENADE_SEGMENTS.map(segment=>({id:segment.id,height:groundHeightAt(segment.position[0],segment.position[2],6)})),upperFloor:HUB_UPPER_FLOOR.slabs.map(slab=>({id:slab.id,height:groundHeightAt(slab.position[0],slab.position[2],12)})),routes:hubRouteChecks(),activeColliders:lobbyCourse.colliders.filter(item=>item.active).length,activeSurfaces:lobbyCourse.surfaces.filter(item=>item.active).length}),
    collisionActors:()=>({solidProps:colliders.filter(item=>colliderIsActive(item)&&['loot-crate','terminal'].includes(item.kind)).length,actors:activeSolidActors().map(actor=>({kind:actor.kind,index:actor.index,x:actor.group.position.x,z:actor.group.position.z,radius:actor.kind==='dummy'?1.12:.72})),overlaps:activeSolidActors().flatMap((actor,index,list)=>list.slice(index+1).filter(other=>circlesOverlap({x:actor.group.position.x,z:actor.group.position.z,radius:actor.kind==='dummy'?1.12:.72},{x:other.group.position.x,z:other.group.position.z,radius:other.kind==='dummy'?1.12:.72},.08)).map(other=>[actor.index,other.index]))}),
    traversal:()=>({charging:state.traversal.charging,charge:state.traversal.chargeAmount,buffered:Boolean(state.traversal.bufferedJump),wallRunning:Boolean(state.traversal.wallRun),ledgeHanging:Boolean(state.traversal.ledgeHang),railGrinding:Boolean(state.traversal.railGrind),barSwinging:Boolean(state.traversal.barSwing),cameraRoll:state.traversal.cameraRoll,assist:progress.settings.parkourAssist,disableCameraRoll:progress.settings.disableCameraRoll,runnableWalls:traversalObstacles.walls.length,obstacles:Object.fromEntries(Object.entries(traversalObstacles).map(([key,value])=>[key,value.length])),tutorials:{...progress.stats.traversalTutorials}}),
    testLobbyVault:()=>{if(!state.lobbyParkour)enterLobbyParkour();state.position.set(2,7.5,224.4);state.velocity.set(0,0,-9);state.onGround=true;const started=tryStartVault(new THREE.Vector3(0,0,-1));return{started,vaulting:Boolean(state.vault),position:state.position.toArray()};},
    finishLobbyParkour:()=>{if(!state.lobbyParkour)enterLobbyParkour();state.position.set(lobbyCourse.goal.x,lobbyCourse.goal.y+state.eyeHeight,lobbyCourse.goal.z);state.velocity.set(0,0,0);state.onGround=true;updateLobbyParkour(performance.now(),.016);return{finished:state.lobbyParkourFinished,cash:progress.cash,completions:progress.stats.lobbyParkourCompletions};},
    parkourCourses:()=>PARKOUR_COURSES.map((course,index)=>({...course,checkpointCount:parkourRouteCatalog[index].checkpoints.length,variant:activeParkourVariant(course).id,best:progress.stats.parkourBest[course.id]||0,medal:progress.stats.parkourMedals[course.id]||null})),
    startParkourTrial:(courseIndex=0)=>{beginParkourRun(courseIndex);if(state.countdownTimer){clearInterval(state.countdownTimer);state.countdownTimer=null;}state.countdownActive=false;state.matchStart=performance.now();ui.countdown.classList.add('hidden');return{mode:state.gameMode,course:state.parkour.course.id,variant:state.parkour.variant.id,checkpoints:state.parkour.routePoints.length,collectibles:parkourCollectibles.length,position:state.position.toArray()};},
    parkourTrial:()=>state.parkour?{course:state.parkour.course.id,variant:state.parkour.variant.id,checkpoint:state.parkour.checkpointIndex,penaltyMs:state.parkour.penaltyMs,collected:state.parkour.collected.size,completed:state.completed,gatesVisible:parkourGates.filter(gate=>gate.group.visible).length,armoryOpen:state.armoryOpen}:null,
    advanceParkourCheckpoint:()=>{if(!state.parkour)return null;const gate=parkourGates[state.parkour.checkpointIndex];if(!gate)return null;state.position.set(gate.group.position.x,gate.group.position.y,gate.group.position.z);updateParkour(performance.now(),.016);return{checkpoint:state.parkour.checkpointIndex,gatesVisible:parkourGates.filter(item=>item.group.visible).length,speedBoosted:state.speedBoostUntil>performance.now()};},
    testParkourRecovery:()=>{if(!state.parkour)return null;const run=state.parkour;const before=run.penaltyMs;resetParkourToCheckpoint('DIAGNOSTIC FALL');return{penaltyAdded:state.parkour.penaltyMs-before,restarted:state.parkour!==run,recovering:Boolean(state.parkour?.recoveryPending),recoveryMs:state.parkour?.recoveryPending?state.parkour.recoveryPending.completeAt-performance.now():0,position:state.position.toArray(),dead:state.dead,chargeCleared:!state.traversal.charging&&!state.traversal.bufferedJump,wallRunCleared:!state.traversal.wallRun&&state.traversal.cameraRoll===0};},
    finishParkourTrial:(seconds=20)=>{if(!state.parkour)return null;state.matchStart=performance.now()-seconds*1000;state.parkour.checkpointIndex=state.parkour.routePoints.length;completeParkour(performance.now());return{completed:state.completed,medal:progress.stats.parkourMedals[state.parkour.course.id],returnVisible:!ui.completeReturnLobby?.classList.contains('hidden'),time:ui.accuracy.textContent};},
    multiplayer:()=>({connected:onlineMatch.connected,roomCode:onlineMatch.roomCode,sessionId:onlineMatch.sessionId,mode:state.gameMode,snapshot:state.onlineSnapshot,remotePlayers:remotePlayers.size,status:ui.multiplayerStatus?.textContent}),
    multiplayerAimAtOpponent:()=>{const opponent=state.onlineSnapshot?.players.find(player=>player.sessionId!==state.onlineSnapshot.selfSessionId&&player.alive);if(!opponent)return null;const dx=opponent.x-state.position.x,dy=opponent.y-state.position.y,dz=opponent.z-state.position.z,length=Math.hypot(dx,dy,dz)||1;state.yaw=Math.atan2(-dx,-dz);state.pitch=Math.asin(THREE.MathUtils.clamp(dy/length,-1,1));camera.rotation.set(state.pitch,state.yaw,0);return{sessionId:opponent.sessionId,yaw:state.yaw,pitch:state.pitch,distance:length};},
    multiplayerFire:()=>{fireOnlineWeapon();return{ammo:loadout[state.weaponIndex].ammo,shots:state.shots};},
    collisionChecks,
    collisionAllArenas:()=>{const original=state.activeArena;const results=arenaDefinitions.map((arena,index)=>{selectArena(index,false);return collisionChecks();});selectArena(original,false);return results;},
    aimWeapon:(id,active=true)=>{const index=loadout.findIndex(gun=>gun.id===id);if(index<0)return null;progress.unlocked.add(id);switchWeapon(index,false);state.locked=true;setAiming(active);if(active){state.aimBlend=1;const ads=adsPositionForGun(loadout[index]);weapon.position.set(...ads);const aimProfile=aimProfileForGun(loadout[index]);camera.fov=aimProfile.targetFov||Math.max(40,progress.settings.fov-(aimProfile.zoom||0));camera.updateProjectionMatrix();weapon.updateMatrixWorld(true);}updateAimPresentation(.25);const clearance=enforceScopeClearance(loadout[index]);return{weapon:id,profile:ui.crosshair.dataset.profile,scope:ui.scope.classList.contains('active'),cleanScope:document.body.classList.contains('precision-scope'),weaponVisible:weapon.visible,clearance,feedback:ui.aimFeedbackLabel?.textContent,fovTarget:aimProfileForGun(loadout[index]).targetFov||progress.settings.fov-aimProfileForGun(loadout[index]).zoom};},
    stopAim:()=>{setAiming(false);updateAimPresentation(.25);return{profile:ui.crosshair.dataset.profile,scope:ui.scope.classList.contains('active'),cleanScope:document.body.classList.contains('precision-scope'),weaponVisible:weapon.visible};},
  }});
  if(diagnosticParams.has('factorytest'))setTimeout(()=>startDeployment('factory'),120);
  if(diagnosticParams.has('hubtest'))setTimeout(()=>enterLobbyParkour('atrium'),120);
}
if(new URLSearchParams(location.search).has('staticframe'))renderPaused=true;
animate();

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
  renderer.setPixelRatio(renderPixelRatio); renderer.setSize(innerWidth, innerHeight);composer.setPixelRatio(renderPixelRatio);composer.setSize(innerWidth,innerHeight);bloomPass.setSize(innerWidth,innerHeight);renderer.shadowMap.needsUpdate=true;
});
