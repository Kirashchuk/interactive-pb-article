/**
 * Спільний тултип для всіх візуалізацій.
 * Вміст збирається лише через textContent — назви міст/рядів не вставляються як HTML.
 */

const el = () => document.getElementById('viz-tooltip');

function row(label, value, keyColor) {
  const r = document.createElement('div');
  r.className = 'tt-row';
  const l = document.createElement('span');
  if (keyColor) {
    const key = document.createElement('span');
    key.style.cssText = `display:inline-block;width:12px;height:2.5px;border-radius:2px;vertical-align:middle;margin-right:6px;background:${keyColor}`;
    l.appendChild(key);
  }
  l.appendChild(document.createTextNode(label));
  const v = document.createElement('span');
  v.className = 'v';
  v.textContent = value;
  r.append(l, v);
  return r;
}

/**
 * show(event, { title, rows: [[label, value, keyColor?]], note })
 */
export function showTooltip(event, { title, rows = [], note }) {
  const t = el();
  t.replaceChildren();
  if (title) {
    const h = document.createElement('div');
    h.className = 'tt-title';
    h.textContent = title;
    t.appendChild(h);
  }
  for (const [label, value, keyColor] of rows) t.appendChild(row(label, value, keyColor));
  if (note) {
    const n = document.createElement('div');
    n.className = 'tt-note';
    n.textContent = note;
    t.appendChild(n);
  }
  t.classList.add('visible');
  t.setAttribute('aria-hidden', 'false');
  moveTooltip(event);
}

export function moveTooltip(event) {
  const t = el();
  const pad = 14;
  const { innerWidth: w, innerHeight: h } = window;
  const r = t.getBoundingClientRect();
  let x = event.clientX + pad;
  let y = event.clientY + pad;
  if (x + r.width + 8 > w) x = event.clientX - r.width - pad;
  if (y + r.height + 8 > h) y = event.clientY - r.height - pad;
  t.style.left = `${Math.max(8, x)}px`;
  t.style.top = `${Math.max(8, y)}px`;
}

export function hideTooltip() {
  const t = el();
  t.classList.remove('visible');
  t.setAttribute('aria-hidden', 'true');
}
