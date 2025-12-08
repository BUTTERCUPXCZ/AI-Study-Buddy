import { createFileRoute, Link } from '@tanstack/react-router'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Eye, EyeOff } from 'lucide-react'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import type { UseFormRegisterReturn } from 'react-hook-form'
import { useRegister } from '@/hooks/useAuth'
import { authService } from '@/services/AuthService'
 

export const Route = createFileRoute('/register')({
  component: RouteComponent,
})

function RouteComponent() {
  const [oauthLoading, setOauthLoading] = useState(false)
  const [oauthError, setOauthError] = useState<string>('')
  
  const registerSchema = z
    .object({
      fullname: z.string().min(1, 'Full name is required'),
      email: z.string().email('Please enter a valid email address'),
      password: z.string().min(6, 'Password must be at least 6 characters long'),
      confirmPassword: z.string().min(6, 'Please confirm your password'),
    })
    .refine((data) => data.password === data.confirmPassword, {
      path: ['confirmPassword'],
      message: 'Passwords do not match',
    })

  type RegisterFormData = z.infer<typeof registerSchema>

  

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RegisterFormData>({
    resolver: zodResolver(registerSchema),
  })

  const { mutate, isPending, isSuccess, error, data, } = useRegister()

  const onSubmit = (formData: RegisterFormData) => {
    mutate({
      Fullname: formData.fullname,
      email: formData.email,
      password: formData.password,
    },
    {
    onSuccess: () => {
      // Redirect to the email verification page after successful registration.
      // Use a simple path string to avoid passing an unexpected object shape to useNavigate.
  // If router navigate typing is strict in this project, fall back to a direct
  // location change which reliably redirects the user to the verification page.
  window.location.href = `/emailVerify?email=${encodeURIComponent(formData.email)}`;
    },
  },
  );
  }

  const handleOAuthSignup = async (provider: 'google' | 'github') => {
    try {
      setOauthLoading(true)
      setOauthError('')
      
      // Use the authService to initiate OAuth flow with 'register' mode
      await authService.signInWithOAuth(provider, 'register')
      
      // The redirect will happen automatically
    } catch (error: unknown) {
      console.error('OAuth error:', error)
      const message = (error as { message?: string }).message || `Failed to sign up with ${provider}. Please try again.`
      setOauthError(message)
    } finally {
      setOauthLoading(false)
    }
  }

  return (
    <div className="w-full lg:grid lg:min-h-screen lg:grid-cols-2">
      <div className="flex items-center justify-center py-12">
        <div className="mx-auto grid w-full max-w-[350px] gap-6 px-4 sm:px-0">
          <div className="grid gap-2 text-center">
            <div className="flex items-center justify-center gap-2">
              <img src="/logo.png" alt="Buds logo" className="w-12 h-12 sm:w-14 sm:h-14 object-contain drop-shadow-sm" />
              <span className="text-2xl text-gray-800 font-extrabold">Buds</span>
            </div>
            <h1 className="text-3xl font-bold">Create Account</h1>
            <p className="text-balance text-muted-foreground">
              Sign up to get started with your account
            </p>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="grid gap-4">
            {/* Google OAuth Button */}
            <Button 
              variant="outline" 
              className="w-full" 
              size="lg" 
              type="button"
              onClick={() => handleOAuthSignup('google')}
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
                <span className="bg-background px-2 text-muted-foreground">
                  Or continue with email
                </span>
              </div>
            </div>

            {/* Fullname */}
            <div className="grid gap-2">
              <Label htmlFor="fullname">Full Name</Label>
              <Input id="fullname" type="text" placeholder="John Doe" className="h-11" {...register('fullname')} />
              {errors.fullname && <p className="text-sm text-destructive">{errors.fullname.message}</p>}
            </div>

            {/* Email */}
            <div className="grid gap-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" placeholder="name@example.com" className="h-11" {...register('email')} />
              {errors.email && <p className="text-sm text-destructive">{errors.email.message}</p>}
            </div>

            {/* Password */}
            <div className="grid gap-2">
              <Label htmlFor="password">Password</Label>
              <PasswordField id="password" placeholder="Create a password" registerProps={register('password')} error={errors.password?.message} />
            </div>

            {/* Confirm Password */}
            <div className="grid gap-2">
              <Label htmlFor="confirmPassword">Confirm Password</Label>
              <PasswordField id="confirmPassword" placeholder="Confirm your password" registerProps={register('confirmPassword')} error={errors.confirmPassword?.message} />
            </div>

            {/* Server messages */}
            {error && <p className="text-sm text-destructive text-center mt-2">{error.message}</p>}
            {isSuccess && <p className="text-sm text-green-600 text-center mt-2">{data?.message}</p>}

            <Button className="w-full" size="lg" type="submit" disabled={isPending}>
              {isPending ? 'Creating…' : 'Create Account'}
            </Button>

            <p className="text-xs text-center text-muted-foreground">
              By signing up, you agree to our{' '}
              <a href="#" className="text-primary hover:underline">Terms of Service</a> and{' '}
              <a href="#" className="text-primary hover:underline">Privacy Policy</a>
            </p>
          </form>

          <div className="text-center text-sm">
            Already have an account?{' '}
            <Link to="/login" className="text-primary hover:underline font-semibold">
              Sign in
            </Link>
          </div>
        </div>
      </div>
      <div className="hidden bg-muted lg:block">
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
  error?: string
}) {
  const [show, setShow] = useState(false)

  return (
    <div className="relative">
      <Input id={id} type={show ? 'text' : 'password'} placeholder={placeholder} className="h-11 pr-12" {...registerProps} />
      <button
        type="button"
        onClick={() => setShow((s) => !s)}
        className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-md text-muted-foreground hover:text-foreground"
      >
        {show ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
      </button>
      {error && <p className="text-sm text-destructive mt-1">{error}</p>}
    </div>
  )
}
