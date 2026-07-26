/**
 * Скрол-сторітелінг «Динаміка та глибина участі, 2015–2026».
 *
 * Праворуч — закріплений (sticky) блок із чотирма графіками:
 *   sc-strip     — 131 спостереження частки у видатках;
 *   sc-amount    — кошти за рік (лінія);
 *   sc-bars      — заявки vs переможці (стовпчики);
 *   sc-coverage  — охоплення міст (area).
 *
 * Прогортання ліворуч керує «активним роком»: на початку блока показано 2015,
 * далі дані поступово прогружаються рік за роком, у кінці — 2026.
 * Клік по точці/стовпчику закріплює дані (рік або спостереження), решта сіріє.
 */
import { fmtInt, fmtUAH } from './format.js';
import { showTooltip, moveTooltip, hideTooltip } from './tooltip.js';

const W = 400, H = 250;
const M = { t: 16, r: 46, b: 26, l: 44 };
const IW = W - M.l - M.r, IH = H - M.t - M.b;
const MOBILE = () => window.matchMedia('(max-width: 900px)').matches;

export function initScrolly(data, analytics) {
  const years = data.years;                       // 2015..2026
  const series = years.map((y) => ({ year: y, ...data.totals[String(y)] }));
  const obs = analytics.observations;             // 131 спостереження частки
  const byYear = analytics.byYear;

  // Спільний стан
  const state = { activeYear: years[0], pinnedYear: null, pinnedObs: null };
  const charts = [];
  const apply = () => charts.forEach((c) => c.render(state));

  const onPinYear = (y) => {
    state.pinnedYear = state.pinnedYear === y ? null : y;
    state.pinnedObs = null;
    apply();
  };
  const onPinObs = (i) => {
    state.pinnedObs = state.pinnedObs === i ? null : i;
    state.pinnedYear = null;
    apply();
  };
  const clearPins = () => {
    if (state.pinnedYear != null || state.pinnedObs != null) {
      state.pinnedYear = state.pinnedObs = null;
      apply();
    }
  };

  charts.push(amountChart(series, onPinYear));
  charts.push(barsChart(series, onPinYear));
  charts.push(coverageChart(series, onPinYear));
  charts.push(stripChart(obs, byYear, onPinObs, onPinYear));

  fillTotalsTable(series);
  fillShareTable(byYear);

  // Клік повз графіки знімає закріплення
  document.getElementById('scrolly-graphic')?.addEventListener('click', (e) => {
    if (e.target.closest('.sc-clear')) clearPins();
  });

  // ------------------------------------------------ керування роком за скролом
  const yearTag = document.getElementById('sc-year');
  const yearTotal = document.getElementById('sc-yeartotal');
  const scrolly = document.getElementById('scrolly');
  const steps = [...document.querySelectorAll('.scrolly-step')];

  const setYear = (y) => {
    y = Math.max(years[0], Math.min(years[years.length - 1], y));
    if (y === state.activeYear) return;
    state.activeYear = y;
    if (yearTag) yearTag.textContent = y;
    if (yearTotal) yearTotal.textContent = fmtUAH(data.totals[String(y)].amount);
    apply();
  };

  const progressYear = () => {
    if (!scrolly) return;
    const rect = scrolly.getBoundingClientRect();
    const total = rect.height - window.innerHeight;
    const p = total > 0 ? Math.max(0, Math.min(1, -rect.top / total)) : 0;
    const idx = Math.round(p * (years.length - 1));
    setYear(years[idx]);
    // Підсвітка активного кроку
    steps.forEach((s) => {
      const sy = +s.dataset.year;
      s.classList.toggle('is-active', sy === years[idx]);
    });
  };

  // Пряме обчислення на скролі (без rAF): надійно навіть коли вкладка не компонує кадри
  let lastRun = 0, trailing = null;
  const onScroll = () => {
    const now = performance.now();
    if (now - lastRun >= 33) { lastRun = now; progressYear(); }
    else { clearTimeout(trailing); trailing = setTimeout(() => { lastRun = performance.now(); progressYear(); }, 40); }
  };

  if (MOBILE()) {
    // На вузьких екранах скрол-розкриття вимкнено — показуємо все одразу
    setYear(years[years.length - 1]);
    if (yearTag) yearTag.textContent = `${years[0]}–${years[years.length - 1]}`;
    if (yearTotal) yearTotal.textContent = '';
  } else {
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });
    if (yearTotal) yearTotal.textContent = fmtUAH(data.totals[String(years[0])].amount);
    progressYear();
  }
  apply();
}

