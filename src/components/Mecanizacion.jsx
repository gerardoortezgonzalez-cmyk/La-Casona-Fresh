import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'

function hoyISO() {
  return new Date().toISOString().slice(0, 10)
}
function L(n) {
  return 'L ' + Number(n || 0).toLocaleString('es-HN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

const LINEA_VACIA = { labor_id: '', labor_nombre: '', pases: 1, valor: '' }

export default function Mecanizacion() {
  const { usuario, esAdmin } = useAuth()
  const [labores, setLabores] = useState([])
  const [lotes, setLotes] = useState([])
  const [facturas, setFacturas] = useState([])
  const [cargando, setCargando] = useState(true)
  const [mensaje, setMensaje] = useState('')

  const [modalAbierto, setModalAbierto] = useState(false)
  const [editando, setEditando] = useState(null)
  const [cab, setCab] = useState({ fecha: hoyISO(), proveedor: '', numero_factura: '', lote_id: '', notas: '' })
  const [lineas, setLineas] = useState([{ ...LINEA_VACIA }])
  const [guardando, setGuardando] = useState(false)

  const [modalLabores, setModalLabores] = useState(false)
  const [nuevaLabor, setNuevaLabor] = useState('')

  async function cargarBase() {
    const [lab, lot] = await Promise.all([
      supabase.from('labores').select('*').eq('activo', true).order('nombre'),
      supabase.from('lotes').select('id, nombre').eq('activo', true).order('nombre'),
    ])
    setLabores(lab.data || [])
    setLotes(lot.data || [])
  }

  async function cargarFacturas() {
    setCargando(true)
    const { data, error } = await supabase
      .from('mecanizacion_facturas')
      .select('*, lotes(nombre), mecanizacion_lineas(id, labor_nombre, pases, valor)')
      .order('fecha', { ascending: false })
      .limit(100)
    if (error) setMensaje('Error cargando facturas: ' + error.message)
    else setFacturas(data || [])
    setCargando(false)
  }

  useEffect(() => { cargarBase(); cargarFacturas() }, [])

  function totalFactura(f) {
    return (f.mecanizacion_lineas || []).reduce((s, l) => s + Number(l.valor || 0), 0)
  }
  const totalActual = lineas.reduce((s, l) => s + Number(l.valor || 0), 0)

  function abrirNuevo() {
    setEditando(null)
    setCab({ fecha: hoyISO(), proveedor: '', numero_factura: '', lote_id: lotes[0]?.id || '', notas: '' })
    setLineas([{ ...LINEA_VACIA }])
    setMensaje('')
    setModalAbierto(true)
  }

  async function abrirEditar(f) {
    setEditando(f)
    setCab({
      fecha: f.fecha, proveedor: f.proveedor || '', numero_factura: f.numero_factura || '',
      lote_id: f.lote_id, notas: f.notas || '',
    })
    // recargar líneas completas
    const { data } = await supabase
      .from('mecanizacion_lineas').select('*').eq('factura_id', f.id)
    setLineas((data && data.length ? data : [{ ...LINEA_VACIA }]).map((l) => ({
      labor_id: l.labor_id || '', labor_nombre: l.labor_nombre || '',
      pases: l.pases ?? 1, valor: l.valor ?? '',
    })))
    setMensaje('')
    setModalAbierto(true)
  }

  function setLinea(i, campo, valor) {
    setLineas((ls) => ls.map((l, idx) => {
      if (idx !== i) return l
      if (campo === 'labor_id') {
        const lab = labores.find((x) => x.id === valor)
        return { ...l, labor_id: valor, labor_nombre: lab?.nombre || '' }
      }
      return { ...l, [campo]: valor }
    }))
  }
  function agregarLinea() { setLineas((ls) => [...ls, { ...LINEA_VACIA }]) }
  function quitarLinea(i) { setLineas((ls) => ls.length > 1 ? ls.filter((_, idx) => idx !== i) : ls) }

  async function guardar() {
    setMensaje('')
    if (!cab.lote_id) { setMensaje('Elegí el lote de la factura.'); return }
    const lineasValidas = lineas.filter((l) => l.labor_nombre && Number(l.valor) > 0)
    if (lineasValidas.length === 0) { setMensaje('Agregá al menos una labor con valor.'); return }
    setGuardando(true)

    try {
      let facturaId
      if (editando) {
        const { error } = await supabase.from('mecanizacion_facturas').update({
          fecha: cab.fecha, proveedor: cab.proveedor.trim(),
          numero_factura: cab.numero_factura.trim(), lote_id: cab.lote_id, notas: cab.notas.trim(),
        }).eq('id', editando.id)
        if (error) throw error
        facturaId = editando.id
        // reemplazar líneas: borrar y reinsertar (simple y consistente)
        await supabase.from('mecanizacion_lineas').delete().eq('factura_id', facturaId)
      } else {
        const { data, error } = await supabase.from('mecanizacion_facturas').insert({
          fecha: cab.fecha, proveedor: cab.proveedor.trim(),
          numero_factura: cab.numero_factura.trim(), lote_id: cab.lote_id, notas: cab.notas.trim(),
          creado_por: usuario.id,
        }).select('id').single()
        if (error) throw error
        facturaId = data.id
      }

      const filas = lineasValidas.map((l) => ({
        factura_id: facturaId,
        labor_id: l.labor_id || null,
        labor_nombre: l.labor_nombre,
        pases: Number(l.pases || 1),
        valor: Number(l.valor),
      }))
      const { error: errLineas } = await supabase.from('mecanizacion_lineas').insert(filas)
      if (errLineas) throw errLineas

      setModalAbierto(false)
      cargarFacturas()
    } catch (e) {
      setMensaje('No se pudo guardar: ' + e.message)
    } finally {
      setGuardando(false)
    }
  }

  async function borrar(f) {
    if (!confirm(`¿Borrar la factura de ${f.proveedor || 'mecanización'} (${f.lotes?.nombre})?`)) return
    const { error } = await supabase.from('mecanizacion_facturas').delete().eq('id', f.id)
    if (error) setMensaje('No se pudo borrar: ' + error.message)
    else cargarFacturas()
  }

  async function agregarLabor() {
    const nombre = nuevaLabor.trim()
    if (!nombre) return
    const { error } = await supabase.from('labores').insert({ nombre })
    if (error) setMensaje('No se pudo crear la labor: ' + error.message)
    else { setNuevaLabor(''); cargarBase() }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold text-gray-800">Mecanización contratada</h2>
        {esAdmin && (
          <div className="flex gap-2">
            <button onClick={() => setModalLabores(true)}
              className="text-sm text-gray-600 hover:text-gray-800 border border-gray-300 px-3 py-2 rounded-lg">
              Labores
            </button>
            <button onClick={abrirNuevo}
              className="bg-green-600 hover:bg-green-700 text-white text-sm font-medium px-4 py-2 rounded-lg">
              + Nueva factura
            </button>
          </div>
        )}
      </div>

      {mensaje && !modalAbierto && !modalLabores && (
        <p className="text-sm mb-3 px-3 py-2 rounded-lg bg-gray-100 text-gray-700">{mensaje}</p>
      )}

      {cargando ? (
        <p className="text-gray-500">Cargando…</p>
      ) : facturas.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-gray-500">
          No hay facturas de mecanización registradas.
        </div>
      ) : (
        <div className="space-y-3">
          {facturas.map((f) => (
            <div key={f.id} className="bg-white rounded-xl border border-gray-200 p-4">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-gray-800">{f.proveedor || 'Sin proveedor'}</span>
                    {f.numero_factura && <span className="text-xs text-gray-400">#{f.numero_factura}</span>}
                  </div>
                  <p className="text-sm text-gray-500 mt-0.5">
                    {f.fecha} · Lote: {f.lotes?.nombre || '—'}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-bold text-green-700">{L(totalFactura(f))}</p>
                  {esAdmin && (
                    <div className="mt-1">
                      <button onClick={() => abrirEditar(f)}
                        className="text-sm text-green-700 hover:text-green-900 mr-2">Editar</button>
                      <button onClick={() => borrar(f)}
                        className="text-sm text-gray-400 hover:text-red-600">Borrar</button>
                    </div>
                  )}
                </div>
              </div>
              {/* Detalle de labores */}
              <div className="mt-3 border-t border-gray-100 pt-2">
                {(f.mecanizacion_lineas || []).map((l) => (
                  <div key={l.id} className="flex justify-between text-sm text-gray-600 py-0.5">
                    <span>{l.labor_nombre} {l.pases > 1 && <span className="text-gray-400">×{l.pases} pases</span>}</span>
                    <span>{L(l.valor)}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal factura */}
      {modalAbierto && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <h3 className="text-lg font-semibold text-gray-800 mb-5">
                {editando ? 'Editar factura' : 'Nueva factura de mecanización'}
              </h3>

              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Fecha</label>
                    <input type="date" value={cab.fecha} max={hoyISO()}
                      onChange={(e) => setCab({ ...cab, fecha: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-400" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Lote</label>
                    <select value={cab.lote_id} onChange={(e) => setCab({ ...cab, lote_id: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-400">
                      <option value="">Elegí un lote…</option>
                      {lotes.map((l) => <option key={l.id} value={l.id}>{l.nombre}</option>)}
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Proveedor</label>
                    <input type="text" value={cab.proveedor}
                      onChange={(e) => setCab({ ...cab, proveedor: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-400"
                      placeholder="Nombre del proveedor" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">N° de factura</label>
                    <input type="text" value={cab.numero_factura}
                      onChange={(e) => setCab({ ...cab, numero_factura: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-400"
                      placeholder="Opcional" />
                  </div>
                </div>

                {/* Líneas de labor */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm font-semibold text-gray-700">Labores</p>
                    <button onClick={agregarLinea}
                      className="text-sm text-green-700 hover:text-green-900">+ Agregar labor</button>
                  </div>
                  <div className="space-y-2">
                    {/* Encabezados */}
                    <div className="grid grid-cols-12 gap-2 text-xs text-gray-400 px-1">
                      <span className="col-span-6">Labor</span>
                      <span className="col-span-2 text-center">Pases</span>
                      <span className="col-span-3 text-right">Valor (L)</span>
                      <span className="col-span-1"></span>
                    </div>
                    {lineas.map((l, i) => (
                      <div key={i} className="grid grid-cols-12 gap-2 items-center">
                        <select value={l.labor_id} onChange={(e) => setLinea(i, 'labor_id', e.target.value)}
                          className="col-span-6 px-2 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-400">
                          <option value="">Elegí labor…</option>
                          {labores.map((lab) => <option key={lab.id} value={lab.id}>{lab.nombre}</option>)}
                        </select>
                        <input type="number" step="1" min="1" value={l.pases}
                          onChange={(e) => setLinea(i, 'pases', e.target.value)}
                          className="col-span-2 px-2 py-2 border border-gray-300 rounded-lg text-sm text-center focus:outline-none focus:ring-2 focus:ring-green-400" />
                        <input type="number" step="0.01" min="0" value={l.valor}
                          onChange={(e) => setLinea(i, 'valor', e.target.value)}
                          placeholder="0.00"
                          className="col-span-3 px-2 py-2 border border-gray-300 rounded-lg text-sm text-right focus:outline-none focus:ring-2 focus:ring-green-400" />
                        <button onClick={() => quitarLinea(i)}
                          className="col-span-1 text-gray-400 hover:text-red-600 text-lg">×</button>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Notas</label>
                  <textarea value={cab.notas} onChange={(e) => setCab({ ...cab, notas: e.target.value })} rows={2}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-400" />
                </div>

                <div className="bg-green-50 rounded-lg px-4 py-3 flex justify-between items-center">
                  <span className="text-sm text-gray-600">Total de la factura</span>
                  <span className="font-semibold text-green-700 text-base">{L(totalActual)}</span>
                </div>

                {mensaje && (
                  <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{mensaje}</p>
                )}
              </div>

              <div className="mt-6 flex justify-end gap-3">
                <button onClick={() => setModalAbierto(false)}
                  className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800">Cancelar</button>
                <button onClick={guardar} disabled={guardando}
                  className="bg-green-600 hover:bg-green-700 disabled:opacity-60 text-white text-sm font-medium px-5 py-2 rounded-lg">
                  {guardando ? 'Guardando…' : 'Guardar'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal labores */}
      {modalLabores && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl w-full max-w-md">
            <div className="p-6">
              <h3 className="text-lg font-semibold text-gray-800 mb-4">Labores</h3>
              <div className="flex gap-2 mb-4">
                <input type="text" value={nuevaLabor} onChange={(e) => setNuevaLabor(e.target.value)}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-400"
                  placeholder="Nueva labor" />
                <button onClick={agregarLabor}
                  className="bg-green-600 hover:bg-green-700 text-white text-sm font-medium px-4 py-2 rounded-lg">Agregar</button>
              </div>
              <ul className="space-y-1 max-h-60 overflow-y-auto">
                {labores.map((l) => (
                  <li key={l.id} className="px-3 py-2 bg-gray-50 rounded-lg text-sm text-gray-700">{l.nombre}</li>
                ))}
              </ul>
              {mensaje && (
                <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2 mt-3">{mensaje}</p>
              )}
              <div className="mt-5 flex justify-end">
                <button onClick={() => { setModalLabores(false); setMensaje('') }}
                  className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800">Cerrar</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
