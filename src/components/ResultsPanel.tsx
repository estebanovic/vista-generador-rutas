/**
 * Bitácora de la ruta — panel único anclado abajo. Plegado muestra las cifras y
 * el perfil altimétrico; desplegado añade el desglose completo del trayecto.
 */
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  co2Kg,
  fmtHours,
  fmtMeters,
  fuelLitres,
  HIGHWAY_LABELS,
  PROFILE_LABELS,
  SURFACE_LABELS,
} from '../lib/planner';
import type { PlannerState, RouteView } from '../lib/types';
import { IconChevronDown, IconCompass, IconDownload, IconPrint } from './icons';
import { BreakdownBar } from './primitives';
import { FONT, text } from './styles';

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

/** Divide la ruta en 2-4 tramos y caracteriza cada uno por su desnivel. */
function buildSegments(route: RouteView) {
  if (route.profile.length < 4) return [];
  const count = Math.min(4, Math.max(2, Math.round(route.hours / 1.5) || 2));
  const segs = [];
  for (let i = 0; i < count; i++) {
    const a = Math.floor((i / count) * route.profile.length);
    const b = Math.min(
      Math.floor(((i + 1) / count) * route.profile.length),
      route.profile.length - 1,
    );
    if (b <= a) continue;
    const slice = route.profile.slice(a, b + 1);
    const hi = Math.max(...slice.map((p) => p.ele));
    const lo = Math.min(...slice.map((p) => p.ele));
    const rise = hi - lo;
    segs.push({
      from: route.profile[a].km.toFixed(0),
      to: route.profile[b].km.toFixed(0),
      label: rise > 400 ? 'Puerto de montaña' : rise > 200 ? 'Tramo sinuoso' : 'Tramo fluido',
      gain: Math.round(rise),
    });
  }
  return segs;
}

export interface ResultsPanelProps {
  route: RouteView;
  state: PlannerState;
  /** Índice dentro de `route.profile`, no de `route.pts`. */
  focus: number | null;
  setFocus: (i: number | null) => void;
  onExportGpx: () => void;
}

