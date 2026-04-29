import mongoose from 'mongoose'

const documentSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  title: {
    type: String,
    required: [true, 'Please provide a document title'],
    trim: true
  },
  originalFileName: {
    type: String,
    required: true
  },
  fileType: {
    type: String,
    enum: ['docx', 'pdf', 'txt'],
    required: true
  },
  fileSize: {
    type: Number,
    required: true
  },
  filePath: {
    type: String,
    required: true
  },
  status: {
    type: String,
    enum: ['uploaded', 'processing', 'formatted', 'failed'],
    default: 'uploaded'
  },
  content: {
    raw: String,
    formatted: String,
    structure: [mongoose.Schema.Types.Mixed],
    mediaReferences: [{
      type: {
        type: String,
        enum: ['image', 'graph', 'chart']
      },
      filename: String,
      caption: String,
      savedPath: String,
      relativePath: String,
      dimensions: {
        width: Number,
        height: Number
      },
      altText: String
    }],
    structuredBlocks: [mongoose.Schema.Types.Mixed],
    tableOfContents: [{
      level: Number,
      text: String,
      index: Number
    }],
    docling: mongoose.Schema.Types.Mixed
  },
  media: {
    storagePath: String,
    files: [String]
  },
  formatting: {
    style: {
      type: String,
      enum: ['APA', 'MLA', 'IEEE', 'Chicago', 'Harvard'],
      default: 'APA'
    },
    applied: {
      type: Boolean,
      default: false
    },
    issues: [{
      type: String,
      line: Number,
      message: String
    }]
  },
  metadata: {
    wordCount: Number,
    pageCount: Number,
    tableCount: { type: Number, default: 0 },
    imageCount: { type: Number, default: 0 },
    graphCount: { type: Number, default: 0 },
    sentenceCount: Number,
    paragraphCount: Number,
    readingTime: Number,
    author: String,
    abstract: String,
    keywords: [String],
    uploadedAt: Date,
    lastProcessedAt: Date,
    requestedStyle: {
      type: String,
      enum: ['APA', 'MLA', 'IEEE', 'Chicago', 'Harvard'],
      default: 'APA'
    },
    nlpProcessingFailed: Boolean,
    extractionBackend: String
  },
  nlp: {
    processed: {
      type: Boolean,
      default: false
    },
    processedAt: Date,
    entities: {
      persons: [String],
      organizations: [String],
      locations: [String],
      dates: [String],
      other: [String]
    },
    keywords: [String],
    summary: String,
    sentiment: {
      label: String,
      score: Number,
      confidence: Number
    },
    classification: {
      category: String,
      confidence: Number,
      alternatives: [{
        category: String,
        confidence: Number
      }]
    },
    topics: [{
      keywords: [String],
      relevance: Number
    }]
  },
  projectId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Project',
    default: null
  },
  versions: [{
    version: Number,
    content: String,
    createdAt: Date,
    changes: String
  }],
  plagiarismCheck: {
    checked: {
      type: Boolean,
      default: false
    },
    similarityScore: Number,
    checkedAt: Date,
    sources: [{
      type: String,
      title: String,
      url: String,
      similarity: Number,
      matchedPhrases: [{
        text: String,
        similarity: Number
      }]
    }],
    risk: String
  },
  grammarCheck: {
    checked: {
      type: Boolean,
      default: false
    },
    checkedAt: Date,
    qualityScore: Number,
    totalIssues: Number,
    issuesByType: {
      grammar: Number,
      spelling: Number,
      style: Number,
      punctuation: Number,
      critical: Number,
      major: Number,
      minor: Number
    }
  }
}, {
  timestamps: true
})

// Index for faster queries
documentSchema.index({ userId: 1, createdAt: -1 })
documentSchema.index({ status: 1 })
documentSchema.index({ 'metadata.tableCount': 1 })
documentSchema.index({ 'metadata.imageCount': 1 })
documentSchema.index({ 'metadata.graphCount': 1 })

const Document = mongoose.model('Document', documentSchema)

export default Document
