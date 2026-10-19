import { fetchCedears, fetchArgentina, altSeriesCandidates } from './byma.js';
import { fetchComafiPrograms, toYahooSymbols } from './comafi.js';
import { searchSymbol, fetchCryptoRanking, fetchQuotes } from './yahoo.js';
import { readOverrides, readUniverseFile, writeUniverseFile } from './store.js';

// Universo automático de papeles. Nada se carga a mano:
//   - CEDEARs        → listado de BYMA, mapeados a Yahoo con la tabla de Comafi + validación por búsqueda
//   - Argentina      → panel líder + general de BYMA (símbolo.BA)
//   - Cripto         → top por capitalización según Yahoo (sin stablecoins ni tokens envueltos)
//   - Índices        → referencias fijas (S&P 500, Nasdaq 100, Dow, Russell 2000, Merval)
// tickers-ar.json solo pisa nombre/sector/tipo/símbolo de los papeles que el dueño clasificó a mano.
// El resultado se guarda en data/universe.json y se refresca una vez por día.

export const INDICES = [
  { symbol: '^GSPC', ticker: 'SPX',    nombre: 'S&P 500' },
  { symbol: '^NDX',  ticker: 'NDX',    nombre: 'Nasdaq 100' },
  { symbol: '^DJI',  ticker: 'DJI',    nombre: 'Dow Jones Industrial Average' },
  { symbol: '^RUT',  ticker: 'RUT',    nombre: 'Russell 2000' },
  { symbol: '^MERV', ticker: 'MERVAL', nombre: 'S&P Merval' },
];

export const CRYPTO_TOP = 25;
const REFRESH_MS    = 24 * 60 * 60_000;   // una vez por día
const RETRY_DAYS    = 7;                  // reintentar símbolos no resueltos
const SEARCH_POOL   = 4;

const YAHOO_SECTOR = {
  'Technology':             'Tecnología',
  'Communication Services': 'Comunicación',
  'Financial Services':     'Finanzas',
  'Healthcare':             'Salud',
  'Consumer Cyclical':      'Consumo',
  'Consumer Defensive':     'Consumo',
  'Energy':                 'Energía',
  'Industrials':            'Industria',
  'Basic Materials':        'Materiales',
  'Real Estate':            'Inmobiliario',
  'Utilities':              'Servicios Públicos',
};

// Stablecoins, tokens envueltos/stakeados y oro tokenizado: no son "cripto para operar"
const STABLE_OR_WRAPPED_SYMBOL = /USD|^(DAI|EURC|EURS|GUSD|FRAX|LUSD|GHO|WBTC|BTCB|TBTC|CBBTC|WETH|WBETH|WSTETH|STETH|CBETH|WEETH|AETHWETH|RETH|METH|EZETH|RSETH|SDAI|XAUT|PAXG|BSC)$/i;
const STABLE_OR_WRAPPED_NAME = /wrapped|staked|bridged|tether|stablecoin|\bUSD\b|dollar/i;

let state = { updatedAt: null, sources: {}, entries: [], unresolved: [] };
let bySymbol = new Map();
let refreshing = null;

// ── Helpers puros (exportados para tests) ────────────────────────────────────

/** Ticker para mostrar: sin sufijo de mercado, sin ^ y sin el id numérico de Yahoo en cripto. */
export function displayTicker(symbol, tipo) {
  if (tipo === 'cripto') return symbol.replace(/\d+-USD$/, '').replace(/-USD$/, '');
  return symbol.replace(/^\^/, '').replace(/\.(BA|SA|DE|IL|TO|L|MX|PA|AS|MC|MI|T|HK)$/, '');
}

export function isStableOrWrapped({ symbol, name }) {
  const base = symbol.replace(/\d+-USD$/, '').replace(/-USD$/, '');
  const clean = (name ?? '').replace(/\s+USD$/i, '');
  return STABLE_OR_WRAPPED_SYMBOL.test(base) || STABLE_OR_WRAPPED_NAME.test(clean);
}

/** Sector de la app a partir de lo que dice Yahoo (o del mercado, para Argentina/Brasil). */
export function sectorFor({ quoteType, exchange, sector, industry }) {
  if (exchange === 'BUE') return 'Argentina';
  if (exchange === 'SAO') return 'Latam';
  if (quoteType === 'ETF') return 'ETF';
  if (/semiconductor/i.test(industry ?? '')) return 'Semiconductores';
  return YAHOO_SECTOR[sector] ?? 'Otros';
}

export function pickCrypto(ranking, top = CRYPTO_TOP) {
  return ranking.filter((c) => c.symbol?.endsWith('-USD') && !isStableOrWrapped(c)).slice(0, top);
}

