import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { activeParkourVariant, DUEL_TEAM_SIZES, FUTURE_MINIGAMES, PARKOUR_COURSES, PARKOUR_REWARDS, PARKOUR_ROUTES, PARKOUR_SURFACE_COLORS, PARKOUR_VARIANTS, parkourDayKey, parkourMedalForTime, parkourRewardForCompletion } from '../src/match-flow.js';
import { CHILL_DECK_LAYOUT } from '../src/lobby-hub.js';

test('duels expose every requested team size',()=>{
  assert.deepEqual(DUEL_TEAM_SIZES,[1,2,3,4]);
});

test('four future minigame slots are reserved',()=>{
  assert.equal(FUTURE_MINIGAMES.length,4);
  assert.equal(new Set(FUTURE_MINIGAMES.map(mode=>mode.id)).size,4);
});

test('Main Game offers all three arenas and deploys the selected map without voting',()=>{
  const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
  const client=readFileSync(new URL('../src/main.js',import.meta.url),'utf8');
  assert.deepEqual([...html.matchAll(/data-main-map="(\d)"/g)].map(match=>Number(match[1])),[0,1,2]);
  assert.match(html,/VERTIGO GRID/);
  assert.match(html,/OVERGROWN OUTPOST/);
  assert.match(html,/INDUSTRIAL FOUNDRY/);
  assert.doesNotMatch(html,/id="map-vote-section"/);
  assert.match(client,/mainMapButtons\.forEach\(button=>button\.addEventListener\('click',\(\)=>startDeployment\('main',Number\(button\.dataset\.mainMap\)\)\)\)/);
});

test('parkour offers three distinct Chill Deck zones with ordered medal targets',()=>{
  assert.equal(PARKOUR_COURSES.length,3);
  assert.ok(PARKOUR_COURSES.every(course=>course.location==='chill-deck'&&course.map==='CHILL DECK'));
  assert.equal(new Set(PARKOUR_COURSES.map(course=>course.zone)).size,3);
  for(const course of PARKOUR_COURSES){
    assert.ok(course.medalTimes.gold<course.medalTimes.silver&&course.medalTimes.silver<course.medalTimes.bronze);
    assert.ok(course.targetTime>=course.medalTimes.gold);
    assert.ok(PARKOUR_VARIANTS[course.id].length>=5);
  }
});

test('every parkour course has matching, ordered checkpoint data',()=>{
  assert.equal(PARKOUR_ROUTES.length,PARKOUR_COURSES.length);
  for(const [index,route] of PARKOUR_ROUTES.entries()){
    assert.equal(route.id,PARKOUR_COURSES[index].id);
    assert.equal(route.location,'chill-deck');
    assert.ok(route.zone);
    assert.equal(route.spawn.length,2);
    assert.ok(route.checkpoints.length>=6);
    assert.ok(route.checkpoints.every(point=>point.length===2&&point.every(Number.isFinite)));
    assert.equal(new Set(route.checkpoints.map(point=>point.join(','))).size,route.checkpoints.length);
  }
});

test('each physical lobby portal launches one unique matching course',()=>{assert.deepEqual(PARKOUR_ROUTES.map(route=>route.id),PARKOUR_COURSES.map(course=>course.id));assert.deepEqual(PARKOUR_ROUTES.map(route=>route.spawn[0]),CHILL_DECK_LAYOUT.courseCenters);assert.equal(new Set(PARKOUR_ROUTES.map(route=>route.id)).size,3);});

test('every main parkour route is safe, recoverable, and avoids required moving platforms',()=>{
  for(const route of PARKOUR_ROUTES){
    assert.equal(route.plan.routeType,'MAIN ROUTE — SAFE');
    assert.ok(route.plan.recoveryZones.length>=3);
    assert.ok(route.plan.steps.length>=7);
    assert.ok(route.plan.steps.every(step=>step.checkpointBefore&&step.minWidthCapsules>=3));
    assert.ok(route.plan.steps.every(step=>!step.movingRequired&&!step.disappearingRequired&&!step.blindJump));
    assert.ok(route.plan.steps.every(step=>step.maxRequiredCharge<=.6));
    assert.ok(route.plan.steps.every(step=>step.ordinaryGapRatio<=.5&&step.largeGapRatio<=.65));
    assert.equal(route.plan.checkpointCadence,3);
    assert.ok(route.plan.fallRecoveryMs>=800&&route.plan.fallRecoveryMs<=1100);
    assert.equal(route.plan.returnPortal,true);
    assert.deepEqual(route.plan.routeColors,{main:'green',expert:'red-gold',treasure:'purple',recovery:'blue'});
    assert.equal(route.plan.expert.reconnects,true);
    assert.ok(route.plan.expert.steps.some(step=>step.movingRequired||step.maxRequiredCharge>.6));
  }
});

