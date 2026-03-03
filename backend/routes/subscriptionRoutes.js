import express from 'express'
import {
  getPlans,
  getCurrentSubscription,
  createCheckoutSession,
  updateSubscription,
  cancelSubscription,
  stripeWebhook
} from '../controllers/subscriptionController.js'
import { protect } from '../middleware/authMiddleware.js'

const router = express.Router()

router.get('/plans', getPlans)
router.get('/current', protect, getCurrentSubscription)
router.post('/create-checkout', protect, createCheckoutSession)
router.post('/update', protect, updateSubscription)
router.post('/cancel', protect, cancelSubscription)
router.post('/webhook', express.raw({ type: 'application/json' }), stripeWebhook)

export default router
