import test from 'node:test';
import assert from 'node:assert/strict';
import {CHILL_DECK_LAYOUT,HUB_AREAS,HUB_CONNECTIONS,HUB_NAVIGATION_COLORS,HUB_PARKOUR_PORTALS,HUB_PRIMARY_WINGS,HUB_PROMENADE_SEGMENTS,HUB_REQUIRED_DESTINATIONS,HUB_UPPER_FLOOR,LOBBY_SECRET_TOTAL,hubAreaBounds,hubAreasOverlap,hubLayoutIsConnected,hubRoomWallSegments,parkourWingBounds,parkourWingsOverlap,pointInsideHubArea,reachableHubAreas} from '../src/lobby-hub.js';

const areaById=id=>HUB_AREAS.find(area=>area.id===id);

test('central hub exposes every required physical destination',()=>{
  const ids=new Set(HUB_AREAS.map(area=>area.id));
  for(const id of HUB_REQUIRED_DESTINATIONS)assert.ok(ids.has(id),id);
  assert.equal(ids.size,HUB_AREAS.length);
});

test('navigation roles use stable distinct destination colors',()=>{
  for(const role of ['play','information','shop','inventory','range','chill','parkour','factory','walkway'])assert.equal(typeof HUB_NAVIGATION_COLORS[role],'number');
  assert.equal(new Set(Object.values(HUB_NAVIGATION_COLORS)).size,Object.keys(HUB_NAVIGATION_COLORS).length);
});

test('the atrium has four distinct, labeled activity wings',()=>{
  assert.equal(HUB_PRIMARY_WINGS.length,4);
  assert.deepEqual(new Set(HUB_PRIMARY_WINGS.map(wing=>wing.direction)),new Set(['north','east','south','west']));
  assert.deepEqual(new Set(HUB_PRIMARY_WINGS.map(wing=>wing.id)),new Set(['armory','play','parkour','chill']));
  for(const wing of HUB_PRIMARY_WINGS){
    assert.ok(wing.areaIds.length>=1,`${wing.id} has no area`);
    assert.ok(wing.terminalIds.length>=2,`${wing.id} has no useful terminals`);
    for(const id of wing.areaIds)assert.ok(areaById(id),`${wing.id} references missing ${id}`);
    for(const id of wing.terminalIds)assert.ok(CHILL_DECK_LAYOUT.terminalPositions[id],`${wing.id} references missing terminal ${id}`);
    assert.ok(HUB_CONNECTIONS.some(edge=>edge.from==='atrium'&&wing.areaIds.includes(edge.to)||edge.to==='atrium'&&wing.areaIds.includes(edge.from)),`${wing.id} lacks a direct crossroads route`);
  }
});

test('every major area is physically connected with overlapping solid floors',()=>{
  assert.equal(hubLayoutIsConnected(),true);
  assert.deepEqual(new Set(reachableHubAreas()),new Set(HUB_REQUIRED_DESTINATIONS));
  for(const edge of HUB_CONNECTIONS){
    assert.ok(edge.size[0]>=8&&edge.size[2]>=9,`${edge.id} is too narrow`);
    assert.ok(edge.axis==='x'||edge.axis==='z',`${edge.id} needs an explicit travel axis so railings cannot cross the route`);
    assert.equal(hubAreasOverlap(edge,areaById(edge.from)),true,`${edge.id} misses ${edge.from}`);
    assert.equal(hubAreasOverlap(edge,areaById(edge.to)),true,`${edge.id} misses ${edge.to}`);
  }
});

test('the parkour staging deck and separated course wings remain inside the lobby campus',()=>{
  const parkour=areaById('parkour');
  assert.deepEqual(parkour.position,CHILL_DECK_LAYOUT.position);
  assert.deepEqual(parkour.size,CHILL_DECK_LAYOUT.size);
  assert.ok(parkour.size[0]>=44&&parkour.size[2]>=34);
  assert.equal(HUB_PARKOUR_PORTALS.length,3);
  assert.deepEqual(HUB_PARKOUR_PORTALS.map(portal=>portal.courseIndex),[0,1,2]);
  assert.ok(HUB_PARKOUR_PORTALS.every(portal=>portal.directLaunch&&portal.insideChillDeck&&portal.insideMainLobby&&portal.connected));
  assert.equal(new Set(HUB_PARKOUR_PORTALS.map(portal=>portal.id)).size,3);
  assert.equal(new Set(HUB_PARKOUR_PORTALS.map(portal=>portal.zone)).size,3);
  const xs=HUB_PARKOUR_PORTALS.map(portal=>portal.x).sort((a,b)=>a-b);
  assert.deepEqual(xs,CHILL_DECK_LAYOUT.courseCenters);
  assert.ok(xs.slice(1).every((x,index)=>x-xs[index]>=CHILL_DECK_LAYOUT.minimumCourseSpacing));
  for(let index=0;index<HUB_PARKOUR_PORTALS.length;index++)for(let other=index+1;other<HUB_PARKOUR_PORTALS.length;other++)assert.equal(parkourWingsOverlap(HUB_PARKOUR_PORTALS[index],HUB_PARKOUR_PORTALS[other]),false);
  for(const portal of HUB_PARKOUR_PORTALS){const bounds=parkourWingBounds(portal);assert.ok(bounds.minX>=CHILL_DECK_LAYOUT.campusBounds.minX);assert.ok(bounds.maxX<=CHILL_DECK_LAYOUT.campusBounds.maxX);}
});

