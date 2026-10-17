// Слайди 11–20: частка, картосхема, групи, війна, реалізація, голоси, типологія, теми, реєстр
/* global d3 */
import { box, esc, fmtInt, fmt1, fmtPct, row, tipOn, reduceMotion, animate, REGION_LABEL, TYPE_SHORT, TR_LABEL, POST_LABEL } from "./util.js";
import { baseMap, cityLabels, shapePath, drawContours } from "./map.js";
import { openCity } from "./city.js";

const xy = (m, c) => m.proj([c.lon, c.lat]);
const cityTip = (c, extra = "") => `<b>${esc(c.name)}</b>${extra}<div class="hint">Клік — профіль міста</div>`;
const dec = (v, d = 2) => (v == null ? "—" : String(v.toFixed(d)).replace(".", ","));

// ---------- 11. Частка ≈ 0,3%: вафля + ранжування міст ----------
export function share(el, data) {
  const waf = el.querySelector("#waffle"), svg = el.querySelector("#share-svg");
  const rows = data.cities.filter((c) => c.share != null).sort((a, b) => b.share - a.share);
  let cells;
  function drawWaffle() {
    const { w } = box(waf);
    const cols = 50, rws = 20, gap = 1.5, cs = (w - gap * (cols - 1)) / cols, h = rws * (cs + gap) - gap;
    const s = d3.select(waf).attr("viewBox", `0 0 ${w} ${h}`).style("height", h + "px");
    s.selectAll("*").remove();
    cells = s.selectAll("rect").data(d3.range(1000)).join("rect")
      .attr("x", (i) => (i % cols) * (cs + gap)).attr("y", (i) => Math.floor(i / cols) * (cs + gap))
      .attr("width", cs).attr("height", cs).attr("rx", Math.min(2, cs / 4))
      .attr("class", (i) => (i >= 997 ? "wf on" : "wf"));
    // Рамка-виноска навколо трьох гривень
    const x0 = (997 % cols) * (cs + gap) - 3, y0 = Math.floor(997 / cols) * (cs + gap) - 3;
    s.append("rect").attr("x", x0).attr("y", y0).attr("width", 3 * (cs + gap) - gap + 6).attr("height", cs + 6).attr("rx", 3)
      .style("fill", "none").style("stroke", "var(--amber)").attr("stroke-width", 2);
  }
  function render() {
    drawWaffle();
    const { w, h } = box(svg);
    const s = d3.select(svg).attr("viewBox", `0 0 ${w} ${h}`);
    s.selectAll("*").remove();
    const mg = { t: 22, r: 54, b: 24, l: Math.min(126, w * 0.3) };
    const x = d3.scaleLinear([0, 0.9], [mg.l, w - mg.r]);
    const y = d3.scaleBand(rows.map((c) => c.name), [mg.t, h - mg.b]).padding(0.25);
    s.append("g").attr("class", "ax grid").attr("transform", `translate(0,${h - mg.b})`)
      .call(d3.axisBottom(x).tickValues([0, 0.2, 0.4, 0.6, 0.8]).tickSize(-(h - mg.t - mg.b)).tickFormat((v) => dec(v, 1) + "%"));
    const ref = (v, t, dy) => {
      s.append("line").attr("x1", x(v)).attr("x2", x(v)).attr("y1", mg.t - 6).attr("y2", h - mg.b).style("stroke", "var(--amber)").attr("stroke-width", 1.5).attr("stroke-dasharray", "4 3");
      s.append("text").attr("class", "annot").attr("x", x(v) + 5).attr("y", mg.t - 8 + dy).style("fill", "var(--amber)").style("font-weight", 600).text(t);
    };
    ref(0.299, "медіана пар 0,299%", 0);
    const g = s.append("g").selectAll("g").data(rows).join("g").attr("transform", (c) => `translate(0,${y(c.name) + y.bandwidth() / 2})`)
      .attr("class", "sh-row").style("cursor", "pointer").on("click", (e, c) => openCity(c.name));
    g.append("rect").attr("x", 0).attr("width", w).attr("y", -y.step() / 2).attr("height", y.step()).style("fill", "transparent");
    g.append("text").attr("class", "hm-lbl").attr("x", mg.l - 10).attr("y", 4).attr("text-anchor", "end")
      .style("font-size", Math.min(12, y.step() * 0.75) + "px").text((c) => c.name);
    const vals = (c) => Object.values(c.sh || {});
    g.append("line").attr("x1", (c) => x(d3.min(vals(c)) ?? c.share)).attr("x2", (c) => x(d3.max(vals(c)) ?? c.share))
      .style("stroke", (c) => `var(--rg-${c.region})`).style("stroke-opacity", 0.35).attr("stroke-width", Math.max(2, y.bandwidth() * 0.45)).attr("stroke-linecap", "round");
    g.selectAll("circle.yr").data((c) => vals(c).map((v) => ({ v, c }))).join("circle").attr("class", "yr")
      .attr("cx", (d) => x(d.v)).attr("r", 2.2).style("fill", "var(--surface)").style("stroke", (d) => `var(--rg-${d.c.region})`);
    g.append("circle").attr("cx", (c) => x(c.share)).attr("r", Math.max(4, Math.min(7, y.bandwidth() * 0.5)))
      .style("fill", (c) => `var(--rg-${c.region})`).style("stroke", "var(--surface)").attr("stroke-width", 1.4);
    g.append("text").attr("class", "vlbl").attr("x", (c) => x(Math.max(c.share, d3.max(vals(c)) ?? 0)) + 10).attr("y", 4)
      .style("font-size", Math.min(11.5, y.step() * 0.72) + "px").text((c) => dec(c.share));
    tipOn(g, (c) => cityTip(c, row("зважена частка", fmtPct(c.share, 3)) + Object.entries(c.sh).map(([yy, v]) => row(yy, fmtPct(v, 3))).join("") + row("грн на мешканця", fmt1(c.uah))));
    const lg = s.append("g").attr("transform", `translate(${w - mg.r - 250},${h - mg.b - 52})`);
    lg.append("rect").attr("x", -10).attr("y", -16).attr("width", 260).attr("height", 44).attr("rx", 8).style("fill", "var(--surface)").style("stroke", "var(--line)");
    lg.append("circle").attr("cx", 4).attr("cy", -2).attr("r", 5).style("fill", "var(--ink-2)");
    lg.append("text").attr("class", "annot").attr("x", 14).attr("y", 2).text("зважена частка 2018–2021");
    lg.append("circle").attr("cx", 4).attr("cy", 16).attr("r", 2.2).style("fill", "var(--surface)").style("stroke", "var(--ink-2)");
    lg.append("text").attr("class", "annot").attr("x", 14).attr("y", 20).text("окремі роки — стабільна ієрархія");
  }
  render();
  return {
    render,
    enter() {
      if (reduceMotion() || !cells) return;
      cells.filter((i) => i >= 997).classed("on", false)
        .each(function (i) { setTimeout(() => d3.select(this).classed("on", true), 300 + (i - 997) * 280); });
    },
  };
}

