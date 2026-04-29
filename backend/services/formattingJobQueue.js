import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import axios from 'axios'
import FormData from 'form-data'
import crypto from 'crypto'

import Document from '../models/Document.js'
import FormattingJob from '../models/FormattingJob.js'

const PYTHON_NLP_URL = process.env.PYTHON_NLP_URL || 'http://localhost:5001'
const LARGE_DOC_WORD_THRESHOLD = parseInt(process.env.FORMATTING_LARGE_DOC_WORD_THRESHOLD || '12000', 10)
const MAX_RETRIES = parseInt(process.env.FORMATTING_JOB_MAX_RETRIES || '2', 10)
const RETRY_BASE_DELAY_MS = parseInt(process.env.FORMATTING_JOB_RETRY_DELAY_MS || '3000', 10)
const STANDARD_TIMEOUT_MS = parseInt(process.env.FORMATTING_STANDARD_TIMEOUT_MS || '240000', 10)
const STANDARD_GENERATE_LATEX = String(process.env.FORMATTING_STANDARD_GENERATE_LATEX || 'false').toLowerCase() === 'true'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const BACKEND_ROOT = path.resolve(__dirname, '..')
const DEFAULT_PYTHON_JOBS_DIR = path.resolve(BACKEND_ROOT, '../python-nlp-service/uploads/jobs')
const PYTHON_JOBS_DIR = process.env.PYTHON_JOBS_DIR || DEFAULT_PYTHON_JOBS_DIR

const isCancelError = (error) => {
  if (!error) return false
  return error.name === 'CanceledError' || error.code === 'ERR_CANCELED' || /cancel/i.test(error.message || '')
}

const toPlainFormattedText = (plainSections = []) => {
  if (!Array.isArray(plainSections) || plainSections.length === 0) return ''
  return plainSections
    .map((section) => {
      const headingLevel = Math.max(1, section.section_level || 1)
      const headingPrefix = '#'.repeat(headingLevel)
      const heading = section.heading || 'Section'
      const body = section.text || ''
      return `${headingPrefix} ${heading}\n\n${body}`
    })
    .join('\n\n')
}

const buildTextFromStructuredBlocks = (structuredBlocks = []) => {
  if (!Array.isArray(structuredBlocks) || structuredBlocks.length === 0) return ''

  return structuredBlocks
    .map((block) => {
      const text = (block.text || '').trim()
      if (!text) return ''
      const style = String(block.style || '').toLowerCase()
      const isHeading = style.includes('heading') || style.includes('title')
      if (!isHeading) return text

      const levelMatch = style.match(/heading\s*(\d+)/)
      const level = levelMatch ? parseInt(levelMatch[1], 10) : 1
      const clampedLevel = Number.isFinite(level) ? Math.max(1, Math.min(level, 6)) : 1
      return `${'#'.repeat(clampedLevel)} ${text}`
    })
    .filter(Boolean)
    .join('\n\n')
}

const stableStringify = (value) => {
  if (value === undefined) {
    return '"__undefined__"'
  }

  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value)
  }

  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(',')}]`
  }

  return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(',')}}`
}

const hashValue = (value) => crypto.createHash('sha256').update(value).digest('hex')

const safeRemoveDirectory = (targetPath) => {
  if (!targetPath) {
    return { removed: false, reason: 'No path provided' }
  }

  try {
    const resolvedTarget = path.resolve(targetPath)
    const allowedRoots = [
      path.resolve(BACKEND_ROOT, '../uploads'),
      path.resolve(PYTHON_JOBS_DIR),
      path.resolve(BACKEND_ROOT, '../python-nlp-service/uploads')
    ]

    const isAllowed = allowedRoots.some((root) => resolvedTarget.startsWith(root))
    if (!isAllowed) {
      return { removed: false, reason: `Path not in allowed cleanup roots: ${resolvedTarget}` }
    }

    if (!fs.existsSync(resolvedTarget)) {
      return { removed: false, reason: 'Path does not exist' }
    }

    fs.rmSync(resolvedTarget, { recursive: true, force: true })
    return { removed: true, path: resolvedTarget }
  } catch (error) {
    return { removed: false, reason: error.message }
  }
}

