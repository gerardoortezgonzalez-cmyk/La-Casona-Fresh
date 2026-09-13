/* ============================================================
   PIEZAS DE UI COMPARTIDAS — Módulo de Fertilización
   Paleta y componentes base, portados de la app hermana y
   adaptados a La Casona Fresh. Verde como color principal.
   ============================================================ */
import { AlertTriangle } from 'lucide-react'
import { fmt } from './motor'

// Paleta (misma familia visual que el resto de La Casona: verde)
export const C = {
  bg: '#F6F9F4',
  panel: '#FFFFFF',
  ink: '#1F2A22',
  green900: '#14532d',
  green700: '#15803d',
  green500: '#16a34a',
  green100: '#dcfce7',
  gold: '#C9A227',
  goldSoft: '#F4E7BE',
  rust: '#B5482F',
  rustSoft: '#F3DDD6',
  amber: '#C9822D',
  amberSoft: '#F4E4CC',
  line: '#E4DFD3',
  muted: '#6B6355',
}

export const CAT_LABEL = { bajo: 'Bajo', optimo: 'Óptimo', alto: 'Alto' }
export const CAT_COLOR = { bajo: C.rust, optimo: C.green500, alto: C.amber }
export const CAT_BG = { bajo: C.rustSoft, optimo: C.green100, alto: C.amberSoft }

export function Card({ children, style, className }) {
  return (
    <div style={{ background: C.panel, border: `1px solid ${C.line}`, borderRadius: 10, ...style }} className={`p-4 sm:p-5 ${className || ''}`}>
      {children}
    </div>
  )
}

export function Eyebrow({ children }) {
  return <div className="text-xs font-bold mb-3" style={{ color: C.green500, letterSpacing: '0.1em', textTransform: 'uppercase' }}>{children}</div>
}

export function Pill({ label, cat }) {
  return <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold" style={{ background: CAT_BG[cat], color: CAT_COLOR[cat] }}>{label}</span>
}

export function NumInput({ value, onChange, step = '0.1', suffix }) {
  return (
    <div className="flex items-center gap-1">
      <input type="number" step={step} value={value} onChange={(e) => onChange(parseFloat(e.target.value) || 0)} className="w-full px-2 py-1.5 rounded border text-sm" style={{ borderColor: C.line, fontFamily: 'ui-monospace, monospace' }} />
      {suffix && <span className="text-xs" style={{ color: C.muted }}>{suffix}</span>}
    </div>
  )
}

export function RatioBox({ label, value }) {
  return (
    <div className="text-center px-2 py-3 rounded" style={{ background: C.bg }}>
      <div className="text-xs" style={{ color: C.muted }}>{label}</div>
      <div className="text-lg font-bold" style={{ color: C.ink, fontFamily: 'ui-monospace, monospace' }}>{fmt(value, 1)}</div>
      <div className="text-xs" style={{ color: C.muted }}>solo referencia</div>
    </div>
  )
}

export function SatBox({ label, value, ideal }) {
  return (
    <div className="px-2 py-2 rounded text-center" style={{ background: C.bg }}>
      <div style={{ color: C.muted }}>{label}</div>
      <div className="font-bold" style={{ fontFamily: 'ui-monospace, monospace' }}>{fmt(value, 1)}%</div>
      <div style={{ color: C.muted }}>{ideal}</div>
    </div>
  )
}

export { AlertTriangle }
