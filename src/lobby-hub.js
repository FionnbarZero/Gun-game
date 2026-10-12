const freeze=value=>Object.freeze(value);

export const HUB_NAVIGATION_COLORS=freeze({
  play:0x4f7cff,
  information:0x50e5ff,
  shop:0xff4fba,
  inventory:0xa96cff,
  range:0xff5366,
  chill:0x67e8a5,
  parkour:0xffc857,
  factory:0xff7043,
  walkway:0xe8f4f5,
});

// One layout source drives meshes, colliders, interaction terminals, recovery,
// diagnostics, and tests. The arrival atrium is the four-way crossroads:
// west = Armory, north = Play/Range, east = Parkour, south = Social/Chill.
export const CHILL_DECK_LAYOUT=freeze({
  position:freeze([18,3.6,272]),
  size:freeze([84,.8,50]),
  crossroads:freeze([-44,5.75,272]),
  socialArea:freeze({position:freeze([-44,3.6,334]),size:freeze([80,.8,42])}),
  socialSpawn:freeze([-44,5.75,334]),
  courseSpawn:freeze([18,5.75,292]),
  campusBounds:freeze({minX:30,maxX:214,minZ:112,maxZ:310}),
  hubBounds:freeze({minX:-200,maxX:232,minZ:100,maxZ:368}),
  courseCenters:freeze([58,126,194]),
  minimumCourseSpacing:68,
  courseLaneWidth:38,
  portalZ:292,
  concourseZ:292,
  concourseDepth:24,
  concourseWidth:184,
  resetMargin:8,
  centralClearRadius:10,
  terminalPositions:freeze({
    'daily-reward':freeze([-52,5.45,282]),
    'tutorial-guide':freeze([-36,5.45,282]),
    'quick-play':freeze([-56,5.45,212]),
    'map-selector':freeze([-44,5.45,212]),
    'private-match':freeze([-32,5.45,212]),
    'range-door':freeze([8,5.45,212]),
    'drone-lab':freeze([20,5.45,220]),
    'shop-wing':freeze([-114,5.45,270]),
    'inventory-wing':freeze([-102,5.45,270]),
    'crate-chamber':freeze([-114,5.45,282]),
    'hub-preview-room':freeze([-102,5.45,282]),
    'ability-lab':freeze([-108,5.45,216]),
    'utility-sandbox':freeze([-98,5.45,224]),
    'personal-factory':freeze([-114,5.45,324]),
    'public-tycoon':freeze([-102,5.45,324]),
    'kill-fx-preview':freeze([-74,5.45,320]),
    'cosmetic-preview-room':freeze([-58,5.45,320]),
    'terminal-challenges':freeze([-42,5.45,320]),
    'trophy-gallery':freeze([-26,5.45,320]),
    'aquarium-feed':freeze([-168,5.45,342]),
    'aquarium-lights':freeze([-152,5.45,342]),
    'arcade-challenge':freeze([-72,5.45,342]),
    jukebox:freeze([-56,5.45,342]),
    'koi-controls':freeze([-40,5.45,342]),
    'treasure-vault':freeze([-24,5.45,342]),
    restart:freeze([40,5.45,286]),
    return:freeze([40,5.45,270]),
  }),
  secretPositions:freeze({
    aquarium:freeze({position:freeze([-180,6.2,363]),access:'hidden-aquarium-maintenance-vent',requiredObstacles:3}),
    trophy:freeze({position:freeze([-70,8.15,352]),access:'upper-gallery-side-climb',requiredObstacles:3}),
    pizza:freeze({position:freeze([48,8.15,246]),access:'parkour-overlook-rooftop-jumps',requiredObstacles:3}),
    developer:freeze({position:freeze([-184,6.2,302]),access:'outer-promenade-button-sequence',requiredObstacles:4}),
    koi:freeze({position:freeze([-18,6.2,356]),access:'hidden-koi-stepping-stones',requiredObstacles:3}),
    vault:freeze({position:freeze([208,6.2,126]),access:'all-course-token-neon-vault',requiredObstacles:5}),
  }),
});

export const LOBBY_SECRET_TOTAL=Object.keys(CHILL_DECK_LAYOUT.secretPositions).length;

