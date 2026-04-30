import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { FaCheck, FaTimes, FaCrown, FaRocket, FaStar, FaMoon, FaSun } from 'react-icons/fa'
import { MdArrowBack } from 'react-icons/md'
import useAuthStore from '../../store/authStore'
import useTheme from '../../hooks/useTheme'
import BrandMark from '../../components/BrandLogo/BrandMark'

const Pricing = () => {
  const navigate = useNavigate()
  const { isAuthenticated, updateSubscription } = useAuthStore()
  const { theme, isDark, toggleTheme } = useTheme()
  const [billingCycle, setBillingCycle] = useState('monthly') // 'monthly' or 'annual'
  const [selectedPlan, setSelectedPlan] = useState(null)

  const plans = [
    {
      id: 'free',
      name: 'Free',
      icon: FaStar,
      price: { monthly: 0, annual: 0 },
      description: 'Perfect for trying out Documentor',
      features: [
        { text: '5 documents per month', included: true },
        { text: 'Basic formatting (APA, MLA)', included: true },
        { text: 'Grammar checking', included: true },
        { text: 'Export to PDF', included: true },
        { text: 'Citation assistant', included: false },
        { text: 'Plagiarism detection', included: false },
        { text: 'Advanced AI formatting', included: false },
        { text: 'Priority support', included: false },
      ],
      popular: false,
      color: 'purple'
    },
    {
      id: 'premium',
      name: 'Premium',
      icon: FaCrown,
      price: { monthly: 19.99, annual: 179.99 },
      description: 'Best for students and researchers',
      features: [
        { text: 'Unlimited documents', included: true },
        { text: 'All formatting styles (APA, MLA, IEEE, Chicago)', included: true },
        { text: 'Advanced grammar & tone suggestions', included: true },
        { text: 'Export to PDF, DOCX, LaTeX', included: true },
        { text: 'Smart citation assistant', included: true },
        { text: 'Plagiarism detection (10 checks/month)', included: true },
        { text: 'AI-powered formatting engine', included: true },
        { text: 'Email support', included: true },
      ],
      popular: true,
      color: 'violet'
    },
    {
      id: 'team',
      name: 'Team',
      icon: FaRocket,
      price: { monthly: 49.99, annual: 479.99 },
      description: 'For teams and institutions',
      features: [
        { text: 'Everything in Premium', included: true },
        { text: 'Up to 10 team members', included: true },
        { text: 'Unlimited plagiarism checks', included: true },
        { text: 'Custom style templates', included: true },
        { text: 'Team collaboration features', included: true },
        { text: 'Admin dashboard & analytics', included: true },
        { text: 'API access', included: true },
        { text: 'Priority 24/7 support', included: true },
      ],
      popular: false,
      color: 'fuchsia'
    }
  ]

  const handleSelectPlan = (plan) => {
    setSelectedPlan(plan.id)
    
    // Simulate subscription purchase
    setTimeout(() => {
      updateSubscription({
        plan: plan.id,
        billingCycle: billingCycle,
        price: plan.price[billingCycle],
        startDate: new Date().toISOString()
      })
      
      if (isAuthenticated) {
        navigate('/dashboard')
      } else {
        navigate('/signup')
      }
    }, 500)
  }

  const getSavingsPercentage = (plan) => {
    if (plan.price.monthly === 0) return 0
    const monthlyCost = plan.price.monthly * 12
    const annualCost = plan.price.annual
    return Math.round(((monthlyCost - annualCost) / monthlyCost) * 100)
  }

  return (
    <div className="documentor-shell auth-animated-bg min-h-screen overflow-hidden bg-[#0c0e13]" data-theme={theme}>
      {/* Header */}
      <header className="border-b border-transparent bg-transparent shadow-none">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <BrandMark className="h-10 w-10 flex-shrink-0" />
              <span className="text-xl font-black tracking-normal text-white">
                Docu<span className="text-[#8b5cf6]">Mentor</span>
              </span>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={toggleTheme}
                className="flex h-9 w-9 items-center justify-center rounded-lg border border-[#8b5cf6]/20 bg-[#8b5cf6]/10 text-[#8b5cf6] transition hover:bg-[#8b5cf6]/15"
                aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
                title={isDark ? 'Light mode' : 'Dark mode'}
              >
                {isDark ? <FaSun /> : <FaMoon />}
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Back Button */}
        {isAuthenticated && (
          <button
            onClick={() => navigate('/dashboard')}
            className="inline-flex items-center text-gray-600 hover:text-gray-900 mb-6 transition-colors"
          >
            <MdArrowBack className="mr-2" />
            Back to dashboard
          </button>
        )}

        {/* Header Section */}
        <div className="text-center mb-12">
          <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
            Choose Your Plan
          </h1>
          <p className="text-xl text-gray-600 mb-8">
            Format research papers with AI-powered precision
          </p>

          {/* Billing Toggle */}
          <div className="inline-flex items-center rounded-full border border-[#8b5cf6]/20 bg-white p-1 shadow-md">
            <button
              onClick={() => setBillingCycle('monthly')}
              className={`px-6 py-2 rounded-full font-medium transition-all duration-200 ${
                billingCycle === 'monthly'
                  ? 'bg-[#8b5cf6] text-white'
                  : 'text-gray-700 hover:text-gray-900'
              }`}
            >
              Monthly
            </button>
            <button
              onClick={() => setBillingCycle('annual')}
              className={`px-6 py-2 rounded-full font-medium transition-all duration-200 ${
                billingCycle === 'annual'
                  ? 'bg-[#8b5cf6] text-white'
                  : 'text-gray-700 hover:text-gray-900'
              }`}
            >
              Annual
              <span className="ml-2 text-xs bg-[#8b5cf6]/10 text-[#8b5cf6] px-2 py-1 rounded-full">
                Save 25%
              </span>
            </button>
          </div>
        </div>

        {/* Pricing Cards */}
        <div className="grid md:grid-cols-3 gap-8 mb-12">
          {plans.map((plan) => {
            const Icon = plan.icon
            const savings = getSavingsPercentage(plan)
            
            return (
              <div
                key={plan.id}
                className={`relative bg-white rounded-2xl shadow-xl overflow-hidden transition-all duration-300 hover:shadow-2xl ${
                  plan.popular ? 'ring-4 ring-[#8b5cf6] scale-105' : ''
                }`}
              >
                {/* Popular Badge */}
                {plan.popular && (
                  <div className="absolute top-0 right-0 bg-[#8b5cf6] text-white px-4 py-1 text-sm font-medium rounded-bl-lg">
                    Most Popular
                  </div>
                )}

                <div className="p-8">
                  {/* Plan Header */}
                  <div className="flex items-center gap-3 mb-4">
                    <div className="p-3 bg-[#8b5cf6]/10 rounded-lg">
                      <Icon className="text-2xl text-[#8b5cf6]" />
                    </div>
                    <div>
                      <h3 className="text-2xl font-bold text-gray-900">{plan.name}</h3>
                    </div>
                  </div>

                  <p className="text-gray-600 mb-6">{plan.description}</p>

                  {/* Price */}
                  <div className="mb-6">
                    <div className="flex items-baseline gap-2">
                      <span className="text-5xl font-bold text-gray-900">
                        ${plan.price[billingCycle]}
                      </span>
                      <span className="text-gray-600">
                        /{billingCycle === 'monthly' ? 'month' : 'year'}
                      </span>
                    </div>
                    {billingCycle === 'annual' && savings > 0 && (
                      <p className="text-sm text-[#8b5cf6] font-medium mt-2">
                        Save {savings}% compared to monthly
                      </p>
                    )}
                  </div>

                  {/* CTA Button */}
                  <button
                    onClick={() => handleSelectPlan(plan)}
                    disabled={selectedPlan === plan.id}
                    className={`w-full py-3 px-6 rounded-lg font-medium transition-all duration-200 ${
                      plan.popular
                        ? 'bg-[#8b5cf6] text-white hover:bg-[#7c3aed]'
                        : 'bg-[#8b5cf6]/10 text-[#8b5cf6] hover:bg-[#8b5cf6]/15'
                    } ${selectedPlan === plan.id ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    {selectedPlan === plan.id ? 'Processing...' : plan.id === 'free' ? 'Get Started' : 'Subscribe Now'}
                  </button>

                  {/* Features List */}
                  <ul className="mt-8 space-y-4">
                    {plan.features.map((feature, index) => (
                      <li key={index} className="flex items-start gap-3">
                        {feature.included ? (
                          <FaCheck className="text-[#8b5cf6] mt-1 flex-shrink-0" />
                        ) : (
                          <FaTimes className="text-gray-300 mt-1 flex-shrink-0" />
                        )}
                        <span className={feature.included ? 'text-gray-700' : 'text-gray-400'}>
                          {feature.text}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )
          })}
        </div>

        {/* FAQ Section */}
        <div className="bg-white rounded-2xl shadow-lg p-8 mb-12">
          <h2 className="text-3xl font-bold text-gray-900 mb-6 text-center">
            Frequently Asked Questions
          </h2>
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <h3 className="font-semibold text-gray-900 mb-2">Can I change my plan later?</h3>
              <p className="text-gray-600">Yes, you can upgrade or downgrade your plan at any time. Changes will be reflected in your next billing cycle.</p>
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 mb-2">What payment methods do you accept?</h3>
              <p className="text-gray-600">We accept all major credit cards, PayPal, and bank transfers for annual subscriptions.</p>
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 mb-2">Is there a free trial?</h3>
              <p className="text-gray-600">The Free plan is available forever. Premium and Team plans offer a 7-day money-back guarantee.</p>
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 mb-2">Can I cancel anytime?</h3>
              <p className="text-gray-600">Yes, you can cancel your subscription at any time. You'll continue to have access until the end of your billing period.</p>
            </div>
          </div>
        </div>

        {/* Trust Badges */}
        <div className="text-center">
          <p className="text-gray-600 mb-4">Trusted by researchers and students worldwide</p>
          <div className="flex justify-center items-center gap-8 flex-wrap">
            <div className="text-gray-400 font-semibold">256-bit SSL Encryption</div>
            <div className="text-gray-400 font-semibold">GDPR Compliant</div>
            <div className="text-gray-400 font-semibold">Money-Back Guarantee</div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="bg-white border-t border-gray-200 mt-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <p className="text-center text-gray-600 text-sm">
            &copy; 2025 Documentor. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  )
}

export default Pricing
