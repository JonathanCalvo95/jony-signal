import { RefreshCw } from 'lucide-react';

export default function RefreshCountdown({ secondsLeft, wsConnected, onRefresh, loading }) {
  const ss = String(secondsLeft % 60).padStart(2, '0');
  const mm = String(Math.floor(secondsLeft / 60)).padStart(2, '0');

  return (
    <div className="flex items-center gap-2">
      {/* Status pill: WebSocket + countdown */}
      <div
        className="flex items-center gap-2 px-2.5 py-1 rounded-full text-[10px] font-medium"
        style={{
          background: wsConnected ? 'rgba(34,212,122,0.08)' : 'rgba(107,114,128,0.08)',
          border: `1px solid ${wsConnected ? 'rgba(34,212,122,0.25)' : 'rgba(107,114,128,0.2)'}`,
          color: wsConnected ? '#22d47a' : '#9ca3af',
          boxShadow: wsConnected ? '0 0 10px -4px rgba(34,212,122,0.5)' : 'none',
        }}
      >
        <span
          className="w-1.5 h-1.5 rounded-full signal-dot"
          style={{
            background: wsConnected ? '#22d47a' : '#6b7280',
            color: wsConnected ? 'rgba(34,212,122,0.6)' : 'transparent',
          }}
        />
        <span className="tracking-wider hidden sm:block">
          {wsConnected ? 'LIVE' : 'Reconectando…'}
        </span>
        {wsConnected && (
          <span className="font-mono text-[10px] opacity-80 hidden sm:block">
            {mm}:{ss}
          </span>
        )}
      </div>

      {/* Manual refresh button */}
      <button
        onClick={onRefresh}
        disabled={loading}
        className="icon-btn w-7 h-7 text-gray-500 hover:!text-blue-400 hover:!border-blue-500/30 hover:!bg-blue-500/[0.06] disabled:opacity-40"
        title="Actualizar ahora"
      >
        <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
      </button>
    </div>
  );
}
