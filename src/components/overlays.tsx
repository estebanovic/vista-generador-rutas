/** Elementos flotantes sobre el mapa: buscador, capas, paleta, carga y pista vacía. */
import { useEffect, useRef, useState } from 'react';
import { searchPlaces, type Suggestion } from '../api/geocode';
import { IconSearch } from './icons';
import type { Mode } from '../lib/types';
import type { MapLayer } from './MapView';
import { text } from './styles';

const card: React.CSSProperties = {
  position: 'absolute',
  background: 'var(--paper)',
  border: '1px solid var(--rule)',
  boxShadow: 'var(--shadow-sm)',
  borderRadius: 2,
  zIndex: 900,
};

/** Buscador de lugares: centra el mapa en el resultado elegido. */
export function SearchBox({ onPick }: { onPick: (lat: number, lon: number) => void }) {
  const [q, setQ] = useState('');
  const [items, setItems] = useState<Suggestion[]>([]);
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    const query = q.trim();
    if (query.length < 3) return;
    const ctrl = new AbortController();
    const id = setTimeout(() => {
      searchPlaces(query, ctrl.signal)
        .then((r) => {
          setItems(r);
          setOpen(true);
        })
        .catch(() => setItems([]));
    }, 450);
    return () => {
      clearTimeout(id);
      ctrl.abort();
    };
  }, [q]);

  const choose = (s: Suggestion) => {
    onPick(s.lat, s.lon);
    setOpen(false);
    setQ(s.name);
    inputRef.current?.blur();
  };

  return (
    <div style={{ ...card, top: 18, left: 20, width: 360, maxWidth: 'calc(100% - 40px)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 14px' }}>
        <span style={{ color: 'var(--ink-mute)', display: 'flex' }}>
          <IconSearch size={14} />
        </span>
        <input
          ref={inputRef}
          type="text"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onFocus={() => items.length && setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 160)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && items.length) choose(items[0]);
            if (e.key === 'Escape') setOpen(false);
          }}
          placeholder="Buscar lugar, ruta o coordenadas…"
          style={{
            ...text.body,
            flex: 1,
            minWidth: 0,
            border: 'none',
            background: 'transparent',
            color: 'var(--ink)',
          }}
        />
        <span
          style={{
            ...text.data,
            color: 'var(--ink-mute)',
            border: '1px solid var(--rule)',
            padding: '2px 6px',
          }}
        >
          ⌘K
        </span>
      </div>

      {open && items.length > 0 && q.trim().length >= 3 && (
        <ul
          className="scroll"
          style={{
            listStyle: 'none',
            margin: 0,
            padding: 0,
            borderTop: '1px solid var(--rule-soft)',
            maxHeight: 210,
            overflowY: 'auto',
          }}
        >
          {items.map((s, i) => (
            <li key={`${s.lat}-${s.lon}-${i}`}>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => choose(s)}
                style={{
                  display: 'block',
                  width: '100%',
                  textAlign: 'left',
                  padding: '7px 14px',
                  background: 'transparent',
                  border: 'none',
                  borderBottom: i < items.length - 1 ? '1px solid var(--rule-soft)' : 'none',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'var(--paper-2)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'transparent';
                }}
              >
                <span style={{ ...text.bodyStrong, display: 'block' }}>{s.name}</span>
                <span style={{ ...text.data, color: 'var(--ink-mute)' }}>{s.detail}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

const LAYERS: { value: MapLayer; label: string }[] = [
  { value: 'map', label: 'Mapa' },
  { value: 'topo', label: 'Topográfico' },
  { value: 'satellite', label: 'Satélite' },
];

export function LayerSwitch({
  value,
  onChange,
}: {
  value: MapLayer;
  onChange: (v: MapLayer) => void;
}) {
  return (
    <div style={{ ...card, top: 64, left: 20, display: 'flex' }}>
      {LAYERS.map((l, i) => {
        const sel = value === l.value;
        return (
          <button
            key={l.value}
            type="button"
            onClick={() => onChange(l.value)}
            style={{
              ...text.bodySm,
              padding: '7px 12px',
              background: sel ? 'var(--ink)' : 'transparent',
              color: sel ? 'var(--paper)' : 'var(--ink-soft)',
              border: 'none',
              borderLeft: i === 0 ? 'none' : '1px solid var(--rule-soft)',
            }}
          >
            {l.label}
          </button>
        );
      })}
    </div>
  );
}

/** Cálculo en curso: modalidad pedida, largo (si lo hay) y cuándo empezó. */
export interface ComputeJob {
  mode: Mode;
  km: number | null;
  startedAt: number;
}

/** La ruta directa tarda decenas de ms: el aviso aparece solo si se demora. */
const DIRECT_DELAY_MS = 300;

function jobTitle(job: ComputeJob): string {
  if (job.mode === 'directa' || job.km == null) return 'Trazando la ruta…';
  const km = job.km.toLocaleString('es', { maximumFractionDigits: 1 });
  return job.mode === 'circuito'
    ? `Buscando un circuito de unos ${km} km…`
    : `Buscando una ruta de unos ${km} km hasta el destino…`;
}

function jobDetail(job: ComputeJob, elapsedMs: number): string {
  if (job.mode === 'directa') return 'Consultando el trazador.';
  if (elapsedMs < 3000) return 'Se prueban muchas combinaciones de calles para acercarse al largo pedido.';
  if (elapsedMs < 8000) return 'Puede tardar hasta unos 7 segundos.';
  return 'El servidor está atendiendo otras búsquedas: la tuya está en espera.';
}

export function LoadingOverlay({ job, onCancel }: { job: ComputeJob; onCancel: () => void }) {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    const tick = () => setElapsed(Date.now() - job.startedAt);
    const id = setInterval(tick, 250);
    return () => clearInterval(id);
  }, [job.startedAt]);

  if (job.mode === 'directa' && elapsed < DIRECT_DELAY_MS) return null;
  const withLength = job.mode !== 'directa';

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'color-mix(in srgb, var(--paper) 55%, transparent)',
        backdropFilter: 'blur(2px)',
        zIndex: 950,
        pointerEvents: 'none',
      }}
    >
      <div
        role="status"
        aria-live="polite"
        style={{
          background: 'var(--paper)',
          border: '1px solid var(--rule)',
          padding: '18px 22px',
          borderRadius: 2,
          display: 'flex',
          alignItems: 'center',
          gap: 14,
          boxShadow: 'var(--shadow-md)',
          maxWidth: 440,
          pointerEvents: 'auto',
        }}
      >
        <svg width="22" height="22" viewBox="0 0 22 22" style={{ animation: 'spin 1.4s linear infinite', flexShrink: 0 }}>
          <circle cx="11" cy="11" r="8.5" fill="none" stroke="var(--rule)" strokeWidth="1.2" />
          <path
            d="M11 2.5 a8.5 8.5 0 0 1 8.5 8.5"
            fill="none"
            stroke="var(--ink-soft)"
            strokeWidth="1.6"
            strokeLinecap="round"
          />
        </svg>
        <div style={{ minWidth: 0 }}>
          <div style={text.display}>{jobTitle(job)}</div>
          <div style={{ ...text.body, color: 'var(--ink-soft)', marginTop: 6 }}>
            {jobDetail(job, elapsed)}
          </div>
        </div>
        {(withLength || elapsed >= 1000) && (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'flex-end',
              gap: 8,
              flexShrink: 0,
            }}
          >
            <span style={{ ...text.data, color: 'var(--ink-mute)' }}>
              {Math.floor(elapsed / 1000)} s
            </span>
            <button
              type="button"
              onClick={onCancel}
              style={{
                ...text.bodySm,
                padding: '5px 10px',
                background: 'transparent',
                border: '1px solid var(--rule)',
                borderRadius: 2,
                color: 'var(--ink-soft)',
              }}
            >
              Cancelar
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export function EmptyHint({ hasGraph, action }: { hasGraph: boolean; action: string }) {
  return (
    <div
      style={{
        position: 'absolute',
        left: '50%',
        bottom: 28,
        transform: 'translateX(-50%)',
        background: 'var(--paper)',
        border: '1px solid var(--rule)',
        padding: '10px 18px',
        borderRadius: 2,
        boxShadow: 'var(--shadow-sm)',
        ...text.aside,
        color: 'var(--ink-soft)',
        zIndex: 900,
        maxWidth: 'calc(100% - 80px)',
        textAlign: 'center',
      }}
    >
      {hasGraph ? (
        <>
          Configura los parámetros y pulsa{' '}
          <strong style={{ color: 'var(--ink)', fontWeight: 600 }}>{action}</strong> para
          comenzar.
        </>
      ) : (
        <>
          Encuadra una zona e{' '}
          <strong style={{ color: 'var(--ink)', fontWeight: 600 }}>impórtala</strong> antes de
          trazar: el grafo sólo conoce las calles descargadas.
        </>
      )}
    </div>
  );
}
