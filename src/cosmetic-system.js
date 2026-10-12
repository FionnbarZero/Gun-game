export const RARITIES = Object.freeze({
  common:Object.freeze({label:'COMMON',color:'#55aaff',weight:70,duplicateShards:10}),
  rare:Object.freeze({label:'RARE',color:'#a65cff',weight:20,duplicateShards:30}),
  legendary:Object.freeze({label:'LEGENDARY',color:'#ff455c',weight:8.5,duplicateShards:100}),
  exotic:Object.freeze({label:'EXOTIC',color:'#ffc857',weight:1.5,duplicateShards:300}),
});

export const COLLECTIONS = Object.freeze({
  vertigo:{name:'VERTIGO CHROMA',colors:['#32e6ef','#ed4fc6','#7754ee']},
  overgrown:{name:'OVERGROWN RELIC',colors:['#60784b','#b7c968','#d2aa51']},
  foundry:{name:'FOUNDRY OVERDRIVE',colors:['#202832','#ff7138','#ffc14f']},
  hyperpop:{name:'HYPERPOP',colors:['#ff55bc','#50e5ff','#ffe45e']},
  deepSpace:{name:'DEEP SPACE',colors:['#17172d','#744fe8','#df63ff']},
  silly:{name:'SILLY SUPPLY',colors:['#ff564f','#ffe34f','#56e5ff']},
});

const item=(id,name,type,rarity,collection,extra={})=>Object.freeze({
  id,name,type,rarity,collection,icon:extra.icon||({skin:'⌁',charm:'♢',tracer:'➤',killFx:'✦',banner:'▤',background:'▦'}[type]||'◇'),
  duplicateShards:RARITIES[rarity].duplicateShards,directPrice:{common:650,rare:1400,legendary:3200,exotic:6500}[rarity],...extra,
});

