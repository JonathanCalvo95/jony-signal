import { useState, useEffect, useCallback, useRef } from 'react';
import { getWatchlist, addTicker, removeTicker, updateTargets, autoTargets, autoTargetsAll } from '../api/watchlistApi.js';

const REFRESH_INTERVAL = 60;

function getWsUrl() {
  const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${proto}//${window.location.host}/ws`;
}

export function useWatchlist() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [secondsLeft, setSecondsLeft] = useState(REFRESH_INTERVAL);
  const [wsConnected, setWsConnected] = useState(false);
  const wsRef = useRef(null);
  const countdownRef = useRef(null);
  const lastRowsRef = useRef(null);

  const fetchAll = useCallback(async (showLoading = false) => {
    if (showLoading) setLoading(true);
    setError(null);
    try {
      const data = await getWatchlist();
      setRows(data);
      lastRowsRef.current = JSON.stringify(data);
      setSecondsLeft(REFRESH_INTERVAL);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Initial load via REST
    fetchAll(true);

    // Countdown UI (purely cosmetic — no longer triggers fetch)
    countdownRef.current = setInterval(() => {
      setSecondsLeft((s) => (s <= 1 ? REFRESH_INTERVAL : s - 1));
    }, 1000);

    // WebSocket for real-time updates from server
    function connect() {
      const ws = new WebSocket(getWsUrl());
      wsRef.current = ws;

      ws.onopen = () => setWsConnected(true);

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.type === 'watchlist') {
            const next = JSON.stringify(msg.rows);
            if (next !== lastRowsRef.current) {
              lastRowsRef.current = next;
              setRows(msg.rows);
              setSecondsLeft(REFRESH_INTERVAL);
            }
          }
        } catch { /* ignore malformed messages */ }
      };

      ws.onclose = () => {
        setWsConnected(false);
        fetchAll();
        setTimeout(connect, 5_000);
      };

      ws.onerror = () => ws.close();
    }

    connect();

    return () => {
      clearInterval(countdownRef.current);
      if (wsRef.current) {
        wsRef.current.onclose = null; // prevent reconnect on intentional unmount
        wsRef.current.close();
      }
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

  return { rows, loading, error, secondsLeft, wsConnected, fetchAll, addRow, removeRow, updateRow, autoTargetsRow, autoTargetsAllRows };
}