export const HUB_AREAS=freeze([
  freeze({id:'atrium',label:'CENTRAL ATRIUM — FOUR WAYS',position:freeze([-44,3.6,272]),size:freeze([32,.8,32]),colorRole:'information',indoor:true,openings:freeze(['north','east','south','west'])}),
  freeze({id:'matchmaking',label:'PLAY + MAP HALL',position:freeze([-44,3.6,214]),size:freeze([42,.8,34]),colorRole:'play',indoor:true,openings:freeze(['south','east'])}),
  freeze({id:'range',label:'FIRING RANGE + DRONE LAB',position:freeze([8,3.6,214]),size:freeze([42,.8,34]),colorRole:'range',indoor:true,openings:freeze(['west'])}),
  freeze({id:'armory',label:'ARMORY + INVENTORY MARKET',position:freeze([-108,3.6,272]),size:freeze([42,.8,42]),colorRole:'shop',indoor:true,openings:freeze(['north','east','south'])}),
  freeze({id:'ability',label:'ABILITY + UTILITY LAB',position:freeze([-108,3.6,218]),size:freeze([34,.8,30]),colorRole:'inventory',indoor:true,openings:freeze(['south'])}),
  freeze({id:'factory',label:'FACTORY ELEVATOR',position:freeze([-108,3.6,326]),size:freeze([34,.8,30]),colorRole:'factory',indoor:true,openings:freeze(['north'])}),
  freeze({id:'parkour',label:'PARKOUR CAMPUS',position:CHILL_DECK_LAYOUT.position,size:CHILL_DECK_LAYOUT.size,colorRole:'parkour',existing:true,indoor:false,openings:freeze([])}),
  freeze({id:'chill',label:'CHILL + SOCIAL DECK',position:CHILL_DECK_LAYOUT.socialArea.position,size:CHILL_DECK_LAYOUT.socialArea.size,colorRole:'chill',indoor:false,openings:freeze([])}),
  freeze({id:'aquarium',label:'AQUARIUM GROTTO',position:freeze([-160,3.6,348]),size:freeze([48,.8,40]),colorRole:'information',indoor:false,openings:freeze([])}),
]);

export const HUB_CONNECTIONS=freeze([
  freeze({id:'atrium-play',from:'atrium',to:'matchmaking',position:freeze([-44,3.72,243.5]),size:freeze([14,.56,27]),axis:'z',colorRole:'play'}),
  freeze({id:'play-range',from:'matchmaking',to:'range',position:freeze([-18,3.72,214]),size:freeze([12,.56,14]),axis:'x',colorRole:'range'}),
  freeze({id:'atrium-armory',from:'atrium',to:'armory',position:freeze([-76,3.72,272]),size:freeze([34,.56,14]),axis:'x',colorRole:'shop'}),
  freeze({id:'armory-ability',from:'armory',to:'ability',position:freeze([-108,3.72,243]),size:freeze([14,.56,22]),axis:'z',colorRole:'inventory'}),
  freeze({id:'armory-factory',from:'armory',to:'factory',position:freeze([-108,3.72,302]),size:freeze([14,.56,22]),axis:'z',colorRole:'factory'}),
  freeze({id:'atrium-parkour',from:'atrium',to:'parkour',position:freeze([-25.5,3.72,272]),size:freeze([11,.56,14]),axis:'x',colorRole:'parkour',glass:true}),
  freeze({id:'atrium-chill',from:'atrium',to:'chill',position:freeze([-44,3.72,300.5]),size:freeze([14,.56,29]),axis:'z',colorRole:'chill',glass:true}),
  freeze({id:'chill-aquarium',from:'chill',to:'aquarium',position:freeze([-110,3.72,350]),size:freeze([58,.56,14]),axis:'x',colorRole:'information',glass:true}),
]);

export const HUB_PROMENADE_SEGMENTS=freeze([
  freeze({id:'promenade-north',position:freeze([12,3.55,120]),size:freeze([400,.7,12]),axis:'x'}),
  freeze({id:'promenade-south',position:freeze([12,3.55,360]),size:freeze([400,.7,12]),axis:'x'}),
  freeze({id:'promenade-west',position:freeze([-188,3.55,240]),size:freeze([12,.7,252]),axis:'z'}),
  freeze({id:'promenade-east',position:freeze([212,3.55,240]),size:freeze([12,.7,252]),axis:'z'}),
  freeze({id:'promenade-north-spoke',position:freeze([-44,3.55,158.5]),size:freeze([14,.7,77]),axis:'z'}),
  freeze({id:'promenade-west-spoke',position:freeze([-156.5,3.55,218]),size:freeze([63,.7,12]),axis:'x'}),
]);

