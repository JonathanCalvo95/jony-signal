import { calculateRSI } from './rsi.js';

const BASE = 'https://query2.finance.yahoo.com';
const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
  'Accept': '*/*',
};

// ── Yahoo Finance crumb authentication (1h cache) ──────────────────────────
const auth = { crumb: null, cookies: null, ts: 0 };

async function ensureAuth() {
  if (auth.crumb && (Date.now() - auth.ts) < 3_600_000) return;

  // Step 1: visit Yahoo Finance to get session cookies
  const r1 = await fetch('https://finance.yahoo.com/', { headers: HEADERS });
  const rawCookies = typeof r1.headers.getSetCookie === 'function'
    ? r1.headers.getSetCookie()
    : (r1.headers.get('set-cookie') ?? '').split(/,(?=\s*\w+=)/).map(s => s.trim());
  auth.cookies = rawCookies.map(c => c.split(';')[0].trim()).join('; ');

  // Step 2: get crumb using the session cookies
  const r2 = await fetch('https://query2.finance.yahoo.com/v1/test/getcrumb', {
    headers: { ...HEADERS, Cookie: auth.cookies },
  });
  auth.crumb = (await r2.text()).trim();
  auth.ts = Date.now();
}

/**
 * Fetch all live data for a single ticker using Yahoo Finance chart API.
 * The chart API returns both current quote metadata and OHLCV history in one call.
 */
export async function fetchTickerData(ticker) {
  // Use 2y range for RSI warmup + 360d change calculation
  const url = `${BASE}/v8/finance/chart/${encodeURIComponent(ticker)}?range=2y&interval=1d&includePrePost=false`;
  const res = await fetch(url, { headers: HEADERS });
  if (!res.ok) throw new Error(`Yahoo Finance error ${res.status} for "${ticker}"`);

  const data = await res.json();
  const chart = data?.chart?.result?.[0];
  if (!chart) throw new Error(`Ticker "${ticker}" not found`);

  const meta = chart.meta;
  const closes = (chart.indicators?.quote?.[0]?.close || []).filter((c) => c != null);

  // RSI from all available bars (Wilder's 14-period)
  const rsi = calculateRSI(closes);

  // 360-day change: first close vs last close in the dataset
  let change360d = null;
  if (closes.length >= 2) {
    const first = closes[0];
    const last = closes[closes.length - 1];
    if (first && first !== 0) {
      change360d = Math.round(((last - first) / first) * 10000) / 100;
    }
  }

  // 24h change: use last two closes from history
  const price = meta.regularMarketPrice ?? null;
  let change24h = null;
  if (closes.length >= 2) {
    const prevClose = closes[closes.length - 2];
    const lastClose = closes[closes.length - 1];
    if (prevClose && prevClose !== 0) {
      change24h = Math.round(((lastClose - prevClose) / prevClose) * 10000) / 100;
    }
  }

  // 52-week high/low from meta
  const weekHigh52 = meta.fiftyTwoWeekHigh ?? null;
  const weekLow52 = meta.fiftyTwoWeekLow ?? null;

  // Volume: last bar volume
  const volumes = chart.indicators?.quote?.[0]?.volume || [];
  const volume = volumes.length > 0 ? (volumes[volumes.length - 1] ?? null) : null;

  // Dividend dates + beta via quoteSummary (with crumb auth)
  let exDate = null;
  let fechaPago = null;
  let beta = null;
  try {
    await ensureAuth();
    const params = new URLSearchParams({
      modules: 'calendarEvents,summaryDetail',
      crumb: auth.crumb,
    });
    const qUrl = `${BASE}/v10/finance/quoteSummary/${encodeURIComponent(ticker)}?${params}`;
    const qRes = await fetch(qUrl, { headers: { ...HEADERS, Cookie: auth.cookies } });
    if (qRes.ok) {
      const qData = await qRes.json();
      const result = qData?.quoteSummary?.result?.[0];

      const events = result?.calendarEvents;
      if (events?.exDividendDate?.raw) {
        exDate = new Date(events.exDividendDate.raw * 1000).toISOString().split('T')[0];
      }
      if (events?.dividendDate?.raw) {
        fechaPago = new Date(events.dividendDate.raw * 1000).toISOString().split('T')[0];
      }

      const summary = result?.summaryDetail;
      const rawBeta = summary?.beta;
      if (rawBeta != null) {
        const bVal = typeof rawBeta === 'number' ? rawBeta : rawBeta?.raw;
        if (bVal != null) beta = Math.round(bVal * 100) / 100;
      }
    }
  } catch { /* best effort — non-critical */ }

  return {
    ticker: ticker.toUpperCase(),
    price,
    change24h,
    rsi,
    change360d,
    weekLow52,
    weekHigh52,
    volume,
    exDate,
    fechaPago,
    beta,
  };
}
