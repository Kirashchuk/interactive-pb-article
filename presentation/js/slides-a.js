// Слайди 1–10: титул, цикл, логіки, правила, рамка, база даних, дифузія, кошти, концентрація
/* global d3 */
import { box, cities as citiesN, esc, fmtInt, fmt1, fmtPct, fmtMln, row, tipOn, reduceMotion, animate, REGION_LABEL, SIZE_LABEL } from "./util.js";
import { baseMap, cityLabels, drawContours, OBLAST_REGION } from "./map.js";
import { openCity } from "./city.js";

const YEARS = d3.range(2015, 2026);
const cityTip = (c, extra = "") => `<b>${esc(c.name)}</b>${extra}<div class="hint">Клік — профіль міста</div>`;
const xy = (m, c) => m.proj([c.lon, c.lat]);

// ---------- 1. Титул: горизонталі + міста, що «засвічуються» за роком запуску ----------
export function title(el, data) {
  const svg = el.querySelector("#title-map");
  const yEl = el.querySelector("#title-year"), cEl = el.querySelector("#title-count");
  const cs = data.cities;
  const r = d3.scaleSqrt([100000, 3000000], [3.2, 13]);
  let m, dots, rings, timer = null, year = 2020;

  function setYear(y, pulse) {
    year = y;
    yEl.textContent = y;
    cEl.textContent = citiesN(cs.filter((c) => c.first <= y).length);
    dots.classed("on", (d) => d.first <= y).classed("new", (d) => d.first === y && pulse);
    if (pulse && !reduceMotion()) {
      cs.filter((c) => c.first === y).forEach((c) => {
        const [x, yy] = xy(m, c);
        const ring = rings.append("circle").attr("cx", x).attr("cy", yy).attr("r", r(c.pop)).attr("class", "pulse");
        ring.transition().duration(1400).ease(d3.easeCubicOut).attr("r", r(c.pop) + 26).style("opacity", 0).remove();
        setTimeout(() => ring.remove(), 1700);
      });
    }
  }
  function render() {
    drawContours(el.querySelector("#contours"));
    m = baseMap(svg, { context: false, scale: false, pad: 8 });
    rings = m.top.append("g");
    dots = m.top.append("g").selectAll("circle").data(cs).join("circle").attr("class", "tdot")
      .attr("cx", (d) => xy(m, d)[0]).attr("cy", (d) => xy(m, d)[1]).attr("r", (d) => r(d.pop));
    tipOn(dots, (d) => cityTip(d, row("перший рік", d.first)));
    dots.on("click", (e, d) => openCity(d.name));
    cityLabels(m.top, cs, m.proj, (d) => r(d.pop), new Set(["Київ", "Харків", "Одеса", "Дніпро", "Львів"]));
    setYear(year, false);
  }
  function enter() {
    if (reduceMotion()) { setYear(2020, false); return; }
    clearInterval(timer);
    let y = 2015;
    setYear(y, true);
    timer = setInterval(() => {
      y = y >= 2020 ? (y >= 2022 ? 2015 : y + 1) : y + 1; // пауза на 2020 ще два «такти»
      if (y <= 2020) setYear(y, true);
    }, 1200);
  }
  function leave() { clearInterval(timer); }
  render();
  return { render, enter, leave };
}

// ---------- 2. Цикл бюджету участі ----------
const ICONS = {
  idea: "M9 18h6M10 21h4M12 3a6 6 0 0 0-4 10.5c.8.8 1 1.5 1 2.5h6c0-1 .2-1.7 1-2.5A6 6 0 0 0 12 3z",
  submit: "M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8zM14 3v5h5M12 11v6M9 14h6",
  review: "M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM21 21l-5-5M8 11l2 2 4-4",
  vote: "M4 13h16v7H4zM8 13V5h8v8M10 9l1.5 1.5L14 8",
  fund: "M4 7c0-1.7 3.6-3 8-3s8 1.3 8 3-3.6 3-8 3-8-1.3-8-3zM4 7v5c0 1.7 3.6 3 8 3s8-1.3 8-3V7M4 12v5c0 1.7 3.6 3 8 3s8-1.3 8-3v-5",
  build: "M12 3l5 7h-3l4 6H6l4-6H7zM12 16v5M4 21h16",
};
const STEPS = [
  { k: "idea", t: "Ідея", d: "Мешканець формулює проєкт для міста чи району.", f: "Підписний поріг — зазвичай 10–20 підписів" },
  { k: "submit", t: "Подання", d: "Заявка на платформі e-DEM, «Громадський проєкт» або міській.", f: "26 981 заявка у 2015–2025 рр." },
  { k: "review", t: "Експертиза", d: "Перевірка реалістичності проєкту й кошторису.", f: "Граничний кошторис — від 75 тис. до 3 млн грн" },
  { k: "vote", t: "Голосування", d: "Мешканці обирають переможців — онлайн або змішано.", f: "1,93 млн голосів у 2019 р." },
  { k: "fund", t: "Фінансування", d: "Переможців включають до міського бюджету.", f: "6 207 переможців · 3,07 млрд грн" },
  { k: "build", t: "Реалізація", d: "Місто впроваджує проєкт; статус має бути публічним.", f: "77% реалізовано — 11 міст, «Громадський проєкт»" },
];

