import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'

function hoyISO() {
  return new Date().toISOString().slice(0, 10)
}

function L(n) {
  return 'L ' + Number(n || 0).toLocaleString('es-HN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

const FORM_VACIO = {
  fecha: hoyISO(),
  categoria_id: '',
  descripcion: '',
  monto: '',
  lote_id: '',
  notas: '',
}

export default function Costos() {
  const { usuario, esAdmin } = useAuth()
  const [categorias, setCategorias] = useState([])
  const [lotes, setLotes] = useState([])
  const [costos, setCostos] = useState([])
  const [cargando, setCargando] = useState(true)
  const [mensaje, setMensaje] = useState('')

  const [modalAbierto, setModalAbierto] = useState(false)
  const [editando, setEditando] = useState(null)
  const [form, setForm] = useState(FORM_VACIO)
  const [guardando, setGuardando] = useState(false)

  const [modalCategorias, setModalCategorias] = useState(false)
  const [nuevaCategoria, setNuevaCategoria] = useState('')

  // Filtros
  const [filtroCategoria, setFiltroCategoria] = useState('')
  const [filtroLote, setFiltroLote] = useState('')

  async function cargarBase() {
    const [cat, lot] = await Promise.all([
      supabase.from('categorias_costo').select('*').eq('activo', true).order('nombre'),
      supabase.from('lotes').select('id, nombre').eq('activo', true).order('nombre'),
    ])
    setCategorias(cat.data || [])
    setLotes(lot.data || [])
  }

  async function cargarCostos() {
    setCargando(true)
    let q = supabase
      .from('costos')
      .select('*, categorias_costo(nombre), lotes(nombre)')
      .order('fecha', { ascending: false })
      .limit(200)
    if (filtroCategoria) q = q.eq('categoria_id', filtroCategoria)
    if (filtroLote === 'general') q = q.is('lote_id', null)
    else if (filtroLote) q = q.eq('lote_id', filtroLote)
    const { data, error } = await q
    if (error) setMensaje('Error cargando costos: ' + error.message)
    else setCostos(data || [])
    setCargando(false)
  }

  useEffect(() => { cargarBase() }, [])
  useEffect(() => { cargarCostos() }, [filtroCategoria, filtroLote])

  function abrirNuevo() {
    setEditando(null)
    setForm({ ...FORM_VACIO, categoria_id: categorias[0]?.id || '' })
    setMensaje('')
    setModalAbierto(true)
  }

  function abrirEditar(c) {
    setEditando(c)
    setForm({
      fecha: c.fecha,
      categoria_id: c.categoria_id,
      descripcion: c.descripcion || '',
      monto: c.monto,
      lote_id: c.lote_id || '',
      notas: c.notas || '',
    })
    setMensaje('')
    setModalAbierto(true)
  }

  function set(campo, valor) {
    setForm((f) => ({ ...f, [campo]: valor }))
  }

  async function guardar() {
    setMensaje('')
    if (!form.categoria_id) { setMensaje('Elegí una categoría.'); return }
    if (form.monto === '' || Number(form.monto) <= 0) { setMensaje('Ingresá el monto.'); return }
    setGuardando(true)

    const datos = {
      fecha: form.fecha,
      categoria_id: form.categoria_id,
      descripcion: form.descripcion.trim(),
      monto: Number(form.monto),
      lote_id: form.lote_id || null,
      notas: form.notas.trim(),
    }

    let error
    if (editando) {
      ({ error } = await supabase.from('costos').update(datos).eq('id', editando.id))
    } else {
      ({ error } = await supabase.from('costos').insert({ ...datos, creado_por: usuario.id }))
    }
    setGuardando(false)
    if (error) setMensaje('No se pudo guardar: ' + error.message)
    else { setModalAbierto(false); cargarCostos() }
  }

  async function borrar(c) {
    if (!confirm('¿Borrar este costo?')) return
    const { error } = await supabase.from('costos').delete().eq('id', c.id)
    if (error) setMensaje('No se pudo borrar: ' + error.message)
    else cargarCostos()
  }

  async function agregarCategoria() {
    const nombre = nuevaCategoria.trim()
    if (!nombre) return
    const { error } = await supabase.from('categorias_costo').insert({ nombre })
    if (error) setMensaje('No se pudo crear la categoría: ' + error.message)
    else { setNuevaCategoria(''); cargarBase() }
  }

  const totalMostrado = costos.reduce((s, c) => s + Number(c.monto), 0)

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold text-gray-800">Costos</h2>
        {esAdmin && (
          <div className="flex gap-2">
            <button onClick={() => setModalCategorias(true)}
              className="text-sm text-gray-600 hover:text-gray-800 border border-gray-300 px-3 py-2 rounded-lg">
              Categorías
            </button>
            <button onClick={abrirNuevo}
              className="bg-green-600 hover:bg-green-700 text-white text-sm font-medium px-4 py-2 rounded-lg">
              + Nuevo costo
            </button>
          </div>
        )}
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-3 mb-4">
        <select value={filtroCategoria} onChange={(e) => setFiltroCategoria(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-400">
          <option value="">Todas las categorías</option>
          {categorias.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
        </select>
        <select value={filtroLote} onChange={(e) => setFiltroLote(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-400">
          <option value="">Todos los lotes</option>
          <option value="general">Solo generales</option>
          {lotes.map((l) => <option key={l.id} value={l.id}>{l.nombre}</option>)}
        </select>
      </div>

      {mensaje && !modalAbierto && !modalCategorias && (
        <p className="text-sm mb-3 px-3 py-2 rounded-lg bg-gray-100 text-gray-700">{mensaje}</p>
      )}

      {cargando ? (
        <p className="text-gray-500">Cargando…</p>
      ) : costos.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-gray-500">
          No hay costos registrados con estos filtros.
        </div>
      ) : (
        <>
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-600">
                <tr>
                  <th className="text-left px-4 py-3 font-medium">Fecha</th>
                  <th className="text-left px-4 py-3 font-medium">Categoría</th>
                  <th className="text-left px-4 py-3 font-medium">Descripción</th>
                  <th className="text-left px-4 py-3 font-medium">Asignación</th>
                  <th className="text-right px-4 py-3 font-medium">Monto</th>
                  {esAdmin && <th className="px-4 py-3"></th>}
                </tr>
              </thead>
              <tbody>
                {costos.map((c) => (
                  <tr key={c.id} className="border-t border-gray-100">
                    <td className="px-4 py-3 text-gray-600">{c.fecha}</td>
                    <td className="px-4 py-3">{c.categorias_costo?.nombre}</td>
                    <td className="px-4 py-3 text-gray-700">{c.descripcion || '—'}</td>
                    <td className="px-4 py-3 text-gray-500">
                      {c.lotes?.nombre || <span className="text-gray-400">General</span>}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold">{L(c.monto)}</td>
                    {esAdmin && (
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        <button onClick={() => abrirEditar(c)}
                          className="text-sm text-green-700 hover:text-green-900 mr-2">Editar</button>
                        <button onClick={() => borrar(c)}
                          className="text-sm text-gray-400 hover:text-red-600">Borrar</button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-gray-200 bg-gray-50">
                  <td colSpan={4} className="px-4 py-3 text-right font-medium text-gray-600">Total mostrado:</td>
                  <td className="px-4 py-3 text-right font-bold text-green-700">{L(totalMostrado)}</td>
                  {esAdmin && <td></td>}
                </tr>
              </tfoot>
            </table>
          </div>
        </>
      )}

      {/* Modal de costo */}
      {modalAbierto && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <h3 className="text-lg font-semibold text-gray-800 mb-5">
                {editando ? 'Editar costo' : 'Nuevo costo'}
              </h3>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Fecha</label>
                    <input type="date" value={form.fecha} max={hoyISO()}
                      onChange={(e) => set('fecha', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-400" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Categoría</label>
                    <select value={form.categoria_id} onChange={(e) => set('categoria_id', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-400">
                      <option value="">Elegí…</option>
                      {categorias.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Descripción</label>
                  <input type="text" value={form.descripcion}
                    onChange={(e) => set('descripcion', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-400"
                    placeholder="Ej. Compra de sacos, flete a mercado…" />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Monto (L)</label>
                    <input type="number" step="0.01" min="0" value={form.monto}
                      onChange={(e) => set('monto', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-400"
                      placeholder="0.00" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Asignar a</label>
                    <select value={form.lote_id} onChange={(e) => set('lote_id', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-400">
                      <option value="">General (toda la operación)</option>
                      {lotes.map((l) => <option key={l.id} value={l.id}>{l.nombre}</option>)}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Notas</label>
                  <textarea value={form.notas} onChange={(e) => set('notas', e.target.value)} rows={2}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-400" />
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

      {/* Modal de categorías */}
      {modalCategorias && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl w-full max-w-md">
            <div className="p-6">
              <h3 className="text-lg font-semibold text-gray-800 mb-4">Categorías de costo</h3>
              <div className="flex gap-2 mb-4">
                <input type="text" value={nuevaCategoria}
                  onChange={(e) => setNuevaCategoria(e.target.value)}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-400"
                  placeholder="Nueva categoría" />
                <button onClick={agregarCategoria}
                  className="bg-green-600 hover:bg-green-700 text-white text-sm font-medium px-4 py-2 rounded-lg">
                  Agregar
                </button>
              </div>
              <ul className="space-y-1 max-h-60 overflow-y-auto">
                {categorias.map((c) => (
                  <li key={c.id} className="px-3 py-2 bg-gray-50 rounded-lg text-sm text-gray-700">
                    {c.nombre}
                  </li>
                ))}
              </ul>
              {mensaje && (
                <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2 mt-3">{mensaje}</p>
              )}
              <div className="mt-5 flex justify-end">
                <button onClick={() => { setModalCategorias(false); setMensaje('') }}
                  className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800">Cerrar</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
