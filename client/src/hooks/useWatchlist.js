import { useState, useEffect, useCallback, useRef } from 'react';
import { getWatchlist, addTicker, removeTicker, updateTargets, autoTargets, autoTargetsAll } from '../api/watchlistApi.js';

const REFRESH_INTERVAL = 60;

export function useWatchlist() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [secondsLeft, setSecondsLeft] = useState(REFRESH_INTERVAL);
  const intervalRef = useRef(null);
  const countdownRef = useRef(null);

  const fetchAll = useCallback(async (showLoading = false) => {
    if (showLoading) setLoading(true);
    setError(null);
    try {
      const data = await getWatchlist();
      setRows(data);
      setSecondsLeft(REFRESH_INTERVAL);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll(true);

    intervalRef.current = setInterval(() => fetchAll(), REFRESH_INTERVAL * 1000);
    countdownRef.current = setInterval(() => {
      setSecondsLeft((s) => (s <= 1 ? REFRESH_INTERVAL : s - 1));
    }, 1000);

    return () => {
      clearInterval(intervalRef.current);
      clearInterval(countdownRef.current);
    };
  }, [fetchAll]);

  async function addRow(ticker, targetBuy, targetSell) {
    await addTicker(ticker, targetBuy, targetSell);
    await fetchAll();
  }

  async function removeRow(ticker) {
    await removeTicker(ticker);
    setRows((prev) => prev.filter((r) => r.ticker !== ticker));
  }

  async function updateRow(ticker, updates) {
    // Optimistic update
    setRows((prev) =>
      prev.map((r) => {
        if (r.ticker !== ticker) return r;
        const next = { ...r, ...updates };
        const price = next.price;
        const tb = next.targetBuy;
        const ts = next.targetSell;
        next.mediaSenal = tb && ts ? Math.round(((tb + ts) / 2) * 100) / 100 : null;
        next.signal =
          price == null ? 'HOLD'
          : price <= tb ? 'BARATA'
          : price >= ts ? 'CARA'
          : 'HOLD';
        return next;
      })
    );
    await updateTargets(ticker, updates);
  }

  async function autoTargetsRow(ticker) {
    const result = await autoTargets(ticker);
    await updateRow(ticker, { targetBuy: result.targetBuy, targetSell: result.targetSell });
  }

  async function autoTargetsAllRows() {
    await autoTargetsAll();
    await fetchAll();
  }

  return { rows, loading, error, secondsLeft, fetchAll, addRow, removeRow, updateRow, autoTargetsRow, autoTargetsAllRows };
}
