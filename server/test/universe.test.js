import { test } from 'node:test';
import assert from 'node:assert/strict';
import { baseSymbols, altSeriesCandidates, arsCloses } from '../services/byma.js';
import { parseComafiTable, toYahooSymbols } from '../services/comafi.js';
import { displayTicker, isStableOrWrapped, pickCrypto, sectorFor, parseRatio, formatRatio, estimateRatio, resolveRatio, programAllowsEtf } from '../services/universe.js';

test('BYMA: cierre anterior en pesos, plazo 24 hs primero', () => {
  const rows = [
    { symbol: 'TSM', denominationCcy: 'ARS', settlementType: '1', previousClosingPrice: 74375 },
    { symbol: 'TSM', denominationCcy: 'ARS', settlementType: '2', previousClosingPrice: 74500 },
    { symbol: 'TSMD', denominationCcy: 'USD', settlementType: '2', previousClosingPrice: 48.47 },
    { symbol: 'KEEL', denominationCcy: 'ARS', settlementType: '2', previousClosingPrice: 0 },
  ];
  assert.deepEqual([...arsCloses(rows)], [['TSM', 74500]]);
});

test('Ratio: Comafi solo si el precio lo confirma; si no, el del precio', () => {
  assert.equal(parseRatio('9:1'), 9);
  assert.equal(parseRatio('1:5'), 0.2);
  assert.equal(parseRatio('-'), null);
  assert.equal(formatRatio(56.21), '56:1');
  assert.equal(formatRatio(0.2), '1:5');
  // Precios del 19/10/2026: TSM US$421,23 · CEDEAR $76.050 · CCL 1.627 → 9
  const tsm = estimateRatio(421.23, 76050, 1627);
  assert.ok(Math.abs(tsm - 9.01) < 0.01);
  assert.deepEqual(resolveRatio('1:3', tsm), { ratio: '9:1', ratioFuente: 'precio' });     // Comafi viejo
  assert.deepEqual(resolveRatio('24:1', 23.8), { ratio: '24:1', ratioFuente: 'comafi' });  // confirmado
  assert.deepEqual(resolveRatio(null, 0.2), { ratio: '1:5', ratioFuente: 'precio' });      // KEEL, sin programa
  assert.deepEqual(resolveRatio('4:1', null), { ratio: '4:1', ratioFuente: 'comafi' });    // sin precio
  assert.deepEqual(resolveRatio(null, null), { ratio: null, ratioFuente: null });
});

test('BYMA: un símbolo por especie, solo en pesos, sin fondos cerrados', () => {
  const rows = [
    { symbol: 'AAPL', denominationCcy: 'ARS' }, { symbol: 'AAPL', denominationCcy: 'ARS' },
    { symbol: 'AAPLC', denominationCcy: 'EXT' }, { symbol: 'AAPLD', denominationCcy: 'USD' },
    { symbol: 'ALNBF', denominationCcy: 'ARS' }, { symbol: 'GGAL', denominationCcy: 'ARS' },
  ];
  assert.deepEqual(baseSymbols(rows), ['AAPL', 'ALNBF', 'GGAL']);
  assert.deepEqual(baseSymbols(rows, { dropFunds: true }), ['AAPL', 'GGAL']);
});

test('BYMA: series alternativas (B / 5, con o sin puntos de relleno)', () => {
  const syms = ['AAPL', 'AAPLB', 'ABT', 'ABTB', 'AMD', 'AMD.B', 'BA', 'BA..B', 'B', 'B.B', 'BB', 'C', 'C...B', 'F', 'F.B',
    'T', 'TB', 'GOOGL', 'GOGLB', 'DISN', 'DISNB', 'CADO', 'CADO5', 'BMA', 'BMA.5', 'ALUA', 'ALUAB', 'TGNO4', 'TGN4B', 'KEEL', 'AKO.B'];
  const alt = altSeriesCandidates(syms);
  for (const s of ['AAPLB', 'ABTB', 'AMD.B', 'BA..B', 'B.B', 'C...B', 'F.B', 'TB', 'DISNB', 'CADO5', 'BMA.5', 'ALUAB']) assert.ok(alt.has(s), s);
  for (const s of ['AAPL', 'KEEL', 'AKO.B', 'GOOGL', 'GOGLB', 'TGN4B', 'B', 'T']) assert.ok(!alt.has(s), s);
  assert.ok(alt.has('BB'), 'BB parece serie de B: lo rescata Comafi (BlackBerry) en universe.js');
});

