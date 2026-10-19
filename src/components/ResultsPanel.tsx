/**
 * Bitácora de la ruta — panel único anclado abajo. Arriba los avisos, luego
 * las cifras y, desplegado, el reparto por tipo de vía y superficie.
 */
import { useState, type ReactNode } from 'react';
import { adaptNotice } from '../lib/messages';
import {
  fmtKm,
  fmtPct,
  HIGHWAY_LABELS,
  inferredSurfaceShare,
  isLoop,
  KIND_LABELS,
  PROFILE_LABELS,
  routeTitle,
  shares,
  SURFACE_LABELS,
  surfaceSummary,
  TARGET_TOLERANCE,
} from '../lib/planner';
import type { RouteView } from '../lib/types';
import { IconChevronDown, IconDownload } from './icons';
import { BreakdownBar } from './primitives';
import { text } from './styles';

/** Ajustes al mapa desde los que se avisa: el punto pedido queda lejos de la ruta. */
const SNAP_WARN_M = 200;

/** Barras visibles por reparto; el resto se agrupa en «Otras». */
const MAX_BARS = 5;

/** Ordenados de vía rápida a pista, para colorear las barras como una escala. */
const HIGHWAY_ORDER = [
  'motorway',
  'trunk',
  'primary',
  'secondary',
  'tertiary',
  'unclassified',
  'residential',
  'living_street',
  'service',
  'track',
  'path',
];
const PAVED = new Set(['asphalt', 'concrete', 'cobblestone']);

interface Notice {
  tone: 'info' | 'warn';
  title: string;
  body: string[];
}

function buildNotices(route: RouteView): Notice[] {
  const out: Notice[] = [];
  const tl = route.targetLength;

  if (route.kind === 'ida-y-vuelta' && tl) {
    out.push({
      tone: 'warn',
      title: tl.circuitImpossible
        ? 'No hay un circuito posible desde este punto'
        : 'No se encontró un circuito',
      body: [
        'En su lugar se propone una ida y vuelta: la ruta llega hasta el punto de giro (◆ en el mapa) y regresa por el mismo camino.',
        ...(tl.message ? [adaptNotice(tl.message)] : []),
        tl.circuitImpossible
          ? 'Puedes probar con otro largo o con otro punto de partida.'
          : 'Podría existir uno que la búsqueda no alcanzó a encontrar: prueba con otro largo o con otro punto de partida.',
      ],
    });
  }
  if (route.kind === 'ruta' && tl && !tl.withinBand) {
    out.push({
      tone: 'warn',
      title: 'El largo quedó fuera del margen pedido',
      body: tl.message ? [adaptNotice(tl.message)] : [],
    });
  }
  if (route.kind === 'circuito' && tl && tl.accessRepeatedMeters > 0) {
    out.push({
      tone: 'info',
      title: 'Tramo de acceso de ida y vuelta',
      body: [
        `Los primeros ${fmtKm(tl.accessRepeatedMeters / 2)} llevan hasta las calles donde se cierra el circuito y se recorren de ida y de vuelta (en dorado en el mapa).`,
      ],
    });
  }

  const { origin, destination } = route.snap;
  if (origin.distanceMeters > SNAP_WARN_M) {
    out.push({
      tone: 'warn',
      title: 'El punto de partida está lejos de la vía',
      body: [
        `Está a ${Math.round(origin.distanceMeters)} m de la vía más cercana: la ruta empieza en esa vía (línea punteada en el mapa).`,
      ],
    });
  }
  if (!isLoop(route.kind) && destination.distanceMeters > SNAP_WARN_M) {
    out.push({
      tone: 'warn',
      title: 'El destino está lejos de la vía',
      body: [
        `Está a ${Math.round(destination.distanceMeters)} m de la vía más cercana: la ruta termina en esa vía (línea punteada en el mapa).`,
      ],
    });
  }
  return out;
}

/** Las `MAX_BARS` claves principales y el resto sumado como «Otras». */
function topShares(breakdown: Record<string, number>): [string, number][] {
  const all = shares(breakdown);
  if (all.length <= MAX_BARS) return all;
  const rest = all.slice(MAX_BARS - 1).reduce((a, [, f]) => a + f, 0);
  return [...all.slice(0, MAX_BARS - 1), ['otras', rest]];
}

