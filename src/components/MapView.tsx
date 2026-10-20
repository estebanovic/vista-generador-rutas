/** Mapa Leaflet con teselas en sepia, trazado de la ruta y controles propios. */
import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import { isLoop } from '../lib/planner';
import type { RouteView, Waypoint } from '../lib/types';
import { token } from '../lib/theme';
import { IconLocate, IconMinus, IconPlus } from './icons';
import { FONT, SIZE, text } from './styles';

export type MapLayer = 'map' | 'topo' | 'satellite';

const TILE_LAYERS: Record<MapLayer, { url: string; attribution: string; maxZoom: number }> = {
  map: {
    url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '© OpenStreetMap',
    maxZoom: 19,
  },
  topo: {
    url: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',
    attribution: '© OpenStreetMap · SRTM · © OpenTopoMap',
    maxZoom: 17,
  },
  satellite: {
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: '© Esri · Earthstar Geographics',
    maxZoom: 19,
  },
};

/** Ajustes al mapa menores que esto no se dibujan: la línea no se vería. */
const SNAP_LINE_MIN_M = 20;

/**
 * Encuadra unos límites dejando libres el buscador (arriba a la izquierda) y el
 * panel de resultados (abajo), que flotan sobre el mapa.
 */
function fitVisible(m: L.Map, bounds: L.LatLngBounds) {
  const panel = document.querySelector('[data-results-panel]')?.getBoundingClientRect().height ?? 0;
  const bottom = Math.min(panel + 40, m.getSize().y * 0.6);
  m.fitBounds(bounds, { paddingTopLeft: [60, 110], paddingBottomRight: [80, Math.max(bottom, 60)] });
}

const TIP: L.TooltipOptions = { direction: 'top', offset: [0, -30], opacity: 1, className: 'meridiano-tip' };

/** Rombo del punto de giro de la ida y vuelta. */
function turnIcon() {
  return L.divIcon({
    className: '',
    iconSize: [20, 20],
    iconAnchor: [10, 10],
    html: `<div style="width:12px;height:12px;margin:4px;transform:rotate(45deg);
             background:${token('--amber')};border:1.5px solid ${token('--ink')};
             box-shadow:0 0 0 3px ${token('--paper')}"></div>`,
  });
}

/** Chincheta de papel con la letra del extremo. */
function pinIcon(color: string, label: string) {
  return L.divIcon({
    className: '',
    iconSize: [28, 36],
    iconAnchor: [14, 32],
    html: `
      <svg width="28" height="36" viewBox="0 0 28 36">
        <path d="M14 2C7.4 2 3 6.7 3 12c0 7 11 22 11 22s11-15 11-22C25 6.7 20.6 2 14 2z"
              fill="${color}" stroke="${token('--ink')}" stroke-width="1.2"/>
        <circle cx="14" cy="12" r="4.5" fill="${token('--paper')}"/>
        <text x="14" y="15.5" text-anchor="middle"
              font-family="${FONT.serif}" font-size="${SIZE.xs}" font-weight="600"
              fill="${color}">${label}</text>
      </svg>`,
  });
}

export interface MapViewProps {
  route: RouteView | null;
  origin: Waypoint;
  destination: Waypoint;
  /** En el circuito no hay destino: un solo marcador. */
  showDestination: boolean;
  layer: MapLayer;
  onMapClick: (lat: number, lon: number) => void;
  onMarkerDrag: (target: 'origin' | 'destination', lat: number, lon: number) => void;
  flyTo: { lat: number; lon: number; nonce: number } | null;
}

