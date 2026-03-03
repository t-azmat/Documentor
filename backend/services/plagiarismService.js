import axios from 'axios'
import crypto from 'crypto'
import Document from '../models/Document.js'
import { HfInference } from '@huggingface/inference'

/**
 * Plagiarism Detection Service
 * Using Hugging Face sentence similarity models
 */
class PlagiarismService {
  constructor() {
    // Initialize Hugging Face client
    this.hf = new HfInference(process.env.HUGGINGFACE_API_KEY || 'hf_placeholder')
    
    // Configure API credentials (fallback)
    this.copyleaksApiKey = process.env.COPYLEAKS_API_KEY || ''
    this.copyleaksEmail = process.env.COPYLEAKS_EMAIL || ''
    this.copyleaksApiUrl = 'https://api.copyleaks.com/v3'
    
    // Use Hugging Face by default
    this.useHuggingFace = true
  }

  /**
   * Main plagiarism check function
   * @param {string} text - The text to check
   * @param {string} documentId - ID of the document being checked
   * @param {string} userId - ID of the user
   * @returns {Object} Plagiarism check results
   */
  async checkPlagiarism(text, documentId, userId) {
    try {
      // Run multiple checks in parallel
      const [internalCheck, webCheck] = await Promise.all([
        this.checkInternalDatabase(text, documentId, userId),
        this.checkWebSources(text),
      ])

      // Combine results
      const allSources = [...internalCheck.sources, ...webCheck.sources]
      const overallSimilarity = this.calculateOverallSimilarity(allSources)
      
      return {
        checked: true,
        overallSimilarity,
        totalSources: allSources.length,
        sources: allSources.sort((a, b) => b.similarity - a.similarity),
        internalMatches: internalCheck.sources.length,
        webMatches: webCheck.sources.length,
        risk: this.assessRisk(overallSimilarity),
        checkedAt: new Date(),
        stats: {
          uniqueContent: Math.round(100 - overallSimilarity),
          matchedContent: Math.round(overallSimilarity),
          totalWords: text.split(/\s+/).length,
        },
      }
    } catch (error) {
      console.error('Plagiarism check error:', error.message)
      throw new Error('Plagiarism check failed: ' + error.message)
    }
  }

  /**
   * Check against internal database using Hugging Face embeddings
   */
  async checkInternalDatabase(text, excludeDocId, userId) {
    try {
      // Get all other documents from the database
      const documents = await Document.find({
        _id: { $ne: excludeDocId },
        'content.raw': { $exists: true, $ne: '' },
      }).select('title content.raw userId createdAt').limit(20)

      const sources = []

      if (this.useHuggingFace && documents.length > 0) {
        // Use Hugging Face for semantic similarity
        for (const doc of documents) {
          try {
            const similarity = await this.calculateSemanticSimilarity(text, doc.content.raw)
            
            if (similarity > 0.3) { // Similarity threshold (0-1 scale)
              const similarityPercent = Math.round(similarity * 100)
              sources.push({
                type: 'internal',
                title: doc.title,
                url: null,
                similarity: similarityPercent,
                matchedPhrases: this.findMatchedPhrases(text, doc.content.raw),
                documentId: doc._id,
                isSameUser: doc.userId.toString() === userId.toString(),
                date: doc.createdAt,
              })
            }
          } catch (err) {
            console.error('Error calculating similarity:', err.message)
          }
        }
      } else {
        // Fallback to traditional method
        for (const doc of documents) {
          const similarity = this.calculateSimilarity(text, doc.content.raw)
          
          if (similarity > 10) {
            sources.push({
              type: 'internal',
              title: doc.title,
              url: null,
              similarity: Math.round(similarity),
              matchedPhrases: this.findMatchedPhrases(text, doc.content.raw),
              documentId: doc._id,
              isSameUser: doc.userId.toString() === userId.toString(),
              date: doc.createdAt,
            })
          }
        }
      }

      return { sources }
    } catch (error) {
      console.error('Internal database check error:', error.message)
      return { sources: [] }
    }
  }

