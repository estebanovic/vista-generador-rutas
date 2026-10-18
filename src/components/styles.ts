/**
 * Sistema tipográfico. Ningún componente declara fuente, tamaño o peso a mano:
 * todo sale de `text`, para que la escala no vuelva a derivar.
 *
 * Tres familias, tres trabajos:
 *   serif → display y cifras        sans (Inter) → controles y etiquetas
 *   mono  → datos (km, cotas, %, coordenadas)
 *
 * La **cursiva** está reservada a dos cosas y a ninguna más: la voz del
 * cartógrafo (`aside`) y los nombres propios de tramos e hitos (`value`,
 * `title`). No se usa en botones, subtítulos ni mensajes de error.
 */
import type { CSSProperties } from 'react';

export const FONT = {
  serif: 'var(--serif-display)',
  sans: "'Inter', system-ui, sans-serif",
  mono: "'JetBrains Mono', ui-monospace, monospace",
} as const;

/** Escala de siete pasos. No añadir valores intermedios. */
export const SIZE = {
  xs: 10,
  sm: 11,
  base: 13,
  md: 15,
  lg: 19,
  xl: 24,
  xxl: 34,
} as const;

export const text = {
  /** Título de la app. */
  displayXl: {
    fontFamily: FONT.serif,
    fontSize: SIZE.xl,
    fontWeight: 600,
    lineHeight: 1.1,
  },
  /** Títulos de sección y de overlay. */
  display: {
    fontFamily: FONT.serif,
    fontSize: SIZE.lg,
    fontWeight: 600,
    lineHeight: 1,
  },
  /** Nombre del trayecto en la bitácora — nombre propio, por eso cursiva. */
  title: {
    fontFamily: FONT.serif,
    fontSize: SIZE.lg,
    fontWeight: 500,
    fontStyle: 'italic',
    lineHeight: 1.15,
  },
  /** Cifra principal. */
  figureXl: {
    fontFamily: FONT.serif,
    fontSize: SIZE.xxl,
    fontWeight: 500,
    lineHeight: 1,
    letterSpacing: '-0.01em',
  },
  /** Cifra secundaria. */
  figure: {
    fontFamily: FONT.serif,
    fontSize: SIZE.lg,
    fontWeight: 500,
    lineHeight: 1.1,
  },
  /** Texto de interfaz. */
  body: {
    fontFamily: FONT.sans,
    fontSize: SIZE.base,
    fontWeight: 400,
    lineHeight: 1.5,
  },
  /** Texto de interfaz con énfasis: campos, botones. */
  bodyStrong: {
    fontFamily: FONT.sans,
    fontSize: SIZE.base,
    fontWeight: 500,
    lineHeight: 1.5,
  },
  /** Controles compactos: píldoras, chips, botones secundarios. */
  bodySm: {
    fontFamily: FONT.sans,
    fontSize: SIZE.sm,
    fontWeight: 500,
    lineHeight: 1.4,
  },
  /** Etiqueta en versalitas. Única definición: siempre Inter, siempre 10px. */
  eyebrow: {
    fontFamily: FONT.sans,
    fontSize: SIZE.xs,
    fontWeight: 500,
    letterSpacing: '0.18em',
    textTransform: 'uppercase',
    color: 'var(--ink-mute)',
  },
  /** Etiqueta de interfaz apagada: pies de dato, nombres de barra. */
  caption: {
    fontFamily: FONT.sans,
    fontSize: SIZE.sm,
    fontWeight: 400,
    lineHeight: 1.4,
    color: 'var(--ink-mute)',
  },
  /** Dato numérico: km, cotas, porcentajes, coordenadas, fechas. */
  data: {
    fontFamily: FONT.mono,
    fontSize: SIZE.xs,
    fontWeight: 400,
    letterSpacing: '0.06em',
  },
  /** Voz del cartógrafo: notas, pistas y advertencias. */
  aside: {
    fontFamily: FONT.serif,
    fontSize: SIZE.md,
    fontStyle: 'italic',
    lineHeight: 1.45,
    color: 'var(--ink-mute)',
  },
  /** Nombre propio de un tramo o un hito. */
  value: {
    fontFamily: FONT.serif,
    fontSize: SIZE.md,
    fontStyle: 'italic',
    lineHeight: 1.3,
  },
} satisfies Record<string, CSSProperties>;

/** Sección numerada del sidebar. */
export const sectionStyle: CSSProperties = {
  padding: '18px 22px 16px',
  borderBottom: '1px solid var(--rule-soft)',
};
