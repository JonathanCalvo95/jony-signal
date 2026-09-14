const BASE = '/api/watchlist';

/** @returns {Promise<{rows: Array, meta: Object}>} */
export async function getWatchlist({ refresh = false } = {}) {
  const res = await fetch(refresh ? `${BASE}?refresh=1` : BASE);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'No se pudo cargar la lista');
  return data;
}