// ---------- 12. Картосхема: частка, грн на мешканця, заявки ----------
const CM = {
  share: { t: "Частка у видатках міста, 2018–2021", br: [0.2, 0.3, 0.5], lbl: ["< 0,20%", "0,20–0,29%", "0,30–0,49%", "≥ 0,50%"], f: (v) => fmtPct(v, 2) },
  uah: { t: "Грн бюджету участі на мешканця на рік", br: [20, 40, 60], lbl: ["< 20 грн", "20–39 грн", "40–59 грн", "≥ 60 грн"], f: (v) => fmt1(v) + " грн" },
  appsK: { t: "Заявок на 1 тис. мешканців на рік", br: [0.2, 0.3, 0.5], lbl: ["< 0,20", "0,20–0,29", "0,30–0,49", "≥ 0,50"], f: (v) => dec(v) },
};
export function choropleth(el, data) {
  const svg = el.querySelector("#cm-map"), legend = el.querySelector("#cm-legend"), rank = el.querySelector("#cm-rank");
  const cs = data.cities;
  let metric = "share", dots, labels;
  const rS = d3.scaleSqrt([0, 100], [2.5, 20]);
  const cls = (v) => (v == null ? -1 : d3.bisect(CM[metric].br, v));
  const fill = (c) => { const k = cls(c[metric]); return k < 0 ? "none" : `var(--q${k + 1})`; };
  function hl(name) {
    dots?.classed("dim", (c) => name && c.name !== name).classed("hl", (c) => c.name === name);
    labels?.classed("dim", (c) => name && c.name !== name);
  }
  function paint() {
    const M = CM[metric];
    animate(dots, (s) => s.style("fill", fill), { duration: 450 });
    legend.innerHTML = `<span class="ttl">${esc(M.t)}</span>` + M.lbl.map((t, k) => `<span><i style="background:var(--q${k + 1})"></i>${t}</span>`).join("") +
      `<span><i style="background:none;border:1.5px solid var(--muted)"></i>немає зіставних пар</span>` +
      `<span class="ttl" style="margin-top:6px">Розмір кола — грн на мешканця</span>` +
      [10, 50, 100].map((v) => `<span><svg width="${rS(v) * 2 + 2}" height="${rS(v) * 2 + 2}" aria-hidden="true"><circle cx="${rS(v) + 1}" cy="${rS(v) + 1}" r="${rS(v)}" fill="none" stroke="currentColor"/></svg>${v}</span>`).join("");
    const valid = cs.filter((c) => c[metric] != null).sort((a, b) => b[metric] - a[metric]);
    const li = (c, i) => `<li data-c="${esc(c.name)}"><span class="mono">${i}</span><span>${esc(c.name)}</span><b class="mono">${M.f(c[metric])}</b></li>`;
    rank.innerHTML = `<li class="rh">Найвищі</li>` + valid.slice(0, 5).map((c, i) => li(c, i + 1)).join("") +
      `<li class="rh">Найнижчі</li>` + valid.slice(-3).map((c, i) => li(c, valid.length - 2 + i)).join("");
    rank.querySelectorAll("li[data-c]").forEach((n) => {
      n.addEventListener("pointerenter", () => hl(n.dataset.c));
      n.addEventListener("pointerleave", () => hl(null));
      n.addEventListener("click", () => openCity(n.dataset.c));
    });
  }
  function render() {
    const m = baseMap(svg, {});
    const sorted = cs.slice().sort((a, b) => (b.uah || 0) - (a.uah || 0));
    dots = m.top.append("g").selectAll("circle").data(sorted).join("circle").attr("class", "city")
      .attr("cx", (c) => xy(m, c)[0]).attr("cy", (c) => xy(m, c)[1]).attr("r", (c) => (c.uah == null ? 5 : rS(c.uah)))
      .style("stroke", (c) => (c.uah == null ? "var(--muted)" : "var(--surface)")).attr("stroke-width", 1.4).style("fill", fill);
    tipOn(dots, (c) => cityTip(c, row("частка", fmtPct(c.share)) + row("грн на мешканця", c.uah == null ? "—" : fmt1(c.uah)) + row("заявок на 1 тис.", dec(c.appsK)) + row("зіставних пар", c.pairs)));
    dots.on("click", (e, c) => openCity(c.name));
    labels = cityLabels(m.top, cs, m.proj, (c) => (c.uah == null ? 5 : rS(c.uah)), m.w > 640 ? null : new Set(cs.filter((c) => c.pop > 400000).map((c) => c.name)))
      .classed("small", (c) => c.pop < 200000);
    paint();
  }
  el.querySelectorAll("[data-cm]").forEach((b) => b.addEventListener("click", () => {
    metric = b.dataset.cm;
    el.querySelectorAll("[data-cm]").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
    paint();
  }));
  render();
  return { render };
}

