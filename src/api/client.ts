/** Cliente del backend NestJS (generador-rutas_2). */
import type {
  Bbox,
  CalculateRouteBody,
  ImportResult,
  RouteResult,
} from '../lib/types';

export const API_URL: string =
  import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

/**
 * Error de la API. `status` 0 = sin respuesta (red caída o backend apagado).
 * `messages` trae el `message` de Nest: un string, o un array en los errores
 * de validación.
 */
export class ApiError extends Error {
  readonly status: number;
  readonly messages: string[];

  constructor(status: number, messages: string[]) {
    super(messages.join(', ') || (status ? `HTTP ${status}` : 'Sin respuesta del servidor'));
    this.name = 'ApiError';
    this.status = status;
    this.messages = messages;
  }
}

async function unwrap<T>(res: Response): Promise<T> {
  if (res.ok) return res.json() as Promise<T>;
  const body = await res.json().catch(() => ({}) as { message?: unknown });
  const raw = (body as { message?: unknown }).message;
  const messages = Array.isArray(raw) ? raw.map(String) : typeof raw === 'string' ? [raw] : [];
  throw new ApiError(res.status, messages);
}

async function post<T>(path: string, body: unknown, signal?: AbortSignal): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal,
    });
  } catch (e) {
    // Cancelación: la decide quien llama. Lo demás es red (Chrome dice
    // "Failed to fetch"; Firefox, "NetworkError when attempting to fetch resource.").
    if (signal?.aborted) throw e;
    throw new ApiError(0, []);
  }
  return unwrap<T>(res);
}

/** Ruta directa: decenas de ms. Con `targetLengthKm`: hasta ~7 s, más la cola del backend. */
export function calculateRoute(
  body: CalculateRouteBody,
  signal?: AbortSignal,
): Promise<RouteResult> {
  return post<RouteResult>('/routes/calculate', body, signal);
}

/**
 * Descarga las calles de un bbox de OSM y recompila el grafo. Lento: de medio
 * minuto a minuto y medio, y varios minutos si Overpass falla.
 */
export function importBbox(bbox: Bbox, signal?: AbortSignal): Promise<ImportResult> {
  return post<ImportResult>('/import', bbox, signal);
}
