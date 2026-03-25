import { RefreshCw } from 'lucide-react';

export default function RefreshCountdown({ secondsLeft, wsConnected, onRefresh, loading }) {
  const ss = String(secondsLeft % 60).padStart(2, '0');
  const mm = String(Math.floor(secondsLeft / 60)).padStart(2, '0');

  return (
    <div className="flex items-center gap-2.5">
      {/* WebSocket status indicator */}
      <div className="flex items-center gap-1.5">
        <span
          className="w-1.5 h-1.5 rounded-full"
          style={{
            background: wsConnected ? '#22d47a' : '#6b7280',
            boxShadow: wsConnected ? '0 0 6px rgba(34,212,122,0.7)' : 'none',
            animation: wsConnected ? 'pulse 2s ease-in-out infinite' : 'none',
          }}
        />
        <span
          className="text-[10px] font-medium hidden sm:block"
          style={{ color: wsConnected ? '#22d47a' : '#6b7280' }}
        >
          {wsConnected ? 'LIVE' : 'Reconectando…'}
        </span>
      </div>

      {/* Next update countdown — visible only when connected */}
      {wsConnected && (
        <span className="text-[11px] font-mono hidden sm:block" style={{ color: 'var(--text-muted)' }}>
          próx. {mm}:{ss}
        </span>
      )}

      {/* Manual refresh button */}
      <button
        onClick={onRefresh}
        disabled={loading}
        className="flex items-center justify-center w-7 h-7 rounded-lg border border-white/[0.06] bg-white/[0.03] text-gray-500 hover:text-blue-400 hover:border-blue-500/30 hover:bg-blue-500/[0.06] transition-all disabled:opacity-40"
        title="Actualizar ahora"
      >
        <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
      </button>
    </div>
  );
}
