import { createFileRoute, useSearch, Link } from '@tanstack/react-router'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Mail, CheckCircle, RefreshCw } from 'lucide-react'
import { api } from '@/lib/api'

export const Route = createFileRoute('/emailVerify')({
  component: RouteComponent,
  validateSearch: (search) => ({
    email: (search.email as string) || '',
  }),
})

function RouteComponent() {
  const { email } = useSearch({ from: '/emailVerify' })
  const [isResending, setIsResending] = useState(false)
  const [resendSuccess, setResendSuccess] = useState(false)
  const [resendError, setResendError] = useState('')

  const handleResendEmail = async () => {
    if (!email) {
      setResendError('Email address is required')
      return
    }

    setIsResending(true)
    setResendError('')
    try {
      await api.post('/auth/resend-verification', { email })
      setResendSuccess(true)
      setTimeout(() => setResendSuccess(false), 3000)
    } catch (error: unknown) {
      console.error('Failed to resend email:', error)
      const message = (error as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Failed to resend email'
      setResendError(message)
    } finally {
      setIsResending(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
      <Card className="w-full max-w-md shadow-lg border-none">
        <CardHeader className="space-y-4 text-center">
          <div className="mx-auto w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center">
            <Mail className="w-8 h-8 text-blue-600" />
          </div>
          <CardTitle className="text-3xl font-bold text-slate-900">Verify Your Email</CardTitle>
          <CardDescription className="text-base text-slate-600">
            We've sent a verification link to your email address
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          <div className="bg-blue-50 border-none rounded-lg p-4 space-y-3">
            <div className="flex items-start gap-3">
              <Mail className="w-5 h-5 text-blue-600 mt-0.5 shrink-0" />
              <div className="space-y-1">
                <p className="text-sm font-medium text-slate-900">Check your inbox</p>
                <p className="text-sm text-slate-600">
                  Click the verification link in the email we sent you to activate your account.
                  {email && (
                    <span className="block mt-1 font-medium text-blue-600">
                      Email sent to: {email}
                    </span>
                  )}
                </p>
              </div>
            </div>
          </div>

          {resendSuccess && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-start gap-3">
              <CheckCircle className="w-5 h-5 text-green-600 mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-medium text-green-700">Email sent successfully!</p>
                <p className="text-sm text-green-600 mt-0.5">
                  Please check your inbox and spam folder.
                </p>
              </div>
            </div>
          )}

          {resendError && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
              <div className="w-5 h-5 text-red-600 mt-0.5 shrink-0">⚠️</div>
              <div>
                <p className="text-sm font-medium text-red-700">Failed to resend email</p>
                <p className="text-sm text-red-600 mt-0.5">
                  {resendError}
                </p>
              </div>
            </div>
          )}

          <div className="space-y-4">
            <div className="text-center space-y-2">
              <p className="text-sm text-slate-500">
                Didn't receive the email?
              </p>
              <Button
                variant="outline"
                className="w-full border-slate-200 text-slate-700 hover:bg-slate-50 hover:text-blue-600"
                size="lg"
                onClick={handleResendEmail}
                disabled={isResending}
              >
                {isResending ? (
                  <>
                    <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Resend Verification Email
                  </>
                )}
              </Button>
            </div>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-slate-200" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-slate-50 px-2 text-slate-500">Tips</span>
              </div>
            </div>

            <div className="bg-slate-50 rounded-lg p-4 space-y-2">
              <p className="text-xs font-medium text-slate-900">Can't find the email?</p>
              <ul className="text-xs text-slate-600 space-y-1.5 ml-4 list-disc">
                <li>Check your spam or junk folder</li>
                <li>Make sure you entered the correct email address</li>
                <li>Wait a few minutes and check again</li>
                <li>Try adding our email to your contacts</li>
              </ul>
            </div>
          </div>
        </CardContent>

        <CardFooter className="flex flex-col space-y-4">
          <div className="text-sm text-center text-slate-600">
            Already verified?{' '}
            <Link to="/login" className="text-blue-600 hover:underline font-semibold">
              Sign in
            </Link>
          </div>
        </CardFooter>
      </Card>
    </div>
  )
}
