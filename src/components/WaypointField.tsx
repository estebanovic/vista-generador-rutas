/**
 * Campo de origen / destino. Escribe un nombre y resuelve coordenadas contra
 * Nominatim (o acepta «lat, lon» directamente): el backend rutea por lat/lon.
 */
import { useEffect, useState } from 'react';
import { searchPlaces, type Suggestion } from '../api/geocode';
import type { Waypoint } from '../lib/types';
import { FieldShell } from './primitives';
import { text } from './styles';
import type { IconComponent } from './icons';

export function WaypointField({
  icon,
  accent,
  placeholder,
  value,
  onChange,
}: {
  icon: IconComponent;
  accent?: string;
  placeholder: string;
  value: Waypoint;
  onChange: (w: Waypoint) => void;
}) {
  const [query, setQuery] = useState(value.name);
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [focus, setFocus] = useState(false);

  // El padre manda cuando el punto cambia desde fuera (clic en el mapa, swap):
  // se reajusta el texto en el propio render, sin efecto de por medio.
  const [syncedName, setSyncedName] = useState(value.name);
  if (syncedName !== value.name) {
    setSyncedName(value.name);
    setQuery(value.name);
  }

  useEffect(() => {
    const q = query.trim();
    // No se busca lo que ya está seleccionado (evita consultar tras elegir).
    if (q.length < 3 || q === value.name) return;
    const ctrl = new AbortController();
    // Nominatim limita a ~1 req/s: se consulta al parar de escribir.
    const id = setTimeout(() => {
      setLoading(true);
      searchPlaces(q, ctrl.signal)
        .then((res) => {
          setItems(res);
          setOpen(true);
        })
        .catch(() => setItems([]))
        .finally(() => setLoading(false));
    }, 450);
    return () => {
      clearTimeout(id);
      ctrl.abort();
    };
  }, [query, value.name]);

  const pick = (s: Suggestion) => {
    setQuery(s.name);
    setOpen(false);
    setItems([]);
    onChange({ name: s.name, lat: s.lat, lon: s.lon });
  };

  const showList = open && items.length > 0 && query.trim().length >= 3;

  return (
    <div style={{ position: 'relative' }}>
      <FieldShell icon={icon} accent={accent} focus={focus}>
        <input
          type="text"
          value={query}
          placeholder={placeholder}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => {
            setFocus(true);
            if (items.length) setOpen(true);
          }}
          onBlur={() => {
            setFocus(false);
            // Retraso para no cerrar antes de registrar el clic en la sugerencia.
            setTimeout(() => setOpen(false), 160);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && items.length) pick(items[0]);
            if (e.key === 'Escape') setOpen(false);
          }}
          style={{
            ...text.bodyStrong,
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
            whiteSpace: 'nowrap',
          }}
        >
          {loading ? '···' : `${value.lat.toFixed(3)} ${value.lon.toFixed(3)}`}
        </span>
      </FieldShell>

      {showList && (
        <ul
          style={{
            position: 'absolute',
            top: 'calc(100% + 3px)',
            left: 0,
            right: 0,
            zIndex: 40,
            margin: 0,
            padding: 0,
            listStyle: 'none',
            background: 'var(--paper)',
            border: '1px solid var(--rule)',
            borderRadius: 2,
            boxShadow: 'var(--shadow-md)',
            maxHeight: 220,
            overflowY: 'auto',
          }}
          className="scroll"
        >
          {items.map((s, i) => (
            <li key={`${s.lat}-${s.lon}-${i}`}>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => pick(s)}
                style={{
                  display: 'block',
                  width: '100%',
                  textAlign: 'left',
                  padding: '7px 10px',
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
