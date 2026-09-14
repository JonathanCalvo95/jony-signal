import { localDate, addDays, toUnix } from './dates.js';

// Cliente mínimo de Yahoo Finance. Solo usa endpoints que no requieren crumb/cookies:
//   - /v8/finance/spark               → cotización actual de hasta 20 símbolos por request
//   - /v8/finance/chart               → velas diarias de un símbolo (histórico o ventana puntual)
//   - /v1/finance/search              → validar un símbolo y traer nombre, tipo, exchange, sector e industria
//   - /v1/finance/screener/predefined → ranking de criptomonedas por capitalización

const BASE = 'https://query2.finance.yahoo.com';
const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
  'Accept': 'application/json',
};
const TIMEOUT_MS = 15_000;
export const SPARK_BATCH = 20;

export class YahooError extends Error {
  constructor(message, status) { super(message); this.status = status; }
}

async function getJson(url) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, { headers: HEADERS, signal: ctrl.signal });
    let body = null;
    try { body = await res.json(); } catch { /* sin cuerpo JSON */ }
    if (!res.ok) {
      const desc = body?.chart?.error?.description || body?.spark?.error?.description || body?.finance?.error?.description;
      throw new YahooError(desc || `Yahoo Finance respondió ${res.status}`, res.status);
    }
    return body;
  } finally {
    clearTimeout(timer);
  }
}

function parseBars(result) {
  const off = result.meta?.gmtoffset ?? 0;
  const q = result.indicators?.quote?.[0] ?? {};
  const bars = [];
  (result.timestamp ?? []).forEach((t, i) => {
    const c = q.close?.[i];
    if (c == null) return;
    bars.push({ d: localDate(t, off), c, h: q.high?.[i] ?? c, l: q.low?.[i] ?? c });
  });
  return { bars, gmtoffset: off };
}

/**
 * Cotización actual de varios símbolos (spark, range=1d).
 * @returns {Promise<Map<string, {price:number, prevClose:number|null, sessionTs:number}>>}
 *          Los símbolos desconocidos simplemente no aparecen en el Map.
 */
export async function fetchQuotes(symbols) {
  if (!symbols.length) return new Map();
  if (symbols.length > SPARK_BATCH) {
    const out = new Map();
    for (let i = 0; i < symbols.length; i += SPARK_BATCH) {
      for (const [k, v] of await fetchQuotes(symbols.slice(i, i + SPARK_BATCH))) out.set(k, v);
    }
    return out;
  }
  const url = `${BASE}/v8/finance/spark?symbols=${encodeURIComponent(symbols.join(','))}&range=1d&interval=1d`;
  const data = await getJson(url);
  const out = new Map();
  for (const sym of symbols) {
    const s = data?.[sym];
    if (!s?.close?.length) continue;
    let i = s.close.length - 1;
    while (i >= 0 && s.close[i] == null) i--;
    if (i < 0) continue;
    out.set(sym, { price: s.close[i], prevClose: s.chartPreviousClose ?? null, sessionTs: s.timestamp[i] });
  }
  return out;
}

/**
 * Velas diarias de los últimos `days` días (por defecto ~13 meses: alcanza para el
 * RSI, el rango 52W, la variación a 30 días hábiles y la anual).
 */
export async function fetchHistory(symbol, days = 400) {
  const now = Math.floor(Date.now() / 1000);
  const url = `${BASE}/v8/finance/chart/${encodeURIComponent(symbol)}?period1=${now - days * 86400}&period2=${now}&interval=1d&includePrePost=false`;
  const data = await getJson(url);
  const result = data?.chart?.result?.[0];
  if (!result) throw new YahooError(data?.chart?.error?.description || `"${symbol}" no existe en Yahoo Finance`, 404);
  const { bars, gmtoffset } = parseBars(result);
  if (!bars.length) throw new YahooError(`"${symbol}" no tiene cotizaciones`, 404);
  const meta = result.meta ?? {};
  return {
    bars,
    gmtoffset,
    firstTradeDate: meta.firstTradeDate ? localDate(meta.firstTradeDate, gmtoffset) : null,
    price: meta.regularMarketPrice ?? null,
    sessionTs: meta.regularMarketTime ?? null,
    fetchedAt: Date.now(),
  };
}

/**
 * Cierre del primer día hábil con fecha ≥ dateISO (una request chica alrededor de esa fecha).
 * @returns {Promise<{d:string, c:number}|null>} null si el papel no cotizaba en esa fecha.
 */
export async function fetchAnchorClose(symbol, dateISO) {
  const url = `${BASE}/v8/finance/chart/${encodeURIComponent(symbol)}?period1=${toUnix(addDays(dateISO, -3))}&period2=${toUnix(addDays(dateISO, 14))}&interval=1d&includePrePost=false`;
  let data;
  try {
    data = await getJson(url);
  } catch (e) {
    // Yahoo responde 400 "Data doesn't exist for startDate..." cuando el papel todavía no existía
    if (e instanceof YahooError && e.status === 400) return null;
    throw e;
  }
  const result = data?.chart?.result?.[0];
  if (!result) return null;
  const { bars } = parseBars(result);
  return bars.find((b) => b.d >= dateISO) ?? null;
}

/**
 * Busca `query` y devuelve los resultados con símbolo exacto (mayúsculas), o todos si `exact` es false.
 * @returns {Promise<Array<{symbol, quoteType, exchange, name, sector, industry}>>}
 */
export async function searchSymbol(query, { exact = true } = {}) {
  const url = `${BASE}/v1/finance/search?q=${encodeURIComponent(query)}&quotesCount=8&newsCount=0&enableFuzzyQuery=false`;
  const data = await getJson(url);
  const hits = (data?.quotes ?? []).map((q) => ({
    symbol: q.symbol,
    quoteType: q.quoteType,
    exchange: q.exchange,
    name: q.longname || q.shortname || null,
    sector: q.sector || null,
    industry: q.industry || null,
  }));
  return exact ? hits.filter((h) => h.symbol?.toUpperCase() === query.toUpperCase()) : hits;
}

/**
 * Criptomonedas ordenadas por capitalización (screener predefinido de Yahoo).
 * @returns {Promise<Array<{symbol, name, marketCap}>>}
 */
export async function fetchCryptoRanking(count = 60) {
  const url = `${BASE}/v1/finance/screener/predefined/saved?scrIds=all_cryptocurrencies_us&count=${count}`;
  const data = await getJson(url);
  return (data?.finance?.result?.[0]?.quotes ?? []).map((q) => ({
    symbol: q.symbol,
    name: q.shortName || q.longName || q.symbol,
    marketCap: q.marketCap ?? null,
  }));
}
