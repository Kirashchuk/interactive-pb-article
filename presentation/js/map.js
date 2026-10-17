// Картооснова: конічна рівновелика проєкція, суша сусідів, області, річки,
// градусна сітка з підписами на рамці та масштабна лінійка.
/* global d3 */
import { box } from "./util.js";

let GEO = null;
let uid = 0;
const OUT_OF_FRAME = new Set(["UA-43", "UA-40"]); // АР Крим, м. Севастополь — поза рамкою дослідження

// Кільця полігонів для d3-geo мають іти за годинниковою стрілкою; страхуємося від «весь світ мінус полігон»
function fixRings(rings) {
  const area = d3.geoArea({ type: "Polygon", coordinates: rings });
  return area > 2 * Math.PI ? rings.map((r) => r.slice().reverse()) : rings;
}

export function setGeo(raw) {
  const poly = (rings) => ({ type: "Feature", properties: {}, geometry: { type: "Polygon", coordinates: fixRings(rings) } });
  const oblasts = raw.oblasts.map((o) => ({
    type: "Feature",
    properties: { name: o.name, iso: o.iso },
    geometry: { type: "MultiPolygon", coordinates: o.c.map(fixRings) },
  }));
  GEO = {
    oblasts,
    ua: { type: "FeatureCollection", features: oblasts },
    land: raw.land.map(poly),
    lakes: raw.lakes.map(poly),
    borders: { type: "MultiLineString", coordinates: raw.borders },
    uaBorder: { type: "MultiLineString", coordinates: raw.uaBorder },
    coast: { type: "MultiLineString", coordinates: raw.uaCoast },
    rivers: raw.rivers.map((r) => ({ w: r.w, n: r.n, g: { type: "LineString", coordinates: r.g } })),
    labels: raw.labels,
    src: raw.src,
  };
}

// Макрорегіони статті за областями (для тонування)
export const OBLAST_REGION = {
  "Волинська": "W", "Рівненська": "W", "Львівська": "W", "Тернопільська": "W", "Івано-Франківська": "W",
  "Закарпатська": "W", "Чернівецька": "W", "Хмельницька": "W",
  "Житомирська": "C", "Київська": "C", "м. Київ": "C", "Вінницька": "C", "Чернігівська": "C", "Черкаська": "C",
  "Сумська": "C", "Полтавська": "C", "Кіровоградська": "C",
  "Одеська": "SE", "Миколаївська": "SE", "Херсонська": "SE", "Запорізька": "SE", "Дніпропетровська": "SE",
  "Харківська": "SE", "Донецька": "SE", "Луганська": "SE",
};

/**
 * Малює основу карти в <svg>. Повертає { s, proj, path, w, h, obl, top } — top для власних шарів.
 * opts: pad, padL/padR/padT/padB, labels (сусіди), grat (сітка), scale (лінійка), rivers
 */