// ---------- 13. Групи міст (табл. 2) ----------
const GM = [
  { k: "median", t: "Медіана частки, %", f: (v) => dec(v) },
  { k: "weighted", t: "Зважена частка, %", f: (v) => dec(v) },
  { k: "uah", t: "Грн на мешканця", f: (v) => fmt1(v) },
  { k: "apps", t: "Заявок на 1 тис.", f: (v) => dec(v) },
];
const GROUP_TEXT = {
  region: {
    h: "Захід — найвища частка, Південь і Схід — найменший ресурс на мешканця",
    p: "Міста західної частини мають найвищі медіанні частки (0,36%), а південної та східної — найменший ресурс на мешканця: 20,5 грн проти ≈47 грн в інших групах.",
  },
  size: {
    h: "Найменші міста: найнижча частка, але найвища активність подання",
    p: "У містах із населенням 100–199 тис. — частка 0,20% і 19,2 грн на мешканця, але найвища активність подання: 0,49 заявки на 1 тис.",
  },
};
export function groups(el, data) {
  const svg = el.querySelector("#groups-svg"), hEl = el.querySelector("#groups-h"), pEl = el.querySelector("#groups-cap");
  let kind = "region";
  const color = (g) => (g.kind === "region" ? `var(--rg-${g.id})` : `var(--q${+g.id.slice(1)})`);
  function render() {
    const { w, h } = box(svg);
    const s = d3.select(svg).attr("viewBox", `0 0 ${w} ${h}`);
    s.selectAll("*").remove();
    const G = data.groups.filter((g) => g.kind === kind);
    const cols = w > 720 ? 4 : 2, rowsN = Math.ceil(GM.length / cols);
    const pw = w / cols, ph = h / rowsN;
    const lblW = Math.min(132, pw * 0.42);
    GM.forEach((M, i) => {
      const gx = (i % cols) * pw, gy = Math.floor(i / cols) * ph;
      const p = s.append("g").attr("transform", `translate(${gx},${gy})`);
      const showLbl = i % cols === 0;
      const x0 = showLbl ? lblW : 6;
      const x = d3.scaleLinear([0, d3.max(data.groups, (g) => g[M.k]) * 1.08], [x0, pw - 46]);
      const used = Math.min(ph - 52, G.length * 104);
      const y0 = 36 + (ph - 52 - used) / 2;
      p.append("text").attr("class", "gp-t").attr("x", x0).attr("y", y0 - 18).text(M.t);
      const y = d3.scaleBand(G.map((g) => g.id), [y0, y0 + used]).padding(0.3);
      const max = d3.max(G, (g) => g[M.k]), min = d3.min(G, (g) => g[M.k]);
      if (showLbl) p.append("g").selectAll("text").data(G).join("text").attr("class", "gp-l").attr("x", x0 - 10)
        .attr("y", (g) => y(g.id) + y.bandwidth() / 2 + 5).attr("text-anchor", "end").text((g) => g.label);
      p.append("line").attr("x1", x0).attr("x2", x0).attr("y1", y0 - 8).attr("y2", y0 + used + 8).style("stroke", "var(--line)");
      const b = p.append("g").selectAll("rect").data(G).join("rect").attr("x", x0).attr("y", (g) => y(g.id)).attr("height", y.bandwidth()).attr("rx", 3)
        .style("fill", color).attr("width", 0);
      animate(b, (t) => t.attr("width", (g) => x(g[M.k]) - x0));
      tipOn(b, (g) => `<b>${esc(g.label)}</b>${row("міст (з парами / у рамці)", g.cities)}${row("пар", g.pairs)}${row(M.t, M.f(g[M.k]))}`);
      p.append("g").selectAll("text.v").data(G).join("text").attr("class", "vlbl")
        .attr("x", (g) => x(g[M.k]) + 6).attr("y", (g) => y(g.id) + y.bandwidth() / 2 + 4)
        .style("font-weight", (g) => (g[M.k] === max || g[M.k] === min ? 700 : 500))
        .style("fill", (g) => (g[M.k] === max ? "var(--ink)" : "var(--muted)")).text((g) => M.f(g[M.k]));
    });
    hEl.textContent = GROUP_TEXT[kind].h;
    pEl.textContent = GROUP_TEXT[kind].p;
  }
  el.querySelectorAll("[data-gk]").forEach((b) => b.addEventListener("click", () => {
    kind = b.dataset.gk;
    el.querySelectorAll("[data-gk]").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
    render();
  }));
  render();
  return { render };
}

