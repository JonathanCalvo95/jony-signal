import { RefreshCw } from 'lucide-react';

export default function RefreshCountdown({ secondsLeft, onRefresh, loading }) {
  const mm = String(Math.floor(secondsLeft / 60)).padStart(2, '0');
  const ss = String(secondsLeft % 60).padStart(2, '0');
  const pct = (secondsLeft / 60) * 100;

  return (
    <div className="flex items-center gap-3">
      {/* Circular progress */}
      <div className="relative w-7 h-7">
        <svg className="w-7 h-7 -rotate-90" viewBox="0 0 28 28">
          <circle cx="14" cy="14" r="11" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="2" />
          <circle
            cx="14" cy="14" r="11" fill="none"
            stroke="rgba(59,130,246,0.6)" strokeWidth="2"
            strokeDasharray={`${2 * Math.PI * 11}`}
            strokeDashoffset={`${2 * Math.PI * 11 * (1 - pct / 100)}`}
            strokeLinecap="round"
            style={{ transition: 'stroke-dashoffset 1s linear' }}
          />
        </svg>
        <span className="absolute inset-0 flex items-center justify-center text-[8px] font-mono text-gray-500">
          {ss}
        </span>
      </div>

      <span className="text-[11px] font-mono text-gray-600 hidden sm:block">
        {mm}:{ss}
      </span>

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
