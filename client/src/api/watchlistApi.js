const BASE = '/api/watchlist';

export async function getWatchlist() {
  const res = await fetch(BASE);
  if (!res.ok) throw new Error('Failed to fetch watchlist');
  return res.json();
}

export async function addTicker(ticker, targetBuy, targetSell) {
  const res = await fetch(BASE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ticker, targetBuy: targetBuy != null ? Number(targetBuy) : null, targetSell: targetSell != null ? Number(targetSell) : null }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to add ticker');
  return data;
}

export async function removeTicker(ticker) {
  const res = await fetch(`${BASE}/${ticker}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Failed to remove ticker');
}

export async function updateTargets(ticker, updates) {
  const res = await fetch(`${BASE}/${ticker}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates),
  });
  if (!res.ok) throw new Error('Failed to update targets');
  return res.json();
}

export async function getCatalog() {
  const res = await fetch(`${BASE}/catalog`);
  if (!res.ok) return [];
  return res.json();
}

export async function previewTicker(ticker) {
  const res = await fetch(`${BASE}/preview/${encodeURIComponent(ticker)}`);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to fetch ticker preview');
  return data;
}

export async function autoTargets(ticker) {
  const res = await fetch(`${BASE}/${ticker}/auto-targets`, { method: 'POST' });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to auto-calculate targets');
  return data;
}

export async function autoTargetsAll() {
  const res = await fetch(`${BASE}/auto-targets/all`, { method: 'POST' });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to auto-calculate targets');
  return data;
}