/* ============================================================ спільні деталі */
function baseSVG(sel, label) {
  const svg = d3.select(sel).append('svg')
    .attr('viewBox', `0 0 ${W} ${H}`)
    .attr('role', 'img').attr('aria-label', label);
  return svg.append('g').attr('transform', `translate(${M.l},${M.t})`);
}
function yearScale(years) {
  return d3.scalePoint().domain(years).range([0, IW]).padding(0.4);
}
function drawXAxis(g, xFn, years) {
  g.append('g').selectAll('text').data(years).join('text')
    .attr('x', (y) => xFn(y)).attr('y', IH + 17).attr('text-anchor', 'middle')
    .style('font-family', 'var(--sans)').style('font-size', '8.5px')
    .style('font-variant-numeric', 'tabular-nums').style('fill', 'var(--muted)')
    .text((y) => (y % 2 ? '' : String(y).slice(2)));
  g.append('line').attr('x1', 0).attr('x2', IW).attr('y1', IH).attr('y2', IH)
    .style('stroke', 'var(--baseline)').style('stroke-width', 1);
}
function drawYGrid(g, y, ticks, fmt) {
  const t = g.append('g');
  for (const v of ticks) {
    if (v !== ticks[0]) {
      t.append('line').attr('x1', 0).attr('x2', IW).attr('y1', y(v)).attr('y2', y(v))
        .style('stroke', 'var(--grid)').style('stroke-width', 1);
    }
    t.append('text').attr('x', -8).attr('y', y(v)).attr('dy', '0.32em').attr('text-anchor', 'end')
      .style('font-family', 'var(--sans)').style('font-size', '9px')
      .style('font-variant-numeric', 'tabular-nums').style('fill', 'var(--muted)')
      .text(fmt(v));
  }
}
// Readout під графіком: показує закріплені дані
function readout(cardSel) {
  const box = document.querySelector(cardSel);
  return {
    show(html) {
      box.replaceChildren();
      const span = document.createElement('span');
      span.textContent = html;
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'sc-clear';
      btn.setAttribute('aria-label', 'Зняти закріплення');
      btn.textContent = '✕';
      box.append(span, btn);
      box.hidden = false;
    },
    hide() { box.hidden = true; box.replaceChildren(); },
  };
}
const DIM = 0.16;

