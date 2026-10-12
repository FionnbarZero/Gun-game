const freeze=value=>Object.freeze(value);

export const VISUAL_QUALITY_BEHAVIOR=freeze({
  low:freeze({particleScale:.42,environmentRate:.35,skinAnimation:false,cosmeticLights:false,distantCharacterRate:.25}),
  medium:freeze({particleScale:.72,environmentRate:.62,skinAnimation:true,cosmeticLights:false,distantCharacterRate:.5}),
  high:freeze({particleScale:1,environmentRate:1,skinAnimation:true,cosmeticLights:true,distantCharacterRate:.75}),
  ultra:freeze({particleScale:1.15,environmentRate:1,skinAnimation:true,cosmeticLights:true,distantCharacterRate:1}),
});

export const EFFECT_PROFILES=freeze({
  standard:freeze({anticipationMs:160,mainMs:840,dissipationMs:700,particleLimit:22,lightLimit:1,durationMs:1700,cleanup:'pool'}),
  neonEcho:freeze({anticipationMs:150,mainMs:720,dissipationMs:630,particleLimit:20,lightLimit:1,durationMs:1500,cleanup:'pool'}),
  pixelShatter:freeze({anticipationMs:120,mainMs:760,dissipationMs:620,particleLimit:22,lightLimit:0,durationMs:1500,cleanup:'pool'}),
  blackHole:freeze({anticipationMs:190,mainMs:930,dissipationMs:780,particleLimit:22,lightLimit:1,durationMs:1900,cleanup:'pool'}),
  ancientBloom:freeze({anticipationMs:180,mainMs:850,dissipationMs:670,particleLimit:20,lightLimit:1,durationMs:1700,cleanup:'pool'}),
  moltenImpact:freeze({anticipationMs:140,mainMs:780,dissipationMs:680,particleLimit:20,lightLimit:1,durationMs:1600,cleanup:'pool'}),
  lightningJudgment:freeze({anticipationMs:180,mainMs:520,dissipationMs:600,particleLimit:18,lightLimit:1,durationMs:1300,cleanup:'pool'}),
  iceCrystal:freeze({anticipationMs:150,mainMs:760,dissipationMs:690,particleLimit:22,lightLimit:0,durationMs:1600,cleanup:'pool'}),
  pizzaParty:freeze({anticipationMs:170,mainMs:830,dissipationMs:600,particleLimit:22,lightLimit:0,durationMs:1600,cleanup:'pool'}),
  fishSplash:freeze({anticipationMs:150,mainMs:850,dissipationMs:600,particleLimit:22,lightLimit:0,durationMs:1600,cleanup:'pool'}),
  comicExplosion:freeze({anticipationMs:110,mainMs:690,dissipationMs:600,particleLimit:20,lightLimit:0,durationMs:1400,cleanup:'pool'}),
  resonanceCollapse:freeze({anticipationMs:180,mainMs:820,dissipationMs:700,particleLimit:22,lightLimit:1,durationMs:1700,cleanup:'pool'}),
});

export const CRATE_VISUAL_PROFILES=freeze({
  standard:freeze({shell:'reinforced-equipment',locks:2,panels:1,hinged:true,transparent:false,rarityCore:'scanner',stages:['idle','entrance','scan','unlock','open','energy','spinner','selection','reveal','celebration','transition','cleanup']}),
  neon:freeze({shell:'hexagonal-energy',locks:6,panels:6,hinged:false,transparent:true,rarityCore:'energy-band',stages:['idle','entrance','scan','unlock','open','energy','spinner','selection','reveal','celebration','transition','cleanup']}),
  kit:freeze({shell:'wide-equipment-suitcase',locks:4,panels:5,hinged:true,transparent:false,rarityCore:'circular',stages:['idle','entrance','scan','unlock','open','energy','spinner','selection','reveal','celebration','transition','cleanup']}),
  mapVault:freeze({shell:'relic-machine',locks:3,panels:2,hinged:false,transparent:false,rarityCore:'map-symbols',stages:['idle','entrance','scan','unlock','open','energy','spinner','selection','reveal','celebration','transition','cleanup']}),
  silly:freeze({shell:'vending-delivery-box',locks:1,panels:1,hinged:true,transparent:false,rarityCore:'cartoon-eyes',stages:['idle','entrance','scan','unlock','open','energy','spinner','selection','reveal','celebration','transition','cleanup']}),
});

