/**
 * Calculate RSI using Wilder's Smoothing Method (14-period by default).
 * @param {number[]} closes - Array of closing prices (oldest first)
 * @param {number} period - RSI period (default 14)
 * @returns {number|null} RSI value rounded to 1 decimal, or null if insufficient data
 */
export function calculateRSI(closes, period = 14) {
  if (!closes || closes.length < period + 1) return null;

  const deltas = [];
  for (let i = 1; i < closes.length; i++) {
    deltas.push(closes[i] - closes[i - 1]);
  }

  // Initial average gain/loss (simple mean of first `period` deltas)
  let avgGain = 0;
  let avgLoss = 0;
  for (let i = 0; i < period; i++) {
    if (deltas[i] > 0) avgGain += deltas[i];
    else avgLoss += Math.abs(deltas[i]);
  }
  avgGain /= period;
  avgLoss /= period;

  // Wilder's smoothing for remaining deltas
  for (let i = period; i < deltas.length; i++) {
    const gain = deltas[i] > 0 ? deltas[i] : 0;
    const loss = deltas[i] < 0 ? Math.abs(deltas[i]) : 0;
    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;
  }

  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return Math.round((100 - 100 / (1 + rs)) * 10) / 10;
}
