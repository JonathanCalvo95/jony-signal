# CLAUDE.md — Jony Signal

Aplicación fullstack de seguimiento de acciones con señales de trading (compra/hold/venta) en tiempo real, usando Yahoo Finance como fuente de datos.

---

## Comandos

```bash
# Instalar dependencias (raíz + server + client)
npm run install:all

# Desarrollo (server + client en paralelo)
npm run dev
# → Server: http://localhost:3001
# → Client: http://localhost:5173

# Producción (client)
cd client && npm run build
```

---

## Arquitectura

```
jony-signal/
├── server/
│   ├── index.js                  # Express entry point (puerto 3001)
│   ├── routes/watchlist.js       # Todos los endpoints REST + lógica de señales
│   ├── services/
│   │   ├── yahooFinance.js       # Fetch de datos OHLCV (2 años, 1d)
│   │   └── rsi.js                # RSI Wilder 14 períodos
│   └── data/watchlist.json       # Persistencia (JSON simple)
└── client/src/
    ├── App.jsx                   # Layout + filtros + orquestación de handlers
    ├── hooks/
    │   ├── useWatchlist.js       # Estado principal, auto-refresh 60s, CRUD
    │   └── useSort.js            # Sorting multi-columna con useMemo
    ├── api/watchlistApi.js       # Wrapper fetch → Express
    ├── components/
    │   ├── WatchlistTable.jsx    # Tabla con skeleton loading
    │   ├── TableRow.jsx          # Fila: precio, señal, RSI, targets, botones
    │   ├── EditableCell.jsx      # Click → input inline, Enter/Esc confirma
    │   ├── AddTickerModal.jsx    # Modal agregar ticker (targets opcionales)
    │   ├── SignalBadge.jsx       # Badge BARATA / HOLD / CARA
    │   ├── SummaryBar.jsx        # Estadísticas globales
    │   ├── RefreshCountdown.jsx  # Timer circular 60s + botón refresh manual
    │   └── Toast.jsx             # Notificaciones (Context-based)
    └── utils/formatters.js       # formatPrice, formatPercent, formatRSI, formatVolume, formatDate
```

**Proxy**: Vite redirige `/api/*` → `http://localhost:3001` en desarrollo.

---

## API Endpoints

| Método | Ruta | Descripción |
|--------|------|-------------|
| `GET` | `/api/watchlist` | Todos los tickers con datos live |
| `POST` | `/api/watchlist` | Agregar ticker (targets opcionales) |
| `DELETE` | `/api/watchlist/:ticker` | Eliminar ticker |
| `PATCH` | `/api/watchlist/:ticker` | Actualizar targetBuy / targetSell |
| `GET` | `/api/watchlist/preview/:ticker` | Datos live de cualquier ticker sin guardar |
| `POST` | `/api/watchlist/:ticker/auto-targets` | Calcular y guardar targets automáticos |

---

## Lógica de señales

```js
// computeSignal en server/routes/watchlist.js
if (price <= targetBuy)  → 'BARATA'   // señal de compra (verde)
if (price >= targetSell) → 'CARA'     // señal de venta (rojo)
else                     → 'HOLD'     // mantener (naranja)
```

### Auto-cálculo de targets (52W range)
```js
targetBuy  = round(weekLow52  * 1.05, 2)  // 5% sobre el mínimo anual
targetSell = round(weekHigh52 * 0.95, 2)  // 5% bajo el máximo anual
```
Disponible via botón 🪄 por fila en la tabla y en el modal de agregar.

### mediaSenal
```js
mediaSenal = (targetBuy + targetSell) / 2
```

---

## Estructura de datos

### `watchlist.json` (almacenamiento)
```json
[
  { "ticker": "AAPL", "targetBuy": 195, "targetSell": 240 }
]
```

### Respuesta de la API (por ticker)
```js
{
  ticker, price, change24h, change360d,
  rsi,                   // RSI Wilder 14 períodos
  weekLow52, weekHigh52, // Rango 52 semanas
  volume, exDate, fechaPago,
  targetBuy, targetSell, mediaSenal,
  signal,                // 'BARATA' | 'HOLD' | 'CARA'
  error,                 // true si falló el fetch
}
```

---

## Stack técnico

| Capa | Tecnología |
|------|------------|
| Server | Node.js (ES modules), Express 4, CORS, nodemon |
| Datos | Yahoo Finance v8 chart API (fetch nativo) |
| Client | React 18, Vite 5 |
| Estilos | Tailwind CSS 3 + CSS custom properties |
| Íconos | lucide-react |
| Dev | concurrently (raíz), nodemon (server) |

---

## Convenciones

- **Idioma UI**: español argentino (labels, fechas `es-AR`, señales en español)
- **Colores**: variables CSS globales en `client/src/index.css` (`--bg-base`, `--bg-surface`, `--bg-elevated`, `--green`, `--red`, `--border-subtle`, etc.)
- **Fuentes**: Inter (sans) + JetBrains Mono (monospace para precios/números)
- **Errores HTTP**: 400 validación, 404 not found, 409 ticker duplicado
- **Optimistic updates**: `updateRow` actualiza el estado local antes de la llamada al server
- **Promise.allSettled**: los tickers con error de fetch muestran `error: true` sin romper la tabla
- **Refresh**: cada 60 segundos automático + botón manual; el countdown se resetea al refrescar
