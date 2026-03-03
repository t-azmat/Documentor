import grammarService from '../services/grammarService.js'
import Document from '../models/Document.js'

/**
 * Check grammar in document
 */
export const checkGrammar = async (req, res) => {
  try {
    const { text, documentId } = req.body

    if (!text) {
      return res.status(400).json({
        success: false,
        message: 'Text is required',
      })
    }

    // Perform grammar check
    const grammarResults = await grammarService.checkGrammar(text)
    
    // Get readability metrics
    const readability = grammarService.calculateReadability(text)
    
    // Get academic tone suggestions
    const academicTone = await grammarService.enhanceAcademicTone(text)

    // If documentId provided, save results
    if (documentId) {
      const document = await Document.findOne({
        _id: documentId,
        userId: req.user._id,
      })

      if (document) {
        document.grammarCheck = {
          checked: true,
          checkedAt: new Date(),
          qualityScore: grammarResults.qualityScore,
          totalIssues: grammarResults.stats.totalIssues,
          issuesByType: grammarResults.stats,
        }
        await document.save()
      }
    }

    res.json({
      success: true,
      data: {
        grammar: grammarResults,
        readability,
        academicTone,
      },
    })
  } catch (error) {
    console.error('Grammar check error:', error)
    res.status(500).json({
      success: false,
      message: 'Grammar check failed',
      error: error.message,
    })
  }
}

/**
 * Get grammar suggestions for specific text
 */
export const getSuggestions = async (req, res) => {
  try {
    const { text, type = 'all' } = req.body

    if (!text) {
      return res.status(400).json({
        success: false,
        message: 'Text is required',
      })
    }

    const results = await grammarService.checkGrammar(text)
    
    // Filter by type if specified
    let filteredIssues = results.issues
    if (type !== 'all') {
      filteredIssues = results.issues.filter(issue => issue.type === type)
    }

    res.json({
      success: true,
      data: {
        issues: filteredIssues,
        count: filteredIssues.length,
      },
    })
  } catch (error) {
    console.error('Get suggestions error:', error)
    res.status(500).json({
      success: false,
      message: 'Failed to get suggestions',
      error: error.message,
    })
  }
}

/**
 * Check readability metrics
 */
export const checkReadability = async (req, res) => {
  try {
    const { text } = req.body

    if (!text) {
      return res.status(400).json({
        success: false,
        message: 'Text is required',
      })
    }

    const readability = grammarService.calculateReadability(text)

    res.json({
      success: true,
      data: readability,
    })
  } catch (error) {
    console.error('Readability check error:', error)
    res.status(500).json({
      success: false,
      message: 'Readability check failed',
      error: error.message,
    })
  }
}

/**
 * Enhance academic tone
 */
export const enhanceAcademicTone = async (req, res) => {
  try {
    const { text } = req.body

    if (!text) {
      return res.status(400).json({
        success: false,
        message: 'Text is required',
      })
    }

    const results = await grammarService.enhanceAcademicTone(text)

    res.json({
      success: true,
      data: results,
    })
  } catch (error) {
    console.error('Academic tone enhancement error:', error)
    res.status(500).json({
      success: false,
      message: 'Failed to enhance academic tone',
      error: error.message,
    })
  }
}

/**
 * Batch check multiple paragraphs
 */
export const batchCheck = async (req, res) => {
  try {
    const { paragraphs } = req.body

    if (!paragraphs || !Array.isArray(paragraphs)) {
      return res.status(400).json({
        success: false,
        message: 'Paragraphs array is required',
      })
    }

    const results = await Promise.all(
      paragraphs.map(async (text, index) => {
        const grammar = await grammarService.checkGrammar(text)
        return {
          index,
          grammar,
          readability: grammarService.calculateReadability(text),
        }
      })
    )

    res.json({
      success: true,
      data: results,
    })
  } catch (error) {
    console.error('Batch check error:', error)
    res.status(500).json({
      success: false,
      message: 'Batch check failed',
      error: error.message,
    })
  }
}

/**
 * Enhance document grammar and style
 */
export const enhanceDocument = async (req, res) => {
  try {
    const { text, documentId } = req.body

    if (!text) {
      return res.status(400).json({
        success: false,
        message: 'Text is required',
      })
    }

    // Call grammar enhancement service
    const enhanceResults = await grammarService.enhanceDocument(text)

    // If documentId provided, save enhanced version
    if (documentId) {
      const document = await Document.findOne({
        _id: documentId,
        userId: req.user._id,
      })

      if (document) {
        document.grammarCheck = {
          checked: true,
          checkedAt: new Date(),
          enhanced: enhanceResults.enhanced,
          changeCount: enhanceResults.changes?.length || 0,
          changeStats: enhanceResults.stats || {},
        }
        await document.save()
      }
    }

    res.json({
      success: true,
      data: enhanceResults,
    })
  } catch (error) {
    console.error('Enhancement error:', error)
    res.status(500).json({
      success: false,
      message: 'Document enhancement failed',
      error: error.message,
    })
  }
}

/**
 * Get grammar enhancement suggestions
 */
export const getEnhancementSuggestions = async (req, res) => {
  try {
    const { text } = req.body

    if (!text) {
      return res.status(400).json({
        success: false,
        message: 'Text is required',
      })
    }

    // Get suggestions from service
    const suggestions = await grammarService.getEnhancementSuggestions(text)

    res.json({
      success: true,
      data: suggestions,
    })
  } catch (error) {
    console.error('Suggestions error:', error)
    res.status(500).json({
      success: false,
      message: 'Failed to get suggestions',
      error: error.message,
    })
  }
}
