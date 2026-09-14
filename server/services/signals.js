import { calculateRSI } from './rsi.js';
import { addDays, addMonths, minusWeekdays } from './dates.js';

// ── Fórmulas de la planilla Luna Signal ─────────────────────────────────────
// Reproducidas a partir de los valores publicados (ver server/test/signals.test.js).
//
//   BUY        = LOW + 50% del rango 52W  (punto medio)
//   SELL       = LOW + 85% del rango 52W
//   CONVICCION = lineal por tramos según la posición del precio en el rango 52W:
//                85 en el mínimo → 80 en BUY → 16.5 en SELL → 15 en el máximo
//   SEÑAL      = por convicción: ≥80 Compra Fuerte · ≥60 Compra · ≥40 Hold · ≥20 Venta · <20 Venta Fuerte
//   30         = variación contra el cierre de 30 días hábiles atrás (WORKDAY(hoy, -30))
//   Anual      = variación contra el cierre del primer día hábil ≥ hoy − 12 meses
//   5 Años     = variación contra el cierre del primer día hábil ≥ hoy − 60 meses
//   RSI        = Wilder, 14 períodos, sobre cierres diarios (incluida la sesión en curso)

export const BUY_PCT  = 0.50;
export const SELL_PCT = 0.85;

export const SIGNALS = ['COMPRA_FUERTE', 'COMPRA', 'HOLD', 'VENTA', 'VENTA_FUERTE'];

export function round(n, decimals = 2) {
  const f = 10 ** decimals;
  return Math.round(n * f) / f;
}

/** Redondeo de precios: 2 decimales; por debajo de 1 (cripto chica) 4 cifras significativas. */
export function roundPrice(n) {
  if (n == null || !Number.isFinite(n)) return null;
  return Math.abs(n) >= 1 ? round(n, 2) : Number(n.toPrecision(4));
}

/** BUY/SELL salen con 4 decimales como en la planilla; por debajo de 1, 5 cifras significativas. */
function roundTarget(n) {
  return Math.abs(n) >= 1 ? round(n, 4) : Number(n.toPrecision(5));
}

export function pct(value, base) {
  if (value == null || base == null || !(base > 0)) return null;
  return round((value / base - 1) * 100, 2);
}

export function computeTargets(low, high) {
  if (low == null || high == null || !(high > low)) return { buy: null, sell: null };
  const range = high - low;
  return {
    buy:  roundTarget(low + BUY_PCT  * range),
    sell: roundTarget(low + SELL_PCT * range),
  };
}

/** Posición del precio dentro del rango 52W: 0 = mínimo, 1 = máximo. */
export function rangePosition(price, low, high) {
  if (price == null || low == null || high == null || !(high > low)) return null;
  return Math.min(1, Math.max(0, (price - low) / (high - low)));
}

export function conviction(pos) {
  if (pos == null) return null;
  let c;
  if (pos <= BUY_PCT)       c = 85 - 10 * pos;
  else if (pos <= SELL_PCT) c = 80 - 63.5 * (pos - BUY_PCT) / (SELL_PCT - BUY_PCT);
  else                      c = 25 - 10 * pos;
  return Math.round(c);
}

export function signalFor(conv) {
  if (conv == null) return null;
  if (conv >= 80) return 'COMPRA_FUERTE';
  if (conv >= 60) return 'COMPRA';
  if (conv >= 40) return 'HOLD';
  if (conv >= 20) return 'VENTA';
  return 'VENTA_FUERTE';
}

/** Cierre del primer día hábil con fecha ≥ iso (semántica de GOOGLEFINANCE con fechas no hábiles). */
export function closeOnOrAfter(bars, iso, firstTradeDate = null) {
  if (firstTradeDate && iso < firstTradeDate) return null; // el papel todavía no cotizaba
  const bar = bars.find((b) => b.d >= iso);
  return bar ? bar.c : null;
}

/** Reemplaza (o agrega) la vela de la sesión actual con el último precio. */
export function mergeLive(bars, marketDate, price) {
  if (price == null) return bars;
  const last = bars[bars.length - 1];
  if (!last || last.d < marketDate) return [...bars, { d: marketDate, c: price, h: price, l: price }];
  if (last.d === marketDate) {
    return [...bars.slice(0, -1), { d: last.d, c: price, h: Math.max(last.h ?? price, price), l: Math.min(last.l ?? price, price) }];
  }
  return bars;
}

export function prevCloseFromBars(bars, marketDate) {
  const last = bars[bars.length - 1];
  if (!last) return null;
  if (last.d === marketDate) return bars[bars.length - 2]?.c ?? null;
  return last.c;
}

/**
 * Calcula todas las columnas de la planilla para un papel.
 * @param {Object} p
 * @param {Array<{d:string,c:number,h:number,l:number}>} p.bars   velas diarias (más vieja primero) con la sesión actual incluida
 * @param {number}      p.price          último precio
 * @param {number|null} p.prevClose      cierre de la sesión anterior
 * @param {string}      p.marketDate     fecha (YYYY-MM-DD) de la última sesión — el TODAY() de la planilla
 * @param {number|null} p.anchor5y       cierre del primer día hábil ≥ marketDate − 60 meses
 * @param {string|null} p.firstTradeDate primera fecha con cotización (para no inventar variaciones en IPOs recientes)
 */
export function computeMetrics({ bars, price, prevClose, marketDate, anchor5y = null, firstTradeDate = null }) {
  const closes = bars.map((b) => b.c);
  const rsi = calculateRSI(closes);

  // Rango 52 semanas: desde el día siguiente a la misma fecha del año anterior, con máximos/mínimos intradiarios
  const from = addDays(marketDate, -365);
  let low = Infinity, high = -Infinity;
  for (const b of bars) {
    if (b.d <= from) continue;
    const l = b.l ?? b.c, h = b.h ?? b.c;
    if (l < low) low = l;
    if (h > high) high = h;
  }
  if (price != null) { low = Math.min(low, price); high = Math.max(high, price); }
  const weekLow52  = Number.isFinite(low)  ? roundPrice(low)  : null;
  const weekHigh52 = Number.isFinite(high) ? roundPrice(high) : null;

  const { buy, sell } = computeTargets(weekLow52, weekHigh52);
  const conv = conviction(rangePosition(price, weekLow52, weekHigh52));

  return {
    price,
    change24h: pct(price, prevClose),
    rsi,
    change30:  pct(price, closeOnOrAfter(bars, minusWeekdays(marketDate, 30), firstTradeDate)),
    weekLow52,
    weekHigh52,
    buy,
    sell,
    conviction: conv,
    signal: signalFor(conv),
    change1y:  pct(price, closeOnOrAfter(bars, addMonths(marketDate, -12), firstTradeDate)),
    change5y:  pct(price, anchor5y),
  };
}
