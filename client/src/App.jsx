import { useState } from 'react';
import { useWatchlist } from './hooks/useWatchlist.js';
import WatchlistTable from './components/WatchlistTable.jsx';
import AddTickerModal from './components/AddTickerModal.jsx';
import RefreshCountdown from './components/RefreshCountdown.jsx';
import SummaryBar from './components/SummaryBar.jsx';
import { ToastProvider, useToast } from './components/Toast.jsx';
import { Plus, Zap, AlertCircle, Wand2, Search } from 'lucide-react';

const FILTER_OPTS = [
  { label: 'Todos',  value: null },
  { label: 'Baratas',value: 'BARATA' },
  { label: 'Hold',   value: 'HOLD' },
  { label: 'Caras',  value: 'CARA' },
];

const FILTER_COLORS = {
  BARATA: { active: '#22d47a', bg: 'rgba(34,212,122,0.1)', border: 'rgba(34,212,122,0.3)' },
  HOLD:   { active: '#f5a623', bg: 'rgba(245,166,35,0.1)',  border: 'rgba(245,166,35,0.3)' },
  CARA:   { active: '#f04e6a', bg: 'rgba(240,78,106,0.1)',  border: 'rgba(240,78,106,0.3)' },
  null:   { active: '#60a5fa', bg: 'rgba(96,165,250,0.08)', border: 'rgba(96,165,250,0.25)' },
};