export function cycle(el) {
  const svg = el.querySelector("#cycle-svg"), detail = el.querySelector("#cycle-detail");
  let active = 0, auto = null, dotTimer = null, nodes, dot, geom;

  function setActive(i) {
    active = i;
    const s = STEPS[i];
    detail.innerHTML = `<span class="mono">${String(i + 1).padStart(2, "0")} · ${esc(s.t)}</span><b>${esc(s.d)}</b><em>${esc(s.f)}</em>`;
    nodes?.classed("on", (d, k) => k === i);
  }
  function render() {
    const { w, h } = box(svg);
    const s = d3.select(svg).attr("viewBox", `0 0 ${w} ${h}`);
    s.selectAll("*").remove();
    const R = Math.min(w * 0.4, h * 0.36), cx = w / 2, cy = h / 2 + 4, nr = Math.max(26, Math.min(48, R * 0.24));
    geom = { R, cx, cy };
    const ang = (i) => (-90 + i * 60) * Math.PI / 180;
    s.append("defs").append("marker").attr("id", "cyc-arrow").attr("viewBox", "0 0 10 10").attr("refX", 7).attr("refY", 5)
      .attr("markerWidth", 7).attr("markerHeight", 7).attr("orient", "auto-start-reverse")
      .append("path").attr("d", "M0 0L10 5L0 10z").style("fill", "var(--faint)");
    s.append("circle").attr("cx", cx).attr("cy", cy).attr("r", R).style("fill", "none").style("stroke", "var(--line-2)").attr("stroke-width", nr * 1.3);
    const da = (nr + 8) / R;
    for (let i = 0; i < 6; i++) {
      const a0 = ang(i) + da, a1 = ang(i + 1) - da;
      s.append("path").attr("d", `M${cx + R * Math.cos(a0)},${cy + R * Math.sin(a0)}A${R},${R} 0 0 1 ${cx + R * Math.cos(a1)},${cy + R * Math.sin(a1)}`)
        .style("fill", "none").style("stroke", "var(--faint)").attr("stroke-width", 1.4).attr("marker-end", "url(#cyc-arrow)");
    }
    dot = s.append("circle").attr("r", 5).style("fill", "var(--amber)");
    nodes = s.append("g").selectAll("g").data(STEPS).join("g").attr("class", "cyc-node").attr("tabindex", 0).attr("role", "button")
      .attr("aria-label", (d) => d.t)
      .attr("transform", (d, i) => `translate(${cx + R * Math.cos(ang(i))},${cy + R * Math.sin(ang(i))})`);
    nodes.append("circle").attr("r", nr);
    nodes.append("path").attr("d", (d) => ICONS[d.k]).attr("transform", `translate(${-nr * 0.42},${-nr * 0.42}) scale(${nr * 0.84 / 24})`);
    nodes.append("text").attr("class", "cyc-num").attr("y", -nr - 8).attr("text-anchor", "middle").text((d, i) => String(i + 1).padStart(2, "0"));
    nodes.append("text").attr("class", "cyc-lbl").attr("text-anchor", (d, i) => (i === 0 || i === 3 ? "middle" : i < 3 ? "start" : "end"))
      .attr("x", (d, i) => (i === 0 || i === 3 ? 0 : i < 3 ? nr + 10 : -nr - 10))
      .attr("y", (d, i) => (i === 0 ? -nr - 26 : i === 3 ? nr + 24 : 5)).text((d) => d.t);
    nodes.on("click keydown", (e, d) => {
      if (e.type === "keydown" && e.key !== "Enter" && e.key !== " ") return;
      e.preventDefault(); clearInterval(auto); setActive(STEPS.indexOf(d));
    });
    const c = s.append("g").attr("transform", `translate(${cx},${cy})`).attr("class", "cyc-center");
    c.append("text").attr("y", -6).attr("text-anchor", "middle").attr("class", "cyc-c1").text("Річний цикл");
    c.append("text").attr("y", 18).attr("text-anchor", "middle").attr("class", "cyc-c2").text("бюджету участі");
    setActive(active);
    moveDot(0);
  }
  function moveDot(t) {
    if (!geom) return;
    const a = -Math.PI / 2 + (t / 9000) * 2 * Math.PI;
    dot.attr("cx", geom.cx + geom.R * Math.cos(a)).attr("cy", geom.cy + geom.R * Math.sin(a));
  }
  function enter() {
    if (reduceMotion()) return;
    dotTimer = d3.timer((t) => moveDot(t));
    clearInterval(auto);
    auto = setInterval(() => setActive((active + 1) % 6), 1500);
  }
  function leave() { dotTimer?.stop(); clearInterval(auto); }
  render();
  return { render, enter, leave };
}

