export const TRAVERSAL_CONFIG=Object.freeze({
  jumpChargeMs:750,
  wallJumpChargeMs:350,
  coyoteMs:100,
  jumpBufferMs:120,
  assistedJumpBufferMs:180,
  wallRunDurationMs:1250,
  sameWallCooldownMs:350,
  wallDetachMs:180,
  wallRunGravityScale:.3,
  wallRunMinimumSpeed:12,
  wallDetectionDistance:.78,
  maximumCameraRollRadians:8*Math.PI/180,
});

export const clamp01=value=>Math.min(1,Math.max(0,Number(value)||0));
export const smoothCharge=value=>{const amount=clamp01(value);return amount*amount*(3-2*amount);};
export const jumpTier=amount=>amount>=.85?'maximum':amount>=.5?'large':amount>=.2?'medium':'normal';

export function createTraversalState(){
  return {
    chargeStartedAt:0,charging:false,chargeKind:'ground',chargeAmount:0,maxChargePulse:false,
    bufferedJump:null,lastGroundedAt:0,wallRun:null,lastWallId:null,lastWallEndedAt:-Infinity,
    wallDetachUntil:0,wallJumpChain:0,lastWallJumpId:null,ledgeHang:null,railGrind:null,barSwing:null,
    slideJumpChain:0,lastSlideJumpAt:0,rollQueuedUntil:0,cameraRoll:0,tutorialCounts:{},lastParticleAt:0,
  };
}

export function isTypingTarget(target){
  const tag=String(target?.tagName||'').toLowerCase();
  return Boolean(target?.isContentEditable||tag==='input'||tag==='textarea'||tag==='select');
}

export function beginJumpCharge(traversal,now,{kind='ground',blocked=false,repeated=false,typing=false}={}){
  if(!traversal||blocked||repeated||typing||traversal.charging)return false;
  traversal.charging=true;traversal.chargeKind=kind;traversal.chargeStartedAt=now;traversal.chargeAmount=0;traversal.maxChargePulse=false;
  return true;
}

export function updateJumpCharge(traversal,now){
  if(!traversal?.charging)return 0;
  const maximum=traversal.chargeKind==='wall'?TRAVERSAL_CONFIG.wallJumpChargeMs:TRAVERSAL_CONFIG.jumpChargeMs;
  traversal.chargeAmount=clamp01((now-traversal.chargeStartedAt)/maximum);
  if(traversal.chargeAmount>=1)traversal.maxChargePulse=true;
  return traversal.chargeAmount;
}

export function releaseJumpCharge(traversal,now,{assist=false}={}){
  if(!traversal?.charging)return null;
  const amount=updateJumpCharge(traversal,now);const kind=traversal.chargeKind;
  traversal.charging=false;traversal.chargeStartedAt=0;traversal.chargeKind='ground';traversal.chargeAmount=0;traversal.maxChargePulse=false;
  const release={amount,eased:smoothCharge(amount),tier:jumpTier(amount),kind,releasedAt:now,expiresAt:now+(assist?TRAVERSAL_CONFIG.assistedJumpBufferMs:TRAVERSAL_CONFIG.jumpBufferMs)};
  traversal.bufferedJump=release;return release;
}

export function consumeBufferedJump(traversal,now){
  const release=traversal?.bufferedJump;if(!release)return null;
  if(now>release.expiresAt){traversal.bufferedJump=null;return null;}
  traversal.bufferedJump=null;return release;
}

export function clearTraversalState(traversal,{grounded=false,now=0}={}){
  if(!traversal)return traversal;
  const fresh=createTraversalState();Object.assign(traversal,fresh);traversal.lastGroundedAt=grounded?now:0;return traversal;
}

export function wallSurfaceEligible({normalY=0,height=0,length=0,runnable=true,moving=false,curved=false}={}){
  return Boolean(runnable&&!moving&&!curved&&Math.abs(normalY)<.2&&height>=2.4&&length>=2.8);
}

export function canStartWallRun(traversal,{wallId,now,airborne,speed,alongDot=.8}={}){
  if(!traversal||!wallId||!airborne||speed<TRAVERSAL_CONFIG.wallRunMinimumSpeed||Math.abs(alongDot)<.62)return false;
  if(now<traversal.wallDetachUntil)return false;
  if(traversal.lastWallJumpId===wallId)return false;
  return traversal.lastWallId!==wallId||now-traversal.lastWallEndedAt>=TRAVERSAL_CONFIG.sameWallCooldownMs;
}

