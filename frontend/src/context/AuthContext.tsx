// src/context/AuthContext.tsx
import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabaseClient'
import { api } from '@/lib/api'
import { AuthContext } from './AuthContextDefinition'

const USER_CACHE_KEY = 'auth_user_cache'
const CACHE_DURATION = 5 * 60 * 1000 // 5 minutes

interface CachedUser {
  data: unknown
  timestamp: number
}

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const queryClient = useQueryClient()

  // Helper functions for sessionStorage caching
  const getCachedUser = () => {
    try {
      const cached = sessionStorage.getItem(USER_CACHE_KEY)
      if (!cached) return null
      
      const parsed: CachedUser = JSON.parse(cached)
      const isExpired = Date.now() - parsed.timestamp > CACHE_DURATION
      
      return isExpired ? null : parsed.data
    } catch {
      return null
    }
  }

  const setCachedUser = (userData: unknown) => {
    try {
      const cache: CachedUser = {
        data: userData,
        timestamp: Date.now()
      }
      sessionStorage.setItem(USER_CACHE_KEY, JSON.stringify(cache))
    } catch {
      // Ignore cache errors
    }
  }

  const clearCachedUser = () => {
    try {
      sessionStorage.removeItem(USER_CACHE_KEY)
    } catch {
      // Ignore cache errors
    }
  }

  // Initialize user from cache immediately (optimistic loading)
  const [user, setUser] = useState<unknown | null>(getCachedUser())
  const [loading, setLoading] = useState(!getCachedUser()) // Only show loading if no cache

  // On mount, validate session with backend (cookie is sent automatically)
  useEffect(() => {
    let mounted = true

    const init = async () => {
      try {
        // Try to get current user - cookie is sent automatically
        const res = await api.get('/auth/me')
        if (!mounted) return
        setUser(res.data)
        setCachedUser(res.data) // Cache for next navigation
        queryClient.setQueryData(['auth', 'user'], res.data)
      } catch {
        // No valid session
        if (!mounted) return
        setUser(null)
        clearCachedUser()
        queryClient.setQueryData(['auth', 'user'], null)
        // Check for Supabase OAuth session
        try {
          const { data: { session } } = await supabase.auth.getSession()
          if (session?.access_token) {
            // Sync with backend to set cookie
            const res = await api.post('/auth/oauth/callback', {
              access_token: session.access_token,
            })
            if (!mounted) return
            setUser(res.data.user)
            setCachedUser(res.data.user)
            queryClient.setQueryData(['auth', 'user'], res.data.user)
          }
        } catch (oauthError) {
          console.error('OAuth session sync failed:', oauthError)
        }
      } finally {
        if (mounted) setLoading(false)
      }
    }

    init()

    return () => {
      mounted = false
    }
  }, [queryClient])

  // Listen to Supabase auth state changes and keep local user in sync
  useEffect(() => {
    const { data: listener } = supabase.auth.onAuthStateChange(async (_event, session) => {
      queryClient.setQueryData(['auth', 'session'], session?.user ?? null)
      
      if (session?.access_token) {
        try {
          // Sync OAuth session with backend to set cookie
          const res = await api.post('/auth/oauth/callback', {
            access_token: session.access_token,
          })
          setUser(res.data.user)
          setCachedUser(res.data.user)
          queryClient.setQueryData(['auth', 'user'], res.data.user)
        } catch (error) {
          console.error('Failed to sync OAuth state:', error)
          setUser(null)
          clearCachedUser()
          queryClient.setQueryData(['auth', 'user'], null)
        }
      } else if (_event === 'SIGNED_OUT') {
        // User signed out
        setUser(null)
        clearCachedUser()
        queryClient.setQueryData(['auth', 'user'], null)
        // Optionally call backend logout endpoint to clear cookie
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
      refetch: async () => {
        // Refetch user data from the backend
        try {
          const res = await api.get('/auth/me')
          setUser(res.data)
          setCachedUser(res.data)
          queryClient.setQueryData(['auth', 'user'], res.data)
        } catch {
          setUser(null)
          clearCachedUser()
          queryClient.setQueryData(['auth', 'user'], null)
        }
      }
    }}>
      {children}
    </AuthContext.Provider>
  )
}
