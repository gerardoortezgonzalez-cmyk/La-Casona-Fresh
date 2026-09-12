import { useAuth } from './lib/AuthContext'
import Login from './components/Login'
import Layout from './components/Layout'
import GestionUsuarios from './components/GestionUsuarios'

export default function App() {
  const { session, perfil, cargando, esAdmin } = useAuth()

  if (cargando) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <p className="text-gray-500">Cargando…</p>
      </div>
    )
  }

  // Sin sesión → login
  if (!session) return <Login />

  // Con sesión pero sin perfil cargado (o inactivo)
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

  return (
    <Layout>
      {esAdmin ? (
        <GestionUsuarios />
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-2">Bienvenido</h2>
          <p className="text-gray-600 text-sm">
            La app está en construcción. Pronto vas a ver aquí los módulos según tu rol.
          </p>
        </div>
      )}
    </Layout>
  )
}