// ---------- 14. Війна: стан програм у 2023–2025 рр. ----------
export function war(el, data) {
  const svg = el.querySelector("#war-map"), legend = el.querySelector("#war-legend");
  const cs = data.cities;
  const cnt = (k) => cs.filter((c) => c.post === k).length;
  legend.innerHTML = `<span class="ttl">Стан у 2023–2025 рр. · міст</span>` +
    `<span><i style="background:var(--accent)"></i>відбори з переможцями · ${cnt("active")}</span>` +
    `<span><i style="background:var(--surface);border:2px solid var(--accent)"></i>прийом без переможців · ${cnt("intake")}</span>` +
    `<span><i class="x-ico"></i>окупація · ${cnt("occupied")}</span>` +
    `<span><i style="background:var(--faint);width:7px;height:7px"></i>нових конкурсів не виявлено · ${cnt("none")}</span>`;
  function render() {
    const m = baseMap(svg, {});
    const r = (c) => (c.post === "active" ? 10 : c.post === "intake" ? 8 : 4);
    const g = m.top.append("g");
    const dots = g.selectAll("circle").data(cs.filter((c) => c.post !== "occupied")).join("circle").attr("class", "city")
      .attr("cx", (c) => xy(m, c)[0]).attr("cy", (c) => xy(m, c)[1]).attr("r", r)
      .style("fill", (c) => (c.post === "active" ? "var(--accent)" : c.post === "intake" ? "var(--surface)" : "var(--faint)"))
      .style("stroke", (c) => (c.post === "intake" ? "var(--accent)" : "var(--surface)")).attr("stroke-width", (c) => (c.post === "intake" ? 2.4 : 1));
    const occ = g.selectAll("path.o").data(cs.filter((c) => c.post === "occupied")).join("path").attr("class", "occ-x city-x")
      .attr("d", (c) => { const [x, y] = xy(m, c), k = 7; return `M${x - k},${y - k}L${x + k},${y + k}M${x + k},${y - k}L${x - k},${y + k}`; });
    const post = (c) => [2023, 2024, 2025].map((y) => row(`${y}: переможці / млн грн`, c.y[y][1] ? `${c.y[y][1]} / ${dec(c.y[y][2], 1)}` : c.y[y][0] ? `${c.y[y][0]} заявок` : "—")).join("");
    tipOn(dots, (c) => cityTip(c, row("стан", POST_LABEL[c.post]) + (c.post !== "none" ? post(c) : "") + (c.postNote ? `<div class="hint">${esc(c.postNote)}</div>` : "")));
    dots.on("click", (e, c) => openCity(c.name));
    occ.style("pointer-events", "stroke").attr("stroke-width", 6).style("stroke-opacity", 1);
    tipOn(occ, (c) => cityTip(c, row("стан", "окупація після 24.02.2022")));
    cityLabels(m.top, cs, m.proj, (c) => r(c) + (c.post === "occupied" ? 4 : 0), new Set(cs.filter((c) => c.post !== "none" || c.name === "Київ").map((c) => c.name)))
      .classed("small", (c) => c.post === "none");
    // Вставка: кошти за роками, ціни 2021 р.
    const iw = Math.min(250, m.w * 0.3), ih = 104, ix = 14, iy = m.h - ih - 24;
    const ins = m.s.append("g").attr("transform", `translate(${ix},${iy})`);
    ins.append("rect").attr("width", iw).attr("height", ih).attr("rx", 10).style("fill", "var(--surface)").style("stroke", "var(--line)");
    ins.append("text").attr("class", "annot").attr("x", 10).attr("y", 17).style("font-size", "11px").text("Кошти, млн грн (ціни 2021 р.)");
    const A = data.annual;
    const x = d3.scaleBand(A.map((d) => d.year), [10, iw - 10]).padding(0.2);
    const y = d3.scaleLinear([0, 700], [ih - 18, 26]);
    ins.selectAll("rect.b").data(A).join("rect").attr("x", (d) => x(d.year)).attr("width", x.bandwidth())
      .attr("y", (d) => y(d.real)).attr("height", (d) => y(0) - y(d.real)).attr("rx", 1.5)
      .style("fill", (d) => (d.year >= 2022 ? "var(--alert)" : "var(--q2)"));
    ins.selectAll("text.y").data([2015, 2021, 2025]).join("text").attr("class", "vlbl muted").style("font-size", "9.5px")
      .attr("x", (d) => x(d) + x.bandwidth() / 2).attr("y", ih - 5).attr("text-anchor", "middle").text((d) => d);
    ins.append("text").attr("class", "vlbl").style("font-size", "10px").attr("x", x(2024) + x.bandwidth() / 2).attr("y", y(43) - 6).attr("text-anchor", "middle").style("fill", "var(--alert)").text("96");
  }
  render();
  return { render };
}

// ---------- 15. Реалізація (табл. 3) ----------
const ST = [["done", "реалізовано"], ["fail", "не реалізовано"], ["prog", "у реалізації"], ["unk", "статус невідомий"]];
export function implementation(el, data) {
  const svg = el.querySelector("#impl-svg");
  el.querySelector("#impl-legend").innerHTML = ST.map(([k, t]) => `<span><i style="background:var(--st-${k});border-radius:2px"></i>${t}</span>`).join("");
  const R = data.implementation;
  function render() {
    const { w, h } = box(svg);
    const s = d3.select(svg).attr("viewBox", `0 0 ${w} ${h}`);
    s.selectAll("*").remove();
    const mg = { t: 8, r: 56, b: 8, l: Math.min(270, w * 0.38) };
    const x = d3.scaleLinear([0, 1], [mg.l, w - mg.r]);
    const y = d3.scaleBand(R.map((d, i) => i), [mg.t, h - mg.b]).padding(0.3);
    const g = s.append("g").selectAll("g").data(R).join("g").attr("transform", (d, i) => `translate(0,${y(i)})`);
    g.append("text").attr("class", "im-c").attr("x", mg.l - 12).attr("y", y.bandwidth() / 2 - 2).attr("text-anchor", "end")
      .text((d) => `${d.city} · ${d.cohort}`).each(function () { trim(this, mg.l - 16); });
    g.append("text").attr("class", "im-s").attr("x", mg.l - 12).attr("y", y.bandwidth() / 2 + 13).attr("text-anchor", "end").text((d) => `${d.src} · ${d.asof}`)
      .each(function () { trim(this, mg.l - 16); });
    g.each(function (d) {
      let acc = 0;
      const segs = ST.map(([k, t]) => { const o = { k, t, v: d[k], x0: acc / d.n, d }; acc += d[k]; o.x1 = acc / d.n; return o; }).filter((o) => o.v > 0);
      const sg = d3.select(this).selectAll("rect").data(segs).join("rect").attr("x", (o) => x(o.x0)).attr("y", 0).attr("height", y.bandwidth())
        .attr("width", 0).style("fill", (o) => `var(--st-${o.k})`);
      animate(sg, (t) => t.attr("width", (o) => Math.max(1, x(o.x1) - x(o.x0) - 1.5)), { duration: 700 });
      tipOn(sg, (o) => `<b>${esc(o.d.city)} · ${esc(o.d.cohort)}</b>${row(o.t, `${fmtInt(o.v)} з ${fmtInt(o.d.n)} (${fmt1((o.v / o.d.n) * 100)}%)`)}${row("станом на", o.d.asof)}${row("джерело", o.d.src)}`);
      d3.select(this).selectAll("text.p").data(segs.filter((o) => x(o.x1) - x(o.x0) > 40)).join("text").attr("class", "im-p")
        .attr("x", (o) => x(o.x0) + 6).attr("y", y.bandwidth() / 2 + 4).text((o) => `${Math.round((o.v / o.d.n) * 100)}%`);
    });
    g.append("text").attr("class", "vlbl muted").attr("x", w - mg.r + 8).attr("y", y.bandwidth() / 2 + 4).text((d) => fmtInt(d.n));
  }
  render();
  return { render };
}
function trim(node, max) {
  let t = node.textContent;
  while (node.getComputedTextLength() > max && t.length > 4) { t = t.slice(0, -2); node.textContent = t + "…"; }
}

