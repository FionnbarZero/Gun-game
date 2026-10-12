import { visualDefinitionExpansion } from './visual-definition-system.js';

const SIGNATURE_STYLES=Object.freeze(['vented','split','armored','skeletal','ribbed','faceted','offset','caged']);
const freeze=value=>Object.freeze(value);

export const WEAPON_MATERIAL_ZONES=freeze(['receiver','barrel','stock','grip','magazine','metal','accent','energy','scopeHousing','scopeLens']);
export const RECOGNIZED_MECHANICAL_ACTIONS=freeze(['slide','cylinder','bolt','pump','feed-cover','spin','energy-chamber','oscillator','arming','applicator','melee']);
export const STANDARD_ATTACHMENT_SOCKETS=freeze({
  optic:freeze([0,.22,-.15]),muzzle:freeze([0,.04,-1.25]),underbarrel:freeze([0,-.15,-.6]),magazine:freeze([0,-.25,0]),stock:freeze([0,0,.55]),
  sideRailLeft:freeze([-.14,.05,-.25]),sideRailRight:freeze([.14,.05,-.25]),
});

const COMPONENT_DEFAULTS=freeze({
  pistol:freeze({receiverStyle:'compact-slide',barrelStyle:'short-recessed',stockStyle:'none',gripStyle:'rubber-pistol',handguardStyle:'none'}),
  smg:freeze({receiverStyle:'compact-stamped',barrelStyle:'short-vented',stockStyle:'folding',gripStyle:'vertical-pistol',handguardStyle:'vented-compact'}),
  rifle:freeze({receiverStyle:'split-receiver',barrelStyle:'carbine-shrouded',stockStyle:'solid',gripStyle:'rubber-pistol',handguardStyle:'modular-rail'}),
  shotgun:freeze({receiverStyle:'reinforced-shotgun',barrelStyle:'wide-smoothbore',stockStyle:'shoulder',gripStyle:'rubber-pistol',handguardStyle:'pump'}),
  sniper:freeze({receiverStyle:'precision-bolt',barrelStyle:'long-fluted',stockStyle:'precision-adjustable',gripStyle:'precision-pistol',handguardStyle:'free-float'}),
  lmg:freeze({receiverStyle:'heavy-feed',barrelStyle:'heavy-heatshield',stockStyle:'heavy',gripStyle:'support-pistol',handguardStyle:'heat-shield'}),
  rail:freeze({receiverStyle:'energy-chamber',barrelStyle:'coil-accelerator',stockStyle:'skeleton',gripStyle:'insulated-pistol',handguardStyle:'capacitor-cage'}),
  launcher:freeze({receiverStyle:'reinforced-launcher',barrelStyle:'large-bore',stockStyle:'shoulder',gripStyle:'support-pistol',handguardStyle:'blast-shield'}),
  knife:freeze({receiverStyle:'melee-hilt',barrelStyle:'blade',stockStyle:'none',gripStyle:'wrapped-hilt',handguardStyle:'guard'}),
});

