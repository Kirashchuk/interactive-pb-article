// Спільні утиліти: український формат чисел, тултип, розмір контейнера, плюралізація
/* global d3 */

const locale = d3.formatLocale({ decimal: ",", thousands: " ", grouping: [3], currency: ["", " грн"] });
export const fmtInt = locale.format(",d");
export const fmt1 = locale.format(",.1f");
export const fmt2 = locale.format(",.2f");
export const fmt3 = locale.format(",.3f");
export const fmtPct = (v, d = 2) => (v == null ? "—" : locale.format(`,.${d}f`)(v) + "%");
export const fmtMln = (v) => (v == null ? "—" : (v >= 100 ? fmtInt(Math.round(v)) : v >= 10 ? fmt1(v) : fmt2(v)) + " млн");

export const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

/** «3 міста», «5 міст», «21 місто» */
export function plural(n, one, few, many) {
  const m10 = n % 10, m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return one;
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few;
  return many;
}
export const cities = (n) => `${n} ${plural(n, "місто", "міста", "міст")}`;

export function box(el) {
  const r = el.getBoundingClientRect();
  return { w: Math.max(10, Math.round(r.width)), h: Math.max(10, Math.round(r.height)) };
}

export const reduceMotion = () => matchMedia("(prefers-reduced-motion: reduce)").matches;

/**
 * Анімація до кінцевого стану, що не «застрягає»: якщо вкладка прихована або rAF не тікає,
 * кінцевий стан застосовується таймером. setFinal(selOrTransition) задає кінцеві атрибути.
 */
export function animate(sel, setFinal, { duration = 600, delay = 0, maxDelay = 0 } = {}) {
  if (reduceMotion() || document.hidden) { setFinal(sel); return; }
  setFinal(sel.transition().duration(duration).delay(delay));
  setTimeout(() => { sel.interrupt(); setFinal(sel); }, duration + Math.max(maxDelay, typeof delay === "number" ? delay : 0) + 250);
}

// ---------- тултип ----------
const tip = () => document.getElementById("tip");
export function showTip(html, ev) {
  const t = tip();
  t.innerHTML = html;
  t.hidden = false;
  moveTip(ev);
}
export function moveTip(ev) {
  const t = tip();
  if (t.hidden || !ev) return;
  let x, y;
  if (ev.clientX != null && !(ev.clientX === 0 && ev.clientY === 0)) { x = ev.clientX; y = ev.clientY; }
  else {
    const r = (ev.target || ev.currentTarget).getBoundingClientRect();
    x = r.left + r.width / 2; y = r.top;
  }
  const tw = t.offsetWidth, th = t.offsetHeight, vw = innerWidth, vh = innerHeight;
  let left = x + 14, top = y + 14;
  if (left + tw > vw - 8) left = x - tw - 14;
  if (top + th > vh - 8) top = y - th - 14;
  t.style.left = Math.max(8, left) + "px";
  t.style.top = Math.max(8, top) + "px";
}
export function hideTip() { tip().hidden = true; }

/** Підключає тултип до d3-вибірки: html(d) → рядок */
export function tipOn(sel, html) {
  sel.on("pointerenter.tip focus.tip", (ev, d) => showTip(html(d), ev))
    .on("pointermove.tip", (ev) => moveTip(ev))
    .on("pointerleave.tip blur.tip", hideTip);
  return sel;
}

export const row = (k, v) => `<div class="row"><span>${esc(k)}</span><em>${esc(v)}</em></div>`;

export const REGION_LABEL = { W: "Захід", C: "Центр і Північ", SE: "Південь і Схід" };
export const SIZE_LABEL = { s1: "100–199 тис.", s2: "200–499 тис.", s3: "500–999 тис.", s4: "1 млн і більше" };
export const TYPE_SHORT = { sv: "стала · вагома", sn: "стала · невелика", pv: "переривчаста · вагома", pn: "переривчаста · невелика", na: "без зіставних пар" };
export const TR_LABEL = ["окремі свідчення", "статуси порталу", "агрегований звіт", "пооб’єктний реєстр"];
export const POST_LABEL = { active: "відбори з переможцями", intake: "прийом проєктів без переможців", occupied: "окупація", none: "нових конкурсів не виявлено" };
