// Keyboard and mouse state. Keys are read by code ('KeyW', 'Space', ...),
// `pressed` holds edge-triggered presses since the last frame, and the mouse
// reports drag deltas for the orbit camera plus click edges for shooting.
export function createInput(canvas) {
  const keys = new Set();
  const pressed = new Set();
  const mouse = { x: 0, y: 0, dx: 0, dy: 0, left: false, right: false, leftPressed: false, wheel: 0 };
  let enabled = true;

  function onKeyDown(event) {
    if (!enabled) return;
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.code)) event.preventDefault();
    if (!keys.has(event.code)) pressed.add(event.code);
    keys.add(event.code);
  }
  function onKeyUp(event) {
    keys.delete(event.code);
  }
  function onMouseMove(event) {
    mouse.x = event.clientX;
    mouse.y = event.clientY;
    mouse.dx += event.movementX || 0;
    mouse.dy += event.movementY || 0;
  }
  function onMouseDown(event) {
    if (event.button === 0) {
      mouse.left = true;
      mouse.leftPressed = true;
    } else if (event.button === 2) mouse.right = true;
  }
  function onMouseUp(event) {
    if (event.button === 0) mouse.left = false;
    else if (event.button === 2) mouse.right = false;
  }
  function onWheel(event) {
    mouse.wheel += event.deltaY;
  }
  function onContextMenu(event) {
    event.preventDefault();
  }

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('mousemove', onMouseMove);
  window.addEventListener('mousedown', onMouseDown);
  window.addEventListener('mouseup', onMouseUp);
  window.addEventListener('wheel', onWheel, { passive: true });
  canvas.addEventListener('contextmenu', onContextMenu);

  // -1..1 steering/throttle axes from WASD or the arrow keys.
  function axis() {
    const left = keys.has('KeyA') || keys.has('ArrowLeft');
    const right = keys.has('KeyD') || keys.has('ArrowRight');
    const up = keys.has('KeyW') || keys.has('ArrowUp');
    const down = keys.has('KeyS') || keys.has('ArrowDown');
    return { x: (right ? 1 : 0) - (left ? 1 : 0), y: (up ? 1 : 0) - (down ? 1 : 0) };
  }

  return {
    keys,
    pressed,
    mouse,
    axis,
    down(code) {
      return keys.has(code);
    },
    wasPressed(code) {
      return pressed.has(code);
    },
    setEnabled(value) {
      enabled = value;
      if (!value) {
        keys.clear();
        pressed.clear();
      }
    },
    // Call once per frame after every system has read the input.
    endFrame() {
      pressed.clear();
      mouse.dx = 0;
      mouse.dy = 0;
      mouse.leftPressed = false;
      mouse.wheel = 0;
    },
  };
}
