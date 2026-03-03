import Stripe from 'stripe'
import User from '../models/User.js'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)

// @desc    Get all subscription plans
// @route   GET /api/subscriptions/plans
// @access  Public
export const getPlans = async (req, res, next) => {
  try {
    const plans = [
      {
        id: 'free',
        name: 'Free',
        price: { monthly: 0, annual: 0 },
        features: [
          '5 documents per month',
          'Basic formatting (APA, MLA)',
          'Grammar checking',
          'Export to PDF'
        ]
      },
      {
        id: 'premium',
        name: 'Premium',
        price: { monthly: 19.99, annual: 179.99 },
        stripePriceIds: {
          monthly: 'price_premium_monthly',
          annual: 'price_premium_annual'
        },
        features: [
          'Unlimited documents',
          'All formatting styles',
          'Advanced grammar & tone',
          'Citation assistant',
          'Plagiarism detection (10/month)',
          'Export to PDF, DOCX, LaTeX'
        ]
      },
      {
        id: 'team',
        name: 'Team',
        price: { monthly: 49.99, annual: 479.99 },
        stripePriceIds: {
          monthly: 'price_team_monthly',
          annual: 'price_team_annual'
        },
        features: [
          'Everything in Premium',
          'Up to 10 team members',
          'Unlimited plagiarism checks',
          'Custom style templates',
          'Team collaboration',
          'API access',
          'Priority 24/7 support'
        ]
      }
    ]

    res.status(200).json({
      status: 'success',
      plans
    })
  } catch (error) {
    next(error)
  }
}

// @desc    Get user's current subscription
// @route   GET /api/subscriptions/current
// @access  Private
export const getCurrentSubscription = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id)

    res.status(200).json({
      status: 'success',
      subscription: user.subscription,
      usage: user.usage,
      limits: user.getUsageLimits()
    })
  } catch (error) {
    next(error)
  }
}

// @desc    Create checkout session for subscription
// @route   POST /api/subscriptions/create-checkout
// @access  Private
export const createCheckoutSession = async (req, res, next) => {
  try {
    const { plan, billingCycle } = req.body
    const user = await User.findById(req.user.id)

    if (plan === 'free') {
      return res.status(400).json({
        status: 'error',
        message: 'Free plan does not require checkout'
      })
    }

    // Price mapping (you would get these from Stripe dashboard)
    const priceIds = {
      premium: {
        monthly: 'price_premium_monthly_id',
        annual: 'price_premium_annual_id'
      },
      team: {
        monthly: 'price_team_monthly_id',
        annual: 'price_team_annual_id'
      }
    }

    const priceId = priceIds[plan]?.[billingCycle]
    
    if (!priceId) {
      return res.status(400).json({
        status: 'error',
        message: 'Invalid plan or billing cycle'
      })
    }

    // Create Stripe checkout session
    const session = await stripe.checkout.sessions.create({
      customer_email: user.email,
      client_reference_id: user._id.toString(),
      payment_method_types: ['card'],
      mode: 'subscription',
      line_items: [{
        price: priceId,
        quantity: 1
      }],
      success_url: `${process.env.FRONTEND_URL}/dashboard?success=true`,
      cancel_url: `${process.env.FRONTEND_URL}/pricing?cancelled=true`,
      metadata: {
        userId: user._id.toString(),
        plan,
        billingCycle
      }
    })

    res.status(200).json({
      status: 'success',
      sessionId: session.id,
      url: session.url
    })
  } catch (error) {
    next(error)
  }
}

// @desc    Update subscription after successful payment
// @route   POST /api/subscriptions/update
// @access  Private
export const updateSubscription = async (req, res, next) => {
  try {
    const { plan, billingCycle, stripeCustomerId, stripeSubscriptionId } = req.body
    const user = await User.findById(req.user.id)

    const prices = {
      premium: { monthly: 19.99, annual: 179.99 },
      team: { monthly: 49.99, annual: 479.99 }
    }

    user.subscription = {
      plan,
      status: 'active',
      billingCycle,
      startDate: new Date(),
      endDate: billingCycle === 'monthly' 
        ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
        : new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
      stripeCustomerId: stripeCustomerId || user.subscription.stripeCustomerId,
      stripeSubscriptionId: stripeSubscriptionId || user.subscription.stripeSubscriptionId,
      amount: prices[plan]?.[billingCycle] || 0
    }

    // Reset usage for new subscription
    user.usage.documentsThisMonth = 0
    user.usage.plagiarismChecksUsed = 0
    user.usage.lastResetDate = new Date()

    await user.save()

    res.status(200).json({
      status: 'success',
      message: 'Subscription updated successfully',
      subscription: user.subscription
    })
  } catch (error) {
    next(error)
  }
}

// @desc    Cancel subscription
// @route   POST /api/subscriptions/cancel
// @access  Private
export const cancelSubscription = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id)

    if (user.subscription.stripeSubscriptionId) {
      // Cancel Stripe subscription
      await stripe.subscriptions.update(user.subscription.stripeSubscriptionId, {
        cancel_at_period_end: true
      })
    }

    user.subscription.status = 'cancelled'
    await user.save()

    res.status(200).json({
      status: 'success',
      message: 'Subscription cancelled. You will retain access until the end of your billing period.',
      subscription: user.subscription
    })
  } catch (error) {
    next(error)
  }
}

// @desc    Stripe webhook handler
// @route   POST /api/subscriptions/webhook
// @access  Public
export const stripeWebhook = async (req, res, next) => {
  const sig = req.headers['stripe-signature']
  let event

  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    )
  } catch (err) {
    return res.status(400).send(`Webhook Error: ${err.message}`)
  }

  // Handle the event
  switch (event.type) {
    case 'checkout.session.completed':
      const session = event.data.object
      await handleCheckoutComplete(session)
      break
    
    case 'customer.subscription.updated':
      const subscription = event.data.object
      await handleSubscriptionUpdate(subscription)
      break
    
    case 'customer.subscription.deleted':
      const deletedSubscription = event.data.object
      await handleSubscriptionDeleted(deletedSubscription)
      break
    
    default:
      console.log(`Unhandled event type ${event.type}`)
  }

  res.json({ received: true })
}

// Helper function to handle checkout completion
async function handleCheckoutComplete(session) {
  const userId = session.metadata.userId
  const user = await User.findById(userId)
  
  if (user) {
    user.subscription.stripeCustomerId = session.customer
    user.subscription.stripeSubscriptionId = session.subscription
    await user.save()
  }
}

// Helper function to handle subscription updates
async function handleSubscriptionUpdate(subscription) {
  const user = await User.findOne({ 
    'subscription.stripeSubscriptionId': subscription.id 
  })
  
  if (user) {
    user.subscription.status = subscription.status
    await user.save()
  }
}

// Helper function to handle subscription deletion
async function handleSubscriptionDeleted(subscription) {
  const user = await User.findOne({ 
    'subscription.stripeSubscriptionId': subscription.id 
  })
  
  if (user) {
    user.subscription.plan = 'free'
    user.subscription.status = 'inactive'
    user.subscription.stripeSubscriptionId = null
    await user.save()
  }
}
