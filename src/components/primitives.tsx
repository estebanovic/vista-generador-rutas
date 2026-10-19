/** Primitivas de la retícula editorial: cabeceras, selectores, sliders, barras. */
import type { CSSProperties, ReactNode } from 'react';
import type { IconComponent } from './icons';
import { text } from './styles';

export function SectionHeader({
  index,
  title,
  value,
}: {
  index: number;
  title: string;
  value?: string;
}) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'baseline',
        justifyContent: 'space-between',
        marginBottom: 14,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
        <span style={{ ...text.data, color: 'var(--ink-mute)' }}>
          {String(index).padStart(2, '0')}
        </span>
        <h3 style={{ ...text.display, margin: 0 }}>{title}</h3>
      </div>
      {value && <span style={{ ...text.eyebrow, color: 'var(--ink-soft)' }}>{value}</span>}
    </div>
  );
}

export interface SegmentedOption<T extends string> {
  value: T;
  label: string;
  sub?: string;
  icon?: IconComponent;
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  columns = 2,
}: {
  options: SegmentedOption<T>[];
  /** `null` = ninguna opción activa. */
  value: T | null;
  onChange: (v: T) => void;
  columns?: number;
}) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${columns}, 1fr)`,
        gap: 6,
      }}
    >
      {options.map((opt) => {
        const sel = value === opt.value;
        const Ico = opt.icon;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            style={{
              ...text.bodySm,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'flex-start',
              gap: 4,
              padding: '10px 10px 8px',
              background: sel ? 'var(--accent)' : 'transparent',
              color: sel ? 'var(--paper)' : 'var(--ink-soft)',
              border: `1px solid ${sel ? 'var(--accent)' : 'var(--rule)'}`,
              borderRadius: 2,
              transition: 'all .18s ease',
              minHeight: 56,
              textAlign: 'left',
            }}
            onMouseEnter={(e) => {
              if (!sel) e.currentTarget.style.borderColor = 'var(--ink-soft)';
            }}
            onMouseLeave={(e) => {
              if (!sel) e.currentTarget.style.borderColor = 'var(--rule)';
            }}
          >
            {Ico ? <Ico size={18} /> : null}
            <span>{opt.label}</span>
            {opt.sub && (
              <span
                style={{
                  ...text.eyebrow,
                  color: sel ? 'var(--paper-2)' : 'var(--ink-mute)',
                  opacity: sel ? 0.8 : 1,
                }}
              >
                {opt.sub}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

export function PillRow<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
      {options.map((opt) => {
        const sel = value === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            style={{
              ...text.bodySm,
              padding: '5px 11px',
              background: sel ? 'var(--ink)' : 'transparent',
              color: sel ? 'var(--paper)' : 'var(--ink-soft)',
              border: `1px solid ${sel ? 'var(--ink)' : 'var(--rule)'}`,
              borderRadius: 999,
              transition: 'all .15s ease',
            }}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

export function LabeledSlider({
  value,
  onChange,
  min = 0,
  max = 100,
  step = 1,
  labels,
  marks,
  fillFrom = min,
  ariaLabel,
}: {
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
  labels?: string[];
  marks?: number;
  /** Valor desde el que se pinta el relleno (el centro en una escala con signo). */
  fillFrom?: number;
  ariaLabel?: string;
}) {
  const at = (v: number) => ((v - min) / (max - min)) * 100;
  const left = Math.min(at(fillFrom), at(value));
  const width = Math.abs(at(value) - at(fillFrom));
  return (
    <div>
      <div style={{ position: 'relative', height: 22 }}>
        {marks ? (
          <div
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              top: 10,
              display: 'flex',
              justifyContent: 'space-between',
              pointerEvents: 'none',
            }}
          >
            {Array.from({ length: marks }, (_, i) => (
              <div
                key={i}
                style={{ width: 1, height: 6, background: 'var(--rule)', opacity: 0.7 }}
              />
            ))}
          </div>
        ) : null}
        <div
          style={{
            position: 'absolute',
            left: `${left}%`,
            top: 10,
            height: 2,
            width: `${width}%`,
            background: 'var(--accent)',
            pointerEvents: 'none',
            zIndex: 1,
          }}
        />
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          aria-label={ariaLabel}
          onChange={(e) => onChange(Number(e.target.value))}
          style={{ position: 'relative', zIndex: 2 }}
        />
      </div>
      {labels && (
        <div
          style={{
            ...text.eyebrow,
            display: 'flex',
            justifyContent: 'space-between',
            marginTop: 4,
          }}
        >
          {labels.map((l) => (
            <span key={l}>{l}</span>
          ))}
        </div>
      )}
    </div>
  );
}

export function FieldShell({
  icon: Ico,
  accent,
  children,
  focus,
}: {
  icon: IconComponent;
  accent?: string;
  children: ReactNode;
  focus: boolean;
}) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '9px 10px',
        background: 'var(--paper-2)',
        border: `1px solid ${focus ? 'var(--accent)' : 'var(--rule-soft)'}`,
        borderRadius: 2,
        transition: 'border-color .15s',
      }}
    >
      <span style={{ color: accent ?? 'var(--ink-mute)', display: 'flex' }}>
        <Ico size={14} />
      </span>
      {children}
    </div>
  );
}

/** Barra de reparto (tipo de vía / superficie). */
export function BreakdownBar({
  label,
  share,
  valueLabel,
  color,
}: {
  label: string;
  /** Fracción 0..1. */
  share: number;
  valueLabel: string;
  color: string;
}) {
  const labelStyle: CSSProperties = {
    ...text.caption,
    width: 82,
    flexShrink: 0,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  };
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '3px 0' }}>
      <span style={labelStyle}>{label}</span>
      <div
        style={{
          flex: 1,
          height: 5,
          background: 'var(--rule-soft)',
          borderRadius: 1,
          overflow: 'hidden',
        }}
      >
        <div style={{ width: `${share * 100}%`, height: '100%', background: color }} />
      </div>
      <span style={{ ...text.data, width: 40, textAlign: 'right', color: 'var(--ink-soft)' }}>
        {valueLabel}
      </span>
    </div>
  );
}
