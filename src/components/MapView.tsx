/** Mapa Leaflet con teselas en sepia, trazado de la ruta y controles propios. */
import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import type { Bbox, RouteView, Waypoint } from '../lib/types';
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
  layer: MapLayer;
  importedBbox: Bbox | null;
  onMapClick: (lat: number, lon: number) => void;
  onBoundsRef: (getBounds: () => Bbox) => void;
  flyTo: { lat: number; lon: number; nonce: number } | null;
}

export function MapView({
  route,
  origin,
  destination,
  layer,
  importedBbox,
  onMapClick,
  onBoundsRef,
  flyTo,
}: MapViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const tileRef = useRef<L.TileLayer | null>(null);
  const routeRef = useRef<L.LayerGroup | null>(null);
  const endpointsRef = useRef<L.LayerGroup | null>(null);
  const bboxRef = useRef<L.Rectangle | null>(null);
  // El handler de click se guarda en un ref: el listener de Leaflet se registra
  // una sola vez y no debe capturar una versión vieja del callback.
  const clickRef = useRef(onMapClick);
  useEffect(() => {
    clickRef.current = onMapClick;
  }, [onMapClick]);

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
    onBoundsRef(() => {
      const b = m.getBounds();
      return { south: b.getSouth(), west: b.getWest(), north: b.getNorth(), east: b.getEast() };
    });
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
    endpointsRef.current = L.layerGroup([
      L.marker([origin.lat, origin.lon], { icon: pinIcon(token('--accent'), 'A') }),
      L.marker([destination.lat, destination.lon], { icon: pinIcon(token('--terra'), 'B') }),
    ]).addTo(m);
  }, [origin, destination]);

  // ── trazado ──
  useEffect(() => {
    const m = mapRef.current;
    if (!m) return;
    routeRef.current?.remove();
    routeRef.current = null;
    if (!route || route.pts.length < 2) return;

    const halo = L.polyline(route.pts, {
      color: token('--paper'),
      weight: 8,
      opacity: 0.85,
      lineCap: 'round',
      lineJoin: 'round',
    });
    const main = L.polyline(route.pts, {
      color: token('--accent'),
      weight: 3.5,
      lineCap: 'round',
      lineJoin: 'round',
    });
    const accent = L.polyline(route.pts, {
      color: token('--amber'),
      weight: 1.5,
      opacity: 0.95,
      dashArray: '1, 8',
      lineCap: 'round',
      className: 'route-flow',
    });

    routeRef.current = L.layerGroup([halo, main, accent]).addTo(m);
    m.fitBounds(main.getBounds(), { padding: [70, 70] });
  }, [route]);

  // ── rectángulo de la zona importada ──
  useEffect(() => {
    const m = mapRef.current;
    if (!m) return;
    bboxRef.current?.remove();
    bboxRef.current = null;
    if (!importedBbox) return;
    bboxRef.current = L.rectangle(
      [
        [importedBbox.south, importedBbox.west],
        [importedBbox.north, importedBbox.east],
      ],
      { color: token('--ink-mute'), weight: 1, dashArray: '5 5', fill: false, interactive: false },
    ).addTo(m);
  }, [importedBbox]);

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

      {/* brújula */}
      <div
        style={{
          position: 'absolute',
          top: 18,
          right: 18,
          width: 56,
          height: 56,
          borderRadius: '50%',
          background: 'var(--paper)',
          border: '1px solid var(--rule)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: 'var(--shadow-sm)',
          zIndex: 900,
        }}
      >
        <svg width="38" height="38" viewBox="0 0 40 40" aria-hidden="true">
          <circle cx="20" cy="20" r="17" fill="none" stroke="var(--rule)" strokeWidth="0.6" />
          <path d="M20 5 L23 20 L20 18 L17 20 Z" fill="var(--ink)" />
          <path d="M20 35 L23 20 L20 22 L17 20 Z" fill="var(--rule)" />
          <text
            x="20"
            y="11"
            textAnchor="middle"
            fontFamily={FONT.serif}
            fontSize="6.5"
            fontWeight="600"
            fill="var(--ink)"
          >
            N
          </text>
        </svg>
      </div>

      {/* zoom */}
      <div
        style={{
          position: 'absolute',
          top: 86,
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
        <button type="button" style={btn} title="Acercar" onClick={() => mapRef.current?.zoomIn()}>
          <IconPlus size={14} />
        </button>
        <button
          type="button"
          style={{ ...btn, borderTop: '1px solid var(--rule-soft)' }}
          title="Alejar"
          onClick={() => mapRef.current?.zoomOut()}
        >
          <IconMinus size={14} />
        </button>
        <button
          type="button"
          style={{ ...btn, borderTop: '1px solid var(--rule-soft)' }}
          title="Encuadrar la ruta"
          onClick={() => {
            if (route && route.pts.length > 1) {
              mapRef.current?.fitBounds(L.polyline(route.pts).getBounds(), { padding: [70, 70] });
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
