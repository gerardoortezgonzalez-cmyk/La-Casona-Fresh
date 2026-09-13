/* ============================================================
   FERTILIZACIÓN — Contenedor principal
   Carga la config del lote (JSONB) desde Supabase, corre el
   motor (deriveLotData) y muestra las pestañas. Empieza con
   Suelo; las demás se irán sumando.
   ============================================================ */
import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'
import {
  deriveLotData,
  DEFAULT_EXTRACCION, DEFAULT_DISTRIBUCION, DEFAULT_APORTE_FACTOR,
  DEFAULT_DURACION, DEFAULT_FRECUENCIA, DEFAULT_REMOCION, DEFAULT_FRECUENCIA_MONITOREO,
} from '../fertilizacion/motor'
import { C } from '../fertilizacion/ui'
import TabSuelo from '../fertilizacion/TabSuelo'

// Config por defecto de un lote nuevo de fertilización (okra)
function configPorDefecto() {
  return {
    soil: {
      pH: 6.2, CE: 0.8, MO: 2.0, N_NO3: 8, P_disp: 12, K: 0.25, Ca: 3.5, Mg: 0.9,
      S: 8, Na: 0.2, B: 0.3, Zn: 1.0, CIC: 12, Cu: 0.5, Fe: 20, Mn: 10,
      metodoP: 'olsen', textura: 'franca', fechaAnalisis: '', laboratorio: '',
    },
    extraccion: { ...DEFAULT_EXTRACCION },
    distribucion: JSON.parse(JSON.stringify(DEFAULT_DISTRIBUCION)),
    aporteFactor: { ...DEFAULT_APORTE_FACTOR },
    seleccion: {},
    ajustePct: {},
    duracion: { ...DEFAULT_DURACION },
    frecuencia: { ...DEFAULT_FRECUENCIA },
    foliarCfg: { frecuencia: 10, costoPorAplicacion: 150 },
    semanasRiego: {},
    remocion: { ...DEFAULT_REMOCION },
    frecuenciaMonitoreo: { ...DEFAULT_FRECUENCIA_MONITOREO },
    baseEmplasticado: { productos: [], descontarDeFertirriego: false },
    encalado: { satObjetivo: 80, prnt: 90, costoLb: 0.15 },
    cumplimientoFert: {},
    cumplimientoFoliar: {},
    cumplimientoMonitoreo: {},
    pesoPromedioCaja: 25,
  }
}

const TABS = [
  { id: 'suelo', label: 'Suelo' },
  // Las demás pestañas se sumarán aquí: plan, foliar, riego, remocion, base, costo, alertas
]