/** "9:1" → 9 CEDEARs por acción · "1:5" → 0,2 (un CEDEAR son 5 acciones). */
export function parseRatio(s) {
  const m = /^\s*(\d+(?:[.,]\d+)?)\s*:\s*(\d+(?:[.,]\d+)?)\s*$/.exec(s ?? '');
  if (!m) return null;
  const [a, b] = [m[1], m[2]].map((x) => Number(x.replace(',', '.')));
  return a > 0 && b > 0 ? a / b : null;
}

export function formatRatio(r) {
  return r >= 1 ? `${Math.round(r)}:1` : `1:${Math.round(1 / r)}`;
}

/** CEDEARs por acción según el precio: la acción en dólares por el CCL, sobre el CEDEAR en pesos. */
export function estimateRatio(usPrice, arsPrice, ccl) {
  return usPrice > 0 && arsPrice > 0 && ccl > 0 ? usPrice * ccl / arsPrice : null;
}

const RATIO_TOLERANCE = 0.05;

/**
 * Ratio del CEDEAR: el de Comafi si el precio lo confirma; si no, el que sale del precio. La tabla de
 * Comafi tiene ratios viejos (el 19/10/2026 decía TSM 1:3 y AAPL 10:1; por precio daban 9 y 20) y
 * solo cubre sus ~256 programas.
 */
export function resolveRatio(comafi, estimate) {
  const c = parseRatio(comafi);
  if (!(estimate > 0)) return { ratio: comafi ?? null, ratioFuente: comafi ? 'comafi' : null };
  if (c && Math.abs(c / estimate - 1) <= RATIO_TOLERANCE) return { ratio: comafi, ratioFuente: 'comafi' };
  return { ratio: formatRatio(estimate), ratioFuente: 'precio' };
}

const today = () => new Date().toISOString().slice(0, 10);
const daysSince = (iso) => iso ? (Date.now() - Date.parse(iso)) / 86_400_000 : Infinity;

async function runPool(items, concurrency, fn) {
  let i = 0;
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (i < items.length) await fn(items[i++]);
  }));
}

const FOREIGN_SUFFIXES = /\.(DE|L|IL|AS|PA|MC|MI|TO|SA|HK|T)$/;

/**
 * Prueba candidatos en orden y devuelve el primero que Yahoo conoce como acción o ETF. Si ninguno
 * coincide exacto, acepta el mismo ticker en otra bolsa (ADS → ADS.DE, IWDA → IWDA.L).
 * @returns {Promise<{hit: object|null, failed: boolean}>} failed = hubo errores de red (no concluye nada)
 */
async function resolveCandidates(candidates, bare) {
  let failed = false;
  const isListed = (h) => h.quoteType === 'EQUITY' || h.quoteType === 'ETF';
  for (const c of [...new Set(candidates.filter(Boolean))]) {
    try {
      const hit = (await searchSymbol(c)).find(isListed);
      if (hit) return { hit, failed };
    } catch { failed = true; }
  }
  if (bare) {
    try {
      const hits = await searchSymbol(bare, { exact: false });
      const hit = hits.find((h) => isListed(h) && h.symbol.toUpperCase().startsWith(bare.toUpperCase() + '.') && FOREIGN_SUFFIXES.test(h.symbol));
      if (hit) return { hit, failed };
    } catch { failed = true; }
  }
  return { hit: null, failed };
}

/**
 * Ratio de cada CEDEAR con el cierre anterior de los dos lados (BYMA y EE.UU. cierran casi juntos) y el
 * CCL de GGAL (10 acciones por ADR). Solo para subyacentes que cotizan en dólares en EE.UU. (sin sufijo
 * de bolsa); el resto queda con lo que diga Comafi. Si Yahoo no responde, cada papel conserva su ratio.
 */
async function applyRatios(entries, { closes, comafi, ggalArs, log }) {
  const cedears = entries.filter((e) => (e.tipo === 'cedear' || e.tipo === 'etf') && e.bymaTicker);
  const enDolares = cedears.filter((e) => !e.symbol.includes('.')).map((e) => e.symbol);
  let quotes = new Map();
  try {
    quotes = await fetchQuotes([...new Set([...enDolares, 'GGAL'])]);
  } catch (e) {
    log(`Ratios: Yahoo no disponible (${e.message}); cada papel conserva el que tenía`);
  }
  const ggalUs = quotes.get('GGAL')?.prevClose;
  const ccl = ggalArs && ggalUs ? ggalArs * 10 / ggalUs : null;
  let porPrecio = 0, corregidos = 0;
  for (const e of cedears) {
    const est = ccl && !e.symbol.includes('.') ? estimateRatio(quotes.get(e.symbol)?.prevClose, closes.get(e.bymaTicker), ccl) : null;
    if (est == null && e.ratioFuente === 'precio') { porPrecio++; continue; }
    const program = comafi.get(e.bymaTicker)?.ratio ?? null;
    Object.assign(e, resolveRatio(program, est));
    if (e.ratioFuente === 'precio') { porPrecio++; if (program) corregidos++; }
  }
  log(`Ratios: CCL ${ccl ? ccl.toFixed(0) : 's/d'} · ${porPrecio} por precio (${corregidos} contra Comafi)`);
}

