import { ChevronUp, ChevronDown } from 'lucide-react';

export default function SortHeader({ col, sortKey, sortDir, onSort }) {
  const active = sortKey === col.key;
  const Icon = sortDir === 'asc' ? ChevronUp : ChevronDown;
  return (
    <th
      role="button"
      tabIndex={0}
      aria-sort={active ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}
      onClick={() => onSort(col.key)}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSort(col.key); } }}
      className={`sortable ${active ? 'is-sorted' : ''}`}
      style={{ width: col.width }}
      title={`${col.title} · clic para ordenar`}
    >
      <span className="inline-flex items-center justify-center gap-1">
        {col.label}
        {active && <Icon size={14} strokeWidth={2.5} />}
      </span>
    </th>
  );
}
