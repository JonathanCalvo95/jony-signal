# CLAUDE.md — Jony Signal

Réplica en vivo de la planilla **Luna Signal**: una tabla con las mismas 13 columnas y las mismas fórmulas,
alimentada por Yahoo Finance, sobre un **universo automático**: todos los CEDEARs y acciones que cotizan en
BYMA, el top de cripto por capitalización y los índices de referencia. No se cargan papeles a mano.

---

## Comandos

```bash
npm run install:all      # deps de server + client
npm run dev              # server :3001 + client :5173 (proxy /api y /ws → 3001)
npm test                 # tests del server (fórmulas contra la planilla, universo, fechas)
npm run build            # build de producción del client (Render corre esto y después `npm start`)

cd server && node scripts/verify-luna.mjs          # compara el cálculo en vivo con la captura del 11/09/2026
cd server && node scripts/build-universe.mjs        # rearma data/universe.json e informa lo que no resolvió (--fresh: desde cero)
```

---

## Columnas y fórmulas (calcadas de la planilla)

| Columna | Cálculo |
|---------|---------|
| `PRECIO` | Último precio (spark, cada 60 s) |
| `RSI` | Wilder, 14 ruedas, sobre cierres diarios incluida la sesión en curso |
| `%24HS` | Variación contra el cierre de la sesión anterior |
| `30` | Variación contra el cierre de `WORKDAY(hoy, -30)` (30 días hábiles atrás) |
| `WEEK LOW` / `WEEK HIGH` | Mínimo/máximo **intradiario** de las velas con fecha > hoy − 365 días, incluido el precio actual |
| `BUY` | `WEEK LOW + 0.50 × (WEEK HIGH − WEEK LOW)` — punto medio |
| `SELL` | `WEEK LOW + 0.85 × (WEEK HIGH − WEEK LOW)` |
| `CONVICCION` | Posición del precio en el rango 52W (`pos`, 0 = mínimo, 1 = máximo), lineal por tramos: `85 − 10·pos` hasta BUY (→ 80), `80 − 63.5·(pos − 0.5)/0.35` hasta SELL (→ 16.5), `25 − 10·pos` hasta el máximo (→ 15). Redondeado a entero |
| `SEÑAL` | Por convicción: ≥ 80 **Compra Fuerte** · ≥ 60 **Compra** · ≥ 40 **Hold** · ≥ 20 **Venta** · < 20 **Venta Fuerte** |
| `Anual` | Variación contra el cierre del primer día hábil ≥ hoy − 12 meses |
| `5 Años` | Variación contra el cierre del primer día hábil ≥ hoy − 60 meses |

"Hoy" es la fecha de la última sesión del papel (zona horaria del exchange), no la del reloj: los
valores no cambian el fin de semana. Las fechas no hábiles se resuelven al **siguiente** día hábil,
igual que `GOOGLEFINANCE(ticker, "close", fecha)`.

Verificado contra la captura del 11/09/2026: 29 de 30 papeles coinciden en todas las columnas
(EEM difiere solo porque Google tenía un `low52` viejo). La columna `%24HS` de la planilla estaba
desfasada ese día (SPY +2,49 % con QQQ +0,55 %), acá es la variación diaria real.

Todo vive en `server/services/signals.js` (funciones puras) y está testeado en `server/test/`.

---

## Universo automático (`server/services/universe.js`)

| Fuente | Qué trae | Cómo se mapea a Yahoo |
|--------|----------|-----------------------|
| BYMA `open.bymadata.com.ar` → `cedears` | ~410 CEDEARs (acciones y ETFs) | tabla de programas de Comafi (símbolo BYMA → ticker de origen + mercado: DISN → DIS, BRKB → BRK-B, BAS → BAS.DE); si no, el mismo símbolo, `.SA` para tickers de B3 (ABEV3), o el mismo ticker en otra bolsa (ADS → ADS.DE). Cada candidato se valida con `/v1/finance/search` (símbolo exacto, acción o ETF) |
| BYMA → `leading-equity` + `general-equity` | ~70 acciones argentinas | `símbolo.BA`, salvo override (YPFD → YPF, TECO2 → TEO) |
| Yahoo screener `all_cryptocurrencies_us` | top 25 por capitalización | ya vienen como `XXX-USD`; se filtran stablecoins, tokens envueltos/stakeados y oro |
| Fijo | S&P 500, Nasdaq 100, Dow, Russell 2000, Merval | `^GSPC ^NDX ^DJI ^RUT ^MERV` |