test('Comafi: parseo de la tabla y mapeo a Yahoo', () => {
  const html = `<table><tr><th>Programa de CEDEAR</th><th>Alcance</th><th>Símbolo BYMA</th><th>Ticker en Mercado de Origen</th><th>Caja</th><th>CUSIP</th><th>Mercado de Origen</th><th>Ratio</th><th>Div</th></tr>
    <tr><td>Apple Inc.</td><td>x</td><td>AAPL</td><td>AAPL</td><td>1</td><td>2</td><td>NASDAQ</td><td>10:1</td><td>Q</td></tr>
    <tr><td>Berkshire</td><td>x</td><td>BRKB</td><td>BRK/B</td><td>1</td><td>2</td><td>NYSE</td><td>22:1</td><td>-</td></tr>
    <tr><td>BASF</td><td>x</td><td>BAS</td><td>BAS GR</td><td>1</td><td>2</td><td>FRANKFURT</td><td>2:1</td><td>-</td></tr>
    <tr><td>Walt &amp; Disney</td><td>x</td><td>DISN</td><td>DIS</td><td>1</td><td>2</td><td>NYSE</td><td>4:1</td><td>-</td></tr></table>`;
  const t = parseComafiTable(html);
  assert.equal(t.size, 4);
  assert.deepEqual(t.get('DISN'), { name: 'Walt & Disney', origin: 'DIS', market: 'NYSE', ratio: '4:1' });
  assert.deepEqual(toYahooSymbols('BRK/B', 'NYSE'), ['BRK-B']);
  assert.deepEqual(toYahooSymbols('BAS GR', 'FRANKFURT'), ['BAS.DE']);
  assert.deepEqual(toYahooSymbols('ADS GY', 'FRANKFURT'), ['ADS.DE']);
  assert.deepEqual(toYahooSymbols('IWDA LN', 'LONDON STOCK EXCHANGE'), ['IWDA.L', 'IWDA.IL']);
  assert.deepEqual(toYahooSymbols('VIST US', 'NYSE'), ['VIST']);
  assert.deepEqual(toYahooSymbols('AKO.B', 'NYSE'), ['AKO-B']);
  assert.deepEqual(toYahooSymbols('XYZ', 'MARTE'), []);
});

test('universo: ticker visible, sectores y filtro de cripto', () => {
  assert.equal(displayTicker('TGSU2.BA', 'accion'), 'TGSU2');
  assert.equal(displayTicker('ABEV3.SA', 'cedear'), 'ABEV3');
  assert.equal(displayTicker('^RUT', 'indice'), 'RUT');
  assert.equal(displayTicker('SUI20947-USD', 'cripto'), 'SUI');
  assert.equal(displayTicker('BTC-USD', 'cripto'), 'BTC');

  assert.equal(sectorFor({ quoteType: 'EQUITY', exchange: 'NMS', sector: 'Technology', industry: 'Semiconductors' }), 'Semiconductores');
  assert.equal(sectorFor({ quoteType: 'EQUITY', exchange: 'NYQ', sector: 'Healthcare' }), 'Salud');
  assert.equal(sectorFor({ quoteType: 'ETF', exchange: 'PCX' }), 'ETF');
  assert.equal(sectorFor({ quoteType: 'EQUITY', exchange: 'BUE', sector: 'Energy' }), 'Argentina');
  assert.equal(sectorFor({ quoteType: 'EQUITY', exchange: 'SAO', sector: 'Energy' }), 'Latam');
  assert.equal(sectorFor({ quoteType: 'EQUITY', exchange: 'NYQ', sector: 'Rara' }), 'Otros');

  const ranking = [
    { symbol: 'BTC-USD', name: 'Bitcoin USD' }, { symbol: 'USDT-USD', name: 'Tether USDt USD' }, { symbol: 'ETH-USD', name: 'Ethereum USD' },
    { symbol: 'STETH-USD', name: 'Lido Staked ETH USD' }, { symbol: 'WBTC-USD', name: 'Wrapped Bitcoin USD' }, { symbol: 'USDC-USD', name: 'USDC USD' },
    { symbol: 'AETHUSDT-USD', name: 'Aave Ethereum USDT USD' }, { symbol: 'PAXG-USD', name: 'PAX Gold USD' }, { symbol: 'HYPE32196-USD', name: 'Hyperliquid USD' },
    { symbol: 'DAI-USD', name: 'Dai USD' }, { symbol: 'PYUSD-USD', name: 'PayPal USD' }, { symbol: 'SOL-USD', name: 'Solana USD' },
  ];
  assert.deepEqual(pickCrypto(ranking, 3).map((c) => c.symbol), ['BTC-USD', 'ETH-USD', 'HYPE32196-USD']);
  assert.ok(isStableOrWrapped({ symbol: 'USDE29470-USD', name: 'Ethena USDe USD' }));
  assert.ok(!isStableOrWrapped({ symbol: 'XRP-USD', name: 'XRP USD' }));
});

test('Comafi: un programa de empresa no se resuelve a un ETF con el ticker reciclado', () => {
  assert.ok(!programAllowsEtf({ name: 'FACEBOOK, INC.' }));     // FB en Yahoo es un ETF de ProShares; Meta es META
  assert.ok(programAllowsEtf({ name: 'SPDR S&P 500 ETF TRUST' }));
  assert.ok(programAllowsEtf(undefined));                        // sin Comafi (ETFs de otros emisores) vale todo
});
