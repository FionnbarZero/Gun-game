export const COMBAT_ROLES=Object.freeze({
  robot:'armed-robot',
  target:'practice-target',
});

export const AI_STATES=Object.freeze({
  patrol:'PATROL',investigate:'INVESTIGATE',react:'REACT',aim:'AIM',fire:'FIRE',reload:'RELOAD',search:'SEARCH',takeCover:'TAKE COVER',
});

// Profiles change perception and gun handling, never health. Keeping this data
// pure also lets the future authoritative server run the same rules.
const profile=(values)=>Object.freeze(values);
export const ENEMY_DIFFICULTY_PROFILES=Object.freeze({
  training:profile({reactionMin:1000,reactionMax:1500,reaction:1250,tracking:1.25,error:.135,missMin:.65,missMax:.75,maxConsecutiveHits:2,burstMin:1,burstMax:2,shotGap:500,pauseMin:1900,pauseMax:2850,damageMin:3,damageMax:6,turnSpeed:1.55,verticalTurnSpeed:1.05,memoryMs:1100,magazine:8,reloadMs:2600,attackerLimit:2,spawnAwarenessMs:1250,headshotChance:0}),
  easy:profile({reactionMin:800,reactionMax:1250,reaction:1025,tracking:1.55,error:.108,missMin:.5,missMax:.65,maxConsecutiveHits:3,burstMin:1,burstMax:3,shotGap:450,pauseMin:1550,pauseMax:2450,damageMin:4,damageMax:7,turnSpeed:1.9,verticalTurnSpeed:1.3,memoryMs:1350,magazine:10,reloadMs:2300,attackerLimit:2,spawnAwarenessMs:1000,headshotChance:.01}),
  normal:profile({reactionMin:550,reactionMax:900,reaction:725,tracking:2.05,error:.078,missMin:.35,missMax:.5,maxConsecutiveHits:4,burstMin:2,burstMax:4,shotGap:390,pauseMin:1050,pauseMax:1800,damageMin:5,damageMax:8,turnSpeed:2.35,verticalTurnSpeed:1.55,memoryMs:1650,magazine:12,reloadMs:2050,attackerLimit:3,spawnAwarenessMs:800,headshotChance:.04}),
  hard:profile({reactionMin:350,reactionMax:650,reaction:500,tracking:2.8,error:.052,missMin:.2,missMax:.35,maxConsecutiveHits:5,burstMin:2,burstMax:5,shotGap:330,pauseMin:800,pauseMax:1350,damageMin:6,damageMax:10,turnSpeed:2.9,verticalTurnSpeed:1.9,memoryMs:1950,magazine:14,reloadMs:1850,attackerLimit:4,spawnAwarenessMs:650,headshotChance:.08}),
});

export function isArmedRobot(entity) {
  return Boolean(entity?.alive&&entity.kind==='enemy'&&entity.combatRole===COMBAT_ROLES.robot&&entity.canShoot===true);
}

export function isPracticeTarget(entity) {
  return Boolean(entity?.kind==='dummy'||entity?.combatRole===COMBAT_ROLES.target);
}

export function nearestRobotRival(robot,entities,maximumDistance=105) {
  if(!isArmedRobot(robot))return null;
  const origin=robot.group?.position||robot.position;if(!origin)return null;
  let rival=null;let nearestSquared=maximumDistance*maximumDistance;
  for(const candidate of entities){
    if(candidate===robot||!isArmedRobot(candidate)||candidate.arena!==robot.arena)continue;
    const point=candidate.group?.position||candidate.position;if(!point)continue;
    const dx=point.x-origin.x;const dz=point.z-origin.z;const distanceSquared=dx*dx+dz*dz;
    if(distanceSquared<nearestSquared){nearestSquared=distanceSquared;rival=candidate;}
  }
  return rival;
}

export function sampleReactionDelay(profile,randomValue=.5,{behind=false,obscured=false,far=false,movingFast=false,hurt=false}={}){
  const t=Math.min(1,Math.max(0,Number(randomValue)||0));
  const base=profile.reactionMin+(profile.reactionMax-profile.reactionMin)*t;
  return Math.round(base*(1+(behind?.32:0)+(obscured?.22:0)+(far?.16:0)+(movingFast?.14:0)+(hurt?.18:0)));
}

export function aimErrorRadius(profile,{distance=0,targetSpeed=0,npcMoving=false,targetSliding=false,targetAirborne=false,recentlyHurt=false,confidence=0}={}){
  const motion=Math.min(.085,Math.max(0,targetSpeed)*.0022);
  const modifiers=Math.max(0,distance)*.00038+motion+(npcMoving?.027:0)+(targetSliding?.04:0)+(targetAirborne?.032:0)+(recentlyHurt?.045:0);
  return Math.max(profile.error*.55,(profile.error+modifiers)*(1-Math.min(.55,Math.max(0,confidence))));
}

export function shouldForceMiss(profile,consecutiveHits,randomValue=.5){
  if(consecutiveHits>=profile.maxConsecutiveHits)return true;
  const missChance=profile.missMin+(profile.missMax-profile.missMin)*.5;
  return Number(randomValue)<missChance;
}

export function stepAngle(current,target,maxRadians){
  let delta=((target-current+Math.PI)%(Math.PI*2)+Math.PI*2)%(Math.PI*2)-Math.PI;
  delta=Math.max(-maxRadians,Math.min(maxRadians,delta));
  return current+delta;
}

export function beginReload(enemy,profile,now){
  enemy.aiState=AI_STATES.reload;enemy.reloadEndsAt=now+profile.reloadMs;enemy.burstRemaining=0;return enemy.reloadEndsAt;
}

export function updateReload(enemy,profile,now){
  if(enemy.aiState!==AI_STATES.reload||now<enemy.reloadEndsAt)return false;
  enemy.ammo=enemy.magazine||profile.magazine;enemy.aiState=AI_STATES.search;enemy.recoveryUntil=now+240;return true;
}
