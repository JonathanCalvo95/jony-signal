import SortHeader from './SortHeader.jsx';
import TableRow from './TableRow.jsx';
import { useSort } from '../hooks/useSort.js';
import { BarChart2 } from 'lucide-react';

const COLUMNS = [
  { key: 'ticker',     label: 'TICKER',      align: 'left'   },
  { key: 'signal',     label: 'SEÑAL',       align: 'center' },
  { key: 'price',      label: 'PRECIO',      align: 'right'  },
  { key: 'rsi',        label: 'RSI',         align: 'right'  },
  { key: 'change24h',  label: '%24H',        align: 'right'  },
  { key: 'change360d', label: '360D',        align: 'right'  },
  { key: 'weekLow52',  label: '52W LOW',     align: 'right'  },
  { key: 'weekHigh52', label: '52W HIGH',    align: 'right'  },
  { key: 'targetBuy',  label: 'TARGET BUY',  align: 'right'  },
  { key: 'targetSell', label: 'TARGET SELL', align: 'right'  },
  { key: 'mediaSenal', label: 'MEDIA',       align: 'right'  },
  { key: 'beta',       label: 'BETA 5Y',     align: 'right'  },
  { key: 'volume',     label: 'VOLUMEN',     align: 'right'  },
  { key: 'exDate',     label: 'EX DATE',     align: 'center' },
  { key: 'fechaPago',  label: 'PAGO',        align: 'center' },
  { key: '_del',       label: '',            align: 'center', noSort: true },
];

function SkeletonRow({ index }) {
  return (
    <tr style={{ borderColor: 'var(--border-subtle)', borderBottomWidth: 1 }}>
      {COLUMNS.map((col) => (
        <td key={col.key} className="px-3 py-3.5">
          <div
            className="skeleton rounded"
            style={{
              height: 12,
              width: col.key === 'ticker' ? 60 : col.key === 'signal' ? 70 : col.key === '_del' ? 24 : '80%',
              marginLeft: col.align === 'right' ? 'auto' : col.align === 'center' ? 'auto' : 0,
              marginRight: col.align === 'center' ? 'auto' : 0,
            }}
          />
        </td>
      ))}
    </tr>
  );
}

export default function WatchlistTable({ rows, loading, onUpdate, onRemove, onAutoTargets, filterSignal, filterSector, searchQuery }) {
  const { sortKey, sortDir, handleSort, sortedRows } = useSort(rows);

  const filtered = sortedRows
    .filter((r) => !filterSignal || r.signal === filterSignal)
    .filter((r) => !filterSector || r.sector === filterSector)
    .filter((r) => !searchQuery || r.ticker.toUpperCase().startsWith(searchQuery.toUpperCase()));

  if (loading) {
    return (
      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr style={{ background: 'var(--bg-surface)', borderBottomWidth: 1, borderColor: 'var(--border-default)' }}>
              {COLUMNS.map((col) => (
                <th key={col.key} className="px-3 py-3 text-[11px] font-semibold uppercase tracking-widest text-gray-600">
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {[...Array(7)].map((_, i) => <SkeletonRow key={i} index={i} />)}
          </tbody>
        </table>
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4">
        <div className="w-14 h-14 rounded-2xl flex items-center justify-center" style={{ background: 'var(--bg-elevated)' }}>
          <BarChart2 size={26} className="text-gray-600" />
        </div>
        <div className="text-center">
          <p className="text-gray-400 font-medium">Sin tickers en la lista</p>
          <p className="text-gray-600 text-sm mt-1">Agregá un ticker con el botón <span className="text-blue-400">+ Ticker</span></p>
        </div>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse">
        <thead className="sticky top-0 z-20">
          <tr style={{ background: 'var(--bg-surface)', borderBottom: '1px solid var(--border-default)' }}>
            {COLUMNS.map((col) =>
              col.noSort ? (
                <th key={col.key} className="w-10" />
              ) : (
                <SortHeader
                  key={col.key}
                  label={col.label}
                  colKey={col.key}
                  sortKey={sortKey}
                  sortDir={sortDir}
                  onSort={handleSort}
                  align={col.align}
                />
              )
            )}
          </tr>
        </thead>
        <tbody>
          {filtered.map((row) => (
            <TableRow
              key={row.ticker}
              row={row}
              onUpdate={onUpdate}
              onRemove={onRemove}
              onAutoTargets={onAutoTargets}
            />
          ))}
          {filtered.length === 0 && (
            <tr>
              <td colSpan={COLUMNS.length} className="text-center py-10 text-gray-600 text-sm">
                Sin tickers{filterSignal && <> con señal <strong className="text-gray-500">{filterSignal}</strong></>}{filterSector && <> en <strong className="text-gray-500">{filterSector}</strong></>}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