// ---------- 3. Трикутник логік (Cabannes, Lipietz 2018) ----------
const LOGICS = [
  { t: "Політична", d: "Учасники самі встановлюють правила; бюджет участі перерозподіляє владу й ресурси на користь громади." },
  { t: "Доброврядна", d: "Участь підвищує прозорість і довіру до влади; правила й рамки задає місцева влада." },
  { t: "Технократична", d: "Участь як управлінський інструмент: процедура, експертиза, ефективність витрат." },
];
export function logics(el) {
  const svg = el.querySelector("#logics-svg");
  const vis = svg.parentNode;
  let card = vis.querySelector(".logic-card");
  if (!card) { card = document.createElement("div"); card.className = "logic-card"; vis.appendChild(card); }
  let sel = 3;
  const UA = { t: "Великі міста України", d: "Правила задають положення міських рад, фонд невеликий, вибір — голосуванням: модель ближча до доброврядної логіки." };
  function show(i) {
    sel = i;
    const L = i === 3 ? UA : LOGICS[i];
    card.innerHTML = `<b>${esc(L.t)}</b><span>${esc(L.d)}</span>`;
    d3.select(svg).selectAll(".lg-v").classed("on", (d, k) => k === i);
    d3.select(svg).select(".lg-ua").classed("on", i === 3);
  }
  function render() {
    const { w, h } = box(svg);
    const s = d3.select(svg).attr("viewBox", `0 0 ${w} ${h}`);
    s.selectAll("*").remove();
    show(sel);
    // На вузькому екрані картка стоїть під графіком і не забирає його висоту
    const cardH = getComputedStyle(card).position === "absolute" ? card.offsetHeight + 16 : 0;
    const narrow = w < 560;
    const side = Math.min(w * (narrow ? 0.8 : 0.62), (h - cardH - (narrow ? 130 : 110)) / 0.866);
    const th = side * 0.866, cx = w / 2, top = 56 + (h - cardH - 110 - th) / 2;
    const V = [[cx, top], [cx - side / 2, top + th], [cx + side / 2, top + th]];
    const bary = (a, b, c) => [a * V[0][0] + b * V[1][0] + c * V[2][0], a * V[0][1] + b * V[1][1] + c * V[2][1]];
    s.append("path").attr("d", `M${V[0]}L${V[1]}L${V[2]}Z`).style("fill", "var(--surface)").style("stroke", "var(--ink-2)").attr("stroke-width", 1.4);
    const grid = s.append("g").style("stroke", "var(--line)").attr("stroke-width", 1);
    [0.25, 0.5, 0.75].forEach((t) => {
      grid.append("line").attr("x1", bary(t, 1 - t, 0)[0]).attr("y1", bary(t, 1 - t, 0)[1]).attr("x2", bary(t, 0, 1 - t)[0]).attr("y2", bary(t, 0, 1 - t)[1]);
      grid.append("line").attr("x1", bary(1 - t, t, 0)[0]).attr("y1", bary(1 - t, t, 0)[1]).attr("x2", bary(0, t, 1 - t)[0]).attr("y2", bary(0, t, 1 - t)[1]);
      grid.append("line").attr("x1", bary(1 - t, 0, t)[0]).attr("y1", bary(1 - t, 0, t)[1]).attr("x2", bary(0, 1 - t, t)[0]).attr("y2", bary(0, 1 - t, t)[1]);
    });
    const vg = s.append("g").selectAll("g").data(LOGICS).join("g").attr("class", "lg-v").attr("tabindex", 0).attr("role", "button")
      .attr("aria-label", (d) => `${d.t} логіка`).attr("transform", (d, i) => `translate(${V[i]})`);
    vg.append("circle").attr("r", 11);
    // Підписи нижніх вершин: збоку на широкому екрані, під вершиною — на вузькому
    const anchor = (i) => (i === 0 ? "middle" : narrow ? (i === 1 ? "start" : "end") : i === 1 ? "end" : "start");
    const lx = (i) => (i === 0 ? 0 : narrow ? (i === 1 ? -12 : 12) : i === 1 ? -18 : 18);
    vg.append("text").attr("class", "lg-t").attr("text-anchor", (d, i) => anchor(i))
      .attr("x", (d, i) => lx(i)).attr("y", (d, i) => (i === 0 ? -22 : narrow ? 30 : 6)).text((d) => d.t)
      .style("font-size", narrow ? "13px" : null);
    vg.append("text").attr("class", "lg-s").attr("text-anchor", (d, i) => anchor(i))
      .attr("x", (d, i) => lx(i)).attr("y", (d, i) => (i === 0 ? -40 : narrow ? 47 : 24))
      .text((d, i) => ["правила пишуть учасники", "довіра та прозорість", "процедура й ефективність"][i])
      .style("display", (d, i) => (narrow && i > 0 ? "none" : null));
    vg.on("click keydown", (e, d) => { if (e.type === "keydown" && e.key !== "Enter" && e.key !== " ") return; e.preventDefault(); show(LOGICS.indexOf(d)); });
    const p = bary(0.13, 0.62, 0.25);
    const ua = s.append("g").attr("class", "lg-ua").attr("tabindex", 0).attr("role", "button").attr("aria-label", UA.t).attr("transform", `translate(${p})`);
    ua.append("circle").attr("class", "halo").attr("r", 22);
    ua.append("circle").attr("r", 9);
    ua.append("text").attr("x", 16).attr("y", -12).text("Україна");
    ua.on("click keydown", (e) => { if (e.type === "keydown" && e.key !== "Enter" && e.key !== " ") return; e.preventDefault(); show(3); });
    show(sel);
  }
  render();
  return { render };
}

