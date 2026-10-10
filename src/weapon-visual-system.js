const SIGNATURE_STYLES=Object.freeze(['vented','split','armored','skeletal','ribbed','faceted','offset','caged']);

const PROFILE_ALIASES=Object.freeze({
  minigun:'lmg',flame:'launcher',void:'rail',recoil:'shotgun',brass:'rifle',magnet:'rail',wire:'rifle',
  pizza:'launcher',fish:'pistol',toaster:'shotgun',baguette:'sniper',chicken:'rail',banana:'pistol',
  disco:'launcher',cake:'launcher',boba:'smg',gnome:'launcher',sock:'shotgun',condiment:'pistol',cart:'launcher',unicorn:'flame',
  mine:'launcher',grenade:'launcher',medkit:'pistol',crossbow:'rifle',
});

export function stableWeaponHash(value='weapon') {
  let hash=2166136261;
  for(const character of String(value)){hash^=character.charCodeAt(0);hash=Math.imul(hash,16777619);}
  return hash>>>0;
}

function includesAny(value,words) {
  return words.some(word=>value.includes(word));
}

function signatureFor(config,hash) {
  const text=`${config.id||''} ${config.name||''} ${config.weaponClass||''} ${config.trait||''} ${config.special||''}`.toUpperCase();
  if(includesAny(text,['GLASS','PRISM','CRYSTAL','DIAMOND']))return'crystal';
  if(includesAny(text,['SONIC','ECHO','REVERB','HARMONIC','TWINBEAT','RESONANCE','DECIBEL','PITCH']))return'sonic';
  if(includesAny(text,['ARC','STORM','COIL','ELECTR','MAGNET','POLARITY']))return'coil';
  if(includesAny(text,['PHASE','BLINK','VOID','NULL','GLITCH']))return'phase';
  if(includesAny(text,['ORBIT','GRAVITY','SINGULARITY','CHRONO']))return'orbital';
  if(includesAny(text,['METEOR','TECTONIC','AFTERSHOCK','PISTON','KICKBACK','KINETIC']))return'kinetic';
  if(includesAny(text,['TRACKER','RADAR','SENSOR','GUIDED','SMART']))return'sensor';
  if(includesAny(text,['FLAME','HEAT','LAVA','TOAST','WAFFLE']))return'thermal';
  if(includesAny(text,['HEAL','MEDKIT','NANITE','ADRENALINE']))return'medical';
  return SIGNATURE_STYLES[hash%SIGNATURE_STYLES.length];
}

function meleeStyleFor(config) {
  const text=`${config.id||''} ${config.name||''} ${config.special||''}`.toUpperCase();
  if(text.includes('TUNING'))return'tuning-fork';
  if(text.includes('HOOK'))return'hook';
  if(text.includes('KATANA'))return'katana';
  if(text.includes('HAMMER'))return'hammer';
  if(text.includes('BATON'))return'baton';
  if(text.includes('GLASS'))return'glass-blade';
  if(text.includes('GAUNTLET'))return'gauntlet';
  if(text.includes('AXE'))return'axe';
  if(text.includes('WHIP'))return'whip';
  if(text.includes('SABER'))return'saber';
  return'knife';
}

function magazineStyleFor(config,profileKind) {
  const weaponClass=String(config.weaponClass||'').toUpperCase();
  if(['knife','grenade','mine','medkit'].includes(config.kind)||config.ammoCost===0)return'none';
  if(weaponClass.includes('REVOLVER'))return'cylinder';
  if(weaponClass.includes('DERRINGER')||config.magSize<=2&&profileKind==='pistol')return'chamber';
  if(profileKind==='shotgun')return config.automatic||weaponClass.includes('DRUM')?'drum':'tube';
  if(profileKind==='lmg')return config.magSize>=100?'box-belt':'drum';
  if(['rail','launcher'].includes(profileKind))return'cell';
  if(profileKind==='pistol')return'grip';
  if(profileKind==='smg')return config.magSize>=40?'quad':'straight';
  if(profileKind==='sniper')return'box';
  return'curved';
}

function stockStyleFor(config,profileKind,hash) {
  if(['pistol','knife'].includes(profileKind)||['grenade','mine','medkit'].includes(config.kind))return'none';
  if(profileKind==='launcher')return'shoulder';
  if(profileKind==='smg')return hash%2?'folding':'brace';
  if(profileKind==='sniper')return hash%3?'precision':'skeleton';
  if(profileKind==='lmg')return'heavy';
  return ['solid','skeleton','folding'][hash%3];
}

export function weaponVisualDefinition(config={}) {
  const id=String(config.id||config.name||config.kind||'weapon');
  const hash=stableWeaponHash(id);
  const visualKind=config.modelKind||config.kind||'rifle';
  const profileKind=PROFILE_ALIASES[visualKind]||visualKind;
  const signature=signatureFor(config,hash);
  const utility=['knife','grenade','mine','medkit'].includes(config.kind);
  const opticStyle=utility?'none':config.scoped?(config.special||config.effect==='pierce'?'advanced-scope':'scope'):
    profileKind==='sniper'?'scope':profileKind==='shotgun'?'bead':profileKind==='pistol'?'iron':hash%2?'reflex':'compact';
  const muzzleStyle=config.silent?'suppressor':config.effect==='explosive'?'bell':
    ['rail','void','magnet'].includes(visualKind)||config.effect==='pierce'?'emitter':profileKind==='shotgun'?'choke':'brake';
  const receiverScale=.94+((hash>>>5)&7)*.021;
  const barrelScale=.9+((hash>>>11)&7)*.035;
  const widthScale=.94+((hash>>>17)&7)*.018;
  const magazineStyle=magazineStyleFor(config,profileKind);
  const stockStyle=stockStyleFor(config,profileKind,hash);
  const meleeStyle=config.kind==='knife'?meleeStyleFor(config):null;
  const variant=hash%8;
  return Object.freeze({
    id,hash,visualKind,profileKind,signature,opticStyle,muzzleStyle,magazineStyle,stockStyle,meleeStyle,variant,
    receiverScale,barrelScale,widthScale,panelCount:2+(hash%4),railCount:3+((hash>>>3)%4),
    fingerprint:[profileKind,signature,opticStyle,muzzleStyle,magazineStyle,stockStyle,meleeStyle||'none',variant,hash.toString(36)].join(':'),
  });
}
