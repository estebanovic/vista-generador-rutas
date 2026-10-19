/** Panel izquierdo: perfil, parámetros, importación de la zona y cálculo. */
import {
  closestOption,
  PROFILE_WEIGHTS,
  SURFACE_NOTES,
  SURFACE_OPTIONS,
  twistinessLabel,
  W_MAX,
} from '../lib/planner';
import type { Phase, PlannerState, ProfileName, RouteWeights } from '../lib/types';
import {
  Icon4x4,
  IconArrow,
  IconCompass,
  IconCurves,
  IconFlag,
  IconLandscape,
  IconLayers,
  IconMoto,
  IconPin,
  IconSwap,
} from './icons';
import {
  LabeledSlider,
  PillRow,
  SectionHeader,
  Segmented,
  type SegmentedOption,
} from './primitives';
import { sectionStyle, text } from './styles';
import { WaypointField } from './WaypointField';

const PROFILES: SegmentedOption<ProfileName>[] = [
  { value: 'moto-curvas', label: 'Curvas', sub: 'MOTO', icon: IconMoto },
  { value: '4x4', label: '4×4', sub: 'RURAL', icon: Icon4x4 },
  { value: 'scenic', label: 'Escénico', sub: 'PANORÁMICO', icon: IconLandscape },
];

export interface SidebarProps {
  state: PlannerState;
  set: (next: PlannerState) => void;
  phase: Phase;
  error: string | null;
  onTrace: () => void;
  importing: boolean;
  importStatus: string | null;
  onImport: () => void;
}

export function Sidebar({
  state,
  set,
  phase,
  error,
  onTrace,
  importing,
  importStatus,
  onImport,
}: SidebarProps) {
  /** Cargar un perfil base reemplaza los dos pesos y vuelve a activarlo. */
  const pickProfile = (p: ProfileName) =>
    set({ ...state, profile: p, custom: false, weights: { ...PROFILE_WEIGHTS[p] } });

  /** Tocar un control específico desactiva el perfil: la ruta pasa a `custom`. */
  const setWeight = (patch: Partial<RouteWeights>) =>
    set({ ...state, custom: true, weights: { ...state.weights, ...patch } });

  const surfaceValue = closestOption(SURFACE_OPTIONS, state.weights.surfaceWeight);
  const surfaceLabel = SURFACE_OPTIONS.find((o) => o.value === surfaceValue)!.label;

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
      }}
    >
      {/* — masthead — */}
      <header style={{ padding: '22px 22px 18px', borderBottom: '1px solid var(--rule)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <IconCompass size={22} />
          <div style={text.displayXl}>Calculadora de rutas</div>
        </div>
        <div style={{ ...text.aside, marginTop: 2 }}>Planifica rutas a tu medida.</div>
      </header>

      {/* — trayecto — */}
      <div style={sectionStyle}>
        <div style={{ ...text.eyebrow, marginBottom: 10 }}>El trayecto</div>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr auto',
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
            <WaypointField
              icon={IconFlag}
              accent="var(--terra)"
              value={state.destination}
              onChange={(w) => set({ ...state, destination: w })}
              placeholder="Destino"
            />
          </div>
          <button
            type="button"
            onClick={() =>
              set({ ...state, origin: state.destination, destination: state.origin })
            }
            title="Invertir origen y destino"
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
            <IconSwap size={14} />
          </button>
        </div>
        <p style={{ ...text.aside, margin: '10px 0 0' }}>
          O fija los puntos haciendo clic en el mapa.
        </p>
      </div>

      {/* — 01 perfil — */}
      <div style={sectionStyle}>
        <SectionHeader
          index={1}
          title="Perfil"
          value={state.custom ? 'Personalizado' : undefined}
        />
        <Segmented
          options={PROFILES}
          value={state.custom ? null : state.profile}
          onChange={pickProfile}
          columns={3}
        />
      </div>

      {/* — 02 curvas — */}
      <div style={sectionStyle}>
        <SectionHeader
          index={2}
          title="Curvas"
          value={twistinessLabel(state.weights.curvinessWeight)}
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
              labels={['Recta', 'Sinuosa', 'Caracol']}
              marks={5}
            />
          </div>
        </div>
      </div>

      {/* — 03 tipo de camino — */}
      <div style={sectionStyle}>
        <SectionHeader index={3} title="Tipo de camino" />
        <PillRow
          options={SURFACE_OPTIONS.map((o) => ({ value: String(o.value), label: o.label }))}
          value={String(surfaceValue)}
          onChange={(v) => setWeight({ surfaceWeight: Number(v) })}
        />
        <p style={{ ...text.aside, margin: '12px 0 0' }}>{SURFACE_NOTES[surfaceLabel]}</p>
      </div>

      {/* — 04 cartografía — */}
      <div style={sectionStyle}>
        <SectionHeader index={4} title="Cartografía" />
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
        {importStatus && (
          <div style={{ ...text.data, marginTop: 8, color: 'var(--ink-mute)' }}>
            {importStatus}
          </div>
        )}
      </div>

      {/* — acción — */}
      <div style={{ padding: '20px 22px 28px' }}>
        <button
          type="button"
          onClick={onTrace}
          disabled={phase === 'computing'}
          style={{
            ...text.display,
            width: '100%',
            background: phase === 'ready' ? 'var(--accent-deep)' : 'var(--accent)',
            color: 'var(--paper)',
            border: 'none',
            padding: '14px 16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 10,
            cursor: phase === 'computing' ? 'wait' : 'pointer',
            opacity: phase === 'computing' ? 0.7 : 1,
            transition: 'background .15s',
          }}
          onMouseEnter={(e) => {
            if (phase !== 'computing') e.currentTarget.style.background = 'var(--accent-deep)';
          }}
          onMouseLeave={(e) => {
            if (phase !== 'computing') {
              e.currentTarget.style.background =
                phase === 'ready' ? 'var(--accent-deep)' : 'var(--accent)';
            }
          }}
        >
          {phase === 'computing'
            ? 'Trazando…'
            : phase === 'ready'
              ? 'Recalcular ruta'
              : 'Trazar la ruta'}
          <IconArrow size={14} />
        </button>

        {error && (
          <div
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
