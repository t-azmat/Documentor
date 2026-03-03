import express from 'express'
import {
  getUserProfile,
  updateUserProfile,
  updatePassword,
  getUserUsage,
  deleteUserAccount
} from '../controllers/userController.js'
import { protect } from '../middleware/authMiddleware.js'

const router = express.Router()

router.use(protect)

router.route('/profile')
  .get(getUserProfile)
  .put(updateUserProfile)

router.put('/password', updatePassword)
router.get('/usage', getUserUsage)
router.delete('/account', deleteUserAccount)

export default router
