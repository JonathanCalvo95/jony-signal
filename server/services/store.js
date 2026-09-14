import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Archivos de datos:
//   - universe.json   → universo automático (generado; se reescribe cuando cambia)
//   - tickers-ar.json → overrides manuales: nombre, sector, tipo y símbolo Yahoo por ticker BYMA

const __dirname = dirname(fileURLToPath(import.meta.url));
const UNIVERSE_PATH  = join(__dirname, '../data/universe.json');
const OVERRIDES_PATH = join(__dirname, '../data/tickers-ar.json');

export function readUniverseFile() {
  try { return JSON.parse(readFileSync(UNIVERSE_PATH, 'utf-8')); }
  catch { return null; }
}

export function writeUniverseFile(universe) {
  writeFileSync(UNIVERSE_PATH, JSON.stringify(universe, null, 2) + '\n', 'utf-8');
}

/** Overrides manuales indexados por ticker BYMA/local (mayúsculas). */
export function readOverrides() {
  try {
    const list = JSON.parse(readFileSync(OVERRIDES_PATH, 'utf-8'));
    return new Map(list.map((c) => [c.ticker.toUpperCase(), c]));
  } catch {
    return new Map();
  }
}
