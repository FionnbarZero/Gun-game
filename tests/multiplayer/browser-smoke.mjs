import { writeFile } from 'node:fs/promises';
import { ColyseusSDK } from '@colyseus/sdk';

const endpoint=process.env.RESONANCE_CDP_ENDPOINT||'http://127.0.0.1:9231';
const gameUrl=process.env.RESONANCE_GAME_URL||'http://127.0.0.1:5176/?diagnostics&quality=low';
const outputPrefix=process.env.RESONANCE_SCREENSHOT_PREFIX||'/tmp/resonance-multiplayer';
const sleep=milliseconds=>new Promise(resolve=>setTimeout(resolve,milliseconds));

async function createPage(label){
  const target=await fetch(`${endpoint}/json/new?${encodeURIComponent('about:blank')}`,{method:'PUT'}).then(response=>response.json());
  if(!target.webSocketDebuggerUrl)throw new Error(`Unable to create ${label} page`);
  const socket=new WebSocket(target.webSocketDebuggerUrl);let id=0;const pending=new Map();const errors=[];
  socket.addEventListener('message',event=>{const message=JSON.parse(event.data);if(message.id){const request=pending.get(message.id);if(!request)return;pending.delete(message.id);message.error?request.reject(new Error(message.error.message)):request.resolve(message.result);return;}if(message.method==='Runtime.exceptionThrown')errors.push(message.params.exceptionDetails.exception?.description||message.params.exceptionDetails.text);if(message.method==='Log.entryAdded'&&message.params.entry.level==='error')errors.push(message.params.entry.text);});
  await new Promise((resolve,reject)=>{socket.addEventListener('open',resolve,{once:true});socket.addEventListener('error',reject,{once:true});});
  const send=(method,params={})=>new Promise((resolve,reject)=>{const commandId=++id;const timeout=setTimeout(()=>{pending.delete(commandId);reject(new Error(`${label}: ${method} timed out`));},20000);pending.set(commandId,{resolve:value=>{clearTimeout(timeout);resolve(value);},reject:error=>{clearTimeout(timeout);reject(error);}});socket.send(JSON.stringify({id:commandId,method,params}));});
  const evaluate=async expression=>{const result=await send('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(result.exceptionDetails)throw new Error(result.exceptionDetails.exception?.description||result.exceptionDetails.text);return result.result.value;};
  await send('Page.enable');await send('Runtime.enable');await send('Log.enable');await send('Page.addScriptToEvaluateOnNewDocument',{source:`{const nativeFrame=requestAnimationFrame.bind(window);window.requestAnimationFrame=callback=>setTimeout(()=>nativeFrame(callback),90);}`});await send('Emulation.setDeviceMetricsOverride',{width:900,height:600,deviceScaleFactor:1,mobile:false});
  await send('Page.navigate',{url:gameUrl});
  return{label,socket,send,evaluate,errors};
}

async function waitFor(page,expression,message,attempts=50){for(let attempt=0;attempt<attempts;attempt++){if(await page.evaluate(expression))return;await sleep(200);}throw new Error(`${page.label}: ${message}`);}
async function capture(page,name){const result=await page.send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false,fromSurface:true});await writeFile(`${outputPrefix}-${name}.png`,Buffer.from(result.data,'base64'));}

const host=await createPage('host');
await waitFor(host,`Boolean(globalThis.__resonanceDiagnostics&&document.querySelector('#deploy'))`,'lobby did not initialize');
await host.evaluate(`document.querySelector('.play-options [data-match-route="duels"]').click();document.querySelector('#multiplayer-name').value='HOST ZERO';document.querySelector('#create-private-match').click();true`);
await waitFor(host,`globalThis.__resonanceDiagnostics.multiplayer().connected`,'private room was not created');
const roomCode=await host.evaluate(`globalThis.__resonanceDiagnostics.multiplayer().roomCode`);
if(!/^[A-HJ-NP-Z2-9]{5}$/.test(roomCode))throw new Error(`Invalid browser room code: ${roomCode}`);
await capture(host,'room-code');
await host.evaluate(`globalThis.__resonanceDiagnostics.pauseRendering()`);

const guestSdk=new ColyseusSDK(gameUrl.startsWith('https:')?gameUrl.replace(/^https?:\/\/([^/]+).*$/,'wss://$1'):gameUrl.replace(/^https?:\/\/([^/]+).*$/,'ws://$1'));
const guestRoom=await guestSdk.joinById(roomCode,{name:'GUEST ECHO'});
await new Promise(resolve=>guestRoom.onStateChange.once(resolve));
await waitFor(host,`globalThis.__resonanceDiagnostics.multiplayer().mode==='multiplayer'`,'host did not enter the duel');
await sleep(3800);
await host.evaluate(`globalThis.__resonanceDiagnostics.resumeRendering()`);await waitFor(host,`globalThis.__resonanceDiagnostics.multiplayer().snapshot?.phase==='playing'`,'server countdown did not finish',30);await sleep(350);
const hostState=await host.evaluate(`globalThis.__resonanceDiagnostics.multiplayer()`);await capture(host,'host-live');await host.evaluate(`globalThis.__resonanceDiagnostics.pauseRendering()`);

if(hostState.snapshot.players.length!==2||hostState.remotePlayers!==1||hostState.snapshot.phase!=='playing')throw new Error(`host synchronization failed: ${JSON.stringify(hostState)}`);
const self=hostState.snapshot.players.find(player=>player.sessionId===hostState.sessionId);if(!self||self.ammo!==30||self.health!==100)throw new Error(`host authoritative self state failed: ${JSON.stringify(self)}`);
if(guestRoom.state.phase!=='playing'||guestRoom.state.players.size!==2)throw new Error(`SDK guest synchronization failed: ${guestRoom.state.phase}/${guestRoom.state.players.size}`);
if(host.errors.length)throw new Error(`Browser errors:\n${host.errors.join('\n')}`);
console.log(JSON.stringify({roomCode,host:{phase:hostState.snapshot.phase,players:hostState.snapshot.players.length,remotes:hostState.remotePlayers},guest:{phase:guestRoom.state.phase,players:guestRoom.state.players.size},screenshots:[`${outputPrefix}-room-code.png`,`${outputPrefix}-host-live.png`]},null,2));
await guestRoom.leave(true);await host.send('Page.close');host.socket.close();process.exit(0);