// ---------- 16. Голосування: голосів на 1 тис. мешканців ----------
export function votes(el, data) {
  const svg = el.querySelector("#votes-svg"), med = el.querySelector("#votes-med"), note = el.querySelector("#votes-note");
  const yearsBox = el.querySelector("#votes-years");
  const VM = data.voteMedians;
  let year = 2019;
  yearsBox.innerHTML = [2016, 2017, 2018, 2019].map((y) => `<button type="button" data-vy="${y}" aria-pressed="${y === year}">${y}</button>`).join("");
  yearsBox.querySelectorAll("button").forEach((b) => b.addEventListener("click", () => {
    year = +b.dataset.vy;
    yearsBox.querySelectorAll("button").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
    render();
  }));
  function drawMed() {
    const { w } = box(med), h = 130;
    const s = d3.select(med).attr("viewBox", `0 0 ${w} ${h}`).style("height", h + "px");
    s.selectAll("*").remove();
    const pts = Object.entries(VM).map(([y, v]) => ({ y: +y, v: v.median }));
    const x = d3.scalePoint(pts.map((d) => d.y), [22, w - 26]);
    const y = d3.scaleLinear([0, 100], [h - 22, 22]);
    s.append("text").attr("class", "annot").attr("x", 0).attr("y", 12).text("Медіана голосів на 1 тис. мешканців");
    s.append("path").datum(pts).attr("d", d3.line().x((d) => x(d.y)).y((d) => y(d.v))).style("fill", "none").style("stroke", "var(--accent)").attr("stroke-width", 2.5);
    const g = s.append("g").selectAll("g").data(pts).join("g").attr("transform", (d) => `translate(${x(d.y)},${y(d.v)})`);
    g.append("circle").attr("r", (d) => (d.y === year ? 7 : 4.5)).style("fill", (d) => (d.y === year ? "var(--amber)" : "var(--accent)")).style("stroke", "var(--surface)").attr("stroke-width", 2);
    g.append("text").attr("class", "vlbl").attr("y", -12).attr("text-anchor", "middle").text((d) => fmt1(d.v));
    s.append("g").selectAll("text").data(pts).join("text").attr("class", "vlbl muted").attr("x", (d) => x(d.y)).attr("y", h - 4)
      .attr("text-anchor", "middle").style("font-weight", (d) => (d.y === year ? 700 : 500)).text((d) => d.y);
  }
  function render() {
    drawMed();
    const rows = data.cities.filter((c) => c.votes[year] != null).sort((a, b) => b.votes[year] - a.votes[year]);
    note.textContent = `${rows.length} міст · медіана ${fmt1(VM[year].median)}`;
    const { w, h } = box(svg);
    const s = d3.select(svg).attr("viewBox", `0 0 ${w} ${h}`);
    s.selectAll("*").remove();
    const mg = { t: 18, r: 50, b: 22, l: Math.min(128, w * 0.3) };
    const x = d3.scaleLinear([0, 380], [mg.l, w - mg.r]);
    const y = d3.scaleBand(rows.map((c) => c.name), [mg.t, h - mg.b]).padding(0.22);
    s.append("g").attr("class", "ax grid").attr("transform", `translate(0,${h - mg.b})`).call(d3.axisBottom(x).ticks(4).tickSize(-(h - mg.t - mg.b)));
    const g = s.append("g").selectAll("g").data(rows, (c) => c.name).join("g").attr("transform", (c) => `translate(0,${y(c.name)})`)
      .style("cursor", "pointer").on("click", (e, c) => openCity(c.name));
    g.append("text").attr("class", "hm-lbl").attr("x", mg.l - 8).attr("y", y.bandwidth() / 2 + 4).attr("text-anchor", "end")
      .style("font-size", Math.min(12, y.step() * 0.78) + "px").style("font-weight", (c) => (c.name === "Київ" ? 700 : null)).text((c) => c.name);
    const b = g.append("rect").attr("x", mg.l).attr("height", y.bandwidth()).attr("rx", 2).style("fill", (c) => `var(--rg-${c.region})`).attr("width", 0);
    animate(b, (t) => t.attr("width", (c) => x(c.votes[year]) - mg.l));
    g.append("text").attr("class", "vlbl").attr("x", (c) => x(c.votes[year]) + 5).attr("y", y.bandwidth() / 2 + 4)
      .style("font-size", Math.min(11.5, y.step() * 0.75) + "px").text((c) => fmt1(c.votes[year]));
    tipOn(g, (c) => cityTip(c, Object.entries(c.votes).map(([yy, v]) => row(yy, fmt1(v))).join("")));
    s.append("line").attr("x1", x(VM[year].median)).attr("x2", x(VM[year].median)).attr("y1", mg.t - 6).attr("y2", h - mg.b).style("stroke", "var(--amber)").attr("stroke-width", 2);
    s.append("text").attr("class", "annot").attr("x", x(VM[year].median) + 5).attr("y", mg.t - 6).style("fill", "var(--amber)").style("font-weight", 600).text(`медіана ${fmt1(VM[year].median)}`);
    const lg = s.append("g").attr("transform", `translate(${w - mg.r - 150},${h - mg.b - 70})`);
    ["W", "C", "SE"].forEach((k, i) => {
      lg.append("rect").attr("x", 0).attr("y", i * 18).attr("width", 10).attr("height", 10).attr("rx", 2).style("fill", `var(--rg-${k})`);
      lg.append("text").attr("class", "annot").attr("x", 16).attr("y", i * 18 + 9).text(REGION_LABEL[k]);
    });
  }
  render();
  return { render };
}

