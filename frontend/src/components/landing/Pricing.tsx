import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Link } from '@tanstack/react-router'
import { Check, X, Zap } from 'lucide-react'
import { motion } from 'framer-motion'
import { memo, useState } from 'react'
import { subscriptionService } from '@/services/SubscriptionService'
import { useAuth } from '@/context/AuthContextDefinition'



const Pricing = memo(function Pricing() {

  const { user } = useAuth()
  const [loading, setLoading] = useState(false)

  const handleUpgrade = async () => {
    if (!user) {
      // Redirect to login/register
      window.location.href = '/register'
      return
    }

    setLoading(true)
    try {
      await subscriptionService.createCheckoutSession()
    } catch (error) {
      console.error('Checkout error:', error)
      alert('Failed to start checkout. Please try again.')
    } finally {
      setLoading(false)
    }
  }
  
  const plans = [
    {
      name: "Free Plan",
      price: "₱0",
      priceId: "price_1SioOALvraiZhe3d2eRPMzmF",
      period: "forever",
      description: "Perfect for trying out our platform",
      buttonText: "Get Started Free",
      buttonVariant: "outline" as const,
      popular: false,
      features: [
        { text: "5 attempts total", included: true },
        { text: "Smart Note Summaries", included: true },
        { text: "Quiz Generation", included: true },
        { text: "AI Tutor Chat", included: true },
        { text: "PDF Processing", included: true },
        { text: "Unlimited attempts", included: false },
      ],
      limitations: "After 5 attempts, features will be disabled. Upgrade to Pro for unlimited access."
    },
    {
      name: "Pro",
      price: "₱100",
      priceId: "price_1SioOnLvraiZhe3dIu4KFEdI",
      period: "per month",
      description: "Unlimited access to all features",
      buttonText: "Upgrade to Pro",
      buttonVariant: "default" as const,
      popular: true,
      features: [
        { text: "Unlimited attempts", included: true },
        { text: "Smart Note Summaries", included: true },
        { text: "Quiz Generation", included: true },
        { text: "AI Tutor Chat", included: true },
        { text: "PDF Processing", included: true },
      ],
      limitations: null
    }
  ]

  return (
    <section id="pricing" className="py-24 relative overflow-hidden bg-gradient-to-b from-slate-50 to-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="text-center mb-16"
        >
          <div className="inline-flex items-center justify-center p-3 bg-blue-50 rounded-full mb-6">
            <Zap className="h-5 w-5 text-blue-600 mr-2" />
            <span className="font-medium text-blue-700">Simple, Transparent Pricing</span>
          </div>
          <h2 className="text-4xl md:text-5xl font-bold mb-6 text-slate-900">
            Choose Your Plan
          </h2>
          <p className="text-xl text-slate-600 max-w-2xl mx-auto">
            Start free and upgrade when you're ready. No credit card required to get started.
          </p>
        </motion.div>

        {/* Pricing Cards */}
        <div className="grid md:grid-cols-2 gap-8 max-w-5xl mx-auto">
          {plans.map((plan, index) => (
            <motion.div
              key={plan.name}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-50px" }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
              className="will-change-transform"
            >
              <Card
                className={`h-full border-2 transition-all duration-300 hover:shadow-2xl overflow-hidden rounded-2xl ${
                  plan.popular
                    ? 'border-primary shadow-xl bg-gradient-to-br from-blue-50 to-white relative'
                    : 'border-slate-200 shadow-lg bg-white'
                }`}
              >
                {plan.popular && (
                  <div className="absolute top-0 right-0 bg-primary text-primary-foreground px-4 py-1 rounded-bl-2xl rounded-tr-2xl text-sm font-semibold">
                    Most Popular
                  </div>
                )}
                
                <CardHeader className="pb-6 pt-8">
                  <div className="flex items-center justify-between mb-4">
                    <CardTitle className="text-3xl font-bold text-slate-900">
                      {plan.name}
                    </CardTitle>
                  </div>
                  <div className="flex items-baseline gap-2 mb-2">
                    <span className="text-5xl font-extrabold text-slate-900">
                      {plan.price}
                    </span>
                    {plan.period && (
                      <span className="text-slate-600 text-lg">
                        /{plan.period}
                      </span>
                    )}
                  </div>
                  <p className="text-slate-600 mt-2">{plan.description}</p>
                </CardHeader>

                <CardContent className="space-y-6">
                  {plan.name === "Free Plan" ? (
                    <Link to="/register" className="block">
                      <Button
                        variant={plan.buttonVariant}
                        size="lg"
                        className={`w-full h-12 text-base font-semibold rounded-full transition-all duration-300 ${
                          plan.popular
                            ? 'bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg hover:shadow-xl hover:-translate-y-0.5'
                            : 'border-2 hover:bg-slate-50'
                        }`}
                      >
                        {plan.buttonText}
                      </Button>
                    </Link>
                  ) : (
                    <Button
                      variant={plan.buttonVariant}
                      size="lg"
                      className={`w-full h-12 text-base font-semibold rounded-full transition-all duration-300 ${
                        plan.popular
                          ? 'bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg hover:shadow-xl hover:-translate-y-0.5'
                          : 'border-2 hover:bg-slate-50'
                      }`}
                      onClick={handleUpgrade}
                      disabled={loading}
                    >
                      {loading ? 'Processing...' : plan.buttonText}
                    </Button>
                  )}

                  {plan.limitations && (
                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                      <p className="text-sm text-amber-800">{plan.limitations}</p>
                    </div>
                  )}

                  <div className="space-y-3 pt-2">
                    <p className="text-sm font-semibold text-slate-900 mb-3">What's included:</p>
                    {plan.features.map((feature, featureIndex) => (
                      <div
                        key={featureIndex}
                        className="flex items-start gap-3"
                      >
                        {feature.included ? (
                          <div className="flex-shrink-0 w-5 h-5 rounded-full bg-blue-100 flex items-center justify-center mt-0.5">
                            <Check className="h-3.5 w-3.5 text-blue-600" />
                          </div>
                        ) : (
                          <div className="flex-shrink-0 w-5 h-5 rounded-full bg-slate-100 flex items-center justify-center mt-0.5">
                            <X className="h-3.5 w-3.5 text-slate-400" />
                          </div>
                        )}
                        <span
                          className={`text-sm ${
                            feature.included ? 'text-slate-700' : 'text-slate-400 line-through'
                          }`}
                        >
                          {feature.text}
                        </span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>

        {/* Feature Highlights */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="mt-16"
        >
        
        </motion.div>

        {/* FAQ or Additional Info */}
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.4 }}
          className="mt-12 text-center"
        >
          <p className="text-slate-600">
            All plans include secure authentication, real-time updates, and responsive design.{' '}
            <Link to="/register" className="text-primary hover:underline font-medium">
              Start your free trial today
            </Link>
            .
          </p>
        </motion.div>
      </div>
    </section>
  )
})

export default Pricing

