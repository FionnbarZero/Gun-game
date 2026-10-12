import { writeFile } from 'node:fs/promises';

const endpoint=process.env.RESONANCE_CDP_ENDPOINT||'http://127.0.0.1:9231';
const guestEndpoint=process.env.RESONANCE_GUEST_CDP_ENDPOINT||'http://127.0.0.1:9232';
const gameUrl=process.env.RESONANCE_GAME_URL||'http://127.0.0.1:5176/?diagnostics&quality=low';
const outputPrefix=process.env.RESONANCE_SCREENSHOT_PREFIX||'/tmp/resonance-multiplayer';
const sleep=milliseconds=>new Promise(resolve=>setTimeout(resolve,milliseconds));

async function createPage(label,browserEndpoint){
  const target=await fetch(`${browserEndpoint}/json/new?${encodeURIComponent('about:blank')}`,{method:'PUT'}).then(response=>response.json());
  if(!target.webSocketDebuggerUrl)throw new Error(`Unable to create ${label} page`);
  const socket=new WebSocket(target.webSocketDebuggerUrl);let id=0;const pending=new Map();const errors=[];
  socket.addEventListener('message',event=>{const message=JSON.parse(event.data);if(message.id){const request=pending.get(message.id);if(!request)return;pending.delete(message.id);message.error?request.reject(new Error(message.error.message)):request.resolve(message.result);return;}if(message.method==='Runtime.exceptionThrown')errors.push(message.params.exceptionDetails.exception?.description||message.params.exceptionDetails.text);if(message.method==='Log.entryAdded'&&message.params.entry.level==='error')errors.push(message.params.entry.text);});
  await new Promise((resolve,reject)=>{socket.addEventListener('open',resolve,{once:true});socket.addEventListener('error',reject,{once:true});});
  const send=(method,params={})=>new Promise((resolve,reject)=>{const commandId=++id;const timeout=setTimeout(()=>{pending.delete(commandId);reject(new Error(`${label}: ${method} timed out`));},60000);pending.set(commandId,{resolve:value=>{clearTimeout(timeout);resolve(value);},reject:error=>{clearTimeout(timeout);reject(error);}});socket.send(JSON.stringify({id:commandId,method,params}));});
  const evaluate=async expression=>{const result=await send('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(result.exceptionDetails)throw new Error(result.exceptionDetails.exception?.description||result.exceptionDetails.text);return result.result.value;};
  await send('Page.enable');await send('Runtime.enable');await send('Log.enable');await send('Page.addScriptToEvaluateOnNewDocument',{source:`window.requestAnimationFrame=callback=>setTimeout(()=>callback(performance.now()),150);window.cancelAnimationFrame=clearTimeout;`});await send('Emulation.setDeviceMetricsOverride',{width:900,height:600,deviceScaleFactor:1,mobile:false});
  await send('Page.navigate',{url:gameUrl});
  return{label,socket,send,evaluate,errors};
}

async function waitFor(page,expression,message,attempts=50){for(let attempt=0;attempt<attempts;attempt++){if(await page.evaluate(expression))return;await sleep(200);}throw new Error(`${page.label}: ${message}`);}
async function capture(page,name){const result=await page.send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false,fromSurface:true});await writeFile(`${outputPrefix}-${name}.png`,Buffer.from(result.data,'base64'));}

const host=await createPage('host',endpoint);
console.log('stage: host lobby');
await waitFor(host,`Boolean(globalThis.__resonanceDiagnostics&&document.querySelector('#deploy'))`,'lobby did not initialize');
await host.evaluate(`document.querySelector('.play-options [data-match-route="duels"]').click();document.querySelector('#multiplayer-name').value='HOST ZERO';document.querySelector('#create-private-match').click();true`);
await waitFor(host,`globalThis.__resonanceDiagnostics.multiplayer().connected`,'private room was not created');
const roomCode=await host.evaluate(`globalThis.__resonanceDiagnostics.multiplayer().roomCode`);
if(!/^[A-HJ-NP-Z2-9]{5}$/.test(roomCode))throw new Error(`Invalid browser room code: ${roomCode}`);
console.log(`stage: room ${roomCode}`);
const guest=await createPage('guest',guestEndpoint);
console.log('stage: guest lobby');
await waitFor(guest,`Boolean(globalThis.__resonanceDiagnostics&&document.querySelector('#join-private-match'))`,'lobby did not initialize');
await guest.evaluate(`document.querySelector('.play-options [data-match-route="duels"]').click();document.querySelector('#multiplayer-name').value='GUEST ECHO';document.querySelector('#private-room-code').value='${roomCode}';document.querySelector('#join-private-match').click();true`);
await waitFor(guest,`globalThis.__resonanceDiagnostics.multiplayer().connected`,'guest did not join the private room');
await waitFor(host,`globalThis.__resonanceDiagnostics.multiplayer().mode==='multiplayer'`,'host did not enter the duel');
await waitFor(host,`globalThis.__resonanceDiagnostics.multiplayer().snapshot?.phase==='playing'`,'host countdown did not finish',40);
await waitFor(guest,`globalThis.__resonanceDiagnostics.multiplayer().snapshot?.phase==='playing'`,'guest countdown did not finish',40);
console.log('stage: both playing');
await guest.evaluate(`document.activeElement?.blur();true`);
const guestStart=await guest.evaluate(`globalThis.__resonanceDiagnostics.multiplayer().snapshot.players.find(player=>player.sessionId===globalThis.__resonanceDiagnostics.multiplayer().sessionId).z`);
await guest.send('Input.dispatchKeyEvent',{type:'keyDown',code:'KeyS',key:'s',windowsVirtualKeyCode:83});await sleep(650);await guest.send('Input.dispatchKeyEvent',{type:'keyUp',code:'KeyS',key:'s',windowsVirtualKeyCode:83});await sleep(350);
const guestMoved=await guest.evaluate(`globalThis.__resonanceDiagnostics.multiplayer().snapshot.players.find(player=>player.sessionId===globalThis.__resonanceDiagnostics.multiplayer().sessionId).z`);
if(Math.abs(guestMoved-guestStart)<.35)throw new Error(`authoritative browser movement did not advance: ${guestStart} -> ${guestMoved}`);
console.log(`stage: movement ${guestStart} -> ${guestMoved}`);