class InProcessFormattingQueue {
  constructor() {
    this.queue = []
    this.queueSet = new Set()
    this.activeControllers = new Map()
    this.activeCount = 0
    this.maxConcurrency = parseInt(process.env.FORMATTING_JOB_CONCURRENCY || '1', 10)
    this.started = false
    this.drainScheduled = false
    this.backendName = 'in-process'
  }

  async start() {
    if (this.started) return

    this.started = true

    await FormattingJob.updateMany(
      { status: 'running' },
      {
        $set: {
          status: 'queued',
          'progress.stageName': 'requeued_after_restart',
          'progress.message': 'Worker restarted; job re-queued',
          'progress.updatedAt': new Date()
        }
      }
    )

    const pendingJobs = await FormattingJob.find({ status: 'queued' }).select('_id metrics')
    for (const job of pendingJobs) {
      await this.enqueue(job._id.toString(), {
        correlationId: job.metrics?.correlationId || crypto.randomUUID()
      })
    }

    console.log(`[FormattingQueue] Started (${this.backendName}), restored ${pendingJobs.length} pending jobs`)
  }

  async stop() {
    this.started = false
    this.queue = []
    this.queueSet.clear()

    for (const [, controller] of this.activeControllers.entries()) {
      try {
        controller.abort()
      } catch {
        // no-op
      }
    }
    this.activeControllers.clear()
  }

  async enqueue(jobId, options = {}) {
    if (!jobId) return
    if (!this.started) await this.start()

    if (this.queueSet.has(jobId)) {
      return
    }

    this.queue.push({
      jobId,
      correlationId: options.correlationId || crypto.randomUUID(),
      enqueuedAt: Date.now()
    })
    this.queueSet.add(jobId)

    this.scheduleDrain()
  }

  async cancel(jobId) {
    const queueIndex = this.queue.findIndex((item) => item.jobId === jobId)
    if (queueIndex >= 0) {
      this.queue.splice(queueIndex, 1)
      this.queueSet.delete(jobId)

      await FormattingJob.findByIdAndUpdate(jobId, {
        $set: {
          status: 'canceled',
          cancellationRequested: true,
          canceledAt: new Date(),
          completedAt: new Date(),
          'progress.stageName': 'canceled',
          'progress.message': 'Canceled before processing started',
          'progress.updatedAt': new Date()
        }
      })
      return
    }

    const controller = this.activeControllers.get(jobId)
    if (controller) {
      controller.abort()
    }
  }

  scheduleDrain() {
    if (this.drainScheduled || !this.started) return
    this.drainScheduled = true

    setImmediate(async () => {
      this.drainScheduled = false
      await this.drain()
    })
  }

  async drain() {
    while (this.started && this.activeCount < this.maxConcurrency && this.queue.length > 0) {
      const item = this.queue.shift()
      this.queueSet.delete(item.jobId)
      this.activeCount += 1

      this.processJob(item)
        .catch((error) => {
          console.error(`[FormattingQueue] Unexpected process error for ${item.jobId}:`, error)
        })
        .finally(() => {
          this.activeCount -= 1
          this.scheduleDrain()
        })
    }
  }

