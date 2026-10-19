/** Panel izquierdo: modalidad, puntos, largo o desvío, perfil, importación y cálculo. */
import { useEffect, useState } from 'react';
import {
  curvesLabel,
  defaultDetour,
  DETOUR_MAX,
  DETOUR_MIN,
  effectiveDetour,
  fmtNum,
  parseKm,
  pointsProblem,
  PROFILE_WEIGHTS,
  surfaceLabel,
  surfaceNote,
  TARGET_KM_MAX,
  TARGET_KM_MIN,
  TARGET_TOLERANCE,
  targetLengthError,
  targetLengthHint,
  traceLabel,
  W_MAX,
} from '../lib/planner';
import type { Mode, PlannerState, ProfileName, RouteWeights } from '../lib/types';
import {
  Icon4x4,
  IconArrow,
  IconCompass,
  IconCurves,
  IconDirect,
  IconFlag,
  IconLandscape,
  IconLayers,
  IconLoop,
  IconMoto,
  IconPin,
  IconRuler,
  IconSwap,
} from './icons';
import { LabeledSlider, SectionHeader, Segmented, type SegmentedOption } from './primitives';
import { sectionStyle, text } from './styles';
import { WaypointField } from './WaypointField';

const MODES: SegmentedOption<Mode>[] = [
  { value: 'directa', label: 'Directa', sub: 'A → B', icon: IconDirect },
  { value: 'circuito', label: 'Circuito', sub: 'VUELVE AL INICIO', icon: IconLoop },
  { value: 'destino-largo', label: 'Con largo', sub: 'A → B · KM', icon: IconRuler },
];

const MODE_NOTES: Record<Mode, string> = {
  directa: 'La ruta más agradable entre dos puntos, sin alargarla más de lo que permitas.',
  circuito: 'Sale del punto de partida y vuelve a él, con el largo que elijas. No hay destino.',
  'destino-largo': 'Llega al destino recorriendo aproximadamente el largo que elijas.',
};

const PROFILES: SegmentedOption<ProfileName>[] = [
  { value: 'moto-curvas', label: 'Curvas', sub: 'MOTO', icon: IconMoto },
  { value: '4x4', label: '4×4', sub: 'RIPIO Y TIERRA', icon: Icon4x4 },
  { value: 'scenic', label: 'Escénico', sub: 'CURVAS PAVIMENTADAS', icon: IconLandscape },
];

/** Importación en curso o su resultado. */
export type ImportState =
  | { kind: 'running'; startedAt: number }
  | { kind: 'done' | 'error'; text: string };

export interface SidebarProps {
  state: PlannerState;
  set: (next: PlannerState) => void;
  /** Hay un cálculo en curso: el botón queda bloqueado. */
  busy: boolean;
  hasRoute: boolean;
  /** Dato inválido que impide calcular (largo o puntos), o `null`. */
  problem: string | null;
  error: string | null;
  onTrace: () => void;
  /** Qué punto fija el próximo clic en el mapa. */
  nextClick: 'origin' | 'destination';
  importState: ImportState | null;
  onImport: () => void;
}