- Las **series alternativas** de BYMA (AAPLB, AMD.B, BA..B, F.B, CADO5: viejo ratio, sin operaciones) se
  descartan salvo que Comafi las liste como programa real (BB = BlackBerry). Los fondos cerrados del panel
  general (`XXXXF`) también.
- **Sector**: el de Yahoo traducido (Technology → Tecnología, …; industria "Semiconductor" → Semiconductores;
  BUE → Argentina; SAO → Latam; ETF → ETF). `data/tickers-ar.json` es solo **overrides** del dueño (nombre,
  sector, tipo, símbolo Yahoo) para los papeles que clasificó a mano: nunca reclasificarlos.
- Resultado en `data/universe.json` (commiteado como arranque). Al bootear se usa si tiene menos de 24 h;
  si no, se rearma (solo se consulta Yahoo por lo nuevo; lo no resuelto se reintenta a la semana). Si BYMA
  no responde, se sigue con el archivo. Refresco cada 24 h en caliente; los papeles nuevos entran en el
  próximo tick del scheduler.
- Ticker visible: el de Yahoo sin sufijo (AAPL, ABEV3, RUT, BTC); las acciones argentinas conservan el
  ticker de BYMA (YPFD, TECO2). El tooltip muestra nombre, tipo, símbolo BYMA, ratio y símbolo Yahoo.

### Colores (Google Sheets)

- Señal: Compra Fuerte `#57bb8a` · Compra `#b7e1cd` · Hold `#fce8b2` · Venta `#f4c7c3` · Venta Fuerte `#e67c73`
- RSI: fondo rojo desde 57, verde hasta 30, amarillo el resto
- Variaciones: texto verde ≥ 0, rojo < 0 · Encabezados y filas de sector: azul `#1155cc` · Filas alternadas celestes

---

## Arquitectura

```
jony-signal/
├── server/
│   ├── index.js                  # Express + WebSocket (/ws) en el mismo puerto; arranca el scheduler
│   ├── routes/watchlist.js       # REST: GET lista completa, GET preview de cualquier símbolo
│   ├── services/
│   │   ├── universe.js           # Universo automático: BYMA + Comafi + Yahoo → data/universe.json, refresco diario
│   │   ├── byma.js               # Listados de BYMA (cedears, paneles) y detección de series alternativas
│   │   ├── comafi.js             # Tabla de programas de CEDEARs (símbolo BYMA → ticker/mercado/ratio) → símbolo Yahoo
│   │   ├── market.js             # Caché en memoria + scheduler (cotizaciones, históricos, anclas) + armado de filas
│   │   ├── yahoo.js              # Cliente Yahoo: spark (20 símbolos/request), chart, search, screener cripto
│   │   ├── signals.js            # Fórmulas de la planilla (puras): targets, convicción, señal, computeMetrics
│   │   ├── dates.js              # localDate, addDays, addMonths (EDATE), minusWeekdays (WORKDAY)
│   │   ├── rsi.js                # RSI Wilder 14
│   │   ├── store.js              # lectura/escritura de universe.json y overrides (tickers-ar.json)
│   │   └── broadcast.js          # set de clientes WS + broadcastWatchlist({ rows, meta })
│   ├── data/universe.json        # universo generado (commiteado como arranque; se reescribe al refrescar)
│   ├── data/tickers-ar.json      # overrides manuales: ticker BYMA → nombre, sector, tipo, símbolo Yahoo
│   ├── scripts/                  # verify-luna.mjs (planilla) · build-universe.mjs (universo)
│   └── test/                     # node:test — signals.test.js · universe.test.js
└── client/src/
    ├── App.jsx                   # header, filtros (búsqueda, sector, señal), tabla, pie
    ├── hooks/useWatchlist.js     # carga REST inicial + WebSocket ({ rows, meta }) con reconexión
    ├── hooks/useSort.js          # orden por columna dentro de cada sección
    ├── api/watchlistApi.js
    ├── components/
    │   ├── WatchlistTable.jsx    # columnas, agrupación por sector, filtros, skeleton
    │   ├── TableRow.jsx          # celdas con colores de señal/RSI/variaciones
    │   ├── SortHeader.jsx · LiveStatus.jsx
    └── utils/
        ├── formatters.js         # es-AR: "714,88", "2954,7725", "50,8", "-0,93%"
        └── signals.js            # labels/colores de señal, fondo del RSI, orden de sectores
```

