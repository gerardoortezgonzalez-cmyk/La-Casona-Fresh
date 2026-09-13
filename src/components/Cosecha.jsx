import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'

function hoyISO() {
  return new Date().toISOString().slice(0, 10)
}

export default function Cosecha() {
  const { usuario, esAdmin, esCampo } = useAuth()
  const [lotes, setLotes] = useState([])
  const [cosechas, setCosechas] = useState([])
  const [cargando, setCargando] = useState(true)
  const [mensaje, setMensaje] = useState('')
  const [filtroFecha, setFiltroFecha] = useState(hoyISO())

  // Formulario de captura rápida
  const [loteId, setLoteId] = useState('')
  const [cestas, setCestas] = useState('')
  const [fecha, setFecha] = useState(hoyISO())
  const [notas, setNotas] = useState('')
  const [guardando, setGuardando] = useState(false)

  const puedeRegistrar = esAdmin || esCampo

  async function cargarLotes() {
    const { data } = await supabase
      .from('lotes')
      .select('id, nombre, cultivo, variedad')
      .eq('activo', true)
      .order('nombre')
    setLotes(data || [])
    if (data && data.length && !loteId) setLoteId(data[0].id)
  }

  async function cargarCosechas() {
    setCargando(true)
    const { data, error } = await supabase
      .from('cosechas')
      .select('id, fecha, cestas, cultivo, variedad, notas, creado_por, lotes(nombre)')
      .eq('fecha', filtroFecha)
      .order('creado_en', { ascending: false })
    if (error) {
      setMensaje('Error cargando cosecha: ' + error.message)
    } else {
      setCosechas(data || [])
    }
    setCargando(false)
  }

  useEffect(() => { cargarLotes() }, [])
  useEffect(() => { cargarCosechas() }, [filtroFecha])

  async function registrar() {
    setMensaje('')
    if (!loteId) { setMensaje('Elegí un lote.'); return }
    if (cestas === '' || Number(cestas) <= 0) { setMensaje('Ingresá la cantidad de cestas.'); return }

    setGuardando(true)
    const lote = lotes.find((l) => l.id === loteId)
    const { error } = await supabase.from('cosechas').insert({
      fecha,
      lote_id: loteId,
      cestas: Number(cestas),
      cultivo: lote?.cultivo || 'okra',
      variedad: lote?.variedad || '',
      notas: notas.trim(),
      creado_por: usuario.id,
    })
    setGuardando(false)
    if (error) {
      setMensaje('No se pudo registrar: ' + error.message)
    } else {
      setCestas('')
      setNotas('')
      if (fecha === filtroFecha) cargarCosechas()
      else setFiltroFecha(fecha)
    }
  }

  async function borrar(id) {
    if (!confirm('¿Borrar este registro de cosecha?')) return
    const { error } = await supabase.from('cosechas').delete().eq('id', id)
    if (error) {
      setMensaje('No se pudo borrar: ' + error.message)
    } else {
      cargarCosechas()
    }
  }

  const totalCestas = cosechas.reduce((s, c) => s + Number(c.cestas), 0)

  function puedeModificar(c) {
    if (esAdmin) return true
    if (esCampo) return c.creado_por === usuario.id && c.fecha === hoyISO()
    return false
  }

  return (
    <div>
      <h2 className="text-xl font-semibold text-gray-800 mb-4">Captura de cosecha</h2>

      {/* Formulario de captura rápida */}
      {puedeRegistrar && (
        <div className="bg-white rounded-xl border border-gray-200 p-4 mb-6">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Registrar cosecha del día</h3>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Fecha</label>
              <input
                type="date"
                value={fecha}
                max={hoyISO()}
                onChange={(e) => setFecha(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-400"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Lote</label>
              <select
                value={loteId}
                onChange={(e) => setLoteId(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-400"
              >
                {lotes.map((l) => (
                  <option key={l.id} value={l.id}>{l.nombre}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Cestas</label>
              <input
                type="number"
                step="0.5"
                min="0"
                value={cestas}
                onChange={(e) => setCestas(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-400"
                placeholder="0"
              />
            </div>
            <div className="flex items-end">
              <button
                onClick={registrar}
                disabled={guardando}
                className="w-full bg-green-600 hover:bg-green-700 disabled:opacity-60 text-white text-sm font-medium py-2 rounded-lg"
              >
                {guardando ? 'Guardando…' : 'Registrar'}
              </button>
            </div>
          </div>
          <div className="mt-3">
            <input
              type="text"
              value={notas}
              onChange={(e) => setNotas(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-400 text-sm"
              placeholder="Notas (opcional)"
            />
          </div>
          {mensaje && (
            <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2 mt-3">{mensaje}</p>
          )}
        </div>
      )}

      {/* Filtro de fecha y listado */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-600">Ver día:</label>
          <input
            type="date"
            value={filtroFecha}
            onChange={(e) => setFiltroFecha(e.target.value)}
            className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
          />
        </div>
        <div className="text-sm text-gray-600">
          Total del día: <span className="font-semibold text-green-700">{totalCestas} cestas</span>
        </div>
      </div>

      {cargando ? (
        <p className="text-gray-500">Cargando…</p>
      ) : cosechas.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-gray-500">
          No hay cosecha registrada para esta fecha.
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-600">
              <tr>
                <th className="text-left px-4 py-3 font-medium">Lote</th>
                <th className="text-left px-4 py-3 font-medium">Cultivo</th>
                <th className="text-right px-4 py-3 font-medium">Cestas</th>
                <th className="text-left px-4 py-3 font-medium">Notas</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {cosechas.map((c) => (
                <tr key={c.id} className="border-t border-gray-100">
                  <td className="px-4 py-3 font-medium text-gray-800">{c.lotes?.nombre || '—'}</td>
                  <td className="px-4 py-3 text-gray-600">
                    {c.cultivo}{c.variedad ? ` — ${c.variedad}` : ''}
                  </td>
                  <td className="px-4 py-3 text-right font-semibold">{c.cestas}</td>
                  <td className="px-4 py-3 text-gray-500">{c.notas || ''}</td>
                  <td className="px-4 py-3 text-right">
                    {puedeModificar(c) && (
                      <button
                        onClick={() => borrar(c.id)}
                        className="text-xs text-gray-400 hover:text-red-600"
                      >
                        Borrar
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
