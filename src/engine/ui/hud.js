// HUD: location, time of day, score, situations done X/N, menu button, interaction prompt.
import { h } from '../dom.js';
import { t, tr, onLangChange } from '../i18n.js';
import './aiStrings.js';

export function createHud(root, { onMenu, onAsk }) {
  const loc = h('span', { class: 'hud-loc' });
  const time = h('span', { class: 'hud-time' });
  const score = h('span', { class: 'hud-score' });
  const done = h('span', { class: 'hud-done' });
  const menuBtn = h('button', { type: 'button', class: 'hud-menu', onclick: onMenu, 'aria-label': t('menu') }, '☰');
  // journey badge: "AI-arranged from a reviewed library" | "Default plan"; and the per-location "Ask" panel
  const plan = h('span', { class: 'hud-plan', role: 'status' });
  // hub waypoint: the planned next destination ("Next stop: College")
  const nextLbl = h('span', { class: 'lbl' }, t('nextStop'));
  const nextVal = h('span', { class: 'yk-world-next-val' });
  const nextChip = h('div', { class: 'hud-chip yk-world-next hidden', role: 'status' }, h('span', { class: 'yk-world-next-icon', 'aria-hidden': 'true' }, '➤'), nextLbl, nextVal);
  const askBtn = onAsk ? h('button', { type: 'button', class: 'hud-ask', onclick: onAsk }, h('span', { 'aria-hidden': 'true' }, '؟ '), h('span', { class: 'hud-ask-text' }, t('askHud'))) : null;
  const bar = h('div', { class: 'hud hidden' },
    menuBtn,
    askBtn,
    h('div', { class: 'hud-chip' }, loc, h('span', { class: 'sep', 'aria-hidden': 'true' }, '·'), time),
    h('div', { class: 'hud-chip' }, h('span', { class: 'lbl' }, t('score')), score),
    h('div', { class: 'hud-chip' }, h('span', { class: 'lbl' }, t('done')), done),
    nextChip,
    plan);
  const prompt = h('div', { class: 'prompt', 'aria-live': 'polite' });
  root.append(bar, prompt);

  let last = {};
  function set(data) {
    last = { ...last, ...data };
    loc.textContent = tr(last.title) || '';
    time.textContent = last.time || '';
    score.textContent = String(last.score ?? 0);
    done.textContent = `${last.done ?? 0}/${last.total ?? 0}`;
    plan.textContent = last.plan === 'ai' ? t('planAi') : t('planDefault');
    plan.classList.toggle('ai', last.plan === 'ai');
    nextVal.textContent = last.next ? tr(last.next) : '';
    nextChip.classList.toggle('hidden', !last.next);
  }
  onLangChange(() => {
    bar.querySelectorAll('.lbl')[0].textContent = t('score');
    bar.querySelectorAll('.lbl')[1].textContent = t('done');
    menuBtn.setAttribute('aria-label', t('menu'));
    if (askBtn) askBtn.querySelector('.hud-ask-text').textContent = t('askHud');
    nextLbl.textContent = t('nextStop');
    set({});
  });
  function bump() { score.classList.remove('bump'); void score.offsetWidth; score.classList.add('bump'); }
  function show(v) { bar.classList.toggle('hidden', !v); if (!v) setPrompt(null); }
  function setPrompt(text) {
    if (!text) { prompt.classList.remove('show'); return; }
    prompt.replaceChildren(h('kbd', {}, 'E'), h('span', {}, text));
    prompt.classList.add('show');
  }
  function setAskVisible(v) { if (askBtn) askBtn.classList.toggle('hidden', !v); }
  return { set, show, setPrompt, bump, setAskVisible };
}
