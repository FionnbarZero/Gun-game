import { writeFile } from 'node:fs/promises';

const endpoint=process.env.RESONANCE_CDP_ENDPOINT||'http://127.0.0.1:9228';
const gameUrl=process.env.RESONANCE_GAME_URL||'http://127.0.0.1:5173/?diagnostics&quality=low';
const outputPrefix=process.env.RESONANCE_SCREENSHOT_PREFIX||'/tmp/resonance-visual';
const sleep=milliseconds=>new Promise(resolve=>setTimeout(resolve,milliseconds));
const page=await fetch(`${endpoint}/json/new?${encodeURIComponent('about:blank')}`,{method:'PUT'}).then(response=>response.json());
if(!page?.webSocketDebuggerUrl)throw new Error(`No debuggable Chrome page at ${endpoint}`);

const socket=new WebSocket(page.webSocketDebuggerUrl);let commandId=0;const pending=new Map();const consoleErrors=[];
socket.addEventListener('message',event=>{
  const message=JSON.parse(event.data);
  if(message.id){const request=pending.get(message.id);if(!request)return;pending.delete(message.id);clearTimeout(request.timer);message.error?request.reject(new Error(message.error.message)):request.resolve(message.result);return;}
  if(message.method==='Runtime.exceptionThrown')consoleErrors.push(message.params.exceptionDetails.exception?.description||message.params.exceptionDetails.text);
  if(message.method==='Log.entryAdded'&&message.params.entry.level==='error')consoleErrors.push(message.params.entry.text);
});
await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(new Error('CDP WebSocket open timed out')),12000);socket.addEventListener('open',()=>{clearTimeout(timer);resolve();},{once:true});socket.addEventListener('error',event=>{clearTimeout(timer);reject(event.error||new Error('CDP WebSocket failed'));},{once:true});});
const send=(method,params={})=>new Promise((resolve,reject)=>{const id=++commandId;const timer=setTimeout(()=>{pending.delete(id);reject(new Error(`CDP command timed out: ${method}`));},90000);pending.set(id,{resolve,reject,timer});socket.send(JSON.stringify({id,method,params}));});
const evaluate=async expression=>{const response=await send('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(response.exceptionDetails)throw new Error(response.exceptionDetails.exception?.description||response.exceptionDetails.text);return response.result.value;};
const stage=message=>process.stdout.write(`[visual-smoke] ${message}\n`);
const capture=async name=>{
  stage(`freezing ${name}`);
  await evaluate(`globalThis.__resonanceDiagnostics?.pauseRendering()`);
  await sleep(250);
  const result=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false,fromSurface:true});
  await writeFile(`${outputPrefix}-${name}.png`,Buffer.from(result.data,'base64'));
  stage(`captured ${name}`);
};
const captureLive=async name=>{
  stage(`capturing live ${name}`);
  const result=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false,fromSurface:true});
  await writeFile(`${outputPrefix}-${name}.png`,Buffer.from(result.data,'base64'));
  stage(`captured ${name}`);
};
const resume=async()=>{await evaluate(`globalThis.__resonanceDiagnostics?.resumeRendering()`);await sleep(300);};

