import { useState, useCallback, useMemo } from 'react';

// Ordenar por SEÑAL equivale a ordenar por convicción (la señal sale de ahí)
const SORT_FIELD = { signal: 'conviction' };

export function useSort() {
  const [sort, setSort] = useState({ key: null, dir: 'desc' });

  const handleSort = useCallback((key) => {
    setSort((prev) => (
      prev.key === key
        ? { key, dir: prev.dir === 'desc' ? 'asc' : 'desc' }
        : { key, dir: key === 'ticker' ? 'asc' : 'desc' }
    ));
  }, []);

  const clearSort = useCallback(() => setSort({ key: null, dir: 'desc' }), []);

  /** Comparador para ordenar filas dentro de cada sección; null = orden de la lista. */
  const compare = useMemo(() => {
    if (!sort.key) return null;
    const field = SORT_FIELD[sort.key] ?? sort.key;
    const dir = sort.dir === 'asc' ? 1 : -1;
    return (a, b) => {
      const av = a[field], bv = b[field];
      if (av == null && bv == null) return 0;
      if (av == null) return 1;   // sin dato siempre al final
      if (bv == null) return -1;
      if (typeof av === 'string') return av.localeCompare(bv) * dir;
      return (av - bv) * dir;
    };
  }, [sort]);

  return { sortKey: sort.key, sortDir: sort.dir, handleSort, clearSort, compare };
}
