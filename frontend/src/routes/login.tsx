import { createFileRoute, Link } from '@tanstack/react-router'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Eye, EyeOff } from 'lucide-react'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import type { UseFormRegisterReturn } from 'react-hook-form'
import { authService } from '@/services/AuthService'
import { useLogin } from '@/hooks/useAuth'


const loginSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters long'),
})

type LoginFormData = z.infer<typeof loginSchema>

export const Route = createFileRoute('/login')({
  component: RouteComponent,
})

function RouteComponent() {
  const [oauthLoading, setOauthLoading] = useState(false)
  const [oauthError, setOauthError] = useState<string>('')
  
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
  })

  const { mutate: loginMutate, isPending, error: loginError } = useLogin()

  async function onSubmit(data: LoginFormData) {
    loginMutate(data, {
      onSuccess: () => {
        // Use window.location to trigger a full page reload
        // This ensures AuthContext reinitializes with the new token
        window.location.href = '/notes'
      }
    })
  }

  const handleOAuthLogin = async (provider: 'google' | 'github') => {
    try {
      setOauthLoading(true)
      setOauthError('')
      
      // Use the authService to initiate OAuth flow with 'login' mode
      await authService.signInWithOAuth(provider, 'login')
      
      // The redirect will happen automatically
    } catch (error: unknown) {
      console.error('OAuth error:', error)
      const message = (error as { message?: string }).message || `Failed to sign in with ${provider}. Please try again.`
      setOauthError(message)
    } finally {
      setOauthLoading(false)
    }
  }



  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader className="space-y-1">
          <CardTitle className="text-3xl font-bold text-center">Welcome Back</CardTitle>
          <CardDescription className="text-center">
            Sign in to your account to continue
          </CardDescription>
        </CardHeader>

        <form onSubmit={handleSubmit(onSubmit)}>
          <CardContent className="space-y-4">
            {/* Google OAuth Button */}
            <Button 
              variant="outline" 
              className="w-full" 
              size="lg" 
              type="button"
              onClick={() => handleOAuthLogin('google')}
              disabled={oauthLoading}
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
              {oauthLoading ? 'Connecting...' : 'Continue with Google'}
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
                <span className="bg-card px-2 text-muted-foreground">Or continue with email</span>
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
                  className="text-sm text-primary hover:underline"
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
              <p className="text-sm text-destructive text-center">{loginError.message}</p>
            )}

            {/* Sign In Button */}
            <Button className="w-full" size="lg" type="submit" disabled={isSubmitting || isPending}>
              {isSubmitting || isPending ? 'Signing in…' : 'Sign In'}
            </Button>
          </CardContent>
        </form>

        <CardFooter className="flex flex-col space-y-4">
          <div className="text-sm text-center text-muted-foreground">
            Don't have an account?{' '}
            <Link to="/register" className="text-primary hover:underline font-semibold">
              Sign up
            </Link>
          </div>
        </CardFooter>
      </Card>
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
