import { CHILL_DECK_LAYOUT } from './lobby-hub.js';

export const DUEL_TEAM_SIZES = Object.freeze([1, 2, 3, 4]);

export const FUTURE_MINIGAMES = Object.freeze([
  Object.freeze({ id:'signal-rush', name:'SIGNAL RUSH' }),
  Object.freeze({ id:'core-relay', name:'CORE RELAY' }),
  Object.freeze({ id:'low-gravity', name:'LOW GRAVITY' }),
  Object.freeze({ id:'target-storm', name:'TARGET STORM' }),
]);

export const PARKOUR_SURFACE_COLORS = Object.freeze({
  checkpoint:0x50e5ff,
  boost:0x67e85d,
  jump:0x4f8dff,
  launch:0xff8a3d,
  grapple:0xa96cff,
  moving:0xffd166,
  hazard:0xff405c,
  secret:0xffc857,
  solid:0xf2f7ff,
});

export const PARKOUR_REWARDS = Object.freeze({
  complete:50,
  bronze:75,
  silver:125,
  gold:250,
  repeat:15,
});

const variant = (id,name,description,modifiers={}) => Object.freeze({
  id,name,description,modifiers:Object.freeze(modifiers),
});

export const PARKOUR_VARIANTS = Object.freeze({
  'neon-velocity':Object.freeze([
    variant('normal','NORMAL RUN','Standard checkpoints and movement.'),
    variant('reverse','REVERSE RUN','The route is raced from finish to start.',{reverse:true}),
    variant('low-gravity','LOW GRAVITY','Higher jumps with slower falling.',{gravityScale:.68,jumpScale:1.18}),
    variant('no-mistakes','NO MISTAKES','A fall restarts the attempt.',{restartOnFall:true}),
    variant('orb-hunt','ORB HUNT','Collect every Velocity Orb before finishing.',{collectiblesRequired:true}),
  ]),
  'canopy-circuit':Object.freeze([
    variant('canopy-storm','CANOPY STORM','Crosswinds bend airborne routes.',{crosswind:2.2}),
    variant('treasure-run','TREASURE RUN','Collect every jungle key before finishing.',{collectiblesRequired:true}),
    variant('vine-master','VINE MASTER','Grapple cooldowns recover rapidly.',{grappleCooldownScale:.25}),
    variant('grounded','GROUNDED','Grappling is disabled.',{disableGrapple:true}),
    variant('rising-water','RISING WATER','The recovery floor rises as time passes.',{risingDanger:true}),
  ]),
  'foundry-rush':Object.freeze([
    variant('overdrive','FACTORY OVERDRIVE','Machinery and movement run 30% faster.',{speedScale:1.3,machineryScale:1.3}),
    variant('floor-is-lava','FLOOR IS LAVA','Only course-marked surfaces are safe.',{floorIsLava:true}),
    variant('perfect-run','PERFECT RUN','A fall restarts the attempt.',{restartOnFall:true}),
    variant('random-machinery','RANDOM MACHINERY','Obstacle timing changes each run.',{randomMachinery:true}),
    variant('bomb-jump','BOMB JUMP RUN','Training blast jumps are enabled.',{bombJump:true}),
  ]),
});

export const PARKOUR_COURSES = Object.freeze([
  Object.freeze({
    id:'neon-velocity', name:'NEON VELOCITY', map:'CHILL DECK', zone:'NEON WING', location:'chill-deck', arena:1, difficulty:'FLOW', color:0x50e5ff,
    targetTime:96, collectibleName:'VELOCITY ORB', collectibleCount:7,
    description:'Race the extended Neon Wing through eight checkpoint sectors, fixed rooftops, internal vault walls, a wide speed bridge, and two optional side routes.',
    medalTimes:Object.freeze({ gold:68, silver:96, bronze:132 }),
  }),
  Object.freeze({
    id:'canopy-circuit', name:'CANOPY CIRCUIT', map:'CHILL DECK', zone:'CANOPY GARDEN', location:'chill-deck', arena:1, difficulty:'TECHNICAL', color:0x67e8a5,
    targetTime:118, collectibleName:'JUNGLE KEY', collectibleCount:5,
    description:'Cross the extended Canopy Garden on broad static branches, guided grapples, walled tree tunnels, and a separate scenic recovery route.',
    medalTimes:Object.freeze({ gold:82, silver:118, bronze:160 }),
  }),
  Object.freeze({
    id:'foundry-rush', name:'FOUNDRY RUSH', map:'CHILL DECK', zone:'FOUNDRY BAY', location:'chill-deck', arena:1, difficulty:'EXTREME', color:0xff7043,
    targetTime:142, collectibleName:'FOUNDRY CORE', collectibleCount:5,
    description:'Run the extended Foundry Bay through warned machinery, solid catwalks, interior walls, a lower bypass, and an aligned boost chute.',
    medalTimes:Object.freeze({ gold:98, silver:142, bronze:190 }),
  }),
]);

