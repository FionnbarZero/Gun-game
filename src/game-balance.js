export const ORIGINAL_CRATE_PRICES = Object.freeze({
  standard:250,
  elite:750,
});

const PREMIUM_PRICE_FLOOR = 4000;
const PREMIUM_PRICE_CEILING = 35000;

function clamp(value,min,max) {
  return Math.min(max,Math.max(min,value));
}

export function directWeaponPrice(basePrice) {
  if (!Number.isFinite(basePrice) || basePrice <= 0) return 0;
  return Math.max(750,Math.round(basePrice*.95/50)*50);
}

export function weaponBalanceForPrice(basePrice,{usesAmmo=true}={}) {
  const normalizedPrice=Number.isFinite(basePrice)?basePrice:0;
  const premiumTier=clamp((normalizedPrice-PREMIUM_PRICE_FLOOR)/(PREMIUM_PRICE_CEILING-PREMIUM_PRICE_FLOOR),0,1);
  return {
    premiumTier,
    damageMultiplier:1+premiumTier*.18,
    reloadMultiplier:1-premiumTier*.12,
    reserveMultiplier:usesAmmo?1.5+premiumTier*.3:1,
  };
}

export function applyWeaponBalance(config) {
  const magSize=config.magSize??20;
  const usesAmmo=config.ammoCost!==0;
  const baseReserve=config.reserve??magSize*5;
  const modifiers=weaponBalanceForPrice(config.price,{usesAmmo});
  const scaleDamage=value=>Number.isFinite(value)?Math.round(value*modifiers.damageMultiplier):value;
  const reloadTime=config.reloadTime??1700;
  const reserve=usesAmmo?Math.ceil(baseReserve*modifiers.reserveMultiplier):baseReserve;
  return {
    magSize,
    reserve,
    damage:scaleDamage(config.damage),
    headDamage:scaleDamage(config.headDamage),
    reloadTime:Math.round(reloadTime*modifiers.reloadMultiplier),
    premiumTier:modifiers.premiumTier,
  };
}