stage(`navigating ${gameUrl}`);
await send('Page.enable');await send('Runtime.enable');await send('Log.enable');
await send('Emulation.setDeviceMetricsOverride',{width:960,height:540,deviceScaleFactor:1,mobile:false});
await send('Page.navigate',{url:gameUrl});
let diagnosticsReady=false;
for(let attempt=0;attempt<180&&!diagnosticsReady;attempt++){await sleep(500);diagnosticsReady=await evaluate(`Boolean(globalThis.__resonanceDiagnostics)`);if(consoleErrors.length&&!diagnosticsReady)throw new Error(`Game failed before diagnostics initialized:\n${consoleErrors.join('\n')}`);}
if(!diagnosticsReady)throw new Error(`Diagnostics did not initialize. Console:\n${consoleErrors.join('\n')||'no captured errors'}`);
const lobbyReady=await evaluate(`Boolean(document.querySelector('#deploy')&&!document.querySelector('#deploy').disabled)`);
if(!lobbyReady)throw new Error('Lobby deploy control did not become ready');
await evaluate(`document.querySelector('#deploy').click(); true`);await sleep(100);
const modeChooser=await evaluate(`({open:Boolean(document.querySelector('#play-route-modal:not(.hidden)')),overview:Boolean(document.querySelector('#play-route-overview:not(.hidden)')),voteRemoved:!document.querySelector('#map-vote-section')})`);
if(!modeChooser.open||!modeChooser.overview||!modeChooser.voteRemoved)throw new Error(`Play did not open the mode chooser cleanly: ${JSON.stringify(modeChooser)}`);
await evaluate(`document.querySelector('#play-route-overview [data-match-route="main"]').click();true`);await sleep(100);
const mapChooser=await evaluate(`({open:Boolean(document.querySelector('#main-map-route:not(.hidden)')),maps:[...document.querySelectorAll('[data-main-map]')].map(button=>button.querySelector('strong')?.textContent?.trim())})`);
if(!mapChooser.open||mapChooser.maps.length!==3||!['VERTIGO GRID','OVERGROWN OUTPOST','INDUSTRIAL FOUNDRY'].every(name=>mapChooser.maps.includes(name)))throw new Error(`Main Game map chooser is incomplete: ${JSON.stringify(mapChooser)}`);
if(process.env.RESONANCE_PLAY_FLOW_ONLY==='1'){
  await evaluate(`document.querySelector('[data-main-map="1"]').click();true`);await sleep(3600);
  const selectedMainGame=await evaluate(`({started:globalThis.__resonanceDiagnostics.snapshot().started,arena:document.querySelector('#arena-name')?.textContent?.trim(),menuHidden:document.querySelector('#menu').classList.contains('hidden'),chooserClosed:document.querySelector('#play-route-modal').classList.contains('hidden'),countdownHidden:document.querySelector('#countdown').classList.contains('hidden')})`);
  if(!selectedMainGame.started||selectedMainGame.arena!=='OVERGROWN OUTPOST'||!selectedMainGame.menuHidden||!selectedMainGame.chooserClosed||!selectedMainGame.countdownHidden)throw new Error(`Selected Main Game map did not deploy directly: ${JSON.stringify(selectedMainGame)}`);
  if(consoleErrors.length)throw new Error(`Browser console errors:\n${consoleErrors.join('\n')}`);
  console.log(JSON.stringify({lobbyReady,modeChooser,mapChooser,selectedMainGame},null,2));socket.close();process.exit(0);
}
await evaluate(`document.querySelector('#main-map-route-back').click();true`);await sleep(80);
await evaluate(`document.querySelector('#play-route-close').click(); true`);await sleep(100);
await capture('lobby');await resume();
stage('checking the playable lobby Chill Deck');await evaluate(`document.querySelector('[data-play-mode="parkour"]').click(); true`);await sleep(700);
const chillDeck=await evaluate(`({course:globalThis.__resonanceDiagnostics.lobbyParkour(),panelVisible:!document.querySelector('#lobby-parkour-panel').classList.contains('hidden')})`);
if(!chillDeck.course.active||!chillDeck.course.visible||chillDeck.course.colliders<18||chillDeck.course.surfaces<12||chillDeck.course.portals!==3||!['jump','boost'].every(type=>chillDeck.course.pads.includes(type))||!['range','restart','return','portal-neon','portal-canopy','portal-foundry','secret-aquarium','secret-trophy','secret-garden'].every(id=>chillDeck.course.interactives.includes(id))||!chillDeck.panelVisible)throw new Error(`Chill Deck did not initialize: ${JSON.stringify(chillDeck)}`);
await evaluate(`document.querySelector('#mouse-lock-gate')?.classList.add('hidden');document.querySelector('#prompt')?.classList.remove('show');true`);
await sleep(2600);await captureLive('chill-deck');
const vaultStart=await evaluate(`globalThis.__resonanceDiagnostics.testLobbyVault()`);if(!vaultStart.started||!vaultStart.vaulting)throw new Error(`Lobby vault did not start: ${JSON.stringify(vaultStart)}`);let vaultEnd=null;for(let attempt=0;attempt<24;attempt++){await sleep(500);vaultEnd=await evaluate(`globalThis.__resonanceDiagnostics.snapshot()`);if(!vaultEnd.vaulting)break;}if(vaultEnd.position[2]>=223)throw new Error(`Lobby vault did not clear the wall: ${JSON.stringify(vaultEnd)}`);
const chillFinish=await evaluate(`globalThis.__resonanceDiagnostics.finishLobbyParkour()`);if(!chillFinish.finished||chillFinish.completions<1)throw new Error(`Chill Deck reward did not complete: ${JSON.stringify(chillFinish)}`);
stage('checking the three physical Chill Deck course wings and recovery');
const parkourCourses=await evaluate(`globalThis.__resonanceDiagnostics.parkourCourses()`);
const embeddedZones=await evaluate(`globalThis.__resonanceDiagnostics.lobbyParkour().courseZones`);
if(parkourCourses.length!==3||embeddedZones.length!==3||embeddedZones.some(zone=>!zone.insideChillDeck||!zone.insideMainLobby||!zone.connected)||embeddedZones.slice(1).some((zone,index)=>zone.x-embeddedZones[index].x<56))throw new Error(`Embedded course zones are incomplete: ${JSON.stringify({parkourCourses,embeddedZones})}`);
const parkourStart=await evaluate(`globalThis.__resonanceDiagnostics.activateLobbyPortal(0)`);await sleep(450);
const checkpointAdvance=await evaluate(`globalThis.__resonanceDiagnostics.advanceParkourCheckpoint()`);
if(checkpointAdvance.checkpoint!==1||!checkpointAdvance.speedBoosted)throw new Error(`Parkour checkpoint did not advance: ${JSON.stringify(checkpointAdvance)}`);
const parkourRecovery=await evaluate(`globalThis.__resonanceDiagnostics.testParkourRecovery()`);
if((parkourRecovery.penaltyAdded!==3000&&!parkourRecovery.restarted&&!parkourRecovery.recovering)||parkourRecovery.dead||!parkourRecovery.chargeCleared||!parkourRecovery.wallRunCleared)throw new Error(`Parkour recovery failed: ${JSON.stringify(parkourRecovery)}`);
await evaluate(`document.querySelector('#mouse-lock-gate')?.classList.add('hidden');true`);await sleep(450);await captureLive('parkour-trial');
const parkourFinish=await evaluate(`globalThis.__resonanceDiagnostics.finishParkourTrial(20)`);
if(!parkourFinish.completed||parkourFinish.medal!=='gold'||!parkourFinish.returnVisible)throw new Error(`Parkour completion failed: ${JSON.stringify(parkourFinish)}`);
await captureLive('parkour-complete');
await evaluate(`document.querySelector('#complete-return-lobby').click();true`);await sleep(250);
const parkourVariants=[];
for(const [index,name] of [[1,'parkour-canopy'],[2,'parkour-foundry']]){
  const started=await evaluate(`globalThis.__resonanceDiagnostics.startParkourTrial(${index})`);await sleep(400);
  const advanced=await evaluate(`globalThis.__resonanceDiagnostics.advanceParkourCheckpoint()`);const recovered=await evaluate(`globalThis.__resonanceDiagnostics.testParkourRecovery()`);
  if(started.course!==parkourCourses[index].id||advanced.checkpoint!==1||(recovered.penaltyAdded!==3000&&!recovered.restarted&&!recovered.recovering)||recovered.dead||!recovered.chargeCleared||!recovered.wallRunCleared)throw new Error(`Parkour variant ${index} failed: ${JSON.stringify({started,advanced,recovered})}`);
  await evaluate(`document.querySelector('#mouse-lock-gate')?.classList.add('hidden');true`);await captureLive(name);parkourVariants.push({started,advanced,recovered});
  await evaluate(`document.querySelector('#exit-parkour').click();true`);await sleep(180);
}
stage('checking duel routes');await evaluate(`document.querySelector('.play-options [data-match-route="duels"]').click(); true`);await sleep(250);
const routeReady=await evaluate(`Boolean(document.querySelector('#play-route-modal:not(.hidden)')&&document.querySelector('#duel-route:not(.hidden)'))`);
if(!routeReady)throw new Error('Duel selector did not open');
await capture('duel-select');await resume();await evaluate(`document.querySelector('#play-route-close').click(); true`);await sleep(120);
stage('pressing Play, choosing Main Game, selecting Vertigo Grid, and deploying');await evaluate(`document.querySelector('#deploy').click();document.querySelector('#play-route-overview [data-match-route="main"]').click();document.querySelector('[data-main-map="0"]').click();true`);await sleep(4200);await evaluate(`document.querySelector('#mouse-lock-gate')?.click(); true`);await sleep(300);
const inputCapture=await evaluate(`({snapshot:globalThis.__resonanceDiagnostics.snapshot(),gateHidden:document.querySelector('#mouse-lock-gate').classList.contains('hidden')})`);
if(!inputCapture.snapshot.mouseLook||!inputCapture.gateHidden)throw new Error(`Mouse-look capture failed: ${JSON.stringify(inputCapture)}`);
await evaluate(`document.dispatchEvent(new KeyboardEvent('keydown',{code:'Space',key:' ',bubbles:true}));true`);let chargedJump=null;for(let attempt=0;attempt<40;attempt++){await sleep(500);chargedJump=await evaluate(`({state:globalThis.__resonanceDiagnostics.traversal(),active:document.querySelector('#jump-charge').classList.contains('active'),full:document.querySelector('#jump-charge').classList.contains('full'),charge:getComputedStyle(document.querySelector('#jump-charge')).getPropertyValue('--charge')})`);if(chargedJump.state.charge>=.99&&chargedJump.full)break;}
if(!chargedJump.state.charging||Number(chargedJump.charge)<.99||!chargedJump.active||!chargedJump.full)throw new Error(`Charged-jump indicator did not reach full power: ${JSON.stringify(chargedJump)}`);
await captureLive('jump-charge-full');await evaluate(`document.dispatchEvent(new KeyboardEvent('keyup',{code:'Space',key:' ',bubbles:true}));true`);await sleep(900);
const releasedJump=await evaluate(`globalThis.__resonanceDiagnostics.traversal()`);if(releasedJump.charging)throw new Error(`Charged jump remained active after Space release: ${JSON.stringify(releasedJump)}`);
await capture('gameplay-low');await resume();
const diagnostics=await evaluate(`({snapshot:globalThis.__resonanceDiagnostics.snapshot(),graphics:globalThis.__resonanceDiagnostics.graphics(),weapons:globalThis.__resonanceDiagnostics.weaponVisuals(),scopes:globalThis.__resonanceDiagnostics.scopeProfiles(),visualSystems:globalThis.__resonanceDiagnostics.visualSystems()})`);
const platformChecks=await evaluate(`globalThis.__resonanceDiagnostics.collisionAllArenas()`);
for(const arena of platformChecks){
  if(!arena.available||!arena.underPlatformPreserved||Math.abs(arena.topLandingSurface-arena.platformTop)>.01||!arena.rampContinuous||!arena.highSpeedWallBlocked)throw new Error(`Platform traversal failed: ${JSON.stringify(arena)}`);
}
for(const id of ['phantom','bubble-tea-smg','broadside','sledge','combat-knife']){
  const result=await evaluate(`globalThis.__resonanceDiagnostics.aimWeapon(${JSON.stringify(id)},false)`);
  if(!result)throw new Error(`Unable to equip ${id}`);
  await sleep(180);
}
await evaluate(`globalThis.__resonanceDiagnostics.aimWeapon('specter',false)`);
await send('Emulation.setDeviceMetricsOverride',{width:960,height:540,deviceScaleFactor:1,mobile:false});await evaluate(`globalThis.__resonanceDiagnostics.setGraphicsQuality('high')`);await sleep(1200);await capture('gameplay-high');
const highGraphics=await evaluate(`globalThis.__resonanceDiagnostics.graphics()`);await resume();
const scopedView=await evaluate(`globalThis.__resonanceDiagnostics.aimWeapon('sledge',true)`);if(!scopedView.scope||!scopedView.cleanScope||scopedView.weaponVisible)throw new Error(`Precision scope is obstructed: ${JSON.stringify(scopedView)}`);await sleep(650);await capture('ads-precision');await resume();
const aiRoles=await evaluate(`globalThis.__resonanceDiagnostics.systems().ai`);const friendlyFire=await evaluate(`globalThis.__resonanceDiagnostics.testRobotFriendlyFire()`);if(aiRoles.armedTargets!==0||!aiRoles.robotRoles.includes('armed-robot')||!aiRoles.targetRoles.includes('practice-target')||!friendlyFire||friendlyFire.damage<=0||friendlyFire.practiceTargetsArmed!==0)throw new Error(`AI role or friendly-fire check failed: ${JSON.stringify({aiRoles,friendlyFire})}`);
await evaluate(`globalThis.__resonanceDiagnostics.stopAim();globalThis.__resonanceDiagnostics.aimWeapon('broadside',false)`);await sleep(450);await capture('weapon-shotgun');await resume();
await evaluate(`globalThis.__resonanceDiagnostics.aimWeapon('phase-katana',false)`);await sleep(450);await capture('weapon-melee');await resume();
await evaluate(`globalThis.__resonanceDiagnostics.stopAim();globalThis.__resonanceDiagnostics.aimWeapon('phantom',false)`);
await evaluate(`globalThis.__resonanceDiagnostics.setGraphicsQuality('low')`);await sleep(500);
await send('Emulation.setDeviceMetricsOverride',{width:720,height:720,deviceScaleFactor:1,mobile:false});await sleep(500);await capture('gameplay-narrow');

