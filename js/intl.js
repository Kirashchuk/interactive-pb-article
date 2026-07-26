/**
 * Секція «Міжнародні орієнтири»: порівнювані міста і нормативи.
 *   — горизонтальна діаграма зіставних часток загального міського бюджету
 *     (Україна-факт, Барселона, Париж, європейська практика, Шотландія);
 *   — картки кейсів, які не зводяться до відсотка загального бюджету
 *     (Мінфін №94, Світовий банк 5–10 %, Сінгапур-пілот).
 */
import { showTooltip, moveTooltip, hideTooltip } from './tooltip.js';

const pct = (v, d = 2) =>
  (100 * v).toLocaleString('uk-UA', { maximumFractionDigits: d }) + ' %';

const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches || document.hidden;

export function initIntl(analytics) {
  comparisonChart(analytics);
  renderCards(analytics);
}

/* --------------------------------------------------- діаграма порівняння */
function comparisonChart({ summary, international, barcelona }) {
  const find = (substr) => international.find((r) => r.case.includes(substr) || r.place.includes(substr));

  const items = [
    {
      name: 'Великі міста України',
      value: summary.mean,
      tag: 'емпіричний факт, 2018–2026',
      accent: true,
      detail: {
        rows: [['Середня частка', pct(summary.mean)], ['Медіана', pct(summary.median)],
               ['Спостережень', String(summary.n)]],
        note: 'Розраховано з зіставних пар «сума БУ ÷ загальні видатки міста».',
      },
    },
    {
      name: 'Барселона',
      value: barcelona.share,
      tag: 'розрахунок, 2024–2027',
      detail: {
        rows: [['Програма', '€30 млн / 4 роки'], ['Ануалізовано', '€7,5 млн/рік'],
               ['Бюджет 2024', '€3,807 млрд'], ['Індикативна частка', pct(barcelona.share)]],
        note: 'Розрахунок за офіційними значеннями; місто не декларує відсоток.',
      },
    },
    {
      name: 'Париж',
      value: 0.01,
      tag: 'опис практики OECD, 2017',
      detail: {
        rows: [['Заявлено', '5 % інвестиційного бюджету'], ['Еквівалент', '≈1 % загального бюджету']],
        note: (find('OECD')?.interpretation) ||
          'Приклад Парижа показує важливість знаменника: 5 % інвестиційного ≈ 1 % загального.',
      },
    },
    {
      name: 'Європейська практика',
      value: 0.01,
      tag: 'узагальнення UN-Habitat',
      detail: {
        rows: [['Орієнтир', '≈1 % муніципального бюджету']],
        note: 'UN-Habitat: універсального оптимального відсотка не існує; європейську практику узагальнено на рівні ~1 %.',
      },
    },
    {
      name: 'Шотландія',
      value: 0.01,
      tag: 'урядова ціль, ≥1 %',
      detail: {
        rows: [['Ціль', 'щонайменше 1 % бюджетів місцевого самоврядування']],
        note: 'Framework Agreement між урядом Шотландії та COSLA — політичний цільовий орієнтир.',
      },
    },
  ];

  const W = 760, ROW = 40, M = { t: 8, r: 84, b: 26, l: 190 };
  const IH = items.length * ROW;
  const H = IH + M.t + M.b;
  const IW = W - M.l - M.r;

  const svg = d3.select('#intl-chart').append('svg')
    .attr('viewBox', `0 0 ${W} ${H}`)
    .attr('role', 'img')
    .attr('aria-label', 'Порівняння часток бюджету участі: Україна та міжнародні орієнтири');
  const g = svg.append('g').attr('transform', `translate(${M.l},${M.t})`);

  const x = d3.scaleLinear().domain([0, 0.0112]).range([0, IW]);
  const y = d3.scaleBand().domain(items.map((d) => d.name)).range([0, IH]).padding(0.42);

  // Вертикальна сітка (0,25 кроки)
  for (const v of [0.0025, 0.005, 0.0075, 0.01]) {
    g.append('line').attr('x1', x(v)).attr('x2', x(v)).attr('y1', 0).attr('y2', IH)
      .style('stroke', 'var(--grid)').style('stroke-width', 1);
    g.append('text').attr('x', x(v)).attr('y', IH + 16).attr('text-anchor', 'middle')
      .style('font-family', 'var(--sans)').style('font-size', '9.5px')
      .style('font-variant-numeric', 'tabular-nums').style('fill', 'var(--muted)')
      .text((100 * v).toLocaleString('uk-UA', { maximumFractionDigits: 2 }) + ' %');
  }

  g.append('g').selectAll('text.name').data(items).join('text')
    .attr('x', -10).attr('y', (d) => y(d.name) + y.bandwidth() / 2 - 5).attr('dy', '0.32em')
    .attr('text-anchor', 'end')
    .style('font-family', 'var(--sans)').style('font-size', '11.5px')
    .style('font-weight', (d) => d.accent ? '700' : '500')
    .style('fill', 'var(--ink)')
    .text((d) => d.name);
  g.append('g').selectAll('text.tag').data(items).join('text')
    .attr('x', -10).attr('y', (d) => y(d.name) + y.bandwidth() / 2 + 8).attr('dy', '0.32em')
    .attr('text-anchor', 'end')
    .style('font-family', 'var(--sans)').style('font-size', '8.5px')
    .style('fill', 'var(--muted)')
    .text((d) => d.tag);

  const baseFill = (d) => d.accent ? 'var(--s1)' : 'var(--nodata)';
  const bars = g.append('g').selectAll('rect').data(items).join('rect')
    .attr('x', 0).attr('y', (d) => y(d.name))
    .attr('height', Math.min(18, y.bandwidth())).attr('rx', 3)
    .style('fill', baseFill).style('cursor', 'pointer')
    .attr('width', reduced() ? (d) => x(d.value) : 0);
  if (!reduced()) {
    bars.transition().duration(700).ease(d3.easeCubicOut).delay((_, i) => i * 60)
      .attr('width', (d) => x(d.value));
  }

  const vals = g.append('g').selectAll('text.val').data(items).join('text')
    .attr('x', (d) => x(d.value) + 7)
    .attr('y', (d) => y(d.name) + y.bandwidth() / 2).attr('dy', '0.32em')
    .style('font-family', 'var(--sans)').style('font-size', '11px')
    .style('font-weight', '650').style('font-variant-numeric', 'tabular-nums')
    .style('fill', 'var(--ink)')
    .text((d) => (d.name === 'Шотландія' ? '≥' : d.value === 0.01 ? '≈' : '') + pct(d.value, 2));

  g.append('line').attr('x1', 0).attr('x2', 0).attr('y1', 0).attr('y2', IH)
    .style('stroke', 'var(--baseline)').style('stroke-width', 1);

  const ro = readout('#pin-intl');
  let pinned = null;
  const applyPin = () => {
    bars.style('opacity', (d) => (pinned == null || d.name === pinned) ? 1 : 0.16)
      .style('fill', (d) => d.name === pinned ? 'var(--s2)' : baseFill(d));
    vals.style('opacity', (d) => (pinned == null || d.name === pinned) ? 1 : 0.4);
    if (pinned) {
      const d = items.find((it) => it.name === pinned);
      const parts = d.detail.rows.map(([k, v]) => `${k}: ${v}`).join(' · ');
      ro.show(`${d.name} — ${parts}`);
    } else ro.hide();
  };

  g.append('g').selectAll('rect.hit').data(items).join('rect')
    .attr('x', -M.l).attr('y', (d) => y(d.name) - 6)
    .attr('width', W - M.r).attr('height', y.bandwidth() + 12)
    .style('fill', 'transparent').style('cursor', 'pointer')
    .attr('tabindex', 0).attr('role', 'button')
    .attr('aria-label', (d) => `${d.name}: ${pct(d.value, 2)}`)
    .on('pointerenter pointermove', (event, d) => {
      showTooltip(event, { title: d.name, rows: d.detail.rows, note: d.detail.note });
      moveTooltip(event);
    })
    .on('pointerleave', hideTooltip)
    .on('click', (e, d) => { pinned = pinned === d.name ? null : d.name; applyPin(); })
    .on('keydown', (e, d) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pinned = pinned === d.name ? null : d.name; applyPin(); }
    });

  document.querySelector('#pin-intl')?.addEventListener('click', (e) => {
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

/* ------------------------------------------------------------- картки */
function renderCards({ international }) {
  const el = document.getElementById('intl-cards');
  const cards = [
    {
      title: 'Україна: нормативу немає',
      value: 'Мінфін №94',
      text: 'Методичні рекомендації Мінфіну (2020) радять затвердити локальне Положення, ' +
        'але не встановлюють загальнодержавної відсоткової норми. Кошти надходять з ' +
        'відповідного місцевого бюджету, а не з окремого фонду.',
    },
    {
      title: 'Світовий банк: інший знаменник',
      value: '5–10 %',
      text: 'Історичний діапазон 5–10 % (toolkit 2006) стосується дохідного бюджету, а ' +
        'матеріал 2020 року подає 10 % як орієнтовну верхню межу, а не рекомендований рівень. ' +
        'Ці числа не можна порівнювати з часткою загальних видатків напряму.',
    },
    {
      title: 'Сінгапур: пілот, не квота',
      value: 'S$200 тис.',
      text: 'Перший пілот (Spottiswoode Park, 2026) фінансується з Future-Ready Society ' +
        'Impact Fund на рівні мікрорайону — частка міського бюджету не розраховується.',
    },
  ];
  el.replaceChildren();
  for (const c of cards) {
    const card = document.createElement('div');
    card.className = 'stat-tile';
    const l = document.createElement('div'); l.className = 'label'; l.textContent = c.title;
    const v = document.createElement('div'); v.className = 'value'; v.style.fontSize = '1.25rem';
    v.textContent = c.value;
    const n = document.createElement('div'); n.className = 'note'; n.textContent = c.text;
    card.append(l, v, n);
    el.appendChild(card);
  }
}
