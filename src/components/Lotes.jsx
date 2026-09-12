import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'

const ESTADOS = [
  { valor: 'preparacion', etiqueta: 'Preparación' },
  { valor: 'sembrado', etiqueta: 'Sembrado' },
  { valor: 'en_produccion', etiqueta: 'En producción' },
  { valor: 'cosechado', etiqueta: 'Cosechado' },
  { valor: 'descanso', etiqueta: 'En descanso' },
]

const COLOR_ESTADO = {
  preparacion: 'bg-gray-100 text-gray-700',
  sembrado: 'bg-blue-100 text-blue-800',
  en_produccion: 'bg-green-100 text-green-800',
  cosechado: 'bg-amber-100 text-amber-800',
  descanso: 'bg-gray-100 text-gray-500',
}

function etiquetaEstado(valor) {
  return ESTADOS.find((e) => e.valor === valor)?.etiqueta || valor
}

const LOTE_VACIO = {
  nombre: '',
  area_manzanas: '',
  cultivo: 'okra',
  variedad: '',
  fecha_siembra: '',
  estado: 'preparacion',
  notas: '',
}

export default function Lotes() {
  const { puedeEditar, usuario } = useAuth()
  const [lotes, setLotes] = useState([])
  const [cargando, setCargando] = useState(true)
  const [mensaje, setMensaje] = useState('')
  const [modalAbierto, setModalAbierto] = useState(false)
  const [editando, setEditando] = useState(null) // null = nuevo, objeto = editar
  const [form, setForm] = useState(LOTE_VACIO)
  const [guardando, setGuardando] = useState(false)

  async function cargar() {
    setCargando(true)
    const { data, error } = await supabase
      .from('lotes')
      .select('*')
      .eq('activo', true)
      .order('nombre', { ascending: true })
    if (error) {
      setMensaje('Error cargando lotes: ' + error.message)
    } else {
      setLotes(data)
    }
    setCargando(false)
  }

  useEffect(() => { cargar() }, [])

  function abrirNuevo() {
    setEditando(null)
    setForm(LOTE_VACIO)
    setMensaje('')
    setModalAbierto(true)
  }

  function abrirEditar(lote) {
    setEditando(lote)
    setForm({
      nombre: lote.nombre || '',
      area_manzanas: lote.area_manzanas ?? '',
      cultivo: lote.cultivo || 'okra',
      variedad: lote.variedad || '',
      fecha_siembra: lote.fecha_siembra || '',
      estado: lote.estado || 'preparacion',
      notas: lote.notas || '',
    })
    setMensaje('')
    setModalAbierto(true)
  }

  function actualizarCampo(campo, valor) {
    setForm((f) => ({ ...f, [campo]: valor }))
  }

  async function guardar() {
    setMensaje('')
    if (!form.nombre.trim()) {
      setMensaje('El nombre del lote es obligatorio.')
      return
    }
    setGuardando(true)

    const datos = {
      nombre: form.nombre.trim(),
      area_manzanas: form.area_manzanas === '' ? 0 : Number(form.area_manzanas),
      cultivo: form.cultivo.trim() || 'okra',
      variedad: form.variedad.trim(),
      fecha_siembra: form.fecha_siembra || null,
      estado: form.estado,
      notas: form.notas.trim(),
    }

    let error
    if (editando) {
      ({ error } = await supabase.from('lotes').update(datos).eq('id', editando.id))
    } else {
      ({ error } = await supabase.from('lotes').insert({ ...datos, creado_por: usuario.id }))
    }

    setGuardando(false)
    if (error) {
      setMensaje('No se pudo guardar: ' + error.message)
    } else {
      setModalAbierto(false)
      cargar()
    }
  }

  async function archivar(lote) {
    if (!confirm(`¿Archivar el lote "${lote.nombre}"? Dejará de aparecer en la lista.`)) return
    const { error } = await supabase.from('lotes').update({ activo: false }).eq('id', lote.id)
    if (error) {
      setMensaje('No se pudo archivar: ' + error.message)
    } else {
      cargar()
    }
  }

  if (cargando) return <p className="text-gray-500">Cargando lotes…</p>

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold text-gray-800">Lotes</h2>
        {puedeEditar && (
          <button
            onClick={abrirNuevo}
            className="bg-green-600 hover:bg-green-700 text-white text-sm font-medium px-4 py-2 rounded-lg"
          >
            + Nuevo lote
          </button>
        )}
      </div>

      {mensaje && !modalAbierto && (
        <p className="text-sm mb-3 px-3 py-2 rounded-lg bg-gray-100 text-gray-700">{mensaje}</p>
      )}

      {lotes.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-gray-500">
          No hay lotes registrados todavía.
          {puedeEditar && ' Creá el primero con «Nuevo lote».'}
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {lotes.map((lote) => (
            <div key={lote.id} className="bg-white rounded-xl border border-gray-200 p-4">
              <div className="flex items-start justify-between">
                <h3 className="font-semibold text-gray-800">{lote.nombre}</h3>
                <span className={`text-xs px-2 py-0.5 rounded-full ${COLOR_ESTADO[lote.estado]}`}>
                  {etiquetaEstado(lote.estado)}
                </span>
              </div>
              <div className="mt-2 space-y-1 text-sm text-gray-600">
                <p><span className="text-gray-400">Área:</span> {lote.area_manzanas} mz</p>
                <p><span className="text-gray-400">Cultivo:</span> {lote.cultivo}{lote.variedad ? ` — ${lote.variedad}` : ''}</p>
                {lote.fecha_siembra && (
                  <p><span className="text-gray-400">Siembra:</span> {lote.fecha_siembra}</p>
                )}
              </div>
              {puedeEditar && (
                <div className="mt-3 flex gap-2">
                  <button
                    onClick={() => abrirEditar(lote)}
                    className="text-sm text-green-700 hover:text-green-900"
                  >
                    Editar
                  </button>
                  <button
                    onClick={() => archivar(lote)}
                    className="text-sm text-gray-400 hover:text-red-600"
                  >
                    Archivar
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Modal de edición — con espacio, no apretado */}
      {modalAbierto && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <h3 className="text-lg font-semibold text-gray-800 mb-5">
                {editando ? 'Editar lote' : 'Nuevo lote'}
              </h3>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nombre *</label>
                  <input
                    type="text"
                    value={form.nombre}
                    onChange={(e) => actualizarCampo('nombre', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-400"
                    placeholder="Ej. Lote 1, Parcela norte…"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Área (manzanas)</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={form.area_manzanas}
                      onChange={(e) => actualizarCampo('area_manzanas', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-400"
                      placeholder="0.00"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Estado</label>
                    <select
                      value={form.estado}
                      onChange={(e) => actualizarCampo('estado', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-400"
                    >
                      {ESTADOS.map((e) => (
                        <option key={e.valor} value={e.valor}>{e.etiqueta}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Cultivo</label>
                    <input
                      type="text"
                      value={form.cultivo}
                      onChange={(e) => actualizarCampo('cultivo', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-400"
                      placeholder="okra"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Variedad</label>
                    <input
                      type="text"
                      value={form.variedad}
                      onChange={(e) => actualizarCampo('variedad', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-400"
                      placeholder="Ej. Clemson Spineless"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Fecha de siembra</label>
                  <input
                    type="date"
                    value={form.fecha_siembra}
                    onChange={(e) => actualizarCampo('fecha_siembra', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-400"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Notas</label>
                  <textarea
                    value={form.notas}
                    onChange={(e) => actualizarCampo('notas', e.target.value)}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-400"
                    placeholder="Observaciones del lote…"
                  />
                </div>

                {mensaje && (
                  <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{mensaje}</p>
                )}
              </div>

              <div className="mt-6 flex justify-end gap-3">
                <button
                  onClick={() => setModalAbierto(false)}
                  className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800"
                >
                  Cancelar
                </button>
                <button
                  onClick={guardar}
                  disabled={guardando}
                  className="bg-green-600 hover:bg-green-700 disabled:opacity-60 text-white text-sm font-medium px-5 py-2 rounded-lg"
                >
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
