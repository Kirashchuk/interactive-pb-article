/**
 * Інтерактивний блок: шкала-слайдер року, перемикач показника,
 * картодіаграма України (хороплет областей + пропорційні бульбашки міст),
 * кругова діаграма розподілу коштів, синхронний опис року.
 */
import { fmtInt, fmtUAH, fmtMetric, totalReadout, METRIC_LABELS } from './format.js';
import { showTooltip, moveTooltip, hideTooltip } from './tooltip.js';
import { YEAR_TEXTS } from './year-texts.js';

const SEQ = ['var(--seq1)', 'var(--seq2)', 'var(--seq3)', 'var(--seq4)', 'var(--seq5)', 'var(--seq6)'];
const SLOTS = ['var(--s1)', 'var(--s2)', 'var(--s3)', 'var(--s4)', 'var(--s5)', 'var(--s6)'];
const MAP_W = 760, MAP_H = 560;
const DONUT_S = 240;

export function initExplorer(data, geo) {
  const state = { year: data.years[0], metric: 'amount' };
  const listeners = [];
  const onChange = (fn) => listeners.push(fn);
  const setState = (patch) => {
    Object.assign(state, patch);
    listeners.forEach((fn) => fn(state));
  };

  initTimeline(data, state, setState, onChange);
  initMetricSwitch(setState);
  initYearStory(data, onChange);
  initMap(data, geo, onChange);
  initDonut(data, onChange);

  setState({}); // первинний рендер
  return { setState, state };
}

/* ------------------------------------------------------------ шкала часу */
function initTimeline(data, state, setState, onChange) {
  const slider = document.getElementById('year-slider');
  const ticks = document.getElementById('timeline-ticks');
  const readoutYear = document.getElementById('readout-year');
  const readoutTotal = document.getElementById('readout-total');

  slider.min = data.years[0];
  slider.max = data.years[data.years.length - 1];

  for (const y of data.years) {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = y;
    b.setAttribute('aria-pressed', 'false');
    b.addEventListener('click', () => setState({ year: y }));
    ticks.appendChild(b);
  }

  slider.addEventListener('input', () => setState({ year: +slider.value }));

  onChange(({ year, metric }) => {
    slider.value = year;
    const t = data.totals[year];
    slider.setAttribute('aria-valuetext', `${year} рік, ${totalReadout(t, metric)}`);
    readoutYear.textContent = year;
    readoutTotal.textContent = totalReadout(t, metric);
    [...ticks.children].forEach((b) =>
      b.setAttribute('aria-pressed', String(+b.textContent === year)));
  });
}

/* ------------------------------------------------------ перемикач показника */
function initMetricSwitch(setState) {
  document.querySelectorAll('#metric-switch input[name="metric"]').forEach((input) => {
    input.addEventListener('change', () => {
      if (input.checked) setState({ metric: input.value });
    });
  });
}

/* ------------------------------------------------------------- опис року */
function initYearStory(data, onChange) {
  const title = document.getElementById('year-story-title');
  const facts = document.getElementById('year-facts');
  const slot = document.getElementById('year-slot');

  onChange(({ year }) => {
    const t = data.totals[year];
    const yt = YEAR_TEXTS[year] || { title: String(year), text: '' };
    title.textContent = yt.title;
    facts.replaceChildren();
    const parts = [
      [fmtInt(t.activeCities), ' активних міст'],
      [fmtInt(t.applications), ' заявок'],
      [fmtInt(t.winners), ' переможців'],
      [fmtUAH(t.amount), ' розподілено'],
    ];
    parts.forEach(([b, rest], i) => {
      if (i) facts.appendChild(document.createTextNode(' · '));
      const strong = document.createElement('b');
      strong.textContent = b;
      facts.append(strong, document.createTextNode(rest));
    });
    if (t.confirmedOnly) {
      facts.appendChild(document.createTextNode(
        ' · лише підтверджені цикли (документований мінімум)'));
    }
    slot.textContent = yt.text;
  });
}

