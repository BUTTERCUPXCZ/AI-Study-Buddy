import { useEffect, useState } from 'react'
import { createFileRoute, useNavigate, useSearch } from '@tanstack/react-router'
import { motion } from 'framer-motion'
import { Check, ArrowRight, Loader2, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { useCurrentUser } from '@/hooks/useAuth'
import { subscriptionService } from '@/services/SubscriptionService'

interface SubscriptionStatus {
  plan: 'FREE' | 'PRO'
  periodEnd: string | null
  attemptsUsed: number
  attemptsLimit: number | null
}

export const Route = createFileRoute('/subscription/success')({
  component: Success,
  validateSearch: (search: Record<string, unknown>) => ({
    session_id: (search.session_id as string) || undefined,
  }),
})

function Success() {
 const navigate = useNavigate()
  const search = useSearch({ from: '/subscription/success' })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [subscriptionData, setSubscriptionData] = useState<SubscriptionStatus | null>(null)
  const { refetch } = useCurrentUser()

  useEffect(() => {
    // Verify session and update user data
    const verifySession = async () => {
      try {
        // First call the verify-session fallback if we have a session id
        if (search.session_id) {
          try {
            await subscriptionService.verifySession(search.session_id as string)
          } catch (err) {
            // Do not fail the whole flow if the fallback fails; we'll still fetch status
            console.warn('verify-session fallback failed:', err)
          }
        }

        // Then fetch the latest subscription status
        const data = await subscriptionService.getSubscriptionStatus()
        setSubscriptionData(data)
        // Refresh user data
        refetch()
        // Show success page instead of redirecting immediately
        // navigate({ to: '/notes' })
      } catch (error) {
        console.error('Failed to verify subscription:', error)
        setError('Failed to verify subscription. Please try again.')
      } finally {
        setLoading(false)
      }
    }

    if (search.session_id) {
      verifySession()
    } else {
      setLoading(false)
    }
  }, [search.session_id, refetch])

  const handleGoToDashboard = () => {
    navigate({ to: '/notes' })
  }

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'N/A'
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
        <Card className="w-full max-w-md text-center">
          <CardContent className="pt-10 pb-10">
             <Loader2 className="h-10 w-10 animate-spin text-primary mx-auto mb-4" />
             <p className="text-muted-foreground">Verifying your subscription...</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (error) {
    return (
       <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
        <Card className="w-full max-w-md text-center border-destructive/20">
          <CardHeader>
             <div className="mx-auto bg-destructive/10 p-3 rounded-full w-fit mb-2">
                <AlertCircle className="h-6 w-6 text-destructive" />
             </div>
             <CardTitle>Verification Failed</CardTitle>
             <CardDescription>{error}</CardDescription>
          </CardHeader>
          <CardFooter className="justify-center">
             <Button onClick={handleGoToDashboard} variant="outline">
               Go to Dashboard
             </Button>
          </CardFooter>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md"
      >
        <Card className="text-center border-none shadow-lg">
          <CardHeader className="pb-2">
            <div className="mx-auto bg-green-100 p-4 rounded-full w-fit mb-4">
              <Check className="h-8 w-8 text-green-600" strokeWidth={3} />
            </div>
            <CardTitle className="text-2xl">Payment Successful!</CardTitle>
            <CardDescription className="text-base">
              Your account has been successfully upgraded to Pro.
            </CardDescription>
          </CardHeader>
          
          <CardContent className="py-6">
             <div className="bg-slate-50 rounded-lg p-4 text-left space-y-3 border">
                <div className="flex justify-between items-center">
                   <span className="text-sm text-muted-foreground">Plan</span>
                   <span className="font-medium">Pro Plan</span>
                </div>
                <div className="flex justify-between items-center">
                   <span className="text-sm text-muted-foreground">Status</span>
                   <span className="text-green-600 font-medium flex items-center gap-1">
                      Active <Check className="h-3 w-3" />
                   </span>
                </div>
                {subscriptionData?.periodEnd && (
                   <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Next Billing</span>
                      <span className="font-medium">{formatDate(subscriptionData.periodEnd)}</span>
                   </div>
                )}
             </div>
          </CardContent>

          <CardFooter className="flex flex-col gap-3 pb-8">
            <Button 
              onClick={handleGoToDashboard} 
              className="w-full h-11 text-base" 
              size="lg"
            >
              Go to Dashboard <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
            <p className="text-xs text-muted-foreground">
              A receipt has been sent to your email.
            </p>
          </CardFooter>
        </Card>
      </motion.div>
    </div>
  )
}

