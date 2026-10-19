/**
 * Нові інтерактивні блоки лонгріда за чернеткою статті (2015–2025).
 * Використовують ті самі побудовники, дані й картооснову, що й презентація
 * (presentation/js, presentation/data), тож лонгрід і слайди показують однакові числа.
 * Блок у розмітці: <figure class="pb-block" data-block="votes"> з потрібними id всередині.
 */
import { setGeo } from '../presentation/js/map.js';
import { setCityData, closeCity } from '../presentation/js/city.js';
import { logics, rules, completeness } from '../presentation/js/slides-a.js';
import { groups, war, implementation, votes, typology, themes } from '../presentation/js/slides-b.js';

const BUILD = { logics, rules, completeness, groups, war, implementation, votes, typology, themes };

async function boot() {
  const blocks = [...document.querySelectorAll('[data-block]')];
  if (!blocks.length) return;
  const load = (url) => fetch(url).then((r) => {
    if (!r.ok) throw new Error(`${url}: HTTP ${r.status}`);
    return r.json();
  });
  const [deck, geo] = await Promise.all([load('presentation/data/deck.json'), load('presentation/data/geo.json')]);
  setGeo(geo);
  setCityData(deck);
  const drawer = document.getElementById('drawer');
  if (drawer) drawer.inert = true;

  const inst = new Map();
  for (const el of blocks) {
    try { inst.set(el, BUILD[el.dataset.block](el, deck)); } catch (e) { console.error(el.dataset.block, e); }
  }
  const renderAll = () => inst.forEach((v, el) => { try { v?.render?.(); } catch (e) { console.error(el.dataset.block, e); } });

  // Анімації блоків запускаються, коли блок з'являється на екрані
  const io = new IntersectionObserver((entries) => entries.forEach((en) => {
    const b = inst.get(en.target);
    if (!b) return;
    if (en.isIntersecting) b.enter?.(); else b.leave?.();
  }), { threshold: 0.35 });
  blocks.forEach((b) => io.observe(b));

  let t = 0;
  addEventListener('resize', () => { clearTimeout(t); t = setTimeout(renderAll, 160); });
  document.fonts?.ready.then(renderAll);
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeCity(); });
}

boot().catch((e) => console.error('Блоки статті:', e));
