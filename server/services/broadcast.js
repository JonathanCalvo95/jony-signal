// WebSocket compartido entre index.js y el scheduler (evita dependencias circulares).

export const wsClients = new Set();

export function broadcastWatchlist({ rows, meta }) {
  if (wsClients.size === 0) return;
  const msg = JSON.stringify({ type: 'watchlist', rows, meta });
  for (const client of wsClients) {
    if (client.readyState === 1) client.send(msg);
  }
}
