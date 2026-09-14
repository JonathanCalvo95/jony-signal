// Reconstruye data/universe.json desde las fuentes (BYMA, Comafi, Yahoo) e informa lo que no se pudo resolver.
// Uso: node scripts/build-universe.mjs [--fresh]   (--fresh ignora el archivo anterior y vuelve a consultar todo)
import { buildUniverse } from '../services/universe.js';
import { readUniverseFile, writeUniverseFile } from '../services/store.js';

const fresh = process.argv.includes('--fresh');
const previous = fresh ? null : readUniverseFile();
const t0 = Date.now();
const universe = await buildUniverse({ previous, log: console.log });
writeUniverseFile(universe);

const bySector = {};
for (const e of universe.entries) bySector[e.sector] = (bySector[e.sector] ?? 0) + 1;
console.log(`\n${universe.entries.length} papeles en ${((Date.now() - t0) / 1000).toFixed(0)}s ·`, universe.sources);
console.log('por sector:', bySector);
if (universe.unresolved.length) {
  console.log(`\nSin resolver en Yahoo (${universe.unresolved.length}):`, universe.unresolved.map((u) => u.bymaTicker).join(' '));
}
