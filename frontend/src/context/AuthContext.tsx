// src/context/AuthContext.tsx
import { createContext, useContext, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabaseClient'
import { api } from '@/lib/api'

interface AuthContextProps {
  user: any | null // could be Supabase User or our backend user shape
  loading: boolean
  refetch: () => void
}

const AuthContext = createContext<AuthContextProps>({
  user: null,
  loading: true,
  refetch: () => {}
})

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const queryClient = useQueryClient()
  const [user, setUser] = useState<any | null>(null)
  const [loading, setLoading] = useState(true)

  // On mount, validate any existing token stored in localStorage with backend.
  // If no token is present, fall back to Supabase session check.
  useEffect(() => {
    let mounted = true

    const init = async () => {
      const token = localStorage.getItem('access_token') || localStorage.getItem('token')

      if (token) {
        try {
          const res = await api.get('/auth/me', { headers: { Authorization: `Bearer ${token}` } })
          if (!mounted) return
          // backend returns user info
          setUser(res.data)
        } catch (err) {
          // Token invalid or expired: clear it and ensure unauthenticated state
          localStorage.removeItem('access_token')
          localStorage.removeItem('token')
          if (!mounted) return
          setUser(null)
        } finally {
          if (!mounted) return
          setLoading(false)
        }
      } else {
        // No local token — try Supabase client session as fallback (for flows that rely on Supabase JS SDK)
        try {
          const { data } = await supabase.auth.getSession()
          if (!mounted) return
          setUser(data.session?.user ?? null)
        } catch (e) {
          if (!mounted) return
          setUser(null)
        } finally {
          if (!mounted) return
          setLoading(false)
        }
      }
    }

    init()

    return () => {
      mounted = false
    }
  }, [])

  // Listen to Supabase auth state changes and keep local user in sync
  // NOTE: Only manage Supabase OAuth sessions here, don't interfere with backend email/password tokens
  useEffect(() => {
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      queryClient.setQueryData(['auth', 'session'], session?.user ?? null)
      
      // Only clear tokens if we're explicitly signing out via Supabase
      // Don't clear tokens just because there's no Supabase session (user might be using email/password)
      if (_event === 'SIGNED_OUT') {
        setUser(null)
        localStorage.removeItem('access_token')
        localStorage.removeItem('token')
      } else if (session?.user) {
        // If we have a Supabase session, use it and store the token
        setUser(session.user)
        if (session.access_token) {
          localStorage.setItem('access_token', session.access_token)
        }
      }
    })

    return () => {
      listener.subscription.unsubscribe()
    }
  }, [queryClient])

  return (
    <AuthContext.Provider value={{
      user,
      loading,
      refetch: () => {
        // simplistic refetch: re-run the mount logic by forcing a page load of the provider
        // For now expose a thin refetch that other components can implement as needed.
        // Consumers can also call location.reload() as a last resort.
      }
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
