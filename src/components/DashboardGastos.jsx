import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'

function L(n) {
  return 'L ' + Number(n || 0).toLocaleString('es-HN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function primerDiaMes() {
  const d = new Date()
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10)
}
function hoyISO() {
  return new Date().toISOString().slice(0, 10)
}

// Costo total de una tanda de empaque
function costoEmpaque(e) {
  const maquila =
    Number(e.cajas_4kg || 0) * Number(e.costo_maquila_4kg || 0) +
    Number(e.cajas_5kg || 0) * Number(e.costo_maquila_5kg || 0) +
    Number(e.cajas_7kg || 0) * Number(e.costo_maquila_7kg || 0)
  return maquila + Number(e.costo_materiales || 0) + Number(e.costo_mano_obra || 0)
}

const COLOR_FUENTE = {
  'Costos operativos': '#16a34a',
  'Empaque': '#0891b2',
  'Mecanización': '#d97706',
}

export default function DashboardGastos() {
  const [desde, setDesde] = useState(primerDiaMes())
  const [hasta, setHasta] = useState(hoyISO())
  const [cargando, setCargando] = useState(true)
  const [mensaje, setMensaje] = useState('')

  const [costos, setCostos] = useState([])
  const [empaques, setEmpaques] = useState([])
  const [mecanizacion, setMecanizacion] = useState([])

  async function cargar() {
    setCargando(true)
    setMensaje('')
    try {
      // 1) Costos manuales con su categoría
      const { data: dCostos, error: e1 } = await supabase
        .from('costos')
        .select('monto, fecha, categorias_costo(nombre)')
        .gte('fecha', desde).lte('fecha', hasta)
      if (e1) throw e1

      // 2) Empaque
      const { data: dEmp, error: e2 } = await supabase
        .from('empaques')
        .select('*')
        .gte('fecha', desde).lte('fecha', hasta)
      if (e2) throw e2

      // 3) Mecanización: líneas unidas a su factura para filtrar por fecha
      const { data: dMec, error: e3 } = await supabase
        .from('mecanizacion_facturas')
        .select('fecha, mecanizacion_lineas(valor)')
        .gte('fecha', desde).lte('fecha', hasta)
      if (e3) throw e3

      setCostos(dCostos || [])
      setEmpaques(dEmp || [])
      setMecanizacion(dMec || [])
    } catch (e) {
      setMensaje('Error cargando datos: ' + e.message)
    } finally {
      setCargando(false)
    }
  }

  useEffect(() => { cargar() }, [desde, hasta])

  // ---- Totales por fuente ----
  const totalCostos = costos.reduce((s, c) => s + Number(c.monto), 0)
  const totalEmpaque = empaques.reduce((s, e) => s + costoEmpaque(e), 0)
  const totalMecanizacion = mecanizacion.reduce(
    (s, f) => s + (f.mecanizacion_lineas || []).reduce((ss, l) => ss + Number(l.valor || 0), 0), 0
  )
  const totalGeneral = totalCostos + totalEmpaque + totalMecanizacion

  // ---- Desglose de costos manuales por categoría ----
  const porCategoria = {}
  for (const c of costos) {
    const nombre = c.categorias_costo?.nombre || 'Sin categoría'
    porCategoria[nombre] = (porCategoria[nombre] || 0) + Number(c.monto)
  }
  const categoriasOrdenadas = Object.entries(porCategoria).sort((a, b) => b[1] - a[1])

  const datosGrafico = [
    { fuente: 'Costos operativos', total: totalCostos },
    { fuente: 'Empaque', total: totalEmpaque },
    { fuente: 'Mecanización', total: totalMecanizacion },
  ].filter((d) => d.total > 0)

  function pct(v) {
    return totalGeneral > 0 ? ((v / totalGeneral) * 100).toFixed(1) + '%' : '—'
  }

  return (
    <div>
      <h2 className="text-xl font-semibold text-gray-800 mb-4">Dashboard de gastos</h2>

      {/* Filtro de fechas */}
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-600">Desde</label>
          <input type="date" value={desde} max={hasta} onChange={(e) => setDesde(e.target.value)}
            className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-400" />
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-600">Hasta</label>
          <input type="date" value={hasta} min={desde} max={hoyISO()} onChange={(e) => setHasta(e.target.value)}
            className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-400" />
        </div>
      </div>

      {mensaje && (
        <p className="text-sm mb-4 px-3 py-2 rounded-lg bg-red-50 text-red-700">{mensaje}</p>
      )}

      {cargando ? (
        <p className="text-gray-500">Cargando…</p>
      ) : (
        <>
          {/* Total general destacado */}
          <div className="bg-gradient-to-br from-green-600 to-green-700 rounded-2xl p-6 text-white mb-6">
            <p className="text-green-100 text-sm">Gasto total del período</p>
            <p className="text-4xl font-bold mt-1">{L(totalGeneral)}</p>
          </div>

          {/* Tarjetas por fuente */}
          <div className="grid gap-4 sm:grid-cols-3 mb-6">
            {[
              ['Costos operativos', totalCostos],
              ['Empaque', totalEmpaque],
              ['Mecanización', totalMecanizacion],
            ].map(([nombre, valor]) => (
              <div key={nombre} className="bg-white rounded-xl border border-gray-200 p-4">
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full" style={{ background: COLOR_FUENTE[nombre] }} />
                  <p className="text-sm text-gray-600">{nombre}</p>
                </div>
                <p className="text-2xl font-bold text-gray-800 mt-1">{L(valor)}</p>
                <p className="text-xs text-gray-400 mt-0.5">{pct(valor)} del total</p>
              </div>
            ))}
          </div>

          {/* Gráfico */}
          {datosGrafico.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 p-4 mb-6">
              <p className="text-sm font-semibold text-gray-700 mb-3">Comparación por fuente</p>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={datosGrafico} layout="vertical" margin={{ left: 20, right: 40 }}>
                  <XAxis type="number" tickFormatter={(v) => 'L' + (v / 1000).toFixed(0) + 'k'} tick={{ fontSize: 12 }} />
                  <YAxis type="category" dataKey="fuente" width={110} tick={{ fontSize: 12 }} />
                  <Tooltip formatter={(v) => L(v)} />
                  <Bar dataKey="total" radius={[0, 6, 6, 0]}>
                    {datosGrafico.map((d) => (
                      <Cell key={d.fuente} fill={COLOR_FUENTE[d.fuente]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Detalle de costos operativos por categoría */}
          {categoriasOrdenadas.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden mb-6">
              <div className="px-4 py-3 border-b border-gray-100">
                <p className="text-sm font-semibold text-gray-700">Costos operativos por categoría</p>
              </div>
              <table className="w-full text-sm">
                <tbody>
                  {categoriasOrdenadas.map(([nombre, valor]) => (
                    <tr key={nombre} className="border-t border-gray-100 first:border-t-0">
                      <td className="px-4 py-2.5 text-gray-700">{nombre}</td>
                      <td className="px-4 py-2.5 text-right font-medium">{L(valor)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {totalGeneral === 0 && (
            <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-gray-500 mb-6">
              No hay gastos registrados en este período.
            </div>
          )}

          {/* Nota de auditoría — qué fuentes están sumadas */}
          <div className="text-xs text-gray-500 bg-gray-50 border border-gray-200 rounded-lg px-4 py-3">
            <strong className="text-gray-600">Fuentes incluidas en este total:</strong> Costos
            operativos (manuales), Empaque/Maquila y Mecanización contratada. Si en el futuro se
            agrega una fuente de gasto nueva (ej. nómina o insumos con su propio módulo), debe
            sumarse también aquí para que el total siga siendo completo.
          </div>
        </>
      )}
    </div>
  )
}