export function baseMap(svgEl, opts = {}) {
  const { w, h } = box(svgEl);
  const o = { pad: 14, padL: 0, padR: 0, padT: 0, padB: 0, labels: true, grat: true, scale: true, rivers: true, ...opts };
  const s = d3.select(svgEl).attr("viewBox", `0 0 ${w} ${h}`).attr("preserveAspectRatio", "xMidYMid meet");
  s.selectAll("*").remove();
  const proj = d3.geoConicEqualArea().parallels([45.5, 51.5]).rotate([-31.2, 0])
    .fitExtent([[o.pad + o.padL, o.pad + o.padT], [w - o.pad - o.padR, h - o.pad - o.padB]], GEO.ua);
  const path = d3.geoPath(proj);
  const id = `m${++uid}`;

  const defs = s.append("defs");
  const pat = defs.append("pattern").attr("id", `${id}-hatch`).attr("patternUnits", "userSpaceOnUse")
    .attr("width", 6).attr("height", 6).attr("patternTransform", "rotate(45)");
  pat.append("rect").attr("width", 6).attr("height", 6).style("fill", "var(--land-ctx)");
  pat.append("line").attr("x1", 0).attr("y1", 0).attr("x2", 0).attr("y2", 6).style("stroke", "var(--edge)").attr("stroke-width", 1.4);
  defs.append("clipPath").attr("id", `${id}-clip`).append("rect").attr("width", w).attr("height", h);

  const ctx = o.context !== false;
  if (!ctx) { // без сусідів: річки обрізаємо контуром України
    defs.append("clipPath").attr("id", `${id}-ua`).append("path").attr("d", path(GEO.ua));
    o.labels = false; o.grat = false;
  }
  if (ctx) s.append("rect").attr("class", "map-sea").attr("width", w).attr("height", h);
  const g = s.append("g").attr("clip-path", `url(#${id}-clip)`);
  if (ctx) {
    g.append("g").selectAll("path").data(GEO.land).join("path").attr("class", "map-ctx").attr("d", path);
    g.append("g").selectAll("path").data(GEO.lakes).join("path").attr("class", "map-lake").attr("d", path);
    g.append("path").datum(GEO.borders).attr("class", "map-border").attr("d", path);
  }
  if (o.grat) g.append("path").datum(d3.geoGraticule().extent([[14, 40], [46, 58]]).step([2, 2])()).attr("class", "map-grat").attr("d", path);

  const obl = g.append("g").selectAll("path").data(GEO.oblasts).join("path")
    .attr("class", (d) => "map-obl" + (OUT_OF_FRAME.has(d.properties.iso) ? " out" : ""))
    .attr("d", path);
  obl.filter((d) => OUT_OF_FRAME.has(d.properties.iso)).style("fill", `url(#${id}-hatch)`);

  if (o.rivers) {
    const k = Math.max(0.6, Math.min(1.4, w / 1000));
    g.append("g").attr("clip-path", ctx ? null : `url(#${id}-ua)`).selectAll("path").data(GEO.rivers).join("path").attr("class", "map-river")
      .attr("stroke-width", (d) => d.w * k).attr("d", (d) => path(d.g));
  }
  g.append("path").datum(GEO.coast).attr("class", "map-coast").attr("d", path);
  g.append("path").datum(GEO.uaBorder).attr("class", "map-ua").attr("d", path);

  if (o.labels && w > 520) {
    g.append("g").selectAll("text").data(GEO.labels).join("text").attr("class", "map-ctxl")
      .attr("text-anchor", "middle")
      .attr("transform", (d) => `translate(${proj([d.lon, d.lat])})`).text((d) => d.t);
    const seas = [{ t: "ЧОРНЕ МОРЕ", lon: 31.6, lat: 43.9 }, { t: "АЗОВСЬКЕ МОРЕ", lon: 36.9, lat: 46.05 }];
    g.append("g").selectAll("text").data(seas).join("text").attr("class", "map-sealbl").attr("text-anchor", "middle")
      .attr("transform", (d) => `translate(${proj([d.lon, d.lat])})`).text((d) => d.t);
  }
  if (o.grat && o.gratLabels !== false && w > 420) frameLabels(s, proj, w, h);
  if (o.scale && w > 360) scaleBar(s, proj, w, h);

  const top = s.append("g").attr("class", "map-top");
  return { s, proj, path, w, h, obl, top, defs, id };
}

// Підписи меридіанів знизу й паралелей ліворуч — там, де лінія сітки перетинає рамку
function frameLabels(s, proj, w, h) {
  const g = s.append("g");
  for (let lon = 22; lon <= 42; lon += 2) {
    let lo = 38, hi = 58;
    for (let i = 0; i < 40; i++) { const m = (lo + hi) / 2; if (proj([lon, m])[1] > h - 3) lo = m; else hi = m; }
    const [x] = proj([lon, (lo + hi) / 2]);
    if (x > 40 && x < w - 40) g.append("text").attr("class", "map-gl").attr("x", x).attr("y", h - 5).attr("text-anchor", "middle").text(`${lon}° сх. д.`);
  }
  for (let lat = 44; lat <= 54; lat += 2) {
    let lo = 10, hi = 50;
    for (let i = 0; i < 40; i++) { const m = (lo + hi) / 2; if (proj([m, lat])[0] < 4) lo = m; else hi = m; }
    const [, y] = proj([(lo + hi) / 2, lat]);
    if (y > 16 && y < h - 24) g.append("text").attr("class", "map-gl").attr("x", 5).attr("y", y - 4).text(`${lat}° пн. ш.`);
  }
}