  async processJob(item) {
    const { jobId, correlationId } = item

    const stageTimings = []
    const jobLog = (message, extra) => {
      const suffix = extra ? ` ${JSON.stringify(extra)}` : ''
      console.log(`[FormattingJob][${jobId}][${correlationId}] ${message}${suffix}`)
    }

    const runStage = async (name, callback) => {
      const startedAt = new Date()
      const startedTick = Date.now()
      jobLog(`Stage started: ${name}`)
      const result = await callback()
      const elapsedMs = Date.now() - startedTick
      stageTimings.push({
        name,
        startedAt,
        completedAt: new Date(),
        elapsedMs
      })
      jobLog(`Stage completed: ${name}`, { elapsedMs })
      return result
    }

    let job = await FormattingJob.findById(jobId)
    if (!job) return

    if (job.status !== 'queued' && job.status !== 'running') {
      jobLog(`Skipping job in status ${job.status}`)
      return
    }

    const queueWaitMs = Date.now() - new Date(job.queuedAt || job.createdAt).getTime()
    const attempt = (job.attempts || 0) + 1

    job.status = 'running'
    job.startedAt = job.startedAt || new Date()
    job.attempts = attempt
    job.progress = {
      ...job.progress,
      percentage: 2,
      stageName: 'initializing',
      stageIndex: 1,
      message: 'Preparing formatting payload',
      retries: Math.max(0, attempt - 1),
      elapsedMs: job.metrics?.totalElapsedMs || 0,
      updatedAt: new Date()
    }
    job.metrics = {
      ...job.metrics,
      correlationId,
      queueBackend: this.backendName,
      queueWaitMs,
      retries: Math.max(0, attempt - 1)
    }
    await job.save()

    const overallStartedTick = Date.now()

    try {
      if (job.cancellationRequested) {
        await this.transitionCanceled(job, 'Canceled before processing started')
        return
      }

      const document = await Document.findById(job.documentId)
      if (!document) {
        throw new Error('Source document not found for formatting job')
      }

      if (document.userId.toString() !== job.userId.toString()) {
        throw new Error('Source document access denied for this user')
      }

      const prepared = await runStage('prepare_payload', async () => {
        const preparedPayload = this.preparePayload(document, job)
        await this.updateProgress(job._id.toString(), {
          percentage: preparedPayload.useStateful ? 5 : 12,
          stageName: preparedPayload.useStateful ? 'stateful_pipeline' : 'standard_pipeline',
          stageIndex: preparedPayload.useStateful ? 1 : 2,
          message: preparedPayload.useStateful
            ? 'Using stateful large-document pipeline'
            : 'Using standard AI formatting pipeline'
        })
        return preparedPayload
      })

      if (!prepared.useStateful) {
        const cachedJob = await this.findReusableCompletedJob(job, prepared)
        if (cachedJob) {
          await runStage('reuse_cached_result', async () => {
            await this.applyCachedResult(job, document, cachedJob, prepared, overallStartedTick, stageTimings)
          })
          jobLog('Job completed from cache', {
            sourceJobId: cachedJob._id.toString(),
            cacheKey: prepared.cacheKey
          })
          return
        }
      }

      if (await this.isCancellationRequested(job._id.toString())) {
        await this.transitionCanceled(job, 'Canceled before Python processing')
        return
      }

      const result = prepared.useStateful
        ? await runStage('python_stateful_format', async () => this.executeStatefulPipeline(job, document, prepared, correlationId))
        : await runStage('python_ai_format', async () => this.executeStandardPipeline(job, document, prepared, correlationId))

      if (await this.isCancellationRequested(job._id.toString())) {
        await this.transitionCanceled(job, 'Canceled after Python processing')
        return
      }

      await runStage('persist_results', async () => {
        document.content.formatted = toPlainFormattedText(result.plainSections)
        document.formatting = {
          ...document.formatting,
          style: job.style,
          applied: true
        }
        document.metadata = {
          ...document.metadata,
          lastFormattedAt: new Date(),
          formattingStyle: job.style,
          formattingStats: result.citationStats || {}
        }
        document.status = 'formatted'
        await document.save()
      })

      const totalElapsedMs = Date.now() - overallStartedTick
      job = await FormattingJob.findById(job._id)
      if (!job) return

      job.status = 'completed'
      job.completedAt = new Date()
      job.error = undefined
      job.progress = {
        ...job.progress,
        percentage: 100,
        stageName: 'completed',
        stageIndex: prepared.useStateful ? 6 : 4,
        message: 'Formatting completed successfully',
        elapsedMs: totalElapsedMs,
        retries: Math.max(0, attempt - 1),
        updatedAt: new Date()
      }
      job.metrics = {
        ...job.metrics,
        totalElapsedMs,
        retries: Math.max(0, attempt - 1),
        stageTimings
      }
      job.result = {
        ...result,
        generatedAt: new Date()
      }
      await job.save()

      jobLog('Job completed', {
        totalElapsedMs,
        stateful: prepared.useStateful,
        sections: result.metadata?.sectionsCount || 0,
        chunksProcessed: result.metadata?.chunksProcessed || 0
      })
    } catch (error) {
      jobLog('Job failed in runner', { message: error.message })
      await this.handleFailure(job._id.toString(), correlationId, error, stageTimings, overallStartedTick)
    } finally {
      this.activeControllers.delete(jobId)
    }
  }