// Hand-authored identities are deliberately limited to construction and art.
// No entry contains damage, timing, price, ammunition, or other balance data.
const VISUAL_OVERRIDES=freeze({
  sledge:freeze({receiverStyle:'heavy-bolt',barrelStyle:'long-fluted',stockStyle:'precision-adjustable',opticStyle:'advanced-scope',muzzleStyle:'brake',specialParts:['cheek-rest','bipod','oversized-bolt']}),
  helix:freeze({receiverStyle:'light-dmr',barrelStyle:'tapered-marksman',stockStyle:'precision-light',opticStyle:'scope',specialParts:['cheek-rest','bipod-mount']}),
  specter:freeze({receiverStyle:'burst-carbine',barrelStyle:'short-shrouded',stockStyle:'skeleton',opticStyle:'reflex',specialParts:['burst-selector','angled-handguard']}),
  broadside:freeze({receiverStyle:'reinforced-shotgun',barrelStyle:'wide-smoothbore',stockStyle:'shoulder',specialParts:['heavy-pump','tube-magazine']}),
  riot:freeze({receiverStyle:'automatic-shotgun',barrelStyle:'ported-smoothbore',stockStyle:'reinforced',magazineStyle:'drum',specialParts:['drum-brace','gas-piston']}),
  ironclad:freeze({receiverStyle:'heavy-feed',barrelStyle:'heavy-heatshield',stockStyle:'heavy',specialParts:['feed-cover','carry-handle','bipod']}),
  doppler:freeze({receiverStyle:'acoustic-resonator',barrelStyle:'speaker-array',muzzleStyle:'bell',specialParts:['speaker-rings','waveform-display','vibration-panels']}),
  feedback:freeze({receiverStyle:'paired-transceiver',barrelStyle:'twin-prong',specialParts:['transmitter-prongs','wire-coils','paired-nodes']}),
  reverb:freeze({receiverStyle:'echo-receiver',barrelStyle:'resonance-chambers',opticStyle:'advanced-scope',specialParts:['echo-chambers','waveform-display']}),
  'white-noise':freeze({receiverStyle:'static-projector',barrelStyle:'acoustic-cone',muzzleStyle:'bell',specialParts:['speaker-cone','static-panels']}),
  subwoofer:freeze({receiverStyle:'bass-driver',barrelStyle:'compression-cone',muzzleStyle:'bell',specialParts:['bass-driver','speaker-rings']}),
  scalpel:freeze({receiverStyle:'precision-emitter',barrelStyle:'needle-emitter',opticStyle:'advanced-scope',specialParts:['cutting-line','frequency-display']}),
  singularity:freeze({receiverStyle:'gravity-cage',barrelStyle:'contained-core',specialParts:['gravity-core','orbit-rings']}),
  glitch:freeze({receiverStyle:'fragmented-receiver',barrelStyle:'phase-emitter',specialParts:['fragment-panels','corruption-display']}),
  tectonic:freeze({receiverStyle:'tungsten-chamber',barrelStyle:'reinforced-ricochet',specialParts:['tungsten-blocks','rebound-gauge']}),
  phase:freeze({receiverStyle:'spatial-chamber',barrelStyle:'portal-emitter',specialParts:['portal-rings','phase-core']}),
  poltergeist:freeze({receiverStyle:'levitated-frame',barrelStyle:'force-emitter',specialParts:['floating-components','force-coils']}),
  'frame-alpha':freeze({receiverStyle:'adaptive-receiver',barrelStyle:'hybrid-carbine',specialParts:['configuration-rails','ballistic-energy-selector']}),
  frankenstein:freeze({receiverStyle:'mismatched-receiver',barrelStyle:'reinforced-smoothbore',specialParts:['mismatched-panels','adapter-brackets']}),
  chimera:freeze({receiverStyle:'dual-feed-receiver',barrelStyle:'short-vented',magazineStyle:'dual-well',specialParts:['dual-magazine-wells','sonic-feed']}),
  aegis:freeze({receiverStyle:'kinetic-collector',barrelStyle:'rail-carbine',specialParts:['kinetic-collector','rail-chamber']}),
  overclocked:freeze({receiverStyle:'overclocked-chassis',barrelStyle:'heat-vented',specialParts:['fire-rate-dial','heat-vents']}),
  catalyst:freeze({receiverStyle:'elemental-primer',barrelStyle:'module-socket',specialParts:['element-canisters','barrel-lock']}),
  'hybrid-bolt':freeze({receiverStyle:'plasma-bolt',barrelStyle:'charged-coil',stockStyle:'precision-adjustable',opticStyle:'advanced-scope',specialParts:['energy-capacitor','charging-coils','oversized-bolt']}),
  bastion:freeze({receiverStyle:'deployable-heavy',barrelStyle:'heavy-heatshield',stockStyle:'heavy',specialParts:['feed-cover','carry-handle','deployable-bipod']}),
  vector:freeze({receiverStyle:'smart-guidance',barrelStyle:'guided-accelerator',opticStyle:'advanced-scope',specialParts:['guidance-fins','tracking-sensors','smart-indicators']}),
  'pizza-party-launcher':freeze({receiverStyle:'pizza-box',barrelStyle:'oven-muzzle',specialParts:['rotating-pizza','slice-indicators','cheese-chamber']}),
  'red-fish-blaster':freeze({receiverStyle:'fish-body',barrelStyle:'water-muzzle',specialParts:['water-tank','fish-fins','moving-eyes']}),
  'tactical-toaster':freeze({receiverStyle:'toaster-body',barrelStyle:'toast-slots',specialParts:['toast-slots','heat-dial','toast-ammo']}),
  'baguette-bolt-action':freeze({receiverStyle:'bread-receiver',barrelStyle:'baguette-barrel',opticStyle:'advanced-scope',specialParts:['crust-cuts','jam-jar-scope','bread-bolt']}),
  'rubber-chicken-railgun':freeze({receiverStyle:'chicken-body',barrelStyle:'beak-emitter',opticStyle:'advanced-scope',specialParts:['charge-coil','moving-tail','chicken-eye']}),
  'banana-peel-revolver':freeze({receiverStyle:'banana-frame',barrelStyle:'banana-muzzle',magazineStyle:'cylinder',specialParts:['revolver-cylinder','hammer','banana-peel']}),
  'bubble-tea-smg':freeze({receiverStyle:'cup-receiver',barrelStyle:'straw-barrel',magazineStyle:'boba-cup',specialParts:['boba-pearls','transparent-cup','straw-barrel']}),
  'birthday-cake-cannon':freeze({receiverStyle:'cake-stack',barrelStyle:'candle-emitter',opticStyle:'reflex',specialParts:['cake-layers','candle-fuse','icing-panels']}),
  'shopping-cart-cannon':freeze({receiverStyle:'cart-frame',barrelStyle:'reinforced-launcher',opticStyle:'reflex',specialParts:['cart-wheels','basket-frame','reinforced-barrel']}),
  'unicorn-sprinkler':freeze({receiverStyle:'unicorn-body',barrelStyle:'horn-emitter',opticStyle:'reflex',specialParts:['horn-emitter','rainbow-tubes','water-reservoir']}),
});

