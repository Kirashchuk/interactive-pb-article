// Рушій презентації: слайди, клавіатура, свайпи, якір у URL, зміст, повний екран, тема.
// На вузьких екранах (або без JS) слайди йдуть стрічкою і просто прокручуються.

const DECK_MQ = "(min-width: 900px) and (min-height: 560px)";
const pad2 = (n) => String(n).padStart(2, "0");

export function initDeck({ onEnter, onLeave, onModeChange }) {
  const root = document.documentElement;
  const slides = [...document.querySelectorAll(".slide")];
  const N = slides.length;
  const $ = (id) => document.getElementById(id);
  const ticks = $("ticks"), count = $("count"), secName = $("sec-name"), toc = $("toc");
  let cur = -1;
  const seen = new Set();

  slides.forEach((s, i) => {
    const num = s.querySelector(".eyebrow .num");
    if (num) num.textContent = `${pad2(i + 1)} / ${N}`;
  });

  // Позначки прогресу (по одній на слайд, з відступом між розділами)
  slides.forEach((s, i) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "tick" + (i > 0 && s.dataset.section !== slides[i - 1].dataset.section ? " sec-start" : "");
    const t = s.querySelector("h2, h1");
    b.setAttribute("aria-label", `${i + 1}. ${t ? t.textContent.trim() : s.id}`);
    b.title = `${i + 1}. ${t ? t.textContent.trim() : ""}`;
    b.addEventListener("click", () => go(i));
    ticks.appendChild(b);
  });

  // Зміст
  const h = document.createElement("h2");
  h.textContent = "Зміст";
  toc.appendChild(h);
  slides.forEach((s, i) => {
    const b = document.createElement("button");
    b.type = "button";
    const t = s.querySelector("h2, h1");
    b.innerHTML = `<span class="n">${pad2(i + 1)}</span><span class="s"></span><span class="t"></span>`;
    b.querySelector(".s").textContent = s.dataset.section || "";
    b.querySelector(".t").textContent = t ? t.textContent.trim() : s.id;
    b.addEventListener("click", () => { closeToc(); go(i); });
    toc.appendChild(b);
  });

  const isDeck = () => root.classList.contains("deck-mode");

  function go(i, { focus = false } = {}) {
    i = Math.max(0, Math.min(N - 1, i));
    if (i === cur) return;
    const prev = cur;
    cur = i;
    seen.add(i);
    if (isDeck()) {
      slides.forEach((s, k) => {
        s.classList.toggle("is-active", k === i);
        s.classList.toggle("before", k < i);
        s.inert = k !== i;
        s.setAttribute("aria-hidden", k !== i ? "true" : "false");
      });
    }
    [...ticks.children].forEach((t, k) => {
      t.classList.toggle("cur", k === i);
      t.classList.toggle("seen", seen.has(k));
      if (k === i) t.setAttribute("aria-current", "step"); else t.removeAttribute("aria-current");
    });
    [...toc.querySelectorAll("button")].forEach((b, k) => b.classList.toggle("cur", k === i));
    count.innerHTML = `<b>${i + 1}</b> / ${N}`;
    secName.textContent = slides[i].dataset.section || "";
    try { history.replaceState(null, "", "#" + slides[i].id); } catch (e) { /* file:// */ }
    if (prev >= 0) onLeave?.(slides[prev]);
    onEnter?.(slides[i]);
    if (focus && isDeck()) slides[i].focus({ preventScroll: true });
  }

  const next = () => go(cur + 1);
  const prev = () => go(cur - 1);
  $("next").addEventListener("click", next);
  $("prev").addEventListener("click", prev);

  function openToc() { toc.hidden = false; toc.querySelector("button.cur")?.focus(); }
  function closeToc() { toc.hidden = true; }
  $("toc-btn").addEventListener("click", () => (toc.hidden ? openToc() : closeToc()));

  function fullscreen() {
    if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
    else root.requestFullscreen?.().catch(() => {});
  }
  $("fs-btn").addEventListener("click", fullscreen);

  document.addEventListener("keydown", (e) => {
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    const tag = (e.target.tagName || "").toLowerCase();
    if (tag === "input" || tag === "textarea" || tag === "select") return;
    const k = e.key;
    if (k === "Escape") {
      if (!toc.hidden) { closeToc(); return; }
      document.dispatchEvent(new CustomEvent("deck:escape"));
      return;
    }
    if (k === "o" || k === "O" || k === "щ" || k === "Щ") { toc.hidden ? openToc() : closeToc(); return; }
    if (k === "f" || k === "F" || k === "а" || k === "А") { fullscreen(); return; }
    if (!isDeck()) return;
    if (k === "ArrowRight" || k === "PageDown" || (k === " " && !e.shiftKey && tag !== "button")) { e.preventDefault(); next(); }
    else if (k === "ArrowLeft" || k === "PageUp" || (k === " " && e.shiftKey && tag !== "button")) { e.preventDefault(); prev(); }
    else if (k === "Home") { e.preventDefault(); go(0); }
    else if (k === "End") { e.preventDefault(); go(N - 1); }
  });

  // Свайпи на сенсорних екранах у режимі презентації
  let sx = null, sy = null, st = 0;
  const deckEl = document.getElementById("deck");
  deckEl.addEventListener("touchstart", (e) => { if (e.touches.length === 1) { sx = e.touches[0].clientX; sy = e.touches[0].clientY; st = Date.now(); } }, { passive: true });
  deckEl.addEventListener("touchend", (e) => {
    if (sx == null || !isDeck()) return;
    const t = e.changedTouches[0], dx = t.clientX - sx, dy = t.clientY - sy;
    if (Math.abs(dx) > 60 && Math.abs(dy) < 50 && Date.now() - st < 600) (dx < 0 ? next : prev)();
    sx = null;
  }, { passive: true });

  // Режим прокручування: поточний слайд — той, що найбільше у видимій області
  const io = new IntersectionObserver((entries) => {
    if (isDeck()) return;
    entries.forEach((en) => { if (en.isIntersecting && en.intersectionRatio > 0.45) go(slides.indexOf(en.target)); });
  }, { threshold: [0.45, 0.6] });
  slides.forEach((s) => io.observe(s));

  function applyMode(deck) {
    root.classList.toggle("deck-mode", deck);
    if (!deck) slides.forEach((s) => { s.inert = false; s.removeAttribute("aria-hidden"); s.classList.remove("is-active", "before"); });
    const i = cur < 0 ? 0 : cur;
    cur = -1;
    go(i);
    if (!deck) slides[i].scrollIntoView({ block: "start" });
    onModeChange?.(deck);
  }
  const mq = matchMedia(DECK_MQ);
  mq.addEventListener("change", (e) => applyMode(e.matches));

  // Старт: слайд з якоря (#id або #номер)
  const fromHash = () => {
    const hash = decodeURIComponent(location.hash.slice(1));
    let i = slides.findIndex((s) => s.id === hash);
    if (i < 0 && /^\d+$/.test(hash)) i = Math.min(N, +hash) - 1;
    return i;
  };
  addEventListener("hashchange", () => {
    const i = fromHash();
    if (i >= 0 && i !== cur) { go(i); if (!isDeck()) slides[i].scrollIntoView({ block: "start" }); }
  });
  let start = fromHash();
  if (start < 0) start = 0;
  root.classList.toggle("deck-mode", mq.matches);
  go(start);
  if (!mq.matches && start > 0) slides[start].scrollIntoView({ block: "start" });
  slides.forEach((s) => s.setAttribute("tabindex", "-1"));

  return { go, current: () => slides[cur] };
}

export function initTheme() {
  const btn = document.getElementById("theme-btn");
  const order = ["auto", "light", "dark"];
  const label = { auto: "Тема: авто", light: "Тема: світла", dark: "Тема: темна" };
  let mode = document.documentElement.dataset.theme || "auto";
  const apply = () => {
    if (mode === "auto") delete document.documentElement.dataset.theme;
    else document.documentElement.dataset.theme = mode;
    btn.textContent = label[mode];
    try { localStorage.setItem("pb-deck-theme", mode); } catch (e) { /* приватний режим */ }
  };
  btn.addEventListener("click", () => { mode = order[(order.indexOf(mode) + 1) % 3]; apply(); });
  document.addEventListener("keydown", (e) => {
    if ((e.key === "t" || e.key === "T" || e.key === "е" || e.key === "Е") && !e.ctrlKey && !e.metaKey && !e.altKey) btn.click();
  });
  apply();
}