  preparePayload(document, job) {
    const structuredBlocks = document.content?.structuredBlocks || []
    const tableOfContents = document.content?.tableOfContents || []
    const structuredText = buildTextFromStructuredBlocks(structuredBlocks)
    const fallbackRawText = document.content?.raw || ''
    const text = structuredText || fallbackRawText

    const metadataWordCount = document.metadata?.wordCount || 0
    const computedWordCount = text ? text.split(/\s+/).filter(Boolean).length : 0
    const wordCount = Math.max(metadataWordCount, computedWordCount)

    const useStateful = Boolean(
      job.source?.useStatefulPipeline ||
      wordCount >= LARGE_DOC_WORD_THRESHOLD ||
      structuredBlocks.length >= 250
    )

    const cachePayload = stableStringify({
      engine: 'standard-ai-formatter-v2',
      latex: STANDARD_GENERATE_LATEX,
      style: job.style,
      title: document.title,
      raw: fallbackRawText,
      structuredBlocks,
      tableOfContents
    })

    return {
      useStateful,
      text,
      structuredBlocks,
      tableOfContents,
      wordCount,
      cacheKey: hashValue(cachePayload),
      generateLatex: STANDARD_GENERATE_LATEX,
      title: document.title,
      filePath: document.filePath,
      originalFileName: document.originalFileName,
      fileType: document.fileType
    }
  }

  async findReusableCompletedJob(job, prepared) {
    if (!prepared.cacheKey) return null

    return FormattingJob.findOne({
      _id: { $ne: job._id },
      documentId: job.documentId,
      style: job.style,
      status: 'completed',
      'source.cacheKey': prepared.cacheKey,
      'result.stateful': false
    }).sort({ completedAt: -1 })
  }

  async applyCachedResult(job, document, cachedJob, prepared, overallStartedTick, stageTimings) {
    const totalElapsedMs = Date.now() - overallStartedTick
    const cachedResult = cachedJob.result?.toObject ? cachedJob.result.toObject() : cachedJob.result
    const result = {
      ...cachedResult,
      metadata: {
        ...(cachedResult?.metadata || {}),
        wordCount: prepared.wordCount,
        reusedFromJobId: cachedJob._id.toString()
      },
      generatedAt: new Date()
    }

    document.content.formatted = toPlainFormattedText(result.plainSections)
    document.formatting = {
      ...document.formatting,
      style: job.style,
      applied: true
    }
    document.metadata = {
      ...document.metadata,
      lastFormattedAt: new Date(),
      formattingStyle: job.style,
      formattingStats: result.citationStats || {}
    }
    document.status = 'formatted'
    await document.save()

    await FormattingJob.findByIdAndUpdate(job._id, {
      $set: {
        status: 'completed',
        completedAt: new Date(),
        error: undefined,
        source: {
          ...job.source,
          cacheKey: prepared.cacheKey,
          latexRequested: prepared.generateLatex
        },
        progress: {
          ...job.progress,
          percentage: 100,
          stageName: 'completed_cached',
          stageIndex: 4,
          message: 'Formatting completed from cached result',
          elapsedMs: totalElapsedMs,
          retries: Math.max(0, (job.attempts || 1) - 1),
          updatedAt: new Date()
        },
        metrics: {
          ...job.metrics,
          totalElapsedMs,
          retries: Math.max(0, (job.attempts || 1) - 1),
          stageTimings,
          cacheHit: true,
          cacheSourceJobId: cachedJob._id.toString()
        },
        result
      }
    })
  }

