import { memo } from 'react';
import { AlertTriangle } from 'lucide-react';
import { SIGNALS, TIPO_LABEL, rsiBackground } from '../utils/signals.js';
import { fmtPrice, fmtTarget, fmtRsi, fmtPct, fmtInt } from '../utils/formatters.js';

function PctCell({ value }) {
  if (value == null) return <td className="num"><span className="muted">--</span></td>;
  return <td className="num"><span className={value >= 0 ? 'up' : 'down'}>{fmtPct(value)}</span></td>;
}

function NumCell({ value, format }) {
  return <td className="num">{value == null ? <span className="muted">--</span> : format(value)}</td>;
}

function TableRow({ row, band }) {
  const sig = row.signal ? SIGNALS[row.signal] : null;
  const title = [
    row.nombre,
    row.tipo && TIPO_LABEL[row.tipo],
    row.bymaTicker && row.bymaTicker !== row.ticker ? `BYMA: ${row.bymaTicker}` : null,
    row.ratio ? `ratio ${row.ratio}` : null,
    row.symbol !== row.ticker ? `Yahoo: ${row.symbol}` : null,
  ].filter(Boolean).join(' · ');

  return (
    <tr className={`row ${band ? 'is-band' : ''} ${row.pending ? 'is-pending' : ''}`}>
      <td className="cell-ticker" title={title}>
        <span className="inline-flex items-center gap-1.5">
          {row.error && <AlertTriangle size={13} color="var(--down)" aria-label={row.error} />}
          {row.ticker}
        </span>
      </td>

      <td className="cell-signal" style={{ background: sig ? sig.bg : undefined }}>
        {sig ? sig.label : <span className="muted">{row.error ? 'sin datos' : '…'}</span>}
      </td>

      <NumCell value={row.price} format={fmtPrice} />

      <td className="cell-rsi num" style={{ background: rsiBackground(row.rsi) }}>
        {row.rsi == null ? <span className="muted">--</span> : fmtRsi(row.rsi)}
      </td>

      <PctCell value={row.change24h} />
      <PctCell value={row.change30} />
      <NumCell value={row.weekLow52} format={fmtPrice} />
      <NumCell value={row.weekHigh52} format={fmtPrice} />
      <NumCell value={row.buy} format={fmtTarget} />
      <NumCell value={row.sell} format={fmtTarget} />
      <NumCell value={row.conviction} format={fmtInt} />
      <PctCell value={row.change1y} />
      <PctCell value={row.change5y} />

    </tr>
  );
}

export default memo(TableRow);