// ---------- 17. Типологія ----------
const TQ = [["sv", "sn"], ["pv", "pn"]];
export function typology(el, data) {
  const svg = el.querySelector("#type-map"), matrix = el.querySelector("#type-matrix"), legend = el.querySelector("#type-legend");
  const cs = data.cities;
  let filter = null, shapes, labels;
  const icon = (k, c) => `<svg width="18" height="18" viewBox="-9 -9 18 18" aria-hidden="true"><path d="${shapePath(k, 6.2)}" fill="${c}"/></svg>`;
  const meanTr = (k) => d3.mean(cs.filter((c) => c.type === k), (c) => c.tr);
  matrix.innerHTML = `<span></span><span class="mh">вагома вага<br><em>≥ 0,30%</em></span><span class="mh">невелика вага<br><em>&lt; 0,30%</em></span>` +
    TQ.map((rw, i) => `<span class="mh row">${i ? "переривчаста" : "стала"}<br><em>${i ? "&lt; 6 років" : "≥ 6 років"}</em></span>` + rw.map((k) => {
      const list = cs.filter((c) => c.type === k);
      return `<button type="button" class="mq" data-t="${k}" aria-pressed="false">
        <span class="mq-top">${icon(k, `var(--t-${k})`)}<b>${list.length}</b><em>прозорість ${fmt1(meanTr(k))}</em></span>
        <span class="mq-c">${list.map((c) => esc(c.name)).join(", ")}</span></button>`;
    }).join("")).join("");
  legend.innerHTML = `<span class="ttl">Контур — найсильніше джерело про реалізацію</span>` +
    [[3, "var(--ink)", 2.6], [2, "var(--accent)", 2], [1, "var(--q2)", 1.6], [0, "var(--surface)", 1]].map(([k, c, sw]) =>
      `<span><svg width="18" height="18" viewBox="-9 -9 18 18" aria-hidden="true"><circle r="6" fill="var(--surface-2)" stroke="${c}" stroke-width="${sw}"/></svg>${TR_LABEL[k]}</span>`).join("");
  const TRS = [["var(--surface)", 1], ["var(--q2)", 1.8], ["var(--accent)", 2.2], ["var(--ink)", 2.8]];
  function applyFilter() {
    shapes?.classed("dim", (c) => filter && c.type !== filter);
    labels?.classed("dim", (c) => filter && c.type !== filter);
    matrix.querySelectorAll(".mq").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.t === filter)));
  }
  matrix.querySelectorAll(".mq").forEach((b) => b.addEventListener("click", () => { filter = filter === b.dataset.t ? null : b.dataset.t; applyFilter(); }));
  function render() {
    const m = baseMap(svg, {});
    const r = m.w > 700 ? 9 : 7;
    shapes = m.top.append("g").selectAll("path").data(cs).join("path").attr("class", "city")
      .attr("transform", (c) => `translate(${xy(m, c)})`).attr("d", (c) => shapePath(c.type, r))
      .style("fill", (c) => (c.type === "na" ? "var(--surface)" : `var(--t-${c.type})`))
      .style("stroke", (c) => (c.type === "na" ? "var(--muted)" : TRS[c.tr][0])).attr("stroke-width", (c) => (c.type === "na" ? 1.5 : TRS[c.tr][1]));
    tipOn(shapes, (c) => cityTip(c, row("тип", TYPE_SHORT[c.type]) + row("років із переможцями", c.winYears) + row("зважена частка", fmtPct(c.share)) + row("звітність", TR_LABEL[c.tr])));
    shapes.on("click", (e, c) => openCity(c.name));
    labels = cityLabels(m.top, cs, m.proj, () => r, m.w > 640 ? null : new Set(cs.filter((c) => c.pop > 400000).map((c) => c.name))).classed("small", true);
    applyFilter();
  }
  render();
  return { render };
}

