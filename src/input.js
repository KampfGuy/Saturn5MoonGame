/** Keyboard state for arcade controls. */
export const keys = Object.create(null);

export function initInput() {
  window.addEventListener('keydown', (e) => {
    keys[e.code] = true;
    // Prevent page scroll on game keys
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyE'].includes(e.code)) {
      e.preventDefault();
    }
  });
  window.addEventListener('keyup', (e) => {
    keys[e.code] = false;
  });
  window.addEventListener('blur', () => {
    for (const k of Object.keys(keys)) keys[k] = false;
  });
}

export function thrustHeld() {
  return !!(keys.Space || keys.KeyW || keys.ArrowUp);
}

export function steerLeft() {
  return !!(keys.KeyA || keys.ArrowLeft);
}

export function steerRight() {
  return !!(keys.KeyD || keys.ArrowRight);
}

export function evaPressed() {
  return !!keys.KeyE;
}
