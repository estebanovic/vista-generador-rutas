/**
 * Raíz del planificador: estado de los controles, la ruta calculada y la
 * orquestación de las llamadas al backend (`POST /routes/calculate`, `POST /import`).
 */
import { useCallback, useRef, useState } from 'react';
import { calculateRoute, importBbox } from './api/client';
import { reverseGeocode } from './api/geocode';
import { MapView, type MapLayer } from './components/MapView';
import { ResultsPanel } from './components/ResultsPanel';
import { Sidebar, type ImportState } from './components/Sidebar';
import {
  EmptyHint,
  LayerSwitch,
  LoadingOverlay,
  SearchBox,
  type ComputeJob,
} from './components/overlays';
import { downloadGpx } from './lib/gpx';
import { describeImportError, describeRouteError } from './lib/messages';
import {
  buildRouteView,
  parseKm,
  pointsProblem,
  PROFILE_WEIGHTS,
  targetLengthError,
  toRequestBody,
  traceLabel,
} from './lib/planner';
import type { Bbox, PlannerState, RouteView, Waypoint } from './lib/types';

const DEFAULT_STATE: PlannerState = {
  origin: { name: 'Santiago Centro', lat: -33.4372, lon: -70.6506 },
  destination: { name: 'Providencia', lat: -33.4256, lon: -70.6109 },
  profile: 'moto-curvas',
  custom: false,
  weights: { ...PROFILE_WEIGHTS['moto-curvas'] },
  mode: 'directa',
  targetLengthKm: '60',
  maxDetourRatio: null,
};

/**
 * Tiempo máximo de espera de un cálculo. La búsqueda con largo objetivo tarda
 * hasta ~7 s, pero con varias consultas a la vez el backend las encola.
 */
const CLIENT_TIMEOUT_MS = 45_000;

type PointTarget = 'origin' | 'destination';

const sameRequest = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

export default function App() {
  const [state, setState] = useState<PlannerState>(DEFAULT_STATE);
  const [route, setRoute] = useState<RouteView | null>(null);
  const [job, setJob] = useState<ComputeJob | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [layer, setLayer] = useState<MapLayer>('map');
  const [flyTo, setFlyTo] = useState<{ lat: number; lon: number; nonce: number } | null>(null);

  const [importState, setImportState] = useState<ImportState | null>(null);
  const [importedBbox, setImportedBbox] = useState<Bbox | null>(null);
  const [hasGraph, setHasGraph] = useState(true);

  const getBoundsRef = useRef<(() => Bbox) | null>(null);
  /** Cálculo en curso; se aborta al cancelar o al vencer el plazo. */
  const abortRef = useRef<AbortController | null>(null);
  /** Alterna partida → destino en los clics sobre el mapa (en el circuito, siempre partida). */
  const [nextClick, setNextClick] = useState<PointTarget>('origin');

  const problem =
    (state.mode !== 'directa' && targetLengthError(state.targetLengthKm)) || pointsProblem(state);
  /** La ruta mostrada se pidió con otros parámetros: se conserva, pero se avisa. */
  const stale = route != null && (problem != null || !sameRequest(route.request, toRequestBody(state)));

  /** Fija un punto desde el mapa (clic o arrastre) y le busca un nombre. */
  const setPoint = useCallback(async (target: PointTarget, lat: number, lon: number) => {
    const provisional: Waypoint = { name: `${lat.toFixed(4)}, ${lon.toFixed(4)}`, lat, lon };
    setState((s) => ({ ...s, [target]: provisional }));

    const name = await reverseGeocode(lat, lon);
    const named = (w: Waypoint) => (w.lat === lat && w.lon === lon ? { name, lat, lon } : w);
    // Si el usuario ya movió el punto otra vez, no pisamos lo nuevo.
    setState((s) => ({ ...s, [target]: named(s[target]) }));
    setRoute((r) => r && { ...r, state: { ...r.state, [target]: named(r.state[target]) } });
  }, []);

  const onMapClick = (lat: number, lon: number) => {
    const target = state.mode === 'circuito' ? 'origin' : nextClick;
    if (state.mode !== 'circuito') setNextClick(target === 'origin' ? 'destination' : 'origin');
    setPoint(target, lat, lon);
  };

  const onImport = async () => {
    const bounds = getBoundsRef.current?.();
    if (!bounds) return;
    setImportState({ kind: 'running', startedAt: Date.now() });
    try {
      const res = await importBbox(bounds);
      setImportState({
        kind: 'done',
        text: `Zona importada: ${res.ways.toLocaleString('es')} vías. Ya puedes trazar en ella.`,
      });
      setImportedBbox(bounds);
      setHasGraph(true);
    } catch (e) {
      setImportState({ kind: 'error', text: describeImportError(e) });
    }
  };

  /** Calcula con los parámetros actuales. No se dispara solo: siempre lo pide el usuario. */
  const compute = async () => {
    if (problem) {
      setError(problem);
      return;
    }
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      ctrl.abort();
    }, CLIENT_TIMEOUT_MS);

    const snapshot = state;
    const body = toRequestBody(snapshot);
    setJob({ mode: snapshot.mode, km: parseKm(snapshot.targetLengthKm), startedAt: Date.now() });
    setError(null);
    try {
      const result = await calculateRoute(body, ctrl.signal);
      if (abortRef.current !== ctrl) return;
      setRoute(buildRouteView(result, snapshot));
      setHasGraph(true);
    } catch (e) {
      // Cancelado por el usuario (o reemplazado por otro cálculo): sin mensaje.
      if (abortRef.current !== ctrl || (ctrl.signal.aborted && !timedOut)) return;
      const { message, noGraph } = describeRouteError(e, {
        origin: body.origin,
        destination: body.destination,
        timedOut,
      });
      if (noGraph) setHasGraph(false);
      setError(message);
    } finally {
      clearTimeout(timer);
      if (abortRef.current === ctrl) {
        abortRef.current = null;
        setJob(null);
      }
    }
  };

  /** Deja de esperar la respuesta; el backend termina el cálculo igual. */
  const cancel = () => {
    abortRef.current?.abort();
    abortRef.current = null;
    setJob(null);
  };

  return (
    <div style={{ position: 'fixed', inset: 0, display: 'flex', background: 'var(--paper)' }}>
      <Sidebar
        state={state}
        set={setState}
        busy={job != null}
        hasRoute={route != null}
        problem={problem}
        error={error}
        onTrace={compute}
        nextClick={nextClick}
        importState={importState}
        onImport={onImport}
      />

      <main style={{ flex: 1, position: 'relative', minWidth: 0 }}>
        <MapView
          route={route}
          origin={state.origin}
          destination={state.destination}
          showDestination={state.mode !== 'circuito'}
          layer={layer}
          importedBbox={importedBbox}
          onMapClick={onMapClick}
          onMarkerDrag={setPoint}
          onBoundsRef={(fn) => {
            getBoundsRef.current = fn;
          }}
          flyTo={flyTo}
        />

        <SearchBox onPick={(lat, lon) => setFlyTo({ lat, lon, nonce: Date.now() })} />
        <LayerSwitch value={layer} onChange={setLayer} />

        {job && <LoadingOverlay job={job} onCancel={cancel} />}

        {route && (
          <ResultsPanel route={route} stale={stale} onExportGpx={() => downloadGpx(route)} />
        )}

        {!route && !job && <EmptyHint hasGraph={hasGraph} action={traceLabel(state.mode)} />}
      </main>

      {/* Grano de película sobre toda la app. */}
      <div className="grain-overlay" />
    </div>
  );
}
