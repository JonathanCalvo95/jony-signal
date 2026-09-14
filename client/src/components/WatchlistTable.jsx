import { useMemo } from 'react';
import { BarChart2 } from 'lucide-react';
import SortHeader from './SortHeader.jsx';
import TableRow from './TableRow.jsx';
import { useSort } from '../hooks/useSort.js';
import { sectorRank } from '../utils/signals.js';

// Mismas columnas (y mismos nombres) que la planilla Luna Signal
export const COLUMNS = [
  { key: 'ticker',     label: 'TICKER',     width: 96,  title: 'Símbolo' },
  { key: 'signal',     label: 'SEÑAL',      width: 130, title: 'Señal según convicción' },
  { key: 'price',      label: 'PRECIO',     width: 92,  title: 'Último precio' },
  { key: 'rsi',        label: 'RSI',        width: 64,  title: 'RSI de Wilder, 14 ruedas' },
  { key: 'change24h',  label: '%24HS',      width: 84,  title: 'Variación contra el cierre anterior' },
  { key: 'change30',   label: '30',         width: 84,  title: 'Variación contra el cierre de 30 días hábiles atrás' },
  { key: 'weekLow52',  label: 'WEEK LOW',   width: 96,  title: 'Mínimo de 52 semanas' },
  { key: 'weekHigh52', label: 'WEEK HIGH',  width: 96,  title: 'Máximo de 52 semanas' },
  { key: 'buy',        label: 'BUY',        width: 100, title: 'WEEK LOW + 50% del rango' },
  { key: 'sell',       label: 'SELL',       width: 100, title: 'WEEK LOW + 85% del rango' },
  { key: 'conviction', label: 'CONVICCION', width: 106, title: 'Convicción de compra (15 a 85) según la posición del precio en el rango 52W' },
  { key: 'change1y',   label: 'Anual',      width: 84,  title: 'Variación en 12 meses' },
  { key: 'change5y',   label: '5 Años',     width: 84,  title: 'Variación en 5 años' },
];

function matches(row, { signal, sector, query }) {
  if (signal && row.signal !== signal) return false;
  if (sector && row.sector !== sector) return false;
  if (query) {
    const q = query.toUpperCase();
    return row.ticker.toUpperCase().startsWith(q) || row.symbol.toUpperCase().startsWith(q) || (row.nombre ?? '').toUpperCase().includes(q);
  }
  return true;
}

/** Agrupa por sector respetando el orden de la lista; ordena dentro de cada sección si hay columna elegida. */
function groupRows(rows, compare) {
  const groups = new Map();
  for (const row of rows) {
    const key = row.sector ?? 'Otros';
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(row);
  }
  return [...groups.entries()]
    .sort(([a], [b]) => sectorRank(a) - sectorRank(b))
    .map(([sector, items]) => ({ sector, rows: compare ? [...items].sort(compare) : items }));
}

function SkeletonRows() {
  return [...Array(12)].map((_, i) => (
    <tr key={i} className="row">
      {COLUMNS.map((c) => (
        <td key={c.key}><span className="skeleton" style={{ width: c.key === 'signal' ? 90 : '70%' }} /></td>
      ))}
    </tr>
  ));
}

export default function WatchlistTable({ rows, loading, filters }) {
  const { sortKey, sortDir, handleSort, compare } = useSort();

  const groups = useMemo(
    () => groupRows(rows.filter((r) => matches(r, filters)), compare),
    [rows, filters, compare],
  );
  const shown = groups.reduce((n, g) => n + g.rows.length, 0);

  if (!loading && rows.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-3" style={{ color: 'var(--text-muted)' }}>
        <div className="w-14 h-14 rounded-2xl flex items-center justify-center" style={{ background: 'var(--blue-soft)' }}>
          <BarChart2 size={26} color="var(--blue)" />
        </div>
        <p className="font-medium" style={{ color: 'var(--text)' }}>Todavía no hay papeles</p>
        <p className="text-sm">El universo se arma solo desde BYMA y Yahoo; si esto persiste, revisá la consola del server</p>
      </div>
    );
  }

  return (
    <div className="px-4 pt-3 pb-6">
      <table className="sheet">
        <thead>
          <tr>
            {COLUMNS.map((col) => (
              <SortHeader key={col.key} col={col} sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
            ))}
          </tr>
        </thead>
        <tbody>
          {loading && <SkeletonRows />}
          {!loading && groups.map((g) => (
            <GroupRows key={g.sector} group={g} />
          ))}
          {!loading && shown === 0 && (
            <tr>
              <td colSpan={COLUMNS.length} className="py-10 text-sm" style={{ color: 'var(--text-muted)', height: 'auto' }}>
                Ningún papel coincide con el filtro
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function GroupRows({ group }) {
  return (
    <>
      <tr className="group-row">
        <td colSpan={COLUMNS.length}>
          {group.sector.toUpperCase()}
          <span className="group-count">{group.rows.length}</span>
        </td>
      </tr>
      {group.rows.map((row, i) => (
        <TableRow key={row.symbol} row={row} band={i % 2 === 0} />
      ))}
    </>
  );
}