/* ------------------------------------------------------------------ карта */
function initMap(data, geo, onChange) {
  const container = d3.select('#map');
  const svg = container.append('svg')
    .attr('viewBox', `0 0 ${MAP_W} ${MAP_H}`)
    .attr('role', 'group')
    .attr('aria-label', 'Картодіаграма міст України');

  // Штрихування для регіонів поза рамкою (Крим, Севастополь)
  const defs = svg.append('defs');
  const pat = defs.append('pattern')
    .attr('id', 'hatch').attr('patternUnits', 'userSpaceOnUse')
    .attr('width', 7).attr('height', 7);
  pat.append('rect').attr('width', 7).attr('height', 7).style('fill', 'var(--excluded)');
  pat.append('path').attr('d', 'M0,7 l7,-7').style('stroke', 'var(--nodata)')
    .style('stroke-width', 1).style('opacity', 0.55);

  const projection = d3.geoConicEqualArea()
    .parallels([46.5, 50.5])
    .rotate([-31, 0])
    .fitExtent([[10, 10], [MAP_W - 10, MAP_H - 10]], geo);
  const path = d3.geoPath(projection);

  // Значення показника міста за рік (для стану «data»)
  const val = (c, year, metric) => {
    const d = c.years[year];
    if (!d) return null;
    return metric === 'amount' ? d.s : metric === 'applications' ? d.a : d.w;
  };

  // Суми по областях (для хороплету): iso -> total
  const oblastTotals = (year, metric) => {
    const m = new Map();
    for (const c of data.cities) {
      const v = val(c, year, metric);
      if (v != null) m.set(c.iso, (m.get(c.iso) || 0) + v);
    }
    return m;
  };

  // Фіксовані домени по всіх роках — розміри/кольори порівнянні між роками
  const metricMax = {}, oblastMax = {};
  for (const metric of ['amount', 'applications', 'winners']) {
    metricMax[metric] = d3.max(data.cities, (c) => d3.max(data.years, (y) => val(c, y, metric) ?? 0)) || 1;
    oblastMax[metric] = d3.max(data.years, (y) => d3.max([...oblastTotals(y, metric).values()]) || 0) || 1;
  }

  const isoWithCities = new Set(data.cities.map((c) => c.iso));

  // Області
  const oblasts = svg.append('g').selectAll('path')
    .data(geo.features)
    .join('path')
    .attr('d', path)
    .style('stroke', 'var(--baseline)')
    .style('stroke-width', 0.7)
    .style('fill', 'var(--page)');

  oblasts
    .on('pointerenter pointermove', function (event, f) {
      const { year, metric } = currentState;
      if (f.properties.excluded) {
        showTooltip(event, {
          title: f.properties.name,
          note: 'Поза рамкою дослідження (окупація з 2014 року).',
        });
        return;
      }
      const totals = oblastTotals(year, metric);
      const v = totals.get(f.properties.iso);
      showTooltip(event, {
        title: f.properties.name,
        rows: [[`${METRIC_LABELS[metric]}, ${year}`, v != null ? fmtMetric(v, metric) : '—']],
        note: isoWithCities.has(f.properties.iso)
          ? 'Сумарно по містах вибірки в області.'
          : 'В області немає міст із населенням понад 100 тис.',
      });
    })
    .on('pointerleave', hideTooltip);

  // Бульбашки міст: група на місто (видимий знак + великий прозорий хіт-таргет)
  const rScale = (metric) => d3.scaleSqrt().domain([0, metricMax[metric]]).range([0, 30]);

  const cityG = svg.append('g').selectAll('g')
    .data(data.cities)
    .join('g')
    .attr('transform', (c) => {
      const [x, y] = projection([c.lon, c.lat]);
      return `translate(${x},${y})`;
    });

  const bubbles = cityG.append('circle')
    .attr('class', 'bubble')
    .style('fill', 'var(--s1)')
    .style('fill-opacity', 0.72)
    .style('stroke', 'var(--surface)')
    .style('stroke-width', 1.4)
    .attr('r', 0);

  // Стани без даних розрізняються формою знака (колір не несе значення сам):
  // ○ немає підтверджених даних · крапка — до запуску · ‖ призупинено · ✕ не проводився
  const noData = cityG.append('circle')
    .attr('class', 'nodata')
    .attr('r', 4.5)
    .style('fill', 'none')
    .style('stroke', 'var(--nodata)')
    .style('stroke-width', 1.6);

  const preDot = cityG.append('circle')
    .attr('class', 'pre')
    .attr('r', 2.2)
    .style('fill', 'var(--baseline)');

  const suspMark = cityG.append('path')
    .attr('class', 'susp')
    .attr('d', 'M-3,-4 L-3,4 M3,-4 L3,4')
    .style('stroke', 'var(--nodata)')
    .style('stroke-width', 2.2)
    .style('fill', 'none');

  const notHeldMark = cityG.append('path')
    .attr('class', 'notheld')
    .attr('d', 'M-4,-4 L4,4 M-4,4 L4,-4')
    .style('stroke', 'var(--nodata)')
    .style('stroke-width', 2)
    .style('fill', 'none');

  // Хіт-таргет ≥ 24px, він же — фокусований елемент для клавіатури
  const hits = cityG.append('circle')
    .attr('class', 'hit')
    .attr('r', 13)
    .style('fill', 'transparent')
    .style('cursor', 'pointer')
    .attr('tabindex', 0)
    .attr('role', 'img');

  let currentState = { year: data.years[0], metric: 'amount' };

  const cityTooltip = (event, c) => {
    const { year, metric } = currentState;
    const d = c.years[year] || {};
    const rows = [];
    let note;
    if (d.status === 'data') {
      if (d.a != null) rows.push(['Подані заявки', fmtInt(d.a)]);
      if (d.w != null) rows.push(['Проєкти-переможці', fmtInt(d.w)]);
      if (d.s != null) rows.push(['Сума', fmtUAH(d.s)]);
      if (d.perWinner != null) rows.push(['≈ на переможця', fmtUAH(d.perWinner)]);
      if (d.share != null) {
        rows.push(['Частка видатків міста',
          (100 * d.share).toLocaleString('uk-UA', { maximumFractionDigits: 2 }) + ' %']);
      }
      note = d.basis ? `Основа суми: ${d.basis}.` : undefined;
      if (d.a == null || d.w == null || d.s == null) {
        note = (note ? note + ' ' : '') + 'Відсутні показники не підтверджено джерелами.';
      }
    } else if (d.status === 'pre') {
      note = c.firstYear
        ? `Рік передує першому циклу бюджету участі (${c.firstYear}).`
        : 'Рік передує першому циклу бюджету участі.';
    } else if (d.status === 'susp') {
      note = `Програму бюджету участі на ${year} рік офіційно призупинено.`;
    } else if (d.status === 'notheld') {
      note = `Конкурс у ${year} році не проводився (пряме підтвердження).`;
    } else {
      note = `Немає підтверджених даних за ${year} рік. Порожньо ≠ нуль.`;
    }
    if (c.tot2022 && year >= 2022) {
      note = (note ? note + ' ' : '') + 'Місто на тимчасово окупованій території після 24.02.2022.';
    }
    showTooltip(event, {
      title: c.name,
      rows: [[c.region, fmtInt(c.population) + ' осіб'], ...rows],
      note,
    });
  };

  hits
    .on('pointerenter', function (event, c) { cityTooltip(event, c); })
    .on('pointermove', moveTooltip)
    .on('pointerleave', hideTooltip)
    .on('focus', function (event, c) {
      const r = this.getBoundingClientRect();
      cityTooltip({ clientX: r.left + r.width / 2, clientY: r.top }, c);
    })
    .on('blur', hideTooltip);

  buildMapLegend();

  onChange((s) => {
    currentState = s;
    const { year, metric } = s;
    const r = rScale(metric);
    // У прихованій вкладці rAF не тікає — застосовуємо стан одразу, без транзицій
    const animate = !matchMedia('(prefers-reduced-motion: reduce)').matches && !document.hidden;
    const t = (sel) => (animate ? sel.transition().duration(450) : sel);

    // Хороплет
    const totals = oblastTotals(year, metric);
    const color = d3.scaleQuantize().domain([0, oblastMax[metric]]).range(SEQ);
    t(oblasts).style('fill', (f) => {
      if (f.properties.excluded) return 'url(#hatch)';
      const v = totals.get(f.properties.iso);
      return v ? color(v) : 'var(--page)';
    });

    // Бульбашки та стани
    t(bubbles)
      .attr('r', (c) => {
        const v = c.years[year]?.status === 'data' ? (metric === 'amount' ? c.years[year].s : metric === 'applications' ? c.years[year].a : c.years[year].w) : null;
        return v ? Math.max(3, r(v)) : 0;
      });
    noData.style('display', (c) => (c.years[year]?.status === 'nodata' ||
      (c.years[year]?.status === 'data' && valOf(c, year, metric) == null)) ? null : 'none');
    preDot.style('display', (c) => c.years[year]?.status === 'pre' ? null : 'none');
    suspMark.style('display', (c) => c.years[year]?.status === 'susp' ? null : 'none');
    notHeldMark.style('display', (c) => c.years[year]?.status === 'notheld' ? null : 'none');

    hits.attr('r', (c) => {
      const v = valOf(c, year, metric);
      return Math.max(13, v ? r(v) : 0);
    }).attr('aria-label', (c) => {
      const v = valOf(c, year, metric);
      const d = c.years[year] || {};
      if (d.status === 'pre') return `${c.name}, ${year}: до першого циклу бюджету участі`;
      if (d.status === 'susp') return `${c.name}, ${year}: програму призупинено`;
      if (d.status === 'notheld') return `${c.name}, ${year}: конкурс не проводився`;
      if (v == null) return `${c.name}, ${year}: немає підтверджених даних`;
      return `${c.name}, ${year}: ${METRIC_LABELS[metric]} — ${fmtMetric(v, metric)}`;
    });

    updateLegendMax(metric, oblastMax[metric]);

    function valOf(c, y, m) {
      const d = c.years[y];
      if (!d || d.status !== 'data') return null;
      return m === 'amount' ? d.s : m === 'applications' ? d.a : d.w;
    }
  });
}