for(let elimination=1;elimination<=5;elimination++){
  if(elimination>1)await waitFor(guest,`globalThis.__resonanceDiagnostics.multiplayer().snapshot?.players.find(player=>player.sessionId!==globalThis.__resonanceDiagnostics.multiplayer().sessionId)?.alive===true && globalThis.__resonanceDiagnostics.multiplayer().snapshot.players.find(player=>player.sessionId!==globalThis.__resonanceDiagnostics.multiplayer().sessionId).spawnProtectedUntil<=Date.now()`,'guest did not receive the host respawn',35);
  const aim=await guest.evaluate(`globalThis.__resonanceDiagnostics.multiplayerAimAtOpponent()`);if(!aim)throw new Error(`guest could not acquire host for elimination ${elimination}`);await sleep(320);
  for(let shot=0;shot<3;shot++){await guest.evaluate(`globalThis.__resonanceDiagnostics.multiplayerFire()`);await sleep(150);}
  await waitFor(guest,`globalThis.__resonanceDiagnostics.multiplayer().snapshot?.players.find(player=>player.sessionId===globalThis.__resonanceDiagnostics.multiplayer().sessionId)?.kills>=${elimination}`,'server did not confirm elimination',25);
  console.log(`stage: elimination ${elimination}`);
}
await waitFor(host,`globalThis.__resonanceDiagnostics.multiplayer().snapshot?.phase==='ended'`,'score-limit match did not end',25);
await waitFor(guest,`globalThis.__resonanceDiagnostics.multiplayer().snapshot?.phase==='ended'`,'guest did not receive match result',25);await sleep(250);
const hostState=await host.evaluate(`globalThis.__resonanceDiagnostics.multiplayer()`);const guestState=await guest.evaluate(`globalThis.__resonanceDiagnostics.multiplayer()`);const resultTitle=await guest.evaluate(`document.querySelector('#complete-title')?.textContent?.replace(/\s+/g,' ').trim()`);await capture(host,'host-live');await capture(guest,'guest-victory');

if(hostState.snapshot.players.length!==2||hostState.remotePlayers!==1||hostState.snapshot.phase!=='ended')throw new Error(`host synchronization failed: ${JSON.stringify(hostState)}`);
const self=hostState.snapshot.players.find(player=>player.sessionId===hostState.sessionId);if(!self||self.alive||self.health!==0||self.deaths!==5)throw new Error(`host authoritative defeat state failed: ${JSON.stringify(self)}`);
const guestSelf=guestState.snapshot.players.find(player=>player.sessionId===guestState.sessionId);if(guestSelf?.kills!==5||guestState.snapshot.winnerSessionId!==guestState.sessionId||!resultTitle?.includes('VICTORY'))throw new Error(`guest result failed: ${JSON.stringify({guestSelf,winner:guestState.snapshot.winnerSessionId,resultTitle})}`);
if(host.errors.length||guest.errors.length)throw new Error(`Browser errors:\n${[...host.errors,...guest.errors].join('\n')}`);
console.log(JSON.stringify({roomCode,movement:{from:guestStart,to:guestMoved},host:{phase:hostState.snapshot.phase,players:hostState.snapshot.players.length,remotes:hostState.remotePlayers},guest:{phase:guestState.snapshot.phase,kills:guestSelf.kills,resultTitle},screenshots:[`${outputPrefix}-host-live.png`,`${outputPrefix}-guest-victory.png`]},null,2));
await host.send('Page.close');await guest.send('Page.close');host.socket.close();guest.socket.close();process.exit(0);