export interface ResultsPanelProps {
  route: RouteView;
  /** Los parámetros cambiaron desde que se calculó esta ruta. */
  stale: boolean;
  onExportGpx: () => void;
}

export function ResultsPanel({ route, stale, onExportGpx }: ResultsPanelProps) {
  const [expanded, setExpanded] = useState(true);
  const { stats, detour, targetLength: tl, state } = route;

  const notices = buildNotices(route);
  if (stale) {
    notices.unshift({
      tone: 'info',
      title: 'Cambiaste los parámetros',
      body: ['Esta ruta corresponde a la búsqueda anterior. Pulsa «Recalcular» para actualizarla.'],
    });
  }
  const highways = topShares(stats.highwayBreakdown);
  const surfaces = topShares(stats.surfaceBreakdown);
  const { unpaved } = surfaceSummary(stats.surfaceBreakdown);
  const inferred = inferredSurfaceShare(stats.surfaceSourceBreakdown);
  const profileLabel = state.custom ? 'Perfil personalizado' : `Perfil ${PROFILE_LABELS[state.profile]}`;

  return (
    <div
      className="fade-up"
      data-results-panel
      style={{
        position: 'absolute',
        left: 20,
        right: 20,
        bottom: 18,
        zIndex: 900,
        maxHeight: 'calc(100vh - 140px)',
        background: 'var(--paper)',
        border: '1px solid var(--rule)',
        boxShadow: 'var(--shadow-md)',
        borderRadius: 2,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      {/* — masthead — */}
      <div
        style={{
          display: 'flex',
          alignItems: 'baseline',
          gap: 14,
          padding: '10px 20px 9px',
          background: 'var(--paper-2)',
          borderBottom: '2px solid var(--ink)',
        }}
      >
        <span style={{ ...text.eyebrow, color: 'var(--amber-deep)', flexShrink: 0 }}>
          {KIND_LABELS[route.kind]}
        </span>
        <span
          style={{
            ...text.title,
            minWidth: 0,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {routeTitle(route)}
        </span>
        <span
          style={{ ...text.data, marginLeft: 'auto', color: 'var(--ink-mute)', flexShrink: 0 }}
        >
          {profileLabel.toUpperCase()}
        </span>
        <GhostButton icon={IconDownload} label="GPX" onClick={onExportGpx} />
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
          style={{
            ...text.bodySm,
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '5px 10px',
            background: 'transparent',
            color: 'var(--ink-soft)',
            border: '1px solid var(--rule)',
            borderRadius: 2,
            flexShrink: 0,
          }}
        >
          {expanded ? 'Menos detalle' : 'Ver detalle'}
          <span
            style={{
              display: 'flex',
              transform: expanded ? 'rotate(180deg)' : 'none',
              transition: 'transform .18s',
            }}
          >
            <IconChevronDown size={12} />
          </span>
        </button>
      </div>

      <div className="scroll" style={{ overflowY: 'auto' }}>
        {/* — avisos — */}
        {notices.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '12px 20px 0' }}>
            {notices.map((n, i) => (
              <NoticeBox key={i} notice={n} />
            ))}
          </div>
        )}

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
            alignItems: 'start',
          }}
        >
          {/* — cifras — */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
              gap: '14px 12px',
              padding: '14px 20px 16px',
            }}
          >
            <Stat
              label="Distancia"
              value={fmtKm(stats.distanceMeters)}
              caption={route.kind === 'ida-y-vuelta' ? 'contando ida y vuelta' : undefined}
            />
            <Stat
              label="Curvas"
              value={fmtPct(stats.curvyShare)}
              caption="del recorrido en tramos con curvas"
            />
            <Stat label="Sin pavimentar" value={fmtPct(unpaved)} caption="ripio, tierra o arena" />
            {detour && (
              <Stat
                label="Desvío"
                value={
                  detour.detourRatio - 1 < 0.005
                    ? 'Ninguno'
                    : `+${Math.round((detour.detourRatio - 1) * 100)} %`
                }
                caption={
                  `frente a la más corta (${fmtKm(detour.shortestDistanceMeters)}); ` +
                  `máximo +${Math.round((detour.maxDetourRatio - 1) * 100)} %` +
                  (detour.binding ? '. El máximo limitó la ruta.' : '')
                }
              />
            )}
            {tl && (
              <Stat
                label="Largo pedido"
                value={fmtKm(tl.targetMeters, 0)}
                caption={`logrado ${fmtKm(tl.achievedMeters)}, ${tl.withinBand ? 'dentro' : 'fuera'} del margen de ±${Math.round(TARGET_TOLERANCE * 100)} %`}
                warn={!tl.withinBand}
              />
            )}
          </div>

          {/* — repartos — */}
          {expanded && highways.length > 0 && (
            <Column title="Tipo de vía" sub="por distancia">
              {highways.map(([k, f]) => {
                const rank = HIGHWAY_ORDER.indexOf(k);
                return (
                  <BreakdownBar
                    key={k}
                    label={k === 'otras' ? 'Otras' : (HIGHWAY_LABELS[k] ?? k)}
                    share={f}
                    valueLabel={fmtPct(f)}
                    color={
                      rank < 0
                        ? 'var(--rule)'
                        : rank < 3
                          ? 'var(--terra)'
                          : rank < 6
                            ? 'var(--amber)'
                            : 'var(--amber-deep)'
                    }
                  />
                );
              })}
            </Column>
          )}
          {expanded && surfaces.length > 0 && (
            <Column title="Superficie" sub="por distancia">
              {surfaces.map(([k, f]) => (
                <BreakdownBar
                  key={k}
                  label={k === 'otras' ? 'Otras' : (SURFACE_LABELS[k] ?? k)}
                  share={f}
                  valueLabel={fmtPct(f)}
                  color={
                    k === 'otras' || k === 'unknown'
                      ? 'var(--rule)'
                      : PAVED.has(k)
                        ? 'var(--amber)'
                        : 'var(--terra)'
                  }
                />
              ))}
              {inferred > 0 && (
                <p style={{ ...text.caption, margin: '8px 0 0' }}>
                  En el {fmtPct(inferred)} del recorrido OpenStreetMap no indica la superficie: se
                  dedujo de las vías vecinas o del tipo de vía.
                </p>
              )}
            </Column>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Piezas ───────────────────────────────────────────────────

function NoticeBox({ notice }: { notice: Notice }) {
  return (
    <div
      role={notice.tone === 'warn' ? 'status' : undefined}
      style={{
        padding: '9px 12px',
        background: 'var(--paper-3)',
        borderLeft: `3px solid ${notice.tone === 'warn' ? 'var(--terra)' : 'var(--amber-deep)'}`,
      }}
    >
      <div style={{ ...text.bodyStrong, color: 'var(--ink)' }}>{notice.title}</div>
      {notice.body.map((line, i) => (
        <div key={i} style={{ ...text.body, color: 'var(--ink-soft)', marginTop: 2 }}>
          {line}
        </div>
      ))}
    </div>
  );
}

function Column({ title, sub, children }: { title: string; sub?: string; children: ReactNode }) {
  return (
    <div style={{ padding: '14px 20px 16px', borderLeft: '1px solid var(--rule-soft)' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'baseline',
          justifyContent: 'space-between',
          marginBottom: 6,
          gap: 8,
        }}
      >
        <span style={text.eyebrow}>{title}</span>
        {sub && (
          <span style={{ ...text.data, color: 'var(--ink-mute)', whiteSpace: 'nowrap' }}>
            {sub}
          </span>
        )}
      </div>
      {children}
    </div>
  );
}

function Stat({
  label,
  value,
  caption,
  warn,
}: {
  label: string;
  value: string;
  caption?: string;
  warn?: boolean;
}) {
  return (
    <div style={{ minWidth: 0 }}>
      <div style={{ ...text.eyebrow, marginBottom: 4 }}>{label}</div>
      <div style={{ ...text.figureXl, color: warn ? 'var(--terra)' : undefined }}>{value}</div>
      {caption && <div style={{ ...text.caption, marginTop: 4 }}>{caption}</div>}
    </div>
  );
}

function GhostButton({
  icon: Ico,
  label,
  onClick,
}: {
  icon: (p: { size?: number }) => ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        ...text.bodySm,
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        padding: '5px 10px',
        background: 'transparent',
        border: '1px solid var(--rule)',
        borderRadius: 2,
        color: 'var(--ink-soft)',
        flexShrink: 0,
        transition: 'all .15s',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = 'var(--ink)';
        e.currentTarget.style.color = 'var(--ink)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = 'var(--rule)';
        e.currentTarget.style.color = 'var(--ink-soft)';
      }}
    >
      <Ico size={12} />
      {label}
    </button>
  );
}