/* -------------------------------------------------------------- легенда */
function buildMapLegend() {
  const el = document.getElementById('map-legend');
  el.replaceChildren();

  const item = (labelText, swatchBuilder) => {
    const span = document.createElement('span');
    span.className = 'item';
    span.appendChild(swatchBuilder());
    span.appendChild(document.createTextNode(labelText));
    el.appendChild(span);
  };

  item('місто з даними (розмір ∝ показник)', () => {
    const s = document.createElement('span');
    s.className = 'swatch';
    s.style.background = 'var(--s1)';
    s.style.opacity = '0.75';
    return s;
  });
  item('немає підтверджених даних', () => {
    const s = document.createElement('span');
    s.className = 'swatch';
    s.style.cssText += ';background:transparent;border:2px solid var(--nodata)';
    return s;
  });
  item('до першого циклу', () => {
    const s = document.createElement('span');
    s.className = 'swatch';
    s.style.cssText += ';width:6px;height:6px;background:var(--baseline)';
    return s;
  });
  item('призупинено', () => {
    const s = document.createElement('span');
    s.style.cssText = 'color:var(--nodata);font-weight:800;font-size:0.85rem;line-height:1;letter-spacing:1px';
    s.textContent = '‖';
    return s;
  });
  item('не проводився', () => {
    const s = document.createElement('span');
    s.style.cssText = 'color:var(--nodata);font-weight:700;font-size:0.95rem;line-height:1';
    s.textContent = '✕';
    return s;
  });

  // Секвенційна шкала хороплету
  const seqWrap = document.createElement('span');
  seqWrap.className = 'item seq-scale';
  const zero = document.createElement('span');
  zero.textContent = '0';
  seqWrap.appendChild(zero);
  SEQ.forEach((c) => {
    const cell = document.createElement('span');
    cell.className = 'cell';
    cell.style.background = c;
    seqWrap.appendChild(cell);
  });
  const maxL = document.createElement('span');
  maxL.id = 'legend-seq-max';
  maxL.textContent = 'макс.';
  seqWrap.appendChild(maxL);
  el.appendChild(seqWrap);

  item('поза рамкою (Крим, Севастополь)', () => {
    const s = document.createElement('span');
    s.className = 'swatch sq';
    s.style.cssText += `;background:repeating-linear-gradient(45deg, var(--excluded), var(--excluded) 2px, var(--nodata) 2px, var(--nodata) 3px)`;
    return s;
  });
}