/* --------------------------------------------------------- 1. кошти (лінія) */
function amountChart(series, onPin) {
  const g = baseSVG('#sc-amount', 'Кошти бюджетів участі за роками');
  const years = series.map((d) => d.year);
  const x = yearScale(years);
  const max = d3.max(series, (d) => d.amount);
  const y = d3.scaleLinear().domain([0, max * 1.1]).range([IH, 0]).nice();
  drawYGrid(g, y, y.ticks(4), (v) => fmtInt(v / 1e6));
  drawXAxis(g, x, years);
  g.append('text').attr('x', -8).attr('y', -5).attr('text-anchor', 'end')
    .style('font-family', 'var(--sans)').style('font-size', '8.5px').style('fill', 'var(--muted)')
    .text('млн грн');

  const line = d3.line().x((d) => x(d.year)).y((d) => y(d.amount)).curve(d3.curveMonotoneX);
  const solidPath = g.append('path').style('fill', 'none').style('stroke', 'var(--s1)')
    .style('stroke-width', 2).style('stroke-linecap', 'round').style('stroke-linejoin', 'round');
  const dashPath = g.append('path').style('fill', 'none').style('stroke', 'var(--s1)')
    .style('stroke-width', 2).style('stroke-dasharray', '3 5').style('stroke-linecap', 'round');

  const dots = g.append('g').selectAll('circle').data(series).join('circle')
    .attr('cx', (d) => x(d.year)).attr('cy', (d) => y(d.amount)).attr('r', 4)
    .style('stroke', 'var(--surface)').style('stroke-width', 2).style('cursor', 'pointer');
  const hits = g.append('g').selectAll('circle').data(series).join('circle')
    .attr('cx', (d) => x(d.year)).attr('cy', (d) => y(d.amount)).attr('r', 12)
    .style('fill', 'transparent').style('cursor', 'pointer').attr('tabindex', 0).attr('role', 'button')
    .attr('aria-label', (d) => `${d.year}: кошти ${fmtUAH(d.amount)}`);

  const label = g.append('text').attr('text-anchor', 'middle')
    .style('font-family', 'var(--sans)').style('font-size', '10px').style('font-weight', '650')
    .style('fill', 'var(--ink)').style('pointer-events', 'none');

  const ro = readout('#pin-amount');
  const tip = (event, d) => { showTooltip(event, { title: `${d.year} рік`,
    rows: [['Кошти', fmtUAH(d.amount), 'var(--s1)']],
    note: d.year >= 2022 ? 'Документований мінімум.' : undefined }); moveTooltip(event); };
  hits.on('pointerenter', tip).on('pointermove', moveTooltip).on('pointerleave', hideTooltip)
    .on('click', (e, d) => onPin(d.year))
    .on('keydown', (e, d) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onPin(d.year); } });

  return {
    render({ activeYear, pinnedYear }) {
      const shown = series.filter((d) => d.year <= activeYear);
      const solid = shown.filter((d) => d.year <= 2021);
      const dash = shown.filter((d) => d.year >= 2021);
      solidPath.attr('d', line(solid));
      dashPath.attr('d', dash.length > 1 ? line(dash) : null);
      dots.style('display', (d) => d.year <= activeYear ? null : 'none')
        .attr('r', (d) => d.year === pinnedYear ? 6 : 4)
        .style('fill', 'var(--s1)')
        .style('opacity', (d) => (pinnedYear == null || d.year === pinnedYear) ? 1 : DIM);
      solidPath.style('opacity', pinnedYear == null ? 1 : 0.35);
      dashPath.style('opacity', pinnedYear == null ? 1 : 0.35);
      if (pinnedYear != null && pinnedYear <= activeYear) {
        const d = series.find((s) => s.year === pinnedYear);
        label.attr('x', x(d.year)).attr('y', y(d.amount) - 12).text(fmtInt(d.amount / 1e6)).style('display', null);
        ro.show(`${d.year}: кошти ${fmtUAH(d.amount)}`);
      } else { label.style('display', 'none'); ro.hide(); }
    },
  };
}