export function ResultsPanel({ route, state, focus, setFocus, onExportGpx }: ResultsPanelProps) {
  const [expanded, setExpanded] = useState(false);

  const maxE = route.profile.length ? Math.round(Math.max(...route.profile.map((p) => p.ele))) : 0;
  const minE = route.profile.length ? Math.round(Math.min(...route.profile.map((p) => p.ele))) : 0;

  const segs = buildSegments(route);
  const highways = shareOfTotal(route.highwayBreakdown).slice(0, 5);
  const surfaces = shareOfTotal(route.surfaceBreakdown).slice(0, 4);

  const restStops = Math.max(1, Math.round(route.hours / 2));
  const fuelStops = Math.max(0, Math.floor(route.totalKm / 250));
  const fuel = fuelLitres(route.totalKm, state.profile);
  const co2 = co2Kg(route.totalKm, state.profile);

  const unpavedShare =
    shareOfTotal(route.surfaceBreakdown).find(([k]) => k === 'gravel' || k === 'dirt')?.[1] ?? 0;
  const note =
    unpavedShare > 25
      ? 'Buena parte del trazado va sin asfaltar — revisa neumáticos antes de salir'
      : route.ascent != null && route.ascent > 1200
        ? 'Desnivel considerable: cuenta con niebla y frío en las cotas altas'
        : route.curviness > 0.6
          ? 'Trazado muy revirado: la media real será más baja que la estimada'
          : 'Ruta sin sobresaltos — vigila el tráfico en los tramos rápidos';

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

      {/* — cifras + perfil — */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.6fr', flexShrink: 0 }}>
        <div
          style={{
            padding: '14px 20px 16px',
            borderRight: '1px solid var(--rule-soft)',
            background: 'var(--paper-2)',
            display: 'flex',
            flexDirection: 'column',
            gap: 14,
          }}
        >
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
            <BigStat label="Distancia" value={route.totalKm.toFixed(1)} unit="km" />
            <BigStat label="Tiempo" value={fmtHours(route.hours)} />
            <BigStat
              label="Desnivel"
              value={route.ascent == null ? 'sin datos' : `+${Math.round(route.ascent)}`}
              unit={route.ascent == null ? undefined : 'm'}
            />
          </div>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(4, 1fr)',
              gap: 8,
              paddingTop: 12,
              borderTop: '1px solid var(--rule-soft)',
            }}
          >
            <SmallStat label="Sinuosidad" value={Math.round(route.curviness * 100)} unit="%" />
            <SmallStat
              label="Bajada"
              value={route.descent == null ? 'sin datos' : Math.round(route.descent)}
              unit={route.descent == null ? undefined : 'm'}
            />
            <SmallStat label="Vel. media" value={Math.round(route.avgSpeed)} unit="km/h" />
            <SmallStat label="Cota máx." value={maxE || '—'} unit={maxE ? 'm' : undefined} />
          </div>
        </div>

        <div style={{ padding: '14px 20px 12px', position: 'relative', minWidth: 0 }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'baseline',
              justifyContent: 'space-between',
              marginBottom: 8,
              gap: 12,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
              <span style={text.eyebrow}>Perfil altimétrico</span>
              <span style={text.figure}>
                {route.profile.length > 0 ? `${minE} m → ${maxE} m` : 'Sin datos de cota'}
              </span>
            </div>
            <div
              style={{
                ...text.data,
                display: 'flex',
                gap: 14,
                color: 'var(--ink-mute)',
                whiteSpace: 'nowrap',
              }}
            >
              <span>
                <Dot color="var(--accent)" />
                elevación
              </span>
              <span>
                <Dot color="var(--amber)" />
                hito
              </span>
            </div>
          </div>

          {route.profile.length > 1 ? (
            <ElevationChart route={route} focus={focus} setFocus={setFocus} />
          ) : (
            <div
              style={{
                ...text.aside,
                height: 130,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: '1px dashed var(--rule-soft)',
                textAlign: 'center',
                padding: '0 20px',
              }}
            >
              {route.ascent == null
                ? 'El servicio de elevación no respondió y el trazador no tiene datos de elevación: sin datos de desnivel.'
                : `El servicio de elevación no respondió. El desnivel acumulado sigue siendo el que calculó el trazador: ↑ ${fmtMeters(route.ascent)} / ↓ ${fmtMeters(route.descent)}.`}
            </div>
          )}
        </div>
      </div>

      {/* — desglose — */}
      {expanded && (
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
          {segs.length > 0 && (
            <Column title="Tramos del trayecto" sub={`${segs.length} secciones`}>
              {segs.map((s, i) => (
                <Row
                  key={i}
                  last={i === segs.length - 1}
                  km={`KM ${s.from}–${s.to}`}
                  label={s.label}
                  right={`+${s.gain} m`}
                />
              ))}
            </Column>
          )}

          {route.highlights.length > 0 && (
            <Column title="Altos del trayecto" sub="máximos del perfil">
              {route.highlights.map((h, i) => (
                <Row
                  key={i}
                  last={i === route.highlights.length - 1}
                  km={`KM ${h.km.toFixed(1)}`}
                  label={h.name}
                  right={`${h.ele} m`}
                />
              ))}
            </Column>
          )}

          {(highways.length > 0 || surfaces.length > 0) && (
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
              {surfaces.length > 0 && (
                <div style={{ ...text.eyebrow, margin: '12px 0 2px' }}>Superficie</div>
              )}
              {surfaces.map(([k, pct]) => (
                <BreakdownBar
                  key={k}
                  label={SURFACE_LABELS[k] ?? k}
                  pct={pct}
                  color={k === 'asphalt' || k === 'concrete' ? 'var(--amber)' : 'var(--amber-deep)'}
                />
              ))}
            </Column>
          )}

          <Column title="Logística estimada">
            <DetailLine
              label="Perfil"
              value={state.custom ? 'Personalizado' : PROFILE_LABELS[state.profile]}
            />
            <DetailLine label="Paradas de descanso" value={`${restStops} sugeridas`} />
            {fuel > 0 && <DetailLine label="Combustible" value={`≈ ${fuel.toFixed(1)} L`} />}
            {fuelStops > 0 && <DetailLine label="Repostajes" value={`${fuelStops} en ruta`} />}
            {co2 > 0 && <DetailLine label="Huella CO₂" value={`${co2.toFixed(1)} kg`} />}

            <div
              style={{
                marginTop: 12,
                padding: '9px 11px',
                background: 'var(--paper-3)',
                borderLeft: '3px solid var(--amber-deep)',
                display: 'flex',
                gap: 10,
                alignItems: 'flex-start',
              }}
            >
              <span style={{ color: 'var(--amber-deep)', marginTop: 2, display: 'flex' }}>
                <IconCompass size={15} />
              </span>
              <div>
                <div style={text.eyebrow}>Aviso del cartógrafo</div>
                <div style={{ ...text.aside, color: 'var(--ink)', marginTop: 2 }}>{note}.</div>
              </div>
            </div>

            <p style={{ ...text.aside, margin: '10px 0 0' }}>
              Distancia, desnivel y sinuosidad vienen del trazador; tiempo, consumo y paradas son
              estimaciones del perfil.
            </p>
          </Column>
        </div>
      )}
    </div>
  );
}

