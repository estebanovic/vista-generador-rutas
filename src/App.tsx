/**
 * Raíz del planificador. Máquina de estados idle → computing → ready y
 * orquestación de las llamadas al backend (`POST /routes/calculate`, `POST /import`).
 */
import { useCallback, useRef, useState } from 'react';
import { calculateRoute, importBbox } from './api/client';
import { fetchElevations, sampleIndices } from './api/elevation';
import { reverseGeocode } from './api/geocode';
import { MapView, type MapLayer } from './components/MapView';
import { ResultsPanel } from './components/ResultsPanel';
import { Sidebar } from './components/Sidebar';
import { EmptyHint, LayerSwitch, LoadingOverlay, SearchBox } from './components/overlays';
import { downloadGpx } from './lib/gpx';
import { buildRouteView, PROFILE_WEIGHTS, toRequestBody } from './lib/planner';
import type { Bbox, Phase, PlannerState, RouteView, Waypoint } from './lib/types';

const DEFAULT_STATE: PlannerState = {
  origin: { name: 'Santiago Centro', lat: -33.4372, lon: -70.6506 },
  destination: { name: 'Providencia', lat: -33.4256, lon: -70.6109 },
  profile: 'moto-curvas',
  custom: false,
  weights: { ...PROFILE_WEIGHTS['moto-curvas'] },
  mode: 'directa',
  targetLengthKm: 60,
};

export default function App() {
  const [state, setState] = useState<PlannerState>(DEFAULT_STATE);
  const [phase, setPhase] = useState<Phase>('idle');
  const [route, setRoute] = useState<RouteView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [focus, setFocus] = useState<number | null>(null);
  const [loadingMsg, setLoadingMsg] = useState('Consultando cartografía');

  const [layer, setLayer] = useState<MapLayer>('map');
  const [flyTo, setFlyTo] = useState<{ lat: number; lon: number; nonce: number } | null>(null);

  const [importing, setImporting] = useState(false);
  const [importStatus, setImportStatus] = useState<string | null>(null);
  const [importedBbox, setImportedBbox] = useState<Bbox | null>(null);
  const [hasGraph, setHasGraph] = useState(true);

  const getBoundsRef = useRef<(() => Bbox) | null>(null);
  /** Alterna origen → destino en los clics sobre el mapa. */
  const nextClickRef = useRef<'origin' | 'destination'>('origin');

  /** Cualquier cambio de parámetro invalida el trazado ya dibujado. */
  const update = (next: PlannerState) => {
    setState(next);
    if (phase === 'ready') {
      setPhase('idle');
      setFocus(null);
    }
  };

  const onMapClick = useCallback(async (lat: number, lon: number) => {
    const target = nextClickRef.current;
    nextClickRef.current = target === 'origin' ? 'destination' : 'origin';

    const provisional: Waypoint = { name: `${lat.toFixed(4)}, ${lon.toFixed(4)}`, lat, lon };
    setState((s) => ({ ...s, [target]: provisional }));
    setPhase((p) => (p === 'ready' ? 'idle' : p));

    const name = await reverseGeocode(lat, lon);
    setState((s) => {
      const current = s[target];
      // Si el usuario ya movió el punto otra vez, no pisamos lo nuevo.
      if (current.lat !== lat || current.lon !== lon) return s;
      return { ...s, [target]: { name, lat, lon } };
    });
  }, []);

  const onImport = async () => {
    const bounds = getBoundsRef.current?.();
    if (!bounds) return;
    setImporting(true);
    setImportStatus('Descargando calles de OSM… (10-60 s)');
    try {
      const res = await importBbox(bounds);
      setImportStatus(`${res.nodes} nodos · ${res.edges} aristas importados.`);
      setImportedBbox(bounds);
      setHasGraph(true);
    } catch (e) {
      setImportStatus(`Error: ${(e as Error).message}`);
    } finally {
      setImporting(false);
    }
  };

  const compute = async () => {
    setPhase('computing');
    setError(null);
    setFocus(null);
    setLoadingMsg('Consultando cartografía');

    try {
      const result = await calculateRoute(toRequestBody(state));

      setLoadingMsg('Levantando el perfil de cotas');
      const idxs = sampleIndices(result.coordinates.length);
      const eles = await fetchElevations(idxs.map((i) => result.coordinates[i]));
      const samples = eles ? idxs.map((idx, k) => ({ idx, ele: eles[k] })) : null;

      setRoute(buildRouteView(result, state, samples));
      setHasGraph(true);
      setPhase('ready');
    } catch (e) {
      const msg = (e as Error).message;
      if (/grafo está vacío|No hay vías importadas/i.test(msg)) setHasGraph(false);
      setError(
        msg === 'Failed to fetch'
          ? 'No hay respuesta del trazador. ¿Está corriendo el backend en el puerto configurado?'
          : msg,
      );
      setRoute(null);
      setPhase('idle');
    }
  };

  const exportGpx = () => {
    if (route) downloadGpx(route, `${route.origin.name} - ${route.destination.name}`);
  };

  const showRoute = phase === 'ready' ? route : null;

  return (
    <div style={{ position: 'fixed', inset: 0, display: 'flex', background: 'var(--paper)' }}>
      <Sidebar
        state={state}
        set={update}
        phase={phase}
        error={error}
        onTrace={compute}
        importing={importing}
        importStatus={importStatus}
        onImport={onImport}
      />

      <main style={{ flex: 1, position: 'relative', minWidth: 0 }}>
        <MapView
          route={showRoute}
          origin={state.origin}
          destination={state.destination}
          focusIdx={focus != null ? (showRoute?.profile[focus]?.idx ?? null) : null}
          layer={layer}
          importedBbox={importedBbox}
          onMapClick={onMapClick}
          onBoundsRef={(fn) => {
            getBoundsRef.current = fn;
          }}
          flyTo={flyTo}
        />

        <SearchBox onPick={(lat, lon) => setFlyTo({ lat, lon, nonce: Date.now() })} />
        <LayerSwitch value={layer} onChange={setLayer} />

        {phase === 'computing' && <LoadingOverlay message={loadingMsg} />}

        {showRoute && (
          <ResultsPanel
            route={showRoute}
            state={state}
            focus={focus}
            setFocus={setFocus}
            onExportGpx={exportGpx}
          />
        )}

        {phase === 'idle' && <EmptyHint hasGraph={hasGraph} />}
      </main>

      {/* Grano de película sobre toda la app. */}
      <div className="grain-overlay" />
    </div>
  );
}