export const HUB_UPPER_FLOOR=freeze({
  levelY:9.2,
  slabs:freeze([
    freeze({id:'balcony-north',position:freeze([-44,9.2,250]),size:freeze([64,.7,10]),axis:'x'}),
    freeze({id:'balcony-south',position:freeze([-44,9.2,294]),size:freeze([64,.7,10]),axis:'x'}),
    freeze({id:'balcony-west',position:freeze([-71,9.2,272]),size:freeze([10,.7,34]),axis:'z'}),
    freeze({id:'balcony-east',position:freeze([-17,9.2,272]),size:freeze([10,.7,34]),axis:'z'}),
    freeze({id:'bridge-observation',position:freeze([-44,9.2,232]),size:freeze([12,.7,28]),axis:'z'}),
    freeze({id:'bridge-museum',position:freeze([-88,9.2,272]),size:freeze([28,.7,12]),axis:'x'}),
    freeze({id:'bridge-parkour',position:freeze([14,9.2,272]),size:freeze([52,.7,12]),axis:'x'}),
    freeze({id:'bridge-lounge',position:freeze([-44,9.2,312]),size:freeze([12,.7,28]),axis:'z'}),
    freeze({id:'observation-gallery',position:freeze([-44,9.2,206]),size:freeze([46,.7,24]),axis:'x'}),
    freeze({id:'weapon-museum',position:freeze([-110,9.2,272]),size:freeze([34,.7,28]),axis:'x'}),
    freeze({id:'parkour-overlook',position:freeze([54,9.2,272]),size:freeze([38,.7,28]),axis:'x'}),
    freeze({id:'sky-lounge',position:freeze([-44,9.2,334]),size:freeze([58,.7,24]),axis:'x'}),
  ]),
  stairs:freeze([
    freeze({id:'west-stairs',base:freeze([-70,3.9,319]),direction:freeze([0,0,-1]),steps:14,rise:.4,run:1.5,width:5}),
    freeze({id:'east-stairs',base:freeze([-18,3.9,319]),direction:freeze([0,0,-1]),steps:14,rise:.4,run:1.5,width:5}),
  ]),
  destinations:freeze(['observation-gallery','weapon-museum','parkour-overlook','sky-lounge']),
});

export const HUB_PRIMARY_WINGS=freeze([
  freeze({id:'armory',direction:'west',label:'WEAPONS + ABILITIES',colorRole:'shop',areaIds:freeze(['armory','ability','factory']),terminalIds:freeze(['shop-wing','inventory-wing','crate-chamber','hub-preview-room','ability-lab','utility-sandbox','personal-factory','public-tycoon'])}),
  freeze({id:'play',direction:'north',label:'MAPS + FIRING RANGE',colorRole:'play',areaIds:freeze(['matchmaking','range']),terminalIds:freeze(['quick-play','map-selector','private-match','range-door','drone-lab'])}),
  freeze({id:'parkour',direction:'east',label:'PARKOUR CAMPUS',colorRole:'parkour',areaIds:freeze(['parkour']),terminalIds:freeze(['restart','return'])}),
  freeze({id:'chill',direction:'south',label:'CHILL + SOCIAL',colorRole:'chill',areaIds:freeze(['chill','aquarium']),terminalIds:freeze(['kill-fx-preview','cosmetic-preview-room','terminal-challenges','trophy-gallery','aquarium-feed','aquarium-lights','arcade-challenge','jukebox','koi-controls','treasure-vault'])}),
]);

export const HUB_REQUIRED_DESTINATIONS=freeze(['atrium','matchmaking','range','armory','ability','factory','parkour','chill','aquarium']);