export function Sidebar({
  state,
  set,
  busy,
  hasRoute,
  problem,
  error,
  onTrace,
  nextClick,
  importState,
  onImport,
}: SidebarProps) {
  /** Cargar un perfil base reemplaza los dos pesos y vuelve a activarlo. */
  const pickProfile = (p: ProfileName) =>
    set({ ...state, profile: p, custom: false, weights: { ...PROFILE_WEIGHTS[p] } });

  /** Tocar un control específico desactiva el perfil: la ruta pasa a `custom`. */
  const setWeight = (patch: Partial<RouteWeights>) =>
    set({ ...state, custom: true, weights: { ...state.weights, ...patch } });

  const circuit = state.mode === 'circuito';
  const withLength = state.mode !== 'directa';
  const lengthError = withLength ? targetLengthError(state.targetLengthKm) : null;
  const pointIssue = pointsProblem(state);
  const invalid = problem != null;
  const importing = importState?.kind === 'running';

  const clickHint = circuit
    ? 'Haz clic en el mapa para fijar el punto de partida.'
    : nextClick === 'origin'
      ? 'El próximo clic en el mapa fija el punto de partida.'
      : 'El próximo clic en el mapa fija el destino.';

  const actionLabel = busy ? 'Calculando…' : hasRoute ? 'Recalcular' : traceLabel(state.mode);

  return (
    <aside
      className="scroll"
      style={{
        width: 360,
        flex: '0 0 360px',
        height: '100%',
        overflowY: 'auto',
        background: 'var(--paper)',
        borderRight: '1px solid var(--rule)',
        position: 'relative',
        zIndex: 10,
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* — masthead — */}
      <header style={{ padding: '22px 22px 18px', borderBottom: '1px solid var(--rule)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <IconCompass size={22} />
          <div style={text.displayXl}>Calculadora de rutas</div>
        </div>
        <div style={{ ...text.aside, marginTop: 2 }}>
          Rutas en auto pensadas para disfrutar el camino.
        </div>
      </header>

      {/* — 01 recorrido — */}
      <div style={sectionStyle}>
        <SectionHeader index={1} title="Recorrido" />
        <Segmented
          options={MODES}
          value={state.mode}
          onChange={(mode) => set({ ...state, mode })}
          columns={3}
        />
        <p style={{ ...text.aside, margin: '12px 0 0' }}>{MODE_NOTES[state.mode]}</p>
      </div>

      {/* — 02 puntos — */}
      <div style={sectionStyle}>
        <SectionHeader index={2} title={circuit ? 'Punto de partida' : 'Puntos'} />
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: circuit ? '1fr' : '1fr auto',
            gap: 8,
            alignItems: 'center',
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 }}>
            <WaypointField
              icon={IconPin}
              accent="var(--accent)"
              value={state.origin}
              onChange={(w) => set({ ...state, origin: w })}
              placeholder="Punto de partida"
            />
            {!circuit && (
              <WaypointField
                icon={IconFlag}
                accent="var(--terra)"
                value={state.destination}
                onChange={(w) => set({ ...state, destination: w })}
                placeholder="Destino"
              />
            )}
          </div>
          {!circuit && (
            <RoundButton
              title="Invertir partida y destino"
              onClick={() =>
                set({ ...state, origin: state.destination, destination: state.origin })
              }
            >
              <IconSwap size={14} />
            </RoundButton>
          )}
        </div>
        <p style={{ ...text.aside, margin: '10px 0 0' }}>
          {clickHint} También puedes arrastrar los marcadores.
        </p>
      </div>

      {/* — 03 largo o desvío — */}
      {withLength ? (
        <LengthSection
          value={state.targetLengthKm}
          error={lengthError}
          hint={targetLengthHint(state)}
          onChange={(targetLengthKm) => set({ ...state, targetLengthKm })}
        />
      ) : (
        <DetourSection state={state} set={set} />
      )}

      {/* — 04 perfil — */}
      <div style={sectionStyle}>
        <SectionHeader
          index={4}
          title="Perfil"
          value={state.custom ? 'Personalizado' : undefined}
        />
        <Segmented
          options={PROFILES}
          value={state.custom ? null : state.profile}
          onChange={pickProfile}
          columns={3}
        />
        <p style={{ ...text.aside, margin: '12px 0 0' }}>
          {state.custom
            ? 'Ajustaste curvas o tipo de camino: la ruta usa tus valores.'
            : 'Elige un punto de partida y afínalo con los controles de abajo.'}
        </p>
      </div>

      {/* — 05 curvas — */}
      <div style={sectionStyle}>
        <SectionHeader
          index={5}
          title="Curvas"
          value={curvesLabel(state.weights.curvinessWeight)}
        />
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ color: 'var(--ink-mute)', flex: '0 0 auto', display: 'flex' }}>
            <IconCurves size={18} />
          </span>
          <div style={{ flex: 1 }}>
            <LabeledSlider
              value={state.weights.curvinessWeight}
              onChange={(v) => setWeight({ curvinessWeight: v })}
              max={W_MAX}
              step={0.5}
              labels={['Indiferente', 'Mucho']}
              marks={5}
              ariaLabel="Cuánto buscar curvas"
            />
          </div>
        </div>
        <p style={{ ...text.aside, margin: '10px 0 0' }}>
          Cuánto evitar los tramos rectos para buscar curvas.
        </p>
      </div>

      {/* — 06 tipo de camino — */}
      <div style={sectionStyle}>
        <SectionHeader
          index={6}
          title="Tipo de camino"
          value={surfaceLabel(state.weights.surfaceWeight)}
        />
        <LabeledSlider
          value={state.weights.surfaceWeight}
          onChange={(v) => setWeight({ surfaceWeight: v })}
          min={-W_MAX}
          max={W_MAX}
          step={0.5}
          fillFrom={0}
          labels={['Ripio y tierra', 'Indiferente', 'Pavimento']}
          marks={5}
          ariaLabel="Preferencia de superficie"
        />
        <p style={{ ...text.aside, margin: '10px 0 0' }}>
          {surfaceNote(state.weights.surfaceWeight)}
        </p>
      </div>

      {/* — 07 cartografía — */}
      <div style={sectionStyle}>
        <SectionHeader index={7} title="Cartografía" />
        <p style={{ ...text.aside, margin: '0 0 10px' }}>
          El trazador sólo conoce las calles ya importadas.
        </p>
        <button
          type="button"
          onClick={onImport}
          disabled={importing}
          style={{
            ...text.bodySm,
            width: '100%',
            padding: '9px 12px',
            background: 'transparent',
            border: '1px solid var(--rule)',
            borderRadius: 2,
            color: 'var(--ink-soft)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            opacity: importing ? 0.6 : 1,
            cursor: importing ? 'wait' : 'pointer',
          }}
        >
          <IconLayers size={13} />
          {importing ? 'Importando calles…' : 'Importar área visible'}
        </button>
        {importState && (
          <ImportStatus
            key={importState.kind === 'running' ? importState.startedAt : importState.kind}
            state={importState}
          />
        )}
      </div>

      {/* — acción — */}
      <div
        style={{
          padding: '16px 22px 22px',
          marginTop: 'auto',
          position: 'sticky',
          bottom: 0,
          zIndex: 5,
          background: 'var(--paper)',
          borderTop: '1px solid var(--rule)',
        }}
      >
        <button
          type="button"
          onClick={onTrace}
          disabled={busy || invalid}
          aria-disabled={busy || invalid}
          style={{
            ...text.display,
            width: '100%',
            background: 'var(--accent)',
            color: 'var(--paper)',
            border: 'none',
            padding: '14px 16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 10,
            cursor: busy ? 'wait' : invalid ? 'not-allowed' : 'pointer',
            opacity: busy || invalid ? 0.6 : 1,
            transition: 'background .15s',
          }}
          onMouseEnter={(e) => {
            if (!busy && !invalid) e.currentTarget.style.background = 'var(--accent-deep)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'var(--accent)';
          }}
        >
          {actionLabel}
          <IconArrow size={14} />
        </button>

        {pointIssue && !busy && (
          <p style={{ ...text.body, margin: '10px 0 0', color: 'var(--ink-soft)' }}>{pointIssue}</p>
        )}

        {error && (
          <div
            role="alert"
            style={{
              ...text.body,
              marginTop: 12,
              padding: '9px 12px',
              background: 'var(--paper-3)',
              borderLeft: '3px solid var(--terra)',
              color: 'var(--ink)',
            }}
          >
            {error}
          </div>
        )}
      </div>
    </aside>
  );
}

