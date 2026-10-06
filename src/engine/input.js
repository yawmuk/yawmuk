// Keyboard, mouse-orbit, wheel-zoom and touch (virtual joystick + drag-to-look + interact button).
import { h } from './dom.js';
import { t, onLangChange } from './i18n.js';

export function createInput(canvas, uiRoot) {
  const keys = new Set();
  const state = {
    enabled: true,        // movement/orbit enabled (false while a dialog is open)
    move: { x: 0, y: 0 }, // joystick vector, x right, y forward, |v|<=1
    orbitDX: 0, orbitDY: 0, zoom: 0,
    onInteract: null, onMenu: null
  };

  const typing = (e) => /input|textarea|select/i.test(e.target?.tagName || '');
  window.addEventListener('keydown', (e) => {
    if (typing(e)) return;
    keys.add(e.code);
    if (e.code === 'Escape') { state.onMenu?.(); }
    if (state.enabled && (e.code === 'KeyE' || e.code === 'Enter' || e.code === 'Space') && !e.repeat) {
      if (document.activeElement && document.activeElement !== document.body && document.activeElement.tagName === 'BUTTON') return;
      e.preventDefault();
      state.onInteract?.();
    }
    if (state.enabled && e.code.startsWith('Arrow')) e.preventDefault();
  });
  window.addEventListener('keyup', (e) => keys.delete(e.code));
  window.addEventListener('blur', () => keys.clear());

  // ---- orbit with mouse drag / touch drag on the canvas
  let orbitPointer = null, lastX = 0, lastY = 0;
  canvas.addEventListener('pointerdown', (e) => {
    if (orbitPointer !== null) return;
    orbitPointer = e.pointerId; lastX = e.clientX; lastY = e.clientY;
    canvas.setPointerCapture?.(e.pointerId);
  });
  canvas.addEventListener('pointermove', (e) => {
    if (e.pointerId !== orbitPointer) return;
    if (state.enabled) { state.orbitDX += e.clientX - lastX; state.orbitDY += e.clientY - lastY; }
    lastX = e.clientX; lastY = e.clientY;
  });
  const endOrbit = (e) => { if (e.pointerId === orbitPointer) orbitPointer = null; };
  canvas.addEventListener('pointerup', endOrbit);
  canvas.addEventListener('pointercancel', endOrbit);
  canvas.addEventListener('wheel', (e) => { if (state.enabled) state.zoom += Math.sign(e.deltaY); e.preventDefault(); }, { passive: false });
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());

  // ---- virtual joystick (touch devices)
  const knob = h('div', { class: 'joy-knob' });
  const joy = h('div', { class: 'joystick', 'aria-hidden': 'true' }, knob);
  const interactBtn = h('button', { class: 'interact-btn', type: 'button', onclick: () => state.onInteract?.() }, t('interact'));
  onLangChange(() => { interactBtn.textContent = interactBtn.dataset.label || t('interact'); });
  const touchLayer = h('div', { class: 'touch-controls' }, joy, interactBtn);
  uiRoot.append(touchLayer);
  let joyId = null, cx = 0, cy = 0;
  const R = 48;
  joy.addEventListener('pointerdown', (e) => {
    joyId = e.pointerId; joy.setPointerCapture(e.pointerId);
    const r = joy.getBoundingClientRect(); cx = r.left + r.width / 2; cy = r.top + r.height / 2;
    moveJoy(e); e.preventDefault();
  });
  const moveJoy = (e) => {
    if (e.pointerId !== joyId) return;
    let dx = e.clientX - cx, dy = e.clientY - cy;
    const len = Math.hypot(dx, dy); if (len > R) { dx *= R / len; dy *= R / len; }
    knob.style.transform = `translate(${dx}px, ${dy}px)`;
    state.move.x = dx / R; state.move.y = -dy / R;
  };
  joy.addEventListener('pointermove', moveJoy);
  const endJoy = (e) => { if (e.pointerId !== joyId) return; joyId = null; state.move.x = state.move.y = 0; knob.style.transform = ''; };
  joy.addEventListener('pointerup', endJoy);
  joy.addEventListener('pointercancel', endJoy);

  const touchCapable = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
  document.body.classList.toggle('touch', touchCapable);
  window.addEventListener('touchstart', () => document.body.classList.add('touch'), { once: true, passive: true });

  /** Movement axes from keys + joystick. x: right(+)/left(-), y: forward(+)/back(-). */
  function axes() {
    if (!state.enabled) return { x: 0, y: 0 };
    let x = 0, y = 0;
    if (keys.has('KeyW') || keys.has('ArrowUp')) y += 1;
    if (keys.has('KeyS') || keys.has('ArrowDown')) y -= 1;
    if (keys.has('KeyD') || keys.has('ArrowRight')) x += 1;
    if (keys.has('KeyA') || keys.has('ArrowLeft')) x -= 1;
    x += state.move.x; y += state.move.y;
    const len = Math.hypot(x, y); if (len > 1) { x /= len; y /= len; }
    return { x, y, run: keys.has('ShiftLeft') || keys.has('ShiftRight') };
  }
  function consumeOrbit() { const o = { dx: state.orbitDX, dy: state.orbitDY, zoom: state.zoom }; state.orbitDX = state.orbitDY = state.zoom = 0; return o; }
  function setInteractVisible(v, label) {
    interactBtn.classList.toggle('show', !!v);
    interactBtn.dataset.label = label || '';
    interactBtn.textContent = label || t('interact');
  }
  function setEnabled(v) {
    state.enabled = v;
    touchLayer.classList.toggle('hidden', !v);
    if (!v) { keys.clear(); state.move.x = state.move.y = 0; knob.style.transform = ''; }
  }
  return { state, axes, consumeOrbit, setInteractVisible, setEnabled, keys };
}