  async executeStandardPipeline(job, document, prepared, correlationId) {
    if (!prepared.text) {
      throw new Error('Document content is empty; cannot format')
    }

    await this.updateProgress(job._id.toString(), {
      percentage: 30,
      stageName: 'python_ai_format',
      stageIndex: 2,
      message: 'Submitting document to AI formatter'
    })

    const response = await axios.post(
      `${PYTHON_NLP_URL}/api/formatting/ai-format`,
      {
        text: prepared.text,
        structured_blocks: prepared.structuredBlocks,
        table_of_contents: prepared.tableOfContents,
        target_style: job.style,
        source_style: 'unknown',
        title: document.title,
        authors: [],
        generate_latex: prepared.generateLatex
      },
      {
        timeout: STANDARD_TIMEOUT_MS,
        headers: {
          'Content-Type': 'application/json',
          'x-correlation-id': correlationId
        }
      }
    )

    const payload = response.data || {}
    if (!payload.success) {
      throw new Error(payload.error || 'Python AI formatter returned unsuccessful response')
    }

    await this.updateProgress(job._id.toString(), {
      percentage: 88,
      stageName: 'python_ai_format',
      stageIndex: 3,
      message: 'AI formatting completed; persisting results'
    })

    const plainSections = Array.isArray(payload.plain_sections) ? payload.plain_sections : []

    return {
      stateful: false,
      plainSections,
      latex: payload.latex || '',
      bib: payload.bib || '',
      citationStats: payload.citation_stats || {},
      gapReport: payload.gap_report || {},
      warnings: payload.warnings || [],
      pointers: {
        pythonJobId: null,
        artifactDir: null,
        statePath: null,
        texPath: null,
        bibPath: null
      },
      metadata: {
        sectionsCount: plainSections.length,
        chunksProcessed: null,
        totalRepairs: null,
        bibEntryCount: payload.citation_stats?.reference_count || 0,
        wordCount: prepared.wordCount,
        latexGenerated: prepared.generateLatex
      }
    }
  }

  async executeStatefulPipeline(job, document, prepared, correlationId) {
    if (!prepared.filePath || !fs.existsSync(prepared.filePath)) {
      throw new Error('Cannot run stateful pipeline: source document file is missing')
    }

    await this.updateProgress(job._id.toString(), {
      percentage: 8,
      stageName: 'stateful_upload',
      stageIndex: 1,
      message: 'Uploading source file to stateful formatter'
    })

    const controller = new AbortController()
    this.activeControllers.set(job._id.toString(), controller)

    const formData = new FormData()
    formData.append('file', fs.createReadStream(prepared.filePath), {
      filename: prepared.originalFileName || `${job._id}.${prepared.fileType || 'txt'}`
    })
    formData.append('target_style', job.style)
    formData.append('title', document.title)
    formData.append('job_id', job._id.toString())
    formData.append('resume', 'false')

    const response = await axios.post(
      `${PYTHON_NLP_URL}/api/formatting/stateful-format`,
      formData,
      {
        headers: {
          ...formData.getHeaders(),
          'x-correlation-id': correlationId
        },
        responseType: 'stream',
        timeout: 0,
        signal: controller.signal,
        maxBodyLength: Infinity,
        maxContentLength: Infinity
      }
    )

    const finalEvent = await this.consumeStatefulStream(job._id.toString(), response.data)

    await this.updateProgress(job._id.toString(), {
      percentage: 92,
      stageName: 'stateful_finalize',
      stageIndex: 6,
      message: 'Stateful pipeline completed; persisting outputs'
    })

    const pythonJobId = job._id.toString()
    const artifactDir = path.join(PYTHON_JOBS_DIR, pythonJobId)

    return {
      stateful: true,
      plainSections: [],
      latex: finalEvent.latex || '',
      bib: finalEvent.bib || '',
      citationStats: {},
      gapReport: {},
      warnings: [],
      pointers: {
        pythonJobId,
        artifactDir,
        statePath: path.join(artifactDir, 'state.json'),
        texPath: path.join(artifactDir, 'paper.tex'),
        bibPath: path.join(artifactDir, 'refs.bib')
      },
      metadata: {
        sectionsCount: 0,
        chunksProcessed: finalEvent.chunks_processed || 0,
        totalRepairs: finalEvent.total_repairs || 0,
        bibEntryCount: finalEvent.bib_entry_count || 0,
        wordCount: finalEvent.word_count || prepared.wordCount
      }
    }
  }

