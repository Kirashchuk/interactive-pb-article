/**
 * Картографічний синтез: три карти міст (рік першого циклу, довоєнна ресурсна частка,
 * міжрічна сталість частки). Картооснова — та сама, що в презентації
 * (presentation/js/map.js: baseMap, labelPos): сусіди, море, річки, градусна сітка
 * з підписами на рамці, масштабна лінійка. Усі кольори — токени css/style.css,
 * тож карти перемикаються разом зі світлою й темною темою без перемальовування.
 */
import { setGeo, baseMap, labelPos } from '../presentation/js/map.js';
import { showTooltip, hideTooltip } from './tooltip.js';

const num = (digits) => {
  const f = new Intl.NumberFormat('uk-UA', { minimumFractionDigits: digits, maximumFractionDigits: digits });
  return (v) => (v == null ? '—' : f.format(v));
};
const fmtShare = num(4);
const fmtCV = num(3);

const BASIS = {
  annual_envelope: 'річний ліміт',
  sum_winner_project_budgets: 'сума бюджетів переможців',
};

// Класи перевіряються по черзі: значення потрапляє в перший, для якого test(v) істинний.
// keyNames — міста, згадані в тексті картки: їхні підписи ставляться першими.
const MAPS = {
  'first-year': {
    legendTitle: 'Рік першого підтвердженого циклу · міст',
    value: (c) => c.first,
    classes: [2015, 2016, 2017, 2018, 2019, 2020].map((y, i) => ({
      label: String(y),
      color: `var(--bl${6 - i})`, // ранній запуск — найконтрастніший тон
      test: (v) => v === y,
    })),
    keyNames: ['Луцьк', 'Черкаси', 'Чернігів'],
    tipRows: (c) => [['Перший цикл', String(c.first)]],
    table: {
      summary: 'Дані карти 1: рік першого циклу за містами',
      head: ['Місто', 'Область', 'Перший цикл'],
      row: (c) => [c.name, c.region, String(c.first)],
      sort: (a, b) => a.first - b.first || a.name.localeCompare(b.name, 'uk'),
    },
  },
  'resource-share': {
    legendTitle: 'Ресурсна частка ΣS/ΣB, 2018–2021 · міст',
    value: (c) => c.share,
    classes: [
      { label: '<0,15 %', test: (v) => v < 0.15 },
      { label: '0,15–<0,25 %', test: (v) => v < 0.25 },
      { label: '0,25–<0,35 %', test: (v) => v < 0.35 },
      { label: '0,35–<0,50 %', test: (v) => v < 0.5 },
      { label: '≥0,50 %', test: () => true },
    ].map((k, i) => ({ ...k, color: `var(--vi${i + 1})` })),
    na: 'немає зіставних даних',
    note: 'Пропущене значення не прирівнюється до нуля.',
    keyNames: ['Черкаси', 'Луцьк'],
    tipRows: (c) => (c.share == null
      ? [['Ресурсна частка', '—']]
      : [['Ресурсна частка', `${fmtShare(c.share)} %`], ['Річних значень', String(c.nShare)]]),
    tipNote: (c) => (c.share == null ? 'Немає зіставних даних за 2018–2021 роки; пропуск ≠ нуль.' : undefined),
    table: {
      summary: 'Дані карти 2: ресурсна частка за містами',
      head: ['Місто', 'Частка, %', 'Річних значень'],
      row: (c) => [c.name, c.share == null ? 'немає зіставних даних' : fmtShare(c.share), String(c.nShare)],
      sort: (a, b) => (b.share ?? -1) - (a.share ?? -1),
    },
  },
  stability: {
    legendTitle: 'Коефіцієнт варіації частки, 2018–2021 · міст',
    value: (c) => (c.eligible ? c.cv : null),
    classes: [
      { label: 'CV ≤0,10', test: (v) => v <= 0.1 },
      { label: '0,10–0,20', test: (v) => v <= 0.2 },
      { label: '0,20–0,30', test: (v) => v <= 0.3 },
      { label: '0,30–0,50', test: (v) => v <= 0.5 },
      { label: '>0,50', test: () => true },
    ].map((k, i) => ({ ...k, color: `var(--am${i + 1})` })),
    na: 'не зіставляється',
    note: 'Нижчий CV означає вищу сталість; потрібно щонайменше три річні значення.',
    keyNames: ['Київ', 'Харків', 'Запоріжжя', 'Ужгород', 'Слов’янськ', 'Кременчук'],
    tipRows: (c) => (c.eligible
      ? [['CV частки', fmtCV(c.cv)], ['Річних значень', String(c.nCv)], ['Основа суми', BASIS[c.basis] || c.basis]]
      : [['CV частки', '—']]),
    tipNote: (c) => {
      if (c.eligible) return undefined;
      return c.nShare < 3
        ? `Не зіставляється: ${c.nShare ? `лише ${c.nShare} річн${c.nShare === 1 ? 'е значення' : 'і значення'}` : 'немає річних значень'}, потрібно щонайменше три.`
        : 'Не зіставляється: основа суми не була сталою між роками.';
    },
    table: {
      summary: 'Дані карти 3: коефіцієнт варіації за містами',
      head: ['Місто', 'CV', 'Річних значень', 'Основа суми'],
      row: (c) => (c.eligible
        ? [c.name, fmtCV(c.cv), String(c.nCv), BASIS[c.basis] || c.basis]
        : [c.name, 'не зіставляється', String(c.nShare), '—']),
      sort: (a, b) => (a.eligible && b.eligible ? a.cv - b.cv : b.eligible - a.eligible || a.name.localeCompare(b.name, 'uk')),
    },
  },
};