const freezePoint = point => Object.freeze(point);
const coursePoints=(center,points)=>Object.freeze(points.map(([offset,z])=>freezePoint([center+offset,z])));
const [neonCenter,canopyCenter,foundryCenter]=CHILL_DECK_LAYOUT.courseCenters;
const routeStep=(id,label,options={})=>Object.freeze({
  id,label,checkpointBefore:true,minWidthCapsules:3,movingRequired:false,disappearingRequired:false,blindJump:false,maxRequiredCharge:.6,
  ordinaryGapRatio:.5,largeGapRatio:.65,landingMarker:true,directionArrow:true,...options,
});
const routePlan=(steps,recoveryZones,expertSteps,options={})=>Object.freeze({
  routeType:'MAIN ROUTE — SAFE',steps:Object.freeze(steps),recoveryZones:Object.freeze(recoveryZones.map(freezePoint)),
  checkpointCadence:3,fallRecoveryMs:900,returnPortal:true,
  routeColors:Object.freeze({main:'green',expert:'red-gold',treasure:'purple',recovery:'blue'}),
  expert:Object.freeze({label:'EXPERT SHORTCUT — DIFFICULT',reconnects:true,reward:'FASTER TIME + TREASURE + BONUS COINS',steps:Object.freeze(expertSteps)}),
  ...options,
});

