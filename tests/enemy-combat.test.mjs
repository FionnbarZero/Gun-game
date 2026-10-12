import test from 'node:test';
import assert from 'node:assert/strict';
import { AI_STATES, COMBAT_ROLES, ENEMY_DIFFICULTY_PROFILES, aimErrorRadius, beginReload, isArmedRobot, isPracticeTarget, nearestRobotRival, sampleReactionDelay, shouldForceMiss, stepAngle, updateReload } from '../src/enemy-combat.js';

const entity=(kind,combatRole,canShoot,index,arena,x,z)=>({kind,combatRole,canShoot,index,arena,alive:true,group:{position:{x,z}}});

test('only explicitly armed robot entities are allowed to shoot',()=>{
  const robot=entity('enemy',COMBAT_ROLES.robot,true,0,0,0,0);
  const target=entity('dummy',COMBAT_ROLES.target,false,1,0,2,0);
  assert.equal(isArmedRobot(robot),true);
  assert.equal(isArmedRobot(target),false);
  assert.equal(isPracticeTarget(target),true);
});

test('robot rivals exclude practice targets, dead robots, and other arenas',()=>{
  const robot=entity('enemy',COMBAT_ROLES.robot,true,0,0,0,0);
  const target=entity('dummy',COMBAT_ROLES.target,false,1,0,1,0);
  const nearest=entity('enemy',COMBAT_ROLES.robot,true,2,0,4,0);
  const dead=entity('enemy',COMBAT_ROLES.robot,true,3,0,2,0);dead.alive=false;
  const otherArena=entity('enemy',COMBAT_ROLES.robot,true,4,1,3,0);
  assert.equal(nearestRobotRival(robot,[target,dead,otherArena,nearest]),nearest);
});

test('AI profiles preserve difficulty order while leaving longer counterplay windows',()=>{
  const {training,easy,normal,hard}=ENEMY_DIFFICULTY_PROFILES;
  assert.ok(training.reaction>easy.reaction&&easy.reaction>normal.reaction&&normal.reaction>hard.reaction);
  assert.ok(training.error>easy.error&&easy.error>normal.error&&normal.error>hard.error);
  assert.ok(training.damageMax<easy.damageMax&&easy.damageMax<normal.damageMax&&normal.damageMax<=hard.damageMax);
  assert.ok(normal.reactionMin>=550&&normal.pauseMin>=1000&&normal.burstMax<=4);
});

test('reaction samples obey each difficulty minimum and slow for poor perception',()=>{
  for(const profile of Object.values(ENEMY_DIFFICULTY_PROFILES)){
    assert.equal(sampleReactionDelay(profile,0),profile.reactionMin);
    assert.equal(sampleReactionDelay(profile,1),profile.reactionMax);
    assert.ok(sampleReactionDelay(profile,.5,{behind:true,far:true})>sampleReactionDelay(profile,.5));
  }
});

test('moving targets and damaged moving NPCs receive a larger aim-error radius',()=>{
  const profile=ENEMY_DIFFICULTY_PROFILES.normal;
  const stationary=aimErrorRadius(profile,{distance:35,confidence:.4});
  const evasive=aimErrorRadius(profile,{distance:35,targetSpeed:15,npcMoving:true,targetSliding:true,recentlyHurt:true,confidence:.4});
  assert.ok(evasive>stationary);
});

test('training and easy profiles enforce a miss after their hit streak cap',()=>{
  assert.equal(shouldForceMiss(ENEMY_DIFFICULTY_PROFILES.training,2,.99),true);
  assert.equal(shouldForceMiss(ENEMY_DIFFICULTY_PROFILES.easy,3,.99),true);
  assert.equal(shouldForceMiss(ENEMY_DIFFICULTY_PROFILES.hard,0,.99),false);
});

test('turning is rate limited and reload restores a real magazine after its opening',()=>{
  assert.ok(stepAngle(0,Math.PI,0.2)<=.2);
  const profile=ENEMY_DIFFICULTY_PROFILES.easy;const enemy={ammo:0,magazine:profile.magazine,aiState:AI_STATES.fire,burstRemaining:3};
  const finish=beginReload(enemy,profile,1000);assert.equal(enemy.aiState,AI_STATES.reload);assert.equal(enemy.burstRemaining,0);assert.equal(updateReload(enemy,profile,finish-1),false);assert.equal(updateReload(enemy,profile,finish),true);assert.equal(enemy.ammo,profile.magazine);
});
