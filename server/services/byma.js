// Listados públicos de BYMA (open.bymadata.com.ar): CEDEARs y acciones locales.
// Cada especie viene repetida por moneda/plazo (AAPL, AAPLC = cable, AAPLD = MEP) y con
// series alternativas ("B", "5"); acá se reduce todo a un símbolo base por papel.

const BASE = 'https://open.bymadata.com.ar/vanoms-be-core/rest/api/bymadata/free';
const HEADERS = {
  'Content-Type': 'application/json',
  'Accept': 'application/json',
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
};
const TIMEOUT_MS = 20_000;

async function post(endpoint) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${BASE}/${endpoint}`, {
      method: 'POST',
      headers: HEADERS,
      signal: ctrl.signal,
      body: JSON.stringify({ excludeZeroPxAndQty: false, T2: true, T1: true, T0: true, page_number: 1, page_size: 5000 }),
    });
    if (!res.ok) throw new Error(`BYMA ${endpoint} respondió ${res.status}`);
    const json = await res.json();
    return Array.isArray(json) ? json : (json?.data ?? []);
  } finally {
    clearTimeout(timer);
  }
}

/** Símbolos en pesos (uno por especie, sin sufijos de moneda), en orden alfabético. */
export function baseSymbols(rows, { dropFunds = false } = {}) {
  const ars = new Set(rows.filter((r) => r.denominationCcy === 'ARS' && r.symbol).map((r) => r.symbol.trim()));
  // Los fondos cerrados (FCI) del panel general terminan en "F": ADBGF, ALNBF, DRABF...
  const isFund = (sym) => dropFunds && /^[A-Z]{4}F$/.test(sym);
  return [...ars].filter((s) => !isFund(s)).sort();
}

/**
 * Series alternativas de una misma especie (viejo ratio, sin operaciones): BYMA les agrega "B" o "5"
 * al símbolo base, a veces rellenado con puntos (AAPLB, ABTB, AMD.B, BA..B, F.B, CADO5, BMA.5).
 * Devuelve las que parecen serlo; el que llama decide si alguna es un papel real (BB = BlackBerry).
 */
export function altSeriesCandidates(symbols) {
  const stems = new Set(symbols.map((s) => s.replace(/\./g, '')));
  const out = new Set();
  for (const sym of symbols) {
    const suffix = sym[sym.length - 1];
    if (suffix !== 'B' && suffix !== '5') continue;
    const stem = sym.slice(0, -1).replace(/\./g, '');
    if (stem && stem !== sym && stems.has(stem)) out.add(sym);
  }
  return out;
}

/** Cierre anterior en pesos por símbolo (plazo 24 hs si lo hay, que es el que más opera). */
export function arsCloses(rows) {
  const out = new Map();
  for (const r of rows) {
    if (r.denominationCcy !== 'ARS' || !r.symbol || !(r.previousClosingPrice > 0)) continue;
    const sym = r.symbol.trim();
    if (!out.has(sym) || r.settlementType === '2') out.set(sym, r.previousClosingPrice);
  }
  return out;
}

/** CEDEARs listados en BYMA, con su cierre anterior en pesos (para estimar el ratio). */
export async function fetchCedears() {
  const rows = await post('cedears');
  return { symbols: baseSymbols(rows), closes: arsCloses(rows) };
}

export async function fetchCedearSymbols() {
  return (await fetchCedears()).symbols;
}

/** Acciones argentinas: panel líder + panel general, con su cierre anterior en pesos. */
export async function fetchArgentina() {
  const [leading, general] = await Promise.all([post('leading-equity'), post('general-equity')]);
  const rows = [...leading, ...general];
  return { symbols: baseSymbols(rows, { dropFunds: true }), closes: arsCloses(rows) };
}

export async function fetchArgentinaSymbols() {
  return (await fetchArgentina()).symbols;
}
