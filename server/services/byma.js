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

/** CEDEARs listados en BYMA. */
export async function fetchCedearSymbols() {
  return baseSymbols(await post('cedears'));
}

/** Acciones argentinas: panel líder + panel general. */
export async function fetchArgentinaSymbols() {
  const [leading, general] = await Promise.all([post('leading-equity'), post('general-equity')]);
  return baseSymbols([...leading, ...general], { dropFunds: true });
}
