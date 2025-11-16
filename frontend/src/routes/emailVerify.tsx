import { createFileRoute, Link } from '@tanstack/react-router'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Mail, CheckCircle, RefreshCw } from 'lucide-react'

export const Route = createFileRoute('/emailVerify')({
  component: RouteComponent,
})

function RouteComponent() {
  const [isResending, setIsResending] = useState(false)
  const [resendSuccess, setResendSuccess] = useState(false)

  const handleResendEmail = async () => {
    setIsResending(true)
    // Simulate API call to resend verification email
    try {
      // Replace with actual API call
      await new Promise(resolve => setTimeout(resolve, 1500))
      setResendSuccess(true)
      setTimeout(() => setResendSuccess(false), 3000)
    } catch (error) {
      console.error('Failed to resend email:', error)
    } finally {
      setIsResending(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader className="space-y-4 text-center">
          <div className="mx-auto w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center">
            <Mail className="w-8 h-8 text-primary" />
          </div>
          <CardTitle className="text-3xl font-bold">Verify Your Email</CardTitle>
          <CardDescription className="text-base">
            We've sent a verification link to your email address
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          <div className="bg-accent border border-border rounded-lg p-4 space-y-3">
            <div className="flex items-start gap-3">
              <Mail className="w-5 h-5 text-primary mt-0.5 shrink-0" />
              <div className="space-y-1">
                <p className="text-sm font-medium">Check your inbox</p>
                <p className="text-sm text-muted-foreground">
                  Click the verification link in the email we sent you to activate your account.
                </p>
              </div>
            </div>
          </div>

          {resendSuccess && (
            <div className="bg-primary/10 border border-primary/20 rounded-lg p-4 flex items-start gap-3">
              <CheckCircle className="w-5 h-5 text-primary mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-medium text-primary">Email sent successfully!</p>
                <p className="text-sm text-muted-foreground mt-0.5">
                  Please check your inbox and spam folder.
                </p>
              </div>
            </div>
          )}

          <div className="space-y-4">
            <div className="text-center space-y-2">
              <p className="text-sm text-muted-foreground">
                Didn't receive the email?
              </p>
              <Button
                variant="outline"
                className="w-full"
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
                <div className="w-full border-t border-border" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-card px-2 text-muted-foreground">Tips</span>
              </div>
            </div>

            <div className="bg-muted/50 rounded-lg p-4 space-y-2">
              <p className="text-xs font-medium text-foreground">Can't find the email?</p>
              <ul className="text-xs text-muted-foreground space-y-1.5 ml-4 list-disc">
                <li>Check your spam or junk folder</li>
                <li>Make sure you entered the correct email address</li>
                <li>Wait a few minutes and check again</li>
                <li>Try adding our email to your contacts</li>
              </ul>
            </div>
          </div>
        </CardContent>

        <CardFooter className="flex flex-col space-y-4">
          <div className="text-sm text-center text-muted-foreground">
            Already verified?{' '}
            <Link to="/login" className="text-primary hover:underline font-semibold">
              Sign in
            </Link>
          </div>
        </CardFooter>
      </Card>
    </div>
  )
}
