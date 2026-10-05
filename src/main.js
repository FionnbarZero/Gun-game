import * as THREE from 'three';
import './style.css';

const canvas = document.querySelector('#game');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
const maximumPixelRatio = Math.min(devicePixelRatio, 1.25);
let renderPixelRatio = maximumPixelRatio;
renderer.setPixelRatio(renderPixelRatio);
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.shadowMap.autoUpdate = false;
renderer.shadowMap.needsUpdate = true;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x7187a0);
scene.fog = new THREE.FogExp2(0x8792a5, 0.00235);

const camera = new THREE.PerspectiveCamera(72, innerWidth / innerHeight, 0.08, 900);
camera.rotation.order = 'YXZ';
scene.add(camera);

const hemi = new THREE.HemisphereLight(0xc7edff, 0x654760, 2.2);
scene.add(hemi);
const sun = new THREE.DirectionalLight(0xffe7bd, 4.2);
sun.position.set(-120, 180, -80);
sun.castShadow = true;
sun.shadow.mapSize.set(1024, 1024);
sun.shadow.camera.left = -180;
sun.shadow.camera.right = 180;
sun.shadow.camera.top = 180;
sun.shadow.camera.bottom = -180;
sun.shadow.camera.far = 500;
sun.shadow.bias = -0.00025;
scene.add(sun);

const mats = {
  sand: new THREE.MeshStandardMaterial({ color: 0x746b70, roughness: 1 }),
  concrete: new THREE.MeshStandardMaterial({ color: 0x677482, roughness: .94 }),
  dark: new THREE.MeshStandardMaterial({ color: 0x18243a, roughness: .78, metalness: .18 }),
  metal: new THREE.MeshStandardMaterial({ color: 0x40566d, roughness: .64, metalness: .42 }),
  olive: new THREE.MeshStandardMaterial({ color: 0x3f665e, roughness: .82 }),
  rust: new THREE.MeshStandardMaterial({ color: 0x8f4c63, roughness: .86 }),
  orange: new THREE.MeshStandardMaterial({ color: 0xff6b35, roughness: .7 }),
  cream: new THREE.MeshStandardMaterial({ color: 0xc9c2ae, roughness: .9 }),
  black: new THREE.MeshStandardMaterial({ color: 0x0b0d0d, roughness: .5, metalness: .4 }),
  target: new THREE.MeshStandardMaterial({ color: 0xff3e6c, roughness: .68 }),
  glass: new THREE.MeshPhysicalMaterial({ color:0x68dbff, transparent:true, opacity:.24, roughness:.08, metalness:.16, transmission:.35 }),
  neonCyan: new THREE.MeshStandardMaterial({ color:0x50e5ff, emissive:0x50e5ff, emissiveIntensity:1.25, metalness:.38, roughness:.3 }),
  neonPink: new THREE.MeshStandardMaterial({ color:0xff4fba, emissive:0xff4fba, emissiveIntensity:1.05, metalness:.32, roughness:.34 }),
  leaf: new THREE.MeshStandardMaterial({ color:0x315f3d, roughness:1, flatShading:true }),
  moss: new THREE.MeshStandardMaterial({ color:0x668445, roughness:1 }),
  bark: new THREE.MeshStandardMaterial({ color:0x65472f, roughness:1 }),
  lava: new THREE.MeshStandardMaterial({ color:0xff5a18, emissive:0xff3200, emissiveIntensity:2.1, roughness:.42 }),
};

const world = new THREE.Group();
scene.add(world);
const colliders = [];
const occluders = [];
const shootables = [];
const arenaRenderables = [[],[],[]];

function arenaIndexFromX(x) { return x < -110 ? 0 : x > 110 ? 2 : 1; }
function registerArenaRenderable(object,x) {
  const arena=arenaIndexFromX(x); object.userData.arenaIndex=arena; arenaRenderables[arena].push(object); return object;
}
function syncArenaVisibility(activeArena) {
  arenaRenderables.forEach((objects,arena)=>objects.forEach(object=>{object.visible=arena===activeArena;}));
  renderer.shadowMap.needsUpdate=true;
}

function mesh(geometry, material, position, shadows = true, arenaAware = true) {
  const item = new THREE.Mesh(geometry, material);
  item.position.set(...position);
  item.castShadow = shadows;
  item.receiveShadow = shadows;
  world.add(item);
  if (arenaAware) registerArenaRenderable(item,position[0]);
  return item;
}

