import express from 'express'
import {
  createProject,
  getProjects,
  getProject,
  updateProject,
  deleteProject,
  addDocumentToProject
} from '../controllers/projectController.js'
import { protect } from '../middleware/authMiddleware.js'

const router = express.Router()

router.use(protect)

router.route('/')
  .get(getProjects)
  .post(createProject)

router.route('/:id')
  .get(getProject)
  .put(updateProject)
  .delete(deleteProject)

router.post('/:id/documents/:documentId', addDocumentToProject)

export default router
