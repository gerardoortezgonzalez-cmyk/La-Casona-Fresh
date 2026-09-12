import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'

const ROLES = [
  { valor: 'socio', etiqueta: 'Socio (solo lectura)' },
  { valor: 'administrador', etiqueta: 'Administrador (todo)' },
  { valor: 'campo', etiqueta: 'Campo (solo captura)' },
]

export default function GestionUsuarios() {
  const { usuario } = useAuth()
  const [perfiles, setPerfiles] = useState([])
  const [cargando, setCargando] = useState(true)
  const [mensaje, setMensaje] = useState('')

  async function cargar() {
    setCargando(true)
    const { data, error } = await supabase
      .from('perfiles')
      .select('id, nombre, correo, rol, activo, creado_en')
      .order('creado_en', { ascending: true })
    if (error) {
      setMensaje('Error cargando usuarios: ' + error.message)
    } else {
      setPerfiles(data)
    }
    setCargando(false)
  }

  useEffect(() => { cargar() }, [])

  async function cambiarRol(id, nuevoRol) {
    setMensaje('')
    const { error } = await supabase
      .from('perfiles')
      .update({ rol: nuevoRol })
      .eq('id', id)
    if (error) {
      setMensaje('No se pudo cambiar el rol: ' + error.message)
    } else {
      setMensaje('Rol actualizado.')
      cargar()
    }
  }

  async function cambiarActivo(id, activo) {
    setMensaje('')
    const { error } = await supabase
      .from('perfiles')
      .update({ activo })
      .eq('id', id)
    if (error) {
      setMensaje('No se pudo actualizar: ' + error.message)
    } else {
      cargar()
    }
  }

  if (cargando) return <p className="text-gray-500">Cargando usuarios…</p>

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold text-gray-800">Usuarios</h2>
        <button
          onClick={cargar}
          className="text-sm text-green-700 hover:text-green-900"
        >
          Actualizar
        </button>
      </div>

      {mensaje && (
        <p className="text-sm mb-3 px-3 py-2 rounded-lg bg-gray-100 text-gray-700">{mensaje}</p>
      )}

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-600">
            <tr>
              <th className="text-left px-4 py-3 font-medium">Nombre</th>
              <th className="text-left px-4 py-3 font-medium">Correo</th>
              <th className="text-left px-4 py-3 font-medium">Rol</th>
              <th className="text-left px-4 py-3 font-medium">Activo</th>
            </tr>
          </thead>
          <tbody>
            {perfiles.map((p) => (
              <tr key={p.id} className="border-t border-gray-100">
                <td className="px-4 py-3">{p.nombre || <span className="text-gray-400">—</span>}</td>
                <td className="px-4 py-3 text-gray-600">{p.correo}</td>
                <td className="px-4 py-3">
                  <select
                    value={p.rol}
                    onChange={(e) => cambiarRol(p.id, e.target.value)}
                    disabled={p.id === usuario.id}
                    className="border border-gray-300 rounded-lg px-2 py-1 disabled:opacity-60"
                  >
                    {ROLES.map((r) => (
                      <option key={r.valor} value={r.valor}>{r.etiqueta}</option>
                    ))}
                  </select>
                  {p.id === usuario.id && (
                    <span className="ml-2 text-xs text-gray-400">(vos)</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <button
                    onClick={() => cambiarActivo(p.id, !p.activo)}
                    disabled={p.id === usuario.id}
                    className={`px-2 py-1 rounded-lg text-xs font-medium disabled:opacity-60 ${
                      p.activo
                        ? 'bg-green-100 text-green-800'
                        : 'bg-gray-200 text-gray-600'
                    }`}
                  >
                    {p.activo ? 'Activo' : 'Inactivo'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-4 text-sm text-gray-500 bg-blue-50 border border-blue-100 rounded-lg px-4 py-3">
        <strong className="text-blue-800">Para agregar un usuario nuevo:</strong> por ahora se crea
        desde el panel de Supabase (Authentication → Users → Add user). Aparecerá aquí
        automáticamente con rol «Campo», y desde esta pantalla le asignás el rol correcto.
      </div>
    </div>
  )
}
