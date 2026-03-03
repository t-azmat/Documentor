import express from 'express'
import {
  register,
  login,
  getMe,
  forgotPassword,
  resetPassword,
  socialLogin,
  logout
} from '../controllers/authController.js'
import { protect } from '../middleware/authMiddleware.js'

const router = express.Router()

router.post('/register', register)
router.post('/login', login)
router.post('/social', socialLogin)
router.post('/forgot-password', forgotPassword)
router.put('/reset-password/:token', resetPassword)
router.get('/me', protect, getMe)
router.post('/logout', protect, logout)

export default router
