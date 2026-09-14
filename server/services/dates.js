// Helpers de fechas en formato ISO (YYYY-MM-DD). Todo se resuelve en UTC para
// que el resultado no dependa de la zona horaria del servidor.

/** Fecha local del exchange para un timestamp unix (segundos) y su gmtoffset. */
export function localDate(unixSeconds, gmtoffset = 0) {
  return new Date((unixSeconds + gmtoffset) * 1000).toISOString().slice(0, 10);
}

export function toUnix(iso) {
  return Math.floor(Date.parse(iso + 'T00:00:00Z') / 1000);
}

export function addDays(iso, n) {
  const d = new Date(iso + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/**
 * Equivalente a EDATE de Sheets: mismo día, n meses adelante/atrás, con el día
 * recortado al último del mes destino (29/02 - 12 meses = 28/02).
 */
export function addMonths(iso, n) {
  const [y, m, day] = iso.split('-').map(Number);
  const first = new Date(Date.UTC(y, m - 1 + n, 1));
  const lastDay = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0)).getUTCDate();
  first.setUTCDate(Math.min(day, lastDay));
  return first.toISOString().slice(0, 10);
}

/**
 * Equivalente a WORKDAY(fecha, -n) de Sheets sin lista de feriados: retrocede
 * n días hábiles (lunes a viernes).
 */
export function minusWeekdays(iso, n) {
  const d = new Date(iso + 'T00:00:00Z');
  let left = n;
  while (left > 0) {
    d.setUTCDate(d.getUTCDate() - 1);
    const dow = d.getUTCDay();
    if (dow !== 0 && dow !== 6) left--;
  }
  return d.toISOString().slice(0, 10);
}
