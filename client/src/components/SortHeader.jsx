import { ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react';

export default function SortHeader({ label, colKey, sortKey, sortDir, onSort, align = 'right' }) {
  const active = sortKey === colKey;
  const alignClass = align === 'left' ? 'justify-start text-left' : align === 'center' ? 'justify-center text-center' : 'justify-end text-right';

  const Icon = active
    ? sortDir === 'asc' ? ChevronUp : ChevronDown
    : ChevronsUpDown;

  return (
    <th
      onClick={() => onSort(colKey)}
      className="px-3 py-0 select-none cursor-pointer group"
    >
      <div
        className={`inline-flex items-center gap-1 ${alignClass} w-full py-3 text-[11px] font-semibold uppercase tracking-widest transition-colors ${
          active ? 'text-blue-400' : 'text-gray-500 group-hover:text-gray-300'
        }`}
      >
        <span>{label}</span>
        <Icon
          size={12}
          className={`shrink-0 transition-opacity ${active ? 'opacity-100' : 'opacity-0 group-hover:opacity-60'}`}
        />
      </div>
    </th>
  );
}