export const ABILITY_VISUAL_PROFILES=freeze({
  kinetic:freeze({ready:'wrist-coil',anticipation:'anchor-highlight',cast:'visible-cable',active:'taut-energy-cable',end:'momentum-streak',cleanup:'retract'}),
  grapple:freeze({ready:'wrist-coil',anticipation:'anchor-highlight',cast:'visible-cable',active:'rope-swing',end:'momentum-streak',cleanup:'retract'}),
  snapshot:freeze({ready:'scanner-idle',anticipation:'scanner-open',cast:'cone-pulse',active:'heat-outline',end:'outline-fade',cleanup:'pool'}),
  nova:freeze({ready:'capacitor-idle',anticipation:'hand-charge',cast:'ground-ring',active:'shockwave',end:'residual-arcs',cleanup:'pool'}),
  rewind:freeze({ready:'clock-idle',anticipation:'anchor-symbol',cast:'afterimage-path',active:'timeline',end:'reverse-distortion',cleanup:'pool'}),
  camo:freeze({ready:'phase-idle',anticipation:'edge-scan',cast:'segment-dissolve',active:'faint-edges',end:'segment-rebuild',cleanup:'restore'}),
  decoy:freeze({ready:'projector-idle',anticipation:'projector-open',cast:'layered-hologram',active:'scan-lines',end:'ping-pulse',cleanup:'dispose'}),
  vector:freeze({ready:'thruster-idle',anticipation:'direction-line',cast:'momentum-streak',active:'afterimage',end:'fade',cleanup:'pool'}),
  ramp:freeze({ready:'hardlight-idle',anticipation:'placement-grid',cast:'panel-build',active:'stable-ramp',end:'panel-dissolve',cleanup:'dispose'}),
});

function magnificationFor(config,scopeType){
  const text=`${config?.trait||''} ${config?.weaponClass||''}`;const match=text.match(/(\d{1,2})\s*[×X]/i);
  if(match)return Math.max(1,Number(match[1]));
  return scopeType==='sniper'?8:scopeType==='low'?3:scopeType==='reflex'||scopeType==='holographic'?1.15:1;
}

export function scopeProfileForWeapon(config={},visual={}){
  const optic=visual.opticStyle||'iron';let type='iron';
  if(optic==='scope'||optic==='advanced-scope')type=config.kind==='sniper'||config.scoped?'sniper':'low';
  else if(optic==='reflex')type='reflex';else if(optic==='compact')type='holographic';else if(optic==='none')type='none';
  const heavy=type==='sniper'&&/HEAVY|BOLT|12×/i.test(`${config.weaponClass||''} ${config.trait||''}`);
  const transitionMs=type==='sniper'?(heavy?360:285):type==='low'?240:['reflex','holographic'].includes(type)?175:145;
  const sightY=(type==='sniper'||type==='low') ? 0.23 : (type==='reflex'||type==='holographic') ? 0.27 : 0.2;
  return freeze({
    type,magnification:magnificationFor(config,type),eyeRelief:type==='sniper'?.3:type==='low'?.34:.42,lensDimensions:type==='sniper'?[.15,.15]:type==='low'?[.13,.11]:[.1,.08],
    sightAnchor:[0,sightY,-.2],reticleStyle:type==='sniper'?'precision-mil':type==='holographic'?'holo-ring':type==='reflex'?'clean-dot':'aligned-post',
    reticleBrightness:type==='sniper'?.82:.9,lensTint:type==='sniper'?'#365a70':type==='low'?'#477680':'#73b5bd',peripheral:type==='sniper'?'soft-vignette':'visible',
    cameraFov:type==='sniper'?Math.max(16,Math.min(28,72/magnificationFor(config,type)*2.4)):null,aimTransitionMs:transitionMs,reducedMotionTransitionMs:Math.min(160,transitionMs),
    hideFirstPersonWeapon:type==='sniper',hideCharmDuringAim:type!=='none',hideDecorationsDuringAim:type!=='none',
    clearAperture:type!=='none',openHousing:['sniper','low','reflex','holographic'].includes(type),lensOpacity:(type==='sniper'||type==='low') ? .1 : .14,blocksCenter:false,
  });
}