// ---------- 4. Правила: граничні кошториси і платформи ----------
export function rules(el, data) {
  const svg = el.querySelector("#caps-svg"), psvg = el.querySelector("#platforms-svg");
  function render() {
    const { w, h } = box(svg);
    const s = d3.select(svg).attr("viewBox", `0 0 ${w} ${h}`);
    s.selectAll("*").remove();
    const m = { t: 14, r: 30, b: 28, l: Math.min(150, w * 0.24) };
    const x = d3.scaleLog([10, 3500], [m.l, w - m.r]);
    const y = d3.scaleBand(data.caps.map((d) => d.city), [m.t, h - m.b]).padding(0.38);
    s.append("g").attr("class", "ax grid").attr("transform", `translate(0,${h - m.b})`)
      .call(d3.axisBottom(x).tickValues([10, 30, 100, 300, 1000, 3000]).tickSize(-(h - m.t - m.b))
        .tickFormat((v) => (v >= 1000 ? `${v / 1000} млн` : `${v} тис.`)));
    const rows = s.append("g").selectAll("g").data(data.caps).join("g").attr("transform", (d) => `translate(0,${y(d.city)})`);
    rows.append("text").attr("class", "cap-city").attr("x", m.l - 12).attr("y", y.bandwidth() / 2 + 5).attr("text-anchor", "end")
      .text((d) => d.city + (d.year ? `, ${d.year}` : ""));
    const bands = rows.selectAll("rect").data((d) => d.bands.map((b, i) => ({ ...b, i, city: d.city }))).join("rect")
      .attr("x", (b) => x(Math.max(10, b.lo))).attr("width", (b) => x(b.hi) - x(Math.max(10, b.lo)) - 1)
      .attr("y", 0).attr("height", y.bandwidth()).attr("rx", 3)
      .style("fill", (b) => (b.i ? "var(--q3)" : "var(--q2)"));
    tipOn(bands, (b) => `<b>${esc(b.city)}</b>${row(b.label, b.lo ? `${fmtInt(b.lo)}–${fmtInt(b.hi)} тис. грн` : `до ${fmtInt(b.hi)} тис. грн`)}`);
    const hiTxt = (b) => (b.hi >= 1000 ? fmt1(b.hi / 1000) + " млн" : `${b.hi} тис.`);
    rows.selectAll("text.bl").data((d) => d.bands.map((b, i) => ({ ...b, i }))).join("text").attr("class", "bl")
      .attr("x", (b) => x(b.hi) - 8).attr("y", y.bandwidth() / 2 + 4).attr("text-anchor", "end")
      .text((b) => `${b.label} ≤ ${hiTxt(b)}`)
      .each(function (b) {
        const room = x(b.hi) - x(Math.max(10, b.lo)) - 14;
        if (this.getComputedTextLength() > room) this.textContent = `≤ ${hiTxt(b)}`;
        if (this.getComputedTextLength() > room) this.textContent = "";
      });
    // Розмах: 3 млн (Київ, Львів) проти 75 тис. (Мелітополь)
    const ann = s.append("g").attr("class", "annot-g");
    ann.append("text").attr("class", "annot").attr("x", w - m.r).attr("y", m.t - 2).attr("text-anchor", "end").text("3 млн ÷ 75 тис. = ×40");
    // Платформи
    const pw = box(psvg).w, ph = box(psvg).h;
    const p = d3.select(psvg).attr("viewBox", `0 0 ${pw} ${ph}`);
    p.selectAll("*").remove();
    const P = [{ t: "«Громадський проєкт»", n: 16, c: "var(--accent)" }, { t: "e-DEM", n: 15, c: "var(--rg-C)" }, { t: "власні · Івано-Франківськ, Одеса, Харків", n: 3, c: "var(--amber)" }];
    const px = d3.scaleLinear([0, 34], [0, pw]);
    let acc = 0;
    P.forEach((d) => { d.x0 = acc; acc += d.n; });
    const bh = Math.min(34, ph * 0.45);
    p.selectAll("rect").data(P).join("rect").attr("x", (d) => px(d.x0)).attr("width", (d) => px(d.n) - 2).attr("y", 0).attr("height", bh).attr("rx", 4).style("fill", (d) => d.c);
    p.selectAll("text.n").data(P).join("text").attr("class", "pl-n").attr("x", (d) => px(d.x0) + 10).attr("y", bh / 2 + 5).text((d) => d.n);
    p.selectAll("text.t").data(P).join("text").attr("class", "pl-t")
      .attr("x", (d, i) => (i === 2 ? pw : px(d.x0))).attr("text-anchor", (d, i) => (i === 2 ? "end" : "start")).attr("y", bh + 18).text((d) => d.t);
  }
  render();
  return { render };
}

// ---------- 6. Рамка: 35 міст ----------
export function frame(el, data) {
  const svg = el.querySelector("#frame-map"), legend = el.querySelector("#frame-legend");
  const cs = data.cities;
  let mode = "region";
  const r = d3.scaleSqrt([99000, 2952301], [4, 24]);
  const SIZE_C = { s1: "var(--q1)", s2: "var(--q2)", s3: "var(--q3)", s4: "var(--q4)" };
  let dots, tint;
  const color = (c) => (mode === "region" ? `var(--rg-${c.region})` : SIZE_C[c.size]);
  function paint() {
    animate(dots, (s) => s.style("fill", color), { duration: 450 });
    animate(tint, (s) => s.style("fill-opacity", mode === "region" ? 0.13 : 0), { duration: 450 });
    const items = mode === "region"
      ? ["W", "C", "SE"].map((k) => [`var(--rg-${k})`, `${REGION_LABEL[k]} · ${cs.filter((c) => c.region === k).length}`])
      : ["s1", "s2", "s3", "s4"].map((k) => [SIZE_C[k], `${SIZE_LABEL[k]} · ${cs.filter((c) => c.size === k).length}`]);
    legend.innerHTML = `<span class="ttl">${mode === "region" ? "Макрорегіон · міст" : "Людність · міст"}</span>` +
      items.map(([c, t]) => `<span><i style="background:${c}"></i>${esc(t)}</span>`).join("") +
      `<span><i style="background:none;border:2px dashed var(--alert)"></i>окупація після 24.02.2022</span>`;
  }
  function render() {
    const m = baseMap(svg, {});
    tint = m.top.append("g").selectAll("path").data(m.obl.data().filter((d) => OBLAST_REGION[d.properties.name.replace(" область", "")]))
      .join("path").attr("d", m.path).style("pointer-events", "none")
      .style("fill", (d) => `var(--rg-${OBLAST_REGION[d.properties.name]})`).style("fill-opacity", 0);
    const sorted = cs.slice().sort((a, b) => b.pop - a.pop);
    dots = m.top.append("g").selectAll("circle").data(sorted).join("circle").attr("class", "city")
      .attr("cx", (d) => xy(m, d)[0]).attr("cy", (d) => xy(m, d)[1]).attr("r", (d) => r(d.pop))
      .style("stroke", "var(--surface)").attr("stroke-width", 1.4).style("fill-opacity", 0.9).style("fill", color);
    m.top.append("g").selectAll("circle").data(cs.filter((c) => c.occupied)).join("circle")
      .attr("cx", (d) => xy(m, d)[0]).attr("cy", (d) => xy(m, d)[1]).attr("r", (d) => r(d.pop) + 4)
      .style("fill", "none").style("stroke", "var(--alert)").attr("stroke-width", 1.8).attr("stroke-dasharray", "3 2").style("pointer-events", "none");
    tipOn(dots, (d) => cityTip(d, row("людність", fmtInt(d.pop)) + row("макрорегіон", REGION_LABEL[d.region]) + row("перший рік БУ", d.first)));
    dots.on("click", (e, d) => openCity(d.name));
    cityLabels(m.top, cs, m.proj, (d) => r(d.pop), m.w > 640 ? null : new Set(cs.filter((c) => c.pop > 400000).map((c) => c.name)))
      .classed("small", (d) => d.pop < 200000);
    paint();
  }
  el.querySelectorAll("[data-frame]").forEach((b) => b.addEventListener("click", () => {
    mode = b.dataset.frame;
    el.querySelectorAll("[data-frame]").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
    paint();
  }));
  render();
  return { render };
}

