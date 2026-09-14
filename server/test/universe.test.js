import { test } from 'node:test';
import assert from 'node:assert/strict';
import { baseSymbols, altSeriesCandidates } from '../services/byma.js';
import { parseComafiTable, toYahooSymbols } from '../services/comafi.js';
import { displayTicker, isStableOrWrapped, pickCrypto, sectorFor } from '../services/universe.js';

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