// ── Secciones ────────────────────────────────────────────────

/** Hasta un decimal, sin ceros de relleno: 25,5 · 34,5 · 60. */
const fmtLoose = (x: number) => x.toLocaleString('es', { maximumFractionDigits: 1 });

function LengthSection({
  value,
  error,
  hint,
  onChange,
}: {
  value: string;
  error: string | null;
  /** Aviso que no impide calcular. */
  hint: string | null;
  onChange: (v: string) => void;
}) {
  const [focus, setFocus] = useState(false);
  const km = parseKm(value);
  const band =
    km != null && !error
      ? `Se acepta entre ${fmtLoose(km * (1 - TARGET_TOLERANCE))} y ${fmtLoose(km * (1 + TARGET_TOLERANCE))} km (±${Math.round(TARGET_TOLERANCE * 100)} %).`
      : null;
  return (
    <div style={sectionStyle}>
      <SectionHeader index={3} title="Largo" />
      <label
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '9px 10px',
          background: 'var(--paper-2)',
          border: `1px solid ${error ? 'var(--terra)' : focus ? 'var(--accent)' : 'var(--rule-soft)'}`,
          borderRadius: 2,
          transition: 'border-color .15s',
        }}
      >
        <span style={{ color: 'var(--ink-mute)', display: 'flex' }}>
          <IconRuler size={14} />
        </span>
        <input
          type="text"
          inputMode="decimal"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => setFocus(true)}
          onBlur={() => setFocus(false)}
          aria-label="Largo deseado en kilómetros"
          aria-invalid={error != null}
          style={{
            ...text.bodyStrong,
            flex: 1,
            minWidth: 0,
            border: 'none',
            background: 'transparent',
            color: 'var(--ink)',
          }}
        />
        <span style={{ ...text.data, color: 'var(--ink-mute)' }}>KM</span>
      </label>
      <p
        style={{
          ...(error ? text.body : text.aside),
          margin: '10px 0 0',
          color: error ? 'var(--terra)' : undefined,
        }}
      >
        {error ??
          band ??
          `Entre ${TARGET_KM_MIN} y ${TARGET_KM_MAX} km, con una tolerancia de ±${Math.round(TARGET_TOLERANCE * 100)} %.`}
      </p>
      {hint && (
        <p style={{ ...text.body, margin: '6px 0 0', color: 'var(--amber)' }}>{hint}</p>
      )}
    </div>
  );
}