export const COSMETICS = Object.freeze([
  item('vertigo-phantom-skin','VERTIGO PHANTOM','skin','legendary','vertigo',{compatibleWeapons:['sledge'],baseColor:'#080B18',accentColor:'#FF2FD1',emissiveColor:'#00F5FF',roughness:.2,metalness:.76,pattern:'grid',animated:{speed:.35,strength:.34},design:{secondaryColor:'#111A32',edgeColor:'#7A4DFF',scopeColor:'#00F5FF',magazineColor:'#201143',muzzleColor:'#00F5FF',detail:'city-grid',inspect:'CITY LIGHT SEQUENCE',attachment:'muzzle-ring'}}),
  item('vertigo-grid-skin','VERTIGO GRID','skin','rare','vertigo',{compatibleWeapons:['specter','harmonic-rail','glassline-sniper'],baseColor:'#1c4964',accentColor:'#ae50e8',emissiveColor:'#3cf1f5',roughness:.3,metalness:.62,pattern:'grid'}),
  item('city-glass-sidearm','CITY GLASS','skin','common','vertigo',{compatibleWeapons:['phantom','echo-9','tracker-6'],baseColor:'#35759a',accentColor:'#dc53b7',emissiveColor:'#52dfe9',roughness:.38,metalness:.45}),
  item('floating-city-charm','FLOATING CITY','charm','rare','vertigo',{shape:'city',color:'#50e5ff'}),
  item('cyan-laser-tracer','CYAN LASER','tracer','rare','vertigo',{color:'#55efff',secondaryColor:'#b75cff',style:'laser'}),
  item('neon-echo-fx','NEON ECHO','killFx','legendary','vertigo',{effect:'neonEcho',colors:['#50e5ff','#9b6cff']}),
  item('synthwave-background','SYNTHWAVE SKYLINE','background','rare','vertigo',{gradient:['#09152d','#a52e97','#ff9a55']}),

  item('jungle-relic-skin','JUNGLE RELIC','skin','legendary','overgrown',{compatibleWeapons:['helix'],baseColor:'#153A2B',accentColor:'#D9A441',emissiveColor:'#42FFD2',roughness:.7,metalness:.26,pattern:'vines',animated:{speed:.2,strength:.18},design:{secondaryColor:'#5B3924',edgeColor:'#5D8A45',scopeColor:'#42FFD2',magazineColor:'#68604A',muzzleColor:'#D9A441',detail:'living-vines',inspect:'FROG + SPORE BLOOM',attachment:'flowers'}}),
  item('mossbound-rifle-skin','MOSSBOUND','skin','rare','overgrown',{compatibleWeapons:['twinbeat-rifle','glasswire-dmr','stormcoil-carbine'],baseColor:'#354334',accentColor:'#9ebd5b',emissiveColor:'#b5e777',roughness:.78,metalness:.16,pattern:'vines'}),
  item('ruin-stone-skin','RUIN STONE','skin','common','overgrown',{compatibleWeapons:['combat-knife','railhook','glass-fang'],baseColor:'#686b5d',accentColor:'#b59b58',emissiveColor:'#85c65d',roughness:.88,metalness:.08}),
  item('tiny-frog-charm','TINY FROG','charm','rare','overgrown',{shape:'frog',color:'#8ee65d'}),
  item('leaf-trail','LEAF TRAIL','tracer','rare','overgrown',{color:'#a9ef64',secondaryColor:'#e1be66',style:'leaf'}),
  item('ancient-bloom-fx','ANCIENT BLOOM','killFx','legendary','overgrown',{effect:'ancientBloom',colors:['#8fe45d','#ffd16b']}),
  item('vine-banner','VINE-COVERED BANNER','banner','rare','overgrown',{gradient:['#172a20','#597841','#d2ac55']}),

  item('molten-steel-skin','MOLTEN STEEL','skin','legendary','foundry',{compatibleWeapons:['broadside'],baseColor:'#17191C',accentColor:'#FF6A00',emissiveColor:'#FFD23F',roughness:.34,metalness:.84,pattern:'cracks',animated:{speed:.5,strength:.42},design:{secondaryColor:'#343A40',edgeColor:'#D92B2B',scopeColor:'#FFD23F',magazineColor:'#2B2D30',muzzleColor:'#FF6A00',detail:'heat-vents',inspect:'PRESSURE GAUGE STEAM',attachment:'heat-vents'}}),
  item('overdrive-carbine-skin','OVERDRIVE CARBINE','skin','rare','foundry',{compatibleWeapons:['stormcoil-carbine','aftershock-cannon','comet-shorty'],baseColor:'#242a31',accentColor:'#f28c3c',emissiveColor:'#ff5b2d',roughness:.4,metalness:.76,pattern:'heat'}),
  item('black-steel-skin','BLACK STEEL','skin','common','foundry',{compatibleWeapons:['sledge','specter','broadside','kickback-compact'],baseColor:'#252c33',accentColor:'#a95a31',emissiveColor:'#f27932',roughness:.46,metalness:.7}),
  item('gear-charm','FOUNDRY GEAR','charm','rare','foundry',{shape:'gear',color:'#ff9b42'}),
  item('spark-tracer','BURNING SPARK','tracer','rare','foundry',{color:'#ff7b32',secondaryColor:'#ffd066',style:'spark'}),
  item('molten-impact-fx','MOLTEN IMPACT','killFx','legendary','foundry',{effect:'moltenImpact',colors:['#ff542c','#ffc052']}),
  item('factory-warning-banner','FACTORY WARNING','banner','rare','foundry',{gradient:['#181c22','#c74e2e','#f5b83d']}),

  item('hyperpop-sticker-skin','HYPERPOP STICKER BOMB','skin','legendary','hyperpop',{compatibleWeapons:['specter','phantom','arc-wasp','prism-scattergun'],baseColor:'#FFFFFF',accentColor:'#FF3BBF',emissiveColor:'#29E7FF',roughness:.32,metalness:.3,pattern:'stickers',animated:{speed:.7,strength:.24},design:{secondaryColor:'#8C4DFF',edgeColor:'#FFE84A',scopeColor:'#FF3BBF',magazineColor:'#FFE84A',muzzleColor:'#29E7FF',detail:'equalizer',inspect:'READY COMIC POP',attachment:'equalizer'}}),
  item('toy-block-skin','TOY BLOCKS','skin','rare','hyperpop',{compatibleWeapons:['broadside','tactical-toaster','shopping-cart-cannon'],baseColor:'#3f9cff',accentColor:'#ff4f64',emissiveColor:'#ffe24b',roughness:.56,metalness:.05,pattern:'blocks'}),
  item('rainbow-sprinkles-skin','RAINBOW SPRINKLES','skin','common','hyperpop',{compatibleWeapons:['unicorn-sprinkler','bubble-tea-smg','birthday-cake-cannon'],baseColor:'#ffe1ef',accentColor:'#53dff2',emissiveColor:'#ff61bc',roughness:.5,metalness:.08,pattern:'sprinkles'}),
  item('rainbow-tracer','RAINBOW TRACER','tracer','legendary','hyperpop',{color:'#ff5bbd',secondaryColor:'#5eeaff',style:'rainbow'}),
  item('comic-explosion-fx','COMIC EXPLOSION','killFx','legendary','hyperpop',{effect:'comicExplosion',colors:['#ff4fb5','#ffe459','#50e5ff']}),
  item('pixel-shatter-fx','PIXEL SHATTER','killFx','rare','hyperpop',{effect:'pixelShatter',colors:['#ff59bd','#54e4ff','#ffe65b']}),
  item('confetti-crown-fx','CONFETTI CROWN','killFx','rare','hyperpop',{effect:'confettiCrown',colors:['#ffc857','#ff4fba','#50e5ff']}),

  item('nebula-skin','NEBULA DRIFT','skin','exotic','deepSpace',{compatibleWeapons:['harmonic-rail','null-choir','orbit-breaker','glassline-sniper'],baseColor:'#03040A',accentColor:'#7137C8',emissiveColor:'#58C8FF',roughness:.23,metalness:.66,pattern:'stars',animated:{speed:.18,strength:.5},design:{secondaryColor:'#071A3D',edgeColor:'#C7D5E5',scopeColor:'#58C8FF',magazineColor:'#25185A',muzzleColor:'#03040A',detail:'starfield',inspect:'COMET DEPTH SHIFT',attachment:'orbit'}}),
  item('void-sidearm-skin','VOID SIDEARM','skin','rare','deepSpace',{compatibleWeapons:['phantom','blink-derringer','needlepoint'],baseColor:'#181a2d',accentColor:'#6847ae',emissiveColor:'#bd6dff',roughness:.3,metalness:.58,pattern:'stars'}),
  item('comet-tracer','COMET TRAIL','tracer','legendary','deepSpace',{color:'#d66dff',secondaryColor:'#5fe9ff',style:'comet'}),
  item('black-hole-fx','BLACK HOLE','killFx','exotic','deepSpace',{effect:'blackHole',colors:['#1b153a','#9b58ff']}),
  item('resonance-collapse-fx','RESONANCE COLLAPSE','killFx','exotic','deepSpace',{effect:'resonanceCollapse',colors:['#b768ff','#50e5ff','#ffffff']}),
  item('lightning-judgment-fx','LIGHTNING JUDGMENT','killFx','legendary','deepSpace',{effect:'lightningJudgment',colors:['#d9f3ff','#6978ff']}),
  item('ice-crystal-fx','ICE CRYSTAL','killFx','rare','deepSpace',{effect:'iceCrystal',colors:['#a8efff','#4ea5ff']}),

  item('pizza-weapon-skin','PIZZA BLASTER','skin','legendary','silly',{compatibleWeapons:['pizza-party-launcher','birthday-cake-cannon'],baseColor:'#FFD447',accentColor:'#D93A2F',emissiveColor:'#42A84B',roughness:.6,metalness:.08,pattern:'pizza',animated:{speed:.28,strength:.12},design:{secondaryColor:'#C9793D',edgeColor:'#42A84B',scopeColor:'#D93A2F',magazineColor:'#C89A63',muzzleColor:'#D93A2F',detail:'pepperoni-dials',inspect:'TOPPING CHECK + TIMER',attachment:'pizza-oven'}}),
  item('red-fish-skin','RED FISH','skin','exotic','silly',{compatibleWeapons:['red-fish-blaster','red-herring'],baseColor:'#F04444',accentColor:'#FFF0D0',emissiveColor:'#38C8F4',roughness:.46,metalness:.08,pattern:'scales',animated:{speed:.32,strength:.18},design:{secondaryColor:'#FF7B69',edgeColor:'#E9FCFF',scopeColor:'#38C8F4',magazineColor:'#38C8F4',muzzleColor:'#F04444',detail:'fish-fins',inspect:'BLINK + TAIL WIGGLE',attachment:'fish'}}),
  item('banana-camo-skin','BANANA CAMO','skin','rare','silly',{compatibleWeapons:['banana-peel-revolver','rubber-chicken-railgun'],baseColor:'#f4d93d',accentColor:'#6d963b',emissiveColor:'#ffef73',roughness:.6,metalness:.04,pattern:'banana'}),
  item('rubber-duck-skin','RUBBER DUCK','skin','rare','silly',{compatibleWeapons:['comet-shorty','tactical-toaster','sock-puppet-shotgun'],baseColor:'#ffd633',accentColor:'#ff8a36',emissiveColor:'#fff06b',roughness:.52,metalness:.03}),
  item('bubble-wrap-skin','BUBBLE WRAP','skin','common','silly',{compatibleWeapons:['bubble-tea-smg','condiment-blasters','phantom'],baseColor:'#b9e9ef',accentColor:'#ff92c8',emissiveColor:'#8ceefa',roughness:.72,metalness:.02,pattern:'bubbles'}),
  item('cardboard-skin','CARDBOARD','skin','common','silly',{compatibleWeapons:['specter','sledge','shopping-cart-cannon'],baseColor:'#9c7143',accentColor:'#47341f',emissiveColor:'#d89c54',roughness:.92,metalness:0,pattern:'cardboard'}),
  item('cheese-slice-charm','CHEESE SLICE','charm','rare','silly',{shape:'slice',color:'#ffd04a'}),
  item('fishhook-charm','FISHHOOK','charm','rare','silly',{shape:'hook',color:'#d8edf4'}),
  item('bubble-tracer','BUBBLE TRAIL','tracer','rare','silly',{color:'#65eaff',secondaryColor:'#d6f9ff',style:'bubble'}),
  item('sauce-tracer','SAUCE TRAIL','tracer','rare','silly',{color:'#e84432',secondaryColor:'#ffd44f',style:'sauce'}),
  item('pizza-party-fx','PIZZA PARTY','killFx','legendary','silly',{effect:'pizzaParty',colors:['#ffbf42','#e84135','#fff1b8']}),
  item('fish-splash-fx','FISH SPLASH','killFx','exotic','silly',{effect:'fishSplash',colors:['#ff334b','#50dfff','#e8fbff']}),
  item('fresh-elimination-banner','FRESH ELIMINATION','banner','rare','silly',{gradient:['#ab2d2d','#ffb43c','#fff0a6']}),
  item('aquarium-background','AQUARIUM','background','rare','silly',{gradient:['#071c34','#097ca1','#67e7e3']}),
]);

