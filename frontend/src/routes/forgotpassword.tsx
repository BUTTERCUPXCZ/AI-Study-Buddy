import { createFileRoute, Link } from '@tanstack/react-router'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { ArrowLeft, CheckCircle2 } from 'lucide-react'
import { authService } from '@/services/AuthService'

export const Route = createFileRoute('/forgotpassword')({
  component: RouteComponent,
})

function RouteComponent() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      await authService.resetPassword(email)
      setSuccess(true)
    } catch (err: unknown) {
      const message = (err as { message?: string }).message || 'Failed to send reset email'
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
            <CardTitle className="text-3xl font-bold text-center text-slate-900">Check Your Email</CardTitle>
            <CardDescription className="text-center text-slate-600">
              We've sent a password reset link to <strong>{email}</strong>
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-blue-50 p-4 rounded-md">
              <p className="text-sm text-center text-slate-600">
                Please check your inbox and spam folder. The link will expire in 1 hour.
              </p>
            </div>
          </CardContent>
          <CardFooter className="flex flex-col space-y-4">
            <Button 
              variant="outline" 
              className="w-full border-slate-200 text-slate-700 hover:bg-slate-50"
              onClick={() => setSuccess(false)}
            >
              Send Another Link
            </Button>
            <div className="text-sm text-center text-slate-600">
              <Link to="/login" className="text-blue-600 hover:text-blue-700 hover:underline font-semibold">
                Return to Sign In
              </Link>
            </div>
          </CardFooter>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
      <Card className="w-full max-w-md shadow-lg border-none">
        <CardHeader className="space-y-1">
          <div className="flex items-center mb-2">
            <Link to="/login" className="text-slate-500 hover:text-slate-900 transition-colors">
              <ArrowLeft className="h-5 w-5" />
            </Link>
          </div>
          <CardTitle className="text-3xl font-bold text-center text-slate-900">Forgot Password?</CardTitle>
          <CardDescription className="text-center text-slate-600">
            No worries! Enter your email and we'll send you reset instructions
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

            {/* Email Input */}
            <div className="space-y-2">
              <Label htmlFor="email">Email Address</Label>
              <Input
                id="email"
                type="email"
                placeholder="name@example.com"
                className="h-11"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={loading}
              />
            </div>

            {/* Submit Button */}
            <Button className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold shadow-md hover:shadow-lg transition-all" size="lg" type="submit" disabled={loading}>
              {loading ? 'Sending...' : 'Send Reset Link'}
            </Button>

            {/* Info Text */}
            <div className="bg-blue-50 p-4 rounded-md">
              <p className="text-sm text-center text-slate-600">
                We'll send you an email with instructions to reset your password. Please check your inbox and spam folder.
              </p>
            </div>
          </CardContent>
        </form>
        <CardFooter className="flex flex-col space-y-4">
          <div className="text-sm text-center text-slate-600">
            Remember your password?{' '}
            <Link to="/login" className="text-blue-600 hover:text-blue-700 hover:underline font-semibold">
              Sign in
            </Link>
          </div>
          <div className="text-sm text-center text-slate-600">
            Don't have an account?{' '}
            <Link to="/register" className="text-blue-600 hover:text-blue-700 hover:underline font-semibold">
              Sign up
            </Link>
          </div>
        </CardFooter>
      </Card>
    </div>
  )
}