const requiredAttachments=['root','muzzle','sight','ejection','leftHand','rightHand','charm'];
const missingAttachments=diagnostics.weapons.filter(weapon=>!requiredAttachments.every(name=>weapon.attachments.includes(name)));
if(missingAttachments.length)throw new Error(`Missing weapon attachment transforms: ${missingAttachments.map(weapon=>weapon.id).join(', ')}`);
const visualFingerprints=new Set(diagnostics.weapons.map(weapon=>weapon.fingerprint));
if(visualFingerprints.has(undefined)||visualFingerprints.size!==diagnostics.weapons.length)throw new Error(`Weapon visual definitions are not unique: ${visualFingerprints.size}/${diagnostics.weapons.length}`);
const specializedMelee=diagnostics.weapons.filter(weapon=>weapon.meleeStyle&&weapon.meleeStyle!=='knife');
if(specializedMelee.length<10)throw new Error(`Specialized melee silhouettes missing: ${specializedMelee.length}/10`);
const invalidScopes=diagnostics.scopes.filter(scope=>!scope.sightAnchor||scope.blocksCenter||scope.centerError>.001||scope.eyeReliefError>.001||(scope.type!=='none'&&scope.visibility.charm)||(['sniper','low'].includes(scope.type)&&scope.visibility.decorations));
if(invalidScopes.length)throw new Error(`Sight-anchor or scope visibility validation failed: ${JSON.stringify(invalidScopes.slice(0,5))}`);
if(!diagnostics.weapons.every(weapon=>weapon.mechanicalAction&&weapon.animationState&&weapon.materialProfile&&weapon.soundProfile))throw new Error('One or more weapon visual definitions lack mechanical, material, sound, or animation state data');
if(Object.keys(diagnostics.visualSystems.crateProfiles).length!==5||Object.keys(diagnostics.visualSystems.effectProfiles).length<10||Object.keys(diagnostics.visualSystems.abilityProfiles).length<8)throw new Error(`Visual profile registries are incomplete: ${JSON.stringify(diagnostics.visualSystems)}`);
if(consoleErrors.length)throw new Error(`Browser console errors:\n${consoleErrors.join('\n')}`);
console.log(JSON.stringify({lobbyReady,modeChooser,routeReady,chillDeck,vaultStart,vaultEnd,chillFinish,parkourCourses,embeddedZones,parkourStart,checkpointAdvance,parkourRecovery,parkourFinish,parkourVariants,platformChecks,inputCapture,chargedJump,releasedJump,snapshot:diagnostics.snapshot,lowGraphics:diagnostics.graphics,highGraphics,scopedView,scopeProfilesChecked:diagnostics.scopes.length,visualSystems:diagnostics.visualSystems,aiRoles,friendlyFire,weaponsChecked:diagnostics.weapons.length,screenshots:[`${outputPrefix}-lobby.png`,`${outputPrefix}-chill-deck.png`,`${outputPrefix}-parkour-trial.png`,`${outputPrefix}-parkour-complete.png`,`${outputPrefix}-parkour-canopy.png`,`${outputPrefix}-parkour-foundry.png`,`${outputPrefix}-duel-select.png`,`${outputPrefix}-jump-charge-full.png`,`${outputPrefix}-gameplay-high.png`,`${outputPrefix}-gameplay-low.png`,`${outputPrefix}-ads-precision.png`,`${outputPrefix}-weapon-shotgun.png`,`${outputPrefix}-weapon-melee.png`,`${outputPrefix}-gameplay-narrow.png`]},null,2));
socket.close();
