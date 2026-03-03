import { HfInference } from '@huggingface/inference'

/**
 * NLP Service for Smart Document Ingestion
 * Extracts entities, keywords, summarizes, and analyzes documents
 */
class NLPService {
  constructor() {
    this.hf = new HfInference(process.env.HUGGINGFACE_API_KEY || 'hf_placeholder')
  }

  /**
   * Main document ingestion with NLP processing
   */
  async processDocument(text, metadata = {}) {
    try {
      const [
        entities,
        keywords,
        summary,
        sentiment,
        classification,
      ] = await Promise.allSettled([
        this.extractEntities(text),
        this.extractKeywords(text),
        this.generateSummary(text),
        this.analyzeSentiment(text),
        this.classifyDocument(text),
      ])

      return {
        entities: entities.status === 'fulfilled' ? entities.value : [],
        keywords: keywords.status === 'fulfilled' ? keywords.value : [],
        summary: summary.status === 'fulfilled' ? summary.value : '',
        sentiment: sentiment.status === 'fulfilled' ? sentiment.value : null,
        classification: classification.status === 'fulfilled' ? classification.value : null,
        processedAt: new Date(),
        metadata: {
          ...metadata,
          wordCount: this.countWords(text),
          sentenceCount: this.countSentences(text),
          paragraphCount: this.countParagraphs(text),
          readingTime: this.estimateReadingTime(text),
        },
      }
    } catch (error) {
      console.error('NLP processing error:', error.message)
      throw error
    }
  }

  /**
   * Extract named entities (people, organizations, locations, dates)
   */
  async extractEntities(text) {
    try {
      const truncatedText = text.substring(0, 1000)
      
      const result = await this.hf.tokenClassification({
        model: 'dslim/bert-base-NER',
        inputs: truncatedText,
      })

      // Group entities by type
      const entities = {
        persons: [],
        organizations: [],
        locations: [],
        dates: [],
        other: [],
      }

      let currentEntity = null
      let currentWord = ''

      result.forEach((token) => {
        const entityType = token.entity_group || token.entity
        
        if (entityType.startsWith('B-') || entityType.startsWith('I-')) {
          const type = entityType.substring(2)
          
          if (entityType.startsWith('B-') && currentEntity) {
            this.addEntity(entities, currentEntity, currentWord.trim())
            currentWord = ''
          }
          
          currentEntity = type
          currentWord += token.word.replace('##', '')
        } else {
          if (currentEntity) {
            this.addEntity(entities, currentEntity, currentWord.trim())
            currentEntity = null
            currentWord = ''
          }
        }
      })

      // Add last entity if exists
      if (currentEntity && currentWord) {
        this.addEntity(entities, currentEntity, currentWord.trim())
      }

      return {
        persons: [...new Set(entities.persons)],
        organizations: [...new Set(entities.organizations)],
        locations: [...new Set(entities.locations)],
        dates: [...new Set(entities.dates)],
        other: [...new Set(entities.other)],
      }
    } catch (error) {
      console.error('Entity extraction error:', error.message)
      return this.fallbackEntityExtraction(text)
    }
  }

  /**
   * Helper to add entity to appropriate category
   */
  addEntity(entities, type, word) {
    if (!word || word.length < 2) return

    switch (type.toUpperCase()) {
      case 'PER':
      case 'PERSON':
        entities.persons.push(word)
        break
      case 'ORG':
      case 'ORGANIZATION':
        entities.organizations.push(word)
        break
      case 'LOC':
      case 'LOCATION':
        entities.locations.push(word)
        break
      case 'DATE':
      case 'TIME':
        entities.dates.push(word)
        break
      default:
        entities.other.push(word)
    }
  }

