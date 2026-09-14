// Programa de CEDEARs de Banco Comafi (emisor principal): tabla pública con el símbolo BYMA,
// el ticker en el mercado de origen, el mercado y el ratio. Sirve para mapear símbolos de
// BYMA que no coinciden con el de Yahoo (DISN → DIS, BRKB → BRK-B, BAS → BAS.DE, ...).

const URL = 'https://www.comafi.com.ar/2254-Programas-Cedear.note.aspx';
const HEADERS = { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120', 'Accept': 'text/html' };
const TIMEOUT_MS = 20_000;

// Mercado de origen (texto de Comafi) → sufijo de Yahoo
const MARKET_SUFFIX = {
  'NYSE': '', 'NASDAQ': '', 'NYSE AMERICAN': '', 'NYSE ARCA': '', 'CBOE': '', 'BATS': '',
  'OTC': '', 'OTC US': '', 'OTCQX': '', 'PINK SHEETS': '',
  'FRANKFURT': '.DE', 'XETRA': '.DE',
  'LONDON STOCK EXCHANGE': ['.L', '.IL'],   // ETFs como .L; GDRs del IOB como .IL
  'BOLSA DE SAO PAULO': '.SA', 'B3': '.SA', 'BOVESPA': '.SA',
  'TORONTO': '.TO', 'TSX': '.TO',
  'TOKYO': '.T', 'HONG KONG': '.HK', 'PARIS': '.PA', 'AMSTERDAM': '.AS', 'MADRID': '.MC', 'MILAN': '.MI',
};

const decode = (s) => s
  .replace(/<[^>]+>/g, '')
  .replace(/&amp;/g, '&').replace(/&nbsp;/g, ' ').replace(/&#(\d+);/g, (_, n) => String.fromCharCode(n))
  .trim();

/** Parsea la tabla HTML de Comafi. Exportado para testear sin red. */
export function parseComafiTable(html) {
  const start = html.indexOf('<table'), end = html.indexOf('</table>');
  if (start === -1 || end === -1) return new Map();
  const rows = [...html.slice(start, end).matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)]
    .map((m) => [...m[1].matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)].map((c) => decode(c[1])));
  const out = new Map();
  for (const r of rows) {
    if (r.length < 8 || r[2] === 'Símbolo BYMA' || !r[2]) continue;
    out.set(r[2].toUpperCase(), { name: r[0], origin: r[3], market: r[6].toUpperCase(), ratio: r[7] });
  }
  return out;
}

/** Ticker de origen + mercado (según Comafi) → candidatos de símbolo Yahoo (vacío si no se sabe mapear). */
export function toYahooSymbols(origin, market) {
  if (!origin) return [];
  let sym = origin.trim().toUpperCase().replace(/\s+[A-Z]{2}$/, '');   // código Bloomberg: "BAS GR", "VIST US", "ADS GY"
  sym = sym.replace('/', '-').replace(/\.([A-Z])$/, '-$1');            // BRK/B → BRK-B · AKO.B → AKO-B
  if (!/^[A-Z0-9-]+$/.test(sym)) return [];
  const suffix = MARKET_SUFFIX[market];
  if (suffix === undefined) return [];
  return (Array.isArray(suffix) ? suffix : [suffix]).map((sfx) => sym + sfx);
}

/** @returns {Promise<Map<string, {name, origin, market, ratio}>>} símbolo BYMA → datos del programa */
export async function fetchComafiPrograms() {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(URL, { headers: HEADERS, signal: ctrl.signal });
    if (!res.ok) throw new Error(`Comafi respondió ${res.status}`);
    return parseComafiTable(await res.text());
  } finally {
    clearTimeout(timer);
  }
}
