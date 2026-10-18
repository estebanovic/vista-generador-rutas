/**
 * Geocodificación con Nominatim (OSM). El backend trabaja con lat/lon, así que
 * los campos de origen/destino traducen nombre → coordenadas por aquí.
 * Uso ligero y con debounce: Nominatim limita a ~1 req/s.
 */
import type { Waypoint } from '../lib/types';

const NOMINATIM = 'https://nominatim.openstreetmap.org';

interface NominatimPlace {
  display_name: string;
  lat: string;
  lon: string;
  type?: string;
  addresstype?: string;
}

export interface Suggestion extends Waypoint {
  detail: string;
}

/** Corta «Jaca, Alto Gállego, Huesca, Aragón, España» → «Jaca» + el resto. */
function split(displayName: string): { name: string; detail: string } {
  const parts = displayName.split(',').map((p) => p.trim());
  return { name: parts[0] ?? displayName, detail: parts.slice(1, 4).join(' · ') };
}

/** Acepta «-33.45, -70.65» además de nombres de lugar. */
export function parseCoords(query: string): Waypoint | null {
  const m = query.trim().match(/^(-?\d+(?:\.\d+)?)\s*[, ]\s*(-?\d+(?:\.\d+)?)$/);
  if (!m) return null;
  const lat = Number(m[1]);
  const lon = Number(m[2]);
  if (Math.abs(lat) > 90 || Math.abs(lon) > 180) return null;
  return { name: `${lat.toFixed(4)}, ${lon.toFixed(4)}`, lat, lon };
}

export async function searchPlaces(
  query: string,
  signal?: AbortSignal,
): Promise<Suggestion[]> {
  const coords = parseCoords(query);
  if (coords) return [{ ...coords, detail: 'Coordenadas' }];

  const url = `${NOMINATIM}/search?format=jsonv2&limit=6&accept-language=es&q=${encodeURIComponent(query)}`;
  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error(`Nominatim ${res.status}`);
  const data: NominatimPlace[] = await res.json();
  return data.map((p) => {
    const { name, detail } = split(p.display_name);
    return { name, detail, lat: Number(p.lat), lon: Number(p.lon) };
  });
}

/** Nombre legible para un punto clicado en el mapa. Cae a las coordenadas. */
export async function reverseGeocode(lat: number, lon: number): Promise<string> {
  const fallback = `${lat.toFixed(4)}, ${lon.toFixed(4)}`;
  try {
    const url = `${NOMINATIM}/reverse?format=jsonv2&zoom=14&accept-language=es&lat=${lat}&lon=${lon}`;
    const res = await fetch(url);
    if (!res.ok) return fallback;
    const data: NominatimPlace = await res.json();
    return data.display_name ? split(data.display_name).name : fallback;
  } catch {
    return fallback;
  }
}
