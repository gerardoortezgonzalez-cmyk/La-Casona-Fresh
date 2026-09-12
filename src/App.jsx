import { useState } from 'react'
import { useAuth } from './lib/AuthContext'
import Login from './components/Login'
import Layout from './components/Layout'
import GestionUsuarios from './components/GestionUsuarios'
import Lotes from './components/Lotes'

export default function App() {
  const { session, perfil, cargando, esAdmin } = useAuth()
  const [vista, setVista] = useState('lotes')

  if (cargando) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <p className="text-gray-500">Cargando…</p>
      </div>
    )
  }

  if (!session) return <Login />

  if (!perfil) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <p className="text-gray-600 text-center">
          Tu usuario no tiene un perfil asignado. Contactá al administrador.
        </p>
      </div>
    )
  }

  if (!perfil.activo) {
    return (
      <Layout>
        <p className="text-gray-600">Tu cuenta está desactivada. Contactá al administrador.</p>
      </Layout>
    )
  }

  // Pestañas disponibles según rol
  const pestanas = [
    { id: 'lotes', etiqueta: 'Lotes', visible: true },
    { id: 'usuarios', etiqueta: 'Usuarios', visible: esAdmin },
  ].filter((p) => p.visible)

  return (
    <Layout>
      <nav className="flex gap-1 mb-6 border-b border-gray-200">
        {pestanas.map((p) => (
          <button
            key={p.id}
            onClick={() => setVista(p.id)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition ${
              vista === p.id
                ? 'border-green-600 text-green-700'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {p.etiqueta}
          </button>
        ))}
      </nav>

      {vista === 'lotes' && <Lotes />}
      {vista === 'usuarios' && esAdmin && <GestionUsuarios />}
    </Layout>
  )
}
