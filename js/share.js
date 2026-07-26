/**
 * Секція глибини участі (частина після скрол-блока):
 *   — стат-плитки (середня / медіана / зважена частка, N спостережень);
 *   — профілі міст: ТОП-12 за середньою часткою, клікабельні
 *     (клік по смузі закріплює місто, решта сіріє).
 */
import { fmtInt } from './format.js';
import { showTooltip, moveTooltip, hideTooltip } from './tooltip.js';

const pct = (v, digits = 2) =>
  (100 * v).toLocaleString('uk-UA', { maximumFractionDigits: digits }) + ' %';

const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches || document.hidden;

export function initShare(analytics) {
  renderTiles(analytics);
  profilesChart(analytics);
}

/* ------------------------------------------------------------ стат-плитки */
function renderTiles({ summary, periods }) {
  const el = document.getElementById('share-tiles');
  const tiles = [
    ['Середня частка', pct(summary.mean), 'середнє 131 річної частки місто–рік'],
    ['Медіана', pct(summary.median), 'стійкий центр розподілу'],
    ['Зважена частка', pct(summary.weighted), 'Σ БУ ÷ Σ бюджетів міст'],
    ['Спостережень', fmtInt(summary.n), summary.frame],
    ['2018–2021 vs 2022–2026', `${pct(periods[0].mean)} → ${pct(periods[1].mean)}`,
      `${periods[0].n} проти ${periods[1].n} спостережень`],
  ];
  el.replaceChildren();
  for (const [label, value, note] of tiles) {
    const t = document.createElement('div');
    t.className = 'stat-tile';
    t.setAttribute('role', 'listitem');
    const l = document.createElement('div'); l.className = 'label'; l.textContent = label;
    const v = document.createElement('div'); v.className = 'value'; v.textContent = value;
    const n = document.createElement('div'); n.className = 'note'; n.textContent = note;
    t.append(l, v, n);
    el.appendChild(t);
  }
}

/* --------------------------------------------- профілі міст (ТОП-12) */
function profilesChart({ profiles }) {
  const data = profiles.slice(0, 12);
  const W = 560, ROW = 26, M = { t: 6, r: 74, b: 24, l: 128 };
  const IH = data.length * ROW;
  const H = IH + M.t + M.b;
  const IW = W - M.l - M.r;

  const svg = d3.select('#share-profiles').append('svg')
    .attr('viewBox', `0 0 ${W} ${H}`)
    .attr('role', 'img')
    .attr('aria-label', 'Міста з найвищою середньою часткою бюджету участі у видатках');
  const g = svg.append('g').attr('transform', `translate(${M.l},${M.t})`);

  const max = d3.max(data, (d) => d.mean);
  const x = d3.scaleLinear().domain([0, max * 1.05]).range([0, IW]);
  const y = d3.scaleBand().domain(data.map((d) => d.city)).range([0, IH]).padding(0.32);

  const names = g.append('g').selectAll('text.name').data(data).join('text')
    .attr('x', -10).attr('y', (d) => y(d.city) + y.bandwidth() / 2).attr('dy', '0.32em')
    .attr('text-anchor', 'end')
    .style('font-family', 'var(--sans)').style('font-size', '11px')
    .style('fill', 'var(--ink)')
    .text((d) => d.city);

  const bars = g.append('g').selectAll('rect').data(data).join('rect')
    .attr('x', 0).attr('y', (d) => y(d.city))
    .attr('height', Math.min(16, y.bandwidth()))
    .attr('rx', 3)
    .style('fill', 'var(--s1)')
    .style('cursor', 'pointer')
    .attr('width', reduced() ? (d) => x(d.mean) : 0);
  if (!reduced()) {
    bars.transition().duration(700).ease(d3.easeCubicOut)
      .delay((_, i) => i * 40)
      .attr('width', (d) => x(d.mean));
  }

  const vals = g.append('g').selectAll('text.val').data(data).join('text')
    .attr('x', (d) => x(d.mean) + 6)
    .attr('y', (d) => y(d.city) + y.bandwidth() / 2).attr('dy', '0.32em')
    .style('font-family', 'var(--sans)').style('font-size', '10.5px')
    .style('font-variant-numeric', 'tabular-nums')
    .style('font-weight', '650').style('fill', 'var(--ink)')
    .text((d) => pct(d.mean));

  g.append('line').attr('x1', 0).attr('x2', 0).attr('y1', 0).attr('y2', IH)
    .style('stroke', 'var(--baseline)').style('stroke-width', 1);
  g.append('text').attr('x', 0).attr('y', IH + 16)
    .style('font-family', 'var(--sans)').style('font-size', '9.5px').style('fill', 'var(--muted)')
    .text('середня частка зіставних років, % видатків міста · клік по смузі закріплює місто');

  const ro = readout('#pin-profiles');
  let pinned = null;
  const applyPin = () => {
    bars.style('opacity', (d) => (pinned == null || d.city === pinned) ? 1 : 0.16)
      .style('fill', (d) => d.city === pinned ? 'var(--s2)' : 'var(--s1)');
    names.style('opacity', (d) => (pinned == null || d.city === pinned) ? 1 : 0.4)
      .style('font-weight', (d) => d.city === pinned ? '700' : '400');
    vals.style('opacity', (d) => (pinned == null || d.city === pinned) ? 1 : 0.4);
    if (pinned) {
      const d = data.find((c) => c.city === pinned);
      ro.show(`${d.city}: середня ${pct(d.mean)} · медіана ${pct(d.median)} · `
        + `діапазон ${pct(d.min)}–${pct(d.max)} · ${d.firstYear}–${d.lastYear}`);
    } else ro.hide();
  };

  const tip = (event, d) => {
    showTooltip(event, {
      title: d.city,
      rows: [
        ['Середня частка', pct(d.mean)],
        ['Медіана', pct(d.median)],
        ['Діапазон', `${pct(d.min)} – ${pct(d.max)}`],
        ['Зіставних років', `${fmtInt(d.n)} (${d.firstYear}–${d.lastYear})`],
      ],
    });
    moveTooltip(event);
  };

  // Хіт-таргети на рядок (наведення + клік-закріплення)
  g.append('g').selectAll('rect.hit').data(data).join('rect')
    .attr('x', -M.l).attr('y', (d) => y(d.city) - 3)
    .attr('width', W - M.r).attr('height', y.bandwidth() + 6)
    .style('fill', 'transparent').style('cursor', 'pointer')
    .attr('tabindex', 0).attr('role', 'button')
    .attr('aria-label', (d) => `${d.city}: середня частка ${pct(d.mean)}`)
    .on('pointerenter pointermove', tip)
    .on('pointerleave', hideTooltip)
    .on('click', (e, d) => { pinned = pinned === d.city ? null : d.city; applyPin(); })
    .on('keydown', (e, d) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pinned = pinned === d.city ? null : d.city; applyPin(); }
    });

  document.querySelector('#pin-profiles')?.addEventListener('click', (e) => {
    if (e.target.closest('.sc-clear')) { pinned = null; applyPin(); }
  });
}

/* readout під графіком: показує закріплені дані */
function readout(sel) {
  const box = document.querySelector(sel);
  return {
    show(text) {
      if (!box) return;
      box.replaceChildren();
      const span = document.createElement('span');
      span.textContent = text;
      const btn = document.createElement('button');
      btn.type = 'button'; btn.className = 'sc-clear';
      btn.setAttribute('aria-label', 'Зняти закріплення'); btn.textContent = '✕';
      box.append(span, btn); box.hidden = false;
    },
    hide() { if (box) { box.hidden = true; box.replaceChildren(); } },
  };
}
