import { useMemo, useState } from 'react';
import { AlertCircle, Search, X } from 'lucide-react';
import { useWatchlist } from './hooks/useWatchlist.js';
import WatchlistTable from './components/WatchlistTable.jsx';
import LiveStatus from './components/LiveStatus.jsx';
import { SIGNALS, SIGNAL_KEYS, SECTOR_ORDER } from './utils/signals.js';

function universeLine(universe) {
  if (!universe?.sources) return 'Universo automático: CEDEARs y acciones de BYMA · top cripto · índices';
  const s = universe.sources;
  const when = universe.updatedAt
    ? new Date(universe.updatedAt).toLocaleString('es-AR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
    : '';
  return `Universo automático (${when}): ${s.cedears} CEDEARs listados en BYMA · ${s.argentina} acciones argentinas (paneles líder y general) · top ${s.cripto} cripto por capitalización · ${s.indices} índices`;
}

export default function App() {
  const { rows, meta, loading, refreshing, error, wsConnected, fetchAll } = useWatchlist();
  const [signal, setSignal] = useState(null);
  const [sector, setSector] = useState('');
  const [query, setQuery] = useState('');

  const filters = useMemo(() => ({ signal, sector, query: query.trim() }), [signal, sector, query]);
  const counts = useMemo(() => {
    const c = Object.fromEntries(SIGNAL_KEYS.map((k) => [k, 0]));
    for (const r of rows) if (r.signal) c[r.signal]++;
    return c;
  }, [rows]);
  const sectors = useMemo(() => {
    const present = new Set(rows.map((r) => r.sector).filter(Boolean));
    return [...SECTOR_ORDER.filter((s) => present.has(s)), ...[...present].filter((s) => !SECTOR_ORDER.includes(s))];
  }, [rows]);

  return (
    <div className="h-screen flex flex-col">
      {/* ── Encabezado ── */}
      <header className="flex items-center justify-between gap-3 px-4 py-2.5 shrink-0" style={{ background: 'var(--paper)', borderBottom: '1px solid var(--grid)' }}>
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex items-center justify-center w-9 h-9 rounded-lg shrink-0 font-bold text-white text-[13px]" style={{ background: 'var(--blue)' }}>JS</div>
          <div className="min-w-0">
            <h1 className="text-[15px] font-bold leading-none tracking-wide">JONY SIGNAL</h1>
            <p className="text-[11px] mt-1 leading-none truncate" style={{ color: 'var(--text-muted)' }}>
              Señales sobre el rango de 52 semanas · {rows.length} papeles · todo lo que cotiza en BYMA
            </p>
          </div>
        </div>
        <LiveStatus wsConnected={wsConnected} meta={meta} refreshing={refreshing} onRefresh={() => fetchAll({ refresh: true })} />
      </header>

      {error && (
        <div className="flex items-center gap-2 px-4 py-2 text-[13px]" style={{ background: '#fce8e6', color: 'var(--down)', borderBottom: '1px solid #f4c7c3' }}>
          <AlertCircle size={14} /> {error}
        </div>
      )}

      {/* ── Filtros ── */}
      <div className="flex flex-wrap items-center gap-2 px-4 py-2.5 shrink-0" style={{ borderBottom: '1px solid var(--grid)', background: 'var(--paper)' }}>
        <div className="relative flex items-center">
          <Search size={13} className="absolute left-2.5 pointer-events-none" style={{ color: 'var(--text-faint)' }} />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar ticker o nombre…"
            className="input pl-8 pr-7 w-[200px]"
            spellCheck={false}
          />
          {query && (
            <button onClick={() => setQuery('')} className="absolute right-2" style={{ color: 'var(--text-faint)' }} aria-label="Limpiar búsqueda"><X size={13} /></button>
          )}
        </div>

        <select
          value={sector}
          onChange={(e) => setSector(e.target.value)}
          className="input pr-7"
          style={{ color: sector ? 'var(--blue)' : 'var(--text-muted)', fontWeight: sector ? 500 : 400 }}
        >
          <option value="">Todos los sectores</option>
          {sectors.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>

        <div className="w-px h-6 mx-1 hidden sm:block" style={{ background: 'var(--grid)' }} />

        <button onClick={() => setSignal(null)} className={`pill ${signal === null ? 'is-active' : ''}`} style={signal === null ? { background: 'var(--band)' } : undefined}>
          Todas <span className="count">{rows.length}</span>
        </button>
        {SIGNAL_KEYS.map((key) => {
          const active = signal === key;
          return (
            <button
              key={key}
              onClick={() => setSignal(active ? null : key)}
              className={`pill ${active ? 'is-active' : ''}`}
              style={active ? { background: SIGNALS[key].bg } : undefined}
            >
              <span className="w-2.5 h-2.5 rounded-sm" style={{ background: SIGNALS[key].bg, border: '1px solid rgba(0,0,0,0.12)' }} />
              {SIGNALS[key].label} <span className="count">{counts[key]}</span>
            </button>
          );
        })}
      </div>

      {/* ── Tabla ── */}
      <main className="flex-1 min-h-0 overflow-auto">
        <WatchlistTable rows={rows} loading={loading} filters={filters} />
      </main>

      {/* ── Pie ── */}
      <footer className="px-4 py-2.5 text-[11px] leading-relaxed shrink-0" style={{ borderTop: '1px solid var(--grid)', color: 'var(--text-muted)', background: 'var(--paper)' }}>
        <div>{universeLine(meta.universe)}</div>
        <div className="flex flex-wrap gap-x-4 gap-y-1">
          <span>Datos: Yahoo Finance · cotizaciones cada 60 s · histórico cada hora · universo cada 24 h</span>
          <span>BUY = WEEK LOW + 50 % del rango · SELL = WEEK LOW + 85 % · CONVICCION: 85 en el mínimo, 80 en BUY, 17 en SELL, 15 en el máximo</span>
          <span>30 = contra el cierre de 30 ruedas atrás · Anual / 5 Años = contra el cierre de esa fecha</span>
        </div>
        <div className="mt-1" style={{ color: 'var(--text-faint)' }}>
          Las cotizaciones podrían tener una demora de hasta 15 minutos. La información se proporciona "tal como está" y únicamente con fines informativos, no para comercialización ni asesoramiento.
        </div>
      </footer>
    </div>
  );
}