const FALLBACK_PNG = {
  'first-year': 'assets/maps/first-pb-year.png',
  'resource-share': 'assets/maps/prewar-resource-share.png',
  stability: 'assets/maps/resource-share-stability.png',
};

const key = (name) => name.replace(/[’']/g, "'");

/** labelPos з презентації: у її таблиці апострофи записано по-різному (Кам’янське / Слов'янськ) */
function placeLabel(name, r) {
  const fallback = labelPos('', r);
  const same = (a, b) => a[0] === b[0] && a[1] === b[1] && a[2] === b[2];
  for (const n of [name, name.replace(/’/g, "'"), name.replace(/'/g, '’')]) {
    const p = labelPos(n, r);
    if (!same(p, fallback)) return p;
  }
  return fallback;
}

function classOf(spec, c) {
  const v = spec.value(c);
  if (v == null) return -1;
  return spec.classes.findIndex((k) => k.test(v));
}

function parseCities(csvText, data) {
  const pop = new Map(data.cities.map((c) => [key(c.name), c.population]));
  return d3.csvParse(csvText, (r) => ({
    name: r.city,
    region: r.region,
    lon: +r.lon,
    lat: +r.lat,
    first: +r.first_pb_year,
    share: r.pooled_share_pct_2018_2021 === '' ? null : +r.pooled_share_pct_2018_2021,
    nShare: +r.n_share_observations || 0,
    cv: r.stability_cv_2018_2021 === '' ? null : +r.stability_cv_2018_2021,
    nCv: +r.n_stability_observations || 0,
    basis: r.stability_basis_code,
    eligible: r.stability_eligible === '1',
    pop: pop.get(key(r.city)) ?? 0,
  }));
}

function drawMap(svgEl, spec, cities) {
  const m = baseMap(svgEl, {});
  const r = m.w > 760 ? 7 : m.w > 480 ? 5.5 : 4.5;
  const xy = (c) => m.proj([c.lon, c.lat]);

  // Великі міста — знизу, щоб дрібніші сусіди (Бровари біля Києва) лишалися видимими
  const order = cities.slice().sort((a, b) => b.pop - a.pop);
  const g = m.top.append('g').selectAll('g').data(order).join('g')
    .attr('class', 'atlas-city')
    .attr('transform', (c) => `translate(${xy(c)})`);

  g.each(function (c) {
    const sel = d3.select(this);
    const k = classOf(spec, c);
    if (k < 0) {
      const x = r * 0.55;
      sel.append('circle').attr('class', 'atlas-na').attr('r', r);
      sel.append('path').attr('class', 'atlas-na-x').attr('d', `M${-x},${-x}L${x},${x}M${x},${-x}L${-x},${x}`);
    } else {
      sel.append('circle').attr('class', 'atlas-dot').attr('r', r).style('fill', spec.classes[k].color);
    }
  });

  g.append('circle').attr('class', 'atlas-hit').attr('r', Math.max(11, r + 5))
    .on('pointerenter pointermove', (event, c) => {
      const k = classOf(spec, c);
      showTooltip(event, {
        title: c.name,
        rows: [...spec.tipRows(c), ['Клас', k < 0 ? spec.na : spec.classes[k].label]],
        note: spec.tipNote?.(c),
      });
    })
    .on('pointerleave', hideTooltip);

  // Підписи: позиція — labelPos з презентації. За пріоритетом (згадані в тексті, потім за людністю):
  // якщо підпис виходить за рамку або перекриває інший підпис чи позначку — пробуємо запасні позиції,
  // а не вмістився ніде — не показуємо. Значення решти міст — у тултипі й таблиці під картою.
  const keyRank = new Map(spec.keyNames.map((n, i) => [key(n), i]));
  const prio = (c) => (keyRank.has(key(c.name)) ? keyRank.get(key(c.name)) - 1e9 : -c.pop);
  const narrow = m.w < 560;
  const labels = m.top.append('g').attr('aria-hidden', 'true').selectAll('text')
    .data(cities.slice().sort((a, b) => prio(a) - prio(b))).join('text')
    .attr('class', (c) => 'clbl' + (narrow || c.pop < 200000 ? ' small' : ''))
    .text((c) => c.name);
  const marks = cities.map((c) => { const [x, y] = xy(c); return { c, x, y, b: { x0: x - r, y0: y - r, x1: x + r, y1: y + r } }; });
  const hit = (a, b) => a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1;
  const dist = (mk, b) => Math.hypot(Math.max(b.x0 - mk.x, 0, mk.x - b.x1), Math.max(b.y0 - mk.y, 0, mk.y - b.y1));
  const inside = (b) => b.x0 >= 2 && b.x1 <= m.w - 2 && b.y0 >= 2 && b.y1 <= m.h - 2;
  const placed = [];
  labels.each(function (c) {
    const [x, y] = xy(c);
    const own = marks.find((mk) => mk.c === c);
    // Сусіди, що злилися з власною позначкою (Бровари біля Києва), не заважають, якщо не перекриті
    const others = marks.filter((mk) => mk.c !== c);
    const rivals = others.filter((mk) => Math.hypot(mk.x - x, mk.y - y) >= 2 * r);
    const t = d3.select(this);
    const fits = ([dx, dy, anchor]) => {
      t.attr('x', x + dx).attr('y', y + dy).attr('text-anchor', anchor);
      const bb = this.getBBox();
      const b = { x0: bb.x - 1, y0: bb.y, x1: bb.x + bb.width + 1, y1: bb.y + bb.height };
      if (!inside(b) || placed.some((p) => hit(p, b)) || others.some((mk) => hit(mk.b, b))) return false;
      // Найближчою до підпису має бути власна позначка — інакше його прочитають як підпис сусіда
      const d = dist(own, b);
      if (rivals.some((mk) => dist(mk, b) <= d)) return false;
      placed.push(b);
      return true;
    };
    if (![placeLabel(c.name, r), ...altSlots(r)].some(fits)) t.remove();
  });
}

/** Запасні позиції з тією ж геометрією, що в labelPos: r, l, t, b, tr, tl, br, bl */
function altSlots(r) {
  const g = r + 4, d = g * 0.7;
  return [[g, 4, 'start'], [-g, 4, 'end'], [0, -g - 2, 'middle'], [0, g + 10, 'middle'],
    [d, -d - 1, 'start'], [-d, -d - 1, 'end'], [d, d + 9, 'start'], [-d, d + 9, 'end']];
}

function buildLegend(el, spec, cities) {
  const counts = spec.classes.map(() => 0);
  let na = 0;
  for (const c of cities) {
    const k = classOf(spec, c);
    if (k < 0) na++; else counts[k]++;
  }
  const items = spec.classes.map((k, i) =>
    `<span class="item"><i class="sw" style="background:${k.color}"></i>${k.label}<b>${counts[i]}</b></span>`);
  if (spec.na && na) {
    items.push('<span class="item"><svg class="sw-na" viewBox="-7 -7 14 14" aria-hidden="true"><circle r="5.5"/>' +
      `<path d="M-3,-3L3,3M3,-3L-3,3"/></svg>${spec.na}<b>${na}</b></span>`);
  }
  el.innerHTML = `<span class="ttl">${spec.legendTitle}</span>${items.join('')}` +
    (spec.note ? `<span class="atlas-note">${spec.note}</span>` : '');
}

function buildTable(details, spec, cities) {
  const summary = document.createElement('summary');
  summary.textContent = spec.table.summary;
  const table = document.createElement('table');
  const thead = table.createTHead().insertRow();
  for (const h of spec.table.head) {
    const th = document.createElement('th');
    th.scope = 'col';
    th.textContent = h;
    thead.appendChild(th);
  }
  const tbody = table.createTBody();
  for (const c of cities.slice().sort(spec.table.sort)) {
    const tr = tbody.insertRow();
    spec.table.row(c).forEach((v, i) => {
      const cell = document.createElement(i === 0 ? 'th' : 'td');
      if (i === 0) cell.scope = 'row';
      cell.textContent = v;
      tr.appendChild(cell);
    });
  }
  details.replaceChildren(summary, table);
}

function showFallback(svgEl, id) {
  const img = document.createElement('img');
  img.src = FALLBACK_PNG[id];
  img.width = 2400;
  img.height = 1600;
  img.alt = svgEl.getAttribute('aria-label') || '';
  img.className = 'atlas-fallback';
  svgEl.replaceWith(img);
}

async function draw(data) {
  const svgs = [...document.querySelectorAll('svg.atlas-map[data-atlas]')];
  let geo, csv;
  try {
    const get = (url, kind) => fetch(url).then((r) => {
      if (!r.ok) throw new Error(`${url}: HTTP ${r.status}`);
      return r[kind]();
    });
    [geo, csv] = await Promise.all([
      get('presentation/data/geo.json', 'json'),
      get('data/pb_map_city_metrics_2018_2021.csv', 'text'),
    ]);
  } catch (err) {
    console.warn('Карти синтезу: картооснову не завантажено, показано статичні зображення.', err);
    svgs.forEach((s) => showFallback(s, s.dataset.atlas));
    return;
  }
  setGeo(geo);
  const cities = parseCities(csv, data);
  // Прибирання підписів міряє текст — чекаємо вебшрифти, інакше рамки рахуються за запасним шрифтом
  if (document.fonts?.ready) await document.fonts.ready;

  const maps = svgs.map((svgEl) => {
    const id = svgEl.dataset.atlas;
    const spec = MAPS[id];
    const legend = document.querySelector(`[data-atlas-legend="${id}"]`);
    const table = document.querySelector(`[data-atlas-table="${id}"]`);
    if (legend) buildLegend(legend, spec, cities);
    if (table) buildTable(table, spec, cities);
    return { svgEl, spec, w: 0 };
  });

  // Карти малюються в пікселях контейнера (як у презентації) — перемальовуємо лише за зміни ширини
  const render = () => {
    for (const mp of maps) {
      const w = Math.round(mp.svgEl.getBoundingClientRect().width);
      if (!w || w === mp.w) continue;
      mp.w = w;
      drawMap(mp.svgEl, mp.spec, cities);
    }
  };
  render();
  let t = null;
  window.addEventListener('resize', () => { clearTimeout(t); t = setTimeout(render, 150); }, { passive: true });
}

/** Картооснова важить ~0,5 МБ — вантажимо, коли розділ наближається до екрана */
export function initAtlas(data) {
  const section = document.getElementById('s-cartography');
  if (!section) return;
  if (!('IntersectionObserver' in window)) { draw(data); return; }
  const io = new IntersectionObserver((entries) => {
    if (!entries.some((e) => e.isIntersecting)) return;
    io.disconnect();
    draw(data);
  }, { rootMargin: '1200px 0px' });
  io.observe(section);
}
