import Document from '../models/Document.js'
import nlpService from '../services/nlpService.js'

// @desc    Process document with NLP
// @route   POST /api/nlp/process/:id
// @access  Private
export const processDocumentNLP = async (req, res, next) => {
  try {
    const document = await Document.findOne({
      _id: req.params.id,
      userId: req.user.id
    })

    if (!document) {
      return res.status(404).json({
        status: 'error',
        message: 'Document not found'
      })
    }

    if (!document.content?.raw) {
      return res.status(400).json({
        status: 'error',
        message: 'Document content not available for processing'
      })
    }

    // Process with NLP
    const nlpResults = await nlpService.processDocument(
      document.content.raw,
      document.metadata
    )

    // Update document with NLP results
    document.nlp = {
      processed: true,
      processedAt: new Date(),
      entities: nlpResults.entities,
      keywords: nlpResults.keywords,
      summary: nlpResults.summary,
      sentiment: nlpResults.sentiment,
      classification: nlpResults.classification,
    }

    // Update metadata
    document.metadata = {
      ...document.metadata,
      ...nlpResults.metadata,
    }

    document.status = 'processing'
    await document.save()

    res.status(200).json({
      status: 'success',
      nlp: document.nlp,
      metadata: document.metadata,
    })
  } catch (error) {
    next(error)
  }
}

// @desc    Get NLP analysis for document
// @route   GET /api/nlp/analysis/:id
// @access  Private
export const getNLPAnalysis = async (req, res, next) => {
  try {
    const document = await Document.findOne({
      _id: req.params.id,
      userId: req.user.id
    }).select('title nlp metadata')

    if (!document) {
      return res.status(404).json({
        status: 'error',
        message: 'Document not found'
      })
    }

    res.status(200).json({
      status: 'success',
      analysis: {
        title: document.title,
        nlp: document.nlp,
        metadata: document.metadata,
      }
    })
  } catch (error) {
    next(error)
  }
}

// @desc    Extract entities from text
// @route   POST /api/nlp/entities
// @access  Private
export const extractEntities = async (req, res, next) => {
  try {
    const { text } = req.body

    if (!text) {
      return res.status(400).json({
        status: 'error',
        message: 'Text is required'
      })
    }

    const entities = await nlpService.extractEntities(text)

    res.status(200).json({
      status: 'success',
      entities
    })
  } catch (error) {
    next(error)
  }
}

// @desc    Generate summary
// @route   POST /api/nlp/summarize
// @access  Private
export const summarizeText = async (req, res, next) => {
  try {
    const { text } = req.body

    if (!text) {
      return res.status(400).json({
        status: 'error',
        message: 'Text is required'
      })
    }

    const summary = await nlpService.generateSummary(text)

    res.status(200).json({
      status: 'success',
      summary
    })
  } catch (error) {
    next(error)
  }
}

// @desc    Analyze sentiment
// @route   POST /api/nlp/sentiment
// @access  Private
export const analyzeSentiment = async (req, res, next) => {
  try {
    const { text } = req.body

    if (!text) {
      return res.status(400).json({
        status: 'error',
        message: 'Text is required'
      })
    }

    const sentiment = await nlpService.analyzeSentiment(text)

    res.status(200).json({
      status: 'success',
      sentiment
    })
  } catch (error) {
    next(error)
  }
}

// @desc    Classify document
// @route   POST /api/nlp/classify
// @access  Private
export const classifyDocument = async (req, res, next) => {
  try {
    const { text } = req.body

    if (!text) {
      return res.status(400).json({
        status: 'error',
        message: 'Text is required'
      })
    }

    const classification = await nlpService.classifyDocument(text)

    res.status(200).json({
      status: 'success',
      classification
    })
  } catch (error) {
    next(error)
  }
}

// @desc    Extract keywords
// @route   POST /api/nlp/keywords
// @access  Private
export const extractKeywords = async (req, res, next) => {
  try {
    const { text } = req.body

    if (!text) {
      return res.status(400).json({
        status: 'error',
        message: 'Text is required'
      })
    }

    const keywords = await nlpService.extractKeywords(text)

    res.status(200).json({
      status: 'success',
      keywords
    })
  } catch (error) {
    next(error)
  }
}
