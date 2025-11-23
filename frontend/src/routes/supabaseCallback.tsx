import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { authService } from '@/services/AuthService'

export const Route = createFileRoute('/supabaseCallback')({
  component: RouteComponent,
})

function RouteComponent() {
  const [error, setError] = useState<string>('')
  const [mode, setMode] = useState<'login' | 'register'>('login')

  useEffect(() => {
    // Get the OAuth mode from localStorage
    const oauthMode = authService.getOAuthMode()
    setMode(oauthMode)

    const handleCallback = async () => {
      try {
        // Parse URL for access token from OAuth redirect
        // Supabase may put the access token in the URL fragment (#) or in the query (?).
        const searchParams = new URLSearchParams(window.location.search)

        if (window.location.hash && window.location.hash.startsWith('#')) {
          const hash = window.location.hash.substring(1)
          const hashParams = new URLSearchParams(hash)
          for (const [k, v] of hashParams.entries()) {
            searchParams.set(k, v)
          }
        }

        const token = searchParams.get('access_token') || searchParams.get('access-token') || searchParams.get('token')
        const errorParam = searchParams.get('error')
        const errorDescription = searchParams.get('error_description')

        if (errorParam) {
          setError(errorDescription || 'Authentication failed')
          setTimeout(() => {
            window.location.href = '/login'
          }, 3000)
          return
        }

        if (!token) {
          setError('No authentication token found')
          setTimeout(() => {
            window.location.href = '/login'
          }, 2000)
          return
        }

        // Use authService to handle OAuth callback
        // This will sync user data with backend
        await authService.handleOAuthCallback()

        // Clear the OAuth mode from storage
        authService.clearOAuthMode()

        // Redirect to notes on success
        window.location.href = '/notes'
      } catch (err: unknown) {
        console.error('OAuth callback error:', err)
        const message = (err as { message?: string }).message || 'Authentication failed'
        setError(message)
        setTimeout(() => {
          window.location.href = '/login'
        }, 3000)
      }
    }

    handleCallback()
  }, [])

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md text-center space-y-4">
        {error ? (
          <>
            <h2 className="text-2xl font-semibold text-destructive">Authentication Error</h2>
            <p className="text-sm text-muted-foreground">{error}</p>
            <p className="text-sm text-muted-foreground">Redirecting to login...</p>
          </>
        ) : (
          <>
            <h2 className="text-2xl font-semibold">
              {mode === 'register' ? 'Signing you up...' : 'Signing you in...'}
            </h2>
            <p className="text-sm text-muted-foreground">Please wait — you'll be redirected shortly.</p>
            <div className="flex justify-center"> 
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

