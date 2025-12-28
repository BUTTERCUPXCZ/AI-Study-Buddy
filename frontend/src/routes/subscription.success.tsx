import { useEffect, useState } from 'react'
import { createFileRoute, useNavigate, useSearch } from '@tanstack/react-router'
import { motion } from 'framer-motion'
import { CheckCircle2, Sparkles, ArrowRight, Crown, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-slate-50 flex items-center justify-center p-4">
      {/* Animated Background Elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 left-10 w-72 h-72 bg-blue-200 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-blob"></div>
        <div className="absolute top-40 right-10 w-72 h-72 bg-purple-200 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-blob animation-delay-2000"></div>
        <div className="absolute -bottom-8 left-1/2 w-72 h-72 bg-pink-200 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-blob animation-delay-4000"></div>
      </div>

      <div className="relative z-10 w-full max-w-2xl">
        {loading ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-center"
          >
            <Card className="border-2 border-blue-200 shadow-2xl bg-white/80 backdrop-blur-sm">
              <CardContent className="p-12">
                <div className="flex flex-col items-center gap-6">
                  <div className="relative">
                    <motion.div
                      className="w-20 h-20 border-4 border-blue-200 border-t-blue-600 rounded-full"
                      animate={{ rotate: 360 }}
                      transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                    />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold text-slate-900 mb-2">
                      Verifying Your Subscription
                    </h2>
                    <p className="text-slate-600">
                      Please wait while we confirm your payment...
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ) : error ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center"
          >
            <Card className="border-2 border-amber-200 shadow-2xl bg-white/80 backdrop-blur-sm">
              <CardContent className="p-12">
                <div className="flex flex-col items-center gap-6">
                  <div className="w-20 h-20 rounded-full bg-amber-100 flex items-center justify-center">
                    <span className="text-4xl">⚠️</span>
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold text-slate-900 mb-2">
                      Verification Issue
                    </h2>
                    <p className="text-slate-600 mb-6">{error}</p>
                    <Button onClick={handleGoToDashboard} variant="outline">
                      Go to Dashboard
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ) : (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5 }}
            className="text-center"
          >
            {/* Success Card */}
            <Card className="border-2 border-green-200 shadow-2xl bg-white/90 backdrop-blur-sm overflow-hidden">
              <CardContent className="p-0">
                {/* Header with Gradient */}
                <div className="bg-gradient-to-r from-blue-600 via-blue-500 to-purple-600 p-8 text-white relative overflow-hidden">
                  {/* Decorative Elements */}
                  <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -mr-32 -mt-32"></div>
                  <div className="absolute bottom-0 left-0 w-48 h-48 bg-white/10 rounded-full -ml-24 -mb-24"></div>
                  
                  <div className="relative z-10">
                    {/* Animated Checkmark */}
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{
                        type: "spring",
                        stiffness: 200,
                        damping: 15,
                        delay: 0.2
                      }}
                      className="inline-flex items-center justify-center w-24 h-24 bg-white/20 rounded-full backdrop-blur-sm mb-6"
                    >
                      <motion.div
                        initial={{ pathLength: 0 }}
                        animate={{ pathLength: 1 }}
                        transition={{ duration: 0.5, delay: 0.5 }}
                        className="w-16 h-16"
                      >
                        <CheckCircle2 className="w-full h-full text-white" strokeWidth={2.5} />
                      </motion.div>
                    </motion.div>

                    <motion.h1
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.4 }}
                      className="text-4xl md:text-5xl font-bold mb-3"
                    >
                      Payment Successful!
                    </motion.h1>
                    <motion.p
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.5 }}
                      className="text-blue-100 text-lg"
                    >
                      Welcome to Pro! Your subscription is now active.
                    </motion.p>
                  </div>
                </div>

                {/* Content Section */}
                <div className="p-8 md:p-12">
                  {/* Pro Badge */}
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.6 }}
                    className="inline-flex items-center gap-2 bg-gradient-to-r from-blue-50 to-purple-50 border-2 border-blue-200 rounded-full px-6 py-3 mb-8"
                  >
                    <Crown className="w-5 h-5 text-blue-600" />
                    <span className="font-semibold text-blue-900">Pro Plan Active</span>
                    <Sparkles className="w-4 h-4 text-purple-600" />
                  </motion.div>

                  {/* Subscription Details */}
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.7 }}
                    className="space-y-6 mb-8"
                  >
                    <div className="text-left max-w-md mx-auto space-y-4">
                      <div className="flex items-start gap-3 p-4 bg-slate-50 rounded-lg border border-slate-200">
                        <div className="flex-shrink-0 w-6 h-6 rounded-full bg-green-100 flex items-center justify-center mt-0.5">
                          <Check className="h-4 w-4 text-green-600" />
                        </div>
                        <div className="flex-1">
                          <p className="font-semibold text-slate-900 mb-1">Unlimited Access</p>
                          <p className="text-sm text-slate-600">
                            You now have unlimited attempts for all AI features
                          </p>
                        </div>
                      </div>

                      <div className="flex items-start gap-3 p-4 bg-slate-50 rounded-lg border border-slate-200">
                        <div className="flex-shrink-0 w-6 h-6 rounded-full bg-green-100 flex items-center justify-center mt-0.5">
                          <Check className="h-4 w-4 text-green-600" />
                        </div>
                        <div className="flex-1">
                          <p className="font-semibold text-slate-900 mb-1">All Features Unlocked</p>
                          <p className="text-sm text-slate-600">
                            Smart Notes, Quiz Generation, AI Tutor, and PDF Processing
                          </p>
                        </div>
                      </div>

                      {subscriptionData?.periodEnd && (
                        <div className="flex items-start gap-3 p-4 bg-blue-50 rounded-lg border border-blue-200">
                          <div className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center mt-0.5">
                            <Check className="h-4 w-4 text-blue-600" />
                          </div>
                          <div className="flex-1">
                            <p className="font-semibold text-blue-900 mb-1">Next Billing Date</p>
                            <p className="text-sm text-blue-700">
                              {formatDate(subscriptionData.periodEnd)}
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  </motion.div>

                  {/* CTA Button */}
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.8 }}
                    className="flex flex-col sm:flex-row gap-4 justify-center items-center"
                  >
                    <Button
                      onClick={handleGoToDashboard}
                      size="lg"
                      className="w-full sm:w-auto bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-700 hover:to-blue-600 text-white shadow-lg hover:shadow-xl transition-all duration-300 rounded-full px-8 py-6 text-base font-semibold group"
                    >
                      Start Using Pro Features
                      <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
                    </Button>
                  </motion.div>

                  {/* Additional Info */}
                  <motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 1 }}
                    className="text-sm text-slate-500 mt-8"
                  >
                    Need help? Contact us at{' '}
                    <a href="mailto:support@example.com" className="text-blue-600 hover:underline">
                      support@example.com
                    </a>
                  </motion.p>
                </div>
              </CardContent>
            </Card>

            {/* Confetti Effect (CSS-based) */}
            <div className="fixed inset-0 pointer-events-none z-0">
              {[...Array(50)].map((_, i) => {
                const colors = ['#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b']
                const randomColor = colors[Math.floor(Math.random() * colors.length)]
                const randomLeft = Math.random() * 100
                const randomSize = 4 + Math.random() * 4
                const randomDelay = Math.random() * 2
                const randomDuration = 3 + Math.random() * 2
                
                return (
                  <motion.div
                    key={i}
                    className="absolute rounded-full"
                    style={{
                      left: `${randomLeft}%`,
                      top: '-10px',
                      backgroundColor: randomColor,
                      opacity: 0.7,
                      boxShadow: '0 0 6px currentColor',
                      width: `${randomSize}px`,
                      height: `${randomSize}px`,
                      animation: `confetti-fall ${randomDuration}s linear forwards`,
                      animationDelay: `${randomDelay}s`,
                    }}
                  />
                )
              })}
            </div>
          </motion.div>
        )}
      </div>

      <style>{`
        @keyframes blob {
          0%, 100% {
            transform: translate(0, 0) scale(1);
          }
          33% {
            transform: translate(30px, -50px) scale(1.1);
          }
          66% {
            transform: translate(-20px, 20px) scale(0.9);
          }
        }
        .animate-blob {
          animation: blob 7s infinite;
        }
        .animation-delay-2000 {
          animation-delay: 2s;
        }
        .animation-delay-4000 {
          animation-delay: 4s;
        }
        @keyframes confetti-fall {
          to {
            transform: translateY(100vh) rotate(360deg);
            opacity: 0;
          }
        }
      `}</style>
    </div>
  )
}

