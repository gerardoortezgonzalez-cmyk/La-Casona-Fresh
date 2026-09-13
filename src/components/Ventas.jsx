import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'

function hoyISO() {
  return new Date().toISOString().slice(0, 10)
}
function primerDiaMes() {
  const d = new Date()
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10)
}
function L(n) {
  return 'L ' + Number(n || 0).toLocaleString('es-HN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function ingresoVenta(v) {
  return Number(v.cajas_4kg || 0) * Number(v.precio_4kg || 0) +
         Number(v.cajas_5kg || 0) * Number(v.precio_5kg || 0) +
         Number(v.cajas_7kg || 0) * Number(v.precio_7kg || 0)
}
function costoEmpaque(e) {
  const maquila =
    Number(e.cajas_4kg || 0) * Number(e.costo_maquila_4kg || 0) +
    Number(e.cajas_5kg || 0) * Number(e.costo_maquila_5kg || 0) +
    Number(e.cajas_7kg || 0) * Number(e.costo_maquila_7kg || 0)
  return maquila + Number(e.costo_materiales || 0) + Number(e.costo_mano_obra || 0)
}

const VENTA_VACIA = {
  fecha: hoyISO(), comprador_id: '', lote_id: '',
  cajas_4kg: '', cajas_5kg: '', cajas_7kg: '',
  precio_4kg: '', precio_5kg: '', precio_7kg: '',
  notas: '',
}

export default function Ventas() {
  const { usuario, esAdmin } = useAuth()
  const [subvista, setSubvista] = useState('pyl') // pyl | ventas | compradores
  const [compradores, setCompradores] = useState([])
  const [lotes, setLotes] = useState([])
  const [ventas, setVentas] = useState([])
  const [cargando, setCargando] = useState(true)
  const [mensaje, setMensaje] = useState('')

  const [desde, setDesde] = useState(primerDiaMes())
  const [hasta, setHasta] = useState(hoyISO())

  // Costos del período (para P&L)
  const [costosPeriodo, setCostosPeriodo] = useState({ costos: 0, empaque: 0, mecanizacion: 0, nomina: 0 })

  // Modal venta
  const [modalVenta, setModalVenta] = useState(false)
  const [editVenta, setEditVenta] = useState(null)
  const [formVenta, setFormVenta] = useState(VENTA_VACIA)
  const [guardando, setGuardando] = useState(false)

  // Modal comprador
  const [modalComp, setModalComp] = useState(false)
  const [editComp, setEditComp] = useState(null)
  const [formComp, setFormComp] = useState({ nombre: '', modelo: 'fijo', precio_4kg: '', precio_5kg: '', precio_7kg: '' })

  async function cargarBase() {
    const [comp, lot] = await Promise.all([
      supabase.from('compradores').select('*').eq('activo', true).order('nombre'),
      supabase.from('lotes').select('id, nombre').eq('activo', true).order('nombre'),
    ])
    setCompradores(comp.data || [])
    setLotes(lot.data || [])
  }

  async function cargarVentasYCostos() {
    setCargando(true)
    try {
      const { data: dVentas, error: eV } = await supabase
        .from('ventas')
        .select('*, compradores(nombre, modelo), lotes(nombre)')
        .gte('fecha', desde).lte('fecha', hasta)
        .order('fecha', { ascending: false })
      if (eV) throw eV
      setVentas(dVentas || [])

      // Costos del período (mismas fuentes que el dashboard)
      const [c, e, m, n] = await Promise.all([
        supabase.from('costos').select('monto').gte('fecha', desde).lte('fecha', hasta),
        supabase.from('empaques').select('*').gte('fecha', desde).lte('fecha', hasta),
        supabase.from('mecanizacion_facturas').select('fecha, mecanizacion_lineas(valor)').gte('fecha', desde).lte('fecha', hasta),
        supabase.from('jornales').select('valor').gte('fecha', desde).lte('fecha', hasta),
      ])
      const totalCostos = (c.data || []).reduce((s, x) => s + Number(x.monto), 0)
      const totalEmpaque = (e.data || []).reduce((s, x) => s + costoEmpaque(x), 0)
      const totalMec = (m.data || []).reduce((s, f) => s + (f.mecanizacion_lineas || []).reduce((ss, l) => ss + Number(l.valor || 0), 0), 0)
      const totalNomina = (n.data || []).reduce((s, x) => s + Number(x.valor), 0)
      setCostosPeriodo({ costos: totalCostos, empaque: totalEmpaque, mecanizacion: totalMec, nomina: totalNomina })
    } catch (err) {
      setMensaje('Error cargando datos: ' + err.message)
    } finally {
      setCargando(false)
    }
  }

  useEffect(() => { cargarBase() }, [])
  useEffect(() => { cargarVentasYCostos() }, [desde, hasta])

  // ---------- Venta ----------
  function abrirNuevaVenta() {
    setEditVenta(null)
    setFormVenta({ ...VENTA_VACIA, comprador_id: '', lote_id: lotes[0]?.id || '' })
    setMensaje('')
    setModalVenta(true)
  }
  function abrirEditarVenta(v) {
    setEditVenta(v)
    setFormVenta({
      fecha: v.fecha, comprador_id: v.comprador_id, lote_id: v.lote_id || '',
      cajas_4kg: v.cajas_4kg, cajas_5kg: v.cajas_5kg, cajas_7kg: v.cajas_7kg,
      precio_4kg: v.precio_4kg, precio_5kg: v.precio_5kg, precio_7kg: v.precio_7kg,
      notas: v.notas || '',
    })
    setMensaje('')
    setModalVenta(true)
  }
  function setV(campo, valor) {
    setFormVenta((f) => ({ ...f, [campo]: valor }))
  }
  // Al elegir comprador con precio fijo, pre-cargar sus precios pactados
  function elegirComprador(id) {
    const comp = compradores.find((c) => c.id === id)
    setFormVenta((f) => {
      const nuevo = { ...f, comprador_id: id }
      if (comp && comp.modelo === 'fijo') {
        // solo pre-cargar si los campos están vacíos, para no pisar ediciones
        if (f.precio_4kg === '') nuevo.precio_4kg = comp.precio_4kg || ''
        if (f.precio_5kg === '') nuevo.precio_5kg = comp.precio_5kg || ''
        if (f.precio_7kg === '') nuevo.precio_7kg = comp.precio_7kg || ''
      }
      return nuevo
    })
  }
  async function guardarVenta() {
    setMensaje('')
    if (!formVenta.comprador_id) { setMensaje('Elegí un comprador.'); return }
    const totCajas = Number(formVenta.cajas_4kg || 0) + Number(formVenta.cajas_5kg || 0) + Number(formVenta.cajas_7kg || 0)
    if (totCajas <= 0) { setMensaje('Registrá al menos una caja.'); return }
    setGuardando(true)
    const num = (v) => (v === '' ? 0 : Number(v))
    const datos = {
      fecha: formVenta.fecha, comprador_id: formVenta.comprador_id, lote_id: formVenta.lote_id || null,
      cajas_4kg: num(formVenta.cajas_4kg), cajas_5kg: num(formVenta.cajas_5kg), cajas_7kg: num(formVenta.cajas_7kg),
      precio_4kg: num(formVenta.precio_4kg), precio_5kg: num(formVenta.precio_5kg), precio_7kg: num(formVenta.precio_7kg),
      notas: formVenta.notas.trim(),
    }
    let error
    if (editVenta) ({ error } = await supabase.from('ventas').update(datos).eq('id', editVenta.id))
    else ({ error } = await supabase.from('ventas').insert({ ...datos, creado_por: usuario.id }))
    setGuardando(false)
    if (error) setMensaje('No se pudo guardar: ' + error.message)
    else { setModalVenta(false); cargarVentasYCostos() }
  }
  async function borrarVenta(v) {
    if (!confirm('¿Borrar esta venta?')) return
    const { error } = await supabase.from('ventas').delete().eq('id', v.id)
    if (!error) cargarVentasYCostos()
  }

  // ---------- Comprador ----------
  function abrirNuevoComp() {
    setEditComp(null)
    setFormComp({ nombre: '', modelo: 'fijo', precio_4kg: '', precio_5kg: '', precio_7kg: '' })
    setMensaje('')
    setModalComp(true)
  }
  function abrirEditarComp(c) {
    setEditComp(c)
    setFormComp({ nombre: c.nombre, modelo: c.modelo, precio_4kg: c.precio_4kg, precio_5kg: c.precio_5kg, precio_7kg: c.precio_7kg })
    setMensaje('')
    setModalComp(true)
  }
  async function guardarComp() {
    if (!formComp.nombre.trim()) { setMensaje('El nombre es obligatorio.'); return }
    const num = (v) => (v === '' ? 0 : Number(v))
    const datos = {
      nombre: formComp.nombre.trim(), modelo: formComp.modelo,
      precio_4kg: num(formComp.precio_4kg), precio_5kg: num(formComp.precio_5kg), precio_7kg: num(formComp.precio_7kg),
    }
    let error
    if (editComp) ({ error } = await supabase.from('compradores').update(datos).eq('id', editComp.id))
    else ({ error } = await supabase.from('compradores').insert(datos))
    if (error) setMensaje('No se pudo guardar: ' + error.message)
    else { setModalComp(false); cargarBase() }
  }
  async function archivarComp(c) {
    if (!confirm(`¿Archivar a ${c.nombre}?`)) return
    const { error } = await supabase.from('compradores').update({ activo: false }).eq('id', c.id)
    if (!error) cargarBase()
  }

  // ---------- Cálculos P&L ----------
  const totalIngresos = ventas.reduce((s, v) => s + ingresoVenta(v), 0)
  const totalCostos = costosPeriodo.costos + costosPeriodo.empaque + costosPeriodo.mecanizacion + costosPeriodo.nomina
  const utilidad = totalIngresos - totalCostos
  const margen = totalIngresos > 0 ? (utilidad / totalIngresos * 100).toFixed(1) + '%' : '—'

  const precioActual = (t) => {
    const comp = compradores.find((c) => c.id === formVenta.comprador_id)
    return comp
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold text-gray-800">Ventas y P&L</h2>
        {esAdmin && (
          <div className="flex gap-2">
            <select value={subvista} onChange={(e) => setSubvista(e.target.value)}
              className="text-sm border border-gray-300 px-3 py-2 rounded-lg text-gray-700">
              <option value="pyl">Ver P&L</option>
              <option value="ventas">Ver ventas</option>
              <option value="compradores">Compradores</option>
            </select>
            {subvista === 'ventas' && (
              <button onClick={abrirNuevaVenta}
                className="bg-green-600 hover:bg-green-700 text-white text-sm font-medium px-4 py-2 rounded-lg">+ Venta</button>
            )}
            {subvista === 'compradores' && (
              <button onClick={abrirNuevoComp}
                className="bg-green-600 hover:bg-green-700 text-white text-sm font-medium px-4 py-2 rounded-lg">+ Comprador</button>
            )}
          </div>
        )}
      </div>

      {/* Filtro de fechas (para P&L y ventas) */}
      {subvista !== 'compradores' && (
        <div className="flex flex-wrap items-center gap-3 mb-4">
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
      )}

      {mensaje && !modalVenta && !modalComp && (
        <p className="text-sm mb-3 px-3 py-2 rounded-lg bg-gray-100 text-gray-700">{mensaje}</p>
      )}

      {cargando ? <p className="text-gray-500">Cargando…</p> : (
        <>
          {/* ---------- P&L ---------- */}
          {subvista === 'pyl' && (
            <div className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="bg-white rounded-xl border border-gray-200 p-4">
                  <p className="text-sm text-gray-600">Ingresos (ventas)</p>
                  <p className="text-2xl font-bold text-green-700 mt-1">{L(totalIngresos)}</p>
                </div>
                <div className="bg-white rounded-xl border border-gray-200 p-4">
                  <p className="text-sm text-gray-600">Costos totales</p>
                  <p className="text-2xl font-bold text-gray-700 mt-1">{L(totalCostos)}</p>
                </div>
                <div className={`rounded-xl border p-4 ${utilidad >= 0 ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                  <p className="text-sm text-gray-600">Utilidad {utilidad >= 0 ? '' : '(pérdida)'}</p>
                  <p className={`text-2xl font-bold mt-1 ${utilidad >= 0 ? 'text-green-700' : 'text-red-600'}`}>{L(utilidad)}</p>
                  <p className="text-xs text-gray-400 mt-0.5">Margen: {margen}</p>
                </div>
              </div>

              {/* Desglose de costos */}
              <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <div className="px-4 py-3 border-b border-gray-100">
                  <p className="text-sm font-semibold text-gray-700">Desglose de costos del período</p>
                </div>
                <table className="w-full text-sm">
                  <tbody>
                    {[
                      ['Costos operativos', costosPeriodo.costos],
                      ['Empaque / Maquila', costosPeriodo.empaque],
                      ['Mecanización', costosPeriodo.mecanizacion],
                      ['Nómina', costosPeriodo.nomina],
                    ].map(([n, v]) => (
                      <tr key={n} className="border-t border-gray-100 first:border-t-0">
                        <td className="px-4 py-2.5 text-gray-700">{n}</td>
                        <td className="px-4 py-2.5 text-right font-medium">{L(v)}</td>
                      </tr>
                    ))}
                    <tr className="border-t-2 border-gray-200 bg-gray-50">
                      <td className="px-4 py-2.5 font-medium text-gray-600">Total costos</td>
                      <td className="px-4 py-2.5 text-right font-bold">{L(totalCostos)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div className="text-xs text-gray-500 bg-gray-50 border border-gray-200 rounded-lg px-4 py-3">
                <strong className="text-gray-600">Cómo se calcula:</strong> Ingresos = suma de las ventas
                del período (cajas × precio por caja registrado). Costos = todas las fuentes ya existentes
                (operativos, empaque, mecanización, nómina). Utilidad = ingresos − costos.
              </div>
            </div>
          )}

          {/* ---------- Ventas ---------- */}
          {subvista === 'ventas' && (
            ventas.length === 0 ? (
              <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-gray-500">
                No hay ventas registradas en este período.
              </div>
            ) : (
              <div className="bg-white rounded-xl border border-gray-200 overflow-hidden overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-gray-600">
                    <tr>
                      <th className="text-left px-4 py-3 font-medium">Fecha</th>
                      <th className="text-left px-4 py-3 font-medium">Comprador</th>
                      <th className="text-left px-4 py-3 font-medium">Lote</th>
                      <th className="text-center px-3 py-3 font-medium">Cajas</th>
                      <th className="text-right px-4 py-3 font-medium">Ingreso</th>
                      {esAdmin && <th className="px-4 py-3"></th>}
                    </tr>
                  </thead>
                  <tbody>
                    {ventas.map((v) => (
                      <tr key={v.id} className="border-t border-gray-100">
                        <td className="px-4 py-3 text-gray-600">{v.fecha}</td>
                        <td className="px-4 py-3 font-medium text-gray-800">{v.compradores?.nombre}</td>
                        <td className="px-4 py-3 text-gray-500">{v.lotes?.nombre || '—'}</td>
                        <td className="px-3 py-3 text-center text-gray-600">
                          {Number(v.cajas_4kg) + Number(v.cajas_5kg) + Number(v.cajas_7kg)}
                        </td>
                        <td className="px-4 py-3 text-right font-semibold text-green-700">{L(ingresoVenta(v))}</td>
                        {esAdmin && (
                          <td className="px-4 py-3 text-right whitespace-nowrap">
                            <button onClick={() => abrirEditarVenta(v)}
                              className="text-sm text-green-700 hover:text-green-900 mr-2">Editar</button>
                            <button onClick={() => borrarVenta(v)}
                              className="text-sm text-gray-400 hover:text-red-600">Borrar</button>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          )}

          {/* ---------- Compradores ---------- */}
          {subvista === 'compradores' && (
            compradores.length === 0 ? (
              <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-gray-500">
                No hay compradores registrados.
              </div>
            ) : (
              <div className="bg-white rounded-xl border border-gray-200 overflow-hidden overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-gray-600">
                    <tr>
                      <th className="text-left px-4 py-3 font-medium">Comprador</th>
                      <th className="text-left px-4 py-3 font-medium">Modelo</th>
                      <th className="text-right px-3 py-3 font-medium">4kg</th>
                      <th className="text-right px-3 py-3 font-medium">5kg</th>
                      <th className="text-right px-3 py-3 font-medium">7kg</th>
                      {esAdmin && <th className="px-4 py-3"></th>}
                    </tr>
                  </thead>
                  <tbody>
                    {compradores.map((c) => (
                      <tr key={c.id} className="border-t border-gray-100">
                        <td className="px-4 py-3 font-medium text-gray-800">{c.nombre}</td>
                        <td className="px-4 py-3">
                          <span className={`text-xs px-2 py-0.5 rounded-full ${c.modelo === 'fijo' ? 'bg-blue-100 text-blue-800' : 'bg-amber-100 text-amber-800'}`}>
                            {c.modelo === 'fijo' ? 'Precio fijo' : 'Precio mercado'}
                          </span>
                        </td>
                        <td className="px-3 py-3 text-right text-gray-600">{c.modelo === 'fijo' ? L(c.precio_4kg) : '—'}</td>
                        <td className="px-3 py-3 text-right text-gray-600">{c.modelo === 'fijo' ? L(c.precio_5kg) : '—'}</td>
                        <td className="px-3 py-3 text-right text-gray-600">{c.modelo === 'fijo' ? L(c.precio_7kg) : '—'}</td>
                        {esAdmin && (
                          <td className="px-4 py-3 text-right whitespace-nowrap">
                            <button onClick={() => abrirEditarComp(c)}
                              className="text-sm text-green-700 hover:text-green-900 mr-2">Editar</button>
                            <button onClick={() => archivarComp(c)}
                              className="text-sm text-gray-400 hover:text-red-600">Archivar</button>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          )}
        </>
      )}

      {/* Modal venta */}
      {modalVenta && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <h3 className="text-lg font-semibold text-gray-800 mb-5">{editVenta ? 'Editar venta' : 'Nueva venta'}</h3>
              <div className="space-y-4">
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Fecha</label>
                    <input type="date" value={formVenta.fecha} max={hoyISO()} onChange={(e) => setV('fecha', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-400" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Comprador</label>
                    <select value={formVenta.comprador_id} onChange={(e) => elegirComprador(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-400">
                      <option value="">Elegí…</option>
                      {compradores.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Lote</label>
                    <select value={formVenta.lote_id} onChange={(e) => setV('lote_id', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-400">
                      <option value="">Sin asignar</option>
                      {lotes.map((l) => <option key={l.id} value={l.id}>{l.nombre}</option>)}
                    </select>
                  </div>
                </div>

                <div>
                  <p className="text-sm font-semibold text-gray-700 mb-2">Cajas vendidas y precio por caja</p>
                  <div className="space-y-2">
                    <div className="grid grid-cols-3 gap-3 text-xs text-gray-400 px-1">
                      <span>Tamaño</span><span>Cajas</span><span>Precio/caja (L)</span>
                    </div>
                    {[
                      ['4kg', 'cajas_4kg', 'precio_4kg'],
                      ['5kg', 'cajas_5kg', 'precio_5kg'],
                      ['7kg', 'cajas_7kg', 'precio_7kg'],
                    ].map(([label, cc, cp]) => (
                      <div key={label} className="grid grid-cols-3 gap-3 items-center">
                        <span className="text-sm text-gray-600">Caja {label}</span>
                        <input type="number" step="0.5" min="0" value={formVenta[cc]} onChange={(e) => setV(cc, e.target.value)}
                          placeholder="cajas"
                          className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-400" />
                        <input type="number" step="0.01" min="0" value={formVenta[cp]} onChange={(e) => setV(cp, e.target.value)}
                          placeholder="L / caja"
                          className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-400" />
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Notas</label>
                  <textarea value={formVenta.notas} onChange={(e) => setV('notas', e.target.value)} rows={2}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-400" />
                </div>

                <div className="bg-green-50 rounded-lg px-4 py-3 flex justify-between items-center">
                  <span className="text-sm text-gray-600">Ingreso de esta venta</span>
                  <span className="font-semibold text-green-700 text-base">{L(ingresoVenta({
                    cajas_4kg: formVenta.cajas_4kg, cajas_5kg: formVenta.cajas_5kg, cajas_7kg: formVenta.cajas_7kg,
                    precio_4kg: formVenta.precio_4kg, precio_5kg: formVenta.precio_5kg, precio_7kg: formVenta.precio_7kg,
                  }))}</span>
                </div>

                {mensaje && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{mensaje}</p>}
              </div>
              <div className="mt-6 flex justify-end gap-3">
                <button onClick={() => setModalVenta(false)}
                  className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800">Cancelar</button>
                <button onClick={guardarVenta} disabled={guardando}
                  className="bg-green-600 hover:bg-green-700 disabled:opacity-60 text-white text-sm font-medium px-5 py-2 rounded-lg">
                  {guardando ? 'Guardando…' : 'Guardar'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal comprador */}
      {modalComp && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <h3 className="text-lg font-semibold text-gray-800 mb-5">{editComp ? 'Editar comprador' : 'Nuevo comprador'}</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nombre</label>
                  <input type="text" value={formComp.nombre} onChange={(e) => setFormComp({ ...formComp, nombre: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-400" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Modelo de precio</label>
                  <select value={formComp.modelo} onChange={(e) => setFormComp({ ...formComp, modelo: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-400">
                    <option value="fijo">Precio fijo pactado</option>
                    <option value="mercado">Precio de mercado</option>
                  </select>
                </div>
                {formComp.modelo === 'fijo' && (
                  <div>
                    <p className="text-sm font-medium text-gray-700 mb-2">Precios pactados por caja (L)</p>
                    <div className="grid grid-cols-3 gap-3">
                      {[['4kg', 'precio_4kg'], ['5kg', 'precio_5kg'], ['7kg', 'precio_7kg']].map(([label, campo]) => (
                        <div key={campo}>
                          <label className="block text-xs text-gray-500 mb-1">Caja {label}</label>
                          <input type="number" step="0.01" min="0" value={formComp[campo]}
                            onChange={(e) => setFormComp({ ...formComp, [campo]: e.target.value })}
                            className="w-full px-2 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-400" />
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {formComp.modelo === 'mercado' && (
                  <p className="text-xs text-gray-500 bg-gray-50 rounded-lg px-3 py-2">
                    El precio de mercado se teclea en cada venta, ya que varía por envío.
                  </p>
                )}
                {mensaje && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{mensaje}</p>}
              </div>
              <div className="mt-6 flex justify-end gap-3">
                <button onClick={() => setModalComp(false)}
                  className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800">Cancelar</button>
                <button onClick={guardarComp}
                  className="bg-green-600 hover:bg-green-700 text-white text-sm font-medium px-5 py-2 rounded-lg">Guardar</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
