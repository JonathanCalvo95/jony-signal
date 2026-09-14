// Compara lo que calcula el server contra una captura de la planilla Luna Signal.
// Uso: node scripts/verify-luna.mjs            (usa la captura del 11/09/2026 incluida acá)
// Solo es exacto el mismo día de la captura; otros días sirve para ver la tabla calculada.
import { fetchQuotes, fetchHistory, fetchAnchorClose } from '../services/yahoo.js';
import { computeMetrics, mergeLive, prevCloseFromBars } from '../services/signals.js';
import { localDate, addMonths } from '../services/dates.js';

// ticker: [precio, rsi, %24hs, 30, low, high, buy, sell, conviccion, señal, anual, 5 años]
const SHEET = {
  QQQ:   [714.88, 50.8,  0.55,   3.91,  555.6,   748.63,  652.115,  719.6755, 21, 'VENTA',          22.39,  89.96],
  SPY:   [764.29, 50.3,  2.49,   2.31,  629.28,  779.37,  704.325,  756.8565, 16, 'VENTA_FUERTE',   16.22,  71.14],
  DIA:   [525.79, 45.1,  0.69,   0.28,  450.44,  546.75,  498.595,  532.3035, 29, 'VENTA',          13.83,  50.53],
  XLE:   [65.14,  66.1,  1.94,   9.39,  42.35,   66.17,   54.26,    62.597,   15, 'VENTA_FUERTE',   46.15,  null],
  XLF:   [57.25,  48.3,  4.37,   0.54,  47.67,   58.6,    53.135,   56.9605,  16, 'VENTA_FUERTE',   5.96,   null],
  EWZ:   [38.19,  65.1,  2.59,   4.20,  28.65,   42.02,   35.335,   40.0145,  41, 'HOLD',           27.09,  null],
  EEM:   [67.84,  55.1,  2.75,   5.85,  51.1,    71.57,   61.335,   68.4995,  22, 'VENTA',          29.74,  28.90],
  '^RUT':[2903.94,38.8,  1.75,  -0.93,  2303.46, 3069.71, 2686.585, 2954.7725,29, 'VENTA',          19.92,  29.60],
  FXI:   [34.49,  40.6,  8.37,  -5.51,  31.19,   42,      36.595,   40.3785,  82, 'COMPRA_FUERTE', -15.34, -16.85],
  ADBE:  [252.23, 42.5,  1.47,   0.73,  190.12,  370.86,  280.49,   343.749,  82, 'COMPRA_FUERTE', -28.05, -60.90],
  AMAT:  [456.49, 41.7,  2.61, -10.08,  167.19,  739.67,  453.43,   653.798,  79, 'COMPRA',        168.29, 227.37],
  AMD:   [516.13, 58.0,  0.15,   8.40,  149.85,  584.73,  367.29,   519.498,  18, 'VENTA_FUERTE',  231.55,  null],
  BABA:  [109.3,  36.6, -0.47, -10.59,  91.99,   192.67,  142.33,   177.568,  83, 'COMPRA_FUERTE', -29.68,  null],
  GOOGL: [338.5,  46.8,  3.82,  -4.95,  235.84,  408.61,  322.225,  382.6945, 63, 'COMPRA',         40.82,  null],
  AMZN:  [256.78, 48.9, -0.54,  -5.45,  196,     287.16,  241.58,   273.486,  50, 'HOLD',           11.67,  null],
  CSCO:  [112.13, 50.9,  0.65,  -3.33,  66.13,   130.37,  98.25,    120.734,  41, 'HOLD',           65.65,  92.99],
  EBAY:  [107.75, 53.7,  0.49,  -5.49,  78.03,   119.31,  98.67,    113.118,  40, 'HOLD',           16.54,  48.27],
  GLOB:  [37.75,  49.0,  0.89,   3.14,  27.56,   72.1,    49.83,    65.419,   83, 'COMPRA_FUERTE', -35.47, -88.09],
  AAPL:  [332.27, 62.8,  0.32,   7.56,  229.02,  344.57,  286.795,  327.2375, 16, 'VENTA_FUERTE',   44.45, 122.18],
  HPQ:   [35.48,  71.1, -1.74,  30.11,  17.56,   36.23,   26.895,   33.4295,  16, 'VENTA_FUERTE',   25.19,  25.02],
  IBM:   [243.29, 56.8,  2.88,   8.78,  199.19,  332.46,  265.825,  312.4695, 82, 'COMPRA_FUERTE',  -5.34,  null],
  INFY:  [11.07,  38.3,  1.94,  -7.98,  10.3,    30,      20.15,    27.045,   85, 'COMPRA_FUERTE', -35.15,  null],
  INTC:  [102.94, 57.5,  0.20,  14.12,  24.05,   142.34,  83.195,   124.5965, 50, 'HOLD',          318.29,  null],
  JD:    [27.06,  32.1,  2.90, -18.02,  24.51,   36.86,   30.685,   35.0075,  83, 'COMPRA_FUERTE', -21.34,  null],
  MELI:  [1897.37,48.8,  1.62,   1.03,  1495,    2548.5,  2021.75,  2390.475, 81, 'COMPRA_FUERTE', -18.85,   2.42],
  TXN:   [268.7,  51.7,  1.83,  -2.55,  152.76,  334.03,  243.395,  306.8395, 55, 'HOLD',           45.76,  38.52],
  MRK:   [143.93, 50.4,  0.77,  10.55,  77.58,   156.92,  117.25,   145.019,  19, 'VENTA_FUERTE',   69.03,  96.68],
  MSFT:  [495.63, 56.7,  1.22,   6.65,  349.2,   553.72,  451.46,   523.042,  41, 'HOLD',           -1.07,  66.88],
  MSI:   [466.16, 50.2,  0.52,   6.98,  359.36,  494.85,  427.105,  474.5265, 28, 'VENTA',          -4.92,  92.83],
  BIDU:  [91.4,   37.4,  3.82, -17.74,  89.6,    165.3,   127.45,   153.945,  85, 'COMPRA_FUERTE', -18.26, -44.02],
};
const COLS = ['price', 'rsi', 'change24h', 'change30', 'weekLow52', 'weekHigh52', 'buy', 'sell', 'conviction', 'signal', 'change1y', 'change5y'];
// %24HS no se compara: en la captura esa columna no coincidía con ninguna variación real
// (SPY +2,49% con QQQ +0,55% el mismo día, FXI +8,37%...) — celdas de GOOGLEFINANCE desfasadas.
const SKIP = new Set(['change24h']);

