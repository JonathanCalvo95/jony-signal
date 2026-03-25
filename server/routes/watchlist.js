import { Router } from 'express';
import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { fetchTickerData } from '../services/yahooFinance.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_PATH    = join(__dirname, '../data/watchlist.json');
const CATALOG_PATH = join(__dirname, '../data/tickers-ar.json');

function readWatchlist() {
  try { return JSON.parse(readFileSync(DATA_PATH, 'utf-8')); }
  catch { return []; }
}

function saveWatchlist(list) {
  writeFileSync(DATA_PATH, JSON.stringify(list, null, 2), 'utf-8');
}

function computeSignal(price, targetBuy, targetSell) {
  if (price == null || !targetBuy || !targetSell) return 'HOLD';
  if (price <= targetBuy) return 'BARATA';
  if (price >= targetSell) return 'CARA';
  return 'HOLD';
}

function autoCalculateTargets(weekLow52, weekHigh52) {
  if (!weekLow52 || !weekHigh52) return null;
  const targetBuy  = Math.round(((weekLow52 + weekHigh52) / 2) * 100) / 100;
  const targetSell = Math.round((weekLow52 * 0.15 + weekHigh52 * 0.85) * 100) / 100;
  if (targetSell <= targetBuy) return null;
  return { targetBuy, targetSell };
}

function readCatalogMap() {
  try {
    const catalog = JSON.parse(readFileSync(CATALOG_PATH, 'utf-8'));
    return Object.fromEntries(catalog.map((c) => [c.yahoo, c]));
  } catch { return {}; }
}

// ── In-memory price cache (raw market data, targets applied fresh each time) ──
const priceCache = {
  data: new Map(), // yahoo-ticker → raw market data object
  ts: 0,
  TTL: 60_000,     // 60 seconds
};

// Fetch tickers with bounded concurrency (default 25 parallel)
async function fetchWithConcurrency(tickers, limit = 25) {
  const results = new Array(tickers.length);
  let idx = 0;
  async function worker() {
    while (idx < tickers.length) {
      const i = idx++;
      try       { results[i] = { status: 'fulfilled', value: await fetchTickerData(tickers[i]) }; }
      catch (e) { results[i] = { status: 'rejected',  reason: e }; }
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, tickers.length) }, worker));
  return results;
}

const router = Router();

// GET /api/watchlist/catalog
router.get('/catalog', (_req, res) => {
  try { res.json(JSON.parse(readFileSync(CATALOG_PATH, 'utf-8'))); }
  catch { res.json([]); }
});

