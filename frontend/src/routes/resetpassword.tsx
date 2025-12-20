import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { CheckCircle2, Eye, EyeOff } from 'lucide-react'
import { authService } from '@/services/AuthService'

export const Route = createFileRoute('/resetpassword')({
  component: RouteComponent,
})

function RouteComponent() {
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [validToken, setValidToken] = useState(false)

  useEffect(() => {
    // Check if we have a valid reset token in the URL
    const checkToken = async () => {
      try {
        const isValid = await authService.verifyPasswordResetToken()
        setValidToken(isValid)
        if (!isValid) {
          setError('Invalid or expired reset link. Please request a new one.')
        }
      } catch {
        setValidToken(false)
        setError('Invalid or expired reset link. Please request a new one.')
      }
    }
    
    checkToken()
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    // Validation
    if (password.length < 8) {
      setError('Password must be at least 8 characters long')
      return
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match')
      return
    }

    setLoading(true)

    try {
      await authService.updatePassword(password)
      setSuccess(true)
      // Redirect to login after 3 seconds
      setTimeout(() => {
        navigate({ to: '/login' })
      }, 3000)
    } catch (err: unknown) {
      const message = (err as { message?: string }).message || 'Failed to reset password'
      setError(message)
    } finally {
      setLoading(false)
    }
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
        <Card className="w-full max-w-md shadow-lg border-none">
          <CardHeader className="space-y-1">
            <div className="flex justify-center mb-4">
              <CheckCircle2 className="h-16 w-16 text-green-500" />
            </div>
            <CardTitle className="text-3xl font-bold text-center text-slate-900">Password Reset Successful!</CardTitle>
            <CardDescription className="text-center text-slate-600">
              Your password has been successfully reset
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-blue-50 p-4 rounded-md">
              <p className="text-sm text-center text-slate-600">
                You can now sign in with your new password. Redirecting to login...
              </p>
            </div>
          </CardContent>
          <CardFooter className="flex flex-col space-y-4">
            <Link to="/login" className="w-full">
              <Button className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold shadow-md hover:shadow-lg transition-all">
                Go to Sign In
              </Button>
            </Link>
          </CardFooter>
        </Card>
      </div>
    )
  }

  if (!validToken && error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
        <Card className="w-full max-w-md shadow-lg border-none">
          <CardHeader className="space-y-1">
            <CardTitle className="text-3xl font-bold text-center text-destructive">Invalid Reset Link</CardTitle>
            <CardDescription className="text-center text-slate-600">
              {error}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-destructive/10 p-4 rounded-md">
              <p className="text-sm text-center text-slate-600">
                Reset links expire after 1 hour for security reasons. Please request a new password reset link.
              </p>
            </div>
          </CardContent>
          <CardFooter className="flex flex-col space-y-4">
            <Link to="/forgotpassword" className="w-full">
              <Button className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold shadow-md hover:shadow-lg transition-all">
                Request New Reset Link
              </Button>
            </Link>
            <Link to="/login" className="text-sm text-center text-slate-600 hover:text-blue-600">
              Return to Sign In
            </Link>
          </CardFooter>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
      <Card className="w-full max-w-md shadow-lg border-none">
        <CardHeader className="space-y-1">
          <CardTitle className="text-3xl font-bold text-center text-slate-900">Reset Your Password</CardTitle>
          <CardDescription className="text-center text-slate-600">
            Enter your new password below
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            {/* Error Message */}
            {error && (
              <div className="bg-destructive/10 text-destructive p-3 rounded-md text-sm">
                {error}
              </div>
            )}

            {/* New Password Input */}
            <div className="space-y-2">
              <Label htmlFor="password">New Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Enter new password"
                  className="h-11 pr-10"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={loading}
                  minLength={8}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <p className="text-xs text-slate-500">
                Must be at least 8 characters long
              </p>
            </div>

            {/* Confirm Password Input */}
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm New Password</Label>
              <div className="relative">
                <Input
                  id="confirmPassword"
                  type={showConfirmPassword ? 'text' : 'password'}
                  placeholder="Confirm new password"
                  className="h-11 pr-10"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  disabled={loading}
                  minLength={8}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {/* Submit Button */}
            <Button className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold shadow-md hover:shadow-lg transition-all" size="lg" type="submit" disabled={loading || !validToken}>
              {loading ? 'Resetting Password...' : 'Reset Password'}
            </Button>
          </CardContent>
        </form>
        <CardFooter className="flex flex-col space-y-4">
          <div className="text-sm text-center text-slate-600">
            Remember your password?{' '}
            <Link to="/login" className="text-blue-600 hover:text-blue-700 hover:underline font-semibold">
              Sign in
            </Link>
          </div>
        </CardFooter>
      </Card>
    </div>
  )
}
