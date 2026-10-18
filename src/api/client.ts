/** Cliente del backend NestJS (generador-rutas_2). */
import type {
  Bbox,
  CalculateRouteBody,
  ImportResult,
  RouteResult,
} from '../lib/types';

export const API_URL: string =
  import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

/** Nest devuelve `message` como string o array de strings de validación. */
async function unwrap<T>(res: Response): Promise<T> {
  if (res.ok) return res.json() as Promise<T>;
  const body = await res.json().catch(() => ({}) as { message?: unknown });
  const raw = (body as { message?: unknown }).message;
  const msg = Array.isArray(raw) ? raw.join(', ') : (raw as string | undefined);
  throw new Error(msg || `HTTP ${res.status} ${res.statusText}`);
}

function post<T>(path: string, body: unknown, signal?: AbortSignal): Promise<T> {
  return fetch(`${API_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal,
  }).then((r) => unwrap<T>(r));
}

export function calculateRoute(
  body: CalculateRouteBody,
  signal?: AbortSignal,
): Promise<RouteResult> {
  return post<RouteResult>('/routes/calculate', body, signal);
}

/** Descarga las calles de un bbox de OSM y las guarda en el grafo. Lento (10-60 s). */
export function importBbox(bbox: Bbox, signal?: AbortSignal): Promise<ImportResult> {
  return post<ImportResult>('/import', bbox, signal);
}