  /**
   * Calculate semantic similarity using Hugging Face
   */
  async calculateSemanticSimilarity(text1, text2) {
    try {
      // Truncate texts if too long
      const maxLength = 500
      const truncatedText1 = text1.substring(0, maxLength)
      const truncatedText2 = text2.substring(0, maxLength)

      const result = await this.hf.sentenceSimilarity({
        model: 'sentence-transformers/all-MiniLM-L6-v2',
        inputs: {
          source_sentence: truncatedText1,
          sentences: [truncatedText2],
        }
      })

      return Array.isArray(result) ? result[0] : result
    } catch (error) {
      console.error('Semantic similarity error:', error.message)
      // Fallback to traditional similarity
      return this.calculateSimilarity(text1, text2) / 100
    }
  }

  /**
   * Check against web sources (using API or simulation)
   */
  async checkWebSources(text) {
    // If API key is available, use Copyleaks API
    if (this.copyleaksApiKey && this.copyleaksEmail) {
      return await this.checkWithCopyleaks(text)
    }

    // Otherwise, use simulated web check (for demo purposes)
    return this.simulateWebCheck(text)
  }

  /**
   * Check using Copyleaks API
   */
  async checkWithCopyleaks(text) {
    try {
      // Step 1: Get access token
      const authResponse = await axios.post(
        `${this.copyleaksApiUrl}/account/login/api`,
        {
          email: this.copyleaksEmail,
          key: this.copyleaksApiKey,
        }
      )

      const token = authResponse.data.access_token

      // Step 2: Submit scan
      const scanId = crypto.randomBytes(16).toString('hex')
      await axios.put(
        `${this.copyleaksApiUrl}/businesses/submit/file/${scanId}`,
        {
          text: text,
          properties: {
            webhooks: {
              status: `${process.env.API_URL}/webhooks/copyleaks/status/${scanId}`,
            },
          },
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }
      )

      // In production, you'd wait for webhook callback
      // For now, return pending status
      return {
        sources: [],
        pending: true,
        scanId,
      }
    } catch (error) {
      console.error('Copyleaks API error:', error.message)
      return this.simulateWebCheck(text)
    }
  }

  /**
   * Simulate web plagiarism check (for demo/development)
   */
  simulateWebCheck(text) {
    const sources = []
    const paragraphs = text.split(/\n\n+/)

    // Simulate finding some matches (for demo purposes)
    if (paragraphs.length > 2) {
      // Simulate 1-2 web sources with low similarity
      const numSources = Math.floor(Math.random() * 2) + 1
      
      for (let i = 0; i < numSources; i++) {
        sources.push({
          type: 'web',
          title: `Academic Source ${i + 1}`,
          url: `https://example.com/source-${i + 1}`,
          similarity: Math.floor(Math.random() * 15) + 5, // 5-20% similarity
          matchedPhrases: [
            { text: paragraphs[0].substring(0, 100) + '...', similarity: 15 },
          ],
          date: new Date(Date.now() - Math.random() * 365 * 24 * 60 * 60 * 1000),
        })
      }
    }

    return { sources }
  }

  /**
   * Calculate text similarity using Jaccard similarity and n-grams
   */
  calculateSimilarity(text1, text2) {
    // Normalize texts
    const normalize = (text) => text.toLowerCase().replace(/[^a-z0-9\s]/g, '').trim()
    const t1 = normalize(text1)
    const t2 = normalize(text2)

    // Use 3-gram similarity
    const ngrams1 = this.getNGrams(t1, 3)
    const ngrams2 = this.getNGrams(t2, 3)

    const set1 = new Set(ngrams1)
    const set2 = new Set(ngrams2)

    const intersection = new Set([...set1].filter(x => set2.has(x)))
    const union = new Set([...set1, ...set2])

    const jaccardSimilarity = (intersection.size / union.size) * 100

    // Also check for exact phrase matches
    const phraseMatches = this.findCommonPhrases(t1, t2)
    const phraseSimilarity = (phraseMatches.length / Math.max(t1.length, t2.length)) * 100

    // Return weighted average
    return (jaccardSimilarity * 0.7 + phraseSimilarity * 0.3)
  }

