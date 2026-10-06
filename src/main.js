import './styles/main.css';
import { startGame } from './engine/game.js';

startGame().catch((err) => {
  console.error('[yawmuk] fatal', err);
  const ui = document.getElementById('ui');
  const box = document.createElement('div');
  box.className = 'fatal';
  box.textContent = `حدث خطأ أثناء تشغيل اللعبة. An error occurred while starting the game: ${err?.message || err}`;
  ui?.append(box);
});

// opt-in learning study: a no-op unless ?study=1 is present or a participant session is in progress
import('./features/study/index.js').catch(() => {});