function updateLegendMax(metric, max) {
  const el = document.getElementById('legend-seq-max');
  if (el) el.textContent = fmtMetric(max, metric).replace(' грн', ' грн');
}

/* ------------------------------------------------------------------ донат */
function initDonut(data, onChange) {
  // Стабільні сутності: ТОП-6 міст за сумою 2015–2021 + «Інші міста»
  const topCities = data.cityTotals.slice(0, 6).map((c) => c.name);
  const colorOf = new Map(topCities.map((name, i) => [name, SLOTS[i]]));
  const OTHER = 'Інші міста';

  const svg = d3.select('#donut').append('svg')
    .attr('viewBox', `0 0 ${DONUT_S} ${DONUT_S}`)
    .attr('role', 'img')
    .attr('aria-label', 'Кругова діаграма розподілу коштів між містами за обраний рік');

  const g = svg.append('g').attr('transform', `translate(${DONUT_S / 2},${DONUT_S / 2})`);
  const arcsG = g.append('g');
  const centerVal = g.append('text')
    .attr('text-anchor', 'middle').attr('dy', '-0.1em')
    .style('font-family', 'var(--sans)').style('font-size', '19px')
    .style('font-weight', '700').style('fill', 'var(--ink)');
  const centerLbl = g.append('text')
    .attr('text-anchor', 'middle').attr('dy', '1.4em')
    .style('font-family', 'var(--sans)').style('font-size', '10.5px')
    .style('fill', 'var(--muted)');

  const arc = d3.arc().innerRadius(70).outerRadius(112).cornerRadius(3);
  const pie = d3.pie().value((d) => d.value).sort(null).padAngle(0.014);

  const legendEl = document.getElementById('donut-legend');
  const titleEl = document.getElementById('donut-title');

  onChange(({ year }) => {
    // Розподіл коштів завжди у грн (незалежно від обраного показника)
    const rows = [];
    let others = 0, othersCount = 0;
    for (const c of data.cities) {
      const s = c.years[year]?.s;
      if (s == null) continue;
      if (colorOf.has(c.name)) rows.push({ name: c.name, value: s, color: colorOf.get(c.name) });
      else { others += s; othersCount++; }
    }
    rows.sort((a, b) => topCities.indexOf(a.name) - topCities.indexOf(b.name));
    if (others > 0) rows.push({ name: OTHER, value: others, color: 'var(--nodata)', count: othersCount });
    const total = d3.sum(rows, (d) => d.value);

    titleEl.textContent = `Розподіл коштів між містами · ${year}`;

    const animate = !matchMedia('(prefers-reduced-motion: reduce)').matches && !document.hidden;
    const arcs = arcsG.selectAll('path').data(pie(rows), (d) => d.data.name);

    arcs.exit().remove();
    const merged = arcs.enter().append('path')
      .each(function (d) { this._current = d; })
      .style('stroke', 'var(--surface)')
      .style('stroke-width', 1.5)
      .merge(arcs)
      .style('fill', (d) => d.data.color)
      .on('pointerenter pointermove', function (event, d) {
        const share = total ? (100 * d.data.value / total) : 0;
        showTooltip(event, {
          title: d.data.name,
          rows: [
            [`Кошти, ${year}`, fmtUAH(d.data.value)],
            ['Частка', `${share.toLocaleString('uk-UA', { maximumFractionDigits: 1 })} %`],
          ],
          note: d.data.name === OTHER ? `${d.data.count} міст поза ТОП-6 періоду.` : undefined,
        });
      })
      .on('pointerleave', hideTooltip);

    if (animate) {
      merged.transition().duration(450)
        .attrTween('d', function (d) {
          const i = d3.interpolate(this._current || d, d);
          this._current = i(1);
          return (t) => arc(i(t));
        });
    } else {
      merged
        .each(function (d) { this._current = d; })
        .attr('d', (d) => arc(d));
    }

    centerVal.text(fmtUAH(total, { unit: false }));
    centerLbl.text(`грн · ${year}`);

    // Легенда-таблиця праворуч
    legendEl.replaceChildren();
    for (const r of rows) {
      const row = document.createElement('div');
      row.className = 'row';
      const key = document.createElement('span');
      key.className = 'key';
      key.style.background = r.color;
      const name = document.createElement('span');
      name.textContent = r.name;
      const val = document.createElement('span');
      val.className = 'val';
      const share = total ? (100 * r.value / total) : 0;
      val.textContent = `${fmtUAH(r.value, { unit: false })} · ${share.toLocaleString('uk-UA', { maximumFractionDigits: 1 })} %`;
      row.append(key, name, val);
      legendEl.appendChild(row);
    }
    if (!rows.length) {
      const p = document.createElement('div');
      p.textContent = 'За цей рік підтверджених сум немає.';
      legendEl.appendChild(p);
    }
  });
}