// GET /api/watchlist/preview/:ticker
router.get('/preview/:ticker', async (req, res) => {
  const upper = req.params.ticker.toUpperCase();
  try {
    const data = await fetchTickerData(upper);
    res.json({ ...data, autoTargets: autoCalculateTargets(data.weekLow52, data.weekHigh52) });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// POST /api/watchlist/auto-targets/all
router.post('/auto-targets/all', async (_req, res) => {
  const list = readWatchlist();
  if (!list.length) return res.json({ updated: 0, failed: 0 });
  const results = await fetchWithConcurrency(list.map((t) => t.ticker));
  let updated = 0, failed = 0;
  results.forEach((r, i) => {
    if (r.status === 'fulfilled') {
      const auto = autoCalculateTargets(r.value.weekLow52, r.value.weekHigh52);
      if (auto) { list[i].targetBuy = auto.targetBuy; list[i].targetSell = auto.targetSell; updated++; }
      else failed++;
    } else { failed++; }
  });
  saveWatchlist(list);
  // Populate cache with freshly fetched data so the next GET /watchlist doesn't re-fetch
  priceCache.data.clear();
  results.forEach((r, i) => {
    if (r.status === 'fulfilled') priceCache.data.set(list[i].ticker, r.value);
  });
  priceCache.ts = Date.now();
  res.json({ updated, failed });
});

// POST /api/watchlist/:ticker/auto-targets
router.post('/:ticker/auto-targets', async (req, res) => {
  const upper = req.params.ticker.toUpperCase();
  const list = readWatchlist();
  const item = list.find((t) => t.ticker === upper);
  if (!item) return res.status(404).json({ error: 'Not found' });
  try {
    const data = await fetchTickerData(upper);
    const auto = autoCalculateTargets(data.weekLow52, data.weekHigh52);
    if (!auto) return res.status(400).json({ error: 'No se pudieron calcular targets' });
    item.targetBuy = auto.targetBuy;
    item.targetSell = auto.targetSell;
    saveWatchlist(list);
    res.json({ ticker: upper, ...auto });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// GET /api/watchlist — all tickers with live data (cached)
router.get('/', async (req, res) => {
  const list = readWatchlist();
  if (!list.length) return res.json([]);

  const catalogMap = readCatalogMap();
  const now = Date.now();
  const needsRefresh = req.query.refresh === '1' || (now - priceCache.ts) >= priceCache.TTL;

  if (needsRefresh) {
    const tickers = list.map((t) => t.ticker);
    const results = await fetchWithConcurrency(tickers, 25);
    priceCache.data.clear();
    results.forEach((r, i) => {
      if (r.status === 'fulfilled') priceCache.data.set(tickers[i], r.value);
    });
    priceCache.ts = Date.now();
  }

  const rows = list.map((item) => {
    const cat = catalogMap[item.ticker] || {};
    const raw = priceCache.data.get(item.ticker);
    const tb  = item.targetBuy;
    const ts  = item.targetSell;
    const mediaSenal = tb && ts ? Math.round(((tb + ts) / 2) * 100) / 100 : null;
    if (raw) {
      return {
        ...raw,
        targetBuy: tb,
        targetSell: ts,
        mediaSenal,
        signal: computeSignal(raw.price, tb, ts),
        sector: cat.sector || null,
        nombre: cat.nombre || null,
        tipo:   cat.tipo   || null,
      };
    }
    return {
      ticker: item.ticker, targetBuy: tb, targetSell: ts, mediaSenal, signal: 'HOLD',
      price: null, rsi: null, change24h: null, change360d: null,
      weekLow52: null, weekHigh52: null, volume: null, exDate: null, fechaPago: null, beta: null,
      error: true, sector: cat.sector || null, nombre: cat.nombre || null, tipo: cat.tipo || null,
    };
  });

  res.json(rows);
});

// POST /api/watchlist — add ticker
router.post('/', async (req, res) => {
  const { ticker, targetBuy, targetSell } = req.body;
  if (!ticker) return res.status(400).json({ error: 'ticker is required' });
  const list  = readWatchlist();
  const upper = ticker.toUpperCase();
  if (list.find((t) => t.ticker === upper))
    return res.status(409).json({ error: 'Ticker already in watchlist' });
  try { await fetchTickerData(upper); }
  catch { return res.status(400).json({ error: `Ticker "${upper}" not found on Yahoo Finance` }); }
  list.push({ ticker: upper, targetBuy: targetBuy || null, targetSell: targetSell || null });
  saveWatchlist(list);
  priceCache.ts = 0;
  res.status(201).json({ ticker: upper });
});

// DELETE /api/watchlist/:ticker
router.delete('/:ticker', (req, res) => {
  const upper = req.params.ticker.toUpperCase();
  let list = readWatchlist();
  const before = list.length;
  list = list.filter((t) => t.ticker !== upper);
  if (list.length === before) return res.status(404).json({ error: 'Not found' });
  saveWatchlist(list);
  priceCache.data.delete(upper);
  res.json({ deleted: upper });
});

// PATCH /api/watchlist/:ticker — update targets
router.patch('/:ticker', (req, res) => {
  const upper = req.params.ticker.toUpperCase();
  const list  = readWatchlist();
  const item  = list.find((t) => t.ticker === upper);
  if (!item) return res.status(404).json({ error: 'Not found' });
  if (req.body.targetBuy  !== undefined) item.targetBuy  = req.body.targetBuy;
  if (req.body.targetSell !== undefined) item.targetSell = req.body.targetSell;
  saveWatchlist(list);
  res.json(item);
});

export default router;
