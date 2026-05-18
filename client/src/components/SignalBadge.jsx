const CONFIG = {
  BARATA: {
    label: 'BARATA',
    dot: '#22d47a',
    bg: 'linear-gradient(135deg, rgba(34,212,122,0.16), rgba(34,212,122,0.06))',
    border: 'rgba(34,212,122,0.32)',
    text: '#22d47a',
    glow: 'rgba(34,212,122,0.25)',
  },
  CARA: {
    label: 'CARA',
    dot: '#f04e6a',
    bg: 'linear-gradient(135deg, rgba(240,78,106,0.16), rgba(240,78,106,0.06))',
    border: 'rgba(240,78,106,0.32)',
    text: '#f04e6a',
    glow: 'rgba(240,78,106,0.25)',
  },
  HOLD: {
    label: 'HOLD',
    dot: '#f5a623',
    bg: 'linear-gradient(135deg, rgba(245,166,35,0.14), rgba(245,166,35,0.05))',
    border: 'rgba(245,166,35,0.28)',
    text: '#f5a623',
    glow: 'rgba(245,166,35,0.2)',
  },
};

export default function SignalBadge({ signal }) {
  const cfg = CONFIG[signal] || CONFIG.HOLD;
  return (
    <span
      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold tracking-wider whitespace-nowrap transition-all"
      style={{
        background: cfg.bg,
        border: `1px solid ${cfg.border}`,
        color: cfg.text,
        boxShadow: `0 0 12px -4px ${cfg.glow}`,
      }}
    >
      <span
        className="w-1.5 h-1.5 rounded-full shrink-0 signal-dot"
        style={{ background: cfg.dot, color: cfg.glow }}
      />
      {cfg.label}
    </span>
  );
}