export function animationProfileForWeapon(config={},visual={}){
  const kind=visual.profileKind||config.kind||'rifle';const weaponClass=String(config.weaponClass||'').toUpperCase();
  const action=config.kind==='knife'?'melee':['grenade','mine'].includes(config.kind)?'arming':config.kind==='medkit'?'applicator':kind==='pistol'?(weaponClass.includes('REVOLVER')?'cylinder':'slide'):kind==='shotgun'?(config.automatic?'bolt':'pump'):kind==='sniper'?'bolt':kind==='lmg'?(weaponClass.includes('MINIGUN')?'spin':'feed-cover'):visual.signature==='sonic'?'oscillator':['rail','launcher'].includes(kind)?'energy-chamber':'bolt';
  const reloadStyle=kind==='shotgun'&&!config.automatic?'shells':kind==='lmg'?'heavy-feed':weaponClass.includes('REVOLVER')?'cylinder':visual.magazineStyle==='none'?'none':'magazine';
  return freeze({
    profileId:`${kind}-${action}`,idle:'breath',walk:'controlled-bob',sprint:kind==='pistol'?'one-hand-low':'low-ready',equip:'raise-and-settle',unequip:'lower-and-stow',
    aimEnter:'anchor-align',aimIdle:'restrained-breath',aimExit:'return-low-ready',fire:'impulse',recoil:kind==='shotgun'||kind==='sniper'?'heavy':'controlled',reload:reloadStyle,
    emptyReload:reloadStyle==='magazine'?'magazine-and-charge':reloadStyle,mechanicalAction:action,inspect:visual.signature==='sonic'?'frequency-check':'chamber-check',
    melee:kind==='knife'?'return-to-ready':'none',overheat:kind==='lmg'||visual.signature==='thermal'?'vent-glow':'none',cooling:kind==='lmg'||visual.signature==='thermal'?'vent-steam':'none',
    timings:freeze({idle:1200,walk:520,sprint:360,equip:320,unequip:220,aimEnter:scopeProfileForWeapon(config,visual).aimTransitionMs,aimExit:scopeProfileForWeapon(config,visual).aimTransitionMs*.8,fire:Math.max(90,Math.min(320,Number(config.fireRate)||180)),mechanical:kind==='sniper'?620:kind==='shotgun'?430:160,inspect:1200}),
  });
}

export function materialProfileForWeapon(config={},visual={}){
  const energy=['rail','launcher'].includes(visual.profileKind)||['sonic','coil','phase','orbital'].includes(visual.signature);
  return freeze({body:'painted-metal',secondary:energy?'ceramic-energy':'dark-polymer',edge:'machined-steel',grip:'rubber',scopeHousing:'painted-metal',scopeLens:'coated-glass',magazine:energy?'energy-cell':'dark-polymer',muzzle:'machined-steel',metalness:energy?.58:.46,roughness:energy?.32:.48,emissiveLimit:.8});
}

export function soundProfileForWeapon(config={},visual={}){
  const family=visual.signature==='sonic'?'sonic':config.silent?'suppressed':visual.profileKind==='shotgun'?'heavy-ballistic':['rail','launcher'].includes(visual.profileKind)?'energy':'ballistic';
  return freeze({family,fire:`${family}-fire`,mechanical:`${visual.profileKind||config.kind||'weapon'}-${animationProfileForWeapon(config,visual).mechanicalAction}`,reload:`${visual.profileKind||config.kind||'weapon'}-reload`,equip:'equipment-raise',inspect:'mechanical-check'});
}

