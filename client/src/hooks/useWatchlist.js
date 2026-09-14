import { useState, useEffect, useCallback, useRef } from 'react';
import { getWatchlist } from '../api/watchlistApi.js';

const EMPTY_META = { updatedAt: null, loaded: 0, total: 0, booting: false, universe: null };

function getWsUrl() {
  const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${proto}//${window.location.host}/ws`;
}

/**
 * Estado principal: filas + meta. Carga inicial por REST y después el server
 * empuja actualizaciones por WebSocket cada minuto (con fallback a REST si se cae).
 */
export function useWatchlist() {
  const [rows, setRows] = useState([]);
  const [meta, setMeta] = useState(EMPTY_META);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [wsConnected, setWsConnected] = useState(false);
  const wsRef = useRef(null);
  const lastRowsRef = useRef(null);

  const apply = useCallback((data) => {
    const next = JSON.stringify(data.rows);
    if (next !== lastRowsRef.current) {
      lastRowsRef.current = next;
      setRows(data.rows);
    }
    setMeta(data.meta ?? EMPTY_META);
    setError(null); // llegaron datos: cualquier error anterior ya no aplica
  }, []);

  const fetchAll = useCallback(async ({ refresh = false, initial = false } = {}) => {
    if (initial) setLoading(true);
    if (refresh) setRefreshing(true);
    setError(null);
    try {
      apply(await getWatchlist({ refresh }));
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [apply]);

  useEffect(() => {
    fetchAll({ initial: true });

    let closed = false;
    let retry = null;
    function connect() {
      const ws = new WebSocket(getWsUrl());
      wsRef.current = ws;
      ws.onopen = () => setWsConnected(true);
      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.type === 'watchlist') apply(msg);
        } catch { /* mensaje malformado */ }
      };
      ws.onclose = () => {
        setWsConnected(false);
        if (closed) return;
        fetchAll();
        retry = setTimeout(connect, 5_000);
      };
      ws.onerror = () => ws.close();
    }
    connect();

    return () => {
      closed = true;
      clearTimeout(retry);
      wsRef.current?.close();
    };
  }, [fetchAll, apply]);

  return { rows, meta, loading, refreshing, error, wsConnected, fetchAll };
}