/* ------------------------------------------------ 2. заявки / переможці */
function barsChart(series, onPin) {
  const legend = document.getElementById('sc-legend-bars');
  if (legend) {
    legend.replaceChildren();
    for (const [t, c] of [['Заявки', 'var(--s1)'], ['Переможці', 'var(--s2)']]) {
      const it = document.createElement('span'); it.className = 'item';
      const k = document.createElement('span'); k.className = 'key-rect'; k.style.background = c;
      it.append(k, document.createTextNode(t)); legend.appendChild(it);
    }
  }
  const g = baseSVG('#sc-bars', 'Заявки та проєкти-переможці за роками');
  const years = series.map((d) => d.year);
  const x = d3.scaleBand().domain(years).range([0, IW]).paddingInner(0.35).paddingOuter(0.12);
  const max = d3.max(series, (d) => d.applications);
  const y = d3.scaleLinear().domain([0, max * 1.08]).range([IH, 0]).nice();
  drawYGrid(g, y, y.ticks(4), (v) => fmtInt(v));

  const bw = Math.min(9, (x.bandwidth() - 2) / 2);
  const groupW = bw * 2 + 2;
  const start = (x.bandwidth() - groupW) / 2;
  const appG = g.append('g'), winG = g.append('g');
  const appBars = appG.selectAll('rect').data(series).join('rect')
    .attr('x', (d) => x(d.year) + start).attr('width', bw).attr('rx', 2).style('fill', 'var(--s1)');
  const winBars = winG.selectAll('rect').data(series).join('rect')
    .attr('x', (d) => x(d.year) + start + bw + 2).attr('width', bw).attr('rx', 2).style('fill', 'var(--s2)');

  const xp = d3.scalePoint().domain(years).range([x.bandwidth() / 2, IW - x.bandwidth() / 2]);
  drawXAxis(g, xp, years);

  const hits = g.append('g').selectAll('rect').data(series).join('rect')
    .attr('x', (d) => x(d.year)).attr('width', x.bandwidth()).attr('y', 0).attr('height', IH)
    .style('fill', 'transparent').style('cursor', 'pointer').attr('tabindex', 0).attr('role', 'button')
    .attr('aria-label', (d) => `${d.year}: заявок ${fmtInt(d.applications)}, переможців ${fmtInt(d.winners)}`);

  const ro = readout('#pin-bars');
  const tip = (event, d) => { showTooltip(event, { title: `${d.year} рік`,
    rows: [['Заявки', fmtInt(d.applications), 'var(--s1)'], ['Переможці', fmtInt(d.winners), 'var(--s2)']],
    note: d.year >= 2022 ? 'Документований мінімум.'
      : (d.applications ? `Успішність: ${Math.round(100 * d.winners / d.applications)} %` : undefined) });
    moveTooltip(event); };
  hits.on('pointerenter', tip).on('pointermove', moveTooltip).on('pointerleave', hideTooltip)
    .on('click', (e, d) => onPin(d.year))
    .on('keydown', (e, d) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onPin(d.year); } });

  return {
    render({ activeYear, pinnedYear }) {
      const H0 = (d, key) => d.year <= activeYear ? IH - y(d[key]) : 0;
      const op = (d) => (pinnedYear == null || d.year === pinnedYear) ? 1 : DIM;
      appBars
        .attr('y', (d) => d.year <= activeYear ? y(d.applications) : IH)
        .attr('height', (d) => H0(d, 'applications'))
        .style('opacity', op);
      winBars
        .attr('y', (d) => d.year <= activeYear ? y(d.winners) : IH)
        .attr('height', (d) => H0(d, 'winners'))
        .style('opacity', op);
      if (pinnedYear != null && pinnedYear <= activeYear) {
        const d = series.find((s) => s.year === pinnedYear);
        const rate = d.applications ? ` · успішність ${Math.round(100 * d.winners / d.applications)} %` : '';
        ro.show(`${d.year}: заявок ${fmtInt(d.applications)}, переможців ${fmtInt(d.winners)}${rate}`);
      } else ro.hide();
    },
  };
}