export function visualDefinitionExpansion(config={},visual={}){
  const scopeProfile=scopeProfileForWeapon(config,visual);const animationProfile=animationProfileForWeapon(config,visual);
  return freeze({
    category:visual.profileKind||config.kind||'rifle',firstPersonModel:'procedural-high',thirdPersonModel:'procedural-medium',worldPickupModel:'procedural-medium',inventoryPreviewModel:'procedural-high',
    scopeProfile,animationProfile,materialProfile:materialProfileForWeapon(config,visual),skinCompatibility:'catalog-driven',
    transforms:freeze({muzzle:'muzzle-anchor',casing:'casing-ejection',sight:'sight-anchor',leftHand:'left-hand',rightHand:'right-hand',charm:'charm-anchor',magazine:'magazine-anchor'}),
    mechanicalPartTransforms:freeze({trigger:'mechanical-trigger',slide:'mechanical-slide',bolt:'mechanical-bolt',pump:'mechanical-pump',magazine:'mechanical-magazine',chargingHandle:'mechanical-charging-handle',emitter:'mechanical-emitter',heatVents:'mechanical-heat-vents'}),
    effectColors:freeze({primary:config.color||0x50e5ff,muzzle:config.silent?0x7bd4d2:0xffb04a,energy:config.color||0x50e5ff}),soundProfile:soundProfileForWeapon(config,visual),
  });
}

export function sightAnchorCorrection(anchor={x:0,y:0,z:0},scopeProfile={eyeRelief:.4}){
  return freeze({x:-Number(anchor.x||0),y:-Number(anchor.y||0),z:-Math.max(.12,Number(scopeProfile.eyeRelief)||.4)-Number(anchor.z||0)});
}

export function scopeDecorationVisibility(scopeProfile={},aiming=false,aimBlend=0){
  // Engage scope safety on the same input frame as ADS. Waiting for the aim
  // animation to settle lets charms and the receiver sweep across the lens.
  const engaged=Boolean(aiming&&Number(aimBlend)>=0);return freeze({charm:!(engaged&&scopeProfile.hideCharmDuringAim),decorations:!(engaged&&scopeProfile.hideDecorationsDuringAim),firstPersonWeapon:!(engaged&&scopeProfile.hideFirstPersonWeapon)});
}

export function createVisualAnimationState(){return{state:'idle',previous:'idle',startedAt:0,durationMs:0,reactiveLevel:0};}
export function beginVisualAnimation(state,name,now,durationMs){if(!state)return null;state.previous=state.state;state.state=name;state.startedAt=Number(now)||0;state.durationMs=Math.max(1,Number(durationMs)||1);return state;}
export function sampleVisualAnimation(state,now){if(!state)return freeze({state:'idle',progress:0,complete:true});const progress=Math.min(1,Math.max(0,((Number(now)||0)-state.startedAt)/Math.max(1,state.durationMs)));return freeze({state:state.state,previous:state.previous,progress,complete:progress>=1});}
export function resetVisualAnimation(state){if(!state)return state;Object.assign(state,createVisualAnimationState());return state;}

export function effectPhaseAt(profile,elapsedMs){
  const resolved=profile||EFFECT_PROFILES.standard;const elapsed=Math.max(0,Number(elapsedMs)||0);if(elapsed<resolved.anticipationMs)return'anticipation';if(elapsed<resolved.anticipationMs+resolved.mainMs)return'main';if(elapsed<resolved.durationMs)return'dissipation';return'complete';
}

export function qualityVisualFallback(quality='high'){return VISUAL_QUALITY_BEHAVIOR[quality]||VISUAL_QUALITY_BEHAVIOR.high;}
