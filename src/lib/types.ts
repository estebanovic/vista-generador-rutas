/** Tipos del planificador y de la API del backend (generador-rutas_2). */

// ── Backend ──────────────────────────────────────────────────

export interface LatLon { lat: number; lon: number }

export interface RouteWeights {
  /** 0..1 — más peso = más importa la distancia. */
  distanceWeight: number;
  /** 0..1 — más peso = busca más curvas. */
  curvinessWeight: number;
  /** -1..1 firmado — >0 prefiere plano, <0 prefiere montañoso. */
  elevationWeight: number;
  /** -1..1 firmado — >0 prefiere pavimento, <0 prefiere ripio/tierra. */
  surfaceWeight: number;
}

/** Perfiles del backend (`src/routes/profiles.ts`). */
export type ProfileName = 'moto-curvas' | '4x4' | 'scenic';

export type TripLength = 'direct' | 'medium' | 'long';

export interface CalculateRouteBody {
  origin: LatLon;
  destination: LatLon;
  profile: ProfileName | 'custom';
  customWeights?: RouteWeights;
  tripLength?: TripLength;
}

export interface RouteStats {
  distanceMeters: number;
  /** `null` cuando el grafo del backend no tiene datos de elevación. */
  elevationGainMeters: number | null;
  elevationLossMeters: number | null;
  curviness: number;
  highwayBreakdown: Record<string, number>;
  surfaceBreakdown: Record<string, number>;
}

export interface RouteResult {
  path: string[];
  /** [lat, lon] — listo para Leaflet. */
  coordinates: [number, number][];
  totalCost: number;
  stats: RouteStats;
}

export interface Bbox { south: number; west: number; north: number; east: number }
export interface ImportResult { nodes: number; edges: number; ways?: number; deletedWays?: number }

// ── Planificador (estado de la UI) ───────────────────────────

export interface Waypoint {
  name: string;
  lat: number;
  lon: number;
}

export interface PlannerState {
  origin: Waypoint;
  destination: Waypoint;
  /** Perfil base resaltado; también fija velocidad y consumo estimados. */
  profile: ProfileName;
  /** true cuando se tocó un control específico: se envía `custom` + pesos. */
  custom: boolean;
  /** Fuente de verdad de los cuatro pesos del Dijkstra. */
  weights: RouteWeights;
  tripLength: TripLength;
}

/** Punto del perfil altimétrico: índice dentro de `pts`, km acumulados y cota. */
export interface ProfilePoint { idx: number; km: number; ele: number }

export interface Highlight { name: string; idx: number; km: number; ele: number }

/** Ruta ya derivada y lista para pintar. */
export interface RouteView {
  pts: [number, number][];
  /** Km acumulados por punto de `pts`. */
  cumKm: number[];
  totalKm: number;
  /** Desnivel acumulado según el trazador; `null` = sin datos de elevación. */
  ascent: number | null;
  descent: number | null;
  curviness: number;
  hours: number;
  avgSpeed: number;
  highwayBreakdown: Record<string, number>;
  surfaceBreakdown: Record<string, number>;
  /** Vacío si no se pudo consultar la elevación. */
  profile: ProfilePoint[];
  highlights: Highlight[];
  origin: Waypoint;
  destination: Waypoint;
}

export type Phase = 'idle' | 'computing' | 'ready';
