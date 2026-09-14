import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeTargets, conviction, rangePosition, signalFor, computeMetrics, mergeLive, prevCloseFromBars } from '../services/signals.js';
import { addMonths, minusWeekdays, addDays, localDate } from '../services/dates.js';

// Filas de la planilla Luna Signal del 11/09/2026 (cierre): PRECIO, WEEK LOW, WEEK HIGH → BUY, SELL, CONVICCION, SEÑAL
const SHEET = [
  ['QQQ',   714.88,   555.6,   748.63,  652.115,  719.6755, 21, 'VENTA'],
  ['SPY',   764.29,   629.28,  779.37,  704.325,  756.8565, 16, 'VENTA_FUERTE'],
  ['DIA',   525.79,   450.44,  546.75,  498.595,  532.3035, 29, 'VENTA'],
  ['ARKK',    9.28,     6.74,    9.73,    8.235,    9.2815, 17, 'VENTA_FUERTE'],
  ['XLE',    65.14,    42.35,   66.17,   54.26,    62.597,  15, 'VENTA_FUERTE'],
  ['XLF',    57.25,    47.67,   58.6,    53.135,   56.9605, 16, 'VENTA_FUERTE'],
  ['EWZ',    38.19,    28.65,   42.02,   35.335,   40.0145, 41, 'HOLD'],
  ['EEM',    67.84,    51.1,    71.57,   61.335,   68.4995, 22, 'VENTA'],
  ['RUT',  2903.94,  2303.46, 3069.71, 2686.585, 2954.7725, 29, 'VENTA'],
  ['FXI',    34.49,    31.19,   42,      36.595,   40.3785, 82, 'COMPRA_FUERTE'],
  ['ADBE',  252.23,   190.12,  370.86,  280.49,   343.749,  82, 'COMPRA_FUERTE'],
  ['AMAT',  456.49,   167.19,  739.67,  453.43,   653.798,  79, 'COMPRA'],
  ['AMD',   516.13,   149.85,  584.73,  367.29,   519.498,  18, 'VENTA_FUERTE'],
  ['BABA',  109.3,     91.99,  192.67,  142.33,   177.568,  83, 'COMPRA_FUERTE'],
  ['GOOGL', 338.5,    235.84,  408.61,  322.225,  382.6945, 63, 'COMPRA'],
  ['AMZN',  256.78,   196,     287.16,  241.58,   273.486,  50, 'HOLD'],
  ['CSCO',  112.13,    66.13,  130.37,   98.25,   120.734,  41, 'HOLD'],
  ['EBAY',  107.75,    78.03,  119.31,   98.67,   113.118,  40, 'HOLD'],
  ['GLOB',   37.75,    27.56,   72.1,    49.83,    65.419,  83, 'COMPRA_FUERTE'],
  ['AAPL',  332.27,   229.02,  344.57,  286.795,  327.2375, 16, 'VENTA_FUERTE'],
  ['IBM',   243.29,   199.19,  332.46,  265.825,  312.4695, 82, 'COMPRA_FUERTE'],
  ['INFY',   11.07,    10.3,    30,      20.15,    27.045,  85, 'COMPRA_FUERTE'],
  ['INTC',  102.94,    24.05,  142.34,   83.195,  124.5965, 50, 'HOLD'],
  ['JD',     27.06,    24.51,   36.86,   30.685,   35.0075, 83, 'COMPRA_FUERTE'],
  ['MELI', 1897.37,  1495,    2548.5,  2021.75,  2390.475,  81, 'COMPRA_FUERTE'],
  ['TXN',   268.7,    152.76,  334.03,  243.395,  306.8395, 55, 'HOLD'],
  ['MRK',   143.93,    77.58,  156.92,  117.25,   145.019,  19, 'VENTA_FUERTE'],
  ['MSFT',  495.63,   349.2,   553.72,  451.46,   523.042,  41, 'HOLD'],
  ['MSI',   466.16,   359.36,  494.85,  427.105,  474.5265, 28, 'VENTA'],
  ['BIDU',   91.4,     89.6,   165.3,   127.45,   153.945,  85, 'COMPRA_FUERTE'],
];

test('BUY y SELL reproducen la planilla (LOW + 50% / LOW + 85% del rango 52W)', () => {
  for (const [ticker, , low, high, buy, sell] of SHEET) {
    const t = computeTargets(low, high);
    assert.equal(t.buy,  buy,  `${ticker} BUY`);
    assert.equal(t.sell, sell, `${ticker} SELL`);
  }
});

test('CONVICCION y SEÑAL reproducen la planilla', () => {
  for (const [ticker, price, low, high, , , conv, signal] of SHEET) {
    const c = conviction(rangePosition(price, low, high));
    assert.equal(c, conv, `${ticker} CONVICCION`);
    assert.equal(signalFor(c), signal, `${ticker} SEÑAL`);
  }
});

test('HPQ: la planilla mostraba 16 con celdas recalculadas a distinta hora; la fórmula da 15 (±1)', () => {
  // HPQ cerró +8,4% ese día y su %24HS en la planilla decía -1,74%: las celdas no estaban sincronizadas.
  const c = conviction(rangePosition(35.48, 17.56, 36.23));
  assert.ok(Math.abs(c - 16) <= 1, `HPQ CONVICCION ${c}`);
  assert.equal(signalFor(c), 'VENTA_FUERTE');
});

