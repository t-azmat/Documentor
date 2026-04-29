import axios from 'axios'
import crypto from 'crypto'
import fs from 'fs'
import FormData from 'form-data'

import Document from '../models/Document.js'
import FormattingJob from '../models/FormattingJob.js'
import formattingJobQueue from '../services/formattingJobQueue.js'

const PYTHON_NLP_URL = process.env.PYTHON_NLP_URL || 'http://localhost:5001'

const STYLE_SET = new Set(['APA', 'MLA', 'IEEE', 'Chicago', 'Harvard'])
const EXPERIMENTAL_STYLE_SET = new Set(['ieee', 'apa', 'acm', 'nature', 'elsevier', 'chicago'])
const EXPERIMENTAL_DOWNLOAD_SET = new Set(['docx', 'pdf', 'tex', 'ir', 'layout'])
const EXPERIMENTAL_RUN_ENDPOINTS = [
  '/api/formatting/new-engine',
  '/api/formatting/experimental-engine'
]
const EXPERIMENTAL_DOWNLOAD_ENDPOINTS = [
  '/api/formatting/new-engine/download',
  '/api/formatting/experimental-engine/download'
]

const buildCorrelationId = (req) => {
  return req.headers['x-correlation-id'] || crypto.randomUUID()
}

const sanitizeFileName = (value) => {
  return String(value || 'formatted_document')
    .replace(/[\\/:*?"<>|]+/g, '_')
    .replace(/\s+/g, '_')
    .slice(0, 80)
}

const serializeJob = (job) => {
  if (!job) return null

  const progress = job.progress || {}
  const result = job.result || {}
  const metrics = job.metrics || {}

  return {
    _id: job._id,
    id: job._id,
    documentId: job.documentId,
    userId: job.userId,
    style: job.style,
    status: job.status,
    source: job.source,
    progress: {
      percentage: progress.percentage || 0,
      stageName: progress.stageName || 'queued',
      stageIndex: progress.stageIndex || 0,
      currentChunk: progress.currentChunk || 0,
      totalChunks: progress.totalChunks || 0,
      message: progress.message || '',
      elapsedMs: progress.elapsedMs || 0,
      retries: progress.retries || 0,
      updatedAt: progress.updatedAt
    },
    metrics: {
      stageName: progress.stageName || 'queued',
      elapsedMs: progress.elapsedMs || 0,
      retries: progress.retries || 0,
      queueWaitMs: metrics.queueWaitMs || 0,
      totalElapsedMs: metrics.totalElapsedMs || 0,
      queueBackend: metrics.queueBackend || 'in-process',
      stageTimings: metrics.stageTimings || []
    },
    resultSummary: {
      stateful: Boolean(result.stateful),
      sectionsCount: result.metadata?.sectionsCount || result.plainSections?.length || 0,
      hasLatex: Boolean(result.latex),
      hasBib: Boolean(result.bib),
      chunksProcessed: result.metadata?.chunksProcessed || 0
    },
    error: job.error,
    cancellationRequested: Boolean(job.cancellationRequested),
    attempts: job.attempts || 0,
    startedAt: job.startedAt,
    completedAt: job.completedAt,
    canceledAt: job.canceledAt,
    createdAt: job.createdAt,
    updatedAt: job.updatedAt
  }
}

const ensureJobOwnership = async (jobId, userId) => {
  const job = await FormattingJob.findById(jobId)
  if (!job) return { error: { code: 404, message: 'Formatting job not found' } }
  if (job.userId.toString() !== userId) {
    return { error: { code: 403, message: 'Not authorized to access this formatting job' } }
  }
  return { job }
}

export const createFormattingJob = async (req, res, next) => {
  try {
    const correlationId = buildCorrelationId(req)
    const {
      documentId,
      formattingStyle = 'APA',
      useStatefulPipeline = false
    } = req.body || {}

    if (!documentId) {
      return res.status(400).json({
        status: 'error',
        message: 'documentId is required'
      })
    }

    if (!STYLE_SET.has(formattingStyle)) {
      return res.status(400).json({
        status: 'error',
        message: `Unsupported formatting style: ${formattingStyle}`
      })
    }

    const document = await Document.findOne({
      _id: documentId,
      userId: req.user.id
    })

    if (!document) {
      return res.status(404).json({
        status: 'error',
        message: 'Document not found'
      })
    }

    if (!document.content?.raw && !Array.isArray(document.content?.structuredBlocks)) {
      return res.status(400).json({
        status: 'error',
        message: 'Document content is empty; upload/extract content first'
      })
    }

    const activeJob = await FormattingJob.findOne({
      userId: req.user.id,
      documentId: document._id,
      status: { $in: ['queued', 'running'] }
    }).sort({ createdAt: -1 })

    if (activeJob) {
      return res.status(409).json({
        status: 'error',
        message: 'A formatting job is already active for this document',
        job: serializeJob(activeJob)
      })
    }

    const hasStructuredBlocks = Array.isArray(document.content?.structuredBlocks) && document.content.structuredBlocks.length > 0

    const job = await FormattingJob.create({
      userId: req.user.id,
      documentId: document._id,
      style: formattingStyle,
      status: 'queued',
      source: {
        title: document.title,
        fileType: document.fileType,
        fileSize: document.fileSize,
        hasStructuredBlocks,
        wordCount: document.metadata?.wordCount || 0,
        useStatefulPipeline: Boolean(useStatefulPipeline),
        latexRequested: String(process.env.FORMATTING_STANDARD_GENERATE_LATEX || 'false').toLowerCase() === 'true'
      },
      progress: {
        percentage: 0,
        stageName: 'queued',
        stageIndex: 0,
        currentChunk: 0,
        totalChunks: 0,
        message: 'Queued for formatting',
        elapsedMs: 0,
        retries: 0,
        updatedAt: new Date()
      },
      metrics: {
        correlationId,
        queueBackend: formattingJobQueue.getBackendName(),
        queueWaitMs: 0,
        totalElapsedMs: 0,
        retries: 0,
        stageTimings: []
      },
      queuedAt: new Date()
    })

    await formattingJobQueue.enqueue(job._id.toString(), { correlationId })

    console.log(`[FormattingJob][${job._id}][${correlationId}] Created and queued for document ${document._id}`)

    res.setHeader('x-correlation-id', correlationId)
    return res.status(202).json({
      status: 'success',
      message: 'Formatting job created',
      correlationId,
      job: serializeJob(job)
    })
  } catch (error) {
    next(error)
  }
}

export const getFormattingJobStatus = async (req, res, next) => {
  try {
    const correlationId = buildCorrelationId(req)
    const { jobId } = req.params

    const { job, error } = await ensureJobOwnership(jobId, req.user.id)
    if (error) {
      return res.status(error.code).json({ status: 'error', message: error.message })
    }

    const currentElapsed = job.startedAt ? Date.now() - new Date(job.startedAt).getTime() : 0

    if (job.status === 'running' && currentElapsed >= 0) {
      await FormattingJob.findByIdAndUpdate(job._id, {
        $set: {
          'progress.elapsedMs': currentElapsed,
          'progress.updatedAt': new Date(),
          'metrics.totalElapsedMs': currentElapsed
        }
      })
      job.progress.elapsedMs = currentElapsed
      job.metrics.totalElapsedMs = currentElapsed
    }

    console.log(`[FormattingJob][${job._id}][${correlationId}] Status check => ${job.status}`)

    res.setHeader('x-correlation-id', correlationId)
    return res.status(200).json({
      status: 'success',
      correlationId,
      job: serializeJob(job)
    })
  } catch (error) {
    next(error)
  }
}

export const cancelFormattingJob = async (req, res, next) => {
  try {
    const correlationId = buildCorrelationId(req)
    const { jobId } = req.params

    const { job, error } = await ensureJobOwnership(jobId, req.user.id)
    if (error) {
      return res.status(error.code).json({ status: 'error', message: error.message })
    }

    if (['completed', 'failed', 'canceled'].includes(job.status)) {
      return res.status(409).json({
        status: 'error',
        message: `Cannot cancel a job in ${job.status} state`,
        job: serializeJob(job)
      })
    }

    await FormattingJob.findByIdAndUpdate(jobId, {
      $set: {
        cancellationRequested: true,
        'progress.message': 'Cancellation requested',
        'progress.updatedAt': new Date()
      }
    })

    await formattingJobQueue.cancel(jobId)

    const updated = await FormattingJob.findById(jobId)

    console.log(`[FormattingJob][${jobId}][${correlationId}] Cancellation requested`)

    res.setHeader('x-correlation-id', correlationId)
    return res.status(200).json({
      status: 'success',
      message: 'Cancellation requested',
      correlationId,
      job: serializeJob(updated)
    })
  } catch (error) {
    next(error)
  }
}

export const getFormattingJobResult = async (req, res, next) => {
  try {
    const correlationId = buildCorrelationId(req)
    const { jobId } = req.params

    const { job, error } = await ensureJobOwnership(jobId, req.user.id)
    if (error) {
      return res.status(error.code).json({ status: 'error', message: error.message })
    }

    if (job.status !== 'completed') {
      return res.status(409).json({
        status: 'error',
        message: `Job result is not available while status is ${job.status}`,
        job: serializeJob(job)
      })
    }

    const result = job.result || {}

    res.setHeader('x-correlation-id', correlationId)
    return res.status(200).json({
      status: 'success',
      correlationId,
      result: {
        stateful: Boolean(result.stateful),
        plainSections: result.plainSections || [],
        latex: result.latex || '',
        bib: result.bib || '',
        citationStats: result.citationStats || {},
        gapReport: result.gapReport || {},
        warnings: result.warnings || [],
        pointers: result.pointers || {},
        metadata: result.metadata || {}
      },
      metrics: {
        stageName: job.progress?.stageName || '',
        elapsedMs: job.progress?.elapsedMs || 0,
        retries: job.progress?.retries || 0,
        totalElapsedMs: job.metrics?.totalElapsedMs || 0,
        stageTimings: job.metrics?.stageTimings || []
      }
    })
  } catch (error) {
    next(error)
  }
}

export const downloadFormattingJobResult = async (req, res, next) => {
  try {
    const correlationId = buildCorrelationId(req)
    const { jobId } = req.params
    const requestedFormat = String(req.query.format || 'docx').toLowerCase()

    const { job, error } = await ensureJobOwnership(jobId, req.user.id)
    if (error) {
      return res.status(error.code).json({ status: 'error', message: error.message })
    }

    if (job.status !== 'completed') {
      return res.status(409).json({
        status: 'error',
        message: `Job output is not available while status is ${job.status}`
      })
    }

    const document = await Document.findById(job.documentId)
    if (!document) {
      return res.status(404).json({
        status: 'error',
        message: 'Source document not found for this job'
      })
    }

    const result = job.result || {}
    const safeTitle = sanitizeFileName(document.title)

    if (requestedFormat === 'tex') {
      const latex = result.latex || ''
      if (!latex) {
        return res.status(404).json({
          status: 'error',
          message: 'LaTeX output is not available for this job'
        })
      }

      res.setHeader('x-correlation-id', correlationId)
      res.setHeader('Content-Type', 'text/plain; charset=utf-8')
      res.setHeader('Content-Disposition', `attachment; filename="${safeTitle}_${job.style}.tex"`)
      return res.status(200).send(latex)
    }

    if (requestedFormat === 'bib') {
      const bib = result.bib || ''
      if (!bib) {
        return res.status(404).json({
          status: 'error',
          message: 'Bibliography output is not available for this job'
        })
      }

      res.setHeader('x-correlation-id', correlationId)
      res.setHeader('Content-Type', 'text/plain; charset=utf-8')
      res.setHeader('Content-Disposition', `attachment; filename="${safeTitle}_${job.style}.bib"`)
      return res.status(200).send(bib)
    }

    if (!['pdf', 'docx'].includes(requestedFormat)) {
      return res.status(400).json({
        status: 'error',
        message: `Unsupported download format: ${requestedFormat}`
      })
    }

    const plainSections = Array.isArray(result.plainSections) ? result.plainSections : []
    if (plainSections.length === 0) {
      return res.status(409).json({
        status: 'error',
        message: 'This job has no plain sections for PDF/DOCX export (likely stateful LaTeX-only output).'
      })
    }

    const pythonResponse = await axios.post(
      `${PYTHON_NLP_URL}/api/formatting/download`,
      {
        sections: plainSections,
        style: job.style,
        title: document.title,
        authors: [],
        format: requestedFormat
      },
      {
        responseType: 'arraybuffer',
        timeout: 120000,
        headers: {
          'Content-Type': 'application/json',
          'x-correlation-id': correlationId
        }
      }
    )

    const contentType = pythonResponse.headers['content-type'] || (
      requestedFormat === 'pdf'
        ? 'application/pdf'
        : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    )

    const ext = requestedFormat === 'pdf' ? 'pdf' : 'docx'
    const fallbackName = `${safeTitle}_${job.style}.${ext}`
    const contentDisposition = pythonResponse.headers['content-disposition'] || `attachment; filename="${fallbackName}"`

    res.setHeader('x-correlation-id', correlationId)
    res.setHeader('Content-Type', contentType)
    res.setHeader('Content-Disposition', contentDisposition)
    return res.status(200).send(Buffer.from(pythonResponse.data))
  } catch (error) {
    next(error)
  }
}

const callExperimentalRunEndpoint = async (formData, correlationId) => {
  let lastError = null
  for (const endpoint of EXPERIMENTAL_RUN_ENDPOINTS) {
    try {
      return await axios.post(
        `${PYTHON_NLP_URL}${endpoint}`,
        formData,
        {
          headers: {
            ...formData.getHeaders(),
            'x-correlation-id': correlationId
          },
          timeout: 900000,
          maxContentLength: Infinity,
          maxBodyLength: Infinity
        }
      )
    } catch (error) {
      lastError = error
      if (error?.response?.status !== 404) {
        throw error
      }
    }
  }
  throw lastError || new Error('Experimental formatting endpoint not available on Python NLP service')
}

const callExperimentalDownloadEndpoint = async (runId, fileType, correlationId) => {
  let lastError = null
  for (const endpointBase of EXPERIMENTAL_DOWNLOAD_ENDPOINTS) {
    try {
      return await axios.get(
        `${PYTHON_NLP_URL}${endpointBase}/${encodeURIComponent(runId)}`,
        {
          params: { file: fileType },
          responseType: 'arraybuffer',
          timeout: 240000,
          headers: {
            'x-correlation-id': correlationId
          }
        }
      )
    } catch (error) {
      lastError = error
      if (error?.response?.status !== 404) {
        throw error
      }
    }
  }
  throw lastError || new Error('Experimental download endpoint not available on Python NLP service')
}

export const runExperimentalFormattingEngine = async (req, res, next) => {
  try {
    const correlationId = buildCorrelationId(req)
    const {
      documentId,
      targetJournal = 'ieee',
      useAi = true
    } = req.body || {}

    if (!documentId) {
      return res.status(400).json({
        status: 'error',
        message: req.file
          ? 'documentId is required. The guideline upload was received, but form fields were not parsed.'
          : 'documentId is required'
      })
    }

    const normalizedStyle = String(targetJournal || '').trim().toLowerCase()
    if (!EXPERIMENTAL_STYLE_SET.has(normalizedStyle)) {
      return res.status(400).json({
        status: 'error',
        message: `Unsupported experimental style: ${targetJournal}`
      })
    }

    const document = await Document.findOne({
      _id: documentId,
      userId: req.user.id
    })

    if (!document) {
      return res.status(404).json({
        status: 'error',
        message: 'Document not found'
      })
    }

    if (!document.filePath || !fs.existsSync(document.filePath)) {
      return res.status(404).json({
        status: 'error',
        message: 'Source document file is missing on server'
      })
    }

    const upload = new FormData()
    upload.append('file', fs.createReadStream(document.filePath), {
      filename: document.originalFileName || `${sanitizeFileName(document.title)}.${document.fileType || 'tmp'}`
    })
    upload.append('target_style', normalizedStyle)
    upload.append('title', document.title || 'Untitled Document')
    const useAiEnabled = useAi === true || String(useAi).toLowerCase() === 'true'
    upload.append('use_ai', useAiEnabled ? 'true' : 'false')
    if (req.file?.buffer) {
      upload.append('guidelines', req.file.buffer, {
        filename: req.file.originalname || 'guidelines.pdf',
        contentType: req.file.mimetype || 'application/octet-stream'
      })
    }

    const pythonResponse = await callExperimentalRunEndpoint(upload, correlationId)

    res.setHeader('x-correlation-id', correlationId)
    return res.status(200).json({
      status: 'success',
      correlationId,
      engine: 'new_engine',
      result: pythonResponse.data
    })
  } catch (error) {
    if (error.response) {
      return res.status(error.response.status || 500).json({
        status: 'error',
        message: error.response.data?.message || error.response.data?.error || 'Experimental formatting engine failed',
        details: error.response.data
      })
    }
    next(error)
  }
}

export const downloadExperimentalFormattingResult = async (req, res, next) => {
  try {
    const correlationId = buildCorrelationId(req)
    const { runId } = req.params
    const { documentId } = req.query
    const requestedFile = String(req.query.file || 'docx').toLowerCase()

    if (!runId) {
      return res.status(400).json({
        status: 'error',
        message: 'runId is required'
      })
    }

    if (!documentId) {
      return res.status(400).json({
        status: 'error',
        message: 'documentId is required'
      })
    }

    if (!EXPERIMENTAL_DOWNLOAD_SET.has(requestedFile)) {
      return res.status(400).json({
        status: 'error',
        message: `Unsupported file type: ${requestedFile}`
      })
    }

    const document = await Document.findOne({
      _id: documentId,
      userId: req.user.id
    })

    if (!document) {
      return res.status(404).json({
        status: 'error',
        message: 'Document not found'
      })
    }

    const pythonResponse = await callExperimentalDownloadEndpoint(runId, requestedFile, correlationId)

    const contentType = pythonResponse.headers['content-type'] || 'application/octet-stream'
    const contentDisposition = pythonResponse.headers['content-disposition']

    res.setHeader('x-correlation-id', correlationId)
    res.setHeader('Content-Type', contentType)
    if (contentDisposition) {
      res.setHeader('Content-Disposition', contentDisposition)
    }
    return res.status(200).send(Buffer.from(pythonResponse.data))
  } catch (error) {
    if (error.response) {
      return res.status(error.response.status || 500).json({
        status: 'error',
        message: error.response.data?.message || error.response.data?.error || 'Download from experimental formatting engine failed',
        details: error.response.data
      })
    }
    next(error)
  }
}