export function wallJumpVelocity({normal={x:0,z:1},forward={x:0,z:-1},horizontalSpeed=0,charge=0,chain=0}={}){
  const eased=smoothCharge(charge);const decay=Math.max(.68,1-Math.max(0,chain)*.1);const away=(10.5+eased*3.2)*decay;const retained=Math.max(8,Math.min(24,horizontalSpeed*.72));
  return {x:normal.x*away+forward.x*retained,y:(7.6+eased*2.25)*decay,z:normal.z*away+forward.z*retained};
}

export function vaultCandidateValid({height=0,width=0,landingClear=false,ceilingClear=false,pathClear=false,movingSpeed=0,hazardous=false,playerHeight=1.75}={}){
  return Boolean(height>=playerHeight*.25&&height<=playerHeight*.7&&width<=2.6&&landingClear&&ceilingClear&&pathClear&&movingSpeed<2&&!hazardous);
}

export function mantleCandidateValid({height=0,standingRoom=false,pathClear=false,hazardous=false,playerHeight=1.75}={}){
  return Boolean(height>playerHeight*.7&&height<=playerHeight*1.25&&standingRoom&&pathClear&&!hazardous);
}

export function ledgeGrabValid({descending=false,approachingFront=false,topAboveFeet=0,standingRoom=false,underside=false,thin=false,hazardous=false,playerHeight=1.75}={}){
  return Boolean(descending&&approachingFront&&!underside&&!thin&&!hazardous&&standingRoom&&topAboveFeet>=playerHeight*.55&&topAboveFeet<=playerHeight*1.32);
}

export function resetTraversalAtCheckpoint(traversal,now=0){return clearTraversalState(traversal,{grounded:true,now});}

export function movingPlatformCarry(position,delta){
  return {x:(position?.x||0)+(delta?.x||0),y:(position?.y||0)+(delta?.y||0),z:(position?.z||0)+(delta?.z||0)};
}

export function guidedLaunchVelocity({from={x:0,y:0,z:0},to={x:0,y:0,z:0},gravity=18,horizontalSpeed=48,minVertical=5.5,maxVertical=24}={}){
  const dx=Number(to.x)-Number(from.x);const dz=Number(to.z)-Number(from.z);const distance=Math.hypot(dx,dz);
  if(!Number.isFinite(distance)||distance<.001)return{x:0,y:Math.max(0,Number(minVertical)||0),z:0,flightTime:0};
  const speed=Math.max(1,Number(horizontalSpeed)||48);const flightTime=Math.max(.55,distance/speed);const heightDelta=Number(to.y)-Number(from.y);
  const rawVertical=(heightDelta+.5*Math.max(0,Number(gravity)||0)*flightTime*flightTime)/flightTime;
  const vertical=Math.min(Math.max(0,Number(maxVertical)||0),Math.max(Math.max(0,Number(minVertical)||0),rawVertical));
  return{x:dx/distance*speed,y:vertical,z:dz/distance*speed,flightTime};
}

export function assistedLandingDelta({enabled=false,position,velocity,target,maxCorrectionDistance=1.15,maxStep=.12}={}){
  if(!enabled||!position||!target||Number(velocity?.y)>=0)return {x:0,z:0,active:false};
  const dx=Number(target.x)-Number(position.x);const dz=Number(target.z)-Number(position.z);const distance=Math.hypot(dx,dz);
  const radius=Math.max(0,Number(target.radius)||0);const excess=distance-radius;
  const feet=Number(position.y)-(Number(position.eyeHeight)||1.75);const vertical=feet-Number(target.y);
  if(!Number.isFinite(distance)||distance===0||excess<=0||excess>maxCorrectionDistance||vertical<-.15||vertical>5.5)return {x:0,z:0,active:false};
  const amount=Math.min(Math.max(0,Number(maxStep)||0),excess);return{x:dx/distance*amount,z:dz/distance*amount,active:amount>0};
}

export function cameraRollTarget(side,{disabled=false,reducedMotion=false,maximum=TRAVERSAL_CONFIG.maximumCameraRollRadians}={}){
  return disabled||reducedMotion?0:Math.sign(Number(side)||0)*Math.max(0,Number(maximum)||0);
}
