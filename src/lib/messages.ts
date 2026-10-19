/**
 * Textos del backend adaptados a quien no conoce el cálculo. Los patrones
 * siguen los mensajes de `generador-rutas_2`; si uno cambia, se muestra el
 * original con mayúscula inicial.
 */

import type { LatLon } from './types';

type Rule = [RegExp, (m: RegExpMatchArray) => string];

const km = (s: string) => s.replace('.', ',');

function adapt(message: string, rules: Rule[]): string {
  const msg = message.trim();
  for (const [re, fn] of rules) {
    const m = msg.match(re);
    if (m) return fn(m);
  }
  const text = msg.charAt(0).toUpperCase() + msg.slice(1);
  return /[.!?]$/.test(text) ? text : `${text}.`;
}

/** Avisos de `targetLength.message` (respuesta correcta). */
const NOTICE_RULES: Rule[] = [
  [
    /^el acceso hasta la red con circuitos \(([\d.]+) km por sentido\) superaría el (\d+)% del largo pedido$/,
    (m) =>
      `Para llegar a calles donde se pueda cerrar un circuito habría que recorrer ${km(m[1])} km de ida y otros tantos de vuelta: más del ${m[2]} % del largo pedido.`,
  ],
  [
    /^no existe un circuito de ese largo sin repetir tramos desde este origen$/,
    () => 'Desde este punto no existe un circuito de ese largo que no repita tramos.',
  ],
  [
    /^el circuito más corto posible desde este origen es más largo que lo pedido$/,
    () => 'El circuito más corto posible desde este punto es más largo que lo pedido.',
  ],
  [
    /^no se encontró un circuito de ese largo sin repetir tramos$/,
    () => 'La búsqueda no encontró un circuito de ese largo que no repita tramos.',
  ],
  [
    /^el circuito encontrado no pasó el verificador de no repetición$/,
    () => 'El circuito encontrado repetía tramos y se descartó.',
  ],
  [
    /^no se encontró una ruta tan larga sin repetir tramos; se entrega la más cercana$/,
    () =>
      'No se encontró una ruta tan larga hasta el destino sin repetir tramos. Se muestra la de largo más parecido.',
  ],
  [
    /^no se encontró una ruta tan corta; se entrega la más cercana$/,
    () => 'No hay una ruta tan corta hasta ese destino. Se muestra la de largo más parecido.',
  ],
];

export const adaptNotice = (message: string) => adapt(message, NOTICE_RULES);

// ── Errores ──────────────────────────────────────────────────

const NETWORK = 'No hay conexión con el servidor de rutas. Revisa que esté en marcha e inténtalo de nuevo.';
const REJECTED = 'El servidor no aceptó los datos del recorrido. Revisa los puntos y el largo, e inténtalo de nuevo.';

/** Mensajes que nombran campos de la API o rutas HTTP: no sirven al usuario. */
const TECHNICAL = /[a-z][A-Z]|POST \//;

interface HttpLike {
  status: number;
  messages: string[];
}

const isHttp = (e: unknown): e is HttpLike =>
  typeof e === 'object' && e != null && 'status' in e && 'messages' in e;

export interface RouteErrorContext {
  origin: LatLon;
  /** Ausente en el circuito. */
  destination?: LatLon;
  timedOut: boolean;
}

/** Cuál de los dos puntos menciona el backend con «(lat, lon)». */
function whichPoint(msg: string, ctx: RouteErrorContext): string {
  const m = msg.match(/\((-?[\d.]+), (-?[\d.]+)\)/);
  if (!m || !ctx.destination) return 'punto de partida';
  const lat = Number(m[1]);
  const lon = Number(m[2]);
  const d = (p: LatLon) => (p.lat - lat) ** 2 + (p.lon - lon) ** 2;
  return d(ctx.origin) <= d(ctx.destination) ? 'punto de partida' : 'destino';
}

