/**
 * Bitácora de la ruta — panel único anclado abajo. Plegado muestra las cifras;
 * desplegado añade la composición de la vía y la superficie.
 */
import { useState, type ReactNode } from 'react';
import { HIGHWAY_LABELS, PROFILE_LABELS, SURFACE_LABELS } from '../lib/planner';
import type { PlannerState, RouteView } from '../lib/types';
import { IconChevronDown, IconDownload, IconPrint } from './icons';
import { BreakdownBar } from './primitives';
import { text } from './styles';

/** Ordenados de vía rápida a pista, para que las barras lean como una escala. */
const HIGHWAY_ORDER = [
  'motorway',
  'trunk',
  'primary',
  'secondary',
  'tertiary',
  'unclassified',
  'residential',
  'service',
  'track',
  'path',
];

function shareOfTotal(breakdown: Record<string, number>): [string, number][] {
  const total = Object.values(breakdown).reduce((a, b) => a + b, 0);
  if (total <= 0) return [];
  return Object.entries(breakdown)
    .map(([k, m]) => [k, (m / total) * 100] as [string, number])
    .sort((a, b) => b[1] - a[1]);
}

export interface ResultsPanelProps {
  route: RouteView;
  state: PlannerState;
  onExportGpx: () => void;
}

export function ResultsPanel({ route, state, onExportGpx }: ResultsPanelProps) {
  const [expanded, setExpanded] = useState(false);

  const highways = shareOfTotal(route.highwayBreakdown).slice(0, 5);
  const surfaces = shareOfTotal(route.surfaceBreakdown).slice(0, 4);

  return (
    <div
      className="fade-up"
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
          Bitácora · Ruta
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
          {route.origin.name} <span style={{ color: 'var(--amber-deep)' }}>—</span>{' '}
          {route.destination.name}
        </span>
        <span
          style={{
            ...text.data,
            marginLeft: 'auto',
            color: 'var(--ink-mute)',
            flexShrink: 0,
          }}
        >
          {new Date()
            .toLocaleDateString('es', { day: '2-digit', month: 'short', year: 'numeric' })
            .toUpperCase()}
        </span>
        <GhostButton icon={IconDownload} label="GPX" onClick={onExportGpx} />
        <GhostButton icon={IconPrint} label="Imprimir" onClick={() => window.print()} />
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
            background: expanded ? 'var(--ink)' : 'transparent',
            color: expanded ? 'var(--paper)' : 'var(--ink-soft)',
            border: `1px solid ${expanded ? 'var(--ink)' : 'var(--rule)'}`,
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

      {/* — cifras — */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
          gap: 8,
          padding: '14px 20px 16px',
          background: 'var(--paper-2)',
          flexShrink: 0,
        }}
      >
        <BigStat label="Distancia" value={route.totalKm.toFixed(1)} unit="km" />
        <BigStat label="Sinuosidad" value={String(Math.round(route.curviness * 100))} unit="%" />
        <BigStat
          label="Perfil"
          value={state.custom ? 'Personalizado' : PROFILE_LABELS[state.profile]}
        />
      </div>

      {/* — desglose — */}
      {expanded && (highways.length > 0 || surfaces.length > 0) && (
        <div
          className="scroll"
          style={{
            borderTop: '1px solid var(--rule)',
            overflowY: 'auto',
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
            alignItems: 'start',
          }}
        >
          <Column title="Composición de la vía" sub="por distancia">
            {highways.map(([k, pct]) => (
              <BreakdownBar
                key={k}
                label={HIGHWAY_LABELS[k] ?? k}
                pct={pct}
                color={
                  HIGHWAY_ORDER.indexOf(k) < 3
                    ? 'var(--terra)'
                    : HIGHWAY_ORDER.indexOf(k) < 6
                      ? 'var(--amber)'
                      : 'var(--amber-deep)'
                }
              />
            ))}
          </Column>
          <Column title="Superficie" sub="por distancia">
            {surfaces.map(([k, pct]) => (
              <BreakdownBar
                key={k}
                label={SURFACE_LABELS[k] ?? k}
                pct={pct}
                color={k === 'asphalt' || k === 'concrete' ? 'var(--amber)' : 'var(--amber-deep)'}
              />
            ))}
          </Column>
        </div>
      )}
    </div>
  );
}

// ── Piezas ───────────────────────────────────────────────────

function Column({ title, sub, children }: { title: string; sub?: string; children: ReactNode }) {
  return (
    <div style={{ padding: '12px 20px 14px', borderRight: '1px solid var(--rule-soft)' }}>
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

function BigStat({ label, value, unit }: { label: string; value: string; unit?: string }) {
  return (
    <div>
      <div style={{ ...text.eyebrow, marginBottom: 4 }}>{label}</div>
      <div style={text.figureXl}>
        {value}
        <Unit>{unit}</Unit>
      </div>
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

/** Unidad junto a una cifra: siempre mono, siempre apagada. */
function Unit({ children }: { children?: string }) {
  if (!children) return null;
  return <span style={{ ...text.data, color: 'var(--ink-mute)', marginLeft: 5 }}>{children}</span>;
}
