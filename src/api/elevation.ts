/**
 * Perfil altimétrico vía Open-Meteo (la misma fuente SRTM que usa el backend
 * al importar). `POST /routes/calculate` devuelve el desnivel acumulado pero no
 * la cota punto a punto, así que la curva se pide aquí, muestreando la ruta.
 */

const OPEN_METEO = 'https://api.open-meteo.com/v1/elevation';
/** Tope de coordenadas por request de Open-Meteo. */
const MAX_POINTS = 100;

/** Índices repartidos uniformemente sobre `length`, extremos incluidos. */
export function sampleIndices(length: number, max = MAX_POINTS): number[] {
  if (length <= max) return Array.from({ length }, (_, i) => i);
  const out: number[] = [];
  for (let i = 0; i < max; i++) {
    out.push(Math.round((i / (max - 1)) * (length - 1)));
  }
  return [...new Set(out)];
}

/**
 * Cotas (m) para los puntos dados. Devuelve `null` si el servicio falla: el
 * perfil es un extra, no debe tumbar el cálculo de la ruta.
 */
export async function fetchElevations(
  points: [number, number][],
  signal?: AbortSignal,
): Promise<number[] | null> {
  if (points.length === 0) return null;
  const lat = points.map((p) => p[0].toFixed(5)).join(',');
  const lon = points.map((p) => p[1].toFixed(5)).join(',');
  try {
    const res = await fetch(`${OPEN_METEO}?latitude=${lat}&longitude=${lon}`, { signal });
    if (!res.ok) return null;
    const data: { elevation?: number[] } = await res.json();
    if (!Array.isArray(data.elevation) || data.elevation.length !== points.length) {
      return null;
    }
    return data.elevation;
  } catch {
    return null;
  }
}
