// Shared WebSocket broadcast — imported by both index.js and routes/watchlist.js
// to avoid circular dependencies.

export const wsClients = new Set();

export function broadcastWatchlist(rows) {
  if (wsClients.size === 0) return;
  const msg = JSON.stringify({ type: 'watchlist', rows });
  for (const client of wsClients) {
    if (client.readyState === 1) client.send(msg);
  }
}