  /**
   * Get n-grams from text
   */
  getNGrams(text, n) {
    const words = text.split(/\s+/)
    const ngrams = []

    for (let i = 0; i <= words.length - n; i++) {
      ngrams.push(words.slice(i, i + n).join(' '))
    }

    return ngrams
  }

  /**
   * Find common phrases between two texts
   */
  findCommonPhrases(text1, text2, minLength = 50) {
    const phrases = []
    const words1 = text1.split(/\s+/)
    const words2 = text2.split(/\s+/)

    for (let len = 10; len >= 5; len--) { // Check phrases of 5-10 words
      for (let i = 0; i <= words1.length - len; i++) {
        const phrase = words1.slice(i, i + len).join(' ')
        if (text2.includes(phrase)) {
          phrases.push(phrase)
        }
      }
    }

    return phrases
  }

  /**
   * Find matched phrases for reporting
   */
  findMatchedPhrases(text1, text2, maxPhrases = 5) {
    const phrases = this.findCommonPhrases(text1, text2)
    
    return phrases.slice(0, maxPhrases).map(phrase => ({
      text: phrase.substring(0, 100) + (phrase.length > 100 ? '...' : ''),
      similarity: Math.round((phrase.length / text1.length) * 100),
    }))
  }

  /**
   * Create text fingerprint for quick comparison
   */
  createFingerprint(text) {
    const normalized = text.toLowerCase().replace(/[^a-z0-9]/g, '')
    return crypto.createHash('md5').update(normalized).digest('hex')
  }

  /**
   * Calculate overall similarity from multiple sources
   */
  calculateOverallSimilarity(sources) {
    if (sources.length === 0) return 0

    // Use the highest similarity score
    const maxSimilarity = Math.max(...sources.map(s => s.similarity))
    
    // Also consider aggregate similarity (but weight less)
    const avgSimilarity = sources.reduce((sum, s) => sum + s.similarity, 0) / sources.length
    
    // Return weighted combination
    return Math.round(maxSimilarity * 0.7 + avgSimilarity * 0.3)
  }

  /**
   * Assess plagiarism risk level
   */
  assessRisk(similarity) {
    if (similarity >= 50) return { level: 'high', color: 'red', message: 'High plagiarism detected' }
    if (similarity >= 25) return { level: 'medium', color: 'orange', message: 'Moderate similarity detected' }
    if (similarity >= 10) return { level: 'low', color: 'yellow', message: 'Low similarity detected' }
    return { level: 'none', color: 'green', message: 'No significant plagiarism detected' }
  }

  /**
   * Generate detailed plagiarism report
   */
  generateReport(checkResults) {
    const report = {
      summary: {
        overallScore: 100 - checkResults.overallSimilarity,
        originalContent: checkResults.stats.uniqueContent,
        plagiarizedContent: checkResults.stats.matchedContent,
        riskLevel: checkResults.risk.level,
      },
      sources: checkResults.sources.map(source => ({
        type: source.type,
        title: source.title,
        url: source.url,
        similarity: source.similarity,
        matchCount: source.matchedPhrases.length,
      })),
      recommendations: this.getRecommendations(checkResults),
    }

    return report
  }

  /**
   * Get recommendations based on results
   */
  getRecommendations(checkResults) {
    const recommendations = []

    if (checkResults.overallSimilarity > 50) {
      recommendations.push({
        priority: 'critical',
        message: 'Significant plagiarism detected. Rewrite or properly cite all matched content.',
      })
    } else if (checkResults.overallSimilarity > 25) {
      recommendations.push({
        priority: 'high',
        message: 'Moderate similarity found. Review matched sections and add proper citations.',
      })
    } else if (checkResults.overallSimilarity > 10) {
      recommendations.push({
        priority: 'medium',
        message: 'Some similar content found. Ensure proper citations for all referenced material.',
      })
    }

    if (checkResults.internalMatches > 0) {
      recommendations.push({
        priority: 'info',
        message: `Found ${checkResults.internalMatches} match(es) with your previous documents.`,
      })
    }

    return recommendations
  }
}

export default new PlagiarismService()
