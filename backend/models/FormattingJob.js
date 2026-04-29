import mongoose from 'mongoose'

const formattingJobSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  documentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Document',
    required: true
  },
  style: {
    type: String,
    enum: ['APA', 'MLA', 'IEEE', 'Chicago', 'Harvard'],
    required: true,
    default: 'APA'
  },
  status: {
    type: String,
    enum: ['queued', 'running', 'completed', 'failed', 'canceled'],
    default: 'queued',
    required: true
  },
  progress: {
    percentage: { type: Number, default: 0 },
    stageName: { type: String, default: 'queued' },
    stageIndex: { type: Number, default: 0 },
    currentChunk: { type: Number, default: 0 },
    totalChunks: { type: Number, default: 0 },
    message: { type: String, default: 'Queued for processing' },
    elapsedMs: { type: Number, default: 0 },
    retries: { type: Number, default: 0 },
    updatedAt: { type: Date, default: Date.now }
  },
  source: {
    title: String,
    fileType: String,
    fileSize: Number,
    hasStructuredBlocks: { type: Boolean, default: false },
    wordCount: { type: Number, default: 0 },
    useStatefulPipeline: { type: Boolean, default: false },
    cacheKey: String,
    latexRequested: { type: Boolean, default: false }
  },
  metrics: {
    correlationId: String,
    queueBackend: { type: String, default: 'in-process' },
    queueWaitMs: { type: Number, default: 0 },
    totalElapsedMs: { type: Number, default: 0 },
    stageTimings: [{
      name: String,
      startedAt: Date,
      completedAt: Date,
      elapsedMs: Number
    }],
    retries: { type: Number, default: 0 },
    cacheHit: { type: Boolean, default: false },
    cacheSourceJobId: String
  },
  result: {
    stateful: { type: Boolean, default: false },
    plainSections: [{
      heading: String,
      text: String,
      section_type: String,
      section_level: Number
    }],
    latex: String,
    bib: String,
    citationStats: mongoose.Schema.Types.Mixed,
    gapReport: mongoose.Schema.Types.Mixed,
    warnings: [String],
    pointers: {
      pythonJobId: String,
      artifactDir: String,
      statePath: String,
      texPath: String,
      bibPath: String
    },
    metadata: {
      chunksProcessed: Number,
      totalRepairs: Number,
      bibEntryCount: Number,
      wordCount: Number,
      sectionsCount: Number,
      latexGenerated: Boolean,
      reusedFromJobId: String
    },
    generatedAt: Date
  },
  cancellationRequested: {
    type: Boolean,
    default: false
  },
  attempts: {
    type: Number,
    default: 0
  },
  error: {
    message: String,
    code: String,
    details: mongoose.Schema.Types.Mixed,
    stack: String
  },
  startedAt: Date,
  completedAt: Date,
  canceledAt: Date,
  queuedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
})

formattingJobSchema.index({ userId: 1, createdAt: -1 })
formattingJobSchema.index({ status: 1 })
formattingJobSchema.index({ documentId: 1, createdAt: -1 })
formattingJobSchema.index({ documentId: 1, style: 1, 'source.cacheKey': 1, status: 1 })

const FormattingJob = mongoose.model('FormattingJob', formattingJobSchema)

export default FormattingJob
