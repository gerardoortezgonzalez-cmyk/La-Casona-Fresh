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
  lote_id: '',
  cajas_4kg: '', cajas_5kg: '', cajas_7kg: '',
  costo_maquila_4kg: '', costo_maquila_5kg: '', costo_maquila_7kg: '',
  costo_materiales: '', costo_mano_obra: '',
  notas: '',
}

// Calcula el costo total de una tanda a partir de sus valores
function costoTotal(e) {
  const maquila =
    Number(e.cajas_4kg || 0) * Number(e.costo_maquila_4kg || 0) +
    Number(e.cajas_5kg || 0) * Number(e.costo_maquila_5kg || 0) +
    Number(e.cajas_7kg || 0) * Number(e.costo_maquila_7kg || 0)
  return maquila + Number(e.costo_materiales || 0) + Number(e.costo_mano_obra || 0)
}

function totalCajas(e) {
  return Number(e.cajas_4kg || 0) + Number(e.cajas_5kg || 0) + Number(e.cajas_7kg || 0)
}

export default function Empaque() {
  const { usuario, esAdmin } = useAuth()
  const [lotes, setLotes] = useState([])
  const [empaques, setEmpaques] = useState([])
  const [cargando, setCargando] = useState(true)
  const [mensaje, setMensaje] = useState('')
  const [modalAbierto, setModalAbierto] = useState(false)
  const [editando, setEditando] = useState(null)
  const [form, setForm] = useState(FORM_VACIO)
  const [guardando, setGuardando] = useState(false)

  async function cargarLotes() {
    const { data } = await supabase
      .from('lotes').select('id, nombre').eq('activo', true).order('nombre')
    setLotes(data || [])
  }

  async function cargarEmpaques() {
    setCargando(true)
    const { data, error } = await supabase
      .from('empaques')
      .select('*, lotes(nombre)')
      .order('fecha', { ascending: false })
      .limit(100)
    if (error) setMensaje('Error cargando empaque: ' + error.message)
    else setEmpaques(data || [])
    setCargando(false)
  }

  useEffect(() => { cargarLotes(); cargarEmpaques() }, [])

  function abrirNuevo() {
    setEditando(null)
    setForm({ ...FORM_VACIO, lote_id: lotes[0]?.id || '' })
    setMensaje('')
    setModalAbierto(true)
  }

  function abrirEditar(e) {
    setEditando(e)
    setForm({
      fecha: e.fecha,
      lote_id: e.lote_id,
      cajas_4kg: e.cajas_4kg, cajas_5kg: e.cajas_5kg, cajas_7kg: e.cajas_7kg,
      costo_maquila_4kg: e.costo_maquila_4kg,
      costo_maquila_5kg: e.costo_maquila_5kg,
      costo_maquila_7kg: e.costo_maquila_7kg,
      costo_materiales: e.costo_materiales,
      costo_mano_obra: e.costo_mano_obra,
      notas: e.notas || '',
    })
    setMensaje('')
    setModalAbierto(true)
  }

  function set(campo, valor) {
    setForm((f) => ({ ...f, [campo]: valor }))
  }

  async function guardar() {
    setMensaje('')
    if (!form.lote_id) { setMensaje('Elegí el lote de origen.'); return }
    if (totalCajas(form) <= 0) { setMensaje('Registrá al menos una caja.'); return }
    setGuardando(true)

    const num = (v) => (v === '' ? 0 : Number(v))
    const datos = {
      fecha: form.fecha,
      lote_id: form.lote_id,
      cajas_4kg: num(form.cajas_4kg),
      cajas_5kg: num(form.cajas_5kg),
      cajas_7kg: num(form.cajas_7kg),
      costo_maquila_4kg: num(form.costo_maquila_4kg),
      costo_maquila_5kg: num(form.costo_maquila_5kg),
      costo_maquila_7kg: num(form.costo_maquila_7kg),
      costo_materiales: num(form.costo_materiales),
      costo_mano_obra: num(form.costo_mano_obra),
      notas: form.notas.trim(),
    }

    let error
    if (editando) {
      ({ error } = await supabase.from('empaques').update(datos).eq('id', editando.id))
    } else {
      ({ error } = await supabase.from('empaques').insert({ ...datos, creado_por: usuario.id }))
    }
    setGuardando(false)
    if (error) setMensaje('No se pudo guardar: ' + error.message)
    else { setModalAbierto(false); cargarEmpaques() }
  }

  async function borrar(e) {
    if (!confirm(`¿Borrar el empaque del ${e.fecha} (${e.lotes?.nombre})?`)) return
    const { error } = await supabase.from('empaques').delete().eq('id', e.id)
    if (error) setMensaje('No se pudo borrar: ' + error.message)
    else cargarEmpaques()
  }

  const costoActual = costoTotal(form)
  const cajasActual = totalCajas(form)

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold text-gray-800">Empaque / Maquila</h2>
        {esAdmin && (
          <button onClick={abrirNuevo}
            className="bg-green-600 hover:bg-green-700 text-white text-sm font-medium px-4 py-2 rounded-lg">
            + Nueva tanda
          </button>
        )}
      </div>

      {mensaje && !modalAbierto && (
        <p className="text-sm mb-3 px-3 py-2 rounded-lg bg-gray-100 text-gray-700">{mensaje}</p>
      )}

      {cargando ? (
        <p className="text-gray-500">Cargando…</p>
      ) : empaques.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-gray-500">
          No hay tandas de empaque registradas.
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-600">
              <tr>
                <th className="text-left px-4 py-3 font-medium">Fecha</th>
                <th className="text-left px-4 py-3 font-medium">Lote</th>
                <th className="text-center px-3 py-3 font-medium">4kg</th>
                <th className="text-center px-3 py-3 font-medium">5kg</th>
                <th className="text-center px-3 py-3 font-medium">7kg</th>
                <th className="text-right px-4 py-3 font-medium">Costo total</th>
                {esAdmin && <th className="px-4 py-3"></th>}
              </tr>
            </thead>
            <tbody>
              {empaques.map((e) => (
                <tr key={e.id} className="border-t border-gray-100">
                  <td className="px-4 py-3 text-gray-600">{e.fecha}</td>
                  <td className="px-4 py-3 font-medium text-gray-800">{e.lotes?.nombre || '—'}</td>
                  <td className="px-3 py-3 text-center">{e.cajas_4kg || '—'}</td>
                  <td className="px-3 py-3 text-center">{e.cajas_5kg || '—'}</td>
                  <td className="px-3 py-3 text-center">{e.cajas_7kg || '—'}</td>
                  <td className="px-4 py-3 text-right font-semibold text-gray-800">{L(costoTotal(e))}</td>
                  {esAdmin && (
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <button onClick={() => abrirEditar(e)}
                        className="text-sm text-green-700 hover:text-green-900 mr-2">Editar</button>
                      <button onClick={() => borrar(e)}
                        className="text-sm text-gray-400 hover:text-red-600">Borrar</button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal */}
      {modalAbierto && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <h3 className="text-lg font-semibold text-gray-800 mb-5">
                {editando ? 'Editar tanda de empaque' : 'Nueva tanda de empaque'}
              </h3>

              <div className="space-y-5">
                {/* Fecha y lote */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Fecha</label>
                    <input type="date" value={form.fecha} max={hoyISO()}
                      onChange={(e) => set('fecha', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-400" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Lote de origen</label>
                    <select value={form.lote_id} onChange={(e) => set('lote_id', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-400">
                      <option value="">Elegí un lote…</option>
                      {lotes.map((l) => <option key={l.id} value={l.id}>{l.nombre}</option>)}
                    </select>
                  </div>
                </div>

                {/* Cajas y costo de maquila por tamaño */}
                <div>
                  <p className="text-sm font-semibold text-gray-700 mb-2">Cajas producidas y costo de maquila</p>
                  <div className="space-y-2">
                    {[
                      ['4kg', 'cajas_4kg', 'costo_maquila_4kg'],
                      ['5kg', 'cajas_5kg', 'costo_maquila_5kg'],
                      ['7kg', 'cajas_7kg', 'costo_maquila_7kg'],
                    ].map(([label, campoCajas, campoCosto]) => (
                      <div key={label} className="grid grid-cols-3 gap-3 items-center">
                        <span className="text-sm text-gray-600">Caja {label}</span>
                        <input type="number" step="0.5" min="0" value={form[campoCajas]}
                          onChange={(e) => set(campoCajas, e.target.value)}
                          placeholder="cajas"
                          className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-400" />
                        <input type="number" step="0.01" min="0" value={form[campoCosto]}
                          onChange={(e) => set(campoCosto, e.target.value)}
                          placeholder="L / caja"
                          className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-400" />
                      </div>
                    ))}
                  </div>
                </div>

                {/* Componentes opcionales */}
                <div>
                  <p className="text-sm font-semibold text-gray-700 mb-2">
                    Otros costos <span className="font-normal text-gray-400">(opcional — dejá en blanco si no aplica)</span>
                  </p>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Materiales (cajas, bolsas, etiquetas)</label>
                      <input type="number" step="0.01" min="0" value={form.costo_materiales}
                        onChange={(e) => set('costo_materiales', e.target.value)}
                        placeholder="L"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-400" />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Mano de obra propia</label>
                      <input type="number" step="0.01" min="0" value={form.costo_mano_obra}
                        onChange={(e) => set('costo_mano_obra', e.target.value)}
                        placeholder="L"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-400" />
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Notas</label>
                  <textarea value={form.notas} onChange={(e) => set('notas', e.target.value)} rows={2}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-400" />
                </div>

                {/* Resumen calculado en vivo */}
                <div className="bg-green-50 rounded-lg px-4 py-3 flex justify-between items-center">
                  <span className="text-sm text-gray-600">
                    {cajasActual} cajas en total
                  </span>
                  <span className="text-sm text-gray-600">
                    Costo total: <span className="font-semibold text-green-700 text-base">{L(costoActual)}</span>
                  </span>
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
    </div>
  )
}