  async consumeStatefulStream(jobId, stream) {
    return new Promise((resolve, reject) => {
      let buffer = ''
      let completedPayload = null
      let totalChunks = 0
      let lastChunk = 0

      const handlePayload = async (payload) => {
        if (payload.type === 'stage') {
          await this.updateProgress(jobId, {
            stageName: `stage_${payload.stage}`,
            stageIndex: payload.stage || 0,
            message: payload.description || 'Processing stateful stage',
            percentage: Math.max(10, Math.min(80, (payload.stage || 1) * 12))
          })
          return
        }

        if (payload.type === 'start') {
          totalChunks = payload.total || 0
          await this.updateProgress(jobId, {
            stageName: 'stateful_chunking',
            stageIndex: 3,
            totalChunks,
            currentChunk: 0,
            message: `Stateful chunk processing started (${totalChunks} chunks)`,
            percentage: 16
          })
          return
        }

        if (payload.type === 'progress') {
          const chunk = payload.chunk || 0
          const total = payload.total || totalChunks || 0
          lastChunk = chunk
          const ratio = total > 0 ? chunk / total : 0
          const percentage = Math.max(20, Math.min(90, Math.round(20 + ratio * 65)))

          await this.updateProgress(jobId, {
            stageName: 'stateful_chunk_processing',
            stageIndex: 4,
            currentChunk: chunk,
            totalChunks: total,
            message: payload.section || `Processing chunk ${chunk} of ${total}`,
            percentage
          })
          return
        }

        if (payload.type === 'complete') {
          completedPayload = {
            ...payload,
            chunks_processed: payload.chunks_processed || lastChunk,
            total_chunks: payload.total_chunks || totalChunks
          }
          return
        }

        if (payload.type === 'error') {
          reject(new Error(payload.message || 'Stateful formatter returned an error'))
        }
      }

      stream.on('data', (chunk) => {
        buffer += chunk.toString('utf-8')
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          const trimmed = line.trim()
          if (!trimmed.startsWith('data:')) continue

          const jsonPayload = trimmed.replace(/^data:\s*/, '')
          if (!jsonPayload) continue

          let parsed
          try {
            parsed = JSON.parse(jsonPayload)
          } catch {
            continue
          }

          handlePayload(parsed).catch((error) => {
            reject(error)
          })
        }
      })

      stream.on('error', (error) => {
        reject(error)
      })

      stream.on('end', () => {
        if (completedPayload) {
          resolve(completedPayload)
        } else {
          reject(new Error('Stateful formatting stream ended without completion payload'))
        }
      })
    })
  }

  async updateProgress(jobId, updates = {}) {
    const progressUpdate = {
      ...(updates.percentage !== undefined ? { 'progress.percentage': updates.percentage } : {}),
      ...(updates.stageName ? { 'progress.stageName': updates.stageName } : {}),
      ...(updates.stageIndex !== undefined ? { 'progress.stageIndex': updates.stageIndex } : {}),
      ...(updates.currentChunk !== undefined ? { 'progress.currentChunk': updates.currentChunk } : {}),
      ...(updates.totalChunks !== undefined ? { 'progress.totalChunks': updates.totalChunks } : {}),
      ...(updates.message ? { 'progress.message': updates.message } : {}),
      ...(updates.elapsedMs !== undefined ? { 'progress.elapsedMs': updates.elapsedMs } : {}),
      ...(updates.retries !== undefined ? { 'progress.retries': updates.retries } : {}),
      'progress.updatedAt': new Date()
    }

    await FormattingJob.findByIdAndUpdate(jobId, {
      $set: progressUpdate
    })
  }

  async isCancellationRequested(jobId) {
    const job = await FormattingJob.findById(jobId).select('cancellationRequested status')
    if (!job) return true
    return job.cancellationRequested || job.status === 'canceled'
  }

  async transitionCanceled(job, reason) {
    await FormattingJob.findByIdAndUpdate(job._id, {
      $set: {
        status: 'canceled',
        cancellationRequested: true,
        canceledAt: new Date(),
        completedAt: new Date(),
        'progress.stageName': 'canceled',
        'progress.message': reason || 'Formatting canceled',
        'progress.updatedAt': new Date()
      }
    })
  }

  async handleFailure(jobId, correlationId, error, stageTimings, overallStartedTick) {
    const job = await FormattingJob.findById(jobId)
    if (!job) return

    const totalElapsedMs = Date.now() - overallStartedTick

    if (job.cancellationRequested || isCancelError(error)) {
      await this.transitionCanceled(job, 'Formatting canceled during processing')
      return
    }

    const shouldRetry = job.attempts <= MAX_RETRIES
    if (shouldRetry) {
      const retryDelayMs = RETRY_BASE_DELAY_MS * job.attempts

      job.status = 'queued'
      job.progress = {
        ...job.progress,
        stageName: 'retrying',
        stageIndex: job.progress?.stageIndex || 0,
        message: `Retrying after failure (attempt ${job.attempts + 1}/${MAX_RETRIES + 1})`,
        retries: job.attempts,
        elapsedMs: totalElapsedMs,
        updatedAt: new Date()
      }
      job.metrics = {
        ...job.metrics,
        totalElapsedMs,
        retries: job.attempts,
        stageTimings
      }
      job.error = {
        message: error.message,
        code: error.code,
        details: {
          correlationId,
          retryDelayMs
        },
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
      }
      await job.save()

      setTimeout(() => {
        this.enqueue(jobId, { correlationId }).catch((enqueueError) => {
          console.error(`[FormattingJob][${jobId}] Failed to enqueue retry:`, enqueueError)
        })
      }, retryDelayMs)

      return
    }

    job.status = 'failed'
    job.completedAt = new Date()
    job.progress = {
      ...job.progress,
      stageName: 'failed',
      message: error.message || 'Formatting failed',
      retries: Math.max(0, job.attempts - 1),
      elapsedMs: totalElapsedMs,
      updatedAt: new Date()
    }
    job.metrics = {
      ...job.metrics,
      totalElapsedMs,
      retries: Math.max(0, job.attempts - 1),
      stageTimings
    }
    job.error = {
      message: error.message,
      code: error.code,
      details: {
        correlationId
      },
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    }

    await job.save()
  }
}