// ---------- 7. Заповненість бази «місто–рік» ----------
export function completeness(el, data) {
  const svg = el.querySelector("#compl-svg"), legend = el.querySelector("#compl-legend");
  const rows = data.cities.slice().sort((a, b) => a.first - b.first || a.name.localeCompare(b.name, "uk"));
  const FILL = ["var(--surface)", "var(--q1)", "var(--q2)", "var(--q4)"];
  legend.innerHTML = `<span class="ttl">Показників у позиції</span>` +
    [[3, "усі три"], [2, "два"], [1, "один"]].map(([k, t]) => `<span><i style="background:${FILL[k]};border-radius:2px"></i>${t}</span>`).join("") +
    `<span><i style="background:var(--surface);border:1px solid var(--faint);border-radius:2px"></i>не підтверджено</span>` +
    `<span><i style="background:var(--surface-2);border-radius:2px;opacity:.6"></i>до запуску</span>` +
    `<span><i style="background:var(--alert-soft);border:1px solid var(--alert);border-radius:2px"></i>окупація</span>`;
  const cellInfo = (c, y) => {
    const i = (y - 2015) * 3, mk = c.mask.slice(i, i + 3), n = [...mk].filter((x) => x === "1").length;
    return { mk, n, pre: y < c.first, occ: c.occupied && y >= 2022 };
  };
  function render() {
    const { w, h } = box(svg);
    const s = d3.select(svg).attr("viewBox", `0 0 ${w} ${h}`);
    s.selectAll("*").remove();
    const m = { t: 24, r: 34, b: 26, l: Math.min(132, w * 0.3) };
    const x = d3.scaleBand(YEARS, [m.l, w - m.r]).paddingInner(0.12);
    const y = d3.scaleBand(rows.map((c) => c.name), [m.t, h - m.b]).paddingInner(0.16);
    s.append("g").selectAll("text").data(YEARS).join("text").attr("class", "vlbl muted").attr("x", (d) => x(d) + x.bandwidth() / 2)
      .attr("y", m.t - 9).attr("text-anchor", "middle").text((d) => (x.bandwidth() < 40 ? "’" + String(d).slice(2) : d));
    const rg = s.append("g").selectAll("g").data(rows).join("g").attr("transform", (c) => `translate(0,${y(c.name)})`)
      .attr("class", "hm-row").style("cursor", "pointer").on("click", (e, c) => openCity(c.name));
    rg.append("rect").attr("x", m.l - 10).attr("width", 3).attr("height", y.bandwidth()).style("fill", (c) => `var(--rg-${c.region})`);
    rg.append("text").attr("class", "hm-lbl").attr("x", m.l - 14).attr("y", y.bandwidth() / 2 + 4).attr("text-anchor", "end")
      .style("font-size", Math.min(12, y.bandwidth() * 0.9) + "px").text((c) => c.name);
    const cells = rg.selectAll("rect.cell").data((c) => YEARS.map((yy) => ({ c, y: yy, ...cellInfo(c, yy) }))).join("rect")
      .attr("class", "cell").attr("x", (d) => x(d.y)).attr("width", x.bandwidth()).attr("height", y.bandwidth()).attr("rx", 2)
      .style("fill", (d) => (d.pre ? "var(--surface-2)" : d.occ && !d.n ? "var(--alert-soft)" : FILL[d.n]))
      .style("opacity", (d) => (d.pre ? 0.55 : 1))
      .style("stroke", (d) => (d.pre ? "none" : d.occ && !d.n ? "var(--alert)" : d.n ? "none" : "var(--line)"))
      .attr("stroke-width", 1);
    tipOn(cells, (d) => {
      const v = d.c.y[d.y];
      let note = "";
      if (d.y === 2022 && d.mk === "111") note = "повтор циклу 2021 р. — вилучено з підсумків";
      else if (d.mk[2] === "1" && v[2] == null) note = "сума не входить до документованих коштів статті";
      else if (d.pre) note = "до першого циклу";
      else if (d.occ && !d.n) note = "окупація";
      else if (!d.n) note = "немає підтверджених даних";
      return `<b>${esc(d.c.name)} · ${d.y}</b>${row("заявки", d.mk[0] === "1" ? (v[0] != null ? fmtInt(v[0]) : "є") : "—")}${row("переможці", d.mk[1] === "1" ? (v[1] != null ? fmtInt(v[1]) : "є") : "—")}${row("сума", d.mk[2] === "1" ? (v[2] != null ? fmtMln(v[2]) + " грн" : "є") : "—")}${note ? `<div class="hint">${esc(note)}</div>` : ""}`;
    });
    rg.append("text").attr("class", "vlbl muted").attr("x", w - m.r + 8).attr("y", y.bandwidth() / 2 + 4).style("font-size", "10.5px")
      .text((c) => YEARS.filter((yy) => cellInfo(c, yy).n === 3).length || "");
    s.append("text").attr("class", "vlbl muted").attr("x", w - m.r + 8).attr("y", m.t - 9).style("font-size", "10px").text("Σ");
    s.append("g").selectAll("text").data(YEARS).join("text").attr("class", "vlbl").attr("x", (d) => x(d) + x.bandwidth() / 2)
      .attr("y", h - 8).attr("text-anchor", "middle").style("font-size", "11px")
      .text((yy) => rows.filter((c) => cellInfo(c, yy).n === 3).length);
    s.append("text").attr("class", "vlbl muted").attr("x", m.l - 14).attr("y", h - 8).attr("text-anchor", "end").style("font-size", "10.5px").text("усі три показники");
  }
  render();
  return { render };
}