### Datos: dos niveles de refresco

- **Cotizaciones** (`spark`, hasta 20 símbolos por request): cada 60 s para toda la lista (~19 requests).
- **Histórico diario** (`chart`, ~400 días, ~30 KB): al arrancar (concurrencia 8, ~20 s para 360 papeles)
  y después cada hora, de a 12 por minuto. Las filas se calculan sobre el histórico + el último precio
  (`mergeLive`), así RSI, rango 52W y señales siguen al precio en vivo sin rebajar el histórico.
- **Ancla de 5 años** (`chart` con ventana de dos semanas): una request chica por papel y por día.
- Fallos por símbolo con backoff exponencial (1 min → 1 h); el resto de la tabla no se entera.
- Mientras carga el histórico, las filas salen con `pending: true` y el cliente muestra "Históricos n/total".

---

## API

| Método | Ruta | Descripción |
|--------|------|-------------|
| `GET` | `/api/watchlist` | `{ rows, meta }` con todo el universo (`?refresh=1` fuerza cotizaciones) |
| `GET` | `/api/watchlist/preview/:symbol` | Fila calculada de cualquier papel (símbolo Yahoo, ticker visible o ticker BYMA) |
| WS | `/ws` | `{ type: 'watchlist', rows, meta }` al conectar y después de cada tick |

`meta` = `{ updatedAt, loaded, total, booting, universe: { updatedAt, sources: { cedears, argentina, cripto, indices, unresolved }, total } }`.

### Fila

```js
{
  symbol, ticker, nombre, sector, tipo,          // symbol = Yahoo ("TGSU2.BA"), ticker visible ("TGSU2")
  bymaTicker, ratio,                             // símbolo en BYMA y ratio del CEDEAR (Comafi), si se conocen
  price, change24h, rsi, change30,
  weekLow52, weekHigh52, buy, sell,
  conviction,                                    // 15–85
  signal,                                        // 'COMPRA_FUERTE' | 'COMPRA' | 'HOLD' | 'VENTA' | 'VENTA_FUERTE' | null
  change1y, change5y,                            // null si el papel no cotizaba (IPO reciente)
  marketDate,                                    // YYYY-MM-DD de la última sesión
  pending,                                       // true mientras falta el histórico
  error,                                         // mensaje si Yahoo no devolvió datos
}
```

---

## Stack

| Capa | Tecnología |
|------|------------|
| Server | Node 22 (ES modules, fetch nativo), Express 4, ws, nodemon (ignora `data/`) |
| Datos | Yahoo Finance `spark` + `chart` + `search` + screener (sin crumb ni cookies) · BYMA open data · tabla de Comafi |
| Client | React 18, Vite 5, Tailwind 3 + variables CSS, lucide-react, Roboto |
| Deploy | Render: `npm run build` + `npm start` (Express sirve `client/dist`, `PORT` lo pone Render) |

## Convenciones

- UI en español rioplatense; números con coma decimal y sin separador de miles, como la planilla.
- En desarrollo el server escucha fijo en 3001 (`SERVER_PORT` para cambiarlo); `PORT` solo se respeta en producción.
- Los sectores de `tickers-ar.json` son criterio del dueño (IREN en Cripto, RGTI en IA & Innovación…); no reclasificar. Lo que no está ahí se clasifica solo.
- Nunca volver a un listado manual de papeles: si falta algo, se arregla la fuente o el mapeo, no se agrega a mano.
- Errores HTTP: 400 validación, 404 símbolo inexistente en Yahoo.
