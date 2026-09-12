import { useAuth } from '../lib/AuthContext'

const ETIQUETA_ROL = {
  socio: 'Socio',
  administrador: 'Administrador',
  campo: 'Campo',
}

export default function Layout({ children }) {
  const { perfil, cerrarSesion } = useAuth()

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold text-green-800">La Casona Fresh</h1>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right">
              <p className="text-sm font-medium text-gray-800">{perfil?.nombre || perfil?.correo}</p>
              <p className="text-xs text-gray-500">{ETIQUETA_ROL[perfil?.rol] || perfil?.rol}</p>
            </div>
            <button
              onClick={cerrarSesion}
              className="text-sm text-gray-500 hover:text-red-600 border border-gray-300 rounded-lg px-3 py-1.5"
            >
              Salir
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6">{children}</main>
    </div>
  )
}
