import * as THREE from 'three';

const bodyGeometry = new THREE.BoxGeometry(.74, .86, .4);
const armorGeometry = new THREE.BoxGeometry(.88, .42, .46);
const headGeometry = new THREE.IcosahedronGeometry(.29, 1);
const limbGeometry = new THREE.CapsuleGeometry(.13, .48, 4, 7);
const visorGeometry = new THREE.BoxGeometry(.4, .09, .035);

export function createRemotePlayer(name = 'OPERATOR') {
  const group = new THREE.Group();
  group.name = `network-player-${name}`;
  const armor = new THREE.MeshStandardMaterial({ color:0x23354c, roughness:.43, metalness:.48 });
  const undersuit = new THREE.MeshStandardMaterial({ color:0x0a111d, roughness:.84, metalness:.08 });
  const accent = new THREE.MeshStandardMaterial({ color:0xff5b91, emissive:0x9a174b, emissiveIntensity:.9, roughness:.32, metalness:.35 });
  const skin = new THREE.MeshStandardMaterial({ color:0x4b6179, roughness:.62, metalness:.16 });

  const body = new THREE.Mesh(bodyGeometry, undersuit); body.position.y = 1.02; group.add(body);
  const chest = new THREE.Mesh(armorGeometry, armor); chest.position.set(0, 1.14, -.01); group.add(chest);
  const chestLight = new THREE.Mesh(new THREE.BoxGeometry(.3, .055, .035), accent); chestLight.position.set(0, 1.19, -.25); group.add(chestLight);
  const head = new THREE.Mesh(headGeometry, skin); head.position.y = 1.67; group.add(head);
  const visor = new THREE.Mesh(visorGeometry, accent); visor.position.set(0, 1.69, -.275); group.add(visor);
  for (const side of [-1, 1]) {
    const arm = new THREE.Mesh(limbGeometry, undersuit); arm.position.set(side * .52, .92, 0); arm.rotation.z = side * -.08; group.add(arm);
    const leg = new THREE.Mesh(limbGeometry, undersuit); leg.position.set(side * .22, .35, 0); group.add(leg);
    const shoulder = new THREE.Mesh(new THREE.BoxGeometry(.28, .26, .44), armor); shoulder.position.set(side * .48, 1.23, 0); group.add(shoulder);
  }
  const rifle = new THREE.Mesh(new THREE.BoxGeometry(.11, .13, .98), armor); rifle.position.set(.3, .98, -.43); rifle.rotation.x = -.18; group.add(rifle);
  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(.035, .035, .65, 7), accent); barrel.rotation.x = Math.PI / 2; barrel.position.set(.3, 1.03, -1.18); group.add(barrel);
  group.traverse(object => { if (object.isMesh) { object.castShadow = true; object.receiveShadow = true; } });
  group.userData.targetPosition = new THREE.Vector3();
  group.userData.targetYaw = 0;
  group.userData.alive = true;
  group.userData.materials = [armor, undersuit, accent, skin];
  return group;
}

export function updateRemotePlayer(group, snapshot, dt) {
  group.userData.targetPosition.set(snapshot.x, snapshot.y - 1.75, snapshot.z);
  group.position.lerp(group.userData.targetPosition, 1 - Math.exp(-18 * dt));
  group.rotation.y = dampAngle(group.rotation.y, snapshot.yaw, 12, dt);
  group.visible = snapshot.alive && snapshot.connected;
}

export function disposeRemotePlayer(group) {
  group.removeFromParent();
  group.userData.materials?.forEach(material => material.dispose());
}

function dampAngle(current, target, smoothing, dt) {
  const delta = Math.atan2(Math.sin(target - current), Math.cos(target - current));
  return current + delta * (1 - Math.exp(-smoothing * dt));
}
