/** Exporta la ruta trazada como GPX 1.1 y la descarga en el navegador. */
import { fmtKm, isLoop, KIND_LABELS, routeTitle } from './planner';
import type { RouteView } from './types';

const escape = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const wpt = (lat: number, lon: number, name: string) =>
  `  <wpt lat="${lat.toFixed(6)}" lon="${lon.toFixed(6)}"><name>${escape(name)}</name></wpt>`;

/**
 * Un solo track con todos los puntos en orden. En el circuito el primero y el
 * último coinciden; en la ida y vuelta el track va y vuelve por el mismo
 * camino, y el punto de giro se marca como waypoint.
 */
export function routeToGpx(route: RouteView): string {
  const name = routeTitle(route);
  const { pts } = route;
  const first = pts[0];
  const last = pts[pts.length - 1];

  const wpts = isLoop(route.kind)
    ? [wpt(first[0], first[1], 'Partida y llegada')]
    : [wpt(first[0], first[1], 'Partida'), wpt(last[0], last[1], 'Llegada')];
  const turn = route.targetLength?.turnaround;
  if (route.kind === 'ida-y-vuelta' && turn) wpts.push(wpt(turn.lat, turn.lon, 'Punto de giro'));

  const trkpts = pts
    .map(([lat, lon]) => `      <trkpt lat="${lat.toFixed(6)}" lon="${lon.toFixed(6)}"></trkpt>`)
    .join('\n');
  const desc = `${KIND_LABELS[route.kind]} · ${fmtKm(route.stats.distanceMeters)}`;

  return `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="Calculadora de rutas" xmlns="http://www.topografix.com/GPX/1/1">
  <metadata><name>${escape(name)}</name><desc>${escape(desc)}</desc><time>${new Date().toISOString()}</time></metadata>
${wpts.join('\n')}
  <trk>
    <name>${escape(name)}</name>
    <desc>${escape(desc)}</desc>
    <trkseg>
${trkpts}
    </trkseg>
  </trk>
</gpx>
`;
}

export function downloadGpx(route: RouteView): void {
  const blob = new Blob([routeToGpx(route)], { type: 'application/gpx+xml' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const file = routeTitle(route)
    .replace(/\s*—\s*/g, ' - ')
    .replace(/[^\w\-À-ÿ ,.]+/g, '')
    .trim();
  a.download = `${file || 'ruta'}.gpx`;
  // Firefox solo descarga si el enlace está en el documento; revocar la URL
  // en el mismo tick puede cortar la descarga.
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
