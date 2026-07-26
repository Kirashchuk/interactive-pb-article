/** Точка входу: завантаження даних і ініціалізація всіх блоків. */
import { initTheme } from './theme.js';
import { initReveal, initProgress } from './reveal.js';
import { initExplorer } from './interactive.js';
import { initScrolly } from './scrolly.js';
import { initShare } from './share.js';
import { initIntl } from './intl.js';

async function main() {
  initTheme();
  initProgress();
  initReveal();

  let data, geo, analytics;
  try {
    const load = (url) => fetch(url).then((r) => {
      if (!r.ok) throw new Error(`${url}: HTTP ${r.status}`);
      return r.json();
    });
    [data, geo, analytics] = await Promise.all([
      load('data/pb_data.json'),
      load('data/ukraine_oblasts.geojson'),
      load('data/analytics.json'),
    ]);
  } catch (err) {
    showLoadError(err);
    return;
  }

  const dateEl = document.getElementById('data-date');
  if (dateEl) dateEl.textContent = data.meta.generated;

  initExplorer(data, geo);
  initScrolly(data, analytics);
  initShare(analytics);
  initIntl(analytics);
}

function showLoadError(err) {
  const box = document.createElement('div');
  box.setAttribute('role', 'alert');
  box.style.cssText =
    'max-width:640px;margin:24px auto;padding:18px 22px;border:1px solid var(--border);' +
    'border-radius:12px;background:var(--surface);font-family:var(--sans);font-size:0.95rem';
  const h = document.createElement('b');
  h.textContent = 'Не вдалося завантажити дані. ';
  const p = document.createElement('span');
  p.textContent =
    'Сторінку слід відкривати через локальний вебсервер, а не як file:// — ' +
    'запустіть у папці проєкту: python -m http.server 8000 і відкрийте http://localhost:8000. ' +
    `(${err.message || err})`;
  box.append(h, p);
  document.querySelector('main').prepend(box);
  console.error('Помилка завантаження даних:', err);
}

main();
