import { fetchQuotes, fetchHistory, fetchAnchorClose, SPARK_BATCH } from './yahoo.js';
import { computeMetrics, mergeLive, prevCloseFromBars, pct } from './signals.js';
import { localDate, addMonths } from './dates.js';
import { broadcastWatchlist } from './broadcast.js';
import { getSymbols, getEntry, ensureUniverse, startUniverseRefresh, getUniverseMeta } from './universe.js';

// Caché en memoria + scheduler. El universo de papeles lo define universe.js. Dos niveles de datos:
//   - cotizaciones (spark, 20 símbolos por request): cada minuto, para todos los papeles
//   - histórico diario (chart, ~30 KB por papel): al arrancar y después cada 1 h,
//     repartido en tandas chicas para no saturar a Yahoo
//   - ancla de 5 años (chart, ventana de 2 semanas): una vez por día por papel
// Las filas se arman combinando el histórico con el último precio (mergeLive), así
// el RSI, el rango 52W y las señales siguen al precio en vivo sin rebajar el histórico.

const TICK_MS          = 60_000;        // cotizaciones
const HISTORY_TTL_MS   = 60 * 60_000;   // histórico
const HISTORY_PER_TICK = 12;            // históricos refrescados por minuto en régimen
const ANCHORS_PER_TICK = 30;
const BOOT_CONCURRENCY = 8;
const TICK_CONCURRENCY = 4;
const BACKOFF_BASE_MS  = 60_000;
const BACKOFF_MAX_MS   = 60 * 60_000;

const quotes    = new Map(); // symbol → { price, prevClose, sessionTs, ts }
const histories = new Map(); // symbol → { bars, gmtoffset, firstTradeDate, fetchedAt }
const anchors   = new Map(); // symbol → { date, close, fetchedAt, nextRetry }
const failures  = new Map(); // symbol → { count, nextRetry, message }

let quotesAt = 0;
let booting  = false;
let ticking  = false;
let resolveQuotesReady;
const quotesReady = new Promise((r) => { resolveQuotesReady = r; });

const EMPTY_METRICS = {
  price: null, change24h: null, rsi: null, change30: null, weekLow52: null, weekHigh52: null,
  buy: null, sell: null, conviction: null, signal: null, change1y: null, change5y: null,
};

async function runPool(items, concurrency, fn) {
  let i = 0;
  const workers = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (i < items.length) await fn(items[i++]);
  });
  await Promise.all(workers);
}

function noteFailure(sym, err) {
  const count = (failures.get(sym)?.count ?? 0) + 1;
  const wait  = Math.min(BACKOFF_MAX_MS, BACKOFF_BASE_MS * 2 ** (count - 1));
  failures.set(sym, { count, nextRetry: Date.now() + wait, message: err.message });
}

function canRetry(sym) {
  const f = failures.get(sym);
  return !f || f.nextRetry <= Date.now();
}

function marketDateOf(sym) {
  const q = quotes.get(sym), h = histories.get(sym);
  if (q) return localDate(q.sessionTs, h?.gmtoffset ?? 0);
  return h?.bars[h.bars.length - 1]?.d ?? null;
}

// ── Cotizaciones ─────────────────────────────────────────────────────────────
async function refreshQuotes(symbols) {
  const chunks = [];
  for (let i = 0; i < symbols.length; i += SPARK_BATCH) chunks.push(symbols.slice(i, i + SPARK_BATCH));
  let ok = false;
  await runPool(chunks, TICK_CONCURRENCY, async (chunk) => {
    try {
      const got = await fetchQuotes(chunk);
      for (const [sym, q] of got) quotes.set(sym, { ...q, ts: Date.now() });
      ok = true;
    } catch (e) {
      console.warn(`[quotes] ${e.message}`);
    }
  });
  if (ok) quotesAt = Date.now();
}

// ── Histórico ────────────────────────────────────────────────────────────────
async function loadHistory(sym) {
  try {
    const h = await fetchHistory(sym);
    histories.set(sym, h);
    failures.delete(sym);
    // Si spark no devuelve el símbolo, al menos tenemos el precio del chart
    if (!quotes.has(sym) && h.price != null && h.sessionTs) {
      const marketDate = localDate(h.sessionTs, h.gmtoffset);
      quotes.set(sym, { price: h.price, prevClose: prevCloseFromBars(h.bars, marketDate), sessionTs: h.sessionTs, ts: Date.now() });
    }
  } catch (e) {
    noteFailure(sym, e);
    console.warn(`[history] ${sym}: ${e.message}`);
  }
}

function needsHistory(sym, now) {
  const h = histories.get(sym);
  return (!h || now - h.fetchedAt > HISTORY_TTL_MS) && canRetry(sym);
}

// ── Ancla de 5 años ──────────────────────────────────────────────────────────
function anchorDateFor(sym) {
  const md = marketDateOf(sym);
  return md ? addMonths(md, -60) : null;
}

function needsAnchor(sym) {
  const date = anchorDateFor(sym);
  if (!date) return false;
  const a = anchors.get(sym);
  if (!a || a.date !== date) return true;
  return a.nextRetry != null && a.nextRetry <= Date.now();
}

async function loadAnchor(sym) {
  const date = anchorDateFor(sym);
  if (!date) return;
  try {
    const bar = await fetchAnchorClose(sym, date);
    anchors.set(sym, { date, close: bar?.c ?? null, fetchedAt: Date.now(), nextRetry: null });
  } catch (e) {
    anchors.set(sym, { date, close: anchors.get(sym)?.close ?? null, fetchedAt: Date.now(), nextRetry: Date.now() + 10 * 60_000 });
    console.warn(`[anchor] ${sym}: ${e.message}`);
  }
}

