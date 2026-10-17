// Профіль міста — бічна панель, що відкривається кліком по місту на будь-якій карті
/* global d3 */
import { esc, fmtInt, fmt1, fmtPct, fmtMln, REGION_LABEL, SIZE_LABEL, TYPE_SHORT, TR_LABEL, POST_LABEL } from "./util.js";

let DATA = null;
let lastFocus = null;
const YEARS = d3.range(2015, 2026);

export function setCityData(d) { DATA = d; }

export function openCity(name) {
  const c = DATA.cities.find((x) => x.name === name);
  if (!c) return;
  const dr = document.getElementById("drawer");
  lastFocus = document.activeElement;
  const tot = DATA.totals.cityTotals.find((x) => x.name === name);
  const votes = Object.entries(c.votes || {});
  dr.innerHTML = `
    <button type="button" class="x" aria-label="Закрити профіль">×</button>
    <div><div class="kick">${esc(c.oblast)}</div><h3>${esc(c.name)}</h3></div>
    <div class="chips">
      <span class="chip"><i style="background:var(--rg-${c.region})"></i>${esc(REGION_LABEL[c.region])}</span>
      <span class="chip">${esc(SIZE_LABEL[c.size])}</span>
      ${c.occupied ? '<span class="chip warn">окупація після 24.02.2022</span>' : ""}
    </div>
    <div class="facts">
      <div class="fact"><b>${c.first}</b><span>перший рік бюджету участі</span></div>
      <div class="fact"><b>${c.winYears}</b><span>років із переможцями, 2015–2025</span></div>
      <div class="fact"><b>${fmtPct(c.share)}</b><span>зважена частка у видатках, 2018–2021</span></div>
      <div class="fact"><b>${c.uah == null ? "—" : fmt1(c.uah)}</b><span>грн на мешканця на рік</span></div>
      <div class="fact"><b>${c.appsK == null ? "—" : String(c.appsK).replace(".", ",")}</b><span>заявок на 1 тис. мешканців</span></div>
      <div class="fact"><b>${tot ? fmtMln(tot.mln) : "—"}</b><span>документованих коштів, 2015–2025</span></div>
    </div>
    <div class="sub">Переможці за роками</div>
    <svg class="spark" id="drawer-spark" role="img" aria-label="Кількість переможців за роками"></svg>
    <div class="sub">Типологія</div>
    <div class="chips">
      <span class="chip"><i style="background:var(--t-${c.type})"></i>${esc(TYPE_SHORT[c.type])}</span>
      <span class="chip">звітність: ${esc(TR_LABEL[c.tr] ?? "—")}</span>
      <span class="chip">2023–2025: ${esc(POST_LABEL[c.post])}</span>
    </div>
    ${c.postNote ? `<p class="note">${esc(c.postNote)}</p>` : ""}
    ${votes.length ? `<div class="sub">Голосів на 1 тис. мешканців (EGAP)</div>
      <div class="chips">${votes.map(([y, v]) => `<span class="chip mono">${y}: ${fmt1(v)}</span>`).join("")}</div>` : ""}
    <p class="note">Людність на 01.01.2022: ${fmtInt(c.pop)} осіб.</p>`;
  dr.classList.add("open");
  dr.setAttribute("aria-hidden", "false");
  dr.inert = false;
  dr.querySelector(".x").addEventListener("click", closeCity);
  dr.querySelector(".x").focus();
  spark(c);
}

export function closeCity() {
  const dr = document.getElementById("drawer");
  if (!dr.classList.contains("open")) return;
  dr.classList.remove("open");
  dr.setAttribute("aria-hidden", "true");
  dr.inert = true;
  lastFocus?.focus?.({ preventScroll: true });
}

function spark(c) {
  const svg = d3.select("#drawer-spark");
  const w = svg.node().getBoundingClientRect().width || 340, h = 150, m = { t: 16, r: 6, b: 20, l: 6 };
  svg.attr("viewBox", `0 0 ${w} ${h}`);
  const x = d3.scaleBand(YEARS, [m.l, w - m.r]).padding(0.22);
  const vals = YEARS.map((y) => ({ y, v: c.y[y][1], occ: c.occupied && y >= 2022, pre: y < c.first }));
  const max = d3.max(vals, (d) => d.v) || 1;
  const yS = d3.scaleLinear([0, max], [h - m.b, m.t]);
  svg.selectAll("*").remove();
  svg.append("g").selectAll("rect").data(vals).join("rect")
    .attr("x", (d) => x(d.y)).attr("width", x.bandwidth())
    .attr("y", (d) => (d.v ? yS(d.v) : h - m.b - 2)).attr("height", (d) => (d.v ? h - m.b - yS(d.v) : 2)).attr("rx", 2)
    .style("fill", (d) => (d.v ? "var(--accent)" : d.occ ? "var(--alert)" : "var(--line)"));
  svg.append("g").selectAll("text").data(vals.filter((d) => d.v)).join("text").attr("class", "vlbl")
    .attr("x", (d) => x(d.y) + x.bandwidth() / 2).attr("y", (d) => yS(d.v) - 4).attr("text-anchor", "middle").style("font-size", "10px").text((d) => d.v);
  svg.append("g").selectAll("text").data(vals).join("text").attr("class", "vlbl muted")
    .attr("x", (d) => x(d.y) + x.bandwidth() / 2).attr("y", h - 5).attr("text-anchor", "middle").style("font-size", "9.5px")
    .text((d) => "’" + String(d.y).slice(2));
}

document.addEventListener("deck:escape", closeCity);
