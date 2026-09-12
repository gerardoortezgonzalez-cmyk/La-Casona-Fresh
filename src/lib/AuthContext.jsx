import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from './supabase'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [perfil, setPerfil] = useState(null)
  const [cargando, setCargando] = useState(true)

  // Carga el perfil (nombre, rol) del usuario autenticado
  async function cargarPerfil(userId) {
    const { data, error } = await supabase
      .from('perfiles')
      .select('id, nombre, correo, rol, activo')
      .eq('id', userId)
      .single()
    if (error) {
      console.error('Error cargando perfil:', error.message)
      setPerfil(null)
    } else {
      setPerfil(data)
    }
  }

  useEffect(() => {
    // Sesión inicial
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      if (session?.user) {
        cargarPerfil(session.user.id).finally(() => setCargando(false))
      } else {
        setCargando(false)
      }
    })

    // Escuchar cambios de sesión (login / logout)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      if (session?.user) {
        cargarPerfil(session.user.id)
      } else {
        setPerfil(null)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  async function cerrarSesion() {
    await supabase.auth.signOut()
    setPerfil(null)
  }

  const valor = {
    session,
    usuario: session?.user ?? null,
    perfil,
    rol: perfil?.rol ?? null,
    cargando,
    cerrarSesion,
    // Helpers de permisos
    esSocio: perfil?.rol === 'socio',
    esAdmin: perfil?.rol === 'administrador',
    esCampo: perfil?.rol === 'campo',
    puedeEditar: perfil?.rol === 'administrador',
    puedeVerFinanzas: perfil?.rol === 'socio' || perfil?.rol === 'administrador',
  }

  return <AuthContext.Provider value={valor}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth debe usarse dentro de AuthProvider')
  return ctx
}
