/**
 * Perfiles del backend replicados en el cliente, controles → pesos del costo y
 * el paso de la respuesta del backend a la vista.
 */
import type {
  CalculateRouteBody,
  PlannerState,
  ProfileName,
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

/** Peso máximo de cada criterio en el backend (`W_MAX`). */
export const W_MAX = 6;

export const PROFILE_LABELS: Record<ProfileName, string> = {
  'moto-curvas': 'Moto · curvas',
  '4x4': '4×4',
  scenic: 'Escénico',
};

// ── Opciones de los controles específicos ────────────────────

/** `surfaceWeight` firmado: >0 evita lo sin pavimentar, <0 evita el pavimento. */
export const SURFACE_OPTIONS = [
  { value: 4, label: 'Pavimento' },
  { value: 0, label: 'Mixto' },
  { value: -6, label: 'Rural' },
];

/** Opción más cercana a un peso, para resaltar la píldora activa. */
export function closestOption(
  options: { value: number; label: string }[],
  value: number,
): number {
  return options.reduce((best, o) =>
    Math.abs(o.value - value) < Math.abs(best.value - value) ? o : best,
  ).value;
}

/** Etiqueta del peso de curvas (0..W_MAX). */
export function twistinessLabel(weight: number): string {
  const t = weight / W_MAX;
  if (t < 0.2) return 'Recta';
  if (t < 0.45) return 'Suelta';
  if (t < 0.7) return 'Sinuosa';
  if (t < 0.88) return 'Trazada';
  return 'Caracol';
}

export const SURFACE_NOTES: Record<string, string> = {
  Pavimento: '“Asfalto y poco más — llegar cómodo y rápido.”',
  Mixto: '“Sin preferencia: el trazador elige por curvas.”',
  Rural: '“Premia ripio y tierra — exige neumático adecuado.”',
};

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

// ── RouteResult (backend) → RouteView (UI) ───────────────────

export function buildRouteView(result: RouteResult, state: PlannerState): RouteView {
  return {
    pts: result.coordinates,
    totalKm: result.stats.distanceMeters / 1000,
    curviness: result.stats.curviness,
    highwayBreakdown: result.stats.highwayBreakdown,
    surfaceBreakdown: result.stats.surfaceBreakdown,
    origin: state.origin,
    destination: state.destination,
  };
}

// ── Formato ──────────────────────────────────────────────────

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

/**
 * Cuerpo de `POST /routes/calculate`. En el circuito se omite `destination`
 * (con `null` el backend responde 400); las modalidades con longitud llevan
 * `targetLengthKm`.
 */
export function toRequestBody(state: PlannerState): CalculateRouteBody {
  const origin = { lat: state.origin.lat, lon: state.origin.lon };
  const body: CalculateRouteBody = state.custom
    ? { origin, profile: 'custom', customWeights: { ...state.weights } }
    : { origin, profile: state.profile };
  if (state.mode !== 'circuito') {
    body.destination = { lat: state.destination.lat, lon: state.destination.lon };
  }
  if (state.mode !== 'directa') body.targetLengthKm = state.targetLengthKm;
  return body;
}
