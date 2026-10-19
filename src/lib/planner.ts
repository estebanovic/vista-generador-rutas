/**
 * Perfiles del backend replicados en el cliente, controles → pesos del costo,
 * cuerpo de la petición y el paso de la respuesta del backend a la vista.
 */
import type {
  CalculateRouteBody,
  Mode,
  PlannerState,
  ProfileName,
  RouteKind,
  RouteResult,
  RouteView,
  RouteWeights,
} from './types';

// ── Perfiles base ────────────────────────────────────────────

/**
 * Espejo de `PROFILES` en el backend (`src/routes/profiles.ts`). Al elegir un
 * perfil se cargan estos pesos; tocar un control específico lo desactiva y la
 * petición pasa a enviarse como `custom`.
 */
export const PROFILE_WEIGHTS: Record<ProfileName, RouteWeights> = {
  'moto-curvas': { curvinessWeight: 3, surfaceWeight: 0 },
  '4x4': { curvinessWeight: 0, surfaceWeight: -6 },
  scenic: { curvinessWeight: 4, surfaceWeight: 2 },
};

/** Espejo de `PROFILE_DETOUR_BUDGET` en el backend: desvío máximo por defecto. */
const PROFILE_DETOUR: Record<ProfileName | 'custom', number> = {
  'moto-curvas': 1.5,
  '4x4': 2.0,
  scenic: 1.5,
  custom: 1.5,
};

/** Peso máximo de cada criterio en el backend (`W_MAX`). */
export const W_MAX = 6;

/** Rango de `maxDetourRatio` en el backend. */
export const DETOUR_MIN = 1;
export const DETOUR_MAX = 3;

/** Rango de `targetLengthKm` y tolerancia fija de la banda en el backend. */
export const TARGET_KM_MIN = 2;
export const TARGET_KM_MAX = 300;
export const TARGET_TOLERANCE = 0.15;

export const PROFILE_LABELS: Record<ProfileName, string> = {
  'moto-curvas': 'Moto · curvas',
  '4x4': '4×4',
  scenic: 'Escénico',
};

export const MODE_LABELS: Record<Mode, string> = {
  directa: 'Ruta directa',
  circuito: 'Circuito',
  'destino-largo': 'Ruta con largo objetivo',
};

export const KIND_LABELS: Record<RouteKind, string> = {
  directa: 'Ruta directa',
  circuito: 'Circuito',
  'ida-y-vuelta': 'Ida y vuelta',
  ruta: 'Ruta con largo objetivo',
};

/** Texto del botón de cálculo antes del primer resultado. */
export const traceLabel = (mode: Mode) => (mode === 'circuito' ? 'Buscar circuito' : 'Trazar la ruta');

/** Desvío máximo que aplicará el backend si no se envía `maxDetourRatio`. */
export function defaultDetour(state: Pick<PlannerState, 'custom' | 'profile'>): number {
  return PROFILE_DETOUR[state.custom ? 'custom' : state.profile];
}

export function effectiveDetour(state: PlannerState): number {
  return state.maxDetourRatio ?? defaultDetour(state);
}

// ── Etiquetas de los controles ───────────────────────────────

/** Cuánto pesa la búsqueda de curvas (0..W_MAX), en palabras. */
export function curvesLabel(weight: number): string {
  if (weight <= 0) return 'Indiferente';
  if (weight <= 2) return 'Poco';
  if (weight <= 4) return 'Bastante';
  return 'Mucho';
}

/** Preferencia de superficie (-W_MAX..W_MAX), en palabras. */
export function surfaceLabel(weight: number): string {
  if (weight === 0) return 'Indiferente';
  const strength = Math.abs(weight) > 3 ? 'Prioriza' : 'Prefiere';
  return weight > 0 ? `${strength} pavimento` : `${strength} ripio y tierra`;
}

export function surfaceNote(weight: number): string {
  if (weight === 0) return 'Sin preferencia de superficie: decide el resto del perfil.';
  return weight > 0
    ? 'Evita los tramos de ripio, tierra o arena.'
    : 'Busca ripio, tierra o arena y evita el pavimento.';
}

// ── Validación ───────────────────────────────────────────────

/** Acepta coma o punto decimal. `null` si no es un número. */
export function parseKm(text: string): number | null {
  const t = text.trim().replace(',', '.');
  if (!/^\d+(\.\d+)?$/.test(t)) return null;
  return Number(t);
}

/** Mensaje del campo de largo objetivo, o `null` si es válido. */
export function targetLengthError(text: string): string | null {
  const km = parseKm(text);
  if (km == null) return `Escribe un largo en kilómetros, entre ${TARGET_KM_MIN} y ${TARGET_KM_MAX}.`;
  if (km < TARGET_KM_MIN || km > TARGET_KM_MAX) {
    return `El largo debe estar entre ${TARGET_KM_MIN} y ${TARGET_KM_MAX} km.`;
  }
  return null;
}

// ── Geometría ────────────────────────────────────────────────

const R_KM = 6371;
const toRad = (d: number) => (d * Math.PI) / 180;

export function haversineKm(a: [number, number], b: [number, number]): number {
  const dLat = toRad(b[0] - a[0]);
  const dLon = toRad(b[1] - a[1]);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a[0])) * Math.cos(toRad(b[0])) * Math.sin(dLon / 2) ** 2;
  return 2 * R_KM * Math.asin(Math.sqrt(h));
}

/**
 * Índices donde termina la ida del acceso y empieza su vuelta, recorriendo
 * `oneWayMeters` desde cada extremo de la ruta.
 */
