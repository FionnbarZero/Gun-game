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
  if(message.id){const request=pending.get(message.id);if(!request)return;pending.delete(message.id);message.error?request.reject(new Error(message.error.message)):request.resolve(message.result);return;}
  if(message.method==='Runtime.exceptionThrown')consoleErrors.push(message.params.exceptionDetails.exception?.description||message.params.exceptionDetails.text);
  if(message.method==='Log.entryAdded'&&message.params.entry.level==='error')consoleErrors.push(message.params.entry.text);
});
await new Promise((resolve,reject)=>{socket.addEventListener('open',resolve,{once:true});socket.addEventListener('error',reject,{once:true});});
const send=(method,params={})=>new Promise((resolve,reject)=>{const id=++commandId;pending.set(id,{resolve,reject});socket.send(JSON.stringify({id,method,params}));});
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
for(let attempt=0;attempt<20&&!diagnosticsReady;attempt++){await sleep(500);diagnosticsReady=await evaluate(`Boolean(globalThis.__resonanceDiagnostics)`);}
if(!diagnosticsReady)throw new Error(`Diagnostics did not initialize. Console:\n${consoleErrors.join('\n')||'no captured errors'}`);
const lobbyReady=await evaluate(`Boolean(document.querySelector('#deploy')&&!document.querySelector('#deploy').disabled)`);
if(!lobbyReady)throw new Error('Lobby deploy control did not become ready');
const initialVotes=await evaluate(`[...document.querySelectorAll('[data-vote-count]')].map(label=>Number(label.textContent))`);
if(initialVotes.reduce((total,votes)=>total+votes,0)!==1)throw new Error(`Solo lobby contains simulated voters: ${initialVotes.join('/')}`);
await evaluate(`document.querySelector('[data-map="2"]').click(); true`);await sleep(100);
const movedVotes=await evaluate(`[...document.querySelectorAll('[data-vote-count]')].map(label=>Number(label.textContent))`);
if(JSON.stringify(movedVotes)!==JSON.stringify([0,0,1]))throw new Error(`Player ballot did not move cleanly: ${movedVotes.join('/')}`);
await evaluate(`document.querySelector('[data-map="0"]').click(); true`);await sleep(100);
await capture('lobby');await resume();
stage('checking the playable lobby Chill Deck');await evaluate(`document.querySelector('[data-play-mode="parkour"]').click(); true`);await sleep(700);
const chillDeck=await evaluate(`({course:globalThis.__resonanceDiagnostics.lobbyParkour(),panelVisible:!document.querySelector('#lobby-parkour-panel').classList.contains('hidden')})`);
if(!chillDeck.course.active||!chillDeck.course.visible||chillDeck.course.colliders<6||chillDeck.course.surfaces<6||chillDeck.course.interactives.length!==3||!chillDeck.panelVisible)throw new Error(`Chill Deck did not initialize: ${JSON.stringify(chillDeck)}`);
await evaluate(`document.querySelector('#mouse-lock-gate')?.classList.add('hidden');document.querySelector('#prompt')?.classList.remove('show');true`);
await sleep(2600);await captureLive('chill-deck');
const vaultStart=await evaluate(`globalThis.__resonanceDiagnostics.testLobbyVault()`);if(!vaultStart.started||!vaultStart.vaulting)throw new Error(`Lobby vault did not start: ${JSON.stringify(vaultStart)}`);await sleep(550);
const vaultEnd=await evaluate(`globalThis.__resonanceDiagnostics.snapshot()`);if(vaultEnd.vaulting||vaultEnd.position[2]>=223)throw new Error(`Lobby vault did not clear the wall: ${JSON.stringify(vaultEnd)}`);
const chillFinish=await evaluate(`globalThis.__resonanceDiagnostics.finishLobbyParkour()`);if(!chillFinish.finished||chillFinish.completions<1)throw new Error(`Chill Deck reward did not complete: ${JSON.stringify(chillFinish)}`);
await evaluate(`document.querySelector('#exit-lobby-parkour').click(); true`);await sleep(250);
stage('checking Parkour Trials selection and recovery');await evaluate(`document.querySelector('.play-options [data-match-route="parkour"]').click(); true`);await sleep(250);
const parkourCards=await evaluate(`[...document.querySelectorAll('[data-parkour-course]')].map(card=>card.innerText)`);
const parkourCourses=await evaluate(`globalThis.__resonanceDiagnostics.parkourCourses()`);
if(parkourCards.length!==3||parkourCourses.length!==3||parkourCards.some((text,index)=>!text.includes(parkourCourses[index].map)||!text.includes('CHECKPOINTS')||!text.includes('G ')||!text.includes('BEST')))throw new Error(`Parkour cards are incomplete: ${JSON.stringify(parkourCards)}`);
await capture('parkour-select');await resume();
await send('Emulation.setDeviceMetricsOverride',{width:720,height:640,deviceScaleFactor:1,mobile:false});await sleep(250);await capture('parkour-select-narrow');await resume();
await send('Emulation.setDeviceMetricsOverride',{width:960,height:540,deviceScaleFactor:1,mobile:false});await sleep(250);
const parkourStart=await evaluate(`globalThis.__resonanceDiagnostics.startParkourTrial(0)`);await sleep(450);
const checkpointAdvance=await evaluate(`globalThis.__resonanceDiagnostics.advanceParkourCheckpoint()`);
if(checkpointAdvance.checkpoint!==1||!checkpointAdvance.speedBoosted)throw new Error(`Parkour checkpoint did not advance: ${JSON.stringify(checkpointAdvance)}`);
const parkourRecovery=await evaluate(`globalThis.__resonanceDiagnostics.testParkourRecovery()`);
if(parkourRecovery.penaltyAdded!==3000||parkourRecovery.dead)throw new Error(`Parkour recovery failed: ${JSON.stringify(parkourRecovery)}`);
await evaluate(`document.querySelector('#mouse-lock-gate')?.classList.add('hidden');true`);await sleep(450);await captureLive('parkour-trial');
const parkourFinish=await evaluate(`globalThis.__resonanceDiagnostics.finishParkourTrial(20)`);
if(!parkourFinish.completed||parkourFinish.medal!=='gold'||!parkourFinish.returnVisible)throw new Error(`Parkour completion failed: ${JSON.stringify(parkourFinish)}`);
await captureLive('parkour-complete');
await evaluate(`document.querySelector('#complete-return-lobby').click();true`);await sleep(250);
const parkourVariants=[];
for(const [index,name] of [[1,'parkour-canopy'],[2,'parkour-foundry']]){
  const started=await evaluate(`globalThis.__resonanceDiagnostics.startParkourTrial(${index})`);await sleep(400);
  const advanced=await evaluate(`globalThis.__resonanceDiagnostics.advanceParkourCheckpoint()`);const recovered=await evaluate(`globalThis.__resonanceDiagnostics.testParkourRecovery()`);
  if(started.course!==parkourCourses[index].id||advanced.checkpoint!==1||recovered.penaltyAdded!==3000||recovered.dead)throw new Error(`Parkour variant ${index} failed: ${JSON.stringify({started,advanced,recovered})}`);
  await evaluate(`document.querySelector('#mouse-lock-gate')?.classList.add('hidden');true`);await captureLive(name);parkourVariants.push({started,advanced,recovered});
  await evaluate(`document.querySelector('#exit-parkour').click();true`);await sleep(180);
}
stage('checking duel routes');await evaluate(`document.querySelector('.play-options [data-match-route="duels"]').click(); true`);await sleep(250);
const routeReady=await evaluate(`Boolean(document.querySelector('#play-route-modal:not(.hidden)')&&document.querySelector('#duel-route:not(.hidden)'))`);
if(!routeReady)throw new Error('Duel selector did not open');
await capture('duel-select');await resume();await evaluate(`document.querySelector('#play-route-close').click(); true`);await sleep(120);
stage('pressing Play and starting ten-second map vote');await evaluate(`document.querySelector('#deploy').click(); true`);await sleep(14600);await evaluate(`document.querySelector('#mouse-lock-gate')?.click(); true`);await sleep(300);
const inputCapture=await evaluate(`({snapshot:globalThis.__resonanceDiagnostics.snapshot(),gateHidden:document.querySelector('#mouse-lock-gate').classList.contains('hidden')})`);
if(!inputCapture.snapshot.mouseLook||!inputCapture.gateHidden)throw new Error(`Mouse-look capture failed: ${JSON.stringify(inputCapture)}`);
await capture('gameplay-low');await resume();
const diagnostics=await evaluate(`({snapshot:globalThis.__resonanceDiagnostics.snapshot(),graphics:globalThis.__resonanceDiagnostics.graphics(),weapons:globalThis.__resonanceDiagnostics.weaponVisuals()})`);
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
await evaluate(`globalThis.__resonanceDiagnostics.aimWeapon('sledge',true)`);await sleep(650);await capture('ads-precision');await resume();
await evaluate(`globalThis.__resonanceDiagnostics.stopAim();globalThis.__resonanceDiagnostics.aimWeapon('broadside',false)`);await sleep(450);await capture('weapon-shotgun');await resume();
await evaluate(`globalThis.__resonanceDiagnostics.aimWeapon('phase-katana',false)`);await sleep(450);await capture('weapon-melee');await resume();
await evaluate(`globalThis.__resonanceDiagnostics.stopAim();globalThis.__resonanceDiagnostics.aimWeapon('phantom',false)`);
await evaluate(`globalThis.__resonanceDiagnostics.setGraphicsQuality('low')`);await sleep(500);
await send('Emulation.setDeviceMetricsOverride',{width:720,height:720,deviceScaleFactor:1,mobile:false});await sleep(500);await capture('gameplay-narrow');

