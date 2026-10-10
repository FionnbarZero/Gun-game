export const MAP_VOTE_DURATION_SECONDS = 10;

export const DUEL_TEAM_SIZES = Object.freeze([1, 2, 3, 4]);

export const FUTURE_MINIGAMES = Object.freeze([
  Object.freeze({ id:'signal-rush', name:'SIGNAL RUSH' }),
  Object.freeze({ id:'core-relay', name:'CORE RELAY' }),
  Object.freeze({ id:'low-gravity', name:'LOW GRAVITY' }),
  Object.freeze({ id:'target-storm', name:'TARGET STORM' }),
]);

export const PARKOUR_COURSES = Object.freeze([
  Object.freeze({
    id:'neon-velocity', name:'NEON VELOCITY', map:'VERTIGO GRID', arena:0, difficulty:'FLOW', color:0x50e5ff,
    description:'Link glowing ramps, rooftop paths, light bridges, launch pads, and slides before the Center Spire finish.',
    medalTimes:Object.freeze({ gold:29, silver:40, bronze:55 }),
  }),
  Object.freeze({
    id:'canopy-circuit', name:'CANOPY CIRCUIT', map:'OVERGROWN OUTPOST', arena:1, difficulty:'TECHNICAL', color:0x67e8a5,
    description:'Climb the Fallen Titan, transfer across canopy branches, spore pads, cliff ledges, and hidden shortcuts.',
    medalTimes:Object.freeze({ gold:34, silver:47, bronze:65 }),
  }),
  Object.freeze({
    id:'foundry-rush', name:'FOUNDRY RUSH', map:'INDUSTRIAL FOUNDRY', arena:2, difficulty:'EXTREME', color:0xff7043,
    description:'Chain piston launchers, ventilation shafts, moving machinery, lava lanes, catwalks, and speed boosts.',
    medalTimes:Object.freeze({ gold:31, silver:44, bronze:60 }),
  }),
]);

const freezePoint = point => Object.freeze(point);

export const PARKOUR_ROUTES = Object.freeze([
  Object.freeze({
    id:'neon-velocity',
    spawn:freezePoint([-300,90]),
    checkpoints:Object.freeze([[-300,68],[-300,15],[-275,-33],[-220,-33],[-247,18],[-220,49]].map(freezePoint)),
  }),
  Object.freeze({
    id:'canopy-circuit',
    spawn:freezePoint([-48,-48]),
    checkpoints:Object.freeze([[-31,-31],[-10,-10],[16,16],[42,40],[0,66],[-57,50]].map(freezePoint)),
  }),
  Object.freeze({
    id:'foundry-rush',
    spawn:freezePoint([169,-62]),
    checkpoints:Object.freeze([[169,-46],[262,-46],[290,-75],[290,0],[290,74],[271,46],[178,46]].map(freezePoint)),
  }),
]);

export function parkourMedalForTime(course,seconds) {
  if (!course?.medalTimes || !Number.isFinite(seconds)) return 'unranked';
  if (seconds <= course.medalTimes.gold) return 'gold';
  if (seconds <= course.medalTimes.silver) return 'silver';
  if (seconds <= course.medalTimes.bronze) return 'bronze';
  return 'complete';
}

export function soloVoteTally(mapCount,selectedIndex=0) {
  const count=Math.max(0,Math.floor(Number(mapCount)||0));
  const selected=Math.min(Math.max(0,Math.floor(Number(selectedIndex)||0)),Math.max(0,count-1));
  return Array.from({length:count},(_,index)=>index===selected?1:0);
}

export function winningMapIndex(votes, preferredIndex = 0) {
  if (!Array.isArray(votes) || votes.length === 0) return 0;
  const highest = Math.max(...votes.map(value => Number.isFinite(value) ? value : 0));
  const tied = votes.map((value, index) => ({ value:Number.isFinite(value) ? value : 0, index })).filter(entry => entry.value === highest);
  return tied.some(entry => entry.index === preferredIndex) ? preferredIndex : tied[0].index;
}
