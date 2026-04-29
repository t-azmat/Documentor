import express from 'express'
import { protect, requireRole } from '../middleware/authMiddleware.js'
import {
  getAdminOverview,
  getAdminUsers,
  updateAdminUser,
  getAdminTemplates,
  createAdminTemplate,
  updateAdminTemplate,
  deleteAdminTemplate,
  getAdminLogs,
  getAdminProjects,
  getAdminFormattingJobs
} from '../controllers/adminController.js'

const router = express.Router()

router.get('/overview/public', getAdminOverview)

router.use(protect)
router.use(requireRole('admin'))

router.get('/overview', getAdminOverview)
router.get('/users', getAdminUsers)
router.put('/users/:id', updateAdminUser)
router.get('/templates', getAdminTemplates)
router.post('/templates', createAdminTemplate)
router.put('/templates/:id', updateAdminTemplate)
router.delete('/templates/:id', deleteAdminTemplate)
router.get('/logs', getAdminLogs)
router.get('/projects', getAdminProjects)
router.get('/formatting-jobs', getAdminFormattingJobs)

export default router