const requiredAttachments=['root','muzzle','sight','ejection','leftHand','rightHand'];
const missingAttachments=diagnostics.weapons.filter(weapon=>!requiredAttachments.every(name=>weapon.attachments.includes(name)));
if(missingAttachments.length)throw new Error(`Missing weapon attachment transforms: ${missingAttachments.map(weapon=>weapon.id).join(', ')}`);
const visualFingerprints=new Set(diagnostics.weapons.map(weapon=>weapon.fingerprint));
if(visualFingerprints.has(undefined)||visualFingerprints.size!==diagnostics.weapons.length)throw new Error(`Weapon visual definitions are not unique: ${visualFingerprints.size}/${diagnostics.weapons.length}`);
const specializedMelee=diagnostics.weapons.filter(weapon=>weapon.meleeStyle&&weapon.meleeStyle!=='knife');
if(specializedMelee.length<10)throw new Error(`Specialized melee silhouettes missing: ${specializedMelee.length}/10`);
if(consoleErrors.length)throw new Error(`Browser console errors:\n${consoleErrors.join('\n')}`);
console.log(JSON.stringify({lobbyReady,routeReady,soloVotes:movedVotes,chillDeck,vaultStart,vaultEnd,chillFinish,parkourCourses,parkourStart,checkpointAdvance,parkourRecovery,parkourFinish,parkourVariants,platformChecks,inputCapture,snapshot:diagnostics.snapshot,lowGraphics:diagnostics.graphics,highGraphics,weaponsChecked:diagnostics.weapons.length,screenshots:[`${outputPrefix}-lobby.png`,`${outputPrefix}-chill-deck.png`,`${outputPrefix}-parkour-select.png`,`${outputPrefix}-parkour-select-narrow.png`,`${outputPrefix}-parkour-trial.png`,`${outputPrefix}-parkour-complete.png`,`${outputPrefix}-parkour-canopy.png`,`${outputPrefix}-parkour-foundry.png`,`${outputPrefix}-duel-select.png`,`${outputPrefix}-gameplay-high.png`,`${outputPrefix}-gameplay-low.png`,`${outputPrefix}-ads-precision.png`,`${outputPrefix}-weapon-shotgun.png`,`${outputPrefix}-weapon-melee.png`,`${outputPrefix}-gameplay-narrow.png`]},null,2));
socket.close();
