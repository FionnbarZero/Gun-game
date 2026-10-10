import test from 'node:test';
import assert from 'node:assert/strict';
import { DUEL_TEAM_SIZES, FUTURE_MINIGAMES, MAP_VOTE_DURATION_SECONDS, PARKOUR_COURSES, PARKOUR_ROUTES, parkourMedalForTime, soloVoteTally, winningMapIndex } from '../src/match-flow.js';

test('main game map voting lasts ten seconds',()=>{
  assert.equal(MAP_VOTE_DURATION_SECONDS,10);
});

test('duels expose every requested team size',()=>{
  assert.deepEqual(DUEL_TEAM_SIZES,[1,2,3,4]);
});

test('four future minigame slots are reserved',()=>{
  assert.equal(FUTURE_MINIGAMES.length,4);
  assert.equal(new Set(FUTURE_MINIGAMES.map(mode=>mode.id)).size,4);
});

test('parkour offers three distinct arena variants with ordered medal targets',()=>{
  assert.equal(PARKOUR_COURSES.length,3);
  assert.equal(new Set(PARKOUR_COURSES.map(course=>course.arena)).size,3);
  assert.equal(new Set(PARKOUR_COURSES.map(course=>course.map)).size,3);
  for(const course of PARKOUR_COURSES)assert.ok(course.medalTimes.gold<course.medalTimes.silver&&course.medalTimes.silver<course.medalTimes.bronze);
});

test('every parkour course has matching, ordered checkpoint data',()=>{
  assert.equal(PARKOUR_ROUTES.length,PARKOUR_COURSES.length);
  for(const [index,route] of PARKOUR_ROUTES.entries()){
    assert.equal(route.id,PARKOUR_COURSES[index].id);
    assert.equal(route.spawn.length,2);
    assert.ok(route.checkpoints.length>=6);
    assert.ok(route.checkpoints.every(point=>point.length===2&&point.every(Number.isFinite)));
    assert.equal(new Set(route.checkpoints.map(point=>point.join(','))).size,route.checkpoints.length);
  }
});

test('parkour medal ranking follows the selected course thresholds',()=>{
  const course=PARKOUR_COURSES[0];
  assert.equal(parkourMedalForTime(course,course.medalTimes.gold),'gold');
  assert.equal(parkourMedalForTime(course,course.medalTimes.silver),'silver');
  assert.equal(parkourMedalForTime(course,course.medalTimes.bronze),'bronze');
  assert.equal(parkourMedalForTime(course,course.medalTimes.bronze+1),'complete');
});

test('map vote winner is deterministic and respects the player choice on ties',()=>{
  assert.equal(winningMapIndex([3,5,2],0),1);
  assert.equal(winningMapIndex([4,4,1],1),1);
  assert.equal(winningMapIndex([4,4,1],2),0);
});

test('solo matches contain exactly one player vote',()=>{
  assert.deepEqual(soloVoteTally(3,0),[1,0,0]);
  assert.deepEqual(soloVoteTally(3,2),[0,0,1]);
  assert.equal(soloVoteTally(3,1).reduce((total,votes)=>total+votes,0),1);
});