// ---------- 8. Дифузія ----------
export function diffusion(el, data) {
  const svg = el.querySelector("#diff-map"), strip = el.querySelector("#diff-strip");
  const yearEl = el.querySelector("#diff-year"), big = el.querySelector("#diff-big"), bigCap = el.querySelector("#diff-big-cap");
  const regEl = el.querySelector("#diff-regions"), play = el.querySelector("#diff-play");
  const cs = data.cities, A = data.annual;
  const r = d3.scaleSqrt([99000, 2952301], [4.5, 13]);
  let year = 2017, m, dots, xs, timer = null, played = false;

  el.querySelector("#diff-legend").innerHTML =
    `<span><i style="background:var(--amber)"></i>запуск цього року</span><span><i style="background:var(--accent)"></i>переможці цього року</span>` +
    `<span><i style="background:var(--surface);border:2px solid var(--accent)"></i>без переможців</span>` +
    `<span><i style="background:none;border:1.5px dashed var(--faint)"></i>ще не запущено</span><span><i class="x-ico"></i>окупація</span>`;

  const state = (c, y) => {
    if (c.first > y) return "pre";
    if (c.occupied && y >= 2022) return "occ";
    if (c.first === y) return "new";
    return c.y[y][1] ? "win" : "nowin";
  };
  function setYear(y) {
    year = y;
    yearEl.textContent = y;
    const n = cs.filter((c) => c.first <= y).length;
    big.innerHTML = `${Math.round((n / 35) * 100)}<small>%</small>`;
    bigCap.textContent = `міст запустили бюджет участі до ${y} р. включно — ${n} з 35`;
    regEl.innerHTML = ["W", "C", "SE"].map((k) => {
      const all = cs.filter((c) => c.region === k), on = all.filter((c) => c.first <= y).length;
      return `<div class="rb"><span>${REGION_LABEL[k]}</span><div class="track"><i style="width:${(on / all.length) * 100}%;background:var(--rg-${k})"></i></div><b class="mono">${on}/${all.length}</b></div>`;
    }).join("");
    if (!dots) return;
    dots.attr("class", (c) => `city st-${state(c, y)}`).attr("r", (c) => (state(c, y) === "pre" ? r(c.pop) * 0.55 : r(c.pop)));
    xs.style("display", (c) => (state(c, y) === "occ" ? null : "none"));
    m.top.selectAll(".clbl").remove();
    cityLabels(m.top, cs, m.proj, (c) => r(c.pop), new Set(cs.filter((c) => c.first === y).map((c) => c.name)), "clbl new-lbl");
    drawStrip();
  }
  function drawStrip() {
    const { w, h } = box(strip);
    const s = d3.select(strip).attr("viewBox", `0 0 ${w} ${h}`);
    s.selectAll("*").remove();
    const mg = { t: 16, r: 8, b: 20, l: 8 };
    const x = d3.scaleBand(YEARS, [mg.l, w - mg.r]).padding(0.24);
    const yS = d3.scaleLinear([0, 35], [h - mg.b, mg.t]);
    const g = s.append("g").selectAll("g").data(A).join("g").attr("class", "sb").style("cursor", "pointer")
      .attr("role", "button").attr("tabindex", 0).attr("aria-label", (d) => `${d.year}: ${d.citiesWin} міст із переможцями`)
      .on("click keydown", (e, d) => { if (e.type === "keydown" && e.key !== "Enter" && e.key !== " ") return; e.preventDefault(); stop(); setYear(d.year); });
    g.append("rect").attr("x", (d) => x(d.year) - 2).attr("width", x.bandwidth() + 4).attr("y", 0).attr("height", h).style("fill", "transparent");
    g.append("rect").attr("x", (d) => x(d.year)).attr("width", x.bandwidth()).attr("y", (d) => yS(d.citiesWin)).attr("height", (d) => yS(0) - yS(d.citiesWin)).attr("rx", 2)
      .style("fill", (d) => (d.year === year ? "var(--accent)" : d.year >= 2022 ? "var(--alert)" : "var(--q2)")).style("opacity", (d) => (d.year === year ? 1 : 0.55));
    g.append("text").attr("class", "vlbl").attr("x", (d) => x(d.year) + x.bandwidth() / 2).attr("y", (d) => yS(d.citiesWin) - 4).attr("text-anchor", "middle")
      .style("font-size", "10.5px").text((d) => d.citiesWin);
    g.append("text").attr("class", "vlbl muted").attr("x", (d) => x(d.year) + x.bandwidth() / 2).attr("y", h - 5).attr("text-anchor", "middle")
      .style("font-size", "10.5px").style("font-weight", (d) => (d.year === year ? 700 : 500)).text((d) => d.year);
    const line = d3.line().x((d) => x(d.year) + x.bandwidth() / 2).y((d) => yS(d.launched)).curve(d3.curveStepAfter);
    s.append("path").datum(A).attr("d", line).style("fill", "none").style("stroke", "var(--ink-2)").attr("stroke-width", 1.4).attr("stroke-dasharray", "4 3");
    s.append("text").attr("class", "annot").attr("x", x(2024)).attr("y", yS(35) - 4).attr("text-anchor", "middle").style("font-size", "11px").text("запущено, наростаючим");
    s.append("text").attr("class", "annot").attr("x", x(2015)).attr("y", 11).style("font-size", "11px").text("міст із переможцями за рік");
  }
  function render() {
    m = baseMap(svg, { padT: 10 });
    dots = m.top.append("g").selectAll("circle").data(cs.slice().sort((a, b) => b.pop - a.pop)).join("circle")
      .attr("cx", (c) => xy(m, c)[0]).attr("cy", (c) => xy(m, c)[1]);
    tipOn(dots, (c) => {
      const v = c.y[year];
      return cityTip(c, row("перший рік", c.first) + row(`${year}: заявки`, v[0] ?? "—") + row(`${year}: переможці`, v[1] ?? "—"));
    });
    dots.on("click", (e, c) => openCity(c.name));
    xs = m.top.append("g").selectAll("path").data(cs.filter((c) => c.occupied)).join("path").attr("class", "occ-x")
      .attr("d", (c) => { const [x, y] = xy(m, c), k = 7; return `M${x - k},${y - k}L${x + k},${y + k}M${x + k},${y - k}L${x - k},${y + k}`; });
    setYear(year);
  }
  function stop() { clearInterval(timer); timer = null; play.querySelector("span").textContent = "Відтворити"; }
  function run(from, to) {
    stop();
    let y = from;
    setYear(y);
    play.querySelector("span").textContent = "Пауза";
    timer = setInterval(() => { y += 1; if (y > to) { stop(); return; } setYear(y); }, reduceMotion() ? 400 : 1000);
  }
  play.addEventListener("click", () => (timer ? stop() : run(year >= 2025 ? 2015 : 2015, 2025)));
  render();
  return {
    render,
    enter() { if (!played && !reduceMotion()) { played = true; run(2015, 2017); } },
    leave: stop,
  };
}