export const PARKOUR_ROUTES = Object.freeze([
  Object.freeze({
    id:'neon-velocity',
    location:'chill-deck',zone:'neon-wing',spawn:freezePoint([neonCenter,CHILL_DECK_LAYOUT.portalZ]),
    checkpoints:coursePoints(neonCenter,[[0,278],[-4,260],[4,241],[-5,222],[5,203],[-5,184],[5,164],[0,144],[0,124]]),
    plan:routePlan([
      routeStep('sprint','WIDE SPRINT LANE'),routeStep('vaults','THREE LOW VAULTS'),routeStep('slide','TALL, WIDE SLIDE TUNNEL'),
      routeStep('charge','50% CHARGED JUMP',{maxRequiredCharge:.5}),routeStep('launch','AUTOMATIC VERTICAL LAUNCH'),
      routeStep('rooftops','THREE FIXED ROOFTOPS',{minWidthCapsules:4}),routeStep('bridge','WIDE SPEED BRIDGE',{minWidthCapsules:5}),
      routeStep('wallrun','BEGINNER WALL-RUN + LOWER SAFE PATH'),routeStep('reactor','NEON REACTOR GATE'),routeStep('zipline','FINAL ZIP-LINE'),routeStep('vault-path','OPTIONAL TREASURE VAULT PATH'),routeStep('finish','FINISH PLATFORM',{minWidthCapsules:6}),
    ],coursePoints(neonCenter,[[0,270],[0,250],[0,231],[0,212],[0,193],[0,174],[0,154],[0,134]]),[routeStep('data-blocks','MOVING DATA BLOCK ORB ROUTE',{movingRequired:true,maxRequiredCharge:1}),routeStep('zero-gravity','ZERO-GRAVITY SECRET TUNNEL',{maxRequiredCharge:.8})]),
  }),
  Object.freeze({
    id:'canopy-circuit',
    location:'chill-deck',zone:'canopy-garden',spawn:freezePoint([canopyCenter,CHILL_DECK_LAYOUT.portalZ]),
    checkpoints:coursePoints(canopyCenter,[[0,278],[-6,260],[6,241],[-7,222],[8,203],[-8,184],[7,165],[-6,146],[0,126]]),
    plan:routePlan([
      routeStep('mushrooms','WIDE GUIDED MUSHROOMS',{minWidthCapsules:4}),routeStep('grapple','SINGLE GRAPPLE + WALKING BYPASS'),
      routeStep('wallrun','SHORT RUIN WALL-RUN'),routeStep('spore','GUIDED SPORE PAD'),routeStep('tree','HOLLOW-TREE TUNNEL',{minWidthCapsules:4}),
      routeStep('branches','STATIC BRANCH WALKWAY',{minWidthCapsules:3.5}),routeStep('canopy-maze','WALLED CANOPY MAZE'),routeStep('waterfall','WATERFALL CAVE'),routeStep('koi-path','SCENIC KOI SIDE PATH'),routeStep('finish','CANOPY FINISH',{minWidthCapsules:6}),
    ],coursePoints(canopyCenter,[[0,270],[-3,250],[3,231],[-3,212],[3,193],[-3,174],[3,155],[0,136]]),[routeStep('moving-branches','SWAYING TREASURE BRANCHES',{movingRequired:true,maxRequiredCharge:.9}),routeStep('aquarium-vent','AQUARIUM MAINTENANCE SHORTCUT',{maxRequiredCharge:.75})]),
  }),
  Object.freeze({
    id:'foundry-rush',
    location:'chill-deck',zone:'foundry-bay',spawn:freezePoint([foundryCenter,CHILL_DECK_LAYOUT.portalZ]),
    checkpoints:coursePoints(foundryCenter,[[0,278],[0,261],[-8,243],[8,225],[-8,207],[8,189],[-7,171],[7,153],[0,135],[0,118]]),
    plan:routePlan([
      routeStep('pistons','WARNED SLOW PISTONS',{cycleScale:.75,warningMs:1000,safeMs:3000}),routeStep('conveyors','WIDE, SLOW CONVEYORS',{minWidthCapsules:4,speedScale:.55}),
      routeStep('wallrun','SHORT LAVA WALL-RUN + RECOVERY GRATE'),routeStep('launch','GUIDED HORIZONTAL LAUNCH'),
      routeStep('crane','STOPPED CRANE LOADING STATION',{minWidthCapsules:5,dockStopMs:3000,bridgeRequired:true,railingsWhileMoving:true}),routeStep('catwalk','LAVA RECOVERY CATWALK',{minWidthCapsules:3}),
      routeStep('shaft','PAUSING VENTILATION FANS'),routeStep('forge-maze','WALLED FORGE MAZE'),routeStep('boost','AUTO-ALIGNED BOOST CHUTE'),routeStep('lower-bypass','SOLID LOWER BYPASS'),routeStep('finish','FOUNDRY FINISH',{minWidthCapsules:6}),
    ],coursePoints(foundryCenter,[[0,270],[0,252],[-3,234],[3,216],[-3,198],[3,180],[-3,162],[3,144],[0,126]]),[routeStep('crane-bypass','WALL-RUN + GRAPPLE CRANE BYPASS',{movingRequired:true,maxRequiredCharge:1}),routeStep('maintenance-duct','HIDDEN MAINTENANCE DUCT',{maxRequiredCharge:.85})],{transport:Object.freeze({stopsAtDocks:true,dwellMs:3000,walkOnBridge:true,closesRailings:true,carriesPlayer:true})}),
  }),
]);

export function parkourMedalForTime(course,seconds) {
  if (!course?.medalTimes || !Number.isFinite(seconds)) return 'unranked';
  if (seconds <= course.medalTimes.gold) return 'gold';
  if (seconds <= course.medalTimes.silver) return 'silver';
  if (seconds <= course.medalTimes.bronze) return 'bronze';
  return 'complete';
}

export function parkourDayKey(timestamp=Date.now()) {
  const date=new Date(Number.isFinite(timestamp)?timestamp:0);
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth()+1).padStart(2,'0')}-${String(date.getUTCDate()).padStart(2,'0')}`;
}

export function activeParkourVariant(course,timestamp=Date.now()) {
  const variants=PARKOUR_VARIANTS[course?.id]||[];
  if(!variants.length)return null;
  const rotation=Math.floor((Number.isFinite(timestamp)?timestamp:0)/(4*60*60*1000));
  const courseOffset=Math.max(0,PARKOUR_COURSES.findIndex(item=>item.id===course.id));
  return variants[(rotation+courseOffset)%variants.length];
}

export function parkourRewardForCompletion(course,medal,timestamp=Date.now(),dailyClaims={}) {
  const day=parkourDayKey(timestamp);const alreadyClaimed=dailyClaims?.[course?.id]===day;
  return Object.freeze({amount:alreadyClaimed?PARKOUR_REWARDS.repeat:(PARKOUR_REWARDS[medal]||PARKOUR_REWARDS.complete),daily:!alreadyClaimed,day});
}