export const COSMETIC_KITS = Object.freeze([
  Object.freeze({id:'vertigo-phantom-kit',name:'VERTIGO PHANTOM KIT',rarity:'legendary',collection:'vertigo',weaponId:'sledge',itemIds:['vertigo-phantom-skin','floating-city-charm','cyan-laser-tracer','neon-echo-fx','synthwave-background']}),
  Object.freeze({id:'overgrown-hunter-kit',name:'OVERGROWN HUNTER KIT',rarity:'legendary',collection:'overgrown',weaponId:'helix',itemIds:['jungle-relic-skin','tiny-frog-charm','leaf-trail','ancient-bloom-fx','vine-banner']}),
  Object.freeze({id:'foundry-destroyer-kit',name:'FOUNDRY DESTROYER KIT',rarity:'legendary',collection:'foundry',weaponId:'broadside',itemIds:['molten-steel-skin','gear-charm','spark-tracer','molten-impact-fx','factory-warning-banner']}),
  Object.freeze({id:'pizza-champion-kit',name:'PIZZA CHAMPION KIT',rarity:'exotic',collection:'silly',weaponId:'pizza-party-launcher',itemIds:['pizza-weapon-skin','cheese-slice-charm','sauce-tracer','pizza-party-fx','fresh-elimination-banner']}),
  Object.freeze({id:'red-fish-kit',name:'RED FISH KIT',rarity:'exotic',collection:'silly',weaponId:'red-fish-blaster',itemIds:['red-fish-skin','fishhook-charm','bubble-tracer','fish-splash-fx','aquarium-background']}),
]);

