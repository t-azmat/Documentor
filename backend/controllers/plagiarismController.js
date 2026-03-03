import plagiarismService from '../services/plagiarismService.js'
import Document from '../models/Document.js'
import User from '../models/User.js'

/**
 * Check plagiarism in document
 */
export const checkPlagiarism = async (req, res) => {
  try {
    const { text, documentId } = req.body

    if (!text) {
      return res.status(400).json({
        success: false,
        message: 'Text is required',
      })
    }

    // Check user's plagiarism check limits
    const user = await User.findById(req.user._id)
    const limits = user.getUsageLimits()
    
    if (user.plagiarismChecksUsed >= limits.plagiarismChecks) {
      return res.status(403).json({
        success: false,
        message: 'Plagiarism check limit reached for your plan',
        limit: limits.plagiarismChecks,
        used: user.plagiarismChecksUsed,
      })
    }

    // Perform plagiarism check
    const results = await plagiarismService.checkPlagiarism(
      text,
      documentId,
      req.user._id.toString()
    )

    // Update user's plagiarism check count
    user.plagiarismChecksUsed += 1
    await user.save()

    // If documentId provided, save results
    if (documentId) {
      const document = await Document.findOne({
        _id: documentId,
        userId: req.user._id,
      })

      if (document) {
        document.plagiarismCheck = {
          checked: true,
          checkedAt: results.checkedAt,
          similarityScore: results.overallSimilarity,
          sources: results.sources.slice(0, 10), // Store top 10 sources
          risk: results.risk.level,
        }
        await document.save()
      }
    }

    res.json({
      success: true,
      data: results,
      usage: {
        used: user.plagiarismChecksUsed,
        limit: limits.plagiarismChecks,
        remaining: limits.plagiarismChecks - user.plagiarismChecksUsed,
      },
    })
  } catch (error) {
    console.error('Plagiarism check error:', error)
    res.status(500).json({
      success: false,
      message: 'Plagiarism check failed',
      error: error.message,
    })
  }
}

/**
 * Get plagiarism report
 */
export const getReport = async (req, res) => {
  try {
    const { documentId } = req.params

    const document = await Document.findOne({
      _id: documentId,
      userId: req.user._id,
    })

    if (!document) {
      return res.status(404).json({
        success: false,
        message: 'Document not found',
      })
    }

    if (!document.plagiarismCheck || !document.plagiarismCheck.checked) {
      return res.status(400).json({
        success: false,
        message: 'Document has not been checked for plagiarism',
      })
    }

    const report = plagiarismService.generateReport({
      overallSimilarity: document.plagiarismCheck.similarityScore,
      sources: document.plagiarismCheck.sources,
      risk: { level: document.plagiarismCheck.risk },
      stats: {
        uniqueContent: 100 - document.plagiarismCheck.similarityScore,
        matchedContent: document.plagiarismCheck.similarityScore,
      },
    })

    res.json({
      success: true,
      data: report,
    })
  } catch (error) {
    console.error('Get report error:', error)
    res.status(500).json({
      success: false,
      message: 'Failed to generate report',
      error: error.message,
    })
  }
}

/**
 * Compare two documents
 */
export const compareDocuments = async (req, res) => {
  try {
    const { documentId1, documentId2 } = req.body

    if (!documentId1 || !documentId2) {
      return res.status(400).json({
        success: false,
        message: 'Both document IDs are required',
      })
    }

    const [doc1, doc2] = await Promise.all([
      Document.findOne({ _id: documentId1, userId: req.user._id }),
      Document.findOne({ _id: documentId2, userId: req.user._id }),
    ])

    if (!doc1 || !doc2) {
      return res.status(404).json({
        success: false,
        message: 'One or both documents not found',
      })
    }

    if (!doc1.content.raw || !doc2.content.raw) {
      return res.status(400).json({
        success: false,
        message: 'Documents must have text content',
      })
    }

    const similarity = plagiarismService.calculateSimilarity(
      doc1.content.raw,
      doc2.content.raw
    )

    const matchedPhrases = plagiarismService.findMatchedPhrases(
      doc1.content.raw,
      doc2.content.raw
    )

    res.json({
      success: true,
      data: {
        document1: {
          id: doc1._id,
          title: doc1.title,
        },
        document2: {
          id: doc2._id,
          title: doc2.title,
        },
        similarity: Math.round(similarity),
        matchedPhrases,
        risk: plagiarismService.assessRisk(similarity),
      },
    })
  } catch (error) {
    console.error('Compare documents error:', error)
    res.status(500).json({
      success: false,
      message: 'Failed to compare documents',
      error: error.message,
    })
  }
}

/**
 * Get plagiarism check history
 */
export const getHistory = async (req, res) => {
  try {
    const documents = await Document.find({
      userId: req.user._id,
      'plagiarismCheck.checked': true,
    })
      .select('title plagiarismCheck createdAt')
      .sort({ 'plagiarismCheck.checkedAt': -1 })
      .limit(50)

    const history = documents.map(doc => ({
      documentId: doc._id,
      title: doc.title,
      similarityScore: doc.plagiarismCheck.similarityScore,
      sourcesFound: doc.plagiarismCheck.sources.length,
      risk: doc.plagiarismCheck.risk,
      checkedAt: doc.plagiarismCheck.checkedAt,
    }))

    res.json({
      success: true,
      data: history,
    })
  } catch (error) {
    console.error('Get history error:', error)
    res.status(500).json({
      success: false,
      message: 'Failed to get history',
      error: error.message,
    })
  }
}