export default function Fertilizacion() {
  const { esAdmin } = useAuth()
  const [lotes, setLotes] = useState([])
  const [loteId, setLoteId] = useState('')
  const [config, setConfig] = useState(null)
  const [fertilizantes, setFertilizantes] = useState([])
  const [cargando, setCargando] = useState(true)
  const [guardando, setGuardando] = useState(false)
  const [mensaje, setMensaje] = useState('')
  const [tab, setTab] = useState('suelo')
  const [registroId, setRegistroId] = useState(null)

  // Cargar lotes y fertilizantes al inicio
  useEffect(() => {
    (async () => {
      const [lot, fert] = await Promise.all([
        supabase.from('lotes').select('id, nombre, area_manzanas, cultivo, variedad, fecha_siembra').eq('activo', true).order('nombre'),
        supabase.from('fertilizantes').select('*').order('orden'),
      ])
      setLotes(lot.data || [])
      // mapear fertilizantes al formato del motor (_id, mayúsculas de nutrientes)
      const fmapped = (fert.data || []).map((f) => ({
        _id: f.id, nombre: f.nombre, comercial: f.comercial,
        N: f.n, P2O5: f.p2o5, K2O: f.k2o, CaO: f.cao, MgO: f.mgo, S: f.s,
        B: f.b, Zn: f.zn, Fe: f.fe, Mn: f.mn, Cu: f.cu, Mo: f.mo, Si: f.si,
        costo: f.costo, presentacionLb: f.presentacion_lb, existenciaLb: f.existencia_lb,
        disponible: f.disponible,
      }))
      setFertilizantes(fmapped)
      if (lot.data && lot.data.length) setLoteId(lot.data[0].id)
      setCargando(false)
    })()
  }, [])

  // Cargar la config del lote seleccionado
  useEffect(() => {
    if (!loteId) return
    (async () => {
      setMensaje('')
      const { data, error } = await supabase
        .from('fertilizacion_lotes')
        .select('id, config')
        .eq('lote_id', loteId)
        .maybeSingle()
      if (error) { setMensaje('Error cargando configuración: ' + error.message); return }
      if (data) {
        setRegistroId(data.id)
        // merge con defaults por si faltan claves nuevas
        setConfig({ ...configPorDefecto(), ...data.config })
      } else {
        setRegistroId(null)
        setConfig(configPorDefecto())
      }
    })()
  }, [loteId])

  const loteActual = lotes.find((l) => l.id === loteId)

  // Objeto lote que el motor espera (config + datos del lote real)
  const loteParaMotor = useMemo(() => {
    if (!config || !loteActual) return null
    return {
      ...config,
      areaMz: Number(loteActual.area_manzanas) || 0,
      fechaSiembra: loteActual.fecha_siembra || null,
      cosechaRegistros: [], // se conectará al módulo de cosecha en una fase posterior
    }
  }, [config, loteActual])

  const datos = useMemo(() => {
    if (!loteParaMotor) return null
    try {
      return deriveLotData(loteParaMotor, fertilizantes)
    } catch (e) {
      console.error('Error en deriveLotData:', e)
      return null
    }
  }, [loteParaMotor, fertilizantes])

  // Setter para campos del suelo
  function setSoilField(campo, valor) {
    setConfig((c) => ({ ...c, soil: { ...c.soil, [campo]: valor } }))
  }

  async function guardar() {
    if (!esAdmin) return
    setGuardando(true)
    setMensaje('')
    const payload = {
      lote_id: loteId,
      cultivo: loteActual?.cultivo || 'okra',
      config,
      actualizado_en: new Date().toISOString(),
    }
    let error
    if (registroId) {
      ({ error } = await supabase.from('fertilizacion_lotes').update(payload).eq('id', registroId))
    } else {
      const res = await supabase.from('fertilizacion_lotes').insert(payload).select('id').single()
      error = res.error
      if (res.data) setRegistroId(res.data.id)
    }
    setGuardando(false)
    setMensaje(error ? 'No se pudo guardar: ' + error.message : 'Configuración guardada.')
  }

  if (cargando) return <p className="text-gray-500">Cargando…</p>
  if (lotes.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-gray-500">
        No hay lotes. Creá un lote primero para configurar su fertilización.
      </div>
    )
  }

  return (
    <div>
      {/* Selector de lote + guardar */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-600">Lote:</label>
          <select value={loteId} onChange={(e) => setLoteId(e.target.value)}
            className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-400">
            {lotes.map((l) => <option key={l.id} value={l.id}>{l.nombre}</option>)}
          </select>
          {loteActual && (
            <span className="text-xs text-gray-400">
              {Number(loteActual.area_manzanas).toFixed(1)} mz · {loteActual.cultivo}
              {loteActual.fecha_siembra ? ` · siembra ${loteActual.fecha_siembra}` : ' · sin fecha de siembra'}
            </span>
          )}
        </div>
        {esAdmin && (
          <button onClick={guardar} disabled={guardando}
            className="bg-green-600 hover:bg-green-700 disabled:opacity-60 text-white text-sm font-medium px-4 py-2 rounded-lg">
            {guardando ? 'Guardando…' : 'Guardar configuración'}
          </button>
        )}
      </div>

      {mensaje && (
        <p className="text-sm mb-3 px-3 py-2 rounded-lg" style={{ background: mensaje.includes('No se') || mensaje.includes('Error') ? '#FEE2E2' : C.green100, color: mensaje.includes('No se') || mensaje.includes('Error') ? '#B91C1C' : C.green700 }}>
          {mensaje}
        </p>
      )}

      {/* Pestañas */}
      <nav className="flex gap-1 mb-5 border-b border-gray-200 overflow-x-auto">
        {TABS.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px whitespace-nowrap ${tab === t.id ? 'border-green-600 text-green-700' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
            {t.label}
          </button>
        ))}
      </nav>

      {/* Contenido */}
      {!config || !datos ? (
        <p className="text-gray-500">Preparando datos del lote…</p>
      ) : (
        <>
          {tab === 'suelo' && (
            <TabSuelo soil={config.soil} setSoil={setSoilField} interp={datos.interp} cationes={datos.cationes} />
          )}
        </>
      )}

      {!esAdmin && (
        <p className="text-xs text-gray-400 mt-4">
          Estás viendo el plan en modo lectura. Solo el administrador puede editar la configuración.
        </p>
      )}
    </div>
  )
}
