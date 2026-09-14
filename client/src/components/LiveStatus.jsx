import { RefreshCw } from 'lucide-react';
import { fmtTime } from '../utils/formatters.js';

export default function LiveStatus({ wsConnected, meta, refreshing, onRefresh }) {
  const loadingHistory = meta.total > 0 && meta.loaded < meta.total && meta.booting;
  return (
    <div className="flex items-center gap-2">
      <div
        className="inline-flex items-center gap-2 h-[34px] px-3 rounded-full text-[12px] font-medium num"
        style={{
          background: wsConnected ? '#e6f4ea' : '#f1f3f4',
          color: wsConnected ? 'var(--up)' : 'var(--text-muted)',
          border: `1px solid ${wsConnected ? '#b7e1cd' : 'var(--grid)'}`,
        }}
        title={wsConnected ? 'Conectado: el server empuja cotizaciones cada 60 s' : 'Sin conexión en vivo, reintentando…'}
      >
        <span className="live-dot w-2 h-2 rounded-full" style={{ background: wsConnected ? 'var(--up)' : 'var(--text-faint)' }} />
        <span className="tracking-wide">{wsConnected ? 'LIVE' : 'Reconectando…'}</span>
        <span className="hidden sm:inline" style={{ opacity: 0.8 }}>{fmtTime(meta.updatedAt)}</span>
      </div>

      {loadingHistory && (
        <span className="hidden md:inline text-[12px] num" style={{ color: 'var(--text-muted)' }}>
          Históricos {meta.loaded}/{meta.total}…
        </span>
      )}

      <button onClick={onRefresh} disabled={refreshing} className="icon-btn" title="Actualizar cotizaciones ahora">
        <RefreshCw size={15} className={refreshing ? 'animate-spin' : ''} />
      </button>
    </div>
  );
}