function applyOverride(entry, override) {
  if (!override) return entry;
  return {
    ...entry,
    nombre: override.nombre ?? entry.nombre,
    sector: override.sector ?? entry.sector,
    tipo:   override.tipo   ?? entry.tipo,
  };
}

// ── Construcción ─────────────────────────────────────────────────────────────

/**
 * Arma el universo desde las fuentes. Reusa las resoluciones ya guardadas (no vuelve a
 * consultar Yahoo por cada papel) y solo busca lo nuevo o lo no resuelto hace más de una semana.
 */
export async function buildUniverse({ previous = null, log = () => {} } = {}) {
  const overrides = readOverrides();
  const known = new Map((previous?.entries ?? []).filter((e) => e.source).map((e) => [`${e.source}:${e.bymaTicker}`, e]));
  const failed = new Map((previous?.unresolved ?? []).map((u) => [`${u.source}:${u.bymaTicker}`, u]));

  const [{ symbols: allCedears, closes: cedearCloses }, { symbols: allArgentina, closes: argentinaCloses }, comafi, ranking] = await Promise.all([
    fetchCedears(),
    fetchArgentina(),
    fetchComafiPrograms().catch((e) => { log(`Comafi no disponible: ${e.message}`); return new Map(); }),
    fetchCryptoRanking(80).catch((e) => { log(`Ranking cripto no disponible: ${e.message}`); return []; }),
  ]);
  // Series alternativas (AAPLB, AMD.B, ALUAB...) afuera, salvo que Comafi las liste como programa real (BB)
  const altCedears = altSeriesCandidates(allCedears), altArgentina = altSeriesCandidates(allArgentina);
  const cedears = allCedears.filter((s) => !altCedears.has(s) || comafi.has(s));
  const argentina = allArgentina.filter((s) => !altArgentina.has(s));
  log(`BYMA: ${cedears.length} CEDEARs, ${argentina.length} acciones · Comafi: ${comafi.size} programas · cripto: ${ranking.length}`);

  const entries = [];
  const unresolved = [];
  const seen = new Set();
  const push = (entry) => {
    if (!entry.symbol || seen.has(entry.symbol)) return;
    seen.add(entry.symbol);
    entries.push(entry);
  };

  // Ya conocidos (sin red) y pendientes de resolver
  const todo = [];
  const consider = (source, bymaTicker) => {
    const key = `${source}:${bymaTicker}`;
    const prev = known.get(key);
    if (prev) { push(applyOverride({ ...prev }, overrides.get(bymaTicker))); return; }
    const fail = failed.get(key);
    if (fail && daysSince(fail.checkedAt) < RETRY_DAYS) { unresolved.push(fail); return; }
    todo.push({ source, bymaTicker });
  };
  for (const s of cedears) consider('byma-cedear', s);
  for (const s of argentina) consider('byma-equity', s);

  let searched = 0;
  await runPool(todo, SEARCH_POOL, async ({ source, bymaTicker }) => {
    const override = overrides.get(bymaTicker);
    const program = comafi.get(bymaTicker);
    const local = source === 'byma-equity';
    const candidates = local
      ? [override?.yahoo, `${bymaTicker}.BA`]
      : [
          override?.yahoo,
          ...(program ? toYahooSymbols(program.origin, program.market) : []),
          /^[A-Z]{4}\d{1,2}$/.test(bymaTicker) ? `${bymaTicker}.SA` : null,   // acciones de B3: ABEV3, VALE3, BPA11
          bymaTicker,
          bymaTicker.replace(/\.([A-Z])$/, '-$1'),
        ];
    searched++;
    const { hit, failed: netError } = await resolveCandidates(candidates, local ? null : bymaTicker);
    if (!hit || (local && /(fund|fci|fideicomiso)/i.test(hit.name ?? ''))) {   // fondos cerrados del panel general
      if (!netError) unresolved.push({ source, bymaTicker, checkedAt: today() });   // con error de red se reintenta mañana
      return;
    }
    const tipo = local ? 'accion' : (hit.quoteType === 'ETF' ? 'etf' : 'cedear');
    push(applyOverride({
      symbol: hit.symbol,
      ticker: local ? bymaTicker : displayTicker(hit.symbol, tipo),   // acciones locales con su ticker de BYMA (YPFD, TECO2)
      bymaTicker,
      source,
      nombre: hit.name ?? program?.name ?? hit.symbol,
      sector: sectorFor(hit),
      tipo,
      industry: hit.industry,
      exchange: hit.exchange,
      ratio: program?.ratio ?? null,
      checkedAt: today(),
    }, override));
  });
  if (searched) log(`Yahoo: ${searched} símbolos consultados, ${unresolved.length} sin resolver`);
  await applyRatios(entries, { closes: cedearCloses, comafi, ggalArs: argentinaCloses.get('GGAL'), log });

  // Cripto: top por capitalización, símbolos ya en formato Yahoo
  for (const c of pickCrypto(ranking)) {
    const ticker = displayTicker(c.symbol, 'cripto');
    push(applyOverride({
      symbol: c.symbol, ticker, bymaTicker: null, source: 'yahoo-crypto',
      nombre: c.name.replace(/\s+USD$/i, ''), sector: 'Cripto', tipo: 'cripto',
      industry: null, exchange: 'CCC', ratio: null, checkedAt: today(),
    }, overrides.get(ticker)));
  }
  // Si el ranking falló, conservamos las cripto del universo anterior
  if (!ranking.length) for (const e of previous?.entries ?? []) if (e.tipo === 'cripto') push(e);

  for (const idx of INDICES) {
    push({ symbol: idx.symbol, ticker: idx.ticker, bymaTicker: null, source: 'indices', nombre: idx.nombre, sector: 'ETF', tipo: 'indice', industry: null, exchange: null, ratio: null, checkedAt: today() });
  }

  const order = { cedear: 0, etf: 0, accion: 1, cripto: 2, indice: 3 };
  entries.sort((a, b) => (order[a.tipo] - order[b.tipo]) || (a.tipo === 'cripto' ? 0 : a.ticker.localeCompare(b.ticker)));

  return {
    updatedAt: new Date().toISOString(),
    sources: {
      cedears: entries.filter((e) => e.tipo === 'cedear' || e.tipo === 'etf').length,
      argentina: entries.filter((e) => e.tipo === 'accion').length,
      cripto: entries.filter((e) => e.tipo === 'cripto').length,
      indices: INDICES.length,
      unresolved: unresolved.length,
    },
    entries,
    unresolved,
  };
}