export const CASES = Object.freeze({
  standard:Object.freeze({id:'standard',family:'standard',name:'STANDARD SKIN CASE',cost:250,rewardType:'skin',collections:['vertigo','overgrown','foundry','hyperpop','deepSpace','silly'],rarityWeights:{common:70,rare:20,legendary:8.5,exotic:1.5}}),
  neon:Object.freeze({id:'neon',family:'neon',name:'NEON ARSENAL CASE',cost:750,collections:['vertigo','hyperpop','deepSpace'],rarityWeights:{common:70,rare:20,legendary:8.5,exotic:1.5}}),
  kit:Object.freeze({id:'kit',family:'kit',name:'SKIN KIT CASE',cost:1500,key:'kitKeys',rewardType:'kit',rarityWeights:{legendary:85,exotic:15}}),
  mapVault:Object.freeze({id:'mapVault',family:'mapVault',name:'MAP VAULT CASE',cost:0,key:'mapVaultKeys',collections:['vertigo','overgrown','foundry'],maps:['Vertigo Grid','Overgrown Outpost','Industrial Foundry','Neon Velocity','Canopy Circuit','Foundry Rush'],rarityWeights:{common:55,rare:27,legendary:14,exotic:4}}),
  silly:Object.freeze({id:'silly',family:'silly',name:'SILLY SUPPLY CASE',cost:500,collections:['silly','hyperpop'],rarityWeights:{common:62,rare:25,legendary:10,exotic:3}}),
});