  /**
   * Extract keywords using question-answering model
   */
  async extractKeywords(text) {
    try {
      // Use TF-IDF style keyword extraction
      const words = text.toLowerCase()
        .replace(/[^\w\s]/g, '')
        .split(/\s+/)
        .filter(word => word.length > 3)

      const stopWords = new Set([
        'the', 'and', 'for', 'are', 'but', 'not', 'you', 'all', 'can', 'her',
        'was', 'one', 'our', 'out', 'day', 'get', 'has', 'him', 'his', 'how',
        'into', 'may', 'said', 'she', 'that', 'this', 'them', 'then', 'they',
        'will', 'with', 'have', 'from', 'been', 'were', 'would', 'there', 'their',
      ])

      // Count word frequency
      const wordCount = {}
      words.forEach(word => {
        if (!stopWords.has(word)) {
          wordCount[word] = (wordCount[word] || 0) + 1
        }
      })

      // Get top keywords
      const keywords = Object.entries(wordCount)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 10)
        .map(([word]) => word)

      return keywords
    } catch (error) {
      console.error('Keyword extraction error:', error.message)
      return []
    }
  }

  /**
   * Generate document summary
   */
  async generateSummary(text) {
    try {
      // Truncate text for summarization (most models have token limits)
      const maxLength = 1024
      const truncatedText = text.substring(0, maxLength)

      if (truncatedText.split(/\s+/).length < 50) {
        return truncatedText
      }

      const result = await this.hf.summarization({
        model: 'facebook/bart-large-cnn',
        inputs: truncatedText,
        parameters: {
          max_length: 130,
          min_length: 30,
          do_sample: false,
        }
      })

      return result.summary_text
    } catch (error) {
      console.error('Summarization error:', error.message)
      // Return first 200 characters as fallback
      return text.substring(0, 200) + '...'
    }
  }

  /**
   * Analyze sentiment of the document
   */
  async analyzeSentiment(text) {
    try {
      const truncatedText = text.substring(0, 512)

      const result = await this.hf.textClassification({
        model: 'distilbert-base-uncased-finetuned-sst-2-english',
        inputs: truncatedText,
      })

      return {
        label: result[0].label.toLowerCase(),
        score: result[0].score,
        confidence: Math.round(result[0].score * 100),
      }
    } catch (error) {
      console.error('Sentiment analysis error:', error.message)
      return null
    }
  }

  /**
   * Classify document type/category
   */
  async classifyDocument(text) {
    try {
      const truncatedText = text.substring(0, 512)

      const result = await this.hf.zeroShotClassification({
        model: 'facebook/bart-large-mnli',
        inputs: truncatedText,
        parameters: {
          candidate_labels: [
            'research paper',
            'essay',
            'report',
            'article',
            'thesis',
            'review',
            'technical document',
            'creative writing',
            'business document',
            'academic paper',
          ],
        }
      })

      return {
        category: result.labels[0],
        confidence: Math.round(result.scores[0] * 100),
        alternatives: result.labels.slice(1, 4).map((label, idx) => ({
          category: label,
          confidence: Math.round(result.scores[idx + 1] * 100),
        })),
      }
    } catch (error) {
      console.error('Document classification error:', error.message)
      return null
    }
  }

  /**
   * Fallback entity extraction using regex
   */
  fallbackEntityExtraction(text) {
    const entities = {
      persons: [],
      organizations: [],
      locations: [],
      dates: [],
      other: [],
    }

    // Extract capitalized words (potential names)
    const capitalizedPattern = /\b[A-Z][a-z]+ [A-Z][a-z]+\b/g
    const names = text.match(capitalizedPattern) || []
    entities.persons = [...new Set(names)].slice(0, 5)

    // Extract dates
    const datePattern = /\b\d{1,2}[-/]\d{1,2}[-/]\d{2,4}\b|\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]* \d{1,2},? \d{4}\b/gi
    const dates = text.match(datePattern) || []
    entities.dates = [...new Set(dates)].slice(0, 5)

    return entities
  }

  /**
   * Count words in text
   */
  countWords(text) {
    return text.split(/\s+/).filter(word => word.length > 0).length
  }

  /**
   * Count sentences in text
   */
  countSentences(text) {
    return (text.match(/[.!?]+/g) || []).length
  }

  /**
   * Count paragraphs in text
   */
  countParagraphs(text) {
    return text.split(/\n\n+/).filter(p => p.trim().length > 0).length
  }

  /**
   * Estimate reading time in minutes
   */
  estimateReadingTime(text) {
    const wordsPerMinute = 200
    const wordCount = this.countWords(text)
    return Math.ceil(wordCount / wordsPerMinute)
  }

  /**
   * Extract topics using keyword clustering
   */
  extractTopics(text, numTopics = 3) {
    // Simple topic extraction based on keyword co-occurrence
    const sentences = text.split(/[.!?]+/)
    const topics = []

    // This is a simplified version - in production, you'd use LDA or similar
    const keywords = this.extractKeywords(text)
    
    for (let i = 0; i < Math.min(numTopics, keywords.length); i += 3) {
      topics.push({
        keywords: keywords.slice(i, i + 3),
        relevance: 1 - (i / keywords.length),
      })
    }

    return topics
  }
}

export default new NLPService()
