import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
  CASES,COSMETICS,COSMETIC_KITS,beginCaseTransaction,canEquipCosmetic,createCosmeticProgress,
  directPurchaseCosmetic,equipCosmetic,finalizeCaseTransaction,killFxExpired,killFxParticleBudget,materialDescriptor,previewKillFxProgress,
  rollRarity,shouldTriggerKillFx,validRarityTable,validateCatalog,
} from '../src/cosmetic-system.js';

test('every case uses a complete valid rarity table',()=>{
  for(const definition of Object.values(CASES))assert.equal(validRarityTable(definition.rarityWeights),true,definition.id);
  assert.equal(rollRarity(CASES.standard.rarityWeights,()=>0),'common');
  assert.equal(rollRarity(CASES.standard.rarityWeights,()=>.999),'exotic');
});

test('case transaction deducts currency once and reward finalizes once',()=>{
  let state=createCosmeticProgress();
  const first=beginCaseTransaction({state,balance:1000,caseId:'standard',transactionId:'tx-1',random:()=>0});
  assert.equal(first.ok,true);assert.equal(first.balance,750);state=first.state;
  const replay=beginCaseTransaction({state,balance:first.balance,caseId:'standard',transactionId:'tx-1',random:()=>.99});
  assert.equal(replay.replayed,true);assert.equal(replay.balance,750);
  const granted=finalizeCaseTransaction({state:replay.state,transactionId:'tx-1'});assert.equal(granted.reward.newItems.length,1);
  const grantedAgain=finalizeCaseTransaction({state:granted.state,transactionId:'tx-1'});assert.equal(grantedAgain.replayed,true);assert.deepEqual(grantedAgain.state.owned,granted.state.owned);
});

test('Skin Kit case grants the complete matching kit',()=>{
  const begin=beginCaseTransaction({state:createCosmeticProgress({kitKeys:1}),balance:0,caseId:'kit',transactionId:'kit-1',useKey:true,random:()=>0});
  const finish=finalizeCaseTransaction({state:begin.state,transactionId:'kit-1'});const kit=COSMETIC_KITS.find(entry=>entry.id===finish.reward.id);
  assert.deepEqual(finish.reward.itemIds,kit.itemIds);assert.equal(finish.reward.newItems.length,kit.itemIds.length);assert.equal(finish.state.kitKeys,0);
});

test('duplicates convert to the configured shard value',()=>{
  const skin=COSMETICS.find(entry=>entry.id==='city-glass-sidearm');
  const begin=beginCaseTransaction({state:createCosmeticProgress({owned:[skin.id]}),balance:250,caseId:'standard',transactionId:'dupe',random:()=>0});
  // Mark every common Standard skin owned so duplicate preference has no unowned fallback.
  begin.state.owned=COSMETICS.filter(item=>item.type==='skin'&&item.rarity==='common').map(item=>item.id);
  const finish=finalizeCaseTransaction({state:begin.state,transactionId:'dupe'});
  assert.equal(finish.reward.shards,skin.duplicateShards);assert.equal(finish.state.shards,skin.duplicateShards);
});

test('pity rises after low rarity and resets on Legendary',()=>{
  let state=createCosmeticProgress({pity:{standard:19}});
  const guaranteed=beginCaseTransaction({state,balance:500,caseId:'standard',transactionId:'pity',random:()=>0});
  assert.equal(guaranteed.transaction.rarity,'legendary');assert.equal(guaranteed.state.pity.standard,0);
  const low=beginCaseTransaction({state:guaranteed.state,balance:guaranteed.balance,caseId:'standard',transactionId:'low',random:()=>0});
  assert.equal(low.transaction.rarity,'common');assert.equal(low.state.pity.standard,1);
});

test('unowned and incompatible skins cannot be equipped',()=>{
  const state=createCosmeticProgress({owned:['vertigo-phantom-skin']});
  assert.equal(canEquipCosmetic(state,'vertigo-phantom-skin','helix'),false);
  assert.equal(equipCosmetic(state,'jungle-relic-skin','helix').ok,false);
  assert.equal(equipCosmetic(state,'vertigo-phantom-skin','sledge').ok,true);
});

test('material descriptors do not mutate shared weapon materials',()=>{
  const base={color:'#222222',roughness:.8,metalness:.1};const before={...base};const skin=COSMETICS.find(item=>item.id==='vertigo-phantom-skin');const result=materialDescriptor(base,skin);
  assert.deepEqual(base,before);assert.notEqual(result,base);assert.equal(result.color,skin.baseColor);
});

test('premium kit skins define complete component and inspect treatments without gameplay stats',()=>{
  for(const id of ['vertigo-phantom-skin','jungle-relic-skin','molten-steel-skin','hyperpop-sticker-skin','nebula-skin','pizza-weapon-skin','red-fish-skin']){
    const skin=COSMETICS.find(item=>item.id===id);assert.ok(skin?.design,id);
    for(const field of ['secondaryColor','edgeColor','scopeColor','magazineColor','muzzleColor','detail','inspect','attachment'])assert.ok(skin.design[field],`${id}:${field}`);
    for(const forbidden of ['damage','accuracy','speed','health','luck'])assert.equal(skin[forbidden],undefined,`${id}:${forbidden}`);
  }
});

test('equipped cosmetics persist through normalized save data',()=>{
  const equipped=equipCosmetic(createCosmeticProgress({owned:['cyan-laser-tracer']}),'cyan-laser-tracer','sledge');
  const restored=createCosmeticProgress(JSON.parse(JSON.stringify(equipped.state)));
  assert.equal(restored.equippedTracer,'cyan-laser-tracer');
});

test('confirmed elimination triggers Kill FX once but ordinary damage does not',()=>{
  const ledger=new Set();assert.equal(shouldTriggerKillFx(ledger,{confirmed:true,type:'damage',eliminationId:'a'}),false);
  assert.equal(shouldTriggerKillFx(ledger,{confirmed:true,type:'elimination',eliminationId:'a'}),true);
  assert.equal(shouldTriggerKillFx(ledger,{confirmed:true,type:'elimination',eliminationId:'a'}),false);
  assert.equal(shouldTriggerKillFx(ledger,{confirmed:false,type:'elimination',eliminationId:'b'}),false);
});

test('preview acquisition paths do not award coins or statistics',()=>{
  assert.deepEqual(previewKillFxProgress(),{coins:0,statistics:0,rewards:0});
});

test('temporary FX expire and reduced effects use a bounded lower particle budget',()=>{
  assert.equal(killFxExpired(1000,1500,2499),false);assert.equal(killFxExpired(1000,1500,2500),true);
  assert.ok(killFxParticleBudget('high',true)<killFxParticleBudget('high',false));assert.ok(killFxParticleBudget('low',false)<=8);
});

test('cosmetic compatibility references existing weapons and leaves loadouts intact',()=>{
  const source=readFileSync(new URL('../src/main.js',import.meta.url),'utf8');const weaponIds=[...source.matchAll(/blueprint\(\{\s*id:\s*'([^']+)'/g)].map(match=>match[1]);
  assert.equal(validateCatalog(weaponIds),true);for(const required of ['specter','phantom','combat-knife','frag-bomb'])assert.ok(weaponIds.includes(required));
});