test('hub rooms are spaced apart instead of intersecting each other',()=>{
  for(let index=0;index<HUB_AREAS.length;index++)for(let other=index+1;other<HUB_AREAS.length;other++)assert.equal(hubAreasOverlap(HUB_AREAS[index],HUB_AREAS[other]),false,`${HUB_AREAS[index].id} overlaps ${HUB_AREAS[other].id}`);
});

test('indoor rooms have collision wall shells with clear configured doorways',()=>{
  const pointInside=(point,segment)=>{const [x,,z]=segment.position,[width,,depth]=segment.size;return point.x>=x-width/2&&point.x<=x+width/2&&point.z>=z-depth/2&&point.z<=z+depth/2;};
  for(const area of HUB_AREAS){
    const segments=hubRoomWallSegments(area);
    if(!area.indoor){assert.deepEqual(segments,[],`${area.id} must remain open air`);continue;}
    assert.ok(segments.length>=4,`${area.id} needs a complete wall shell`);
    const bounds=hubAreaBounds(area);
    for(const side of area.openings){
      const point=side==='north'?{x:area.position[0],z:bounds.minZ}:side==='south'?{x:area.position[0],z:bounds.maxZ}:side==='west'?{x:bounds.minX,z:area.position[2]}:{x:bounds.maxX,z:area.position[2]};
      assert.equal(segments.some(segment=>pointInside(point,segment)),false,`${area.id} ${side} doorway is blocked`);
    }
  }
});

test('terminals are assigned to their activity wing with eight-unit spacing',()=>{
  const [centerX,,centerZ]=CHILL_DECK_LAYOUT.crossroads;
  for(const wing of HUB_PRIMARY_WINGS){
    const terminals=wing.terminalIds.map(id=>[id,CHILL_DECK_LAYOUT.terminalPositions[id]]);
    for(const [id,point] of terminals){
      assert.ok(wing.areaIds.some(areaId=>pointInsideHubArea(point,areaById(areaId),-1.5)),`${id} is outside ${wing.id}`);
      assert.ok(Math.hypot(point[0]-centerX,point[2]-centerZ)>=CHILL_DECK_LAYOUT.centralClearRadius,`${id} blocks the crossroads`);
    }
    for(let index=0;index<terminals.length;index++)for(let other=index+1;other<terminals.length;other++){
      const [firstId,[firstX,,firstZ]]=terminals[index],[secondId,[secondX,,secondZ]]=terminals[other];
      assert.ok(Math.hypot(firstX-secondX,firstZ-secondZ)>=8,`${firstId} is too close to ${secondId}`);
    }
  }
});

test('secret buttons are outside the crossroads and require deliberate side routes',()=>{
  const [centerX,,centerZ]=CHILL_DECK_LAYOUT.crossroads;
  const secrets=Object.entries(CHILL_DECK_LAYOUT.secretPositions);
  assert.equal(secrets.length,LOBBY_SECRET_TOTAL);
  assert.ok(LOBBY_SECRET_TOTAL>=6);
  for(const [id,secret] of secrets){
    const [x,,z]=secret.position;
    assert.ok(Math.hypot(x-centerX,z-centerZ)>=24,`${id} is still in the central lane`);
    assert.ok(secret.requiredObstacles>=2,`${id} is too easy to stumble into`);
    assert.ok(secret.access.length>8);
    assert.ok(x>=CHILL_DECK_LAYOUT.hubBounds.minX&&x<=CHILL_DECK_LAYOUT.hubBounds.maxX);
    assert.ok(z>=CHILL_DECK_LAYOUT.hubBounds.minZ&&z<=CHILL_DECK_LAYOUT.hubBounds.maxZ);
  }
});

test('the outer promenade forms a generous loop with clear route spokes',()=>{
  assert.ok(HUB_PROMENADE_SEGMENTS.length>=6);
  assert.equal(new Set(HUB_PROMENADE_SEGMENTS.map(segment=>segment.id)).size,HUB_PROMENADE_SEGMENTS.length);
  for(const segment of HUB_PROMENADE_SEGMENTS){
    assert.ok(segment.size[0]>=12&&segment.size[2]>=12,`${segment.id} is too narrow`);
    assert.ok(['x','z'].includes(segment.axis),`${segment.id} needs a travel axis`);
    assert.ok(pointInsideHubArea(segment.position,{position:[16,3.55,234],size:[440,.7,280]},0),`${segment.id} leaves the campus`);
  }
});

test('the second floor has connected destinations and two forgiving stairways',()=>{
  assert.ok(HUB_UPPER_FLOOR.levelY>=8);
  assert.ok(HUB_UPPER_FLOOR.slabs.length>=10);
  assert.ok(HUB_UPPER_FLOOR.destinations.length>=4);
  assert.equal(HUB_UPPER_FLOOR.stairs.length,2);
  for(const stairs of HUB_UPPER_FLOOR.stairs){
    assert.ok(stairs.steps>=12);
    assert.ok(stairs.width>=5);
    assert.ok(stairs.rise<=.4);
    assert.ok(stairs.run>=1.4);
  }
});
