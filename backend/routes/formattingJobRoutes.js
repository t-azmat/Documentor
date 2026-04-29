import express from 'express'
import multer from 'multer'
import {
  createFormattingJob,
  getFormattingJobStatus,
  cancelFormattingJob,
  getFormattingJobResult,
  downloadFormattingJobResult,
  runExperimentalFormattingEngine,
  downloadExperimentalFormattingResult
} from '../controllers/formattingJobController.js'
import { protect } from '../middleware/authMiddleware.js'

const router = express.Router()
const guidelineUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['.pdf', '.docx', '.txt']
    const ext = file.originalname?.toLowerCase().match(/\.[^.]+$/)?.[0] || ''
    if (allowed.includes(ext)) cb(null, true)
    else cb(new Error('Guideline file must be PDF, DOCX, or TXT'))
  }
})

router.use(protect)

router.post('/new-engine/run', guidelineUpload.single('guidelines'), runExperimentalFormattingEngine)
router.get('/new-engine/:runId/download', downloadExperimentalFormattingResult)
router.post('/experimental-engine', runExperimentalFormattingEngine)
router.get('/experimental-engine/:runId/download', downloadExperimentalFormattingResult)

router.post('/', createFormattingJob)
router.get('/:jobId', getFormattingJobStatus)
router.post('/:jobId/cancel', cancelFormattingJob)
router.get('/:jobId/result', getFormattingJobResult)
router.get('/:jobId/download', downloadFormattingJobResult)

export default router
