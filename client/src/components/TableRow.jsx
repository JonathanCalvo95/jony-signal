import { useState } from 'react';
import { Trash2, AlertTriangle, ArrowUpRight, ArrowDownRight, Wand2 } from 'lucide-react';
import SignalBadge from './SignalBadge.jsx';
import EditableCell from './EditableCell.jsx';
import { formatPrice, formatPercent, formatRSI, formatVolume, formatDate, formatBeta } from '../utils/formatters.js';

function PctCell({ value }) {
  if (value == null) return <span className="font-mono text-[13px] text-gray-600">--</span>;
  const pos = value >= 0;
  const Icon = pos ? ArrowUpRight : ArrowDownRight;
  return (
    <span className={`inline-flex items-center gap-0.5 font-mono text-[13px] font-medium ${pos ? 'text-green-400' : 'text-red-400'}`}>
      <Icon size={12} strokeWidth={2.5} />
      {Math.abs(value).toFixed(2)}%
    </span>
  );
}

function RSICell({ value }) {
  if (value == null) return <span className="font-mono text-[13px] text-gray-600">--</span>;
  const color = value >= 70 ? '#f04e6a' : value <= 30 ? '#22d47a' : '#8b99b8';
  const width = Math.max(4, Math.min(100, value));
  return (
    <div className="flex items-center gap-2 justify-end">
      <span className="font-mono text-[13px] font-medium" style={{ color }}>
        {formatRSI(value)}
      </span>
      <div className="w-8 h-1 rounded-full overflow-hidden bg-white/[0.06]">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${width}%`, background: color }}
        />
      </div>
    </div>
  );
}

export default function TableRow({ row, onUpdate, onRemove, onAutoTargets }) {
  const [autoLoading, setAutoLoading] = useState(false);

  async function handleAuto() {
    setAutoLoading(true);
    try {
      await onAutoTargets(row.ticker);
    } finally {
      setAutoLoading(false);
    }
  }

  const signalRowBg = {
    BARATA: 'rgba(34,212,122,0.02)',
    CARA:   'rgba(240,78,106,0.02)',
    HOLD:   'transparent',
  }[row.signal] || 'transparent';

  return (
    <tr
      className="watchlist-row border-b transition-colors duration-150 cursor-default"
      style={{ borderColor: 'var(--border-subtle)', background: signalRowBg }}
    >
      {/* TICKER */}
      <td className="px-4 py-3 text-left sticky left-0 z-10" style={{ background: 'inherit' }}>
        <div className="flex items-center gap-2">
          {row.error && (
            <AlertTriangle size={12} className="text-yellow-500 shrink-0" />
          )}
          <div>
            <span className="font-semibold text-white text-[13px] tracking-wide">{row.ticker}</span>
            {row.sector && (
              <div className="text-[10px] font-medium mt-0.5" style={{ color: 'var(--text-muted)' }}>
                {row.sector}
              </div>
            )}
          </div>
        </div>
      </td>

      {/* SEÑAL */}
      <td className="px-3 py-3 text-center">
        <SignalBadge signal={row.signal} />
      </td>

      {/* PRECIO */}
      <td className="px-3 py-3 text-right">
        <span className="font-mono text-[14px] font-semibold text-white">
          {formatPrice(row.price)}
        </span>
      </td>

      {/* RSI */}
      <td className="px-3 py-3 text-right">
        <RSICell value={row.rsi} />
      </td>

      {/* %24HS */}
      <td className="px-3 py-3 text-right">
        <PctCell value={row.change24h} />
      </td>

      {/* 360 */}
      <td className="px-3 py-3 text-right">
        <PctCell value={row.change360d} />
      </td>

      {/* 52W LOW */}
      <td className="px-3 py-3 text-right">
        <span className="font-mono text-[13px] text-gray-400">
          {formatPrice(row.weekLow52)}
        </span>
      </td>

      {/* 52W HIGH */}
      <td className="px-3 py-3 text-right">
        <span className="font-mono text-[13px] text-gray-400">
          {formatPrice(row.weekHigh52)}
        </span>
      </td>

      {/* TARGET BUY */}
      <td className="px-3 py-3 text-right min-w-[100px]">
        <EditableCell
          value={row.targetBuy}
          onSave={(v) => onUpdate(row.ticker, { targetBuy: v })}
        />
      </td>

      {/* TARGET SELL */}
      <td className="px-3 py-3 text-right min-w-[100px]">
        <EditableCell
          value={row.targetSell}
          onSave={(v) => onUpdate(row.ticker, { targetSell: v })}
        />
      </td>

      {/* MEDIA SEÑAL */}
      <td className="px-3 py-3 text-right">
        <span className="font-mono text-[13px] text-blue-400/80">
          {formatPrice(row.mediaSenal)}
        </span>
      </td>

      {/* BETA */}
      <td className="px-3 py-3 text-right">
        <span
          className="font-mono text-[13px] font-medium"
          style={{
            color: row.beta == null ? 'var(--text-muted)'
              : row.beta > 1.5 ? '#f04e6a'
              : row.beta > 1   ? '#f5a623'
              : row.beta < 0   ? '#a78bfa'
              : '#8b99b8',
          }}
        >
          {formatBeta(row.beta)}
        </span>
      </td>

      {/* VOL */}
      <td className="px-3 py-3 text-right">
        <span className="font-mono text-[12px] text-gray-500">
          {formatVolume(row.volume)}
        </span>
      </td>

      {/* ExDate */}
      <td className="px-3 py-3 text-center">
        <span className="font-mono text-[12px] text-gray-500 whitespace-nowrap">
          {formatDate(row.exDate)}
        </span>
      </td>

      {/* FechaPago */}
      <td className="px-3 py-3 text-center">
        <span className="font-mono text-[12px] text-gray-500 whitespace-nowrap">
          {formatDate(row.fechaPago)}
        </span>
      </td>

      {/* AUTO + DELETE */}
      <td className="px-3 py-3 text-center">
        <div className="flex items-center justify-center gap-1">
          <button
            onClick={handleAuto}
            disabled={autoLoading || !row.weekLow52 || !row.weekHigh52}
            className="flex items-center justify-center w-7 h-7 rounded-lg transition-all"
            style={{ color: autoLoading ? 'rgba(167,139,250,0.4)' : 'rgba(167,139,250,0.6)' }}
            title={`Auto-calcular targets de ${row.ticker} (52W range)`}
          >
            {autoLoading
              ? <span className="w-3 h-3 border border-purple-400/40 border-t-purple-400 rounded-full animate-spin" />
              : <Wand2 size={13} />
            }
          </button>
          <button
            onClick={() => onRemove(row.ticker)}
            className="flex items-center justify-center w-7 h-7 rounded-lg text-gray-700 hover:text-red-400 hover:bg-red-400/10 transition-all"
            title={`Eliminar ${row.ticker}`}
          >
            <Trash2 size={13} />
          </button>
        </div>
      </td>
    </tr>
  );
}