/**
 * Mensaje para el usuario ante un fallo de `POST /routes/calculate`.
 * `noGraph` indica que falta importar la zona.
 */
export function describeRouteError(
  e: unknown,
  ctx: RouteErrorContext,
): { message: string; noGraph: boolean } {
  const out = (message: string, noGraph = false) => ({ message, noGraph });
  if (ctx.timedOut) {
    return out('El servidor tardó demasiado en responder. Inténtalo de nuevo en unos segundos.');
  }
  if (!isHttp(e)) return out('Algo falló al calcular la ruta. Inténtalo de nuevo.');
  if (e.status === 0) return out(NETWORK);
  if (e.status >= 500) {
    return out('El servidor tuvo un problema al calcular la ruta. Inténtalo de nuevo.');
  }
  // Los de validación llegan como array y en inglés: no deberían ocurrir,
  // porque el formulario los valida antes de enviar.
  if (e.messages.length !== 1) return out(REJECTED);
  const msg = e.messages[0];
  const point = whichPoint(msg, ctx);

  if (/grafo está vacío/i.test(msg)) {
    return out('Todavía no hay calles cargadas. Encuadra una zona en el mapa y pulsa «Importar área visible».', true);
  }
  if (/^No hay vías importadas/i.test(msg)) {
    return out(`No hay calles cargadas cerca del ${point}. Encuadra esa zona en el mapa y pulsa «Importar área visible».`, true);
  }
  let m = msg.match(/está a ([\d.]+) m de la red vial conectada/);
  if (m) {
    return out(`El ${point} está a ${Math.round(Number(m[1]))} m de la calle más cercana y el máximo es 1 km. Acércalo a una vía.`);
  }
  if (/fuera de la red conectada/.test(msg)) {
    return out(`Las calles cercanas al ${point} no se conectan con el resto de las calles cargadas. Muévelo a otra vía o importa una zona más amplia.`);
  }
  if (/sin pasar por vías privadas/i.test(msg)) {
    return out('No hay forma de llegar sin pasar por caminos privados. Prueba con otro punto de partida o de destino.');
  }
  if (/quedaron sobre el mismo punto/.test(msg)) {
    return out('La partida y el destino quedan en el mismo punto de la vía. Sepáralos más.');
  }
  m = msg.match(/^no hay circuito ni ida y vuelta posible: (.*)$/);
  if (m) {
    return out(`No se puede armar un circuito ni una ida y vuelta. ${adaptNotice(m[1])} Prueba con otro largo o con otro punto de partida.`);
  }
  if (/acceso al núcleo principal es de un solo sentido/.test(msg)) {
    return out('Desde este punto solo se sale por calles de un sentido y no hay cómo volver. Mueve el punto de partida.');
  }
  if (/no hay camino al núcleo principal/.test(msg)) {
    return out('Desde este punto no se llega a calles donde se pueda armar un circuito. Mueve el punto de partida o importa una zona más amplia.');
  }
  return out(TECHNICAL.test(msg) ? REJECTED : adapt(msg, []));
}

/** Mensaje para el usuario ante un fallo de `POST /import`. */
export function describeImportError(e: unknown): string {
  if (!isHttp(e)) return 'Algo falló al importar la zona. Inténtalo de nuevo.';
  if (e.status === 0) return NETWORK;
  const msg = e.messages.join(' ');
  if (/No se encontraron vías vehiculares/.test(msg)) {
    return 'En el área visible no hay calles para autos. Mueve o amplía el mapa.';
  }
  if (e.status === 503 || /Overpass/.test(msg)) {
    return 'OpenStreetMap no respondió: sus servidores están saturados. Inténtalo de nuevo en unos minutos o con un área más pequeña.';
  }
  if (e.status >= 500) return 'El servidor tuvo un problema al guardar las calles. Inténtalo de nuevo.';
  return 'El área visible no se pudo importar. Mueve el mapa e inténtalo de nuevo.';
}
