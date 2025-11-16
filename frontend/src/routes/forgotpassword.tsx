import { createFileRoute, Link } from '@tanstack/react-router'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { ArrowLeft } from 'lucide-react'

export const Route = createFileRoute('/forgotpassword')({
  component: RouteComponent,
})

function RouteComponent() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader className="space-y-1">
          <div className="flex items-center mb-2">
            <Link to="/login" className="text-muted-foreground hover:text-foreground transition-colors">
              <ArrowLeft className="h-5 w-5" />
            </Link>
          </div>
          <CardTitle className="text-3xl font-bold text-center">Forgot Password?</CardTitle>
          <CardDescription className="text-center">
            No worries! Enter your email and we'll send you reset instructions
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Email Input */}
          <div className="space-y-2">
            <Label htmlFor="email">Email Address</Label>
            <Input
              id="email"
              type="email"
              placeholder="name@example.com"
              className="h-11"
            />
          </div>

          {/* Submit Button */}
          <Button className="w-full" size="lg">
            Send Reset Link
          </Button>

          {/* Info Text */}
          <div className="bg-accent/50 p-4 rounded-md">
            <p className="text-sm text-center text-muted-foreground">
              We'll send you an email with instructions to reset your password. Please check your inbox and spam folder.
            </p>
          </div>
        </CardContent>
        <CardFooter className="flex flex-col space-y-4">
          <div className="text-sm text-center text-muted-foreground">
            Remember your password?{' '}
            <Link to="/login" className="text-primary hover:underline font-semibold">
              Sign in
            </Link>
          </div>
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