export function validRarityTable(weights){
  const entries=Object.entries(weights||{});return entries.length>0&&entries.every(([rarity,value])=>RARITIES[rarity]&&Number.isFinite(value)&&value>=0)&&Math.abs(entries.reduce((sum,[,value])=>sum+value,0)-100)<1e-8;
}

export function rollRarity(weights,random=Math.random,pity=0){
  if(pity>=19&&weights.legendary!==undefined)return 'legendary';
  let cursor=Math.min(.999999999,Math.max(0,random()))*100;
  for(const [rarity,weight] of Object.entries(weights)){cursor-=weight;if(cursor<0)return rarity;}
  return Object.keys(weights).at(-1);
}

export function createCosmeticProgress(saved={}){
  return {
    owned:[...new Set(saved.owned||[])],ownedKits:[...new Set(saved.ownedKits||[])],
    equippedSkins:{...(saved.equippedSkins||{})},equippedCharm:saved.equippedCharm||null,equippedTracer:saved.equippedTracer||null,equippedKillFx:saved.equippedKillFx||null,
    shards:Math.max(0,Number(saved.shards)||0),kitKeys:Math.max(0,Number(saved.kitKeys)||0),mapVaultKeys:Math.max(0,Number(saved.mapVaultKeys)||0),
    pity:{standard:0,neon:0,kit:0,mapVault:0,silly:0,...(saved.pity||{})},favorites:[...new Set(saved.favorites||[])],newItems:[...new Set(saved.newItems||[])],
    transactions:{...(saved.transactions||{})},kitKeyAwards:{...(saved.kitKeyAwards||{})},dailyRewardDate:saved.dailyRewardDate||'',
  };
}

export function cosmeticById(id){return COSMETICS.find(entry=>entry.id===id)||null;}
export function kitById(id){return COSMETIC_KITS.find(entry=>entry.id===id)||null;}
export function isCompatible(cosmetic,weaponId){return cosmetic?.type!=='skin'||cosmetic.compatibleWeapons?.includes(weaponId);}
export function canEquipCosmetic(state,cosmeticId,weaponId){const cosmetic=cosmeticById(cosmeticId);return Boolean(cosmetic&&state.owned.includes(cosmeticId)&&isCompatible(cosmetic,weaponId));}
export function materialDescriptor(base,skin){return skin?{...base,color:skin.baseColor,emissive:skin.emissiveColor,roughness:skin.roughness,metalness:skin.metalness}:{...base};}