class FormattingJobQueueService {
  constructor() {
    this.driver = null
    this.backendName = 'in-process'
  }

  async start() {
    if (this.driver) {
      await this.driver.start()
      return
    }

    const requestedBackend = (process.env.FORMATTING_QUEUE_BACKEND || 'in-process').toLowerCase()

    if (requestedBackend === 'redis') {
      console.warn('[FormattingQueue] Redis backend requested but not configured; falling back to in-process queue')
    }

    this.driver = new InProcessFormattingQueue()
    this.backendName = this.driver.backendName
    await this.driver.start()
  }

  async stop() {
    if (this.driver) {
      await this.driver.stop()
    }
  }

  async enqueue(jobId, options = {}) {
    await this.start()
    return this.driver.enqueue(jobId, options)
  }

  async cancel(jobId) {
    if (!this.driver) return
    return this.driver.cancel(jobId)
  }

  getBackendName() {
    return this.backendName
  }
}

export const formattingJobQueue = new FormattingJobQueueService()

export const cleanupFormattingJobArtifacts = async (job) => {
  if (!job) {
    return { cleaned: [], warnings: ['No job supplied'] }
  }

  const cleaned = []
  const warnings = []
  const pointers = job.result?.pointers || {}

  const targets = [
    pointers.statePath,
    pointers.texPath,
    pointers.bibPath
  ].filter(Boolean)

  for (const filePath of targets) {
    try {
      const resolvedFile = path.resolve(filePath)
      const allowedRoots = [
        path.resolve(PYTHON_JOBS_DIR),
        path.resolve(BACKEND_ROOT, '../python-nlp-service/uploads')
      ]
      const isAllowed = allowedRoots.some((root) => resolvedFile.startsWith(root))
      if (!isAllowed) {
        warnings.push(`Skipped non-allowed file cleanup path: ${resolvedFile}`)
        continue
      }

      if (!fs.existsSync(resolvedFile)) {
        continue
      }

      fs.rmSync(resolvedFile, { force: true })
      cleaned.push(resolvedFile)
    } catch (error) {
      warnings.push(`Failed to remove artifact file ${filePath}: ${error.message}`)
    }
  }

  const dirCleanup = safeRemoveDirectory(pointers.artifactDir)
  if (dirCleanup.removed) {
    cleaned.push(dirCleanup.path)
  } else if (dirCleanup.reason && dirCleanup.reason !== 'No path provided' && dirCleanup.reason !== 'Path does not exist') {
    warnings.push(`Failed to remove artifact directory: ${dirCleanup.reason}`)
  }

  return { cleaned, warnings }
}

export const getPythonJobsDir = () => PYTHON_JOBS_DIR

export default formattingJobQueue
