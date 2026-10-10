import { INPUT_FLAGS } from '../../shared/network-config.js';

const pressed = (keys, codes) => codes.some(code => keys.has(code));

export function networkInputFromControls(keys, yaw, pitch) {
  const left = pressed(keys, ['KeyA', 'ArrowLeft']);
  const right = pressed(keys, ['KeyD', 'ArrowRight']);
  const forward = pressed(keys, ['KeyW', 'ArrowUp']);
  const backward = pressed(keys, ['KeyS', 'ArrowDown']);
  let flags = 0;
  if (keys.has('Space')) flags |= INPUT_FLAGS.jump;
  if (pressed(keys, ['ShiftLeft', 'ShiftRight'])) flags |= INPUT_FLAGS.sprint;
  if (pressed(keys, ['ControlLeft', 'ControlRight', 'KeyC'])) flags |= INPUT_FLAGS.crouch;
  return {
    moveX:(right ? 1 : 0) - (left ? 1 : 0),
    moveZ:(forward ? 1 : 0) - (backward ? 1 : 0),
    flags,
    yaw,
    pitch,
  };
}