function cosmeticPool(caseDefinition,rarity){
  return COSMETICS.filter(entry=>(!caseDefinition.rewardType||entry.type===caseDefinition.rewardType)&&(!caseDefinition.collections||caseDefinition.collections.includes(entry.collection))&&entry.rarity===rarity);
}
function choose(array,random){return array[Math.min(array.length-1,Math.floor(Math.max(0,random())*array.length))];}
function chooseReward(caseDefinition,state,random){
  const pity=state.pity[caseDefinition.family]||0;const rarity=rollRarity(caseDefinition.rarityWeights,random,pity);
  if(caseDefinition.rewardType==='kit'){
    const exact=COSMETIC_KITS.filter(kit=>kit.rarity===rarity);const pool=exact.length?exact:COSMETIC_KITS;const unowned=pool.filter(kit=>!state.ownedKits.includes(kit.id));const picked=choose(unowned.length?unowned:pool,random);return {kind:'kit',rarity:picked.rarity,item:picked};
  }
  const exact=cosmeticPool(caseDefinition,rarity);const all=COSMETICS.filter(entry=>(!caseDefinition.rewardType||entry.type===caseDefinition.rewardType)&&(!caseDefinition.collections||caseDefinition.collections.includes(entry.collection)));
  const pool=exact.length?exact:all;const unowned=pool.filter(entry=>!state.owned.includes(entry.id));const picked=choose(unowned.length?unowned:pool,random);return {kind:'cosmetic',rarity:picked.rarity,item:picked};
}
function paymentAvailable(state,definition,useKey){return useKey&&definition.key?(state[definition.key]||0)>0:definition.cost===0?Boolean(definition.key&&(state[definition.key]||0)>0):true;}

export function beginCaseTransaction({state,balance,caseId,transactionId,random=Math.random,useKey=false}){
  const next=createCosmeticProgress(state);const definition=CASES[caseId];if(!definition)return {ok:false,error:'UNKNOWN_CASE',state:next,balance};
  const previous=next.transactions[transactionId];if(previous)return {ok:true,replayed:true,transaction:previous,state:next,balance};
  if(!transactionId)return {ok:false,error:'MISSING_TRANSACTION_ID',state:next,balance};
  if(!paymentAvailable(next,definition,useKey))return {ok:false,error:'MISSING_KEY',state:next,balance};
  if(!useKey&&balance<definition.cost)return {ok:false,error:'INSUFFICIENT_FUNDS',state:next,balance};
  const reward=chooseReward(definition,next,random);const high=['legendary','exotic'].includes(reward.rarity);next.pity[definition.family]=high?0:(next.pity[definition.family]||0)+1;
  let nextBalance=balance;if(useKey&&definition.key)next[definition.key]--;else nextBalance-=definition.cost;
  const transaction={id:transactionId,caseId,status:'selected',rewardKind:reward.kind,rewardId:reward.item.id,rarity:reward.rarity,useKey,createdAt:Date.now()};next.transactions[transactionId]=transaction;
  const history=Object.values(next.transactions).filter(entry=>entry.status==='granted').sort((a,b)=>a.createdAt-b.createdAt);while(Object.keys(next.transactions).length>64&&history.length)delete next.transactions[history.shift().id];
  return {ok:true,transaction,state:next,balance:nextBalance};
}

export function finalizeCaseTransaction({state,transactionId}){
  const next=createCosmeticProgress(state);const transaction=next.transactions[transactionId];if(!transaction)return {ok:false,error:'UNKNOWN_TRANSACTION',state:next};
  if(transaction.status==='granted')return {ok:true,replayed:true,transaction,state:next,reward:transaction.reward};
  const itemIds=transaction.rewardKind==='kit'?(kitById(transaction.rewardId)?.itemIds||[]):[transaction.rewardId];let shards=0;const newItems=[];const duplicates=[];
  for(const id of itemIds){const cosmetic=cosmeticById(id);if(!cosmetic)continue;if(next.owned.includes(id)){shards+=cosmetic.duplicateShards;duplicates.push(id);}else{next.owned.push(id);next.newItems.push(id);newItems.push(id);}}
  if(transaction.rewardKind==='kit'&&!next.ownedKits.includes(transaction.rewardId))next.ownedKits.push(transaction.rewardId);
  next.shards+=shards;transaction.status='granted';transaction.reward={kind:transaction.rewardKind,id:transaction.rewardId,itemIds,newItems,duplicates,shards};next.transactions[transactionId]=transaction;
  return {ok:true,transaction,reward:transaction.reward,state:next};
}

