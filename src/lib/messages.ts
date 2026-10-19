/**
 * Textos del backend adaptados a quien no conoce el cálculo. Los patrones
 * siguen los mensajes de `generador-rutas_2`; si uno cambia, se muestra el
 * original con mayúscula inicial.
 */

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
