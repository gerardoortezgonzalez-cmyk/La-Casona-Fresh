/* ============================================================
   PESTAÑA SUELO — Fertilización
   Portada IDÉNTICA de la app hermana. Los avisos de confianza
   (🟡, citas a universidades y a Kopittke & Menzies 2007) se
   conservan tal cual — son parte de la disciplina de honestidad.
   ============================================================ */
import { fmt } from './motor'
import { C, Eyebrow, Card, Pill, NumInput, RatioBox, SatBox, CAT_LABEL, AlertTriangle } from './ui'

export default function TabSuelo({ soil, setSoil, interp, cationes }) {
  const rows = [
    ['pH', 'pH', 0.1], ['CE', 'CE (dS/m)', 0.1], ['MO', 'M.O. (%)', 0.1],
    ['N_NO3', 'N-NO₃ (ppm)', 1], ['P_disp', 'P disponible (ppm)', 1], ['K', 'K (meq/100g)', 0.01],
    ['Ca', 'Ca (meq/100g)', 0.1], ['Mg', 'Mg (meq/100g)', 0.1], ['S', 'S (ppm)', 1],
    ['Na', 'Na (meq/100g)', 0.1], ['B', 'B (ppm)', 0.1], ['Zn', 'Zn (ppm)', 0.1], ['CIC', 'CIC (meq/100g)', 0.1],
    ['Cu', 'Cu (ppm) — informativo', 0.1], ['Fe', 'Fe (ppm) — informativo', 1], ['Mn', 'Mn (ppm) — informativo', 1],
  ]
  return (
    <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
      <Card className="lg:col-span-2">
        <Eyebrow>Ingreso de análisis de laboratorio</Eyebrow>
        <div className="text-xs mb-3 px-3 py-2 rounded flex items-start gap-2" style={{ background: C.amberSoft, color: '#7A5E10' }}>
          <span>🟡</span>
          <span>
            El rango de <b>pH (5.5–7.5)</b> coincide con varias universidades de extensión agrícola (Oklahoma State,
            Cornell, Missouri, UF/IFAS). Los demás rangos (CE, MO, N-NO₃, K, Ca, Mg, S, B, Zn) son valores generales
            de hortalizas, sin una tabla única citable — no son específicos de okra. <b>Si tu laboratorio (ej. Zamorano)
            entrega sus propios rangos de referencia, usa esos en vez de los de aquí</b> — un rango local siempre es mejor
            que uno genérico importado.
          </span>
        </div>
        <div className="grid grid-cols-2 gap-3 mb-3">
          <div>
            <label className="text-xs block mb-1" style={{ color: C.muted }}>Fecha del análisis</label>
            <input type="date" value={soil.fechaAnalisis || ''} onChange={(e) => setSoil('fechaAnalisis', e.target.value)} className="w-full px-2 py-1.5 rounded border text-sm" style={{ borderColor: C.line }} />
          </div>
          <div>
            <label className="text-xs block mb-1" style={{ color: C.muted }}>Laboratorio</label>
            <input value={soil.laboratorio || ''} onChange={(e) => setSoil('laboratorio', e.target.value)} placeholder="ej. Zamorano" className="w-full px-2 py-1.5 rounded border text-sm" style={{ borderColor: C.line }} />
          </div>
        </div>
        <div className="mb-3">
          <label className="text-xs block mb-1" style={{ color: C.muted }}>Textura</label>
          <select value={soil.textura} onChange={(e) => setSoil('textura', e.target.value)} className="w-full px-2 py-1.5 rounded border text-sm" style={{ borderColor: C.line }}>
            <option value="arenosa">Arenosa</option>
            <option value="franco-arenosa">Franco-arenosa</option>
            <option value="franca">Franca</option>
            <option value="franco-arcillosa">Franco-arcillosa</option>
            <option value="arcillosa">Arcillosa</option>
          </select>
        </div>
        <div className="mb-3">
          <label className="text-xs block mb-1" style={{ color: C.muted }}>Método de P</label>
          <select value={soil.metodoP} onChange={(e) => setSoil('metodoP', e.target.value)} className="w-full px-2 py-1.5 rounded border text-sm" style={{ borderColor: C.line }}>
            <option value="olsen">Olsen</option>
            <option value="bray">Bray-1</option>
            <option value="mehlich3">Mehlich 3</option>
          </select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {rows.map(([field, label, step]) => (
            <div key={field}>
              <label className="text-xs block mb-1" style={{ color: C.muted }}>{label}</label>
              <NumInput value={soil[field]} onChange={(v) => setSoil(field, v)} step={step} />
            </div>
          ))}
        </div>
      </Card>

      <Card className="lg:col-span-3">
        <Eyebrow>Diagnóstico interpretado</Eyebrow>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-5">
          {Object.entries(interp).map(([k, cat]) => (
            <div key={k} className="flex items-center justify-between px-2 py-2 rounded" style={{ background: C.bg }}>
              <span className="text-xs font-medium">{k.replace('_', '-')}</span>
              <Pill label={CAT_LABEL[cat]} cat={cat} />
            </div>
          ))}
        </div>

        <Eyebrow>Relaciones catiónicas — solo referencia (no es un criterio diagnóstico validado)</Eyebrow>
        <p className="text-xs mb-2" style={{ color: C.muted }}>
          La investigación (Kopittke &amp; Menzies 2007; Iowa State; Kansas State) encontró evidencia consistente de que
          las relaciones Ca/Mg/K fijas <b>no predicen rendimiento ni fertilidad</b> — el cultivo rinde igual con relaciones
          muy distintas, siempre que cada nutriente esté en nivel suficiente. Se muestran aquí solo como dato, no como
          semáforo de decisión. Usa el <b>% de saturación</b> de abajo (sí validado) para decidir.
        </p>
        <div className="grid grid-cols-3 gap-3 mb-3">
          <RatioBox label="Ca/Mg" value={cationes.caMg} />
          <RatioBox label="Mg/K" value={cationes.mgK} />
          <RatioBox label="Ca/K" value={cationes.caK} />
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4 text-xs">
          <SatBox label="%Sat Ca" value={cationes.satCa} ideal="60–75%" />
          <SatBox label="%Sat Mg" value={cationes.satMg} ideal="10–18%" />
          <SatBox label="%Sat K" value={cationes.satK} ideal="3–6%" />
          <SatBox label="%Sat Na" value={cationes.satNa} ideal="< 15%" />
        </div>

        {cationes.alertas.length > 0 && (
          <div>
            <Eyebrow>Alertas edáficas</Eyebrow>
            <div className="flex flex-col gap-2">
              {cationes.alertas.map((a, i) => (
                <div key={i} className="text-sm px-3 py-2 rounded flex gap-2" style={{ background: C.amberSoft, color: '#5A4118' }}>
                  <AlertTriangle size={16} className="shrink-0 mt-0.5" /> {a}
                </div>
              ))}
            </div>
          </div>
        )}
      </Card>
    </div>
  )
}