function addBox(size, position, material, rotationY = 0, solid = false) {
  const item = mesh(new THREE.BoxGeometry(...size), material, position);
  item.rotation.y = rotationY;
  if (solid) {
    const halfX = Math.abs(Math.cos(rotationY)) * size[0] / 2 + Math.abs(Math.sin(rotationY)) * size[2] / 2;
    const halfZ = Math.abs(Math.sin(rotationY)) * size[0] / 2 + Math.abs(Math.cos(rotationY)) * size[2] / 2;
    const collider = { minX:position[0]-halfX, maxX:position[0]+halfX, minY:position[1]-size[1]/2, maxY:position[1]+size[1]/2, minZ:position[2]-halfZ, maxZ:position[2]+halfZ, active:true, mesh:item };
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

function addPlatformSurface(type, options) { platformSurfaces.push({ type, ...options }); }
function addJumpPad(x, z, targetX, targetZ, targetHeight, color = 0xe7ff57, launchMode = 'arc') {
  const pad = mesh(new THREE.CylinderGeometry(3.2, 3.6, .35, 16), new THREE.MeshStandardMaterial({ color, emissive:color, emissiveIntensity:.35, metalness:.35, roughness:.48 }), [x, .2, z]);
  pad.receiveShadow = true;
  const ring = mesh(new THREE.TorusGeometry(2.45, .12, 8, 24), new THREE.MeshBasicMaterial({ color }), [x, .41, z]); ring.rotation.x = Math.PI / 2;
  jumpPads.push({ x, z, targetX, targetZ, targetHeight, launchMode, cooldown:0, pad, ring });
}

function addRaisedSurface(x, z, width, depth, height, material = mats.metal) {
  addBox([width, .6, depth], [x, height - .3, z], material);
  addPlatformSurface('rect', { x, z, w:width, d:depth, height });
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
  addPlatformSurface('orientedRamp',{x,z,w:width,length,angle,startHeight,endHeight});
  if (covered) {
    const roof=createPanel(width+1,.8,5.2); occluders.push(roof);
    const left=createPanel(.75,4.8,2.35,-width/2,mats.bark); const right=createPanel(.75,4.8,2.35,width/2,mats.bark);
    occluders.push(left,right);
  }
  return floor;
}

function addMovingCrane(x, z, width, depth, axis, range, phase, period = 15000) {
  const item = addBox([width, 7, depth], [x, 8.5, z], mats.orange, 0, true);
  const collider = item.userData.collider;
  movingCranes.push({ item, collider, originX:x, originZ:z, width, depth, axis, range, phase, period });
  const cap = new THREE.Mesh(new THREE.BoxGeometry(width + 1, .25, depth + 1), mats.metal); cap.position.y = 3.62; item.add(cap);
}

function addMovingDataBlock(x,z,width,depth,height,phase) {
  const item=addBox([width,height,depth],[x,height/2,z],mats.neonPink,0,true); const collider=item.userData.collider;
  const edge=new THREE.LineSegments(new THREE.EdgesGeometry(item.geometry),new THREE.LineBasicMaterial({color:0x50e5ff,transparent:true,opacity:.85})); item.add(edge);
  movingDataBlocks.push({item,collider,baseY:height/2,width,depth,height,phase});
}

function addAssemblyPlatter(x,z,radius,height,phase) {
  const item=mesh(new THREE.CylinderGeometry(radius,radius+.35,.55,18),mats.metal,[x,height-.28,z]); item.castShadow=true; item.receiveShadow=true;
  const rim=new THREE.Mesh(new THREE.TorusGeometry(radius-.22,.12,8,24),mats.orange); rim.rotation.x=Math.PI/2; rim.position.y=.3; item.add(rim);
  const surface={type:'disc',x,z,radius,height,active:true}; platformSurfaces.push(surface);
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
  addBox([w + 1.2, .7, d + 1.2], [x, h + .35, z], mats.metal);
  addBox([doorWidth - .5, .18, 2.8], [x, .11, z + d / 2 + 1.2], mats.concrete);
  for (let k = -1; k <= 1; k += 2) {
    const window = addBox([2.5, 1.4, .1], [x + k * w * .31, h * .58, z + d / 2 + .46], mats.cream);
    window.material = new THREE.MeshBasicMaterial({ color: 0xa5b8ae }); window.castShadow = false;
  }
  // Interior shelving and warm practical lighting make each building searchable.
  addBox([w * .32, 2.2, .7], [x - w * .23, 1.1, z - d * .29], mats.metal);
  addBox([w * .32, 2.2, .7], [x + w * .23, 1.1, z - d * .29], mats.metal);
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
  lootCrates.push({ group, lid, glow, core, ring, index, arena:arenaIndexFromX(position.x), opened:false, phase:index * .7 });
}
buildingLootSpots.forEach(createLootCrate);

function container(x, z, color, rot = 0) {
  const c = addBox([6, 6, 14], [x, 3, z], color, rot, rot === 0);
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
  for (const sx of [-2.7, 2.7]) for (const sz of [-2.7, 2.7]) addBox([.35, 12, .35], [x + sx, 6, z + sz], mats.metal);
  addBox([7, .45, 7], [x, 10.2, z], mats.metal);
  addBox([6, 3, 6], [x, 11.8, z], mats.dark);
  addBox([4.5, 1.3, .1], [x, 12, z + 3.02], mats.cream);
  addBox([8, .3, 8], [x, 13.45, z], mats.metal);
}
tower(-220, -76);
tower(220, -68);

function barricade(x, z, rot = 0) {
  addBox([7, 1.4, 1.2], [x, .7, z], mats.concrete, rot);
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
    addBox([.18, 2.3, 22], [towerInfo.x - 10.5, towerInfo.h + 1.15, towerInfo.z], mats.glass);
    addBox([.18, 2.3, 22], [towerInfo.x + 10.5, towerInfo.h + 1.15, towerInfo.z], mats.glass);
    addBox([21, 2.3, .18], [towerInfo.x, towerInfo.h + 1.15, towerInfo.z - 10.5], mats.glass);
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
    const bunkerX=z===18?-25:25; const bunkerRoof=addBox([20,.8,14],[bunkerX,4.6,z],mats.concrete); occluders.push(bunkerRoof);
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
  addBox([1,5,150],[ventX-7,7.5,0],mats.dark,0,true); addBox([1,5,150],[ventX+7,7.5,0],mats.dark,0,true); const ventRoof=addBox([15,1,150],[ventX,10,0],mats.dark); occluders.push(ventRoof);
  addRamp(ventX,84,14,18,5,0,'z',mats.metal); addRamp(ventX,-84,14,18,0,5,'z',mats.metal);
  for (const z of [-55,-18,18,55]) { const pipe=mesh(new THREE.CylinderGeometry(.7,.7,12,10),mats.metal,[ventX,8.7,z]); pipe.rotation.z=Math.PI/2; }
  for (const [x,z,p] of [[cx-50,-55,0],[cx+51,-52,1.2],[cx-51,51,2.4],[cx+50,54,3.5],[cx,0,4.4]]) addSteamVent(x,z,p);
  for (const [x,z,r] of [[cx-52,-20,0],[cx+52,20,0],[cx-18,-56,Math.PI/2],[cx+18,56,Math.PI/2]]) addBox([18,2.2,2],[x,1.1,z],mats.concrete,r,true);
}

buildVertigoGrid(); buildOvergrownOutpost(); buildIndustrialFoundry();

// Low-poly distant rock formations.
const rockMat = new THREE.MeshStandardMaterial({ color: 0x666353, roughness: 1, flatShading: true });
for (let i = 0; i < 44; i++) {
  const angle = i * 2.399;
  const radius = 220 + (i * 47 % 105);
  const x = Math.cos(angle) * radius;
  const z = Math.sin(angle) * radius;
  const scale = 5 + (i * 13 % 18);
  const rock = mesh(new THREE.DodecahedronGeometry(scale, 0), rockMat, [x, scale * .5 - 1.5, z]);
  rock.scale.y = .45 + (i % 4) * .2;
  rock.rotation.set(i * .3, i * .7, 0);
}

// Training dummies.
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
  const dummy = { kind: 'dummy', group, body, head, face, health: 100, alive: true, index, arena:index < 3 ? 0 : index < 6 ? 1 : 2, baseY:position.y, phase: index * 2.1 };
  for (const part of [body, head, face, chest]) { part.userData.target = dummy; shootables.push(part); part.castShadow = true; }
  dummies.push(dummy);
}
dummySpawns.forEach(createDummy);

// Armed range raiders patrol the compounds, advance on the player, and return fire.
const enemies = [];
const enemySpawns = [
  [-252,0,-43], [-171,0,47], [-58,0,48], [57,0,-43], [176,0,-32], [273,0,32]
].map(([x,y,z]) => new THREE.Vector3(x, y, z));

function createEnemy(position, index) {
  const group = new THREE.Group(); group.position.copy(position); world.add(group); registerArenaRenderable(group,position.x);
  const uniform = new THREE.MeshStandardMaterial({ color: index % 2 ? 0x313b36 : 0x3c3834, roughness: .8 });
  const armor = new THREE.MeshStandardMaterial({ color: 0x171d1e, roughness: .68, metalness: .18 });
  const visorMat = new THREE.MeshBasicMaterial({ color: 0xff334f });
  const torso = new THREE.Mesh(new THREE.BoxGeometry(1.25, 2, .75), uniform); torso.position.y = 3.35; group.add(torso);
  const armorPlate = new THREE.Mesh(new THREE.BoxGeometry(1.02, 1.05, .18), armor); armorPlate.position.set(0, 3.55, .45); group.add(armorPlate);
  const head = new THREE.Mesh(new THREE.SphereGeometry(.48, 12, 8), armor); head.position.y = 4.92; group.add(head);
  const visor = new THREE.Mesh(new THREE.BoxGeometry(.66, .12, .06), visorMat); visor.position.set(0, 4.96, .45); group.add(visor);
  const leftLeg = new THREE.Mesh(new THREE.BoxGeometry(.43, 1.9, .48), uniform); leftLeg.position.set(-.34, 1.45, 0); group.add(leftLeg);
  const rightLeg = leftLeg.clone(); rightLeg.position.x = .34; group.add(rightLeg);
  const rifle = new THREE.Mesh(new THREE.BoxGeometry(.16, .18, 1.45), mats.black); rifle.position.set(.55, 3.25, .5); rifle.rotation.x = -.2; group.add(rifle);
  const muzzle = new THREE.PointLight(0xff4938, 0, 6); muzzle.position.set(.55, 3.1, 1.25); group.add(muzzle);
  const pingShell = new THREE.Mesh(new THREE.SphereGeometry(1.45,12,8),new THREE.MeshBasicMaterial({color:0xe7ff57,wireframe:true,transparent:true,opacity:.72,depthTest:false})); pingShell.position.y=3.25; pingShell.scale.y=1.7; pingShell.visible=false; pingShell.renderOrder=20; group.add(pingShell);
  const enemy = { kind:'enemy', group, body:torso, head, health:140, alive:true, index, arena:Math.floor(index / 2), spawn:position.clone(), nextShot:performance.now() + 1200 + index * 230, phase:index * 1.7, speed:2.2 + index * .08, muzzle, pingShell };
  for (const part of [torso, armorPlate, head, visor, leftLeg, rightLeg]) { part.userData.target = enemy; part.castShadow = true; shootables.push(part); }
  enemies.push(enemy);
}
enemySpawns.forEach(createEnemy);

// Three distinct first-person weapons, built from lightweight procedural geometry.
const weapon = new THREE.Group();
camera.add(weapon);
weapon.position.set(.42, -.4, -.72);
weapon.rotation.set(-.035, -.04, 0);

function weaponPart(group, geometry, material, position, rotation = [0, 0, 0]) {
  const part = new THREE.Mesh(geometry, material);
  part.position.set(...position); part.rotation.set(...rotation); group.add(part);
  return part;
}

function finishWeapon(group, muzzlePosition, flashSize = .16) {
  const light = new THREE.PointLight(0xffa73d, 0, 3.5);
  light.position.set(...muzzlePosition); group.add(light);
  const flash = weaponPart(group, new THREE.PlaneGeometry(flashSize, flashSize), new THREE.MeshBasicMaterial({ color: 0xffd56d, transparent: true, opacity: 0, side: THREE.DoubleSide }), muzzlePosition);
  group.userData.muzzle = light; group.userData.flash = flash;
  return group;
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

function buildArmoryWeapon(kind, color = 0x596463) {
  const gun = new THREE.Group();
  const accent = new THREE.MeshStandardMaterial({ color, roughness: .62, metalness: .34 });
  let muzzlePosition = [0, .03, -.95];
  let flashSize = .16;
  const box = (size, pos, material = mats.black, rot) => weaponPart(gun, new THREE.BoxGeometry(...size), material, pos, rot);
  const tube = (radius, length, pos, material = mats.metal) => weaponPart(gun, new THREE.CylinderGeometry(radius, radius * 1.08, length, 10), material, pos, [Math.PI / 2, 0, 0]);

  if (kind === 'medkit') {
    box([.42, .28, .52], [0, -.02, -.08], new THREE.MeshStandardMaterial({ color:0xe6edf0, roughness:.7 }));
    box([.08, .18, .535], [0, -.02, -.085], new THREE.MeshBasicMaterial({ color:0xff3e6c }));
    box([.2, .07, .54], [0, -.02, -.086], new THREE.MeshBasicMaterial({ color:0xff3e6c }));
    box([.3, .08, .12], [0, .18, -.08], mats.dark);
    muzzlePosition = [0, .02, -.42]; flashSize = .01;
  } else if (kind === 'knife') {
    box([.12, .18, .42], [0, -.05, .18], mats.black, [-.35, 0, 0]);
    box([.045, .34, .08], [0, .02, -.06], accent, [0, 0, Math.PI / 2]);
    const blade = weaponPart(gun, new THREE.ConeGeometry(.09, .78, 4), new THREE.MeshStandardMaterial({ color:0xcbd3d1, roughness:.2, metalness:.85 }), [0, .06, -.48], [Math.PI / 2, 0, Math.PI / 4]);
    blade.scale.x = .45;
    muzzlePosition = [0, .06, -.9]; flashSize = .01;
  } else if (kind === 'grenade') {
    weaponPart(gun, new THREE.SphereGeometry(.22, 10, 8), accent, [0, -.02, -.12]);
    box([.12, .1, .13], [0, .22, -.12], mats.metal);
    weaponPart(gun, new THREE.TorusGeometry(.08, .012, 6, 12), mats.cream, [.08, .31, -.12], [Math.PI / 2, 0, 0]);
    muzzlePosition = [0, .02, -.5]; flashSize = .05;
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
    tube(.07, .42, [0, .2, -.14], mats.black);
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
  return finishWeapon(gun, muzzlePosition, flashSize);
}

function blueprint(config) {
  const magSize = config.magSize ?? 20;
  const reserve = config.reserve ?? magSize * 5;
  return {
    pellets:1, spread:.004, reloadTime:1700, recoil:.12, automatic:false, tone:88,
    ...config, magSize, ammo:magSize, reserve, maxReserve:reserve,
    model:buildArmoryWeapon(config.kind || 'rifle', config.color || 0x526467),
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
];
const abilityCatalog = {
  kinetic:{ name:'KINETIC SLINGSHOT', cooldown:9000 },
  snapshot:{ name:'THERMAL SNAPSHOT', cooldown:12000 },
  nova:{ name:'REPULSION NOVA', cooldown:11000 },
  rewind:{ name:'QUANTUM REWIND', cooldown:18000 },
  grapple:{ name:'GRAPPLE SLINGSHOT', cooldown:7000 },
  camo:{ name:'TEMPORAL PHASE CAMO', cooldown:14000 },
  decoy:{ name:'DECOY PROJECTION', cooldown:18000 },
};
const passiveCatalog = {
  aero:{ name:'AERO-STABILIZER', icon:'◇' }, velocity:{ name:'VELOCITY CONVERSION', icon:'⚡' }, shadow:{ name:'SHADOW STEP', icon:'◒' }, apex:{ name:'APEX PREDATOR', icon:'⌖' }, resilience:{ name:'TACTICAL RESILIENCE', icon:'⬡' },
  momentum:{ name:'MOMENTUM CONSERVATION', icon:'↻' }, lightweight:{ name:'LIGHTWEIGHT FRAME', icon:'»' }, rebound:{ name:'REBOUND SHIELD', icon:'◎' },
};

const quickSlotIds = ['specter', 'phantom', 'combat-knife', 'frag-bomb'];
const quickSlots = quickSlotIds.map(id => loadout.findIndex(gun => gun.id === id));
loadout.forEach(item => weapon.add(item.model));

const starterIds = ['specter', 'phantom', 'combat-knife', 'frag-bomb', 'sledge'];
const defaultSettings = Object.freeze({
  callsign:'ZERO SIGNAL', masterVolume:.75, musicVolume:.18, effectsVolume:.7,
  mouseSensitivity:1, scopeSensitivity:.35, fov:72, graphicsQuality:'high',
  shadowQuality:'high', cameraShake:.75, crosshairColor:'#e7ff57', crosshairSize:1,
  showDamageNumbers:true, reduceMotion:matchMedia('(prefers-reduced-motion: reduce)').matches,
  musicEnabled:false,
});
const defaultStats = Object.freeze({
  xp:0, totalCreditsEarned:0, eliminations:0, dummyEliminations:0, hostileEliminations:0,
  headshots:0, longestShot:0, contractsCompleted:0, deaths:0, weaponUses:{}, abilityUses:{},
});
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
      stats:{...defaultStats,...(saved?.stats||{}),weaponUses:{...(saved?.stats?.weaponUses||{})},abilityUses:{...(saved?.stats?.abilityUses||{})}},
      favoriteWeapon:loadout.some(gun=>gun.id===saved?.favoriteWeapon)?saved.favoriteWeapon:'specter',
      challengeState:normalizedChallengeState(saved?.challengeState), unopenedCrates:Math.max(0,Number(saved?.unopenedCrates)||0),
    };
  } catch {
    return { cash:0, unlocked:new Set(starterIds), equipped:[], cosmetics:new Set(), equippedCosmetics:{}, abilities:{q:'kinetic',e:'snapshot'}, passives:['aero','velocity','shadow'], settings:{...defaultSettings}, stats:{...defaultStats,weaponUses:{},abilityUses:{}}, favoriteWeapon:'specter', challengeState:normalizedChallengeState(), unopenedCrates:0 };
  }
}
const progress = readProgress();
progress.equipped.slice(0, 4).forEach((id, slot) => {
  const index = loadout.findIndex(gun => gun.id === id);
  if (index >= 0 && progress.unlocked.has(id) && slotForGun(loadout[index]) === slot) quickSlots[slot] = index;
});
loadout.forEach((item, index) => { item.model.visible = index === quickSlots[0]; });

const ui = {
  menu: document.querySelector('#menu'), hud: document.querySelector('#hud'), deploy: document.querySelector('#deploy'),
  ammo: document.querySelector('#ammo'), reserve: document.querySelector('#reserve'), weaponName: document.querySelector('#weapon-name'), caliber: document.querySelector('#caliber'), weaponTrait: document.querySelector('#weapon-trait'), targets: document.querySelector('#targets-left'), enemies: document.querySelector('#enemies-left'), cash: document.querySelector('#cash'),
  crosshair: document.querySelector('#crosshair'), scope: document.querySelector('#scope'), hitmarker: document.querySelector('#hitmarker'), damage: document.querySelector('#damage-number'),
  prompt: document.querySelector('#prompt'), interaction: document.querySelector('#interaction'), status: document.querySelector('#status'), complete: document.querySelector('#complete'),
  restart: document.querySelector('#restart'), accuracy: document.querySelector('#accuracy'), rounds: document.querySelector('#rounds'),
  health: document.querySelector('#health'), healthBar: document.querySelector('#health-bar'), shield: document.querySelector('#shield'), shieldBar: document.querySelector('#shield-bar'), damageFlash: document.querySelector('#damage-flash'),
  death: document.querySelector('#death'), deathKills: document.querySelector('#death-kills'), deathCash: document.querySelector('#death-cash'), redeploy: document.querySelector('#redeploy'),
  countdown: document.querySelector('#countdown'), countdownNumber: document.querySelector('#countdown-number'), matchClock: document.querySelector('#match-clock'), clockPanel: document.querySelector('.match-clock'), completeTitle: document.querySelector('#complete-title'),
  arenaName: document.querySelector('#arena-name'), mapOptions: [...document.querySelectorAll('.map-option')], mapVoteCounts:[...document.querySelectorAll('[data-vote-count]')], mapVoteTimer:document.querySelector('#map-vote-timer'), mapUtility:document.querySelector('#map-utility'), mapIntel:document.querySelector('#map-intel'),
  lobbyCash: document.querySelector('#lobby-cash'), lobbyTabs: [...document.querySelectorAll('[data-lobby-tab]')], lobbyPanels: [...document.querySelectorAll('[data-panel]')], shopFilters: [...document.querySelectorAll('[data-shop-filter]')], lobbyShopGrid: document.querySelector('#lobby-shop-grid'), lobbyInventoryGrid: document.querySelector('#lobby-inventory-grid'), lobbyLoadout: document.querySelector('#lobby-loadout'), cosmeticInventory:document.querySelector('#cosmetic-inventory'), caseButtons:[...document.querySelectorAll('[data-buy-case]')], caseOffers:[...document.querySelectorAll('.case-offer')], crateResult: document.querySelector('#crate-result'),
  profileCallsign:document.querySelector('#profile-callsign'), profileLevel:document.querySelector('#profile-level'), profileXpBar:document.querySelector('#profile-xp-bar'), profilePanelCallsign:document.querySelector('#profile-panel-callsign'), profileStats:document.querySelector('#profile-stats'), editCallsign:document.querySelector('#edit-callsign'),
  unopenedCrates:document.querySelector('#unopened-crates'), audioToggle:document.querySelector('#audio-toggle'), fullscreenToggle:document.querySelector('#fullscreen-toggle'), settingsShortcut:document.querySelector('#settings-shortcut'), settingsFullscreen:document.querySelector('#settings-fullscreen'), resetSettings:document.querySelector('#reset-settings'), settingsInputs:[...document.querySelectorAll('[data-setting]')],
  reactor:document.querySelector('#resonance-reactor'), notifications:document.querySelector('#lobby-notifications'), deployMapName:document.querySelector('#deploy-map-name'), loadoutReady:document.querySelector('#loadout-ready'), lobbyModeName:document.querySelector('#lobby-mode-name'),
  playModeButtons:[...document.querySelectorAll('[data-play-mode]')], scrollMap:document.querySelector('[data-scroll-map]'), openShop:document.querySelector('[data-open-shop]'),
  heroCanvas:document.querySelector('#lobby-weapon-canvas'), heroFamily:document.querySelector('#hero-family'), heroWeaponName:document.querySelector('#hero-weapon-name'), heroCosmetic:document.querySelector('#hero-cosmetic'), heroScope:document.querySelector('#hero-scope'), heroBarrel:document.querySelector('#hero-barrel'), heroMagazine:document.querySelector('#hero-magazine'), heroTrait:document.querySelector('#hero-trait'), inspectWeapon:document.querySelector('#inspect-weapon'), changeLoadout:document.querySelector('#change-loadout'), randomizePreview:document.querySelector('#randomize-preview'), favoritePreview:document.querySelector('#favorite-preview'),
  liveLoadout:document.querySelector('#lobby-live-loadout'), buildSummary:document.querySelector('#lobby-build-summary'), abilitySummary:document.querySelector('#lobby-ability-summary'), passiveSummary:document.querySelector('#lobby-passive-summary'),
  featured:{ panel:document.querySelector('#featured-weapon-panel'), prev:document.querySelector('#featured-prev'), next:document.querySelector('#featured-next'), className:document.querySelector('#featured-class'), name:document.querySelector('#featured-name'), description:document.querySelector('#featured-description'), damage:document.querySelector('#featured-damage'), rate:document.querySelector('#featured-rate'), mag:document.querySelector('#featured-mag'), range:document.querySelector('#featured-range'), price:document.querySelector('#featured-price'), inspect:document.querySelector('#featured-inspect'), buy:document.querySelector('#featured-buy') },
  challengeList:document.querySelector('#challenge-list'), challengeReset:document.querySelector('#challenge-reset'),
  unboxing:document.querySelector('#unboxing'), unboxSpinner:document.querySelector('#unbox-spinner'), spinnerTrack:document.querySelector('#spinner-track'), unboxReveal:document.querySelector('#unbox-reveal'), rewardCard:document.querySelector('#reward-card'), rewardIcon:document.querySelector('#reward-icon'), rewardName:document.querySelector('#reward-name'), rewardSlot:document.querySelector('#reward-slot'), rewardRarity:document.querySelector('#reward-rarity'), rewardDuplicate:document.querySelector('#reward-duplicate'), rewardParticles:document.querySelector('#reward-particles'), equipReward:document.querySelector('#equip-reward'), closeReward:document.querySelector('#close-reward'),
  abilityOptions:[...document.querySelectorAll('[data-ability]')], passiveOptions:[...document.querySelectorAll('[data-passive]')], abilityDockOptions:[...document.querySelectorAll('[data-ability-dock]')], abilityNames:{q:document.querySelector('#ability-name-q'),e:document.querySelector('#ability-name-e')}, abilityStates:{q:document.querySelector('#ability-state-q'),e:document.querySelector('#ability-state-e')}, abilityCooldowns:{q:document.querySelector('#ability-cooldown-q'),e:document.querySelector('#ability-cooldown-e')}, passiveIndicators:document.querySelector('#passive-indicators'), camoOverlay:document.querySelector('#camo-overlay'),
  modeDisplay: document.querySelector('#mode-display'), modeName: document.querySelector('#mode-name'),
  armory: document.querySelector('#armory'), armoryGrid: document.querySelector('#armory-grid'), armoryCash: document.querySelector('#armory-cash'), closeArmory: document.querySelector('#close-armory'),
  radar: document.querySelector('#radar'), radarPlayer:document.querySelector('.radar-player'), blips: [], enemyBlips: [],
  weaponSlots: [document.querySelector('#weapon-slot-0'), document.querySelector('#weapon-slot-1'), document.querySelector('#weapon-slot-2'), document.querySelector('#weapon-slot-3')]
};

dummies.forEach(() => { const blip = document.createElement('span'); blip.className = 'radar-blip'; ui.radar.append(blip); ui.blips.push(blip); });
enemies.forEach(() => { const blip = document.createElement('span'); blip.className = 'radar-blip enemy'; ui.radar.append(blip); ui.enemyBlips.push(blip); });

const state = {
  started: false, locked: false, position: new THREE.Vector3(0, 1.75, 235), velocity: new THREE.Vector3(),
  yaw: 0, pitch: 0, eyeHeight: 1.75, onGround: true, crouching: false, sliding: false, slideUntil: 0, health: 100, shield: 50, reboundTriggered:false, dead: false, hostileMode: false, activeArena: 0, weaponIndex: quickSlots[0], reloading: false, reloadTimer: null, mouseDown: false, aiming: false, throwPreview:false, lastShot: 0, lastHazardDamage:0, lastDamageAt:0, lastEnemyShotAt:0, lastLaunchAt:0, matchDeaths:0, swapUntil:0, abilityCooldownEnds:{q:0,e:0}, camoUntil:0, grapple:null, rewind:null, velocityBoostUntil:0, lastRampBoost:0, shots: 0, hits: 0, kills: 0, enemyKills: 0, targets: dummies.length, hostiles: enemies.length, nearestLoot: null, nearestWire: null, zipline: null, impulseUntil: 0, speedBoostUntil:0, healRemaining:0, healEnds:0, shake: 0, armoryOpen: false, completed: false, countdownActive:false, countdownTimer:null, matchStart:0, matchDuration:300000, chargingGun:null, chargeStarted:0, saberGuardUntil:0, saberCooldownUntil:0, phaseBeacon:null, revealedUntil:0,
};
let selectedLobbySlot = 0;
let selectedAbilityDock = 'q';
let activeShopFilter = 'all';
let selectedPlayMode = 'hostile';
let featuredWeaponIndex = Math.max(0, loadout.findIndex(gun=>gun.id==='specter'));
let crateOpening = false;
let mapVotes = [3,1,2];
let playerMapVote = 0;
let mapVoteSeconds = 8;
let mapVoteInterval = null;
const keys = new Set();
const clock = new THREE.Clock();
const raycaster = new THREE.Raycaster();
const enemyRaycaster = new THREE.Raycaster();
const voidZones = [];
const acousticWaves = [];
const magnetLinks = [];
const activeWires = [];
const thrownExplosives = [];
const blastEffects = [];
const gravityWells = [];
const shockMines = [];
const activeDecoys = [];
const hardlightWalls = [];
const utilityFields = [];
const ammoSynths = [];
const trajectoryPositions = new Float32Array(36 * 3);
const trajectoryGeometry = new THREE.BufferGeometry();
trajectoryGeometry.setAttribute('position', new THREE.BufferAttribute(trajectoryPositions, 3));
trajectoryGeometry.setDrawRange(0, 0);
const trajectoryDots = new THREE.Points(trajectoryGeometry, new THREE.PointsMaterial({ color:0xffe36b, size:.24, transparent:true, opacity:.9, sizeAttenuation:true }));
trajectoryDots.visible = false; trajectoryDots.frustumCulled = false; world.add(trajectoryDots);

function requestLock() {
  if (!state.started || state.completed || state.armoryOpen || state.dead) return;
  const attempt = canvas.requestPointerLock();
  if (attempt?.catch) attempt.catch(() => { /* The next real click can retry pointer lock. */ });
}
function selectArena(index, announce = true) {
  state.activeArena = (index + arenaDefinitions.length) % arenaDefinitions.length;
  syncArenaVisibility(state.activeArena);
  const arena = arenaDefinitions[state.activeArena];
  state.eyeHeight = 1.75; state.crouching = false; state.sliding = false;
  state.position.copy(arena.spawn); state.position.y = groundHeightAt(state.position.x, state.position.z) + state.eyeHeight;
  state.velocity.set(0, 0, 0); state.yaw = 0; state.pitch = 0;
  ui.arenaName.textContent = arena.name;
  ui.mapUtility.textContent = arena.utility; ui.mapIntel.textContent = arena.intel;
  scene.background.setHex(arena.sky); scene.fog.color.setHex(arena.fog);
  ui.mapOptions.forEach((option, optionIndex) => option.classList.toggle('active', optionIndex === state.activeArena));
  ui.deployMapName.textContent=arena.name;
  if (announce && state.started) ui.status.textContent = `DEPLOYED // ${arena.name}`;
}
function renderMapVote() {
  ui.mapVoteCounts.forEach((label,index)=>{ label.textContent=String(mapVotes[index]); });
  ui.mapVoteTimer.textContent=String(mapVoteSeconds).padStart(2,'0');
}
function castMapVote(index) {
  if (index!==playerMapVote) { mapVotes[playerMapVote]=Math.max(0,mapVotes[playerMapVote]-2); mapVotes[index]+=2; playerMapVote=index; }
  selectArena(index,false); renderMapVote();
}
function tallyMapVote() {
  mapVoteSeconds--;
  if (mapVoteSeconds>0) { renderMapVote(); return; }
  const highest=Math.max(...mapVotes); const winner=mapVotes.indexOf(highest);
  selectArena(winner,false); ui.mapOptions[winner].classList.add('winner');
  setTimeout(()=>ui.mapOptions[winner]?.classList.remove('winner'),900);
  mapVoteSeconds=8; renderMapVote();
}
ui.mapOptions.forEach(option => option.addEventListener('click', () => castMapVote(Number(option.dataset.map))));
renderMapVote(); mapVoteInterval=setInterval(tallyMapVote,1000);
function beginContractCountdown() {
  if (state.countdownTimer) clearInterval(state.countdownTimer);
  let count = 3;
  state.countdownActive = true; state.matchStart = 0; ui.countdownNumber.textContent = String(count); ui.countdown.classList.remove('hidden');
  state.countdownTimer = setInterval(() => {
    count--;
    if (count > 0) { ui.countdownNumber.textContent = String(count); return; }
    clearInterval(state.countdownTimer); state.countdownTimer = null; state.countdownActive = false; state.matchStart = performance.now();
    ui.countdown.classList.add('hidden'); ui.status.textContent = 'CONTRACT LIVE // FIVE MINUTES';
  }, 1000);
}
function startDeployment(mode=selectedPlayMode) {
  if (mapVoteInterval) { clearInterval(mapVoteInterval); mapVoteInterval=null; }
  selectedPlayMode=mode;
  if(mode==='quick') selectArena(Math.floor(secureRandom()*arenaDefinitions.length),false); else selectArena(state.activeArena,false);
  state.hostileMode=mode!=='target'; state.matchDeaths=0; state.started=true; equipQuickSlot(0);
  ui.modeName.textContent=state.hostileMode?'HOSTILE':'PEACEFUL'; ui.modeDisplay.classList.toggle('hostile',state.hostileMode); ui.modeDisplay.classList.toggle('peaceful',!state.hostileMode);
  ui.menu.classList.add('hidden'); ui.hud.classList.remove('hidden'); beginContractCountdown();
  ui.status.textContent = `${mode==='target'?'TARGET PRACTICE':mode==='quick'?'QUICK CONTRACT':'HOSTILE TRAINING'} // INITIALIZING`; stopMenuMusic(); uiSound('deploy'); requestLock();
}
ui.deploy.addEventListener('click',()=>startDeployment());
ui.playModeButtons.forEach(button=>button.addEventListener('click',()=>startDeployment(button.dataset.playMode)));
ui.scrollMap?.addEventListener('click',()=>document.querySelector('#map-vote-section')?.scrollIntoView({behavior:progress.settings.reduceMotion?'auto':'smooth',block:'center'}));

function toggleHostileMode() {
  if (!state.started || state.dead || state.countdownActive) return;
  state.hostileMode = !state.hostileMode;
  ui.modeName.textContent = state.hostileMode ? 'HOSTILE' : 'PEACEFUL';
  ui.modeDisplay.classList.toggle('hostile', state.hostileMode); ui.modeDisplay.classList.toggle('peaceful', !state.hostileMode);
  ui.status.textContent = state.hostileMode ? 'HOSTILE MODE // ENEMIES ENGAGED' : 'PEACEFUL MODE // ENEMIES PASSIVE';
  if (state.hostileMode) enemies.forEach((enemy,index) => enemy.nextShot=performance.now()+650+index*120);
}

function beginCrouchOrSlide() {
  if (!state.started || state.dead || state.armoryOpen || state.zipline) return;
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
  ui.status.textContent=extreme?'EXTREME POWER SLIDE':'MOMENTUM SLIDE';
}

canvas.addEventListener('click', requestLock);
document.addEventListener('pointerlockchange', () => {
  state.locked = document.pointerLockElement === canvas;
  if (!state.locked) { state.mouseDown = false; state.chargingGun = null; setAiming(false); }
  ui.prompt.textContent = state.locked ? '' : 'CLICK TO RESUME';
  ui.prompt.classList.toggle('show', state.started && !state.locked && !state.completed && !state.armoryOpen);
});
document.addEventListener('mousemove', (e) => {
  if (!state.locked) return;
  const sensitivity = .0018 * progress.settings.mouseSensitivity * (state.aiming ? progress.settings.scopeSensitivity : 1);
  state.yaw -= e.movementX * sensitivity;
  state.pitch -= e.movementY * sensitivity * .92;
  state.pitch = THREE.MathUtils.clamp(state.pitch, -1.48, 1.48);
});
document.addEventListener('keydown', (e) => {
  keys.add(e.code);
  if (e.code === 'Space' || e.code.startsWith('Arrow')) e.preventDefault();
  if (e.code === 'KeyR') reload();
  if (e.code === 'Digit1') equipQuickSlot(0);
  if (e.code === 'Digit2') equipQuickSlot(1);
  if (e.code === 'Digit3') equipQuickSlot(2);
  if (e.code === 'Digit4') equipQuickSlot(3);
  if (e.code === 'KeyB' && !e.repeat) toggleArmory();
  if (e.code === 'KeyF' && !e.repeat) searchNearbyLoot();
  if (e.code === 'KeyM' && !e.repeat && state.started && !state.dead && !state.armoryOpen) selectArena(state.activeArena + 1);
  if (e.code === 'KeyH' && !e.repeat) toggleHostileMode();
  if (e.code === 'KeyC' && !e.repeat) beginCrouchOrSlide();
  if (e.code === 'KeyQ' && !e.repeat) useAbility('q');
  if (e.code === 'KeyE' && !e.repeat) useAbility('e');
});
document.addEventListener('keyup', (e) => keys.delete(e.code));
function setAiming(active) {
  const gun = loadout[state.weaponIndex];
  const utility=['grenade','medkit','mine','knife'].includes(gun.kind)||gun.effect==='melee';
  state.aiming = Boolean(active && state.locked && !state.countdownActive && !utility && !state.reloading && !state.armoryOpen);
  state.throwPreview = Boolean(active && state.locked && !state.countdownActive && gun.kind === 'grenade' && !state.reloading && !state.armoryOpen);
  if(active&&state.locked&&(gun.kind==='knife'||gun.effect==='melee')&&performance.now()>=state.saberCooldownUntil){state.saberGuardUntil=performance.now()+520;ui.status.textContent=`${gun.name} // GUARD READY`;}
  ui.scope.classList.toggle('active', state.aiming && gun.scoped);
  ui.crosshair.classList.toggle('scoped', state.aiming && gun.scoped); ui.crosshair.classList.toggle('ads',state.aiming&&!gun.scoped);
  trajectoryDots.visible = state.throwPreview || (state.aiming && gun.special === 'ricochet');
  weapon.visible = !(state.aiming && gun.scoped);
}
document.addEventListener('contextmenu', (e) => e.preventDefault());
document.addEventListener('mousedown', (e) => {
  if (e.button === 2) setAiming(true);
  if (e.button === 0 && state.locked) {
    state.mouseDown = true;
    const gun = loadout[state.weaponIndex];
    if (gun.special === 'harmonic' && !state.reloading && gun.ammo > 0) {
      state.chargingGun = gun; state.chargeStarted = performance.now(); ui.status.textContent = 'HARMONIC RAIL // CHARGING';
    } else fire();
  }
});
document.addEventListener('mouseup', (e) => {
  if (e.button === 2) setAiming(false);
  if (e.button === 0) {
    state.mouseDown = false;
    if (state.chargingGun) {
      const gun = state.chargingGun; gun.chargeScale = THREE.MathUtils.clamp((performance.now() - state.chargeStarted) / 1250, .18, 1);
      state.chargingGun = null; fire();
    }
  }
});
document.addEventListener('wheel', (e) => {
  if (!state.locked) return;
  const current = Math.max(0, quickSlots.indexOf(state.weaponIndex));
  equipQuickSlot((current + (e.deltaY > 0 ? 1 : quickSlots.length - 1)) % quickSlots.length);
}, { passive: true });

function releaseGrapple(message = '') {
  if (!state.grapple) return;
  world.remove(state.grapple.line); state.grapple.line.geometry.dispose(); state.grapple.line.material.dispose(); state.grapple = null;
  if (message) ui.status.textContent = message;
  refreshAbilityHUD(performance.now());
}

function activateGrapple(now, slot = 'q', orbital = false) {
  const hit = centerShotHits([...activeOccluders(), ground], 90)[0];
  if (!hit) { ui.status.textContent = 'GRAPPLE // NO VALID SURFACE'; return false; }
  const geometry = new THREE.BufferGeometry().setFromPoints([camera.position, hit.point]);
  const line = new THREE.Line(geometry, new THREE.LineBasicMaterial({ color:orbital ? 0xff4fba : 0x50e5ff, transparent:true, opacity:.9 })); world.add(line);
  const radial = hit.point.clone().sub(state.position); radial.y = 0;
  const tangent = new THREE.Vector3(-radial.z, 0, radial.x).normalize();
  const look = new THREE.Vector3(); camera.getWorldDirection(look); look.y = 0;
  if (tangent.dot(look) < 0) tangent.negate();
  if (orbital) state.velocity.addScaledVector(tangent, 20);
  state.grapple = { anchor:hit.point.clone(), line, expires:now + (orbital ? 2300 : 1700), slot, orbital, orbitSign:tangent };
  state.impulseUntil = now + (orbital ? 2850 : 2350);
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
  let revealed = 0;
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
  blast.position.copy(state.position).add(new THREE.Vector3(0,-state.eyeHeight+.6,0)); world.add(blast); blastEffects.push({mesh:blast,age:0,radius});
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

function useAbility(slot) {
  if (!state.started || state.countdownActive || state.dead || state.completed || state.armoryOpen) return;
  const id = progress.abilities[slot]; const ability = abilityCatalog[id]; const now = performance.now();
  if (state.grapple?.slot === slot) { releaseGrapple('SLINGSHOT RELEASE // MOMENTUM HELD'); return; }
  if (id === 'rewind' && state.rewind?.slot === slot) { activateQuantumRewind(now,slot); refreshAbilityHUD(now); return; }
  if (now < state.abilityCooldownEnds[slot]) { ui.status.textContent = `${ability.name} // ${((state.abilityCooldownEnds[slot]-now)/1000).toFixed(1)}S`; return; }
  const activated = id === 'kinetic' ? activateGrapple(now,slot,true) : id === 'snapshot' ? activateThermalSnapshot(now) : id === 'nova' ? activateRepulsionNova(now) : id === 'rewind' ? activateQuantumRewind(now,slot) : id === 'grapple' ? activateGrapple(now,slot,false) : id === 'camo' ? activateCamo(now) : activateDecoy(now);
  if (activated) { progress.stats.abilityUses[id]=(progress.stats.abilityUses[id]||0)+1; saveProgress(); }
  if (activated && id !== 'rewind') state.abilityCooldownEnds[slot] = now + ability.cooldown;
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
  if (state.grapple) {
    const pull = state.grapple.anchor.clone().sub(state.position); const distance = pull.length();
    state.grapple.line.geometry.setFromPoints([camera.position.clone(), state.grapple.anchor]);
    if (now >= state.grapple.expires || distance < 3.6) releaseGrapple('SLINGSHOT RELEASE // MOMENTUM HELD');
    else {
      const radial = pull.normalize(); const strength = state.grapple.orbital ? 20 + Math.min(14,distance*.2) : 34 + Math.min(24,distance*.35);
      state.velocity.addScaledVector(radial,strength*dt);
      if (state.grapple.orbital) state.velocity.addScaledVector(state.grapple.orbitSign,24*dt);
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
}

function collides(x, z, height = null) {
  if (Math.abs(x) > 345 || Math.abs(z) > 345) return true;
  return colliders.some(c => c.active && x > c.minX - .45 && x < c.maxX + .45 && z > c.minZ - .45 && z < c.maxZ + .45 && (height === null || height < c.maxY + 1.5));
}

function activeOccluders() { return occluders.filter(object => object.visible && !object.userData.voided); }
function activeShootables() { return shootables.filter(object => (object.userData.target?.arena ?? object.userData.arena ?? state.activeArena)===state.activeArena); }

function groundHeightAt(x, z) {
  let height = 0;
  for (const surface of platformSurfaces) {
    if (surface.type === 'rect' && Math.abs(x - surface.x) <= surface.w / 2 && Math.abs(z - surface.z) <= surface.d / 2) height = Math.max(height, surface.height);
    if (surface.type === 'ring') {
      const radius = Math.hypot(x - surface.x, z - surface.z);
      if (radius >= surface.inner && radius <= surface.outer) height = Math.max(height, surface.height);
    }
    if (surface.type === 'ramp') {
      const along = surface.axis === 'x' ? x - surface.x : z - surface.z;
      const across = surface.axis === 'x' ? z - surface.z : x - surface.x;
      if (Math.abs(along) <= surface.length / 2 && Math.abs(across) <= surface.w / 2) {
        const progress = THREE.MathUtils.clamp(along / surface.length + .5, 0, 1);
        height = Math.max(height, THREE.MathUtils.lerp(surface.startHeight, surface.endHeight, progress));
      }
    }
    if (surface.type === 'orientedRamp') {
      const dx=x-surface.x; const dz=z-surface.z;
      const along=dx*Math.sin(surface.angle)+dz*Math.cos(surface.angle);
      const across=dx*Math.cos(surface.angle)-dz*Math.sin(surface.angle);
      if (Math.abs(along)<=surface.length/2 && Math.abs(across)<=surface.w/2) {
        const progress=THREE.MathUtils.clamp(along/surface.length+.5,0,1);
        height=Math.max(height,THREE.MathUtils.lerp(surface.startHeight,surface.endHeight,progress));
      }
    }
    if (surface.type==='disc' && surface.active && Math.hypot(x-surface.x,z-surface.z)<=surface.radius) height=Math.max(height,surface.height);
  }
  const hole = voidZones.find(zone => zone.floor && performance.now() < zone.expires && Math.hypot(x - zone.point.x, z - zone.point.z) <= zone.radius);
  if (hole) return -25;
  return height;
}

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

function updatePlayer(dt) {
  if (state.zipline) {
    const progress = Math.min(1, (performance.now() - state.zipline.started) / state.zipline.duration);
    state.position.lerpVectors(state.zipline.from, state.zipline.to, progress); state.position.y += Math.sin(progress * Math.PI) * 1.2;
    camera.position.copy(state.position); camera.rotation.set(state.pitch, state.yaw, 0);
    if (progress >= 1) { state.zipline = null; state.velocity.set(0, 0, 0); state.onGround = false; }
    return;
  }
  const now = performance.now();
  const move = new THREE.Vector3((keys.has('KeyD') || keys.has('ArrowRight') ? 1 : 0) - (keys.has('KeyA') || keys.has('ArrowLeft') ? 1 : 0), 0, (keys.has('KeyS') || keys.has('ArrowDown') ? 1 : 0) - (keys.has('KeyW') || keys.has('ArrowUp') ? 1 : 0));
  const impulseActive = now < state.impulseUntil;
  const extremeRunning = (keys.has('ShiftLeft') || keys.has('ShiftRight')) && move.lengthSq() > 0;
  const activeWeapon = loadout[state.weaponIndex];
  if (activeWeapon.special === 'stormcoil' && extremeRunning) activeWeapon.sprintCharge = Math.min(1, (activeWeapon.sprintCharge || 0) + dt * .28);
  if (state.chargingGun === activeWeapon) ui.status.textContent = `HARMONIC RAIL // ${Math.min(100, Math.round((now-state.chargeStarted)/12.5))}%`;
  if (state.sliding && (now >= state.slideUntil || Math.hypot(state.velocity.x, state.velocity.z) < 6)) state.sliding = false;
  state.crouching = keys.has('KeyC') && !state.sliding;
  state.eyeHeight = state.sliding ? .88 : state.crouching ? 1.08 : 1.75;
  if (state.sliding) {
    if (move.lengthSq()) {
      move.normalize().applyAxisAngle(new THREE.Vector3(0, 1, 0), state.yaw);
      const slideSpeed = Math.hypot(state.velocity.x, state.velocity.z);
      state.velocity.x = THREE.MathUtils.damp(state.velocity.x, move.x * slideSpeed, 1.3, dt);
      state.velocity.z = THREE.MathUtils.damp(state.velocity.z, move.z * slideSpeed, 1.3, dt);
    }
    state.velocity.x = THREE.MathUtils.damp(state.velocity.x, 0, 1.05, dt);
    state.velocity.z = THREE.MathUtils.damp(state.velocity.z, 0, 1.05, dt);
    if (isOnRamp(state.position.x,state.position.z) && now-state.lastRampBoost > 3200) { state.lastRampBoost=now; triggerVelocityConversion('RAMP CHAIN'); }
  } else if (!impulseActive && move.lengthSq()) {
    move.normalize().applyAxisAngle(new THREE.Vector3(0, 1, 0), state.yaw);
    const heldItem = loadout[state.weaponIndex];
    const adrenalineBoost = now < state.speedBoostUntil ? 1.15 : 1;
    const camoBoost = now < state.camoUntil ? 1.2 : 1;
    const meleeBoost = heldItem.effect === 'melee' ? 1.08 : 1;
    const speed = (state.crouching ? 7.5 : extremeRunning ? 34 : 16) * adrenalineBoost * camoBoost * meleeBoost;
    state.velocity.x = THREE.MathUtils.damp(state.velocity.x, move.x * speed, extremeRunning ? 9 : 14, dt);
    state.velocity.z = THREE.MathUtils.damp(state.velocity.z, move.z * speed, extremeRunning ? 9 : 14, dt);
  } else if (!impulseActive) {
    state.velocity.x = THREE.MathUtils.damp(state.velocity.x, 0, state.crouching ? 15 : 11, dt);
    state.velocity.z = THREE.MathUtils.damp(state.velocity.z, 0, state.crouching ? 15 : 11, dt);
  }
  if (keys.has('Space') && state.onGround) {
    const slideCancel = state.sliding; state.sliding = false; state.velocity.y = 7.2; state.onGround = false;
    if (slideCancel) { refillActiveSniper('SLIDE-CANCEL REFILL'); triggerVelocityConversion('SLIDE-CANCEL'); recordChallenge('slideCancels'); }
  }
  state.velocity.y -= 18 * dt;
  const nextX = state.position.x + state.velocity.x * dt;
  const nextZ = state.position.z + state.velocity.z * dt;
  if (!collides(nextX, state.position.z, state.position.y)) state.position.x = nextX; else state.velocity.x = 0;
  if (!collides(state.position.x, nextZ, state.position.y)) state.position.z = nextZ; else state.velocity.z = 0;
  state.position.y += state.velocity.y * dt;
  const floorY = groundHeightAt(state.position.x, state.position.z) + state.eyeHeight;
  if (state.position.y <= floorY) { state.position.y = floorY; state.velocity.y = 0; state.onGround = true; }
  if (state.position.y < -12) { damagePlayer(100); return; }
  const inLava=zone => state.position.y <= (zone.maxY ?? 4) && (zone.type==='rect' ? Math.abs(state.position.x-zone.x)<=zone.w/2 && Math.abs(state.position.z-zone.z)<=zone.d/2 : Math.hypot(state.position.x-zone.x,state.position.z-zone.z)<zone.radius);
  if (state.activeArena === 2 && now - state.lastHazardDamage > 500 && lavaHazards.some(inLava)) {
    state.lastHazardDamage = now; damagePlayer(12); ui.status.textContent = 'MOLTEN HAZARD // MOVE';
  }
  for (const pad of jumpPads) {
    if (now < pad.cooldown || Math.hypot(state.position.x - pad.x, state.position.z - pad.z) > 3.4 || !state.onGround) continue;
    const delta=new THREE.Vector3(pad.targetX-state.position.x,0,pad.targetZ-state.position.z);
    if (pad.launchMode==='horizontal') {
      delta.normalize(); state.velocity.set(delta.x*48,6.5,delta.z*48); state.impulseUntil=now+1700;
    } else {
      const floor=groundHeightAt(state.position.x,state.position.z); const heightDelta=Math.max(0,pad.targetHeight-floor);
      const verticalVelocity=Math.sqrt(2*18*(heightDelta+6)); const flight=(verticalVelocity+Math.sqrt(Math.max(0,verticalVelocity*verticalVelocity-36*heightDelta)))/18;
      state.velocity.set(delta.x/Math.max(.8,flight),verticalVelocity,delta.z/Math.max(.8,flight)); state.impulseUntil=now+flight*1000;
    }
    state.position.y+=.3; state.onGround=false; state.lastLaunchAt=now; pad.cooldown=now+2600;
    ui.status.textContent = `${pad.launchMode==='horizontal'?'PISTON PLATE':'LAUNCH PAD'} // AIRBORNE`;
    refillActiveSniper('LAUNCH PAD REFILL');
    triggerVelocityConversion('LAUNCH PAD');
    break;
  }
  const pace = Math.hypot(state.velocity.x, state.velocity.z);
  const bobAmount = state.sliding ? .006 : state.crouching ? .012 : .032;
  const bob = state.onGround && pace > .3 ? Math.sin(now * .011 * Math.min(pace / 7, 2.4)) * bobAmount : 0;
  camera.position.set(state.position.x, state.position.y + bob, state.position.z);
  const shake = state.shake * progress.settings.cameraShake;
  camera.rotation.set(state.pitch + (Math.random() - .5) * shake, state.yaw + (Math.random() - .5) * shake, (Math.random() - .5) * shake);
  state.shake = THREE.MathUtils.damp(state.shake, 0, 14, dt);
  const targetFov = state.aiming ? (activeWeapon.scoped?20:Math.max(45,progress.settings.fov-15)) : state.sliding ? Math.min(105,progress.settings.fov+17) : extremeRunning && pace > 12 ? Math.min(102,progress.settings.fov+13) : progress.settings.fov;
  camera.fov = THREE.MathUtils.damp(camera.fov, targetFov, 8, dt);
  if (Math.abs(camera.fov - targetFov) > .01) camera.updateProjectionMatrix();
  const heldGun = loadout[state.weaponIndex];
  if (!state.reloading) weapon.position.y = (state.sliding ? -.55 : state.crouching ? -.47 : heldGun.kind === 'pistol' ? -.32 : -.4) - bob * .7;
  weapon.position.x = (heldGun.kind === 'pistol' ? .57 : .42) + Math.cos(performance.now() * .005) * .008 * Math.min(pace, 1);
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
  if (!state.throwPreview) return;
  const { origin, velocity } = throwVector(gun);
  let count = 0;
  for (let index = 0; index < 36; index++) {
    const time = index * .085;
    const point = origin.clone().addScaledVector(velocity, time); point.y -= 9 * time * time;
    trajectoryPositions[index * 3] = point.x; trajectoryPositions[index * 3 + 1] = point.y; trajectoryPositions[index * 3 + 2] = point.z; count++;
    if (index > 1 && (point.y <= groundHeightAt(point.x, point.z) + .12 || pointInsideActiveCollider(point))) break;
  }
  trajectoryGeometry.setDrawRange(0, count); trajectoryGeometry.attributes.position.needsUpdate = true;
}

function throwExplosive(gun) {
  const { origin, velocity } = throwVector(gun);
  const color = gun.effect === 'gravityBomb' ? 0x9b6cff : gun.id === 'pulse-charge' ? 0xff4fba : 0xffc857;
  const group = new THREE.Group(); group.position.copy(origin); world.add(group);
  const shell = new THREE.Mesh(new THREE.SphereGeometry(.24, 10, 8), new THREE.MeshStandardMaterial({ color, emissive:color, emissiveIntensity:.28, metalness:.55, roughness:.38 })); group.add(shell);
  const band = new THREE.Mesh(new THREE.TorusGeometry(.25, .035, 6, 14), new THREE.MeshBasicMaterial({ color:0xffffff })); band.rotation.x = Math.PI / 2; group.add(band);
  const light = new THREE.PointLight(color, 4, 5); group.add(light);
  thrownExplosives.push({ group, velocity, gun, detonatesAt:performance.now() + (gun.fuseTime || 1800), bounces:0, stuck:false });
  setAiming(false); ui.status.textContent = `${gun.name} THROWN // ${gun.sticky ? 'SEEKING SURFACE' : 'FUSE LIVE'}`;
  if (gun.ammo <= 0) setTimeout(() => { if (loadout[state.weaponIndex] === gun && gun.ammo <= 0) reload(); }, 320);
}

function detonateThrownExplosive(projectile) {
  const index = thrownExplosives.indexOf(projectile); if (index >= 0) thrownExplosives.splice(index, 1);
  const point = projectile.group.position.clone(); world.remove(projectile.group);
  const radius = projectile.gun.blastRadius || 14;
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
    damageTarget(target, damage);
  }
  if (projectile.gun.effect === 'gravityBomb') createGravityWell(point, projectile.gun);
  if (projectile.gun.special === 'breachCharge') {
    for (const wall of [...hardlightWalls]) if (wall.mesh.position.distanceTo(point)<=radius*1.35) removeHardlightWall(wall);
  }
  const blastColor = projectile.gun.effect === 'gravityBomb' ? 0x9b6cff : projectile.gun.id === 'pulse-charge' ? 0xff4fba : 0xffb13b;
  const blast = new THREE.Mesh(new THREE.SphereGeometry(1, 18, 12), new THREE.MeshBasicMaterial({ color:blastColor, wireframe:true, transparent:true, opacity:.9 }));
  blast.position.copy(point); world.add(blast); blastEffects.push({ mesh:blast, age:0, radius });
  ui.status.textContent = `${projectile.gun.name} // DETONATED`;
}

function updateThrownExplosives(dt) {
  const now = performance.now();
  for (const projectile of [...thrownExplosives]) {
    if (projectile.stuck) {
      projectile.group.rotation.y += dt * 2.5;
      if (now >= projectile.detonatesAt) detonateThrownExplosive(projectile);
      continue;
    }
    projectile.velocity.y -= 18 * dt;
    const next = projectile.group.position.clone().addScaledVector(projectile.velocity, dt);
    const floor = groundHeightAt(next.x, next.z) + .24;
    if (next.y <= floor) {
      next.y = floor;
      if (projectile.gun.sticky && !(projectile.gun.special==='resonanceDisc'&&projectile.bounces<1)) {
        projectile.group.position.copy(next); projectile.velocity.set(0, 0, 0); projectile.stuck = true;
        ui.status.textContent = `${projectile.gun.name} // ARMED`;
      } else if (Math.abs(projectile.velocity.y) > 2 && projectile.bounces < 3) {
        projectile.velocity.y = Math.abs(projectile.velocity.y) * .42; projectile.velocity.x *= .72; projectile.velocity.z *= .72; projectile.bounces++;
      } else { projectile.velocity.y = 0; projectile.velocity.x *= .9; projectile.velocity.z *= .9; }
    }
    if (!projectile.stuck && pointInsideActiveCollider(next) && projectile.gun.sticky && !(projectile.gun.special==='resonanceDisc'&&projectile.bounces<1)) {
      projectile.velocity.set(0, 0, 0); projectile.stuck = true; ui.status.textContent = `${projectile.gun.name} // ARMED`;
    } else if (!projectile.stuck && pointInsideActiveCollider(next)) { projectile.velocity.x *= -.3; projectile.velocity.z *= -.3; projectile.velocity.y = Math.max(2, Math.abs(projectile.velocity.y) * .3); projectile.bounces++; }
    else projectile.group.position.copy(next);
    projectile.group.rotation.x += dt * 8; projectile.group.rotation.z += dt * 5;
    if (now >= projectile.detonatesAt || Math.abs(next.x) > 345 || Math.abs(next.z) > 345) detonateThrownExplosive(projectile);
  }
  for (const blast of [...blastEffects]) {
    blast.age += dt; const progress = blast.age / .36;
    blast.mesh.scale.setScalar(1 + progress * blast.radius); blast.mesh.material.opacity = Math.max(0, .9 * (1 - progress));
    if (progress < 1) continue;
    world.remove(blast.mesh); blast.mesh.geometry.dispose(); blast.mesh.material.dispose(); blastEffects.splice(blastEffects.indexOf(blast), 1);
  }
}

function createUtilityField(point,gun) {
  const group=new THREE.Group(); group.position.copy(point); world.add(group);
  const radius=gun.blastRadius||10; const color=gun.color||0x50e5ff;
  const ring=new THREE.Mesh(new THREE.RingGeometry(radius*.75,radius,40),new THREE.MeshBasicMaterial({color,side:THREE.DoubleSide,transparent:true,opacity:.28,depthWrite:false})); ring.rotation.x=-Math.PI/2; ring.position.y=.08; group.add(ring);
  const column=new THREE.Mesh(new THREE.CylinderGeometry(radius*.92,radius*.92,gun.special==='updraft'?16:.18,32,1,true),new THREE.MeshBasicMaterial({color,transparent:true,opacity:gun.special==='updraft'?.09:.045,side:THREE.DoubleSide,depthWrite:false})); column.position.y=gun.special==='updraft'?8:.1; group.add(column);
  utilityFields.push({group,ring,column,point:point.clone(),gun,radius,expires:performance.now()+(gun.special==='resonanceDisc'?3200:7000),nextPulse:0,pulses:0,launched:new Map()});
}

function removeHardlightWall(wall) {
  const index=hardlightWalls.indexOf(wall); if(index>=0) hardlightWalls.splice(index,1);
  const occluderIndex=occluders.indexOf(wall.mesh); if(occluderIndex>=0) occluders.splice(occluderIndex,1);
  world.remove(wall.mesh); wall.mesh.geometry.dispose(); wall.mesh.material.dispose();
}

function fire() {
  if (!state.started || state.countdownActive || state.reloading || state.completed || state.dead || state.armoryOpen) return;
  const gun = loadout[state.weaponIndex];
  const now = performance.now();
  if (gun.special === 'breachCharge') {
    const placed = thrownExplosives.filter(projectile => projectile.gun === gun && projectile.stuck);
    if (placed.length) { placed.forEach(detonateThrownExplosive); ui.status.textContent='BREACH CHARGE // REMOTE DETONATION'; return; }
  }
  if (gun.effect === 'phaseBeacon' && state.phaseBeacon && now < state.phaseBeacon.expires) { returnToPhaseBeacon(); return; }
  if (now < state.swapUntil) { ui.status.textContent = 'WEAPON NOT READY'; return; }
  if (now < state.camoUntil && quickSlots.indexOf(state.weaponIndex) === 0) { ui.status.textContent = 'TEMPORAL CAMO // PRIMARY LOCKED'; return; }
  if (now < (gun.cooldownEnds || 0)) { ui.status.textContent = `${gun.name} // COOLDOWN ${((gun.cooldownEnds - now) / 1000).toFixed(1)}S`; return; }
  if (now - state.lastShot < gun.fireRate) return;
  if (gun.effect === 'heal' && state.health >= 100) { ui.status.textContent = 'HEALTH ALREADY FULL'; return; }
  const ammoCost = gun.ammoCost ?? 1;
  if (gun.ammo < ammoCost) { reload(); return; }
  state.lastShot = now; gun.ammo -= ammoCost; state.shots++; progress.stats.weaponUses[gun.id]=(progress.stats.weaponUses[gun.id]||0)+1; updateAmmo(); shotSound(gun);
  if (gun.cooldownDuration) { gun.cooldownEnds = now + gun.cooldownDuration; updateHotbarIndicators(now); }
  weapon.rotation.x = -.035 - gun.recoil;
  gun.model.userData.muzzle.intensity = gun.name === 'SHOTGUN' ? 32 : 20;
  gun.model.userData.flash.material.opacity = 1;
  gun.model.userData.flash.rotation.z = Math.random() * Math.PI;
  const activeSlot = quickSlots.indexOf(state.weaponIndex); const cosmetic = activeSlot >= 0 ? cosmeticForSlot(activeSlot) : null;
  if (cosmetic?.trail && !['grenade','medkit','mine','knife'].includes(gun.kind)) {
    const trailDirection = new THREE.Vector3(); camera.getWorldDirection(trailDirection);
    addBeam(camera.position.clone(), camera.position.clone().addScaledVector(trailDirection, 120), cosmetic.trail, 95);
  }
  ui.crosshair.classList.remove('fire'); void ui.crosshair.offsetWidth; ui.crosshair.classList.add('fire');
  if (gun.kind === 'grenade') { throwExplosive(gun); return; }
  if (['void','repulsor','acoustic','magnet','wire','melee','heal','adrenaline','shockMine','hardlightWall','mirrorDrone','phaseBeacon','ammoSynth'].includes(gun.effect)) { fireExperimental(gun); return; }
  if (gun.special === 'ricochet') { fireRicochetShot(gun); return; }
  if (gun.special === 'orbitBreaker') { fireOrbitBreaker(gun); return; }
  const damageByTarget = new Map();
  const currentShootables=activeShootables();
  const walls=activeOccluders();
  const raycastObjects=gun.effect==='explosive'?[...currentShootables,...walls,ground]:[...currentShootables,...walls];
  for (let pellet = 0; pellet < gun.pellets; pellet++) {
    const airbornePenalty = !state.onGround && gun.kind === 'sniper' && gun.special !== 'meteor' && !state.aiming && !hasPassive('aero') ? 3.5 : 1;
    const shotSpread = (state.aiming ? gun.spread * .08 : gun.spread) * airbornePenalty;
    const aim = new THREE.Vector2((Math.random() - .5) * shotSpread, (Math.random() - .5) * shotSpread);
    raycaster.setFromCamera(aim, camera);
    raycaster.far = gun.range || Infinity;
    const hits = raycaster.intersectObjects(raycastObjects, false);
    if (!hits.length) continue;
    if (gun.effect === 'explosive') {
      const impact = hits[0].point;
      [...dummies, ...enemies].filter(target => target.alive).forEach(target => {
        const distance = target.group.position.distanceTo(impact);
        if (distance <= gun.blastRadius) damageByTarget.set(target, Math.round(gun.damage * (1 - distance / (gun.blastRadius * 1.4))));
      });
      continue;
    }
    if (gun.special === 'prism' && hits[0].object.userData.collider) prismSplitImpact(hits[0].point, gun);
    const pelletHits = gun.effect === 'pierce' ? hits : [hits[0]];
    const seen = new Set(); let piercedWall=false;
    for (const hit of pelletHits) {
      if (hit.object.userData.collider) {
        if(gun.special==='harmonic'&&!piercedWall&&(gun.chargeScale||0)>.65){piercedWall=true;continue;}
        break;
      }
      if (hit.object.userData.wireAnchor) { damageWireAnchor(hit.object.userData.wireAnchor, Math.max(10, gun.damage)); break; }
      const target = hit.object.userData.target;
      if (!target?.alive || seen.has(target)) continue;
      seen.add(target);
      const isHeadshot = hit.object === target.head || hit.object === target.face;
      let damage = isHeadshot ? gun.headDamage : gun.damage;
      if (gun.special === 'harmonic') damage *= .55 + (gun.chargeScale || .18) * .9;
      if (gun.special === 'meteor' && !state.onGround && state.velocity.y < 0) damage *= 1.5;
      if (gun.special === 'stormcoil') damage *= 1 + (gun.sprintCharge || 0) * .8;
      if (gun.special === 'counterbeat' && now-state.lastEnemyShotAt < 850) damage *= 1.65;
      if (gun.special === 'lastWord' && gun.ammo === 0) damage *= 1.8;
      target.lastShotMeta = { distance:camera.position.distanceTo(hit.point), headshot:isHeadshot, scoped:state.aiming, gun };
      damageByTarget.set(target, gun.effect === 'pierce' ? Math.max(damageByTarget.get(target) || 0, damage) : (damageByTarget.get(target) || 0) + damage);
    }
  }
  raycaster.far = Infinity;
  if (gun.special === 'harmonic') {
    if ((gun.chargeScale || 0) >= .98) { state.revealedUntil=now+3500; ui.status.textContent='FULL HARMONIC DISCHARGE // POSITION REVEALED'; }
    gun.chargeScale=0;
  }
  if (gun.special === 'stormcoil') gun.sprintCharge=0;
  if (damageByTarget.size) state.hits++;
  damageByTarget.forEach((damage, target) => {
    const resolved = applyWeaponHitSpecial(gun,target,damage,now);
    target.lastDamagingGun=gun; damageTarget(target,Math.round(resolved));
  });
}

function targetCenter(target) {
  return target.group.position.clone().add(new THREE.Vector3(0,target.kind==='enemy'?2.7:4.3,0));
}

function pushTarget(target, direction, strength=6) {
  const flat=direction.clone(); flat.y=0; if (!flat.lengthSq()) return; flat.normalize();
  const destination=target.group.position.clone().addScaledVector(flat,strength);
  if (!collides(destination.x,destination.z)) target.group.position.copy(destination);
}

function applyWeaponHitSpecial(gun,target,damage,now=performance.now()) {
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
    const chained=[...dummies,...enemies].find(other=>other.alive&&other!==target&&other.group.position.distanceTo(target.group.position)<7);
    if (chained) { addBeam(targetCenter(target),targetCenter(chained),0x55c8ff,160); damageTarget(chained,Math.max(8,Math.round(damage*.45))); }
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
  return damage;
}

function createPulseBlast(point,radius,color) {
  const blast=new THREE.Mesh(new THREE.SphereGeometry(1,16,10),new THREE.MeshBasicMaterial({color,wireframe:true,transparent:true,opacity:.85}));
  blast.position.copy(point); world.add(blast); blastEffects.push({mesh:blast,age:0,radius});
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
  const headshot=hit.object===target.head||hit.object===target.face;
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
  setTimeout(()=>{world.remove(beam);geometry.dispose();beam.material.dispose();},260);
  if (target?.alive) { target.lastShotMeta={distance:camera.position.distanceTo(end),headshot:false,scoped:state.aiming,gun}; target.lastDamagingGun=gun; state.hits++; damageTarget(target,gun.damage); ui.status.textContent='ORBIT BREAKER // GUIDED HIT'; }
}

function prismSplitImpact(point,gun) {
  const target=[...dummies,...enemies].filter(item=>item.alive&&item.group.position.distanceTo(point)<10).sort((a,b)=>a.group.position.distanceTo(point)-b.group.position.distanceTo(point))[0];
  if (!target) return; addBeam(point,targetCenter(target),0xe778ff,110); target.lastDamagingGun=gun; damageTarget(target,Math.max(7,Math.round(gun.damage*.55)));
}

function addBeam(from, to, color, duration = 130) {
  const geometry = new THREE.BufferGeometry().setFromPoints([from, to]);
  const beam = new THREE.Line(geometry, new THREE.LineBasicMaterial({ color, transparent:true, opacity:.95 }));
  world.add(beam); setTimeout(() => { world.remove(beam); geometry.dispose(); beam.material.dispose(); }, duration);
}

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
  const point = state.position.clone().addScaledVector(direction, 1.8); point.y = groundHeightAt(point.x, point.z) + .08;
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
  const point=state.position.clone().addScaledVector(forward,6); point.y=groundHeightAt(point.x,point.z)+2.5;
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
  const point=state.position.clone().addScaledVector(direction,2.4); point.y=groundHeightAt(point.x,point.z)+.6;
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
    blast.position.copy(mine.group.position); world.add(blast); blastEffects.push({ mesh:blast, age:0, radius:5 }); removeShockMine(mine);
    ui.status.textContent = 'SHOCK MINE TRIGGERED // TARGET STUNNED';
  }
  for (const wall of [...hardlightWalls]) {
    wall.mesh.material.opacity=.28+Math.sin(now*.012)*.1;
    if(now>=wall.expires) removeHardlightWall(wall);
  }
  for (const field of [...utilityFields]) {
    field.ring.rotation.z+=dt*.6; field.ring.material.opacity=.16+Math.sin(now*.008)*.1;
    const playerInside=Math.hypot(state.position.x-field.point.x,state.position.z-field.point.z)<=field.radius;
    if (field.gun.special==='resonanceDisc' && now>=field.nextPulse && field.pulses<3) {
      field.nextPulse=now+850; field.pulses++; field.ring.scale.setScalar(.65); setTimeout(()=>field.ring?.scale.setScalar(1),120);
      for(const enemy of enemies) if(enemy.alive&&enemy.group.position.distanceTo(field.point)<=field.radius){enemy.slowUntil=now+1400;enemy.pingedUntil=now+1800;}
    }
    if (field.gun.special==='muteGrenade' && playerInside) state.mutedUntil=now+180;
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
    field.launched.forEach((baseY,target)=>{if(target.alive) target.group.position.y=baseY;});
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
  target.health -= damage;
  addCash(Math.max(2, Math.round(paidDamage * (target.kind === 'enemy' ? .62 : .45))), target.kind === 'enemy' ? 'HOSTILE HIT' : 'TARGET HIT');
  const shot = target.lastShotMeta; target.lastShotMeta = null;
  target.lastKillMeta = shot;
  if(shot){progress.stats.longestShot=Math.max(progress.stats.longestShot,shot.distance||0);if(shot.headshot){progress.stats.headshots++;if(shot.scoped)recordChallenge('scopedHeadshots');}}
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
  const shot = target.lastKillMeta; target.lastKillMeta = null;
  if (!hasPassive('apex') || loadout[state.weaponIndex].kind !== 'sniper' || !shot?.scoped || shot.distance < 60) return;
  state.lastDamageAt = 0; state.shield = Math.min(50,state.shield + 4); updateVitals(); ui.status.textContent = `APEX PREDATOR // SHIELD REGEN ACTIVE // ${Math.round(shot.distance)}M`;
}

function downDummy(dummy) {
  dummy.alive = false; state.targets--; state.kills++;
  const killShot=dummy.lastKillMeta;
  triggerLastWordReload(dummy);
  triggerApexPredator(dummy);
  progress.stats.eliminations++;progress.stats.dummyEliminations++;recordChallenge('dummies');
  if(killShot?.distance>=60)recordChallenge('longKill');if(performance.now()-state.lastLaunchAt<5000)recordChallenge('airKill');
  addCash(90, 'TARGET DOWN');
  const gun = loadout[state.weaponIndex];
  gun.reserve = Math.min(gun.maxReserve, gun.reserve + gun.magSize);
  updateAmmo();
  ui.targets.textContent = String(state.targets).padStart(2, '0');
  ui.blips[dummy.index].classList.add('down');
  ui.status.textContent = '+$90 TARGET BONUS // RESUPPLIED';
  setTimeout(() => respawnDummy(dummy), 2200);
}

function respawnDummy(dummy) {
  const choices = dummySpawns.filter((_, index) => (index < 3 ? 0 : index < 6 ? 1 : 2) === dummy.arena);
  const point = choices[Math.floor(Math.random() * choices.length)] || dummySpawns[dummy.index];
  dummy.group.position.copy(point); dummy.baseY = point.y; dummy.group.rotation.set(0, Math.atan2(state.position.x - point.x, state.position.z - point.z), 0);
  dummy.health = 100; dummy.alive = true; state.targets++;
  ui.targets.textContent = String(state.targets).padStart(2, '0'); ui.blips[dummy.index].classList.remove('down');
  ui.status.textContent = 'NEW TARGET DEPLOYED';
}

function downEnemy(enemy) {
  enemy.alive = false; state.hostiles--; state.kills++; state.enemyKills++;
  const killShot=enemy.lastKillMeta;
  triggerLastWordReload(enemy);
  triggerApexPredator(enemy);
  progress.stats.eliminations++;progress.stats.hostileEliminations++;if(killShot?.distance>=60)recordChallenge('longKill');if(performance.now()-state.lastLaunchAt<5000)recordChallenge('airKill');if(slotForGun(killShot?.gun||loadout[state.weaponIndex])===1)recordChallenge('secondaryKill');
  addCash(125, 'HOSTILE DOWN');
  ui.enemies.textContent = String(state.hostiles).padStart(2, '0'); ui.enemyBlips[enemy.index].classList.add('down');
  ui.status.textContent = '+$125 HOSTILE ELIMINATED';
  enemy.respawnTimer = setTimeout(() => respawnEnemy(enemy), 5200);
}

function respawnEnemy(enemy) {
  const spawn = enemySpawns[enemy.index];
  enemy.group.position.copy(spawn); enemy.group.rotation.set(0, 0, 0); enemy.health = 140; enemy.alive = true; enemy.pingedUntil = 0; enemy.pingShell.visible = false;
  enemy.nextShot = performance.now() + 1800; enemy.respawnTimer = null; state.hostiles++;
  ui.enemies.textContent = String(state.hostiles).padStart(2, '0'); ui.enemyBlips[enemy.index].classList.remove('down');
  ui.status.textContent = 'HOSTILE REINFORCEMENT INBOUND';
}

function reload() {
  const gun = loadout[state.weaponIndex];
  if (state.reloading || gun.ammo === gun.magSize || gun.reserve === 0 || state.completed || state.dead) return;
  setAiming(false);
  state.reloading = true; ui.status.textContent = `RELOADING // ${gun.name}`; weapon.rotation.z = -.35; weapon.position.y = -.63;
  const reloadDuration = gun.reloadTime * (performance.now() < state.velocityBoostUntil ? .75 : 1);
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
    if (meta) meta.textContent = slotIndex === 0 ? `${gun.ammo}/${gun.reserve}` : slotIndex === 1 ? '▮▮▮ RAPID' : slotIndex === 2 ? 'ϟ +8% MOVE' : `×${gun.ammo + gun.reserve}`;
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
  if (!progress.unlocked.has(loadout[index].id)) { ui.status.textContent = `${loadout[index].name} // LOCKED`; return; }
  if (assignToSlot) { const slot = slotForGun(loadout[index]); quickSlots[slot] = index; applyCosmeticToSlot(slot); }
  updateQuickSlotUI();
  if (index === state.weaponIndex) return;
  setAiming(false);
  if (state.reloadTimer) clearTimeout(state.reloadTimer);
  state.reloading = false; state.reloadTimer = null; state.mouseDown = false; state.chargingGun=null;
  loadout[state.weaponIndex].model.visible = false;
  state.weaponIndex = index;
  loadout[index].model.visible = true;
  weapon.rotation.set(-.035, -.04, .32); weapon.position.y = -.62;
  const swapMultiplier = (hasPassive('lightweight') ? .6 : 1) * (performance.now() < state.velocityBoostUntil ? .75 : 1);
  state.swapUntil = performance.now() + 320 * swapMultiplier;
  updateQuickSlotUI();
  ui.status.textContent = `${loadout[index].name} // DRAWING`;
  updateAmmo();
}

function updateAmmo() {
  const gun = loadout[state.weaponIndex];
  ui.ammo.textContent = String(gun.ammo).padStart(2, '0'); ui.reserve.textContent = String(gun.reserve).padStart(2, '0');
  ui.weaponName.textContent = gun.name; ui.caliber.textContent = gun.caliber; ui.weaponTrait.textContent = gun.trait || gun.weaponClass;
  updateHotbarIndicators();
}

function updateVitals() {
  const health = Math.max(0, Math.round(state.health)); const shield = Math.max(0, Math.round(state.shield));
  ui.health.textContent = health; ui.healthBar.style.width = `${health}%`;
  ui.shield.textContent = shield; ui.shieldBar.style.width = `${shield * 2}%`;
}

function saveProgress() {
  try {
    localStorage.setItem('resonance-engine-progress', JSON.stringify({
      cash:progress.cash, unlocked:[...progress.unlocked], equipped:quickSlots.map(index=>loadout[index].id), cosmetics:[...progress.cosmetics],
      equippedCosmetics:progress.equippedCosmetics, abilities:progress.abilities, passives:progress.passives, settings:progress.settings,
      stats:progress.stats, favoriteWeapon:progress.favoriteWeapon, challengeState:progress.challengeState, unopenedCrates:progress.unopenedCrates,
    }));
  } catch { /* Progress still works for this session. */ }
}

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
  ui.profileStats.innerHTML=`<span>EXPERIENCE<b>${progress.stats.xp.toLocaleString()} XP</b></span><span>TOTAL CREDITS EARNED<b>◆${Math.floor(progress.stats.totalCreditsEarned).toLocaleString()}</b></span><span>ELIMINATIONS<b>${progress.stats.eliminations}</b></span><span>HEADSHOTS<b>${progress.stats.headshots}</b></span><span>LONGEST CONFIRMED SHOT<b>${Math.round(progress.stats.longestShot)}M</b></span><span>FAVORITE WEAPON<b>${favorite.name}</b></span><span>CONTRACTS COMPLETED<b>${progress.stats.contractsCompleted}</b></span><span>MOST-USED ABILITY<b>${abilityEntry?abilityCatalog[abilityEntry[0]]?.name||'—':'—'}</b></span>`;
}

function applySettings() {
  const settings=progress.settings;
  document.body.classList.toggle('reduce-motion',Boolean(settings.reduceMotion));
  document.body.classList.toggle('damage-numbers-off',!settings.showDamageNumbers);
  document.documentElement.style.setProperty('--crosshair-color',settings.crosshairColor);
  document.documentElement.style.setProperty('--crosshair-size',String(settings.crosshairSize));
  renderer.shadowMap.enabled=settings.shadowQuality!=='off';
  const shadowSize=settings.shadowQuality==='high'?1024:512; sun.shadow.mapSize.set(shadowSize,shadowSize); renderer.shadowMap.needsUpdate=true;
  const qualityCap=configuredPixelRatioMaximum(); if(renderPixelRatio>qualityCap||settings.graphicsQuality==='high'){renderPixelRatio=qualityCap;renderer.setPixelRatio(renderPixelRatio);renderer.setSize(innerWidth,innerHeight);}
  ui.settingsInputs.forEach(input=>{ const value=settings[input.dataset.setting]; if(input.type==='checkbox') input.checked=Boolean(value); else input.value=String(value); });
  ui.audioToggle.classList.toggle('active',Boolean(settings.musicEnabled)); ui.audioToggle.setAttribute('aria-pressed',String(Boolean(settings.musicEnabled)));
  renderProfile();
}

function configuredPixelRatioMaximum() {
  const cap=progress.settings.graphicsQuality==='low'?.78:progress.settings.graphicsQuality==='medium'?1:maximumPixelRatio;
  return Math.min(maximumPixelRatio,cap);
}

async function toggleFullscreen() {
  try { if(document.fullscreenElement) await document.exitFullscreen(); else await document.documentElement.requestFullscreen(); }
  catch { lobbyNotify('FULLSCREEN IS NOT AVAILABLE IN THIS BROWSER','warning'); pulseReactor('error'); }
}

function cosmeticForSlot(slot) {
  const id = progress.equippedCosmetics[slot];
  return cosmeticCatalog.find(item => item.id === id && progress.cosmetics.has(id)) || null;
}

function applyCosmeticToSlot(slot) {
  const gun = loadout[quickSlots[slot]]; if (!gun) return;
  const cosmetic = cosmeticForSlot(slot);
  gun.model.traverse(child => {
    if (!child.isMesh || !child.material?.clone) return;
    if (!child.userData.cosmeticBaseMaterial) child.userData.cosmeticBaseMaterial = child.material.clone();
    else if (child.material !== child.userData.cosmeticBaseMaterial) child.material.dispose?.();
    const material = child.userData.cosmeticBaseMaterial.clone();
    if (cosmetic && material.color) material.color.lerp(new THREE.Color(cosmetic.color), .72);
    if (cosmetic?.emissive && material.emissive) { material.emissive.setHex(cosmetic.emissive); material.emissiveIntensity = Math.max(.55, material.emissiveIntensity || 0); }
    child.material = material;
  });
}

function applyEquippedCosmetics() {
  for (let slot = 0; slot < quickSlots.length; slot++) applyCosmeticToSlot(slot);
}

function equipCosmetic(cosmetic) {
  if (!cosmetic || !progress.cosmetics.has(cosmetic.id)) return;
  progress.equippedCosmetics[cosmetic.slot] = cosmetic.id; applyCosmeticToSlot(cosmetic.slot); saveProgress();
  announceCrate(`${cosmetic.name} // EQUIPPED TO ${['PRIMARY','SECONDARY','MELEE','OTHER'][cosmetic.slot]}`);
  lobbyNotify(`COSMETIC EQUIPPED // ${cosmetic.name}`,cosmetic.rarity==='common'?'success':cosmetic.rarity); uiSound('equip'); renderLobbyInventory(); renderLobbySummary();
}

function updateCashUI() {
  const value = Math.floor(progress.cash).toString().padStart(4, '0');
  ui.cash.textContent = value; ui.armoryCash.textContent = value; animateNumber(ui.lobbyCash,progress.cash);
  ui.caseButtons.forEach(button => { button.disabled = crateOpening || progress.cash < Number(button.dataset.cost); });
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
  previewScene.add(new THREE.HemisphereLight(0xc9f7ff,0x26113e,2.8));
  const key=new THREE.DirectionalLight(0x65eaff,5); key.position.set(3,4,5); previewScene.add(key);
  const rim=new THREE.PointLight(0xff4fba,25,12); rim.position.set(-3,1,-2); previewScene.add(rim);
  const group=new THREE.Group(); previewScene.add(group);
  const platformMaterial=new THREE.MeshBasicMaterial({color:0x50e5ff,transparent:true,opacity:.7});
  const platform=new THREE.Mesh(new THREE.TorusGeometry(1.6,.018,8,64),platformMaterial); platform.rotation.x=Math.PI/2; platform.position.y=-1.05; previewScene.add(platform);
  const positions=new Float32Array(72*3); for(let i=0;i<72;i++){const radius=1.3+Math.random()*1.5;positions[i*3]=Math.cos(i*.79)*radius;positions[i*3+1]=-1+Math.random()*2.4;positions[i*3+2]=(Math.random()-.5)*2.4;}
  const particlesGeometry=new THREE.BufferGeometry(); particlesGeometry.setAttribute('position',new THREE.BufferAttribute(positions,3));
  const particlesMaterial=new THREE.PointsMaterial({color:0x50e5ff,size:.028,transparent:true,opacity:.72,depthWrite:false}); const particles=new THREE.Points(particlesGeometry,particlesMaterial); previewScene.add(particles);
  lobbyPreview={renderer:previewRenderer,scene:previewScene,camera:previewCamera,group,platform,particles,yaw:-.55,pitch:-.08,zoom:5,dragging:false,lastX:0,lastY:0,weapon:null};
  const canvas=ui.heroCanvas;
  canvas.addEventListener('pointerdown',event=>{lobbyPreview.dragging=true;lobbyPreview.lastX=event.clientX;lobbyPreview.lastY=event.clientY;canvas.setPointerCapture(event.pointerId);});
  canvas.addEventListener('pointermove',event=>{if(!lobbyPreview.dragging)return;lobbyPreview.yaw+=(event.clientX-lobbyPreview.lastX)*.009;lobbyPreview.pitch=THREE.MathUtils.clamp(lobbyPreview.pitch+(event.clientY-lobbyPreview.lastY)*.006,-.55,.55);lobbyPreview.lastX=event.clientX;lobbyPreview.lastY=event.clientY;});
  canvas.addEventListener('pointerup',event=>{lobbyPreview.dragging=false;canvas.releasePointerCapture(event.pointerId);});
  canvas.addEventListener('pointercancel',()=>{lobbyPreview.dragging=false;});
  canvas.addEventListener('wheel',event=>{event.preventDefault();lobbyPreview.zoom=THREE.MathUtils.clamp(lobbyPreview.zoom+event.deltaY*.003,3.6,7);},{passive:false});
  setLobbyPreviewWeapon(quickSlots[0]);
}

function setLobbyPreviewWeapon(index) {
  if (!loadout[index]) return;
  lobbyPreviewWeaponIndex=index;
  const gun=loadout[index]; const cosmeticSlot=quickSlots.indexOf(index); const cosmetic=cosmeticSlot>=0?cosmeticForSlot(cosmeticSlot):null;
  if (lobbyPreview) {
    lobbyPreview.group.clear();
    const clone=gun.model.clone(true); clone.traverse(child=>{if(child.isMesh&&child.material?.clone)child.material=child.material.clone();if(child.isLight)child.intensity=Math.min(child.intensity,.4);});
    clone.updateMatrixWorld(true); const box=new THREE.Box3().setFromObject(clone); const center=box.getCenter(new THREE.Vector3()); const size=box.getSize(new THREE.Vector3()); clone.position.sub(center); clone.scale.setScalar(3.15/Math.max(size.x,size.y,size.z,1));
    lobbyPreview.group.add(clone); lobbyPreview.weapon=clone; const previewColor=cosmetic?.trail||cosmetic?.emissive||cosmetic?.color||gun.color||0x50e5ff;
    lobbyPreview.platform.material.color.setHex(previewColor); lobbyPreview.particles.material.color.setHex(previewColor);
  }
  const equipped=quickSlots[0]===index;
  ui.heroFamily.textContent=`${equipped?'EQUIPPED PRIMARY':'ARMORY PREVIEW'} // ${gun.category}`; ui.heroWeaponName.textContent=gun.name;
  ui.heroCosmetic.textContent=cosmetic?`${cosmetic.name} // ${cosmetic.trail?'TRAIL ONLINE':'STATIC FINISH'}`:'FACTORY FINISH // NO TRAIL';
  ui.heroScope.textContent=gun.scoped?(gun.trait?.split('//')[0]?.trim()||'MAGNIFIED OPTIC'):(gun.kind==='pistol'?'REFLEX ALIGNMENT':'COMBAT OPTIC');
  ui.heroBarrel.textContent=gun.silent?'SUPPRESSED':gun.caliber||'RESONANCE TUNED'; ui.heroMagazine.textContent=gun.ammoCost===0?'ENERGY EDGE':`${gun.magSize} ROUNDS`; ui.heroTrait.textContent=gun.trait||gun.weaponClass;
}

function renderLobbyPreview(time,dt) {
  if (!lobbyPreview || state.started || !ui.lobbyPanels.find(panel=>panel.dataset.panel==='play')?.classList.contains('active')) return;
  const {renderer:previewRenderer,camera:previewCamera,group,particles,platform}=lobbyPreview; const rect=ui.heroCanvas.getBoundingClientRect();
  const width=Math.max(2,Math.round(rect.width)); const height=Math.max(2,Math.round(rect.height)); const ratio=Math.min(devicePixelRatio,1.5);
  if(ui.heroCanvas.width!==Math.round(width*ratio)||ui.heroCanvas.height!==Math.round(height*ratio)){previewRenderer.setPixelRatio(ratio);previewRenderer.setSize(width,height,false);previewCamera.aspect=width/height;previewCamera.updateProjectionMatrix();}
  if(!lobbyPreview.dragging&&!progress.settings.reduceMotion)lobbyPreview.yaw+=dt*.16;
  group.rotation.set(lobbyPreview.pitch,lobbyPreview.yaw,-.08); previewCamera.position.z=THREE.MathUtils.damp(previewCamera.position.z,lobbyPreview.zoom,8,dt);
  particles.rotation.y=time*.08; platform.rotation.z=time*.13; previewRenderer.render(lobbyPreview.scene,previewCamera);
}

function renderLobbySummary() {
  if (!ui.liveLoadout) return;
  ui.liveLoadout.replaceChildren();
  quickSlots.forEach((weaponIndex,slot)=>{
    const gun=loadout[weaponIndex]; const cosmetic=cosmeticForSlot(slot); const button=document.createElement('button'); button.type='button'; button.className=`live-slot slot-${slot} ${cosmetic?.rarity||'common'}`;
    button.innerHTML=`<kbd>${slot+1}</kbd><i>${slotIcons[slot]}</i><span><small>${slotNames[slot]}</small><b>${gun.name}</b><em>${cosmetic?.name||'FACTORY FINISH'}</em></span><strong>${slot===3?(gun.effect==='melee'?'NO AMMO':gun.caliber):gun.magSize+' / '+gun.caliber}</strong>`;
    button.title=`Open ${slotNames[slot].toLowerCase()} inventory`; button.addEventListener('click',()=>{selectedLobbySlot=slot;showLobbyTab('inventory');}); ui.liveLoadout.append(button);
  });
  ui.abilitySummary.innerHTML=['q','e'].map(slot=>{const ability=abilityCatalog[progress.abilities[slot]];return `<span class="ability-${slot}" title="${ability.name}: ${(ability.cooldown/1000).toFixed(0)} second cooldown"><kbd>${slot.toUpperCase()}</kbd><b>${ability.name}</b><em>${(ability.cooldown/1000).toFixed(0)}S</em></span>`;}).join('');
  ui.passiveSummary.innerHTML=progress.passives.map(id=>`<i title="${passiveCatalog[id].name}">${passiveCatalog[id].icon}<small>${passiveCatalog[id].name}</small></i>`).join('');
  ui.unopenedCrates.textContent=`${progress.unopenedCrates} READY`; ui.deployMapName.textContent=arenaDefinitions[state.activeArena].name; ui.loadoutReady.textContent=`${quickSlots.filter(index=>index>=0).length}/4 LOADOUT ONLINE`;
  setLobbyPreviewWeapon(quickSlots[0]);
}

function featuredRange(gun) { return gun.scoped?'LONG':gun.weaponClass.includes('SHOTGUN')||gun.effect==='melee'?'CLOSE':gun.range&&gun.range<30?'CLOSE':'MID'; }
function renderFeaturedWeapon() {
  if (!ui.featured?.name) return;
  const gun=loadout[featuredWeaponIndex]; const owned=progress.unlocked.has(gun.id); const price=directPrice(gun); const familyColors={NORMAL:'#6bbcff',WEIRD:'#50e5ff',CRAZY:'#ff5a35',CUSTOM:'#b58aff',GEAR:'#67e8a5'};
  ui.featured.panel.style.setProperty('--family',familyColors[gun.category]||'#50e5ff'); ui.featured.className.textContent=`${gun.category} // ${gun.weaponClass}`; ui.featured.name.textContent=gun.name; ui.featured.description.textContent=gun.trait||gun.weaponClass;
  ui.featured.damage.textContent=gun.damage; ui.featured.rate.textContent=gun.automatic?Math.round(60000/gun.fireRate):'SEMI'; ui.featured.mag.textContent=gun.magSize; ui.featured.range.textContent=featuredRange(gun);
  ui.featured.price.textContent=owned?'OWNED':`◆${price}`; ui.featured.buy.textContent=owned?'EQUIP':'BUY'; ui.featured.buy.classList.toggle('cant-afford',!owned&&progress.cash<price);
}

function changeFeatured(direction=1) { featuredWeaponIndex=(featuredWeaponIndex+direction+loadout.length)%loadout.length; renderFeaturedWeapon(); }

function directPrice(gun) {
  return Math.max(1200, Math.round(gun.price * 1.35 / 50) * 50);
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
  loadout.filter(gun => activeShopFilter === 'all' || shopType(gun) === activeShopFilter).forEach(gun => {
    const owned = progress.unlocked.has(gun.id);
    const price = directPrice(gun);
    const card = document.createElement('article');
    card.className = `lobby-card ${gun.category.toLowerCase()}`;
    card.innerHTML = `<small>${shopType(gun).toUpperCase()} // ${gun.weaponClass}</small><h3>${gun.name}</h3><footer><b>${owned ? 'OWNED' : `$${price}`}</b><button type="button" ${owned ? 'disabled' : ''}>${owned ? 'OWNED' : 'BUY DIRECT'}</button></footer>`;
    card.querySelector('button').addEventListener('click', () => {
      if (owned || progress.cash < price) { announceCrate(`NEED $${Math.max(0, price - progress.cash)} MORE FOR ${gun.name}`); return; }
      progress.cash -= price; progress.unlocked.add(gun.id); saveProgress(); updateCashUI();
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
}

function showLobbyTab(tab) {
  ui.lobbyTabs.forEach(button => button.classList.toggle('active', button.dataset.lobbyTab === tab));
  ui.lobbyPanels.forEach(panel => panel.classList.toggle('active', panel.dataset.panel === tab));
  ui.menu.dataset.activePanel=tab; uiSound('select');
  if (tab === 'shop') renderLobbyShop();
  if (tab === 'inventory') renderLobbyInventory();
  if (tab === 'build') renderBuildSelection();
  if (tab === 'challenges') { renderChallenges(); renderProfile(); }
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

ui.lobbyTabs.forEach(button => button.addEventListener('click', () => showLobbyTab(button.dataset.lobbyTab)));
ui.shopFilters.forEach(button => button.addEventListener('click', () => {
  activeShopFilter = button.dataset.shopFilter;
  ui.shopFilters.forEach(filter => filter.classList.toggle('active', filter === button));
  renderLobbyShop();
}));

ui.settingsShortcut?.addEventListener('click',()=>showLobbyTab('settings'));
ui.editCallsign?.addEventListener('click',()=>{showLobbyTab('settings');document.querySelector('#callsign-setting')?.focus();});
ui.openShop?.addEventListener('click',()=>showLobbyTab('shop'));
ui.buildSummary?.addEventListener('click',()=>showLobbyTab('build'));
ui.changeLoadout?.addEventListener('click',()=>{selectedLobbySlot=0;showLobbyTab('inventory');});
ui.inspectWeapon?.addEventListener('click',()=>{setLobbyPreviewWeapon(quickSlots[0]);lobbyPreview.yaw=-.9;uiSound('select');});
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
  if(!owned){if(progress.cash<price){lobbyNotify(`INSUFFICIENT CREDITS // NEED ◆${price-progress.cash}`,'warning');pulseReactor('error');uiSound('error');return;}progress.cash-=price;progress.unlocked.add(gun.id);saveProgress();updateCashUI();renderLobbyShop();lobbyNotify(`WEAPON UNLOCKED // ${gun.name}`,'success');pulseReactor('success');uiSound('purchase');renderFeaturedWeapon();return;}
  const slot=slotForGun(gun);const previous=quickSlots[slot];const duplicate=quickSlots.indexOf(featuredWeaponIndex);if(duplicate>=0&&duplicate!==slot)quickSlots[duplicate]=previous;quickSlots[slot]=featuredWeaponIndex;applyCosmeticToSlot(slot);if(slot===0||state.weaponIndex===previous)switchWeapon(featuredWeaponIndex,false);saveProgress();renderLobbySummary();renderFeaturedWeapon();lobbyNotify(`EQUIPPED // ${gun.name}`,'success');uiSound('equip');
});
ui.audioToggle?.addEventListener('click',toggleMenuMusic);
ui.fullscreenToggle?.addEventListener('click',toggleFullscreen); ui.settingsFullscreen?.addEventListener('click',toggleFullscreen);
ui.resetSettings?.addEventListener('click',()=>{progress.settings={...defaultSettings};stopMenuMusic();applySettings();saveProgress();lobbyNotify('SETTINGS RESTORED TO DEFAULTS','info');uiSound('back');});
ui.settingsInputs.forEach(input=>{
  const update=()=>{const key=input.dataset.setting;progress.settings[key]=input.type==='checkbox'?input.checked:input.type==='range'?Number(input.value):input.value;if(key==='callsign')progress.settings.callsign=String(progress.settings.callsign).trimStart().slice(0,18);applySettings();saveProgress();};
  input.addEventListener(input.type==='text'?'change':'input',update);
});
document.addEventListener('fullscreenchange',()=>{const active=Boolean(document.fullscreenElement);ui.fullscreenToggle?.classList.toggle('active',active);ui.settingsFullscreen?.classList.toggle('active',active);});
document.addEventListener('pointerover',event=>{const button=event.target.closest('button');if(!button||button.disabled)return;if(audioContext?.state==='running')uiSound('hover');if(button===ui.deploy)ui.reactor?.classList.add('play-hover');});
document.addEventListener('pointerout',event=>{if(event.target.closest('button')===ui.deploy)ui.reactor?.classList.remove('play-hover');});
document.addEventListener('pointermove',event=>{const card=event.target.closest('.map-option,.lobby-card');if(!card)return;const bounds=card.getBoundingClientRect();card.style.setProperty('--tilt-x',`${((event.clientY-bounds.top)/bounds.height-.5)*-3}deg`);card.style.setProperty('--tilt-y',`${((event.clientX-bounds.left)/bounds.width-.5)*4}deg`);});
document.addEventListener('pointerdown',()=>{if(progress.settings.musicEnabled)ensureMenuMusic();},{once:true});
setInterval(()=>{if(!state.started&&ui.menu.dataset.activePanel==='play')changeFeatured(1);},15000);
function secureRandom() {
  if (!globalThis.crypto?.getRandomValues) return Math.random();
  const values = new Uint32Array(1); crypto.getRandomValues(values); return values[0] / 4294967296;
}

function rollRarity() {
  const roll = secureRandom() * 100;
  if (roll < 70) return 'common';
  if (roll < 90) return 'rare';
  if (roll < 98.5) return 'legendary';
  return 'exotic';
}

function rollCosmetic(caseType, forcedRarity = rollRarity()) {
  const pool = cosmeticCatalog.filter(item => item.case === caseType && item.rarity === forcedRarity);
  const fallback = cosmeticCatalog.filter(item => item.case === caseType);
  const choices = pool.length ? pool : fallback;
  return choices[Math.floor(secureRandom() * choices.length)];
}

function spinnerCard(cosmetic) {
  return `<article class="spin-card ${cosmetic.rarity}"><i>${cosmetic.icon}</i><b>${cosmetic.name}</b><small>${rarityData[cosmetic.rarity].label}</small></article>`;
}

let pendingReward = null;
function revealCaseReward(cosmetic) {
  const duplicate = progress.cosmetics.has(cosmetic.id); const rarity = rarityData[cosmetic.rarity];
  progress.cosmetics.add(cosmetic.id);
  if (duplicate) { progress.cash += rarity.refund; progress.stats.totalCreditsEarned+=rarity.refund; progress.stats.xp+=rarity.refund; }
  saveProgress(); updateCashUI(); renderLobbyInventory();
  ui.unboxSpinner.classList.add('hidden'); ui.unboxReveal.classList.remove('hidden');
  ui.rewardCard.className = `reward-card ${cosmetic.rarity}`; ui.rewardIcon.textContent = cosmetic.icon; ui.rewardName.textContent = cosmetic.name;
  ui.rewardSlot.textContent = `${['PRIMARY','SECONDARY','MELEE','OTHER'][cosmetic.slot]} COSMETIC`; ui.rewardRarity.textContent = `RARITY: ${rarity.label}`;
  ui.rewardDuplicate.textContent = duplicate ? `DUPLICATE CONVERTED // +$${rarity.refund}` : 'NEW ITEM ADDED TO INVENTORY';
  ui.rewardParticles.style.setProperty('--reward-color', `#${rarity.color.toString(16).padStart(6,'0')}`); ui.rewardParticles.replaceChildren();
  for (let index = 0; index < 28; index++) { const particle = document.createElement('i'); particle.style.setProperty('--angle', `${index * (360 / 28)}deg`); particle.style.animationDelay = `${(index % 4) * .035}s`; ui.rewardParticles.append(particle); }
  lobbyNotify(`${rarity.label} REWARD // ${cosmetic.name}`,cosmetic.rarity); pulseReactor('reward',1400); uiSound('reward'); renderProfile();
}

function openCase(caseType) {
  if (crateOpening) return;
  const button = ui.caseButtons.find(item => item.dataset.buyCase === caseType); const cost = Number(button?.dataset.cost || 0);
  if (progress.cash < cost) { announceCrate(`NEED $${cost - progress.cash} MORE FOR THIS CASE`); lobbyNotify(`INSUFFICIENT CREDITS // NEED ◆${cost-progress.cash}`,'warning'); pulseReactor('error'); uiSound('error'); return; }
  crateOpening = true; progress.cash -= cost; saveProgress(); updateCashUI();
  ui.caseOffers.forEach(offer => offer.classList.toggle('opening', offer.dataset.case === caseType));
  const rarity = rollRarity(); pendingReward = rollCosmetic(caseType, rarity);
  const winnerIndex = 36; const sequence = Array.from({ length:43 }, () => rollCosmetic(caseType)); sequence[winnerIndex] = pendingReward;
  ui.spinnerTrack.innerHTML = sequence.map(spinnerCard).join(''); ui.spinnerTrack.style.transition = 'none'; ui.spinnerTrack.style.transform = 'translateX(30px)';
  ui.unboxReveal.classList.add('hidden'); ui.unboxSpinner.classList.remove('hidden'); ui.unboxing.classList.remove('hidden');
  uiSound('purchase');
  void ui.spinnerTrack.offsetWidth;
  requestAnimationFrame(() => requestAnimationFrame(() => {
    ui.spinnerTrack.style.transition = 'transform 4.35s cubic-bezier(.08,.72,.08,1)';
    ui.spinnerTrack.style.transform = `translateX(${-winnerIndex * 150 - 70}px)`;
  }));
  setTimeout(() => revealCaseReward(pendingReward), 4550);
}

ui.caseButtons.forEach(button => button.addEventListener('click', () => openCase(button.dataset.buyCase)));
ui.equipReward.addEventListener('click', () => { if (pendingReward) { equipCosmetic(pendingReward); ui.equipReward.textContent = 'EQUIPPED'; } });
ui.closeReward.addEventListener('click', () => {
  ui.unboxing.classList.add('hidden'); ui.caseOffers.forEach(offer => offer.classList.remove('opening')); crateOpening = false; pendingReward = null; ui.equipReward.textContent = 'EQUIP ITEM'; updateCashUI();
});

function updateLootInteraction() {
  state.nearestLoot = null; state.nearestWire = null;
  let nearestDistance = 4.2;
  for (const crate of lootCrates) {
    if (crate.opened || crate.arena!==state.activeArena) continue;
    const distance = crate.group.position.distanceTo(state.position);
    if (distance < nearestDistance) { nearestDistance = distance; state.nearestLoot = crate; }
  }
  if (!state.nearestLoot) {
    let wireDistance=3.2;
    for (const wire of activeWires) {
      const distance=pointToSegmentDistance(state.position,wire.a.point,wire.b.point);
      if (distance<wireDistance) { wireDistance=distance; state.nearestWire=wire; }
    }
  }
  const visible = Boolean((state.nearestLoot || state.nearestWire) && state.started && !state.dead && !state.armoryOpen);
  ui.interaction.classList.toggle('show', visible);
  ui.interaction.innerHTML = visible ? state.nearestLoot ? '<kbd>F</kbd> SEARCH WEAPON CRATE' : '<kbd>F</kbd> RIDE WIRE ZIPLINE' : '';
}

function searchNearbyLoot() {
  const crate = state.nearestLoot;
  if (!crate && state.nearestWire) { useWireZipline(state.nearestWire); return; }
  if (!crate || crate.opened || state.dead || state.armoryOpen) return;
  crate.opened = true; crate.lid.rotation.x = -.65; crate.lid.position.set(0, 1.35, -.38); crate.glow.intensity = 0; crate.core.visible = false; crate.ring.visible = false;
  const gun = loadout[state.weaponIndex];
  gun.reserve = gun.maxReserve; addCash(150, 'FIELD SUPPLY CACHE'); updateAmmo();
  recordChallenge('cache');
  ui.status.textContent = 'FIELD CACHE // AMMO + $150';
  ui.interaction.classList.remove('show'); renderArmory();
}

function useWireZipline(wire) {
  const distanceA=state.position.distanceTo(wire.a.point); const destination=distanceA<state.position.distanceTo(wire.b.point)?wire.b.point:wire.a.point;
  const from=state.position.clone(); const to=destination.clone().add(new THREE.Vector3(0,1.2,0));
  state.zipline={from,to,started:performance.now(),duration:Math.max(350,from.distanceTo(to)/10.5*1000)};
  ui.status.textContent='WIRE ZIPLINE // +50% SPEED'; ui.interaction.classList.remove('show');
}

function addCash(amount, reason) {
  progress.cash += amount; if(amount>0){progress.stats.totalCreditsEarned+=amount;progress.stats.xp+=amount;} updateCashUI(); saveProgress();
  const pop = document.createElement('span');
  pop.className = 'credit-pop'; pop.textContent = `+$${amount} // ${reason}`;
  ui.hud.append(pop); setTimeout(() => pop.remove(), 850);
  if (state.armoryOpen) renderArmory();
}

function renderArmory() {
  ui.armoryGrid.replaceChildren();
  let activeCategory = '';
  loadout.forEach((gun, index) => {
    if (gun.category === 'GEAR') return;
    if (gun.category !== activeCategory) {
      activeCategory = gun.category;
      const heading = document.createElement('div');
      heading.className = `armory-section-title category-${gun.category.toLowerCase()}`;
      heading.innerHTML = `<span>${String(index + 1).padStart(2, '0')}—${String(index + 10).padStart(2, '0')}</span><b>${gun.category} WEAPONS</b>`;
      ui.armoryGrid.append(heading);
    }
    const owned = progress.unlocked.has(gun.id);
    const equipped = state.weaponIndex === index;
    const price = directPrice(gun);
    const affordable = progress.cash >= price;
    const card = document.createElement('button');
    card.type = 'button';
    card.className = `weapon-card ${owned ? 'owned' : 'locked'} ${equipped ? 'equipped' : ''} ${!owned && !affordable ? 'cant-afford' : ''}`;
    const action = equipped ? 'EQUIPPED' : owned ? 'EQUIP WEAPON' : affordable ? `BUY DIRECT // $${price}` : `NEED $${price}`;
    card.innerHTML = `<span class="card-index">${String(index + 1).padStart(2, '0')}</span><span class="card-class">${gun.category} // ${gun.weaponClass}</span><h3>${gun.name}</h3><div class="card-stats"><span>POWER<b>${Math.min(999, gun.headDamage)}</b></span><span>RATE<b>${gun.automatic ? Math.round(60000 / gun.fireRate) : 'SEMI'}</b></span><span>MAG<b>${gun.magSize}</b></span></div><span class="card-action"><b>${action}</b><i>${owned ? '→' : '◇'}</i></span>`;
    card.addEventListener('click', () => {
      if (!owned) {
        if (progress.cash < price) { ui.status.textContent = `NEED $${price - progress.cash} MORE`; return; }
        progress.cash -= price; progress.unlocked.add(gun.id); saveProgress(); updateCashUI();
        ui.status.textContent = `${gun.name} // UNLOCKED`;
      }
      switchWeapon(index); renderArmory();
    });
    ui.armoryGrid.append(card);
  });
}

function toggleArmory(force) {
  if (!state.started || state.dead) return;
  setAiming(false);
  state.armoryOpen = typeof force === 'boolean' ? force : !state.armoryOpen;
  state.mouseDown = false; keys.clear();
  ui.armory.classList.toggle('hidden', !state.armoryOpen);
  ui.armory.setAttribute('aria-hidden', String(!state.armoryOpen));
  ui.prompt.classList.remove('show');
  if (state.armoryOpen) { document.exitPointerLock(); renderArmory(); }
  else requestLock();
}

ui.closeArmory.addEventListener('click', () => toggleArmory(false));
function completeExercise(title = 'RANGE CLEARED') {
  if (state.completed) return;
  if (state.countdownTimer) clearInterval(state.countdownTimer);
  state.completed = true; state.mouseDown = false; setAiming(false); document.exitPointerLock(); ui.complete.classList.remove('hidden');
  addCash(500, 'CONTRACT COMPLETE');
  progress.stats.contractsCompleted++; if(state.matchDeaths===0)recordChallenge('survivor'); saveProgress();
  ui.completeTitle.innerHTML = title.replace(' ', '<br />');
  ui.accuracy.textContent = `${Math.round((state.hits / Math.max(1, state.shots)) * 100)}%`; ui.rounds.textContent = state.shots;
}
ui.restart.addEventListener('click', () => location.reload());

function updateContractClock(now) {
  if (!state.started || state.completed) return;
  if (state.countdownActive) return;
  if (!state.matchStart) return;
  const remaining = Math.max(0, state.matchDuration - (now - state.matchStart));
  const totalSeconds = Math.ceil(remaining / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  ui.matchClock.textContent = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  ui.clockPanel.classList.toggle('danger', remaining <= 30000);
  if (remaining <= 0 && !state.dead) completeExercise('TIME EXPIRED');
}

function updateDummies(time, dt) {
  for (const dummy of dummies) {
    if(dummy.arena!==state.activeArena) continue;
    if (dummy.alive) {
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
  if(state.activeArena===2) for (const crane of movingCranes) {
    const offset = Math.sin(now / crane.period * Math.PI * 2 + crane.phase) * crane.range;
    crane.item.position.x = crane.originX + (crane.axis === 'x' ? offset : 0);
    crane.item.position.z = crane.originZ + (crane.axis === 'z' ? offset : 0);
    crane.collider.minX = crane.item.position.x - crane.width / 2; crane.collider.maxX = crane.item.position.x + crane.width / 2;
    crane.collider.minZ = crane.item.position.z - crane.depth / 2; crane.collider.maxZ = crane.item.position.z + crane.depth / 2;
  }
  if(state.activeArena===0) for (const block of movingDataBlocks) {
    const rise=(Math.sin(time*1.05+block.phase)+1)/2;
    block.item.position.y=THREE.MathUtils.lerp(-block.height/2+.15,block.baseY,rise);
    block.item.rotation.y=Math.sin(time*.35+block.phase)*.08;
    block.collider.minY=block.item.position.y-block.height/2; block.collider.maxY=block.item.position.y+block.height/2;
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

function enemyHasLineOfSight(enemy, distance, targetPoint = state.position) {
  const origin = enemy.group.position.clone().add(new THREE.Vector3(0, 3.8, 0));
  const direction = targetPoint.clone().sub(origin).normalize();
  enemyRaycaster.set(origin, direction); enemyRaycaster.far = Math.max(0, distance - 1);
  const blocked = enemyRaycaster.intersectObjects(activeOccluders(), false).length > 0;
  enemyRaycaster.far = Infinity;
  return !blocked;
}

function updateEnemies(time, dt) {
  const now = performance.now();
  for (const enemy of enemies) {
    if(enemy.arena!==state.activeArena) continue;
    enemy.muzzle.intensity = THREE.MathUtils.damp(enemy.muzzle.intensity, 0, 32, dt);
    enemy.pingShell.visible = now < (enemy.pingedUntil || 0); enemy.pingShell.rotation.y += dt * 2.6;
    if (!enemy.alive) {
      enemy.group.rotation.x = THREE.MathUtils.damp(enemy.group.rotation.x, -Math.PI / 2, 4, dt);
      continue;
    }
    enemy.group.rotation.z = THREE.MathUtils.damp(enemy.group.rotation.z, 0, 6, dt);
    if (!state.started || state.dead || state.armoryOpen) continue;
    if (now < (enemy.stunnedUntil || 0) || now < (enemy.pinnedUntil || 0)) continue;
    const speedScale = now < (enemy.slowUntil || 0) ? .45 : 1;
    const decoy = activeDecoys.filter(item => item.arena === state.activeArena).sort((a,b) => a.group.position.distanceTo(enemy.group.position) - b.group.position.distanceTo(enemy.group.position))[0];
    const decoyDistance = decoy ? decoy.group.position.distanceTo(enemy.group.position) : Infinity;
    const targetingDecoy = decoyDistance < 135;
    const targetPoint = targetingDecoy ? decoy.group.position.clone().add(new THREE.Vector3(0,2.7,0)) : state.position.clone();
    const delta = targetPoint.clone().sub(enemy.group.position); delta.y = 0;
    const distance = delta.length();
    const heldWeapon=loadout[state.weaponIndex];
    const shadowStepping = hasPassive('shadow') && (heldWeapon.effect === 'melee' || state.sliding);
    const glassFangHidden=heldWeapon.special==='glassFang'&&state.crouching;
    const noticeRange = targetingDecoy ? 160 : now<state.revealedUntil ? 280 : now < state.camoUntil ? 35 : now<(state.mutedUntil||0) ? 42 : glassFangHidden ? 24 : shadowStepping ? (state.sliding ? 18 : 70) : hasPassive('lightweight') ? 125 : 190;
    const active = state.hostileMode && distance < noticeRange;
    if (active) {
      const direction = delta.normalize();
      enemy.group.rotation.y = Math.atan2(direction.x, direction.z);
      if (distance > 23) {
        const strafe = Math.sin(time * .8 + enemy.phase) * (distance < 70 ? .65 : .18);
        const moveX = direction.x + direction.z * strafe;
        const moveZ = direction.z - direction.x * strafe;
        const nextX = enemy.group.position.x + moveX * enemy.speed * speedScale * dt;
        const nextZ = enemy.group.position.z + moveZ * enemy.speed * speedScale * dt;
        if (!collides(nextX, enemy.group.position.z)) enemy.group.position.x = nextX;
        if (!collides(enemy.group.position.x, nextZ)) enemy.group.position.z = nextZ;
      }
      if (distance < 135 && now >= enemy.nextShot && enemyHasLineOfSight(enemy, distance, targetPoint)) {
        enemy.nextShot = now + 800 + Math.random() * 900;
        enemy.muzzle.intensity = 22;
        if(!targetingDecoy) state.lastEnemyShotAt=now;
        const accuracy = THREE.MathUtils.clamp(.82 - distance / 230, .28, .72);
        if (Math.random() < accuracy) {
          if (targetingDecoy) { enemy.pingedUntil = now + 3000; ui.status.textContent = 'DECOY HIT // HOSTILE PINGED 3S'; }
          else damagePlayer(7 + Math.floor(Math.random() * 7));
        }
      }
    } else {
      const patrolX = enemy.spawn.x + Math.cos(time * .16 + enemy.phase) * 10;
      const patrolZ = enemy.spawn.z + Math.sin(time * .16 + enemy.phase) * 10;
      const dx = patrolX - enemy.group.position.x; const dz = patrolZ - enemy.group.position.z;
      enemy.group.rotation.y = Math.atan2(dx, dz);
      const length = Math.hypot(dx, dz) || 1;
      const nextX = enemy.group.position.x + dx / length * enemy.speed * .35 * dt;
      const nextZ = enemy.group.position.z + dz / length * enemy.speed * .35 * dt;
      if (!collides(nextX, enemy.group.position.z)) enemy.group.position.x = nextX;
      if (!collides(enemy.group.position.x, nextZ)) enemy.group.position.z = nextZ;
    }
  }
}

function damagePlayer(amount) {
  if (state.dead) return;
  const now=performance.now(); state.lastDamageAt=now;
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
  blast.position.copy(state.position).add(new THREE.Vector3(0,-state.eyeHeight+.6,0)); world.add(blast); blastEffects.push({mesh:blast,age:0,radius});
  ui.status.textContent = 'REBOUND SHIELD // KINETIC PUSH';
}

function playerDeath() {
  state.dead = true; state.matchDeaths++; progress.stats.deaths++; saveProgress(); state.mouseDown = false; state.camoUntil = 0; releaseGrapple(); removeRewindAnchor(); setAiming(false); keys.clear(); document.exitPointerLock();
  ui.deathKills.textContent = state.enemyKills; ui.deathCash.textContent = `$${progress.cash}`;
  ui.death.classList.remove('hidden'); ui.interaction.classList.remove('show');
}

function redeployPlayer() {
  state.dead = false; state.health = 100; state.shield = 50; state.lastDamageAt=0; state.reboundTriggered = false; state.camoUntil = 0; state.healRemaining = 0; state.speedBoostUntil = 0; state.eyeHeight = 1.75; state.crouching = false; state.sliding = false;
  state.position.copy(arenaDefinitions[state.activeArena].spawn); state.position.y = groundHeightAt(state.position.x, state.position.z) + state.eyeHeight; state.velocity.set(0, 0, 0);
  state.hostileMode = false; ui.modeName.textContent = 'PEACEFUL'; ui.modeDisplay.classList.remove('hostile'); ui.modeDisplay.classList.add('peaceful');
  updateVitals(); ui.death.classList.add('hidden');
  enemies.forEach((enemy, index) => {
    if (enemy.respawnTimer) clearTimeout(enemy.respawnTimer); enemy.respawnTimer = null;
    enemy.group.position.copy(enemySpawns[index]); enemy.group.rotation.set(0, 0, 0); enemy.health = 140; enemy.alive = true; enemy.pingedUntil = 0; enemy.pingShell.visible = false; enemy.nextShot = performance.now() + 1800 + index * 180;
    ui.enemyBlips[index].classList.remove('down');
  });
  state.hostiles = enemies.length; ui.enemies.textContent = String(state.hostiles).padStart(2, '0');
  const gun = loadout[state.weaponIndex]; gun.ammo = gun.magSize; gun.reserve = gun.maxReserve; updateAmmo();
  ui.status.textContent = 'REDEPLOYED // PEACEFUL MODE'; requestLock();
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
  updateAcousticWaves(dt); updateMagnetLinks(); updateWireTraps(); updateThrownExplosives(dt); updateThrowTrajectory(); updateUtilitySystems(dt);
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
function tuneRenderQuality(now) {
  performanceFrameCount++;
  const elapsed=now-performanceWindowStart; if(elapsed<2200) return;
  const fps=performanceFrameCount*1000/elapsed;
  const pixelRatioMaximum=configuredPixelRatioMaximum();
  if(renderPixelRatio>pixelRatioMaximum){renderPixelRatio=pixelRatioMaximum;renderer.setPixelRatio(renderPixelRatio);}
  if(fps<48&&renderPixelRatio>.72){renderPixelRatio=Math.max(.72,renderPixelRatio-.14);renderer.setPixelRatio(renderPixelRatio);fastPerformanceWindows=0;}
  else if(fps>58&&renderPixelRatio<pixelRatioMaximum){fastPerformanceWindows++;if(fastPerformanceWindows>=3){renderPixelRatio=Math.min(pixelRatioMaximum,renderPixelRatio+.08);renderer.setPixelRatio(renderPixelRatio);fastPerformanceWindows=0;}}
  else fastPerformanceWindows=0;
  performanceWindowStart=now; performanceFrameCount=0;
}

function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), .05);
  const time = clock.elapsedTime;
  const now = performance.now();
  if(!state.started){renderLobbyPreview(time,dt);return;}
  tuneRenderQuality(now); updateAbilitySystems(dt, now); updateShieldRegeneration(dt,now);
  if (state.started && !state.countdownActive && !state.completed && !state.armoryOpen && !state.dead) updatePlayer(dt);
  const currentGun = loadout[state.weaponIndex];
  if (state.mouseDown && state.locked && currentGun.automatic) fire();
  updateArenaEnvironment(time, now, dt); updateDummies(time, dt); updateLootCrates(time);
  if(state.started){updateEnemies(time,dt);updateExperimentalSystems(dt);}
  if(now-lastUiFrame>=100){lastUiFrame=now;updateContractClock(now);refreshAbilityHUD(now);updateRegeneratingAmmo(now);updateHotbarIndicators(now);updateLootInteraction();updateRadar(now);}
  weapon.rotation.x = THREE.MathUtils.damp(weapon.rotation.x, -.035, 18, dt);
  weapon.rotation.z = THREE.MathUtils.damp(weapon.rotation.z, currentGun.kind === 'pistol' ? .07 : 0, 10, dt);
  if (!state.reloading) weapon.position.y = THREE.MathUtils.damp(weapon.position.y, -.4, 12, dt);
  currentGun.model.userData.muzzle.intensity = THREE.MathUtils.damp(currentGun.model.userData.muzzle.intensity, 0, 38, dt);
  currentGun.model.userData.flash.material.opacity = THREE.MathUtils.damp(currentGun.model.userData.flash.material.opacity, 0, 45, dt);
  renderer.render(scene, camera);
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
ui.targets.textContent = String(state.targets).padStart(2, '0');
ui.enemies.textContent = String(state.hostiles).padStart(2, '0');
syncArenaVisibility(state.activeArena);
animate();

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
  renderer.setPixelRatio(renderPixelRatio); renderer.setSize(innerWidth, innerHeight); renderer.shadowMap.needsUpdate=true;
});
