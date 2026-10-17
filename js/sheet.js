/**
 * Оформлення «аркуша карти», спільне з презентацією (presentation/js/map.js):
 * декоративні горизонталі під hero, градусна сітка з підписами на рамці
 * та масштабна лінійка для карт статті.
 */

/** Декоративні горизонталі (детермінований «рельєф»), як на топографічному аркуші */
export function initContours(svgEl) {
  if (!svgEl) return;
  let lastW = 0;
  const draw = () => {
    const r = svgEl.getBoundingClientRect();
    const w = Math.max(10, Math.round(r.width)), h = Math.max(10, Math.round(r.height));
    if (w === lastW) return; // висота «стрибає» від адресного рядка на телефоні — перемальовуємо лише за шириною
    lastW = w;
    const s = d3.select(svgEl).attr('viewBox', `0 0 ${w} ${h}`).attr('preserveAspectRatio', 'none');
    s.selectAll('*').remove();
    const cell = 10, nx = Math.ceil(w / cell) + 1, ny = Math.ceil(h / cell) + 1;
    const vals = new Float64Array(nx * ny);
    for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
      const x = i / nx, y = j / ny;
      vals[j * nx + i] = Math.sin(x * 5.1 + 1.3) * Math.cos(y * 3.7 - 0.4) + 0.6 * Math.sin(x * 9.3 - y * 6.1 + 2.1)
        + 0.35 * Math.cos(x * 15.7 + y * 11.3) + 0.9 * Math.exp(-((x - 0.72) ** 2 + (y - 0.42) ** 2) * 9);
    }
    const ext = d3.extent(vals);
    const th = d3.range(ext[0], ext[1], (ext[1] - ext[0]) / 22);
    const gen = d3.contours().size([nx, ny]).thresholds(th);
    const path = d3.geoPath(d3.geoIdentity().scale(cell));
    s.append('g').selectAll('path').data(gen(vals)).join('path').attr('d', path)
      .style('fill', 'none').style('stroke', 'var(--contour)')
      .attr('stroke-width', (d, i) => (i % 5 === 0 ? 1.6 : 0.8))
      .attr('vector-effect', 'non-scaling-stroke');
  };
  draw();
  let t = null;
  window.addEventListener('resize', () => { clearTimeout(t); t = setTimeout(draw, 150); }, { passive: true });
}

/** Підписи меридіанів знизу й паралелей ліворуч — там, де лінія сітки перетинає рамку */
export function frameLabels(svg, proj, w, h) {
  const g = svg.append('g').attr('aria-hidden', 'true');
  for (let lon = 22; lon <= 42; lon += 2) {
    let lo = 38, hi = 58;
    for (let i = 0; i < 40; i++) { const m = (lo + hi) / 2; if (proj([lon, m])[1] > h - 3) lo = m; else hi = m; }
    const [x] = proj([lon, (lo + hi) / 2]);
    if (x > 40 && x < w - 40) g.append('text').attr('class', 'map-gl').attr('x', x).attr('y', h - 5).attr('text-anchor', 'middle').text(`${lon}° сх. д.`);
  }
  for (let lat = 44; lat <= 54; lat += 2) {
    let lo = 10, hi = 50;
    for (let i = 0; i < 40; i++) { const m = (lo + hi) / 2; if (proj([m, lat])[0] < 4) lo = m; else hi = m; }
    const [, y] = proj([(lo + hi) / 2, lat]);
    if (y > 16 && y < h - 24) g.append('text').attr('class', 'map-gl').attr('x', 5).attr('y', y - 4).text(`${lat}° пн. ш.`);
  }
  return g;
}

/** Масштабна лінійка в правому нижньому куті (км на середній паралелі України) */
export function scaleBar(svg, proj, w, h, km = 200) {
  const a = proj([31, 48.5]), b = proj([32, 48.5]);
  const kmPerPx = (d3.geoDistance([31, 48.5], [32, 48.5]) * 6371) / Math.hypot(b[0] - a[0], b[1] - a[1]);
  const len = km / kmPerPx;
  const g = svg.append('g').attr('class', 'map-scale').attr('aria-hidden', 'true')
    .attr('transform', `translate(${w - len - 22},${h - 30})`);
  const seg = [0, km / 4, km / 2, km];
  for (let i = 0; i < 3; i++) {
    g.append('rect').attr('x', seg[i] / kmPerPx).attr('y', 0).attr('width', (seg[i + 1] - seg[i]) / kmPerPx).attr('height', 4)
      .style('fill', i % 2 ? 'var(--surface)' : 'var(--ink-2)');
  }
  seg.forEach((v, i) => g.append('text').attr('x', v / kmPerPx).attr('y', -4).attr('text-anchor', 'middle').text(i === 3 ? `${v} км` : v));
  return g;
}