export function createOfflineRewardService({readState,writeState,readBalance,writeBalance,random=Math.random}){
  return {
    authority:'offline-local',
    beginCase(caseId,transactionId,options={}){const result=beginCaseTransaction({state:readState(),balance:readBalance(),caseId,transactionId,random,useKey:Boolean(options.useKey)});if(result.ok){writeState(result.state);writeBalance(result.balance);}return result;},
    finalizeCase(transactionId){const result=finalizeCaseTransaction({state:readState(),transactionId});if(result.ok)writeState(result.state);return result;},
    grant(itemId,source='earned'){const state=createCosmeticProgress(readState());if(state.owned.includes(itemId))state.shards+=cosmeticById(itemId)?.duplicateShards||0;else{state.owned.push(itemId);state.newItems.push(itemId);}writeState(state);return {ok:true,itemId,source};},
  };
}

export function equipCosmetic(state,cosmeticId,weaponId){
  const next=createCosmeticProgress(state);const cosmetic=cosmeticById(cosmeticId);if(!canEquipCosmetic(next,cosmeticId,weaponId))return {ok:false,state:next,error:'NOT_OWNED_OR_INCOMPATIBLE'};
  if(cosmetic.type==='skin')next.equippedSkins[weaponId]=cosmetic.id;else if(cosmetic.type==='charm')next.equippedCharm=cosmetic.id;else if(cosmetic.type==='tracer')next.equippedTracer=cosmetic.id;else if(cosmetic.type==='killFx')next.equippedKillFx=cosmetic.id;else return {ok:false,state:next,error:'NOT_EQUIPPABLE'};
  next.newItems=next.newItems.filter(id=>id!==cosmeticId);return {ok:true,state:next};
}

export function craftCosmetic(state,cosmeticId){const next=createCosmeticProgress(state);const cosmetic=cosmeticById(cosmeticId);if(!cosmetic||next.owned.includes(cosmeticId))return {ok:false,state:next,error:'UNAVAILABLE'};const cost=cosmetic.duplicateShards*5;if(next.shards<cost)return {ok:false,state:next,error:'INSUFFICIENT_SHARDS',cost};next.shards-=cost;next.owned.push(cosmeticId);next.newItems.push(cosmeticId);return {ok:true,state:next,cost};}

export function directPurchaseCosmetic({state,balance,cosmeticId}){const next=createCosmeticProgress(state);const cosmetic=cosmeticById(cosmeticId);if(!cosmetic)return {ok:false,state:next,balance,error:'UNKNOWN_COSMETIC'};if(next.owned.includes(cosmeticId))return {ok:false,state:next,balance,error:'ALREADY_OWNED'};if(balance<cosmetic.directPrice)return {ok:false,state:next,balance,error:'INSUFFICIENT_FUNDS'};next.owned.push(cosmeticId);next.newItems.push(cosmeticId);return {ok:true,state:next,balance:balance-cosmetic.directPrice,item:cosmetic};}

export function shouldTriggerKillFx(ledger,event){
  if(!event?.confirmed||event.type==='damage'||!event.eliminationId)return false;if(ledger.has(event.eliminationId))return false;ledger.add(event.eliminationId);return true;
}
export function killFxParticleBudget(quality,reduced=false){if(reduced)return quality==='low'?4:8;return quality==='low'?8:quality==='medium'?14:22;}
export function killFxExpired(startedAt,durationMs,now){return now-startedAt>=durationMs;}
export function previewKillFxProgress(){return Object.freeze({coins:0,statistics:0,rewards:0});}
export function validateCatalog(weaponIds){const ids=new Set(weaponIds);return COSMETICS.every(entry=>RARITIES[entry.rarity]&&(!entry.compatibleWeapons||entry.compatibleWeapons.every(id=>ids.has(id))))&&COSMETIC_KITS.every(kit=>kit.itemIds.every(id=>cosmeticById(id)));}