/* ------------------------------------------------------- 3. охоплення (area) */
function coverageChart(series, onPin) {
  const g = baseSVG('#sc-coverage', 'Кількість міст з активним бюджетом участі');
  const years = series.map((d) => d.year);
  const x = yearScale(years);
  const FRAME = 35;
  const y = d3.scaleLinear().domain([0, 40]).range([IH, 0]);
  drawYGrid(g, y, [0, 10, 20, 30], (v) => fmtInt(v));
  g.append('line').attr('x1', 0).attr('x2', IW).attr('y1', y(FRAME)).attr('y2', y(FRAME))
    .style('stroke', 'var(--baseline)').style('stroke-width', 1).style('stroke-dasharray', '2 4');
  g.append('text').attr('x', IW).attr('y', y(FRAME) - 4).attr('text-anchor', 'end')
    .style('font-family', 'var(--sans)').style('font-size', '8px').style('fill', 'var(--muted)')
    .text('рамка: 35 міст');
  drawXAxis(g, x, years);

  const area = d3.area().x((d) => x(d.year)).y0(IH).y1((d) => y(d.activeCities)).curve(d3.curveMonotoneX);
  const line = d3.line().x((d) => x(d.year)).y((d) => y(d.activeCities)).curve(d3.curveMonotoneX);
  const areaPath = g.append('path').style('fill', 'var(--s1)').style('fill-opacity', 0.1);
  const solidPath = g.append('path').style('fill', 'none').style('stroke', 'var(--s1)')
    .style('stroke-width', 2).style('stroke-linecap', 'round');
  const dashPath = g.append('path').style('fill', 'none').style('stroke', 'var(--s1)')
    .style('stroke-width', 2).style('stroke-dasharray', '3 5').style('stroke-linecap', 'round');
  const dots = g.append('g').selectAll('circle').data(series).join('circle')
    .attr('cx', (d) => x(d.year)).attr('cy', (d) => y(d.activeCities)).attr('r', 3.5)
    .style('stroke', 'var(--surface)').style('stroke-width', 2).style('cursor', 'pointer');
  const hits = g.append('g').selectAll('circle').data(series).join('circle')
    .attr('cx', (d) => x(d.year)).attr('cy', (d) => y(d.activeCities)).attr('r', 12)
    .style('fill', 'transparent').style('cursor', 'pointer').attr('tabindex', 0).attr('role', 'button')
    .attr('aria-label', (d) => `${d.year}: активних міст ${fmtInt(d.activeCities)} з 35`);

  const ro = readout('#pin-coverage');
  const tip = (event, d) => { showTooltip(event, { title: `${d.year} рік`,
    rows: [['Активних міст', fmtInt(d.activeCities), 'var(--s1)']],
    note: d.year >= 2022 ? 'Лише підтверджені цикли.' : 'З 35 міст рамки.' }); moveTooltip(event); };
  hits.on('pointerenter', tip).on('pointermove', moveTooltip).on('pointerleave', hideTooltip)
    .on('click', (e, d) => onPin(d.year))
    .on('keydown', (e, d) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onPin(d.year); } });

  return {
    render({ activeYear, pinnedYear }) {
      const shown = series.filter((d) => d.year <= activeYear);
      const solid = shown.filter((d) => d.year <= 2021);
      const dash = shown.filter((d) => d.year >= 2021);
      areaPath.attr('d', area(shown));
      solidPath.attr('d', line(solid));
      dashPath.attr('d', dash.length > 1 ? line(dash) : null);
      dots.style('display', (d) => d.year <= activeYear ? null : 'none')
        .attr('r', (d) => d.year === pinnedYear ? 5.5 : 3.5).style('fill', 'var(--s1)')
        .style('opacity', (d) => (pinnedYear == null || d.year === pinnedYear) ? 1 : DIM);
      [areaPath, solidPath, dashPath].forEach((p) => p.style('opacity', pinnedYear == null ? 1 : 0.4));
      if (pinnedYear != null && pinnedYear <= activeYear) {
        const d = series.find((s) => s.year === pinnedYear);
        ro.show(`${d.year}: активних міст ${fmtInt(d.activeCities)} з 35`);
      } else ro.hide();
    },
  };
}