// ---------- 18. Тематика ----------
const PICTO = {
  edu: "M6 20L24 10l18 10M10 22v16h28V22M20 38v-9h8v9M4 38h40",
  park: "M24 6c-6 0-10 5-10 10 0 4 2 7 5 8h10c3-1 5-4 5-8 0-5-4-10-10-10zM24 24v16M12 40h24M8 33h8M32 33h8",
  sport: "M24 10a14 14 0 1 0 0 28 14 14 0 0 0 0-28zM24 10c-4 4-6 9-6 14s2 10 6 14M24 10c4 4 6 9 6 14s-2 10-6 14M10 24h28",
  shield: "M24 6l14 5v11c0 9-6 16-14 20-8-4-14-11-14-20V11zM18 24l4 4 8-8",
  rehab: "M24 40s-14-8-14-18a7 7 0 0 1 14-3 7 7 0 0 1 14 3c0 10-14 18-14 18zM24 20v10M19 25h10",
  idp: "M10 24L26 10l16 14M14 21v17h24V21M22 38v-8h8v8M2 30h10M8 26l4 4-4 4",
  shelter: "M4 20h40M8 20v18h32V20M18 38V28h12v10M16 14l8-8 8 8M24 6v10",
};
export function themes(el, data) {
  const svg = el.querySelector("#themes-svg");
  const T = [...data.themes, { id: "other", label: "Інші теми", submitted: 100 - d3.sum(data.themes, (d) => d.submitted), won: 100 - d3.sum(data.themes, (d) => d.won) }];
  const card = (k, t, s) => `<div class="picto"><svg viewBox="0 0 48 48" aria-hidden="true"><path d="${PICTO[k]}"/></svg><b>${t}</b>${s ? `<span>${s}</span>` : ""}</div>`;
  el.querySelector("#pictos").innerHTML =
    `<div class="pg"><span class="pg-t mono">2016–2019 · найчастіше</span><div class="pg-row">${card("edu", "Освіта", "школи, садочки")}${card("park", "Благоустрій", "сквери, двори")}${card("sport", "Спорт", "майданчики")}</div></div>` +
    `<div class="pg war"><span class="pg-t mono">після 24.02.2022</span><div class="pg-row">${card("shield", "Потреби оборони", "Івано-Франківськ")}${card("rehab", "Реабілітація захисників", "")}${card("idp", "Інтеграція ВПО", "")}${card("shelter", "Укриття", "Хмельницький, Кам’янське")}</div></div>`;
  function render() {
    const { w } = box(svg), h = 196;
    const s = d3.select(svg).attr("viewBox", `0 0 ${w} ${h}`).style("height", h + "px");
    s.selectAll("*").remove();
    const mg = { t: 24, r: 36, b: 8, l: 104 };
    const x = d3.scaleLinear([0, 50], [mg.l, w - mg.r]);
    const y = d3.scaleBand(T.map((d) => d.id), [mg.t, h - mg.b]).padding(0.35);
    s.append("text").attr("class", "annot").attr("x", mg.l).attr("y", 12).text("○ подано   ● переможці");
    const g = s.append("g").selectAll("g").data(T).join("g").attr("transform", (d) => `translate(0,${y(d.id) + y.bandwidth() / 2})`);
    g.append("text").attr("class", "gp-l").attr("x", mg.l - 12).attr("y", 5).attr("text-anchor", "end").text((d) => d.label);
    g.append("line").attr("x1", (d) => x(d.submitted)).attr("x2", (d) => x(d.won)).style("stroke", (d) => (d.won > d.submitted ? "var(--accent)" : "var(--faint)")).attr("stroke-width", 3);
    g.append("circle").attr("cx", (d) => x(d.submitted)).attr("r", 6).style("fill", "var(--surface)").style("stroke", "var(--muted)").attr("stroke-width", 2);
    g.append("circle").attr("cx", (d) => x(d.won)).attr("r", 7).style("fill", (d) => (d.id === "edu" ? "var(--accent)" : "var(--ink-2)"));
    g.append("text").attr("class", "vlbl").attr("x", (d) => x(Math.max(d.won, d.submitted)) + 12).attr("y", 4).text((d) => (d.won === d.submitted ? `${d.won}` : `${d.submitted} → ${d.won}`));
  }
  render();
  return { render };
}

// ---------- 20. Реєстр ----------
const STATUS = [
  { s: "подано", d: "15.03.2024" }, { s: "допущено до голосування", d: "20.05.2024" }, { s: "переможець", d: "30.06.2024" },
  { s: "у реалізації", d: "03.02.2025" }, { s: "реалізовано", d: "26.01.2026" },
];
export function registry(el) {
  const rec = el.querySelector("#record"), flow = el.querySelector("#registry-flow");
  let st = 4, timer = null;
  function draw() {
    const S = STATUS[st];
    rec.innerHTML = `<div class="rec-h"><span class="mono">Запис реєстру</span><em>приклад</em></div>
      <dl>
        <dt>ID циклу</dt><dd class="mono">UA-ГБ-2024-<i>код громади</i></dd>
        <dt>ID проєкту</dt><dd class="mono">UA-ГБ-2024-…-0137</dd>
        <dt>Назва</dt><dd>Облаштування укриття в школі</dd>
        <dt>Статус</dt><dd><span class="st st-${st}">${esc(S.s)}</span></dd>
        <dt>Дата статусу</dt><dd class="mono">${S.d}</dd>
        <dt>Бюджет: план / факт</dt><dd class="mono">1 200 000 / ${st === 4 ? "1 164 300" : "—"} грн</dd>
        <dt>Підтвердний документ</dt><dd>${st >= 2 ? (st === 4 ? "акт приймання робіт (PDF)" : "рішення про визначення переможців") : "заявка (PDF)"}</dd>
      </dl>
      <div class="rec-tl" role="group" aria-label="Статуси запису">${STATUS.map((x, i) => `<button type="button" data-i="${i}" class="${i <= st ? "on" : ""}" aria-pressed="${i === st}"><i></i><span>${esc(x.s)}</span></button>`).join("")}</div>`;
    rec.querySelectorAll(".rec-tl button").forEach((b) => b.addEventListener("click", () => { clearInterval(timer); st = +b.dataset.i; draw(); }));
  }
  function render() {
    const { w } = box(flow), h = 70;
    const s = d3.select(flow).attr("viewBox", `0 0 ${w} ${h}`).style("height", h + "px");
    s.selectAll("*").remove();
    const N = ["Міська рада", "Реєстр", "data.gov.ua", "Мешканці, дослідники"];
    const bw = (w - 3 * 28) / 4;
    s.append("defs").append("marker").attr("id", "rg-arrow").attr("viewBox", "0 0 10 10").attr("refX", 8).attr("refY", 5).attr("markerWidth", 7).attr("markerHeight", 7).attr("orient", "auto")
      .append("path").attr("d", "M0 0L10 5L0 10z").style("fill", "var(--muted)");
    N.forEach((t, i) => {
      const x = i * (bw + 28);
      s.append("rect").attr("x", x).attr("y", 12).attr("width", bw).attr("height", 44).attr("rx", 10)
        .style("fill", i === 1 ? "var(--accent)" : "var(--surface)").style("stroke", i === 1 ? "var(--accent)" : "var(--line)");
      s.append("text").attr("class", "rf-t").attr("x", x + bw / 2).attr("y", 39).attr("text-anchor", "middle").style("fill", i === 1 ? "var(--accent-ink)" : "var(--ink)").text(t);
      if (i < 3) s.append("line").attr("x1", x + bw + 4).attr("x2", x + bw + 24).attr("y1", 34).attr("y2", 34).style("stroke", "var(--muted)").attr("stroke-width", 1.5).attr("marker-end", "url(#rg-arrow)");
    });
    draw();
  }
  render();
  return {
    render,
    enter() {
      if (reduceMotion()) return;
      clearInterval(timer);
      st = 0; draw();
      timer = setInterval(() => { if (st >= 4) { clearInterval(timer); return; } st += 1; draw(); }, 1100);
    },
    leave() { clearInterval(timer); },
  };
}

