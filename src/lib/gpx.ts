/** Exporta la ruta trazada como GPX 1.1 y la descarga en el navegador. */
import type { RouteView } from './types';

const escape = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export function routeToGpx(route: RouteView, name: string): string {
  const pts = route.pts
    .map(([lat, lon]) => `      <trkpt lat="${lat.toFixed(6)}" lon="${lon.toFixed(6)}"></trkpt>`)
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="Calculadora de rutas" xmlns="http://www.topografix.com/GPX/1/1">
  <metadata><name>${escape(name)}</name><time>${new Date().toISOString()}</time></metadata>
  <trk>
    <name>${escape(name)}</name>
    <trkseg>
${pts}
    </trkseg>
  </trk>
</gpx>
`;
}

export function downloadGpx(route: RouteView, name: string): void {
  const blob = new Blob([routeToGpx(route, name)], { type: 'application/gpx+xml' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${name.replace(/[^\w\-À-ÿ ]+/g, '').trim() || 'ruta'}.gpx`;
  a.click();
  URL.revokeObjectURL(url);
}
