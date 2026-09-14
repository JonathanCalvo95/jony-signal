// Señales, colores y orden de secciones — misma convención que la planilla Luna Signal.

export const SIGNALS = {
  COMPRA_FUERTE: { label: 'Compra Fuerte', bg: 'var(--sig-cf)', order: 0 },
  COMPRA:        { label: 'Compra',        bg: 'var(--sig-c)',  order: 1 },
  HOLD:          { label: 'Hold',          bg: 'var(--sig-h)',  order: 2 },
  VENTA:         { label: 'Venta',         bg: 'var(--sig-v)',  order: 3 },
  VENTA_FUERTE:  { label: 'Venta Fuerte',  bg: 'var(--sig-vf)', order: 4 },
};

export const SIGNAL_KEYS = Object.keys(SIGNALS);

/** Fondo de la celda RSI: rojo desde 57 (sobrecompra según la planilla), verde hasta 30, amarillo el resto. */
export function rsiBackground(rsi) {
  if (rsi == null) return 'transparent';
  if (rsi >= 57) return 'var(--rsi-high)';
  if (rsi <= 30) return 'var(--rsi-low)';
  return 'var(--rsi-mid)';
}

/** Orden de las secciones: ETFs primero (como en la planilla) y después los sectores. */
export const SECTOR_ORDER = [
  'ETF', 'Tecnología', 'Semiconductores', 'IA & Innovación', 'Comunicación', 'Finanzas', 'Salud',
  'Consumo', 'Energía', 'Industria', 'Materiales', 'Inmobiliario', 'Servicios Públicos', 'Latam', 'Argentina', 'Cripto',
];

export const TIPO_LABEL = { cedear: 'CEDEAR', etf: 'CEDEAR de ETF', accion: 'Acción', cripto: 'Cripto', indice: 'Índice' };

export function sectorRank(sector) {
  const i = SECTOR_ORDER.indexOf(sector);
  return i === -1 ? SECTOR_ORDER.length : i;
}
