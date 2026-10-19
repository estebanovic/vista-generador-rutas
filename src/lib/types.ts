/** Tipos del planificador y de la API del backend (generador-rutas_2). */

// ── Backend ──────────────────────────────────────────────────

export interface LatLon { lat: number; lon: number }

/** Pesos del costo. Mayor peso = más se evita esa incomodidad. */
export interface RouteWeights {
  /** 0..6 — cuánto se evitan las rectas. */
  curvinessWeight: number;
  /** -6..6 firmado — >0 evita lo sin pavimentar, <0 evita el pavimento. */
  surfaceWeight: number;
}

/** Perfiles del backend (`src/routes/profiles.ts`). */
export type ProfileName = 'moto-curvas' | '4x4' | 'scenic';

export interface CalculateRouteBody {
  origin: LatLon;
  /** Se omite en el circuito (nunca `null`: el backend responde 400). */
  destination?: LatLon;
  profile: ProfileName | 'custom';
  customWeights?: RouteWeights;
  /** Solo en la ruta directa, 1..3. No se combina con `targetLengthKm`. */
  maxDetourRatio?: number;
  /** 2..300 km, banda fija de ±15%. */
  targetLengthKm?: number;
}

export interface RouteStats {
  distanceMeters: number;
  /** 0..1: min(1, °/km ÷ 300), ponderada por largo. */
  curviness: number;
  /** Densidad de giro media (°/km). */
  curvinessDegPerKm: number;
  /** Fracción de los metros con ≥ 100 °/km. */
  curvyShare: number;
  highwayBreakdown: Record<string, number>;
  surfaceBreakdown: Record<string, number>;
  /** Metros por procedencia de la superficie: declarada, tracktype, vecindad, tipo, sin dato. */
  surfaceSourceBreakdown: Record<string, number>;
}

export interface SnapInfo {
  /** Distancia del punto pedido a la vía (m). */
  distanceMeters: number;
  lat: number;
  lon: number;
}

/** Solo en la ruta directa. */
export interface DetourInfo {
  shortestDistanceMeters: number;
  detourRatio: number;
  maxDetourRatio: number;
  binding: boolean;
  lambda: number;
  gap: number;
}

export type TargetModalidad = 'circuito' | 'ida-y-vuelta' | 'ruta';

/** Solo con `targetLengthKm`. */
export interface TargetLengthInfo {
  modalidad: TargetModalidad;
  targetMeters: number;
  tolerance: number;
  achievedMeters: number;
  withinBand: boolean;
  repeatedMeters: number;
  accessRepeatedMeters: number;
  /** Solo en la ida y vuelta. */
  turnaround?: LatLon;
  message?: string;
  /** Solo en la ida y vuelta: true = no existe circuito; false = no se encontró. */
  circuitImpossible?: boolean;
  waypoints: number;
  iterations: number;
  elapsedMs: number;
}

export interface RouteResult {
  path: string[];
  /** [lat, lon] — listo para Leaflet. */
  coordinates: [number, number][];
  totalCost: number;
  stats: RouteStats;
  snap: { origin: SnapInfo; destination: SnapInfo };
  detour?: DetourInfo;
  targetLength?: TargetLengthInfo;
}

export interface Bbox { south: number; west: number; north: number; east: number }
export interface ImportResult { nodes: number; edges: number; ways: number; deletedWays: number }

// ── Planificador (estado de la UI) ───────────────────────────

export interface Waypoint {
  name: string;
  lat: number;
  lon: number;
}

/**
 * Modalidad de la petición: ruta directa A→B, circuito desde el origen (sin
 * destino) o ruta hasta el destino con una longitud objetivo.
 */
export type Mode = 'directa' | 'circuito' | 'destino-largo';

export interface PlannerState {
  origin: Waypoint;
  destination: Waypoint;
  /** Perfil base resaltado. */
  profile: ProfileName;
  /** true cuando se tocó un control específico: se envía `custom` + pesos. */
  custom: boolean;
  /** Fuente de verdad de los dos pesos del costo. */
  weights: RouteWeights;
  mode: Mode;
  /** Solo en `circuito` y `destino-largo`. */
  targetLengthKm: number;
}

/** Ruta ya derivada y lista para pintar. */
export interface RouteView {
  pts: [number, number][];
  totalKm: number;
  curviness: number;
  highwayBreakdown: Record<string, number>;
  surfaceBreakdown: Record<string, number>;
  origin: Waypoint;
  destination: Waypoint;
}

export type Phase = 'idle' | 'computing' | 'ready';