// ── Filas ────────────────────────────────────────────────────────────────────
function buildRow(sym) {
  const cat = getEntry(sym) ?? {};
  const base = {
    symbol: sym, ticker: cat.ticker ?? sym, nombre: cat.nombre ?? null, sector: cat.sector ?? null, tipo: cat.tipo ?? null,
    bymaTicker: cat.bymaTicker ?? null, ratio: cat.ratio ?? null,
  };
  const q = quotes.get(sym), h = histories.get(sym);
  const fail = failures.get(sym);

  if (!q && !h) {
    return { ...base, ...EMPTY_METRICS, marketDate: null, pending: !fail, error: fail?.message ?? null };
  }
  const marketDate = marketDateOf(sym);
  const price = q?.price ?? h.bars[h.bars.length - 1].c;
  if (!h) {
    return { ...base, ...EMPTY_METRICS, price, change24h: pct(price, q.prevClose), marketDate, pending: !fail, error: fail?.message ?? null };
  }
  const bars = mergeLive(h.bars, marketDate, price);
  const prevClose = q?.prevClose ?? prevCloseFromBars(bars, marketDate);
  const metrics = computeMetrics({
    bars, price, prevClose, marketDate,
    anchor5y: anchors.get(sym)?.close ?? null,
    firstTradeDate: h.firstTradeDate,
  });
  return { ...base, ...metrics, marketDate, pending: false, error: null };
}

export function getRows(symbols = getSymbols()) {
  return symbols.map(buildRow);
}

export function getMeta(symbols = getSymbols()) {
  return {
    updatedAt: quotesAt || null,
    loaded: symbols.filter((s) => histories.has(s)).length,
    total: symbols.length,
    booting,
    universe: getUniverseMeta(),
  };
}

export function broadcast(symbols = getSymbols()) {
  broadcastWatchlist({ rows: getRows(symbols), meta: getMeta(symbols) });
}

/** Espera a que estén las primeras cotizaciones (para el primer GET tras el arranque). */
export function ensureQuotes() {
  return quotesReady;
}

/** Refresco manual de cotizaciones (botón "actualizar"). */
export async function refreshNow() {
  const symbols = getSymbols();
  await refreshQuotes(symbols);
  broadcast(symbols);
}

/** Carga completa de un símbolo (vista previa de cualquier papel). Lanza si no existe en Yahoo. */
export async function loadSymbol(sym) {
  const h = await fetchHistory(sym);
  histories.set(sym, h);
  failures.delete(sym);
  try {
    const got = await fetchQuotes([sym]);
    if (got.has(sym)) quotes.set(sym, { ...got.get(sym), ts: Date.now() });
  } catch { /* nos quedamos con el precio del chart */ }
  if (!quotes.has(sym) && h.price != null && h.sessionTs) {
    const marketDate = localDate(h.sessionTs, h.gmtoffset);
    quotes.set(sym, { price: h.price, prevClose: prevCloseFromBars(h.bars, marketDate), sessionTs: h.sessionTs, ts: Date.now() });
  }
  await loadAnchor(sym);
  return buildRow(sym);
}

// ── Scheduler ────────────────────────────────────────────────────────────────
async function tick() {
  if (ticking || booting) return;
  ticking = true;
  try {
    const symbols = getSymbols();
    await refreshQuotes(symbols);
    const now = Date.now();
    const histTodo = symbols
      .filter((s) => needsHistory(s, now))
      .sort((a, b) => (histories.get(a)?.fetchedAt ?? 0) - (histories.get(b)?.fetchedAt ?? 0))
      .slice(0, HISTORY_PER_TICK);
    await runPool(histTodo, TICK_CONCURRENCY, loadHistory);
    const anchorTodo = symbols.filter((s) => needsAnchor(s)).slice(0, ANCHORS_PER_TICK);
    await runPool(anchorTodo, TICK_CONCURRENCY, loadAnchor);
    broadcast(); // relee la lista: pudo cambiar durante el tick
  } catch (e) {
    console.error('[tick]', e);
  } finally {
    ticking = false;
  }
}

async function boot() {
  booting = true;
  try {
    await ensureUniverse();
    const symbols = getSymbols();
    await refreshQuotes(symbols);
    resolveQuotesReady();
    broadcast(symbols);

    let lastBroadcast = Date.now();
    const progress = () => {
      if (Date.now() - lastBroadcast > 2_000) { broadcast(); lastBroadcast = Date.now(); }
    };
    const t0 = Date.now();
    await runPool(symbols.filter((s) => !histories.has(s)), BOOT_CONCURRENCY, async (s) => { await loadHistory(s); progress(); });
    await runPool(symbols.filter((s) => needsAnchor(s)), BOOT_CONCURRENCY, async (s) => { await loadAnchor(s); progress(); });
    console.log(`[market] histórico listo: ${histories.size}/${symbols.length} papeles en ${((Date.now() - t0) / 1000).toFixed(0)}s`);
  } catch (e) {
    console.error('[boot]', e);
    resolveQuotesReady();
  } finally {
    booting = false;
    broadcast();
  }
}

export function start() {
  boot();
  setInterval(tick, TICK_MS);
  startUniverseRefresh();
}