test('embedded course lanes are spaced apart inside the Chill Deck campus',()=>{
  const centers=PARKOUR_ROUTES.map(route=>route.spawn[0]).sort((a,b)=>a-b);
  assert.deepEqual(centers,CHILL_DECK_LAYOUT.courseCenters);
  assert.ok(centers.slice(1).every((x,index)=>x-centers[index]>=CHILL_DECK_LAYOUT.minimumCourseSpacing));
  for(const route of PARKOUR_ROUTES){
    for(const [x,z] of [route.spawn,...route.checkpoints]){
      assert.ok(x>=CHILL_DECK_LAYOUT.campusBounds.minX&&x<=CHILL_DECK_LAYOUT.campusBounds.maxX,`course x outside Chill Deck: ${x}`);
      assert.ok(z>=CHILL_DECK_LAYOUT.campusBounds.minZ&&z<=CHILL_DECK_LAYOUT.campusBounds.maxZ,`course z outside Chill Deck: ${z}`);
    }
  }
});

test('beginner route details and Foundry transport follow the accessibility brief',()=>{
  const [neon,canopy,foundry]=PARKOUR_ROUTES;
  assert.equal(neon.plan.steps.find(step=>step.id==='vaults').label,'THREE LOW VAULTS');
  assert.equal(neon.plan.steps.find(step=>step.id==='charge').maxRequiredCharge,.5);
  assert.equal(neon.plan.steps.find(step=>step.id==='rooftops').movingRequired,false);
  assert.equal(canopy.plan.steps.find(step=>step.id==='branches').movingRequired,false);
  assert.equal(canopy.plan.expert.steps.find(step=>step.id==='moving-branches').movingRequired,true);
  assert.deepEqual(foundry.plan.steps.map(step=>step.id),['pistons','conveyors','wallrun','launch','crane','catwalk','shaft','forge-maze','boost','lower-bypass','finish']);
  assert.ok(foundry.checkpoints.length>=7);
  assert.deepEqual(foundry.plan.transport,{stopsAtDocks:true,dwellMs:3000,walkOnBridge:true,closesRailings:true,carriesPlayer:true});
  assert.equal(foundry.plan.steps.find(step=>step.id==='pistons').cycleScale,.75);
  assert.ok(foundry.plan.steps.find(step=>step.id==='conveyors').speedScale<1);
});

test('parkour medal ranking follows the selected course thresholds',()=>{
  const course=PARKOUR_COURSES[0];
  assert.equal(parkourMedalForTime(course,course.medalTimes.gold),'gold');
  assert.equal(parkourMedalForTime(course,course.medalTimes.silver),'silver');
  assert.equal(parkourMedalForTime(course,course.medalTimes.bronze),'bronze');
  assert.equal(parkourMedalForTime(course,course.medalTimes.bronze+1),'complete');
});

test('parkour surface language gives every gameplay surface a unique color',()=>{
  assert.deepEqual(Object.keys(PARKOUR_SURFACE_COLORS),['checkpoint','boost','jump','launch','grapple','moving','hazard','secret','solid']);
  assert.equal(new Set(Object.values(PARKOUR_SURFACE_COLORS)).size,Object.keys(PARKOUR_SURFACE_COLORS).length);
});

test('parkour daily rewards pay the medal once then a small replay reward',()=>{
  const course=PARKOUR_COURSES[0];const timestamp=Date.parse('2026-10-10T18:00:00Z');const day=parkourDayKey(timestamp);
  assert.deepEqual(parkourRewardForCompletion(course,'gold',timestamp,{}),{amount:PARKOUR_REWARDS.gold,daily:true,day});
  assert.deepEqual(parkourRewardForCompletion(course,'gold',timestamp,{[course.id]:day}),{amount:PARKOUR_REWARDS.repeat,daily:false,day});
  assert.equal(parkourRewardForCompletion(course,'complete',timestamp-86400000,{[course.id]:day}).amount,PARKOUR_REWARDS.complete);
});

test('parkour variants rotate deterministically every four hours',()=>{
  const course=PARKOUR_COURSES[1];const timestamp=Date.parse('2026-10-10T00:00:00Z');
  assert.equal(activeParkourVariant(course,timestamp),activeParkourVariant(course,timestamp+3*60*60*1000));
  assert.notEqual(activeParkourVariant(course,timestamp).id,activeParkourVariant(course,timestamp+4*60*60*1000).id);
});
