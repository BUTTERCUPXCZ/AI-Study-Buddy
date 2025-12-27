import { createFileRoute, Link } from '@tanstack/react-router'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { ArrowLeft, Eye, EyeOff } from 'lucide-react'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import type { UseFormRegisterReturn } from 'react-hook-form'
import { useLogin, useOAuthSignIn } from '@/hooks/useAuth'
import { Spinner } from '@/components/ui/spinner'


const loginSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters long'),
})

type LoginFormData = z.infer<typeof loginSchema>

export const Route = createFileRoute('/login')({
  component: RouteComponent,
})

function RouteComponent() {
  const [oauthError, setOauthError] = useState<string>('')
  
  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
  })

  const { mutate: loginMutate, isPending, error: loginError } = useLogin()
  const { mutate: oauthSignIn, isPending: isOAuthLoading } = useOAuthSignIn()

  async function onSubmit(data: LoginFormData) {
    loginMutate(data, {
      onSuccess: () => {
        // Use window.location to trigger a full page reload
        // This ensures AuthContext reinitializes with the new token
        window.location.href = '/notes'
      }
    })
  }

  const handleOAuthLogin = (provider: 'google' | 'github') => {
    setOauthError('')
    
    oauthSignIn({ provider, mode: 'login' }, {
      onError: (error) => {
        console.error('OAuth error:', error)
        const message = error.message || `Failed to sign in with ${provider}. Please try again.`
        setOauthError(message)
      }
    })
  }



  return (
    <div className="relative w-full lg:grid lg:min-h-screen lg:grid-cols-2">
      <Link to="/LandingPage" className="absolute left-4 top-4 z-10 sm:left-6 sm:top-6">
        <Button
          variant="ghost"
          size="sm"
          className="flex items-center gap-2 px-3 text-slate-600 hover:text-blue-600 hover:bg-blue-50"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to home
        </Button>
      </Link>
      <div className="flex items-center justify-center py-12 bg-white">
        <div className="mx-auto grid w-full max-w-[350px] gap-6 px-4 sm:px-0">
          <div className="grid gap-2 text-center">
            <div className="flex items-center justify-center gap-2">
              <img src="/logo_svg.svg" alt="Buds logo" className="w-12 h-12 sm:w-14 sm:h-14 object-contain" />
              <span className="text-2xl text-slate-900 font-bold tracking-tight">Buds</span>
            </div>
            <h1 className="text-3xl font-bold text-slate-900">Welcome Back</h1>
            <p className="text-balance text-slate-600">
              Sign in to your account to continue
            </p>
          </div>
          <form onSubmit={handleSubmit(onSubmit)} className="grid gap-4">
            {/* Google OAuth Button */}
            <Button 
              variant="outline" 
              className="w-full" 
              size="lg" 
              type="button"
              onClick={() => handleOAuthLogin('google')}
              disabled={isOAuthLoading}
            >
              <svg className="mr-2 h-5 w-5" viewBox="0 0 24 24">
                <path
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  fill="#4285F4"
                />
                <path
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  fill="#34A853"
                />
                <path
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  fill="#FBBC05"
                />
                <path
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  fill="#EA4335"
                />
              </svg>
              {isOAuthLoading ? 'Connecting...' : 'Continue with Google'}
            </Button>

      

            {/* OAuth error message */}
            {oauthError && (
              <p className="text-sm text-destructive text-center">{oauthError}</p>
            )}

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <Separator />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-background px-2 text-muted-foreground">Or continue with email</span>
              </div>
            </div>

            {/* Email Input */}
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="name@example.com"
                className="h-11"
                {...register('email')}
              />
              {errors.email?.message && (
                <p className="text-sm text-destructive mt-1">{String(errors.email.message)}</p>
              )}
            </div>

            {/* Password Input */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Password</Label>
                <Link
                  to="/forgotpassword"
                  className="text-sm text-blue-600 hover:text-blue-700 hover:underline"
                >
                  Forgot password?
                </Link>
              </div>
              <PasswordField
                placeholder="Enter your password"
                id="password"
                registerProps={register('password')}
                error={errors.password?.message}
              />
            </div>

            {/* Login error message */}
            {loginError && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <p className="text-sm text-red-700 font-medium">Login failed</p>
                <p className="text-sm text-red-600 mt-1">{loginError.message}</p>
                {loginError.message.includes('verify your email') && (
                  <div className="mt-3">
                    <Link
                      to="/emailVerify"
                      search={{ email: watch('email') }}
                      className="text-sm text-blue-600 hover:text-blue-700 hover:underline"
                    >
                      Go to email verification →
                    </Link>
                  </div>
                )}
              </div>
            )}

            {/* Sign In Button */}
            <Button className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold shadow-md hover:shadow-lg transition-all" size="lg" type="submit" disabled={isSubmitting || isPending}>
              {isSubmitting || isPending ? (
                <span className="flex items-center gap-2">
                  <Spinner className="h-4 w-4" />
                  Signing in…
                </span>
              ) : (
                'Sign In'
              )}
            </Button>
          </form>

          <div className="text-center text-sm text-slate-600">
            Don't have an account?{' '}
            <Link to="/register" className="text-blue-600 hover:text-blue-700 hover:underline font-semibold">
              Sign up
            </Link>
          </div>
        </div>
      </div>
      <div className="hidden bg-slate-50 lg:block">
        <img
          src="https://images.unsplash.com/photo-1519389950473-47ba0277781c?q=80&w=2070&auto=format&fit=crop"
          alt="Image"
          className="h-full w-full object-cover dark:brightness-[0.2] dark:grayscale"
        />
      </div>
    </div>
  )
}

function PasswordField({
  id,
  placeholder,
  registerProps,
  error,
}: {
  id: string
  placeholder?: string
  registerProps?: UseFormRegisterReturn
  error?: string | undefined
}) {
  const [show, setShow] = useState(false)

  return (
    <div className="relative">
      <Input
        id={id}
        type={show ? 'text' : 'password'}
        placeholder={placeholder}
        className="h-11 pr-12"
        {...registerProps}
      />
      <button
        type="button"
        onClick={() => setShow(s => !s)}
        aria-label={show ? 'Hide password' : 'Show password'}
        className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-md text-muted-foreground hover:text-foreground"
      >
        {show ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
      </button>
  {error && <p className="text-sm text-destructive mt-1">{error}</p>}
    </div>
  )
}