// ── Estado en memoria ────────────────────────────────────────────────────────

function load(universe) {
  state = universe;
  bySymbol = new Map(universe.entries.map((e) => [e.symbol, e]));
}

export function getSymbols() { return state.entries.map((e) => e.symbol); }
export function getEntry(symbol) { return bySymbol.get(symbol) ?? null; }
export function getUniverseMeta() {
  return { updatedAt: state.updatedAt, sources: state.sources, total: state.entries.length };
}

/** Busca por símbolo Yahoo, ticker visible o ticker BYMA (para /preview). */
export function resolveSymbol(input) {
  const q = String(input ?? '').trim().toUpperCase();
  if (!q) return '';
  const hit = state.entries.find((e) => e.symbol.toUpperCase() === q || e.ticker.toUpperCase() === q || e.bymaTicker === q);
  return hit ? hit.symbol : q;
}

/** Reconstruye el universo (una sola corrida a la vez) y persiste si cambió. */
export async function refreshUniverse({ log = console.log } = {}) {
  if (refreshing) return refreshing;
  refreshing = (async () => {
    try {
      const next = await buildUniverse({ previous: state.entries.length ? state : readUniverseFile(), log });
      const changed = JSON.stringify(next.entries) !== JSON.stringify(state.entries);
      load(next);
      writeUniverseFile(next);
      log(`[universe] ${next.entries.length} papeles (${changed ? 'cambió' : 'sin cambios'}) · sin resolver: ${next.unresolved.length}`);
      return next;
    } finally {
      refreshing = null;
    }
  })();
  return refreshing;
}

/** Al arrancar: usa el archivo si es de hoy; si no, refresca (y si la red falla, se queda con el archivo). */
export async function ensureUniverse({ log = console.log } = {}) {
  const saved = readUniverseFile();
  if (saved?.entries?.length) load(saved);
  if (saved?.updatedAt && Date.now() - Date.parse(saved.updatedAt) < REFRESH_MS) return state;
  try {
    await refreshUniverse({ log });
  } catch (e) {
    log(`[universe] no se pudo refrescar (${e.message}); sigo con ${state.entries.length} papeles del archivo`);
  }
  return state;
}

export function startUniverseRefresh({ log = console.log } = {}) {
  setInterval(() => refreshUniverse({ log }).catch((e) => log(`[universe] ${e.message}`)), REFRESH_MS);
}