/* --------------------------------------------- 4. частка (точкова діаграма) */
function stripChart(obs, byYear, onPinObs, onPinYear) {
  const pct = (v, d = 2) => (100 * v).toLocaleString('uk-UA', { maximumFractionDigits: d }) + ' %';
  const g = baseSVG('#sc-strip', 'Частка бюджету участі у видатках міста, 131 спостереження');
  const years = [...new Set(obs.map((d) => d.year))].sort();
  const x = d3.scalePoint().domain(years).range([0, IW]).padding(0.5);
  const yMax = 0.0105;
  const y = d3.scaleLinear().domain([0, yMax]).range([IH, 0]);

  for (const v of [0, 0.0025, 0.005, 0.0075, 0.01]) {
    if (v > 0) g.append('line').attr('x1', 0).attr('x2', IW).attr('y1', y(v)).attr('y2', y(v))
      .style('stroke', 'var(--grid)').style('stroke-width', 1);
    g.append('text').attr('x', -8).attr('y', y(v)).attr('dy', '0.32em').attr('text-anchor', 'end')
      .style('font-family', 'var(--sans)').style('font-size', '8.5px')
      .style('font-variant-numeric', 'tabular-nums').style('fill', 'var(--muted)')
      .text((100 * v).toLocaleString('uk-UA', { maximumFractionDigits: 2 }));
  }
  // Пороги
  const thr = { 0.005: 'мін. 0,5 %', 0.01: 'зрілий 1 %' };
  for (const t of [0.005, 0.01]) {
    g.append('line').attr('x1', 0).attr('x2', IW).attr('y1', y(t)).attr('y2', y(t))
      .style('stroke', 'var(--baseline)').style('stroke-width', 1).style('stroke-dasharray', '2 4');
    g.append('text').attr('x', IW).attr('y', y(t) - 3).attr('text-anchor', 'end')
      .style('font-family', 'var(--sans)').style('font-size', '8px').style('fill', 'var(--muted)').text(thr[t]);
  }
  g.append('line').attr('x1', 0).attr('x2', IW).attr('y1', IH).attr('y2', IH)
    .style('stroke', 'var(--baseline)').style('stroke-width', 1);
  g.append('g').selectAll('text').data(years).join('text')
    .attr('x', (d) => x(d)).attr('y', IH + 17).attr('text-anchor', 'middle')
    .style('font-family', 'var(--sans)').style('font-size', '8px')
    .style('font-variant-numeric', 'tabular-nums').style('fill', 'var(--muted)')
    .text((d) => String(d).slice(2));

  const jit = (i) => ((i * 137) % 17 - 8) * 0.8;
  const dots = g.append('g').selectAll('circle').data(obs).join('circle')
    .attr('cx', (d, i) => x(d.year) + jit(i)).attr('cy', (d) => y(Math.min(d.share, yMax)))
    .attr('r', 3.4).style('fill', 'var(--s1)').style('stroke', 'var(--surface)').style('stroke-width', 1)
    .style('cursor', 'pointer');

  const medLine = d3.line().x((d) => x(d.year)).y((d) => y(d.median)).curve(d3.curveMonotoneX);
  const medPath = g.append('path').style('fill', 'none').style('stroke', 'var(--s2)')
    .style('stroke-width', 2).style('stroke-linecap', 'round');
  const medDots = g.append('g').selectAll('circle').data(byYear).join('circle')
    .attr('cx', (d) => x(d.year)).attr('cy', (d) => y(d.median)).attr('r', 3)
    .style('fill', 'var(--s2)').style('stroke', 'var(--surface)').style('stroke-width', 1.5);

  const ro = readout('#pin-strip');
  const tipObs = (event, d) => showTooltip(event, { title: `${d.city} · ${d.year}`,
    rows: [['Частка видатків', pct(d.share)], ['Сума БУ', fmtUAH(d.s)], ['Видатки міста', fmtUAH(d.budget)]],
    note: d.basis ? `Основа: ${d.basis}.` : undefined });

  // Найближче спостереження для наведення/кліку
  const nearest = (mx, my, activeYear) => {
    let best = null, bd = Infinity, bi = -1;
    obs.forEach((d, i) => {
      if (d.year > activeYear) return;
      const dx = x(d.year) + jit(i) - mx, dy = y(Math.min(d.share, yMax)) - my;
      const dist = dx * dx + dy * dy;
      if (dist < bd) { bd = dist; best = d; bi = i; }
    });
    return bd < 400 ? { d: best, i: bi } : null;
  };
  let curActive = years[years.length - 1];
  const overlay = g.append('rect').attr('width', IW).attr('height', IH).style('fill', 'transparent')
    .style('cursor', 'pointer');
  overlay.on('pointermove', function (event) {
    const [mx, my] = d3.pointer(event, this);
    const hit = nearest(mx, my, curActive);
    if (hit) { tipObs(event, hit.d); moveTooltip(event); } else hideTooltip();
  }).on('pointerleave', hideTooltip)
    .on('click', function (event) {
      const [mx, my] = d3.pointer(event, this);
      const hit = nearest(mx, my, curActive);
      if (hit) onPinObs(hit.i);
    });

  return {
    render({ activeYear, pinnedYear, pinnedObs }) {
      curActive = activeYear;
      const shownYears = byYear.filter((d) => d.year <= activeYear);
      medPath.attr('d', shownYears.length > 1 ? medLine(shownYears) : null);
      medDots.style('display', (d) => d.year <= activeYear ? null : 'none');
      dots.each(function (d, i) {
        const sel = d3.select(this);
        const revealed = d.year <= activeYear;
        let op = revealed ? 0.6 : 0;
        let fill = 'var(--s1)', r = 3.4;
        if (revealed && pinnedObs != null) { op = i === pinnedObs ? 1 : DIM; if (i === pinnedObs) { fill = 'var(--s2)'; r = 5.5; } }
        else if (revealed && pinnedYear != null) { op = d.year === pinnedYear ? 0.85 : DIM; }
        sel.style('opacity', op).style('fill', fill).attr('r', r);
      });
      if (pinnedObs != null) {
        const d = obs[pinnedObs];
        ro.show(`${d.city} · ${d.year}: ${pct(d.share)} видатків · сума ${fmtUAH(d.s)}`);
      } else if (pinnedYear != null && pinnedYear >= years[0]) {
        const yb = byYear.find((b) => b.year === pinnedYear);
        if (yb) ro.show(`${pinnedYear}: медіана ${pct(yb.median)} · середнє ${pct(yb.mean)} · N=${yb.n}`);
        else ro.hide();
      } else ro.hide();
    },
  };
}