// ── Piezas del desglose ──────────────────────────────────────

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

function Row({
  km,
  label,
  right,
  last,
}: {
  km: string;
  label: string;
  right: string;
  last: boolean;
}) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '84px 1fr auto',
        alignItems: 'baseline',
        gap: 6,
        padding: '7px 0',
        borderBottom: last ? 'none' : '1px dashed var(--rule-soft)',
      }}
    >
      <span style={{ ...text.data, color: 'var(--amber-deep)' }}>{km}</span>
      <span style={text.value}>{label}</span>
      <span style={{ ...text.data, color: 'var(--ink-mute)' }}>{right}</span>
    </div>
  );
}

function DetailLine({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'baseline',
        padding: '5px 0',
        borderBottom: '1px dotted var(--rule-soft)',
        gap: 8,
      }}
    >
      <span style={text.caption}>{label}</span>
      <span style={{ ...text.bodyStrong, whiteSpace: 'nowrap' }}>{value}</span>
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

function SmallStat({
  label,
  value,
  unit,
}: {
  label: string;
  value: string | number;
  unit?: string;
}) {
  return (
    <div>
      <div style={text.eyebrow}>{label}</div>
      <div style={{ ...text.figure, marginTop: 2 }}>
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

function Dot({ color }: { color: string }) {
  return (
    <span
      style={{
        display: 'inline-block',
        width: 8,
        height: 8,
        background: color,
        borderRadius: '50%',
        marginRight: 6,
        verticalAlign: 'middle',
      }}
    />
  );
}

// ── Perfil altimétrico ───────────────────────────────────────

function ElevationChart({
  route,
  focus,
  setFocus,
}: {
  route: RouteView;
  focus: number | null;
  setFocus: (i: number | null) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(640);
  const h = 130;
  const padL = 38;
  const padR = 12;
  const padT = 8;
  const padB = 22;

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setW(el.clientWidth));
    ro.observe(el);
    setW(el.clientWidth);
    return () => ro.disconnect();
  }, []);

  const { profile, totalKm } = route;
  const minE = Math.min(...profile.map((p) => p.ele));
  const maxE = Math.max(...profile.map((p) => p.ele));
  const innerW = Math.max(w - padL - padR, 10);
  const innerH = h - padT - padB;

  const xAt = (km: number) => padL + (totalKm > 0 ? km / totalKm : 0) * innerW;
  const yAt = (e: number) => padT + innerH - ((e - minE) / (maxE - minE || 1)) * innerH;

  const linePath = useMemo(
    () =>
      profile
        .map((p, i) => `${i === 0 ? 'M' : 'L'}${xAt(p.km).toFixed(1)} ${yAt(p.ele).toFixed(1)}`)
        .join(' '),
    // xAt / yAt dependen de w y del propio perfil.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [profile, w, minE, maxE],
  );

  const fillPath = `${linePath} L${xAt(profile[profile.length - 1].km).toFixed(1)} ${(
    padT + innerH
  ).toFixed(1)} L${xAt(profile[0].km).toFixed(1)} ${(padT + innerH).toFixed(1)} Z`;

  /** Índice del perfil bajo el cursor. */
  const onMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const t = (e.clientX - rect.left - padL) / innerW;
    if (t < 0 || t > 1) {
      setFocus(null);
      return;
    }
    const km = t * totalKm;
    let best = 0;
    let bestD = Infinity;
    profile.forEach((p, i) => {
      const d = Math.abs(p.km - km);
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    });
    setFocus(best);
  };

  const ticks = [minE, (minE + maxE) / 2, maxE].map((e) => Math.round(e));
  const focused = focus != null ? profile[focus] : null;

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <svg
        width={w}
        height={h}
        onMouseMove={onMove}
        onMouseLeave={() => setFocus(null)}
        style={{ display: 'block', cursor: 'crosshair' }}
      >
        {ticks.map((t, i) => (
          <g key={`y${i}`}>
            <line
              x1={padL}
              x2={w - padR}
              y1={yAt(t)}
              y2={yAt(t)}
              stroke="var(--rule-soft)"
              strokeDasharray="2 4"
            />
            <text
              x={padL - 6}
              y={yAt(t) + 3}
              textAnchor="end"
              fontFamily={FONT.mono}
              fontSize="10"
              fill="var(--ink-mute)"
            >
              {t}
            </text>
          </g>
        ))}

        {[0, 0.25, 0.5, 0.75, 1].map((p, i) => {
          const x = padL + p * innerW;
          return (
            <g key={`x${i}`}>
              <line x1={x} x2={x} y1={padT + innerH} y2={padT + innerH + 4} stroke="var(--rule)" />
              <text
                x={x}
                y={padT + innerH + 14}
                textAnchor="middle"
                fontFamily={FONT.mono}
                fontSize="10"
                fill="var(--ink-mute)"
                letterSpacing="0.06em"
              >
                {(p * totalKm).toFixed(0)} km
              </text>
            </g>
          );
        })}

        <path d={fillPath} fill="var(--accent)" fillOpacity="0.08" />
        <path
          d={linePath}
          stroke="var(--accent)"
          strokeWidth="1.6"
          fill="none"
          strokeLinejoin="round"
          strokeLinecap="round"
        />

        {route.highlights.map((hl, i) => {
          const p = profile.find((pp) => pp.idx === hl.idx);
          if (!p) return null;
          const x = xAt(p.km);
          const y = yAt(p.ele);
          return (
            <g key={`h${i}`}>
              <line
                x1={x}
                x2={x}
                y1={y}
                y2={padT + innerH}
                stroke="var(--amber-deep)"
                strokeWidth="0.8"
                strokeDasharray="2 2"
                opacity="0.6"
              />
              <circle
                cx={x}
                cy={y}
                r="3.5"
                fill="var(--amber)"
                stroke="var(--ink)"
                strokeWidth="1"
              />
            </g>
          );
        })}

        {focused && (
          <g>
            <line
              x1={xAt(focused.km)}
              x2={xAt(focused.km)}
              y1={padT}
              y2={padT + innerH}
              stroke="var(--ink)"
              strokeWidth="0.8"
            />
            <circle
              cx={xAt(focused.km)}
              cy={yAt(focused.ele)}
              r="4"
              fill="var(--paper)"
              stroke="var(--ink)"
              strokeWidth="1.5"
            />
          </g>
        )}
      </svg>

      {focused && (
        <div
          style={{
            position: 'absolute',
            left: Math.min(Math.max(xAt(focused.km) + 8, padL), Math.max(w - 130, padL)),
            top: 0,
            background: 'var(--ink)',
            color: 'var(--paper)',
            padding: '6px 10px',
            borderRadius: 2,
            ...text.data,
            pointerEvents: 'none',
            whiteSpace: 'nowrap',
          }}
        >
          KM {focused.km.toFixed(1)} · {Math.round(focused.ele)} M
        </div>
      )}

      {route.highlights.length > 0 && (
        <div
          style={{
            ...text.value,
            display: 'flex',
            justifyContent: 'space-between',
            marginTop: 2,
            paddingLeft: padL,
            paddingRight: padR,
            color: 'var(--ink-soft)',
          }}
        >
          {route.highlights.map((hl, i) => (
            <span
              key={i}
              style={{
                flex: 1,
                textAlign:
                  i === 0 ? 'left' : i === route.highlights.length - 1 ? 'right' : 'center',
              }}
            >
              {hl.name} · {hl.ele} m
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