function accessSplit(
  pts: [number, number][],
  oneWayMeters: number,
): { outEnd: number; backStart: number } | null {
  if (pts.length < 3 || oneWayMeters <= 0) return null;
  const km = oneWayMeters / 1000;
  let outEnd = 0;
  for (let acc = 0; outEnd < pts.length - 1 && acc < km; outEnd++) {
    acc += haversineKm(pts[outEnd], pts[outEnd + 1]);
  }
  let backStart = pts.length - 1;
  for (let acc = 0; backStart > 0 && acc < km; backStart--) {
    acc += haversineKm(pts[backStart], pts[backStart - 1]);
  }
  return outEnd < backStart ? { outEnd, backStart } : null;
}

// ── Petición ─────────────────────────────────────────────────

/**
 * Cuerpo de `POST /routes/calculate`. En el circuito se omite `destination`
 * (con `null` el backend responde 400); las modalidades con longitud llevan
 * `targetLengthKm` y la directa, `maxDetourRatio` solo si se eligió uno.
 * Supone el estado ya validado.
 */
export function toRequestBody(state: PlannerState): CalculateRouteBody {
  const origin = { lat: state.origin.lat, lon: state.origin.lon };
  const body: CalculateRouteBody = state.custom
    ? { origin, profile: 'custom', customWeights: { ...state.weights } }
    : { origin, profile: state.profile };
  if (state.mode !== 'circuito') {
    body.destination = { lat: state.destination.lat, lon: state.destination.lon };
  }
  if (state.mode === 'directa') {
    if (state.maxDetourRatio != null) body.maxDetourRatio = state.maxDetourRatio;
  } else {
    body.targetLengthKm = parseKm(state.targetLengthKm) ?? NaN;
  }
  return body;
}

// ── RouteResult (backend) → RouteView (UI) ───────────────────

export function buildRouteView(result: RouteResult, state: PlannerState): RouteView {
  const tl = result.targetLength;
  const kind: RouteKind = tl?.modalidad ?? 'directa';
  return {
    kind,
    state,
    request: toRequestBody(state),
    pts: result.coordinates,
    access:
      kind === 'circuito' && tl && tl.accessRepeatedMeters > 0
        ? accessSplit(result.coordinates, tl.accessRepeatedMeters / 2)
        : null,
    stats: result.stats,
    snap: result.snap,
    detour: result.detour,
    targetLength: tl,
  };
}

/** Circuito e ida y vuelta empiezan y terminan en el origen. */
export const isLoop = (kind: RouteKind) => kind === 'circuito' || kind === 'ida-y-vuelta';

export function routeTitle(route: RouteView): string {
  const { origin, destination } = route.state;
  if (route.kind === 'circuito') return `Circuito desde ${origin.name}`;
  if (route.kind === 'ida-y-vuelta') return `Ida y vuelta desde ${origin.name}`;
  return `${origin.name} — ${destination.name}`;
}

// ── Repartos ─────────────────────────────────────────────────

/** Fracción (0..1) de cada clave sobre el total, de mayor a menor. */
export function shares(breakdown: Record<string, number>): [string, number][] {
  const total = Object.values(breakdown).reduce((a, b) => a + b, 0);
  if (total <= 0) return [];
  return Object.entries(breakdown)
    .map(([k, m]) => [k, m / total] as [string, number])
    .sort((a, b) => b[1] - a[1]);
}

const UNPAVED = new Set(['gravel', 'dirt', 'sand']);

/** Fracción sin pavimentar (ripio, tierra y arena) y sin dato de superficie. */
export function surfaceSummary(breakdown: Record<string, number>) {
  let unpaved = 0;
  let unknown = 0;
  for (const [k, f] of shares(breakdown)) {
    if (UNPAVED.has(k)) unpaved += f;
    else if (k === 'unknown') unknown += f;
  }
  return { unpaved, unknown };
}

/** Procedencias en las que el backend dedujo la superficie (OSM no la declara). */
const INFERRED_SOURCES = new Set(['vecindad', 'tipo']);

export function inferredSurfaceShare(sources: Record<string, number>): number {
  return shares(sources)
    .filter(([k]) => INFERRED_SOURCES.has(k))
    .reduce((a, [, f]) => a + f, 0);
}

// ── Formato ──────────────────────────────────────────────────

export function fmtNum(x: number, digits = 1): string {
  return x.toLocaleString('es', { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

export const fmtKm = (meters: number, digits = 1) => `${fmtNum(meters / 1000, digits)} km`;

/** Porcentaje entero; "<1 %" para valores positivos que redondearían a 0. */
export function fmtPct(fraction: number): string {
  const pct = fraction * 100;
  if (pct > 0 && pct < 1) return '<1 %';
  return `${Math.round(pct)} %`;
}

export const HIGHWAY_LABELS: Record<string, string> = {
  motorway: 'Autopista',
  trunk: 'Autovía',
  primary: 'Primaria',
  secondary: 'Secundaria',
  tertiary: 'Terciaria',
  unclassified: 'Sin clasificar',
  residential: 'Urbana',
  living_street: 'Calle compartida',
  track: 'Pista',
  path: 'Sendero',
  service: 'Servicio',
};

export const SURFACE_LABELS: Record<string, string> = {
  asphalt: 'Asfalto',
  concrete: 'Hormigón',
  gravel: 'Ripio',
  dirt: 'Tierra',
  sand: 'Arena',
  cobblestone: 'Adoquín',
  unknown: 'Sin dato',
};