/* --------------------------------------------------------------- таблиці */
function fillTotalsTable(series) {
  const tbody = document.querySelector('#totals-table tbody');
  if (!tbody) return;
  tbody.replaceChildren();
  for (const d of series) {
    const tr = document.createElement('tr');
    [d.year, fmtInt(d.activeCities), fmtInt(d.applications), fmtInt(d.winners),
     (d.amount / 1e6).toLocaleString('uk-UA', { maximumFractionDigits: 1 })].forEach((c, i) => {
      const td = document.createElement(i === 0 ? 'th' : 'td');
      if (i === 0) td.scope = 'row';
      td.textContent = c; tr.appendChild(td);
    });
    tbody.appendChild(tr);
  }
}
function fillShareTable(byYear) {
  const tbody = document.querySelector('#share-table tbody');
  if (!tbody) return;
  const pct = (v) => (100 * v).toLocaleString('uk-UA', { maximumFractionDigits: 2 }) + ' %';
  tbody.replaceChildren();
  for (const d of byYear) {
    const tr = document.createElement('tr');
    [d.year, d.n, pct(d.mean), pct(d.median), pct(d.weighted)].forEach((c, i) => {
      const td = document.createElement(i === 0 ? 'th' : 'td');
      if (i === 0) td.scope = 'row';
      td.textContent = c; tr.appendChild(td);
    });
    tbody.appendChild(tr);
  }
}