// ---------- 19. Висновки: міні-графіки в картках ----------
export function conclusions(el, data) {
  const A = data.annual;
  const minis = {
    spread(s, w, h) {
      const D = A.filter((d) => d.year <= 2020);
      const x = d3.scaleBand(D.map((d) => d.year), [0, w]).padding(0.22);
      const y = d3.scaleLinear([0, 35], [h - 16, 4]);
      s.selectAll("rect").data(D).join("rect").attr("x", (d) => x(d.year)).attr("width", x.bandwidth()).attr("rx", 2)
        .attr("y", (d) => y(d.launched)).attr("height", (d) => y(0) - y(d.launched))
        .style("fill", (d) => (d.year === 2017 ? "var(--accent)" : "var(--q1)"));
      s.selectAll("text").data(D).join("text").attr("class", "vlbl muted").style("font-size", "9.5px")
        .attr("x", (d) => x(d.year) + x.bandwidth() / 2).attr("y", h - 3).attr("text-anchor", "middle").text((d) => "’" + String(d.year).slice(2));
    },
    share(s, w, h) {
      const vals = data.cities.filter((c) => c.share != null).map((c) => c.share);
      const x = d3.scaleLinear([0, 0.85], [6, w - 6]);
      const bins = d3.bin().domain([0, 0.85]).thresholds(d3.range(0, 0.85, 0.05))(vals);
      const r = Math.min(4.2, (h - 22) / 18);
      bins.forEach((b) => b.forEach((v, i) => s.append("circle").attr("cx", x((b.x0 + b.x1) / 2)).attr("cy", h - 18 - r - i * (2 * r + 1)).attr("r", r)
        .style("fill", "var(--q2)")));
      s.append("line").attr("x1", x(0.299)).attr("x2", x(0.299)).attr("y1", 2).attr("y2", h - 14).style("stroke", "var(--amber)").attr("stroke-width", 2);
      s.append("text").attr("class", "vlbl muted").style("font-size", "9.5px").attr("x", 6).attr("y", h - 2).text("0,08%");
      s.append("text").attr("class", "vlbl muted").style("font-size", "9.5px").attr("x", w - 6).attr("y", h - 2).attr("text-anchor", "end").text("0,82%");
    },
    space(s, w, h, svgEl) {
      const m = baseMap(svgEl, { context: false, scale: false, rivers: false, pad: 3 });
      m.obl.style("fill", (d) => (OBL_W.has(d.properties.name) ? "var(--accent-soft)" : "var(--surface-2)")).style("stroke", "var(--surface)");
      m.top.selectAll("circle").data(data.cities).join("circle").attr("cx", (c) => xy(m, c)[0]).attr("cy", (c) => xy(m, c)[1])
        .attr("r", (c) => (c.type === "sv" || c.type === "sn" ? 3.6 : 2))
        .style("fill", (c) => (c.type === "sv" || c.type === "sn" ? "var(--accent)" : "var(--faint)"));
      return true;
    },
    war(s, w, h) {
      const x = d3.scaleBand(A.map((d) => d.year), [0, w]).padding(0.2);
      const y = d3.scaleLinear([0, 700], [h - 16, 4]);
      s.selectAll("rect").data(A).join("rect").attr("x", (d) => x(d.year)).attr("width", x.bandwidth()).attr("rx", 1.5)
        .attr("y", (d) => y(d.real)).attr("height", (d) => y(0) - y(d.real)).style("fill", (d) => (d.year >= 2022 ? "var(--alert)" : "var(--q1)"));
      s.selectAll("text").data([2015, 2021, 2025]).join("text").attr("class", "vlbl muted").style("font-size", "9.5px")
        .attr("x", (d) => x(d) + x.bandwidth() / 2).attr("y", h - 3).attr("text-anchor", "middle").text((d) => d);
    },
  };
  function render() {
    el.querySelectorAll("svg.mini").forEach((svgEl) => {
      const { w, h } = box(svgEl);
      const s = d3.select(svgEl).attr("viewBox", `0 0 ${w} ${h}`);
      s.selectAll("*").remove();
      minis[svgEl.dataset.mini](s, w, h, svgEl);
    });
  }
  render();
  return { render };
}
const OBL_W = new Set(["Волинська", "Рівненська", "Львівська", "Тернопільська", "Івано-Франківська", "Закарпатська", "Чернівецька", "Хмельницька"]);

// ---------- 21. Завершення: горизонталі + QR-код адреси ----------
const DECK_URL = "https://kirashchuk.github.io/interactive-pb-article/presentation/";
let qrLib = null;
function loadQr() {
  if (!qrLib) {
    qrLib = new Promise((resolve, reject) => {
      const sc = document.createElement("script");
      sc.src = "https://cdnjs.cloudflare.com/ajax/libs/qrcode-generator/1.4.4/qrcode.min.js";
      sc.onload = () => (window.qrcode ? resolve(window.qrcode) : reject(new Error("qrcode")));
      sc.onerror = reject;
      document.head.appendChild(sc);
    });
  }
  return qrLib;
}
export function ending(el) {
  const qrBox = el.querySelector("#qr");
  function render() {
    drawContours(el.querySelector("#contours-end"));
  }
  loadQr().then((qrcode) => {
    const q = qrcode(0, "M");
    q.addData(DECK_URL);
    q.make();
    const n = q.getModuleCount();
    let d = "";
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (q.isDark(r, c)) d += `M${c},${r}h1v1h-1z`;
    qrBox.innerHTML = `<svg viewBox="-2 -2 ${n + 4} ${n + 4}" role="img" aria-label="QR-код: ${DECK_URL}"><rect x="-2" y="-2" width="${n + 4}" height="${n + 4}" fill="#fff"/><path d="${d}" fill="#0E1B22"/></svg>`;
  }).catch(() => { el.querySelector(".qr-row").hidden = true; });
  render();
  return { render };
}
