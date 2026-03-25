import { TrendingUp, TrendingDown, Minus, Activity } from 'lucide-react';

function StatCard({ label, value, icon: Icon, color, bg, border }) {
  return (
    <div
      className="flex items-center gap-3 px-4 py-3 rounded-xl border"
      style={{ background: bg, borderColor: border }}
    >
      <div
        className="flex items-center justify-center w-8 h-8 rounded-lg"
        style={{ background: `${color}20` }}
      >
        <Icon size={15} style={{ color }} />
      </div>
      <div>
        <div className="text-xl font-bold font-data leading-none" style={{ color }}>
          {value}
        </div>
        <div className="text-xs font-medium mt-0.5" style={{ color: 'var(--text-muted)' }}>
          {label}
        </div>
      </div>
    </div>
  );
}

export default function SummaryBar({ rows }) {
  const total   = rows.length;
  const barata  = rows.filter((r) => r.signal === 'BARATA').length;
  const cara    = rows.filter((r) => r.signal === 'CARA').length;
  const hold    = rows.filter((r) => r.signal === 'HOLD').length;
  const gainers = rows.filter((r) => r.change24h != null && r.change24h > 0).length;
  const losers  = rows.filter((r) => r.change24h != null && r.change24h < 0).length;

  if (total === 0) return null;

  return (
    <div className="flex flex-wrap gap-3 px-5 py-3">
      <StatCard
        label="Total Tickers"
        value={total}
        icon={Activity}
        color="var(--blue-dim)"
        bg="rgba(96,165,250,0.06)"
        border="rgba(96,165,250,0.15)"
      />
      <StatCard
        label="Baratas"
        value={barata}
        icon={TrendingDown}
        color="var(--green)"
        bg="var(--green-bg)"
        border="var(--green-border)"
      />
      <StatCard
        label="Hold"
        value={hold}
        icon={Minus}
        color="var(--yellow)"
        bg="var(--yellow-bg)"
        border="var(--yellow-border)"
      />
      <StatCard
        label="Caras"
        value={cara}
        icon={TrendingUp}
        color="var(--red)"
        bg="var(--red-bg)"
        border="var(--red-border)"
      />
      {total > 0 && (
        <div
          className="flex items-center gap-3 px-4 py-3 rounded-xl border ml-auto"
          style={{ background: 'var(--bg-surface)', borderColor: 'var(--border-subtle)' }}
        >
          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Hoy</span>
          <span className="text-sm font-data font-medium text-green-400">
            ↑ {gainers}
          </span>
          <span className="text-sm font-data font-medium text-red-400">
            ↓ {losers}
          </span>
        </div>
      )}
    </div>
  );
}
