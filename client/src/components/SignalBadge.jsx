const CONFIG = {
  BARATA: {
    label: 'BARATA',
    dot: '#22d47a',
    bg: 'rgba(34,212,122,0.1)',
    border: 'rgba(34,212,122,0.25)',
    text: '#22d47a',
  },
  CARA: {
    label: 'CARA',
    dot: '#f04e6a',
    bg: 'rgba(240,78,106,0.1)',
    border: 'rgba(240,78,106,0.25)',
    text: '#f04e6a',
  },
  HOLD: {
    label: 'HOLD',
    dot: '#f5a623',
    bg: 'rgba(245,166,35,0.1)',
    border: 'rgba(245,166,35,0.25)',
    text: '#f5a623',
  },
};

export default function SignalBadge({ signal }) {
  const cfg = CONFIG[signal] || CONFIG.HOLD;
  return (
    <span
      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold tracking-wider whitespace-nowrap"
      style={{
        background: cfg.bg,
        border: `1px solid ${cfg.border}`,
        color: cfg.text,
      }}
    >
      <span
        className="w-1.5 h-1.5 rounded-full shrink-0"
        style={{ background: cfg.dot }}
      />
      {cfg.label}
    </span>
  );
}