// ---------- 9. Кошти, охоплення, частка за роками ----------
export function funds(el, data) {
  const svg = el.querySelector("#funds-svg");
  const A = data.annual;
  let price = "real", metric = "amount";
  function render() {
    const { w, h } = box(svg);
    const s = d3.select(svg).attr("viewBox", `0 0 ${w} ${h}`);
    s.selectAll("*").remove();
    const mg = { t: 70, r: 12, b: 26, l: 48 };
    const x = d3.scaleBand(YEARS, [mg.l, w - mg.r]).padding(0.26);
    const val = (d) => (metric === "amount" ? d[price] : metric === "cities" ? d.citiesWin : d.docShare);
    const ghost = (d) => (metric === "amount" ? d[price === "real" ? "nominal" : "real"] : null);
    const max = metric === "amount" ? 760 : metric === "cities" ? 35 : 0.36;
    const y = d3.scaleLinear([0, max], [h - mg.b, mg.t]);
    // Смуга воєнних років
    s.append("rect").attr("x", x(2022) - x.step() * x.padding() / 2).attr("width", w - mg.r - x(2022) + x.step() * x.padding() / 2)
      .attr("y", 24).attr("height", h - mg.b - 24).style("fill", "var(--alert-soft)").style("opacity", 0.55);
    s.append("text").attr("class", "annot").attr("x", x(2022)).attr("y", 40).style("fill", "var(--alert)").style("font-weight", 600).text("повномасштабна війна");
    const fmtY = metric === "share" ? (v) => String(v.toFixed(2)).replace(".", ",") : (v) => fmtInt(v);
    s.append("g").attr("class", "ax grid").attr("transform", `translate(${mg.l},0)`)
      .call(d3.axisLeft(y).ticks(5).tickSize(-(w - mg.l - mg.r)).tickFormat(fmtY));
    s.append("g").attr("class", "ax").attr("transform", `translate(0,${h - mg.b})`).call(d3.axisBottom(x).tickSize(0).tickPadding(8));
    if (metric === "cities") {
      s.append("line").attr("x1", mg.l).attr("x2", w - mg.r).attr("y1", y(35)).attr("y2", y(35)).attr("class", "annot-line");
      s.append("text").attr("class", "annot").attr("x", mg.l + 4).attr("y", y(35) - 5).text("рамка — 35 міст");
    }
    const bars = s.append("g").selectAll("g").data(A).join("g");
    const prim = bars.append("rect").attr("x", (d) => x(d.year)).attr("width", x.bandwidth()).attr("rx", 3)
      .attr("y", y(0)).attr("height", 0)
      .style("fill", (d) => (d.year >= 2022 ? "var(--alert)" : "var(--accent)"));
    animate(prim, (t) => t.attr("y", (d) => y(val(d) || 0)).attr("height", (d) => y(0) - y(val(d) || 0)),
      { duration: 600, delay: (d, i) => i * 25, maxDelay: 280 });
    if (metric === "amount") {
      bars.append("rect").attr("x", (d) => x(d.year) + 1).attr("width", x.bandwidth() - 2)
        .attr("y", (d) => y(ghost(d) || 0)).attr("height", (d) => y(0) - y(ghost(d) || 0)).style("pointer-events", "none")
        .style("fill", "none").style("stroke", "var(--ink)").style("stroke-opacity", 0.55).attr("stroke-width", 1.4).attr("stroke-dasharray", "4 3");
    }
    tipOn(prim, (d) => `<b>${d.year}</b>${row("кошти, ціни 2021", fmtMln(d.real))}${row("кошти, номінально", fmtMln(d.nominal))}${row("міст із переможцями", d.citiesWin)}${row("% видатків 35 міст", d.docShare == null ? "—" : fmtPct(d.docShare, 3))}`);
    bars.append("text").attr("class", "vlbl").attr("x", (d) => x(d.year) + x.bandwidth() / 2).attr("y", (d) => y(val(d) || 0) - 6).attr("text-anchor", "middle")
      .text((d) => {
        const v = val(d);
        if (v == null) return metric === "share" ? "н/д" : "";
        if (metric === "share") return String(v < 0.1 ? v.toFixed(3) : v.toFixed(2)).replace(".", ",");
        return fmtInt(Math.round(v));
      });
    if (metric === "amount") {
      // Підсумки — як у статті (рис. 2): 3 381 і 96 млн грн у цінах 2021 р.
      const pre = price === "real" ? 3381 : d3.sum(A.filter((d) => d.year <= 2021), (d) => d.nominal);
      const post = price === "real" ? 96 : d3.sum(A.filter((d) => d.year >= 2023), (d) => d.nominal);
      const brk = (y0, y1, txt, yy) => {
        const x0 = x(y0), x1 = x(y1) + x.bandwidth();
        s.append("path").attr("d", `M${x0},${yy + 6}V${yy}H${x1}V${yy + 6}`).style("fill", "none").style("stroke", "var(--ink-2)");
        s.append("text").attr("class", "vlbl").attr("x", (x0 + x1) / 2).attr("y", yy - 6).attr("text-anchor", "middle").text(txt);
      };
      const top = (ys) => y(d3.max(A.filter((d) => ys(d.year)), (d) => d[price])) - 26;
      brk(2015, 2021, `Σ ${fmtInt(Math.round(pre))} млн грн`, top((yy) => yy <= 2021));
      brk(2023, 2025, price === "real" ? `Σ ${fmtInt(post)} млн · 2,8% довоєнного` : `Σ ${fmt1(post)} млн грн`, top((yy) => yy >= 2023));
      s.append("text").attr("class", "annot").attr("x", mg.l).attr("y", 14)
        .text(price === "real" ? "Стовпчики — ціни 2021 р.; пунктир — номінально" : "Стовпчики — номінально; пунктир — ціни 2021 р.");
    }
    s.append("text").attr("class", "annot").attr("x", x(2022) + x.bandwidth() / 2).attr("y", y(0) - 22).attr("text-anchor", "middle").style("font-size", "10.5px").text("нових відборів");
    s.append("text").attr("class", "annot").attr("x", x(2022) + x.bandwidth() / 2).attr("y", y(0) - 9).attr("text-anchor", "middle").style("font-size", "10.5px").text("немає");
  }
  el.querySelectorAll("[data-funds]").forEach((b) => b.addEventListener("click", () => {
    price = b.dataset.funds;
    el.querySelectorAll("[data-funds]").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
    render();
  }));
  el.querySelectorAll("[data-fundsm]").forEach((b) => b.addEventListener("click", () => {
    metric = b.dataset.fundsm;
    el.querySelectorAll("[data-fundsm]").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
    el.querySelectorAll("[data-funds]").forEach((x) => { x.disabled = metric !== "amount"; });
    render();
  }));
  render();
  return { render };
}