const PROFILE_ALIASES=Object.freeze({
  minigun:'lmg',flame:'launcher',void:'rail',recoil:'shotgun',brass:'rifle',magnet:'rail',wire:'rifle',
  pizza:'launcher',fish:'pistol',toaster:'shotgun',baguette:'sniper',chicken:'rail',banana:'pistol',
  disco:'launcher',cake:'launcher',boba:'smg',gnome:'launcher',sock:'shotgun',condiment:'pistol',cart:'launcher',unicorn:'launcher',
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

function receiverStyleFor(config,profileKind,signature,hash){
  const defaults=COMPONENT_DEFAULTS[profileKind]||COMPONENT_DEFAULTS.rifle;
  if(signature==='sonic')return'acoustic-resonator';
  if(signature==='coil')return'capacitor-receiver';
  if(signature==='phase')return'phase-split-receiver';
  if(signature==='orbital')return'gravity-cage';
  return hash%3===0?`${defaults.receiverStyle}-faceted`:defaults.receiverStyle;
}

function barrelStyleFor(config,profileKind,signature,hash){
  const defaults=COMPONENT_DEFAULTS[profileKind]||COMPONENT_DEFAULTS.rifle;
  if(config.silent)return'suppressed-integral';
  if(signature==='sonic')return hash%2?'resonance-chambers':'speaker-array';
  if(signature==='coil')return'coil-accelerator';
  if(signature==='phase'||signature==='orbital')return'contained-emitter';
  return defaults.barrelStyle;
}

function gripStyleFor(config,profileKind){
  const defaults=COMPONENT_DEFAULTS[profileKind]||COMPONENT_DEFAULTS.rifle;
  if(String(config.weaponClass||'').toUpperCase().includes('REVOLVER'))return'contoured-revolver';
  return defaults.gripStyle;
}

function colorZonesFor(config,hash){
  const primary=Number(config.color??0x566775);
  const accent=((primary^0x38a7d4)&0xffffff) || 0x50e5ff;
  return freeze({primary,secondary:hash%2?0x171d28:0x202936,metal:0xaeb8c2,accent,energy:config.color??0x50e5ff,grip:0x12171e,scopeHousing:0x181e29,scopeLens:0x73b5bd});
}

function attachmentPointsFor(profileKind,scopeProfile){
  const muzzleZ=profileKind==='pistol'?-.8:profileKind==='smg'?-.9:profileKind==='shotgun'?-1.28:profileKind==='sniper'?-1.58:profileKind==='lmg'?-1.48:['rail','launcher'].includes(profileKind)?-1.5:-1.22;
  const supportZ=profileKind==='pistol'?-.28:profileKind==='shotgun'?-.58:profileKind==='sniper'?-.62:profileKind==='lmg'?-.58:-.48;
  return freeze({
    muzzle:freeze([0,.04,muzzleZ]),sight:freeze([...(scopeProfile.sightAnchor||[0,.2,-.2])]),ejection:freeze([.13,.08,-.08]),
    leftHand:freeze([0,-.11,supportZ]),rightHand:freeze([0,-.24,.03]),charm:freeze([.2,-.04,.12]),magazine:freeze([0,-.24,.02]),
  });
}

function viewModelProfileFor(profileKind){
  if(profileKind==='pistol')return freeze({hip:freeze([.57,-.32,-.72]),scale:.94,oneHanded:true,maxScreenWidth:.36});
  if(profileKind==='sniper')return freeze({hip:freeze([.42,-.47,-.78]),scale:.94,oneHanded:false,maxScreenWidth:.56});
  if(profileKind==='lmg')return freeze({hip:freeze([.43,-.48,-.8]),scale:.91,oneHanded:false,maxScreenWidth:.62});
  if(profileKind==='shotgun'||profileKind==='launcher')return freeze({hip:freeze([.43,-.44,-.76]),scale:.94,oneHanded:false,maxScreenWidth:.58});
  return freeze({hip:freeze([.42,-.4,-.72]),scale:1,oneHanded:false,maxScreenWidth:.52});
}

function fingerprintParts(config,signature,variant){
  const text=`${config.id||''} ${config.name||''} ${config.weaponClass||''} ${config.special||''}`.toUpperCase();
  const parts=[];
  if(signature==='sonic')parts.push('resonator-rings','waveform-display');
  if(signature==='coil')parts.push('charge-coils','capacitor');
  if(signature==='phase')parts.push('phase-rings','fragment-panels');
  if(signature==='orbital')parts.push('orbit-rings','contained-core');
  if(signature==='sensor')parts.push('tracking-sensor','status-display');
  if(signature==='thermal')parts.push('heat-vents','temperature-dial');
  if(text.includes('REVOLVER'))parts.push('visible-cylinder','hammer');
  if(text.includes('BIPOD')||text.includes('LMG')||text.includes('SNIPER'))parts.push('bipod-mount');
  parts.push(`identity-panel-${variant}`);
  return parts;
}

function copySockets(){return freeze(Object.fromEntries(Object.entries(STANDARD_ATTACHMENT_SOCKETS).map(([key,value])=>[key,freeze([...value])])));}

export function weaponVisualDefinition(config={}) {
  const id=String(config.id||config.name||config.kind||'weapon');
  const hash=stableWeaponHash(id);
  const visualKind=config.modelKind||config.kind||'rifle';
  const profileKind=PROFILE_ALIASES[visualKind]||visualKind;
  const signature=signatureFor(config,hash);
  const utility=['knife','grenade','mine','medkit'].includes(config.kind);
  let opticStyle=utility?'none':config.scoped?(config.special||config.effect==='pierce'?'advanced-scope':'scope'):
    profileKind==='sniper'?'scope':profileKind==='shotgun'?'bead':profileKind==='pistol'?'iron':hash%2?'reflex':'compact';
  let muzzleStyle=config.silent?'suppressor':config.effect==='explosive'?'bell':
    ['rail','void','magnet'].includes(visualKind)||config.effect==='pierce'?'emitter':profileKind==='shotgun'?'choke':'brake';
  const receiverScale=.94+((hash>>>5)&7)*.021;
  const barrelScale=.9+((hash>>>11)&7)*.035;
  const widthScale=.94+((hash>>>17)&7)*.018;
  let magazineStyle=magazineStyleFor(config,profileKind);
  let stockStyle=stockStyleFor(config,profileKind,hash);
  const meleeStyle=config.kind==='knife'?meleeStyleFor(config):null;
  const variant=hash%8;
  const override=VISUAL_OVERRIDES[id]||{};
  opticStyle=override.opticStyle||opticStyle;muzzleStyle=override.muzzleStyle||muzzleStyle;magazineStyle=override.magazineStyle||magazineStyle;stockStyle=override.stockStyle||stockStyle;
  const defaults=COMPONENT_DEFAULTS[profileKind]||COMPONENT_DEFAULTS.rifle;
  const receiverStyle=override.receiverStyle||receiverStyleFor(config,profileKind,signature,hash);
  const barrelStyle=override.barrelStyle||barrelStyleFor(config,profileKind,signature,hash);
  const gripStyle=override.gripStyle||gripStyleFor(config,profileKind);
  const handguardStyle=override.handguardStyle||defaults.handguardStyle;
  const specialParts=freeze([...(override.specialParts||fingerprintParts(config,signature,variant))]);
  const core={
    id,hash,visualKind,profileKind,signature,opticStyle,muzzleStyle,magazineStyle,stockStyle,gripStyle,receiverStyle,barrelStyle,handguardStyle,meleeStyle,variant,specialParts,
    receiverScale,barrelScale,widthScale,panelCount:2+(hash%4),railCount:3+((hash>>>3)%4),
    colorZones:colorZonesFor(config,hash),materialZones:WEAPON_MATERIAL_ZONES,attachmentSockets:copySockets(),modular:config.category==='CUSTOM',
    fingerprint:[profileKind,signature,receiverStyle,barrelStyle,opticStyle,muzzleStyle,magazineStyle,stockStyle,meleeStyle||'none',variant,hash.toString(36)].join(':'),
  };
  const expansion=visualDefinitionExpansion(config,core);
  return freeze({...core,...expansion,mechanicalAction:expansion.animationProfile.mechanicalAction,attachmentPoints:attachmentPointsFor(profileKind,expansion.scopeProfile),viewModelProfile:viewModelProfileFor(profileKind)});
}

export function validateWeaponVisualDefinition(definition={}){
  const missing=[];
  for(const key of ['id','profileKind','receiverStyle','barrelStyle','stockStyle','gripStyle','magazineStyle','opticStyle','muzzleStyle','colorZones','attachmentPoints','attachmentSockets','animationProfile','scopeProfile','fingerprint'])if(definition[key]===undefined||definition[key]===null)missing.push(key);
  for(const point of ['muzzle','sight','ejection','leftHand','rightHand','charm','magazine'])if(!Array.isArray(definition.attachmentPoints?.[point])||definition.attachmentPoints[point].length!==3)missing.push(`attachmentPoints.${point}`);
  for(const socket of Object.keys(STANDARD_ATTACHMENT_SOCKETS))if(!Array.isArray(definition.attachmentSockets?.[socket])||definition.attachmentSockets[socket].length!==3)missing.push(`attachmentSockets.${socket}`);
  if(!RECOGNIZED_MECHANICAL_ACTIONS.includes(definition.animationProfile?.mechanicalAction))missing.push('animationProfile.mechanicalAction');
  return freeze({valid:missing.length===0,missing:freeze(missing)});
}