/** Progreso o resultado de la importación. Tarda de medio minuto a varios minutos. */
function ImportStatus({ state }: { state: ImportState }) {
  const [elapsed, setElapsed] = useState(0);
  const startedAt = state.kind === 'running' ? state.startedAt : null;
  useEffect(() => {
    if (startedAt == null) return;
    const id = setInterval(() => setElapsed(Date.now() - startedAt), 1000);
    return () => clearInterval(id);
  }, [startedAt]);

  const style = { ...text.body, margin: '8px 0 0' };
  if (state.kind === 'running') {
    return (
      <p role="status" style={{ ...style, color: 'var(--ink-soft)' }}>
        Descargando las calles de OpenStreetMap ({Math.floor(elapsed / 1000)} s). Suele tardar entre
        medio minuto y un minuto y medio; si OpenStreetMap está saturado, varios minutos.
      </p>
    );
  }
  return (
    <p
      role={state.kind === 'error' ? 'alert' : 'status'}
      style={{ ...style, color: state.kind === 'error' ? 'var(--terra)' : 'var(--ink-soft)' }}
    >
      {state.text}
    </p>
  );
}

function DetourSection({
  state,
  set,
}: {
  state: PlannerState;
  set: (next: PlannerState) => void;
}) {
  const ratio = effectiveDetour(state);
  const isDefault = state.maxDetourRatio == null;
  return (
    <div style={sectionStyle}>
      <SectionHeader index={3} title="Desvío máximo" value={`×${fmtNum(ratio)}`} />
      <LabeledSlider
        value={ratio}
        onChange={(v) => set({ ...state, maxDetourRatio: v })}
        min={DETOUR_MIN}
        max={DETOUR_MAX}
        step={0.1}
        labels={['Lo más corta', '×2', '×3']}
        marks={5}
        ariaLabel="Desvío máximo frente a la ruta más corta"
      />
      <p style={{ ...text.aside, margin: '10px 0 0' }}>
        {ratio <= DETOUR_MIN
          ? 'La ruta no puede ser más larga que la más corta posible.'
          : `La ruta puede ser hasta un ${Math.round((ratio - 1) * 100)} % más larga que la más corta, para ganar curvas o el tipo de camino que prefieres.`}{' '}
        {isDefault ? (
          'Es el valor del perfil.'
        ) : (
          <button
            type="button"
            onClick={() => set({ ...state, maxDetourRatio: null })}
            style={{
              ...text.bodySm,
              padding: 0,
              border: 'none',
              background: 'none',
              color: 'var(--accent)',
              textDecoration: 'underline',
            }}
          >
            Volver al del perfil (×{fmtNum(defaultDetour(state))})
          </button>
        )}
      </p>
    </div>
  );
}

function RoundButton({
  title,
  onClick,
  children,
}: {
  title: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-label={title}
      style={{
        width: 30,
        height: 30,
        borderRadius: 999,
        border: '1px solid var(--rule)',
        background: 'transparent',
        color: 'var(--ink-soft)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        transition: 'all .15s',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = 'var(--ink-soft)';
        e.currentTarget.style.color = 'var(--ink)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = 'var(--rule)';
        e.currentTarget.style.color = 'var(--ink-soft)';
      }}
    >
      {children}
    </button>
  );
}
