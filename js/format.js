/** Форматування чисел в українському стилі (пробіл — розряди, кома — дробова частина). */

const NBSP = ' '; // вузький нерозривний пробіл

export function fmtInt(v) {
  if (v == null || Number.isNaN(v)) return '—';
  return Math.round(v).toLocaleString('uk-UA').replace(/\s/g, NBSP);
}

/** Компактна сума в гривнях: 4,8 млн грн / 2,9 млрд грн / 850 тис. грн. */
export function fmtUAH(v, { unit = true } = {}) {
  if (v == null || Number.isNaN(v)) return '—';
  const sfx = unit ? `${NBSP}грн` : '';
  const one = (x) => x.toLocaleString('uk-UA', { maximumFractionDigits: 1 });
  if (Math.abs(v) >= 1e9) return `${one(v / 1e9)}${NBSP}млрд${sfx}`;
  if (Math.abs(v) >= 1e6) return `${one(v / 1e6)}${NBSP}млн${sfx}`;
  if (Math.abs(v) >= 1e3) return `${one(v / 1e3)}${NBSP}тис.${sfx}`;
  return `${fmtInt(v)}${sfx}`;
}

/** Значення обраного показника з одиницею. */
export function fmtMetric(v, metric) {
  if (v == null) return '—';
  if (metric === 'amount') return fmtUAH(v);
  return fmtInt(v);
}

export const METRIC_LABELS = {
  amount: 'сума фінансування',
  applications: 'подані заявки',
  winners: 'проєкти-переможці',
};

/** Підпис для читання року: «519 млн грн сумарно» / «5 172 заявки». */
export function totalReadout(totals, metric) {
  if (metric === 'amount') return `${fmtUAH(totals.amount)} сумарно`;
  if (metric === 'applications') return `${fmtInt(totals.applications)} заявок`;
  return `${fmtInt(totals.winners)} проєктів-переможців`;
}