test('la convicción es continua en BUY y SELL y va de 85 a 15', () => {
  assert.equal(conviction(0), 85);
  assert.equal(conviction(0.5), 80);
  assert.equal(Math.round(conviction(0.85)), 17);   // 16.5 exacto, redondea a 17
  assert.equal(conviction(1), 15);
  assert.equal(conviction(null), null);
});

test('umbrales de señal cada 20 puntos', () => {
  assert.equal(signalFor(80), 'COMPRA_FUERTE');
  assert.equal(signalFor(79), 'COMPRA');
  assert.equal(signalFor(60), 'COMPRA');
  assert.equal(signalFor(59), 'HOLD');
  assert.equal(signalFor(40), 'HOLD');
  assert.equal(signalFor(39), 'VENTA');
  assert.equal(signalFor(20), 'VENTA');
  assert.equal(signalFor(19), 'VENTA_FUERTE');
  assert.equal(signalFor(null), null);
});

test('rango inválido → sin targets ni señal', () => {
  assert.deepEqual(computeTargets(10, 10), { buy: null, sell: null });
  assert.equal(rangePosition(5, 10, 10), null);
  assert.equal(signalFor(conviction(rangePosition(5, 10, 10))), null);
});

test('fechas: WORKDAY(-30), EDATE(-12/-60) y fecha local del exchange', () => {
  assert.equal(minusWeekdays('2026-09-11', 30), '2026-07-31');   // la columna "30" del 11/09 apuntaba al cierre del 31/07
  assert.equal(minusWeekdays('2026-09-14', 1), '2026-09-11');    // lunes → viernes anterior
  assert.equal(addMonths('2026-09-11', -12), '2025-09-11');
  assert.equal(addMonths('2026-09-11', -60), '2021-09-11');
  assert.equal(addMonths('2024-02-29', -12), '2023-02-28');      // recorta al último día del mes
  assert.equal(addDays('2026-09-11', -365), '2025-09-11');
  assert.equal(localDate(1789133400, -14400), '2026-09-11');     // 9:30 ET del 11/09
  assert.equal(localDate(1789189264, 0), '2026-09-12');          // cripto: fecha UTC
});

test('mergeLive y prevCloseFromBars', () => {
  const bars = [{ d: '2026-09-10', c: 10, h: 11, l: 9 }, { d: '2026-09-11', c: 12, h: 12.5, l: 11.5 }];
  const same = mergeLive(bars, '2026-09-11', 13);
  assert.equal(same.length, 2);
  assert.deepEqual(same[1], { d: '2026-09-11', c: 13, h: 13, l: 11.5 });
  const next = mergeLive(bars, '2026-09-14', 12.2);
  assert.equal(next.length, 3);
  assert.deepEqual(next[2], { d: '2026-09-14', c: 12.2, h: 12.2, l: 12.2 });
  assert.equal(prevCloseFromBars(same, '2026-09-11'), 10);
  assert.equal(prevCloseFromBars(bars, '2026-09-14'), 12);
});

test('computeMetrics: 52W con máximos intradiarios, anclas y variaciones', () => {
  // 400 días hábiles sintéticos terminando el 11/09/2026: precio constante 100 salvo hitos conocidos
  const bars = [];
  let d = '2025-01-01';
  while (d <= '2026-09-11') {
    const dow = new Date(d + 'T00:00:00Z').getUTCDay();
    if (dow !== 0 && dow !== 6) bars.push({ d, c: 100, h: 100, l: 100 });
    d = addDays(d, 1);
  }
  const at = (iso) => bars.find((b) => b.d === iso);
  at('2025-09-11').c = 80;   // ancla anual (primer día hábil ≥ 2025-09-11)
  at('2025-09-12').l = 60;   // mínimo 52W (justo dentro de la ventana: fecha > 2025-09-11)
  at('2025-09-11').l = 10;   // fuera de la ventana: no debe contar
  at('2026-07-31').c = 125;  // ancla de la columna "30" (WORKDAY(-30) = 31/07)
  at('2026-03-02').h = 140;  // máximo 52W

  const m = computeMetrics({ bars, price: 110, prevClose: 100, marketDate: '2026-09-11', anchor5y: 55 });
  assert.equal(m.change24h, 10);
  assert.equal(m.weekLow52, 60);
  assert.equal(m.weekHigh52, 140);
  assert.equal(m.buy, 100);
  assert.equal(m.sell, 128);
  assert.equal(m.change30, -12);        // 110 / 125 − 1
  assert.equal(m.change1y, 37.5);       // 110 / 80 − 1
  assert.equal(m.change5y, 100);        // 110 / 55 − 1
  assert.equal(m.conviction, conviction(rangePosition(110, 60, 140)));
  assert.equal(m.signal, signalFor(m.conviction));
  assert.equal(typeof m.rsi, 'number');
});

test('computeMetrics: IPO reciente no inventa variaciones anuales', () => {
  const bars = [];
  let d = '2026-06-01';
  while (d <= '2026-09-11') {
    const dow = new Date(d + 'T00:00:00Z').getUTCDay();
    if (dow !== 0 && dow !== 6) bars.push({ d, c: 50, h: 50, l: 50 });
    d = addDays(d, 1);
  }
  const m = computeMetrics({ bars, price: 55, prevClose: 50, marketDate: '2026-09-11', anchor5y: null, firstTradeDate: '2026-06-01' });
  assert.equal(m.change1y, null);
  assert.equal(m.change5y, null);
  assert.equal(m.change30, 10);         // sí hay datos a 30 días hábiles
});
