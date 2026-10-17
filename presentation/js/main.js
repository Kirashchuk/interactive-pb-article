// Точка входу: дані → картооснова → ініціалізація слайдів → навігація
import { initDeck, initTheme } from "./deck.js";
import { setGeo } from "./map.js";
import { setCityData } from "./city.js";
import * as A from "./slides-a.js";
import * as B from "./slides-b.js";

const INIT = { ...A, ...B };

async function boot() {
  initTheme();
  const [data, geo] = await Promise.all([
    fetch("data/deck.json").then((r) => r.json()),
    fetch("data/geo.json").then((r) => r.json()),
  ]);
  setGeo(geo);
  setCityData(data);
  document.getElementById("drawer").inert = true;

  const inst = new Map();
  const renderAll = () => inst.forEach((v, el) => { try { v?.render?.(); } catch (e) { console.error(el.id, e); } });
  for (const el of document.querySelectorAll(".slide[data-init]")) {
    const fn = INIT[el.dataset.init];
    if (!fn) continue;
    try { inst.set(el, fn(el, data)); } catch (e) { console.error(el.id, e); }
  }

  initDeck({
    onEnter: (el) => inst.get(el)?.enter?.(),
    onLeave: (el) => inst.get(el)?.leave?.(),
    onModeChange: () => requestAnimationFrame(renderAll),
  });

  let t = 0;
  addEventListener("resize", () => { clearTimeout(t); t = setTimeout(renderAll, 160); });
  document.fonts?.ready.then(renderAll);
}

boot().catch((e) => {
  console.error(e);
  const p = document.createElement("p");
  p.className = "boot-error";
  p.textContent = "Не вдалося завантажити дані презентації. Відкрийте сторінку через вебсервер (не file://).";
  document.body.prepend(p);
});
