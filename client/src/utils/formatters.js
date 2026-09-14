// Formato numérico de la planilla (es-AR): coma decimal, sin separador de miles.
//   "714,88" · "109,3" · "2954,7725" · "50,8" · "-0,93%"

const cache = new Map();
function nf(min, max) {
  const key = `${min}/${max}`;
  if (!cache.has(key)) {
    cache.set(key, new Intl.NumberFormat('es-AR', { minimumFractionDigits: min, maximumFractionDigits: max, useGrouping: false }));
  }
  return cache.get(key);
}

/** Formato "automático" de Sheets: hasta `max` decimales, sin ceros a la derecha. Valores < 1 (cripto chica) muestran todas sus cifras. */
export function fmtAuto(n, max = 2) {
  if (n == null || !Number.isFinite(n)) return '--';
  return nf(0, Math.abs(n) < 1 ? 10 : max).format(n);
}

export function fmtFixed(n, decimals) {
  if (n == null || !Number.isFinite(n)) return '--';
  return nf(decimals, decimals).format(n);
}

export function fmtPct(n) {
  if (n == null || !Number.isFinite(n)) return '--';
  return nf(2, 2).format(n) + '%';
}

export const fmtPrice = (n) => fmtAuto(n, 2);
export const fmtTarget = (n) => fmtAuto(n, 4);
export const fmtRsi = (n) => fmtFixed(n, 1);
export const fmtInt = (n) => fmtFixed(n, 0);

export function fmtTime(ts) {
  if (!ts) return '--:--:--';
  return new Date(ts).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}