const portalDefinitions=[['portal-neon','START NEON VELOCITY','neon-wing'],['portal-canopy','START CANOPY CIRCUIT','canopy-garden'],['portal-foundry','START FOUNDRY RUSH','foundry-bay']];
export const HUB_PARKOUR_PORTALS=freeze(portalDefinitions.map(([id,label,zone],courseIndex)=>freeze({id,label,x:CHILL_DECK_LAYOUT.courseCenters[courseIndex],z:CHILL_DECK_LAYOUT.portalZ,courseIndex,directLaunch:true,insideChillDeck:true,insideMainLobby:true,connected:true,zone})));

export function hubAreaBounds(area,padding=0){
  const [x,,z]=area.position,[width,,depth]=area.size;
  return freeze({minX:x-width/2-padding,maxX:x+width/2+padding,minZ:z-depth/2-padding,maxZ:z+depth/2+padding});
}

export function hubAreasOverlap(a,b,padding=0){
  const first=hubAreaBounds(a,padding),second=hubAreaBounds(b,padding);
  return first.minX<second.maxX&&first.maxX>second.minX&&first.minZ<second.maxZ&&first.maxZ>second.minZ;
}

export function pointInsideHubArea(point,area,padding=0){
  const bounds=hubAreaBounds(area,padding);const [x,,z]=point;
  return x>=bounds.minX&&x<=bounds.maxX&&z>=bounds.minZ&&z<=bounds.maxZ;
}

export function hubRoomWallSegments(area,{doorwayWidth=9,wallThickness=.45,wallHeight=5.6}={}){
  if(!area?.indoor)return[];
  const [x,y,z]=area.position,[width,height,depth]=area.size;const floorTop=y+height/2,wallY=floorTop+wallHeight/2;const openings=new Set(area.openings||[]);const segments=[];
  const addHorizontal=(side,zPosition)=>{
    if(!openings.has(side)){segments.push({side,position:[x,wallY,zPosition],size:[width,wallHeight,wallThickness]});return;}
    const segmentWidth=Math.max(0,(width-doorwayWidth)/2);if(segmentWidth<=0)return;const offset=doorwayWidth/2+segmentWidth/2;
    segments.push({side,position:[x-offset,wallY,zPosition],size:[segmentWidth,wallHeight,wallThickness]},{side,position:[x+offset,wallY,zPosition],size:[segmentWidth,wallHeight,wallThickness]});
  };
  const addVertical=(side,xPosition)=>{
    if(!openings.has(side)){segments.push({side,position:[xPosition,wallY,z],size:[wallThickness,wallHeight,depth]});return;}
    const segmentDepth=Math.max(0,(depth-doorwayWidth)/2);if(segmentDepth<=0)return;const offset=doorwayWidth/2+segmentDepth/2;
    segments.push({side,position:[xPosition,wallY,z-offset],size:[wallThickness,wallHeight,segmentDepth]},{side,position:[xPosition,wallY,z+offset],size:[wallThickness,wallHeight,segmentDepth]});
  };
  addHorizontal('north',z-depth/2);addHorizontal('south',z+depth/2);addVertical('west',x-width/2);addVertical('east',x+width/2);
  return segments.map(segment=>freeze({side:segment.side,position:freeze(segment.position),size:freeze(segment.size)}));
}

export function parkourWingBounds(portal,padding=0){
  const half=CHILL_DECK_LAYOUT.courseLaneWidth/2+padding;
  return freeze({minX:portal.x-half,maxX:portal.x+half,minZ:CHILL_DECK_LAYOUT.campusBounds.minZ,maxZ:CHILL_DECK_LAYOUT.campusBounds.maxZ});
}

export function parkourWingsOverlap(a,b,padding=0){
  const first=parkourWingBounds(a,padding),second=parkourWingBounds(b,padding);
  return first.minX<second.maxX&&first.maxX>second.minX;
}

export function reachableHubAreas(start='atrium'){
  const reached=new Set([start]);let changed=true;
  while(changed){changed=false;for(const edge of HUB_CONNECTIONS){if(reached.has(edge.from)&&!reached.has(edge.to)){reached.add(edge.to);changed=true;}if(reached.has(edge.to)&&!reached.has(edge.from)){reached.add(edge.from);changed=true;}}}
  return [...reached];
}

export function hubLayoutIsConnected(){const reached=new Set(reachableHubAreas());return HUB_REQUIRED_DESTINATIONS.every(id=>reached.has(id));}
