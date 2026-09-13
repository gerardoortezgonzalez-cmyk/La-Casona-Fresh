import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'

function hoyISO() {
  return new Date().toISOString().slice(0, 10)
}
function L(n) {
  return 'L ' + Number(n || 0).toLocaleString('es-HN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}
function addDias(iso, n) {
  const d = new Date(iso + 'T00:00:00')
  d.setDate(d.getDate() + n)
  return d.toISOString().slice(0, 10)
}

const GRUPOS = [
  { valor: 'cosecha', etiqueta: 'Cosecha (semanal)' },
  { valor: 'supervision_riego', etiqueta: 'Supervisión / Riego (quincenal)' },
]
function etiquetaGrupo(v) {
  return GRUPOS.find((g) => g.valor === v)?.etiqueta || v
}

export default function Nomina() {
  const { usuario, esAdmin } = useAuth()
  const [subvista, setSubvista] = useState('liquidacion') // liquidacion | trabajadores
  const [trabajadores, setTrabajadores] = useState([])
  const [lotes, setLotes] = useState([])
  const [jornales, setJornales] = useState([])
  const [cargando, setCargando] = useState(true)
  const [mensaje, setMensaje] = useState('')

  // Rango de liquidación (por defecto: última semana)
  const [desde, setDesde] = useState(addDias(hoyISO(), -6))
  const [hasta, setHasta] = useState(hoyISO())

  // Modal trabajador
  const [modalTrab, setModalTrab] = useState(false)
  const [editTrab, setEditTrab] = useState(null)
  const [formTrab, setFormTrab] = useState({ nombre: '', grupo: 'cosecha', valor_jornal: '' })

  // Modal carga de jornales
  const [modalJornal, setModalJornal] = useState(false)
  const [jTrabajador, setJTrabajador] = useState('')
  const [jLote, setJLote] = useState('')
  const [jFraccion, setJFraccion] = useState('1')
  const [jDias, setJDias] = useState([hoyISO()])
  const [guardando, setGuardando] = useState(false)

  async function cargarBase() {
    const [tr, lo] = await Promise.all([
      supabase.from('trabajadores').select('*').eq('activo', true).order('nombre'),
      supabase.from('lotes').select('id, nombre').eq('activo', true).order('nombre'),
    ])
    setTrabajadores(tr.data || [])
    setLotes(lo.data || [])
  }

  async function cargarJornales() {
    setCargando(true)
    const { data, error } = await supabase
      .from('jornales')
      .select('*, trabajadores(nombre, grupo), lotes(nombre)')
      .gte('fecha', desde).lte('fecha', hasta)
      .order('fecha', { ascending: false })
    if (error) setMensaje('Error cargando jornales: ' + error.message)
    else setJornales(data || [])
    setCargando(false)
  }

  useEffect(() => { cargarBase() }, [])
  useEffect(() => { cargarJornales() }, [desde, hasta])

  // ---------- Trabajadores ----------
  function abrirNuevoTrab() {
    setEditTrab(null)
    setFormTrab({ nombre: '', grupo: 'cosecha', valor_jornal: '' })
    setMensaje('')
    setModalTrab(true)
  }
  function abrirEditarTrab(t) {
    setEditTrab(t)
    setFormTrab({ nombre: t.nombre, grupo: t.grupo, valor_jornal: t.valor_jornal })
    setMensaje('')
    setModalTrab(true)
  }
  async function guardarTrab() {
    if (!formTrab.nombre.trim()) { setMensaje('El nombre es obligatorio.'); return }
    const datos = {
      nombre: formTrab.nombre.trim(),
      grupo: formTrab.grupo,
      valor_jornal: formTrab.valor_jornal === '' ? 0 : Number(formTrab.valor_jornal),
    }
    let error
    if (editTrab) ({ error } = await supabase.from('trabajadores').update(datos).eq('id', editTrab.id))
    else ({ error } = await supabase.from('trabajadores').insert(datos))
    if (error) setMensaje('No se pudo guardar: ' + error.message)
    else { setModalTrab(false); cargarBase() }
  }
  async function archivarTrab(t) {
    if (!confirm(`¿Archivar a ${t.nombre}?`)) return
    const { error } = await supabase.from('trabajadores').update({ activo: false }).eq('id', t.id)
    if (!error) cargarBase()
  }

  // ---------- Carga de jornales ----------
  function abrirCargaJornal() {
    setJTrabajador(trabajadores[0]?.id || '')
    setJLote('')
    setJFraccion('1')
    setJDias([hoyISO()])
    setMensaje('')
    setModalJornal(true)
  }
  function toggleDia(iso) {
    setJDias((ds) => ds.includes(iso) ? ds.filter((d) => d !== iso) : (ds.length < 7 ? [...ds, iso] : ds))
  }
  // Genera los últimos 10 días como opciones para marcar
  const diasOpciones = Array.from({ length: 10 }, (_, i) => addDias(hoyISO(), -i))

  async function guardarJornales() {
    setMensaje('')
    if (!jTrabajador) { setMensaje('Elegí un trabajador.'); return }
    if (jDias.length === 0) { setMensaje('Marcá al menos un día.'); return }
    const trab = trabajadores.find((t) => t.id === jTrabajador)
    const fraccion = Number(jFraccion) || 1
    const valorUnit = Number(trab?.valor_jornal || 0) * fraccion

    setGuardando(true)
    const filas = jDias.map((fecha) => ({
      trabajador_id: jTrabajador,
      fecha,
      lote_id: jLote || null,
      fraccion,
      valor: valorUnit,
      creado_por: usuario.id,
    }))
    const { error } = await supabase.from('jornales').insert(filas)
    setGuardando(false)
    if (error) setMensaje('No se pudo guardar: ' + error.message)
    else { setModalJornal(false); cargarJornales() }
  }

  async function borrarJornal(id) {
    if (!confirm('¿Borrar este jornal?')) return
    const { error } = await supabase.from('jornales').delete().eq('id', id)
    if (!error) cargarJornales()
  }

  // ---------- Liquidación: agrupar por trabajador ----------
  const porTrabajador = {}
  for (const j of jornales) {
    const key = j.trabajador_id
    if (!porTrabajador[key]) {
      porTrabajador[key] = {
        nombre: j.trabajadores?.nombre || '—',
        grupo: j.trabajadores?.grupo,
        dias: 0, total: 0,
      }
    }
    porTrabajador[key].dias += Number(j.fraccion)
    porTrabajador[key].total += Number(j.valor)
  }
  const liquidacion = Object.values(porTrabajador).sort((a, b) => a.nombre.localeCompare(b.nombre))
  const totalNomina = liquidacion.reduce((s, l) => s + l.total, 0)

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold text-gray-800">Nómina y jornales</h2>
        {esAdmin && (
          <div className="flex gap-2">
            <button onClick={() => setSubvista(subvista === 'trabajadores' ? 'liquidacion' : 'trabajadores')}
              className="text-sm text-gray-600 hover:text-gray-800 border border-gray-300 px-3 py-2 rounded-lg">
              {subvista === 'trabajadores' ? 'Ver liquidación' : 'Trabajadores'}
            </button>
            {subvista === 'liquidacion' && (
              <button onClick={abrirCargaJornal}
                className="bg-green-600 hover:bg-green-700 text-white text-sm font-medium px-4 py-2 rounded-lg">
                + Cargar jornales
              </button>
            )}
            {subvista === 'trabajadores' && (
              <button onClick={abrirNuevoTrab}
                className="bg-green-600 hover:bg-green-700 text-white text-sm font-medium px-4 py-2 rounded-lg">
                + Trabajador
              </button>
            )}
          </div>
        )}
      </div>

      {mensaje && !modalTrab && !modalJornal && (
        <p className="text-sm mb-3 px-3 py-2 rounded-lg bg-gray-100 text-gray-700">{mensaje}</p>
      )}

      {/* -------- Vista Trabajadores -------- */}
      {subvista === 'trabajadores' ? (
        trabajadores.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-gray-500">
            No hay trabajadores registrados.
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-600">
                <tr>
                  <th className="text-left px-4 py-3 font-medium">Nombre</th>
                  <th className="text-left px-4 py-3 font-medium">Grupo</th>
                  <th className="text-right px-4 py-3 font-medium">Jornal</th>
                  {esAdmin && <th className="px-4 py-3"></th>}
                </tr>
              </thead>
              <tbody>
                {trabajadores.map((t) => (
                  <tr key={t.id} className="border-t border-gray-100">
                    <td className="px-4 py-3 font-medium text-gray-800">{t.nombre}</td>
                    <td className="px-4 py-3 text-gray-600">{etiquetaGrupo(t.grupo)}</td>
                    <td className="px-4 py-3 text-right">{L(t.valor_jornal)}</td>
                    {esAdmin && (
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        <button onClick={() => abrirEditarTrab(t)}
                          className="text-sm text-green-700 hover:text-green-900 mr-2">Editar</button>
                        <button onClick={() => archivarTrab(t)}
                          className="text-sm text-gray-400 hover:text-red-600">Archivar</button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      ) : (
        /* -------- Vista Liquidación -------- */
        <>
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
            <div className="flex gap-1 ml-auto">
              <button onClick={() => { setDesde(addDias(hoyISO(), -6)); setHasta(hoyISO()) }}
                className="text-xs px-2 py-1 border border-gray-300 rounded-lg text-gray-600 hover:bg-gray-50">Última semana</button>
              <button onClick={() => { setDesde(addDias(hoyISO(), -14)); setHasta(hoyISO()) }}
                className="text-xs px-2 py-1 border border-gray-300 rounded-lg text-gray-600 hover:bg-gray-50">Quincena</button>
            </div>
          </div>

          {cargando ? (
            <p className="text-gray-500">Cargando…</p>
          ) : liquidacion.length === 0 ? (
            <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-gray-500">
              No hay jornales registrados en este período.
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-gray-600">
                  <tr>
                    <th className="text-left px-4 py-3 font-medium">Trabajador</th>
                    <th className="text-left px-4 py-3 font-medium">Grupo</th>
                    <th className="text-center px-4 py-3 font-medium">Días</th>
                    <th className="text-right px-4 py-3 font-medium">A pagar</th>
                  </tr>
                </thead>
                <tbody>
                  {liquidacion.map((l, i) => (
                    <tr key={i} className="border-t border-gray-100">
                      <td className="px-4 py-3 font-medium text-gray-800">{l.nombre}</td>
                      <td className="px-4 py-3 text-gray-500 text-xs">{etiquetaGrupo(l.grupo)}</td>
                      <td className="px-4 py-3 text-center">{l.dias}</td>
                      <td className="px-4 py-3 text-right font-semibold">{L(l.total)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-gray-200 bg-gray-50">
                    <td colSpan={3} className="px-4 py-3 text-right font-medium text-gray-600">Total nómina:</td>
                    <td className="px-4 py-3 text-right font-bold text-green-700">{L(totalNomina)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}

          {/* Detalle de jornales del período */}
          {jornales.length > 0 && (
            <details className="mt-4">
              <summary className="text-sm text-gray-600 cursor-pointer hover:text-gray-800">
                Ver detalle de jornales ({jornales.length})
              </summary>
              <div className="mt-2 bg-white rounded-xl border border-gray-200 overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-gray-600">
                    <tr>
                      <th className="text-left px-4 py-2 font-medium">Fecha</th>
                      <th className="text-left px-4 py-2 font-medium">Trabajador</th>
                      <th className="text-left px-4 py-2 font-medium">Lote</th>
                      <th className="text-center px-4 py-2 font-medium">Fracción</th>
                      <th className="text-right px-4 py-2 font-medium">Valor</th>
                      {esAdmin && <th className="px-4 py-2"></th>}
                    </tr>
                  </thead>
                  <tbody>
                    {jornales.map((j) => (
                      <tr key={j.id} className="border-t border-gray-100">
                        <td className="px-4 py-2 text-gray-600">{j.fecha}</td>
                        <td className="px-4 py-2">{j.trabajadores?.nombre}</td>
                        <td className="px-4 py-2 text-gray-500">{j.lotes?.nombre || 'General'}</td>
                        <td className="px-4 py-2 text-center">{j.fraccion}</td>
                        <td className="px-4 py-2 text-right">{L(j.valor)}</td>
                        {esAdmin && (
                          <td className="px-4 py-2 text-right">
                            <button onClick={() => borrarJornal(j.id)}
                              className="text-xs text-gray-400 hover:text-red-600">Borrar</button>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>
          )}
        </>
      )}

      {/* Modal trabajador */}
      {modalTrab && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl w-full max-w-md">
            <div className="p-6">
              <h3 className="text-lg font-semibold text-gray-800 mb-5">
                {editTrab ? 'Editar trabajador' : 'Nuevo trabajador'}
              </h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nombre</label>
                  <input type="text" value={formTrab.nombre}
                    onChange={(e) => setFormTrab({ ...formTrab, nombre: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-400" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Grupo</label>
                  <select value={formTrab.grupo}
                    onChange={(e) => setFormTrab({ ...formTrab, grupo: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-400">
                    {GRUPOS.map((g) => <option key={g.valor} value={g.valor}>{g.etiqueta}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Valor del jornal (L)</label>
                  <input type="number" step="0.01" min="0" value={formTrab.valor_jornal}
                    onChange={(e) => setFormTrab({ ...formTrab, valor_jornal: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-400"
                    placeholder="0.00" />
                </div>
                {mensaje && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{mensaje}</p>}
              </div>
              <div className="mt-6 flex justify-end gap-3">
                <button onClick={() => setModalTrab(false)}
                  className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800">Cancelar</button>
                <button onClick={guardarTrab}
                  className="bg-green-600 hover:bg-green-700 text-white text-sm font-medium px-5 py-2 rounded-lg">Guardar</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal carga de jornales */}
      {modalJornal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <h3 className="text-lg font-semibold text-gray-800 mb-1">Cargar jornales</h3>
              <p className="text-sm text-gray-500 mb-5">Marcá los días trabajados (hasta 7 por tanda).</p>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Trabajador</label>
                    <select value={jTrabajador} onChange={(e) => setJTrabajador(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-400">
                      {trabajadores.map((t) => <option key={t.id} value={t.id}>{t.nombre}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Lote</label>
                    <select value={jLote} onChange={(e) => setJLote(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-400">
                      <option value="">General (sin lote)</option>
                      {lotes.map((l) => <option key={l.id} value={l.id}>{l.nombre}</option>)}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Fracción de jornal <span className="font-normal text-gray-400">(1 = día completo, 0.5 = medio para reparto)</span>
                  </label>
                  <input type="number" step="0.25" min="0.25" max="1" value={jFraccion}
                    onChange={(e) => setJFraccion(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-400" />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Días trabajados</label>
                  <div className="grid grid-cols-2 gap-2">
                    {diasOpciones.map((iso) => (
                      <button key={iso} onClick={() => toggleDia(iso)} type="button"
                        className={`px-3 py-2 rounded-lg text-sm border text-left ${
                          jDias.includes(iso)
                            ? 'bg-green-50 border-green-400 text-green-800'
                            : 'bg-white border-gray-300 text-gray-600 hover:bg-gray-50'
                        }`}>
                        {jDias.includes(iso) ? '✓ ' : ''}{iso}
                      </button>
                    ))}
                  </div>
                  <p className="text-xs text-gray-400 mt-2">{jDias.length} día(s) seleccionado(s)</p>
                </div>

                {mensaje && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{mensaje}</p>}
              </div>
              <div className="mt-6 flex justify-end gap-3">
                <button onClick={() => setModalJornal(false)}
                  className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800">Cancelar</button>
                <button onClick={guardarJornales} disabled={guardando}
                  className="bg-green-600 hover:bg-green-700 disabled:opacity-60 text-white text-sm font-medium px-5 py-2 rounded-lg">
                  {guardando ? 'Guardando…' : 'Guardar jornales'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
