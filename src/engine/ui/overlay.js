// Modal / panel / toast primitives with focus management.
import { h } from '../dom.js';
import { initLoader } from './loading.js';

if (typeof window !== 'undefined') initLoader();

const FOCUSABLE = 'button:not([disabled]), [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';
let uiRoot = null;
export function setUiRoot(el) { uiRoot = el; }
export function getUiRoot() { return uiRoot; }

/**
 * openModal({ className, label, content, onClose, dismissible=false, variant:'modal'|'sheet'|'screen' })
 * Returns { el, body, close }. Esc closes when dismissible.
 */
export function openModal({ className = '', label = '', content = [], onClose, dismissible = false, variant = 'modal' } = {}) {
  const prevFocus = document.activeElement;
  const body = h('div', { class: 'modal-body' }, content);
  const box = h('div', { class: `${variant} ${className}`, role: 'dialog', 'aria-modal': variant === 'sheet' ? 'false' : 'true', 'aria-label': label }, body);
  const el = h('div', { class: `overlay overlay-${variant}` }, box);
  let closed = false;
  function close(result) {
    if (closed) return; closed = true;
    document.removeEventListener('keydown', onKey, true);
    el.classList.add('leaving');
    setTimeout(() => el.remove(), 180);
    if (prevFocus && prevFocus.focus && document.contains(prevFocus)) try { prevFocus.focus({ preventScroll: true }); } catch { /* */ }
    onClose?.(result);
  }
  function onKey(e) {
    if (!document.contains(el)) return;
    if (e.key === 'Escape' && dismissible) { e.stopPropagation(); e.preventDefault(); close(); }
    if (e.key === 'Tab') {
      const f = [...box.querySelectorAll(FOCUSABLE)].filter((n) => n.offsetParent !== null);
      if (!f.length) return;
      const first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  }
  document.addEventListener('keydown', onKey, true);
  if (dismissible) el.addEventListener('pointerdown', (e) => { if (e.target === el) close(); });
  uiRoot.append(el);
  requestAnimationFrame(() => {
    el.classList.add('shown');
    const target = box.querySelector('[data-autofocus]') || box.querySelector(FOCUSABLE);
    target?.focus({ preventScroll: true });
  });
  return { el, body, box, close };
}

/** Replace the content of an open modal body and refocus. */
export function setContent(modal, content) {
  modal.body.replaceChildren(...[content].flat().filter(Boolean));
  modal.body.scrollTop = 0;
  modal.box.scrollTop = 0;
  requestAnimationFrame(() => {
    const target = modal.box.querySelector('[data-autofocus]') || modal.box.querySelector(FOCUSABLE);
    target?.focus({ preventScroll: true });
  });
}

export function toast(msg, ms = 3200, kind = '') {
  if (!uiRoot) return;
  let wrap = uiRoot.querySelector('.toasts');
  if (!wrap) { wrap = h('div', { class: 'toasts', role: 'status', 'aria-live': 'polite' }); uiRoot.append(wrap); }
  const tEl = h('div', { class: `toast ${kind}` }, msg);
  wrap.append(tEl);
  setTimeout(() => { tEl.classList.add('leaving'); setTimeout(() => tEl.remove(), 300); }, ms);
}

const reduceMotion = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
const finePointer = () => typeof matchMedia === 'function' && matchMedia('(hover: hover) and (pointer: fine)').matches;
export const prefersReducedMotion = reduceMotion;

/**
 * Subtle pointer-follow tilt (a few degrees) for depth on cards. Desktop pointers only; off with reduced motion.
 * Writes --rx/--ry custom properties consumed by the CSS transform, so CSS stays in charge of the look.
 */
export function tilt(el, max = 4) {
  if (!el || reduceMotion() || !finePointer()) return el;
  el.classList.add('tilt');
  el.addEventListener('pointermove', (e) => {
    const r = el.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width - 0.5, y = (e.clientY - r.top) / r.height - 0.5;
    el.style.setProperty('--ry', `${(x * max * 2).toFixed(2)}deg`);
    el.style.setProperty('--rx', `${(-y * max * 2).toFixed(2)}deg`);
  });
  el.addEventListener('pointerleave', () => { el.style.setProperty('--rx', '0deg'); el.style.setProperty('--ry', '0deg'); });
  return el;
}

export function btn(label, onclick, cls = '', attrs = {}) {
  return h('button', { type: 'button', class: `btn ${cls}`, onclick, ...attrs }, label);
}
