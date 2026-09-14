import { Router } from 'express';
import * as market from '../services/market.js';
import { resolveSymbol } from '../services/universe.js';

const router = Router();

// GET /api/watchlist/preview/:symbol — fila calculada de cualquier papel (símbolo Yahoo, ticker visible o ticker BYMA)
router.get('/preview/:symbol', async (req, res) => {
  const symbol = resolveSymbol(req.params.symbol);
  if (!symbol) return res.status(400).json({ error: 'Falta el ticker' });
  try {
    res.json(await market.loadSymbol(symbol));
  } catch (e) {
    res.status(e.status === 404 ? 404 : 400).json({ error: e.message });
  }
});

// GET /api/watchlist — todo el universo con datos en vivo (?refresh=1 fuerza cotizaciones)
router.get('/', async (req, res) => {
  await market.ensureQuotes();
  if (req.query.refresh === '1') await market.refreshNow();
  res.set('Cache-Control', 'no-store');
  res.json({ rows: market.getRows(), meta: market.getMeta() });
});

export default router;
