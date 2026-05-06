import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { authService } from '@/services/AuthService'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import { useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/context/AuthContextDefinition'
import { postLoginPath } from '@/lib/postLoginPath'

export const Route = createFileRoute('/supabaseCallback')({
  component: RouteComponent,
})

function RouteComponent() {
  const [error, setError] = useState<string>('')
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { refetch: refetchAuth } = useAuth()

  useEffect(() => {
    const oauthMode = authService.getOAuthMode()
    setMode(oauthMode)

    const handleCallback = async () => {
      try {
        const searchParams = new URLSearchParams(window.location.search)

        if (window.location.hash && window.location.hash.startsWith('#')) {
          const hash = window.location.hash.substring(1)
          const hashParams = new URLSearchParams(hash)
          for (const [k, v] of hashParams.entries()) {
            searchParams.set(k, v)
          }
        }

        // Diagnostic — without these, a misrouted callback (PKCE `?code=`
        // when implicit flow is expected, missing `type=signup`, etc.) is
        // invisible. Open DevTools console after clicking the email link
        // and paste these lines if verification still fails.
        console.log('[supabaseCallback] href:', window.location.href)
        console.log('[supabaseCallback] hash:', window.location.hash)
        console.log('[supabaseCallback] search:', window.location.search)
        console.log(
          '[supabaseCallback] params:',
          Object.fromEntries(searchParams.entries()),
        )

        const errorParam = searchParams.get('error')
        const errorDescription = searchParams.get('error_description')

        // NOTE: do NOT strip query params here. The Supabase SDK's
        // `detectSessionInUrl` reads `?code=…` asynchronously after
        // page load to do the PKCE exchange. Wiping the URL too early
        // breaks that exchange.

        if (errorParam) {
          if (errorDescription) console.error('OAuth provider error:', errorDescription)
          setError('Authentication failed. Please try again.')
          setTimeout(() => {
            navigate({ to: '/login' })
          }, 3000)
          return
        }

        // Branch: email-verification callbacks carry `type=signup` /
        // `type=recovery`. Handle those first — they don't go through
        // the OAuth path below.
        const callbackType = searchParams.get('type')
        if (callbackType === 'signup') {
          setMode('register')
          try {
            await authService.handleEmailVerificationCallback()
          } catch (verifyErr: unknown) {
            // Surface the real reason so silent failures stop hiding
            // bugs (the previous catch-all redirected to /login with no
            // signal). AuthService already maps to user-safe messages.
            const message =
              verifyErr instanceof Error && verifyErr.message
                ? verifyErr.message
                : 'Email verification failed. Please request a new link.'
            console.error('Email verification callback error:', verifyErr)
            setError(message)
            setTimeout(() => {
              navigate({ to: '/login' })
            }, 3000)
            return
          }
          await queryClient.invalidateQueries({ queryKey: ['auth'] })
          navigate({ to: '/login' })
          return
        }

        // OAuth path. Supabase PKCE returns `?code=…` and the SDK
        // exchanges it for a session asynchronously. handleOAuthCallback
        // polls getSession() until that exchange finishes, then forwards
        // the token to our backend.
        await authService.handleOAuthCallback()

        authService.clearOAuthMode()

        // Drop user-scoped caches from any previous session in this
        // tab — same defensive cleanup useLogin does for password
        // login. Without it, stale `['notes']` etc. can satisfy the
        // first paint and the user sees zero data.
        queryClient.removeQueries({ queryKey: ['notes'] })
        queryClient.removeQueries({ queryKey: ['quizzes'] })
        queryClient.removeQueries({ queryKey: ['files'] })
        queryClient.removeQueries({ queryKey: ['note'] })
        queryClient.removeQueries({ queryKey: ['quiz'] })

        // AuthContext owns its own user state separately from the
        // Query cache. Without an explicit refetch the protected
        // route's beforeLoad sees AuthContext.user === null (set at
        // app boot when no cookie existed) and redirects to /login.
        const fresh = await refetchAuth()

        await queryClient.invalidateQueries({ queryKey: ['auth'] })

        // S12: any post-login redirect target supplied as a query
        // param must be whitelisted (postLoginPath delegates to
        // safeRedirect). Staff land on /admin by default, others on
        // /notes — matches the password-login flow.
        navigate({ to: postLoginPath(fresh, searchParams.get('redirect')) })
      } catch (err: unknown) {
        console.error('OAuth callback error:', err)
        setError('Authentication failed. Please try again.')
        setTimeout(() => {
          navigate({ to: '/login' })
        }, 3000)
      }
    }

    handleCallback()
  }, [navigate, queryClient, refetchAuth])

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
              <LoadingSpinner className="h-8 w-8" />
            </div>
          </>
        )}
      </div>
    </div>
  )
}