function scaleBar(s, proj, w, h) {
  const a = proj([31, 48.5]), b = proj([32, 48.5]);
  const kmPerPx = (d3.geoDistance([31, 48.5], [32, 48.5]) * 6371) / Math.hypot(b[0] - a[0], b[1] - a[1]);
  const km = w > 800 ? 200 : 100;
  const len = km / kmPerPx;
  const g = s.append("g").attr("class", "map-scale").attr("transform", `translate(${w - len - 22},${h - 30})`);
  const seg = [0, km / 4, km / 2, km];
  for (let i = 0; i < 3; i++) {
    g.append("rect").attr("x", seg[i] / kmPerPx).attr("y", 0).attr("width", (seg[i + 1] - seg[i]) / kmPerPx).attr("height", 4)
      .style("fill", i % 2 ? "var(--surface)" : "var(--ink-2)");
  }
  seg.forEach((v, i) => g.append("text").attr("x", v / kmPerPx).attr("y", -4).attr("text-anchor", "middle").text(i === 3 ? `${v} км` : v));
}

// Розміщення підписів міст: r праворуч (типово), l, t, b, tl, tr, bl, br
const LBL = {
  "Київ": "l", "Бровари": "r", "Біла Церква": "l", "Кам’янське": "tl", "Дніпро": "br", "Слов'янськ": "tl",
  "Краматорськ": "br", "Нікополь": "b", "Кривий Ріг": "l", "Кропивницький": "l", "Луцьк": "l", "Тернопіль": "t",
  "Хмельницький": "b", "Житомир": "l", "Сєвєродонецьк": "tr", "Мелітополь": "t", "Львів": "l",
};

export function labelPos(name, r = 5) {
  const p = LBL[name] || "r";
  const g = r + 4;
  return {
    r: [g, 4, "start"], l: [-g, 4, "end"], t: [0, -g - 2, "middle"], b: [0, g + 10, "middle"],
    tl: [-g * 0.7, -g * 0.7 - 1, "end"], tr: [g * 0.7, -g * 0.7 - 1, "start"], bl: [-g * 0.7, g * 0.7 + 9, "end"], br: [g * 0.7, g * 0.7 + 9, "start"],
  }[p];
}

/** Підписи міст. names — Set імен для підпису (або null = усі) */
export function cityLabels(layer, cities, proj, rOf, names = null, cls = "clbl") {
  const data = cities.filter((c) => !names || names.has(c.name));
  return layer.append("g").selectAll("text").data(data, (d) => d.name).join("text")
    .attr("class", cls)
    .attr("transform", (d) => { const [x, y] = proj([d.lon, d.lat]); const [dx, dy] = labelPos(d.name, rOf(d)); return `translate(${x + dx},${y + dy})`; })
    .attr("text-anchor", (d) => labelPos(d.name, rOf(d))[2])
    .text((d) => d.name);
}

/** Символ для типології: коло, квадрат, трикутник, ромб */
export function shapePath(kind, r) {
  const sym = { sv: d3.symbolCircle, sn: d3.symbolSquare, pv: d3.symbolTriangle, pn: d3.symbolDiamond, na: d3.symbolCircle }[kind] || d3.symbolCircle;
  const area = { sv: 1, sn: 0.85, pv: 0.95, pn: 0.8, na: 0.55 }[kind] * Math.PI * r * r * 1.25;
  return d3.symbol(sym, area)();
}

export function occX(layer, cities, proj, r) {
  const g = layer.append("g");
  cities.forEach((c) => {
    const [x, y] = proj([c.lon, c.lat]);
    g.append("path").attr("class", "occ-x").attr("d", `M${x - r},${y - r}L${x + r},${y + r}M${x + r},${y - r}L${x - r},${y + r}`);
  });
  return g;
}

/** Декоративні горизонталі (детермінований «рельєф»), як на топографічному аркуші */
export function drawContours(svgEl) {
  const { w, h } = box(svgEl);
  const s = d3.select(svgEl).attr("viewBox", `0 0 ${w} ${h}`).attr("preserveAspectRatio", "none");
  s.selectAll("*").remove();
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
  s.append("g").selectAll("path").data(gen(vals)).join("path").attr("d", path)
    .style("fill", "none").style("stroke", "var(--contour)").attr("stroke-width", (d, i) => (i % 5 === 0 ? 1.6 : 0.8));
}