function AppInner() {
  const toast = useToast();
  const { rows, loading, error, secondsLeft, fetchAll, addRow, removeRow, updateRow, autoTargetsRow, autoTargetsAllRows } = useWatchlist();
  const [autoingAll,   setAutoingAll]   = useState(false);
  const [showModal,    setShowModal]    = useState(false);
  const [filterSignal, setFilterSignal] = useState(null);
  const [filterSector, setFilterSector] = useState('');
  const [searchQuery,  setSearchQuery]  = useState('');

  async function handleAdd(ticker, targetBuy, targetSell) {
    await addRow(ticker, targetBuy, targetSell);
    toast(`${ticker} agregado a la lista`, 'success');
  }

  async function handleRemove(ticker) {
    await removeRow(ticker);
    toast(`${ticker} eliminado`, 'info');
  }

  async function handleUpdate(ticker, updates) {
    await updateRow(ticker, updates);
    toast(`${ticker} actualizado`, 'success');
  }

  async function handleAutoTargets(ticker) {
    await autoTargetsRow(ticker);
    toast(`${ticker} — targets calculados automáticamente`, 'success');
  }

  async function handleAutoTargetsAll() {
    setAutoingAll(true);
    try {
      await autoTargetsAllRows();
      toast('Targets actualizados para todos los papeles', 'success');
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setAutoingAll(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'var(--bg-base)' }}>

      {/* ── HEADER ── */}
      <header
        className="flex items-center justify-between px-5 py-3.5 sticky top-0 z-30"
        style={{
          background: 'rgba(7,13,26,0.92)',
          backdropFilter: 'blur(12px)',
          borderBottom: '1px solid var(--border-subtle)',
        }}
      >
        {/* Brand */}
        <div className="flex items-center gap-3">
          <div
            className="flex items-center justify-center w-8 h-8 rounded-xl"
            style={{ background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)', boxShadow: '0 0 16px rgba(59,130,246,0.35)' }}
          >
            <Zap size={15} fill="white" color="white" />
          </div>
          <div>
            <h1 className="text-white font-bold text-[15px] tracking-wide leading-none">
              JONY SIGNAL
            </h1>
            <p className="text-[10px] uppercase tracking-widest leading-none mt-0.5" style={{ color: 'var(--text-muted)' }}>
              Lista de Seguimiento
            </p>
          </div>

          {/* Live dot */}
          <div className="flex items-center gap-1.5 ml-2">
            <span className="live-dot w-1.5 h-1.5 rounded-full bg-green-500" />
            <span className="text-[10px] font-medium text-green-600 hidden sm:block">LIVE</span>
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-2">
          <RefreshCountdown
            secondsLeft={secondsLeft}
            onRefresh={() => fetchAll()}
            loading={loading}
          />
          <div className="w-px h-5 mx-1" style={{ background: 'var(--border-default)' }} />
          <button
            onClick={handleAutoTargetsAll}
            disabled={autoingAll || loading || rows.length === 0}
            className="btn-secondary flex items-center gap-1.5 text-[13px] px-3 py-2"
            title="Auto-calcular targets para todos los papeles"
          >
            <Wand2 size={13} strokeWidth={2} />
            <span className="hidden sm:inline">{autoingAll ? 'Calculando…' : 'Auto todos'}</span>
          </button>
          <button
            onClick={() => setShowModal(true)}
            className="btn-primary flex items-center gap-1.5 text-[13px] px-3 py-2"
          >
            <Plus size={13} strokeWidth={2.5} />
            <span className="hidden sm:inline">Ticker</span>
          </button>
        </div>
      </header>

      {/* ── ERROR BANNER ── */}
      {error && (
        <div
          className="flex items-center gap-2 px-5 py-2.5 text-[13px]"
          style={{ background: 'rgba(240,78,106,0.08)', borderBottom: '1px solid rgba(240,78,106,0.15)', color: '#f04e6a' }}
        >
          <AlertCircle size={14} />
          {error}
        </div>
      )}

      {/* ── SUMMARY BAR ── */}
      {!loading && rows.length > 0 && (
        <div style={{ borderBottom: '1px solid var(--border-subtle)' }}>
          <SummaryBar rows={rows} />
        </div>
      )}

      {/* ── FILTER TABS ── */}
      {!loading && rows.length > 0 && (
        <div
          className="flex items-center gap-2 px-5 py-2.5"
          style={{ borderBottom: '1px solid var(--border-subtle)' }}
        >
          {/* Search */}
          <div className="relative flex items-center mr-2">
            <Search size={12} className="absolute left-2.5 pointer-events-none" style={{ color: 'var(--text-muted)' }} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar ticker…"
              className="pl-7 pr-3 py-1.5 rounded-lg text-[12px] font-mono outline-none"
              style={{
                background: 'var(--bg-elevated)',
                border: '1px solid var(--border-subtle)',
                color: 'var(--text-primary)',
                width: 140,
              }}
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2 text-[10px] leading-none"
                style={{ color: 'var(--text-muted)' }}
              >✕</button>
            )}
          </div>
          {/* Sector filter */}
          <select
            value={filterSector}
            onChange={(e) => setFilterSector(e.target.value)}
            className="px-2 py-1.5 rounded-lg text-[12px] font-medium outline-none mr-2"
            style={{
              background: filterSector ? 'rgba(96,165,250,0.08)' : 'var(--bg-elevated)',
              border: filterSector ? '1px solid rgba(96,165,250,0.3)' : '1px solid var(--border-subtle)',
              color: filterSector ? '#60a5fa' : 'var(--text-muted)',
            }}
          >
            <option value="">Todos los sectores</option>
            {['Tecnología','Semiconductores','IA & Innovación','Comunicación','Finanzas','Salud','Consumo','Energía','Industria','Materiales','Cripto','Latam','ETF','Argentina'].map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>

          {FILTER_OPTS.map(({ label, value }) => {
            const active = filterSignal === value;
            const colors = FILTER_COLORS[value] ?? FILTER_COLORS[null];
            return (
              <button
                key={label}
                onClick={() => setFilterSignal(value)}
                className="px-3 py-1.5 rounded-lg text-[12px] font-medium transition-all"
                style={
                  active
                    ? { background: colors.bg, border: `1px solid ${colors.border}`, color: colors.active }
                    : { background: 'transparent', border: '1px solid transparent', color: 'var(--text-muted)' }
                }
              >
                {label}
                {value && (
                  <span className="ml-1.5 font-mono text-[10px] opacity-70">
                    {rows.filter((r) => r.signal === value).length}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* ── TABLE ── */}
      <main className="flex-1 overflow-auto">
        <WatchlistTable
          rows={rows}
          loading={loading}
          onUpdate={handleUpdate}
          onRemove={handleRemove}
          onAutoTargets={handleAutoTargets}
          filterSignal={filterSignal}
          filterSector={filterSector}
          searchQuery={searchQuery}
        />
      </main>

      {/* ── FOOTER ── */}
      <footer
        className="px-5 py-2 flex items-center justify-between text-[11px]"
        style={{ borderTop: '1px solid var(--border-subtle)', color: 'var(--text-muted)' }}
      >
        <span>Datos: Yahoo Finance · Auto-refresh 60s</span>
        <span className="hidden sm:block">Hacé clic en TARGET BUY/SELL para editar · 🪄 Auto-calcula con rango 52W</span>
      </footer>

      {/* ── MODAL ── */}
      {showModal && (
        <AddTickerModal
          onAdd={handleAdd}
          onClose={() => setShowModal(false)}
        />
      )}
    </div>
  );
}

export default function App() {
  return (
    <ToastProvider>
      <AppInner />
    </ToastProvider>
  );
}
