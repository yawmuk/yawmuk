import './styles/main.css';
import { startGame } from './engine/game.js';

startGame().catch((err) => {
  console.error('[yawmuk] fatal', err);
  // A failed graphics initialization must never leave the loading veil covering recovery.
  document.getElementById('loader')?.classList.add('done');
  document.getElementById('fade')?.classList.add('hidden');
  const ui = document.getElementById('ui');
  const box = document.createElement('div');
  box.className = 'fatal';
  box.setAttribute('role', 'alert');
  const english = document.documentElement.lang === 'en';
  const message = document.createElement('p');
  message.textContent = english ? 'The game could not start. Please try again or use the lighter mode.' : 'تعذّر تشغيل اللعبة. أعد المحاولة أو شغّل الوضع الخفيف.';
  const actions = document.createElement('div');
  actions.className = 'row wrap';
  for (const [label, light] of [[english ? 'Try again' : 'إعادة المحاولة', false], [english ? 'Lighter mode' : 'الوضع الخفيف', true]]) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = light ? 'btn primary' : 'btn ghost';
    button.textContent = label;
    button.addEventListener('click', () => {
      if (!light) { location.reload(); return; }
      const url = new URL(location.href);
      url.searchParams.set('renderer', 'webgl');
      url.searchParams.set('quality', 'low');
      location.assign(url.href);
    });
    actions.append(button);
  }
  box.append(message, actions);
  ui?.append(box);

});

// opt-in learning study: a no-op unless ?study=1 is present or a participant session is in progress
import('./features/study/index.js').catch(() => {});
