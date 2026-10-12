const finite=(value,fallback=0)=>Number.isFinite(value)?value:fallback;

export function verticalSpansOverlap(minA,maxA,minB,maxB,epsilon=.055){
  return finite(minA)<finite(maxB)-epsilon&&finite(maxA)>finite(minB)+epsilon;
}

export function circleOverlapsAabb(x,z,radius,box){
  const closestX=Math.max(box.minX,Math.min(x,box.maxX));
  const closestZ=Math.max(box.minZ,Math.min(z,box.maxZ));
  const dx=x-closestX,dz=z-closestZ;
  return dx*dx+dz*dz<radius*radius;
}

export function capsuleIntersectsAabb(capsule,box,epsilon=.055){
  if(!circleOverlapsAabb(capsule.x,capsule.z,capsule.radius,box))return false;
  return verticalSpansOverlap(capsule.feet,capsule.head,box.minY,box.maxY,epsilon);
}

export function circlesOverlap(a,b,padding=0){
  const radius=finite(a.radius)+finite(b.radius)+Math.max(0,padding);
  const dx=finite(a.x)-finite(b.x),dz=finite(a.z)-finite(b.z);
  return dx*dx+dz*dz<radius*radius;
}

export function separateCirclePair(a,b,padding=0){
  const radius=finite(a.radius)+finite(b.radius)+Math.max(0,padding);
  let dx=finite(a.x)-finite(b.x),dz=finite(a.z)-finite(b.z);let distance=Math.hypot(dx,dz);
  if(distance>=radius)return{overlap:false,a:{x:a.x,z:a.z},b:{x:b.x,z:b.z}};
  const coincident=distance<1e-6;const nx=coincident?1:dx/distance,nz=coincident?0:dz/distance;if(coincident)distance=0;
  const penetration=radius-distance;
  const aWeight=a.fixed?0:b.fixed?1:.5,bWeight=b.fixed?0:a.fixed?1:.5;
  return{
    overlap:true,
    a:{x:finite(a.x)+nx*penetration*aWeight,z:finite(a.z)+nz*penetration*aWeight},
    b:{x:finite(b.x)-nx*penetration*bWeight,z:finite(b.z)-nz*penetration*bWeight},
  };
}

export function sampleSegment(start,end,spacing=.5){
  const distance=Math.hypot(end.x-start.x,end.z-start.z);const count=Math.max(1,Math.ceil(distance/Math.max(.05,spacing)));
  return Array.from({length:count+1},(_,index)=>({x:start.x+(end.x-start.x)*index/count,z:start.z+(end.z-start.z)*index/count}));
}
