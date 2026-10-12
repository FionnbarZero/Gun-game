import test from 'node:test';
import assert from 'node:assert/strict';
import {capsuleIntersectsAabb,circleOverlapsAabb,circlesOverlap,sampleSegment,separateCirclePair,verticalSpansOverlap} from '../src/collision-system.js';

const box={minX:-1,maxX:1,minY:0,maxY:2,minZ:-1,maxZ:1};

test('capsule collision respects horizontal radius and vertical overlap',()=>{
  assert.equal(capsuleIntersectsAabb({x:1.3,z:0,radius:.45,feet:0,head:1.9},box),true);
  assert.equal(capsuleIntersectsAabb({x:1.6,z:0,radius:.45,feet:0,head:1.9},box),false);
  assert.equal(capsuleIntersectsAabb({x:0,z:0,radius:.45,feet:2,head:3.8},box),false);
  assert.equal(verticalSpansOverlap(2,3.8,0,2),false);
  assert.equal(circleOverlapsAabb(0,0,.45,box),true);
});

test('dynamic circles separate without passing through each other',()=>{
  const result=separateCirclePair({x:0,z:0,radius:.7},{x:1,z:0,radius:.7},.1);
  assert.equal(result.overlap,true);
  assert.ok(result.a.x<0);
  assert.ok(result.b.x>1);
  assert.equal(circlesOverlap({...result.a,radius:.7},{...result.b,radius:.7},.1),false);
});

test('fixed bodies remain fixed while movable actors are separated',()=>{
  const result=separateCirclePair({x:0,z:0,radius:.8,fixed:true},{x:.4,z:0,radius:.7},0);
  assert.deepEqual(result.a,{x:0,z:0});
  assert.ok(result.b.x>=1.5);
});

test('route sampling includes both ends at bounded spacing',()=>{
  const points=sampleSegment({x:0,z:0},{x:0,z:3},.5);
  assert.deepEqual(points[0],{x:0,z:0});
  assert.deepEqual(points.at(-1),{x:0,z:3});
  assert.ok(points.length>=7);
});
