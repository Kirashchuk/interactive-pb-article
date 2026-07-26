/** Перемикач теми: авто → світла → темна. Стан у localStorage, стемпується на <html>. */

const KEY = 'pb-article-theme';
const ORDER = ['auto', 'light', 'dark'];
const ICONS = { auto: '◐', light: '☀', dark: '☾' };
const TITLES = { auto: 'Тема: авто (за системою)', light: 'Тема: світла', dark: 'Тема: темна' };

export function initTheme() {
  const btn = document.getElementById('theme-toggle');
  const icon = document.getElementById('theme-icon');
  let mode = localStorage.getItem(KEY) || 'auto';

  const apply = () => {
    if (mode === 'auto') document.documentElement.removeAttribute('data-theme');
    else document.documentElement.setAttribute('data-theme', mode);
    icon.textContent = ICONS[mode];
    btn.title = TITLES[mode];
    btn.setAttribute('aria-label', `Перемкнути тему оформлення. ${TITLES[mode]}`);
  };

  btn.addEventListener('click', () => {
    mode = ORDER[(ORDER.indexOf(mode) + 1) % ORDER.length];
    localStorage.setItem(KEY, mode);
    apply();
  });

  apply();
}