// ---------- 10. Концентрація: деревоподібна діаграма ----------
export function treemap(el, data) {
  const svg = el.querySelector("#tree-svg");
  const tot = data.totals.amountMln;
  const byName = new Map(data.cities.map((c) => [c.name, c]));
  const items = data.totals.cityTotals.filter((d) => d.mln > 0).map((d) => ({ ...d, c: byName.get(d.name), pct: (d.mln / tot) * 100 }));
  el.querySelector("#top5").innerHTML = items.slice(0, 5).map((d) =>
    `<li><span>${esc(d.name)}</span><i style="width:${d.pct * 3}%;background:var(--rg-${d.c.region})"></i><b class="mono">${fmt1(d.pct)}%</b></li>`).join("");
  el.querySelector("#tree-legend").innerHTML = ["W", "C", "SE"].map((k) => `<span><i style="background:var(--rg-${k});border-radius:2px"></i>${REGION_LABEL[k]}</span>`).join("");
  function render() {
    const { w, h } = box(svg);
    const s = d3.select(svg).attr("viewBox", `0 0 ${w} ${h}`);
    s.selectAll("*").remove();
    const root = d3.hierarchy({ children: items }).sum((d) => d.mln || 0).sort((a, b) => b.value - a.value);
    d3.treemap().size([w, h]).paddingInner(3).round(true).tile(d3.treemapSquarify.ratio(1.25))(root);
    const g = s.append("g").selectAll("g").data(root.leaves()).join("g").attr("transform", (d) => `translate(${d.x0},${d.y0})`)
      .attr("class", "tm").style("cursor", "pointer").on("click", (e, d) => openCity(d.data.name));
    g.append("rect").attr("width", (d) => d.x1 - d.x0).attr("height", (d) => d.y1 - d.y0).attr("rx", 3)
      .style("fill", (d) => `var(--rg-${d.data.c.region})`).style("fill-opacity", (d, i) => (i < 5 ? 1 : 0.62));
    tipOn(g, (d) => `<b>${esc(d.data.name)}</b>${row("кошти 2015–2025", fmtMln(d.data.mln) + " грн")}${row("частка", fmt1(d.data.pct) + "%")}<div class="hint">Клік — профіль міста</div>`);
    const big = (d) => d.x1 - d.x0 > 160 && d.y1 - d.y0 > 90;
    const fit = function (d) { if (this.getComputedTextLength() > d.x1 - d.x0 - 14) this.remove(); };
    g.filter((d) => d.y1 - d.y0 > 26).append("text").attr("class", "tm-n").attr("x", 8).attr("y", (d) => (big(d) ? 24 : 18))
      .style("font-size", (d) => (big(d) ? "18px" : "12px")).text((d) => d.data.name).each(fit);
    g.filter((d) => d.y1 - d.y0 > 46).append("text").attr("class", "tm-v").attr("x", 8)
      .attr("y", (d) => (big(d) ? 46 : 34)).text((d) => `${fmtInt(Math.round(d.data.mln))} млн · ${fmt1(d.data.pct)}%`).each(fit);
  }
  render();
  return { render };
}