const symbols = Object.keys(SHEET);
const quotes = await fetchQuotes(symbols);
let mismatches = 0;
for (const sym of symbols) {
  const h = await fetchHistory(sym);
  const q = quotes.get(sym);
  const marketDate = q ? localDate(q.sessionTs, h.gmtoffset) : h.bars.at(-1).d;
  const price = q?.price ?? h.bars.at(-1).c;
  const bars = mergeLive(h.bars, marketDate, price);
  const anchor = await fetchAnchorClose(sym, addMonths(marketDate, -60));
  const m = computeMetrics({ bars, price, prevClose: q?.prevClose ?? prevCloseFromBars(bars, marketDate), marketDate, anchor5y: anchor?.c ?? null, firstTradeDate: h.firstTradeDate });
  const diffs = [];
  COLS.forEach((k, i) => {
    const exp = SHEET[sym][i], got = m[k];
    if (exp == null || SKIP.has(k)) return;
    const ok = typeof exp === 'string' ? got === exp : Math.abs(got - exp) <= (k === 'conviction' ? 1 : 0.06);
    if (!ok) diffs.push(`${k}: ${got} ≠ ${exp}`);
  });
  if (diffs.length) mismatches++;
  console.log(sym.padEnd(6), marketDate, diffs.length ? '✗ ' + diffs.join(' | ') : '✓');
}
console.log(`\n${symbols.length - mismatches}/${symbols.length} filas coinciden con la planilla (tolerancia 0,06 / ±1 en convicción; %24HS excluido)`);
