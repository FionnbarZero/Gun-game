export const LOBBY_PARKOUR = Object.freeze({
  reward:75,
  repeatReward:20,
  fullRewardCooldownMs:60_000,
  vaultReach:1.5,
  vaultMinHeight:.48,
  vaultMaxHeight:1.55,
  vaultMaxDepth:2.35,
});

export function parkourReward(now,lastFullRewardAt=0) {
  const timestamp=Number.isFinite(now)?now:0;
  const previous=Number.isFinite(lastFullRewardAt)?lastFullRewardAt:0;
  const fullReward=previous<=0||timestamp-previous>=LOBBY_PARKOUR.fullRewardCooldownMs;
  return Object.freeze({amount:fullReward?LOBBY_PARKOUR.reward:LOBBY_PARKOUR.repeatReward,fullReward});
}

export function isVaultableObstacle({feetY=0,minY=0,maxY=0,depth=0,onGround=false,movingForward=false,landingClear=false}={}) {
  const height=maxY-feetY;
  return Boolean(
    onGround&&movingForward&&landingClear&&
    Number.isFinite(height)&&Number.isFinite(depth)&&
    minY<=feetY+.32&&height>=LOBBY_PARKOUR.vaultMinHeight&&
    height<=LOBBY_PARKOUR.vaultMaxHeight&&depth<=LOBBY_PARKOUR.vaultMaxDepth
  );
}

export function formatParkourTime(milliseconds) {
  const safe=Math.max(0,Number(milliseconds)||0);
  return `${(safe/1000).toFixed(2)}S`;
}