export function MapView({
  route,
  origin,
  destination,
  showDestination,
  layer,
  onMapClick,
  onMarkerDrag,
  flyTo,
}: MapViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const tileRef = useRef<L.TileLayer | null>(null);
  const routeRef = useRef<L.LayerGroup | null>(null);
  const endpointsRef = useRef<L.LayerGroup | null>(null);
  // El handler de click se guarda en un ref: el listener de Leaflet se registra
  // una sola vez y no debe capturar una versión vieja del callback.
  const clickRef = useRef(onMapClick);
  const dragRef = useRef(onMarkerDrag);
  useEffect(() => {
    clickRef.current = onMapClick;
    dragRef.current = onMarkerDrag;
  }, [onMapClick, onMarkerDrag]);

  const [scale, setScale] = useState({ label: '—', width: 60 });

  // ── init ──
  useEffect(() => {
    if (mapRef.current || !containerRef.current) return;
    const m = L.map(containerRef.current, {
      zoomControl: false,
      attributionControl: true,
      // Renderizador SVG (el de por defecto): el trazo animado de la ruta
      // depende de una clase CSS sobre el path, que el canvas no expone.
    }).setView([origin.lat, origin.lon], 12);

    m.on('click', (e: L.LeafletMouseEvent) => clickRef.current(e.latlng.lat, e.latlng.lng));

    const updateScale = () => {
      // Metros que cubren 80 px en el centro del mapa, redondeados a 1/2/5·10ⁿ.
      const c = m.getCenter();
      const p = m.containerPointToLatLng(m.latLngToContainerPoint(c).add([80, 0]));
      const meters = c.distanceTo(p);
      const pow = 10 ** Math.floor(Math.log10(meters));
      const nice = [1, 2, 5, 10].find((n) => n * pow >= meters * 0.5)! * pow;
      setScale({
        label: nice >= 1000 ? `${nice / 1000} KM` : `${nice} M`,
        width: Math.round((nice / meters) * 80),
      });
    };
    m.on('move zoom', updateScale);
    updateScale();

    mapRef.current = m;
    // Sólo al montar: el mapa es imperativo y sobrevive a los re-render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── capa de teselas ──
  useEffect(() => {
    const m = mapRef.current;
    if (!m) return;
    tileRef.current?.remove();
    const cfg = TILE_LAYERS[layer];
    tileRef.current = L.tileLayer(cfg.url, {
      attribution: cfg.attribution,
      maxZoom: cfg.maxZoom,
    }).addTo(m);
  }, [layer]);

  // ── extremos (origen / destino) ──
  useEffect(() => {
    const m = mapRef.current;
    if (!m) return;
    endpointsRef.current?.remove();
    const pin = (target: 'origin' | 'destination', w: Waypoint, color: string, label: string, tip: string) => {
      const mk = L.marker([w.lat, w.lon], { icon: pinIcon(color, label), draggable: true });
      mk.bindTooltip(tip, TIP);
      mk.on('dragend', () => {
        const p = mk.getLatLng();
        dragRef.current(target, p.lat, p.lng);
      });
      return mk;
    };
    endpointsRef.current = L.layerGroup(
      showDestination
        ? [
            pin('origin', origin, token('--accent'), 'A', 'Partida · arrástrala para moverla'),
            pin('destination', destination, token('--terra'), 'B', 'Destino · arrástralo para moverlo'),
          ]
        : [pin('origin', origin, token('--accent'), 'A', 'Partida y llegada · arrástrala para moverla')],
    ).addTo(m);
  }, [origin, destination, showDestination]);

  // ── trazado ──
  useEffect(() => {
    const m = mapRef.current;
    if (!m) return;
    routeRef.current?.remove();
    routeRef.current = null;
    if (!route || route.pts.length < 2) return;

    const { pts, access } = route;
    const line = (latlngs: [number, number][], color = token('--accent')) =>
      L.polyline(latlngs, { color, weight: 3.5, lineCap: 'round', lineJoin: 'round' });

    const layers: L.Layer[] = [
      L.polyline(pts, {
        color: token('--paper'),
        weight: 8,
        opacity: 0.85,
        lineCap: 'round',
        lineJoin: 'round',
      }),
    ];
    // El acceso del circuito se recorre de ida y de vuelta: va en dorado.
    if (access) {
      layers.push(
        line(pts.slice(access.outEnd, access.backStart + 1)),
        line(pts.slice(0, access.outEnd + 1), token('--amber')),
        line(pts.slice(access.backStart), token('--amber')),
      );
    } else {
      layers.push(line(pts));
    }
    layers.push(
      L.polyline(pts, {
        color: token('--amber'),
        weight: 1.5,
        opacity: 0.95,
        dashArray: '1, 8',
        lineCap: 'round',
        className: 'route-flow',
      }),
    );

    // Del punto pedido al punto de la vía donde empieza o termina la ruta.
    const snapLine = (from: { lat: number; lon: number }, to: { lat: number; lon: number; distanceMeters: number }) => {
      if (!(to.distanceMeters >= SNAP_LINE_MIN_M) || !Number.isFinite(to.lat)) return;
      layers.push(
        L.polyline(
          [
            [from.lat, from.lon],
            [to.lat, to.lon],
          ],
          { color: token('--ink'), weight: 2, dashArray: '3 5', interactive: false },
        ),
      );
    };
    snapLine(route.request.origin, route.snap.origin);
    if (!isLoop(route.kind) && route.request.destination) {
      snapLine(route.request.destination, route.snap.destination);
    }

    const turn = route.targetLength?.turnaround;
    if (route.kind === 'ida-y-vuelta' && turn) {
      layers.push(
        L.marker([turn.lat, turn.lon], { icon: turnIcon(), keyboard: false }).bindTooltip(
          'Punto de giro: aquí la ruta da la vuelta',
          { ...TIP, offset: [0, -10] },
        ),
      );
    }

    routeRef.current = L.layerGroup(layers).addTo(m);
    fitVisible(m, L.polyline(pts).getBounds());
  }, [route]);

  // ── vuelo desde el buscador ──
  useEffect(() => {
    if (!flyTo || !mapRef.current) return;
    mapRef.current.flyTo([flyTo.lat, flyTo.lon], Math.max(mapRef.current.getZoom(), 12), {
      duration: 0.8,
    });
  }, [flyTo]);

  const btn: React.CSSProperties = {
    width: 36,
    height: 36,
    border: 'none',
    background: 'transparent',
    color: 'var(--ink-soft)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  };

  return (
    <div style={{ position: 'absolute', inset: 0, background: 'var(--paper-3)' }}>
      <div ref={containerRef} style={{ position: 'absolute', inset: 0 }} />

      {/* Viñeta: oscurece los bordes del mapa contra el papel. */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          pointerEvents: 'none',
          boxShadow: 'inset 0 0 110px 24px rgba(11, 7, 22, 0.6)',
        }}
      />

      {/* zoom */}
      <div
        style={{
          position: 'absolute',
          top: 18,
          right: 18,
          display: 'flex',
          flexDirection: 'column',
          background: 'var(--paper)',
          border: '1px solid var(--rule)',
          boxShadow: 'var(--shadow-sm)',
          borderRadius: 2,
          overflow: 'hidden',
          zIndex: 900,
        }}
      >
        <button
          type="button"
          style={btn}
          title="Acercar"
          aria-label="Acercar"
          onClick={() => mapRef.current?.zoomIn()}
        >
          <IconPlus size={14} />
        </button>
        <button
          type="button"
          style={{ ...btn, borderTop: '1px solid var(--rule-soft)' }}
          title="Alejar"
          aria-label="Alejar"
          onClick={() => mapRef.current?.zoomOut()}
        >
          <IconMinus size={14} />
        </button>
        <button
          type="button"
          style={{ ...btn, borderTop: '1px solid var(--rule-soft)' }}
          title="Encuadrar la ruta"
          aria-label="Encuadrar la ruta"
          onClick={() => {
            if (route && route.pts.length > 1) {
              if (mapRef.current) fitVisible(mapRef.current, L.polyline(route.pts).getBounds());
            } else {
              mapRef.current?.setView([origin.lat, origin.lon], 13);
            }
          }}
        >
          <IconLocate size={14} />
        </button>
      </div>

      {/* escala */}
      <div
        style={{
          position: 'absolute',
          bottom: 26,
          right: 18,
          background: 'var(--paper)',
          border: '1px solid var(--rule)',
          padding: '6px 10px',
          ...text.data,
          color: 'var(--ink-soft)',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          boxShadow: 'var(--shadow-sm)',
          zIndex: 900,
        }}
      >
        <div
          style={{
            width: scale.width,
            height: 6,
            position: 'relative',
            borderLeft: '1px solid var(--ink)',
            borderRight: '1px solid var(--ink)',
            borderBottom: '1px solid var(--ink)',
          }}
        >
          <div
            style={{
              position: 'absolute',
              left: '50%',
              top: 0,
              bottom: 0,
              width: 1,
              background: 'var(--ink)',
            }}
          />
        </div>
        <span>{scale.label}</span>
      </div>
    </div>
  );
}
