/**
 * Perfiles del backend replicados en el cliente, controles → pesos del Dijkstra,
 * y las métricas derivadas (tiempo, consumo) que el backend no calcula.
 */
import type {
  CalculateRouteBody,
  Highlight,
  PlannerState,
  ProfileName,
  ProfilePoint,
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

// ── Estimaciones que el backend no devuelve ──────────────────

/** Velocidad base (km/h) por perfil, antes de descontar sinuosidad. */
const BASE_SPEED: Record<ProfileName, number> = {
  'moto-curvas': 70,
  '4x4': 62,
  scenic: 78,
};
/** Litros por km. */
const FUEL_PER_KM: Record<ProfileName, number> = {
  'moto-curvas': 0.045,
  '4x4': 0.092,
  scenic: 0.068,
};
/** Kg de CO2 por km. */
const CO2_PER_KM: Record<ProfileName, number> = {
  'moto-curvas': 0.103,
  '4x4': 0.215,
  scenic: 0.158,
};

/** Cuanto más se busca la curva y menos el pavimento, más baja la media. */
export function estimateSpeed(state: PlannerState): number {
  const curvinessWeight = state.weights.curvinessWeight / W_MAX;
  const surfaceWeight = state.weights.surfaceWeight / W_MAX;
  const surfaceMul = surfaceWeight >= 0.5 ? 1.15 : surfaceWeight <= -0.4 ? 0.6 : 0.9;
  return BASE_SPEED[state.profile] * surfaceMul * (1 - curvinessWeight * 0.32);
}

export const fuelLitres = (km: number, p: ProfileName) => km * FUEL_PER_KM[p];
export const co2Kg = (km: number, p: ProfileName) => km * CO2_PER_KM[p];

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

function cumulativeKm(pts: [number, number][]): number[] {
  const cum = [0];
  for (let i = 1; i < pts.length; i++) {
    cum.push(cum[i - 1] + haversineKm(pts[i - 1], pts[i]));
  }
  return cum;
}

// ── RouteResult (backend) → RouteView (UI) ───────────────────

/**
 * Los tres altos más prominentes del perfil (máximos locales), que se marcan
 * en el mapa y en la curva de elevación.
 */
function findHighlights(profile: ProfilePoint[]): Highlight[] {
  if (profile.length < 5) return [];
  const peaks: { p: ProfilePoint; prominence: number }[] = [];
  for (let i = 1; i < profile.length - 1; i++) {
    const { ele } = profile[i];
    if (ele < profile[i - 1].ele || ele < profile[i + 1].ele) continue;
    // Prominencia aproximada: cuánto baja a cada lado antes de volver a subir.
    let left = ele;
    for (let j = i - 1; j >= 0 && profile[j].ele <= ele; j--) {
      left = Math.min(left, profile[j].ele);
    }
    let right = ele;
    for (let j = i + 1; j < profile.length && profile[j].ele <= ele; j++) {
      right = Math.min(right, profile[j].ele);
    }
    peaks.push({ p: profile[i], prominence: ele - Math.max(left, right) });
  }
  const names = ['Primer alto', 'Alto intermedio', 'Último alto'];
  return peaks
    .sort((a, b) => b.prominence - a.prominence)
    .slice(0, 3)
    .sort((a, b) => a.p.km - b.p.km)
    .map(({ p }, i, all) => ({
      name: all.length === 1 ? 'Cota máxima' : names[i],
      idx: p.idx,
      km: p.km,
      ele: Math.round(p.ele),
    }));
}

export function buildRouteView(
  result: RouteResult,
  state: PlannerState,
  elevSamples: { idx: number; ele: number }[] | null,
): RouteView {
  const pts = result.coordinates;
  const cumKm = cumulativeKm(pts);
  const totalKm = result.stats.distanceMeters / 1000;
  const avgSpeed = estimateSpeed(state);

  const profile: ProfilePoint[] = (elevSamples ?? []).map((s) => ({
    idx: s.idx,
    km: cumKm[s.idx] ?? 0,
    ele: s.ele,
  }));

  return {
    pts,
    cumKm,
    totalKm,
    ascent: null,
    descent: null,
    curviness: result.stats.curviness,
    avgSpeed,
    hours: avgSpeed > 0 ? totalKm / avgSpeed : 0,
    highwayBreakdown: result.stats.highwayBreakdown,
    surfaceBreakdown: result.stats.surfaceBreakdown,
    profile,
    highlights: findHighlights(profile),
    origin: state.origin,
    destination: state.destination,
  };
}

// ── Formato ──────────────────────────────────────────────────

/** Metros redondeados, o "sin datos" si el backend no tiene elevación. */
export function fmtMeters(m: number | null, prefix = ''): string {
  return m == null ? 'sin datos' : `${prefix}${Math.round(m)} m`;
}

export function fmtHours(h: number): string {
  const hh = Math.floor(h);
  const mm = Math.round((h - hh) * 60);
  return `${hh}h ${String(mm).padStart(2, '0')}m`;
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
