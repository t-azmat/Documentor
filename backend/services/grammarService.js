import axios from 'axios'
import { HfInference } from '@huggingface/inference'

/**
 * Grammar Service using Hugging Face models
 * Using pre-trained models for grammar checking
 */
class GrammarService {
  constructor() {
    // Initialize Hugging Face client
    this.hf = new HfInference(process.env.HUGGINGFACE_API_KEY || 'hf_placeholder')
    
    // Fallback to LanguageTool API
    this.apiUrl = process.env.LANGUAGETOOL_API_URL || 'https://api.languagetool.org/v2/check'
    this.apiKey = process.env.LANGUAGETOOL_API_KEY || ''
    
    // Python grammar enhancer service endpoint
    this.pythonGrammarUrl = process.env.PYTHON_GRAMMAR_SERVICE_URL || 'http://localhost:5001'
    
    // Use Hugging Face by default
    this.useHuggingFace = true
  }

  /**
   * Enhance document grammar using Python service
   * Calls the Python FastAPI service for grammar enhancement
   * @param {string} text - The document text to enhance
   * @returns {Object} Enhanced text with changes
   */
  async enhanceDocument(text) {
    try {
      if (!text || text.trim().length === 0) {
        return {
          original: text,
          enhanced: text,
          changes: [],
          error: 'Empty text provided'
        }
      }

      // Try Python grammar enhancer service first
      try {
        const response = await axios.post(
          `${this.pythonGrammarUrl}/api/grammar/enhance`,
          { text },
          { timeout: 60000 } // 60 second timeout for model inference
        )

        if (response.data && response.data.success) {
          return response.data.data
        }
      } catch (pythonError) {
        console.warn('Python grammar enhancer unavailable, falling back to basic enhancement:', pythonError.message)
        
        // Fallback to basic regex-based enhancement
        return this.basicEnhanceDocument(text)
      }
    } catch (error) {
      console.error('Error enhancing document:', error.message)
      return {
        original: text,
        enhanced: text,
        changes: [],
        error: error.message
      }
    }
  }

  /**
   * Basic grammar enhancement using regex patterns
   * Fallback when Python service is unavailable
   * @param {string} text - The text to enhance
   * @returns {Object} Enhanced text with changes
   */
  basicEnhanceDocument(text) {
    let enhanced = text
    const changes = []
    
    // Rule 1: Fix double spaces
    const doubleSpaces = enhanced.match(/  +/g)
    if (doubleSpaces) {
      enhanced = enhanced.replace(/  +/g, ' ')
      changes.push({
        type: 'whitespace',
        rule: 'Remove multiple spaces',
        count: doubleSpaces.length
      })
    }
    
    // Rule 2: Fix space before punctuation
    const spacePunct = enhanced.match(/\s+([.,!?;:])/g)
    if (spacePunct) {
      enhanced = enhanced.replace(/\s+([.,!?;:])/g, '$1')
      changes.push({
        type: 'punctuation',
        rule: 'Remove space before punctuation',
        count: spacePunct.length
      })
    }
    
    // Rule 3: Capitalize sentence starts
    enhanced = enhanced.replace(/([.!?])\s+([a-z])/g, (match, punct, letter) => {
      return punct + ' ' + letter.toUpperCase()
    })
    
    // Rule 4: Fix "your" vs "you're"
    const yourMatches = enhanced.match(/\byour\s+(going|doing|coming|leaving|getting|being|saying|trying)\b/gi)
    if (yourMatches) {
      enhanced = enhanced.replace(
        /\byour\s+(going|doing|coming|leaving|getting|being|saying|trying)\b/gi,
        "you're $1"
      )
      changes.push({
        type: 'grammar',
        rule: 'Fix "your" vs "you\'re"',
        count: yourMatches.length
      })
    }
    
    // Rule 5: Fix "their" vs "there"
    const theirMatches = enhanced.match(/\btheir\s+(is|are|was|were)\b/gi)
    if (theirMatches) {
      enhanced = enhanced.replace(
        /\btheir\s+(is|are|was|were)\b/gi,
        "there $1"
      )
      changes.push({
        type: 'grammar',
        rule: 'Fix "their" vs "there"',
        count: theirMatches.length
      })
    }
    
    return {
      original: text,
      enhanced,
      changes,
      stats: {
        totalChanges: changes.length,
        method: 'basic_regex'
      }
    }
  }

  /**
   * Get grammar enhancement suggestions
   * @param {string} text - The text to analyze
   * @returns {Object} Suggestions for improvement
   */
  async getEnhancementSuggestions(text) {
    try {
      if (!text || text.trim().length === 0) {
        return { suggestions: [] }
      }

      // Try Python service
      try {
        const response = await axios.post(
          `${this.pythonGrammarUrl}/api/grammar/suggestions`,
          { text },
          { timeout: 30000 }
        )

        if (response.data && response.data.success) {
          return {
            suggestions: response.data.suggestions,
            source: 'python_service'
          }
        }
      } catch (pythonError) {
        console.warn('Python suggestion service unavailable')
        
        // Fallback to basic suggestions
        return this.basicGetSuggestions(text)
      }
    } catch (error) {
      console.error('Error getting suggestions:', error.message)
      return { suggestions: [], error: error.message }
    }
  }

  /**
   * Basic grammar suggestions (regex-based)
   * @param {string} text - The text to analyze
   * @returns {Object} Basic suggestions
   */
  basicGetSuggestions(text) {
    const suggestions = []

    // Check for contractions
    const contractions = text.match(/\b\w+'\w+\b/g)
    if (contractions) {
      suggestions.push({
        type: 'formality',
        message: 'Contractions found - avoid in formal writing',
        examples: [...new Set(contractions)].slice(0, 3),
        severity: 'minor'
      })
    }

    // Check for passive voice (basic detection)
    if (/\b(was|were|is|are)\s+\w+(?:ed|en)\b/gi.test(text)) {
      suggestions.push({
        type: 'style',
        message: 'Passive voice detected - consider using active voice',
        severity: 'minor'
      })
    }

    // Check for first-person pronouns
    const firstPerson = text.match(/\b(I|we|us|our|me|my)\b/gi)
    if (firstPerson && firstPerson.length > 3) {
      suggestions.push({
        type: 'academic_tone',
        message: 'Frequent first-person pronouns - use passive voice or third person in academic writing',
        count: firstPerson.length,
        severity: 'minor'
      })
    }

    return {
      suggestions,
      source: 'basic_rules'
    }
  }

  /**
   * Check grammar and style in text using Hugging Face
   * @param {string} text - The text to check
   * @param {string} language - Language code (default: en-US)
   * @returns {Object} Grammar check results
   */
  async checkGrammar(text, language = 'en-US') {
    try {
      if (this.useHuggingFace) {
        return await this.checkGrammarWithHuggingFace(text)
      }
      
      // Fallback to LanguageTool
      const params = new URLSearchParams({
        text: text,
        language: language,
        enabledOnly: 'false',
      })

      if (this.apiKey) {
        params.append('apiKey', this.apiKey)
      }

      const response = await axios.post(this.apiUrl, params, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Accept': 'application/json',
        },
        timeout: 30000,
      })

      return this.formatGrammarResults(response.data, text)
    } catch (error) {
      console.error('Grammar check error:', error.message)
      
      // Fallback to basic checks if API fails
      return this.basicGrammarCheck(text)
    }
  }

  /**
   * Check grammar using Hugging Face text generation model
   */
  async checkGrammarWithHuggingFace(text) {
    try {
      // Split text into sentences for processing
      const sentences = text.match(/[^\.!\?]+[\.!\?]+/g) || [text]
      const issues = []
      let totalCorrections = 0

      for (let i = 0; i < Math.min(sentences.length, 10); i++) {
        const sentence = sentences[i].trim()
        if (sentence.length < 10) continue

        try {
          // Use grammar correction model
          const result = await this.hf.textGeneration({
            model: 'prithivida/grammar_error_correcter_v1',
            inputs: sentence,
            parameters: {
              max_new_tokens: 100,
              temperature: 0.1,
              return_full_text: false,
            }
          })

          const correctedText = result.generated_text?.trim() || sentence
          
          if (correctedText !== sentence && correctedText.length > 0) {
            totalCorrections++
            issues.push({
              message: 'Grammar or style issue detected',
              shortMessage: 'Grammar issue',
              offset: text.indexOf(sentence),
              length: sentence.length,
              context: sentence,
              contextOffset: 0,
              contextLength: sentence.length,
              type: 'grammar',
              severity: 'major',
              suggestions: [correctedText],
              rule: {
                id: 'hf-grammar',
                description: 'Hugging Face Grammar Correction',
                category: 'Grammar',
              },
            })
          }
        } catch (err) {
          console.error('Error processing sentence:', err.message)
        }
      }

      const stats = {
        totalIssues: issues.length,
        grammar: issues.filter(i => i.type === 'grammar').length,
        spelling: issues.filter(i => i.type === 'spelling').length,
        style: issues.filter(i => i.type === 'style').length,
        punctuation: issues.filter(i => i.type === 'punctuation').length,
        critical: issues.filter(i => i.severity === 'critical').length,
        major: issues.filter(i => i.severity === 'major').length,
        minor: issues.filter(i => i.severity === 'minor').length,
      }

      const qualityScore = this.calculateQualityScore(stats, text.length)

      return {
        issues,
        stats,
        qualityScore,
        language: 'English',
        checkedAt: new Date(),
        source: 'Hugging Face',
      }
    } catch (error) {
      console.error('Hugging Face grammar check error:', error.message)
      // Fallback to basic check
      return this.basicGrammarCheck(text)
    }
  }

  /**
   * Format LanguageTool results
   */
  formatGrammarResults(data, originalText) {
    const matches = data.matches || []
    
    const issues = matches.map(match => ({
      message: match.message,
      shortMessage: match.shortMessage || match.message,
      offset: match.offset,
      length: match.length,
      context: match.context.text,
      contextOffset: match.context.offset,
      contextLength: match.context.length,
      type: this.categorizeIssue(match.rule.issueType),
      severity: this.getSeverity(match.rule.issueType),
      suggestions: match.replacements.slice(0, 3).map(r => r.value),
      rule: {
        id: match.rule.id,
        description: match.rule.description,
        category: match.rule.category.name,
      },
    }))

    // Calculate statistics
    const stats = {
      totalIssues: issues.length,
      grammar: issues.filter(i => i.type === 'grammar').length,
      spelling: issues.filter(i => i.type === 'spelling').length,
      style: issues.filter(i => i.type === 'style').length,
      punctuation: issues.filter(i => i.type === 'punctuation').length,
      critical: issues.filter(i => i.severity === 'critical').length,
      major: issues.filter(i => i.severity === 'major').length,
      minor: issues.filter(i => i.severity === 'minor').length,
    }

    // Calculate quality score (0-100)
    const qualityScore = this.calculateQualityScore(stats, originalText.length)

    return {
      issues,
      stats,
      qualityScore,
      language: data.language.name,
      checkedAt: new Date(),
    }
  }

  /**
   * Categorize issue type
   */
  categorizeIssue(issueType) {
    const typeMap = {
      'misspelling': 'spelling',
      'typographical': 'spelling',
      'grammar': 'grammar',
      'style': 'style',
      'punctuation': 'punctuation',
      'whitespace': 'style',
      'capitalization': 'grammar',
      'redundancy': 'style',
      'repetition': 'style',
      'wordiness': 'style',
      'clarity': 'style',
    }

    return typeMap[issueType?.toLowerCase()] || 'other'
  }

  /**
   * Get severity level
   */
  getSeverity(issueType) {
    const severityMap = {
      'misspelling': 'major',
      'grammar': 'major',
      'typographical': 'major',
      'style': 'minor',
      'punctuation': 'critical',
      'capitalization': 'major',
      'redundancy': 'minor',
      'clarity': 'minor',
    }

    return severityMap[issueType?.toLowerCase()] || 'minor'
  }

  /**
   * Calculate quality score based on issues
   */
  calculateQualityScore(stats, textLength) {
    if (textLength === 0) return 100

    // Deduct points based on issue severity and text length
    const wordsApprox = textLength / 5 // Approximate word count
    const issuesPerHundredWords = (stats.totalIssues / wordsApprox) * 100

    let score = 100

    // Deduct based on issues per 100 words
    if (issuesPerHundredWords > 20) score -= 50
    else if (issuesPerHundredWords > 15) score -= 40
    else if (issuesPerHundredWords > 10) score -= 30
    else if (issuesPerHundredWords > 5) score -= 20
    else if (issuesPerHundredWords > 2) score -= 10

    // Additional deductions for critical issues
    score -= stats.critical * 5
    score -= stats.major * 2
    score -= stats.minor * 0.5

    return Math.max(0, Math.min(100, Math.round(score)))
  }

  /**
   * Basic grammar check (fallback)
   */
  basicGrammarCheck(text) {
    const issues = []

    // Check for common issues
    const commonErrors = [
      { pattern: /\bi\b/g, type: 'capitalization', message: 'Personal pronoun "I" should be capitalized', suggestion: 'I' },
      { pattern: /\s{2,}/g, type: 'whitespace', message: 'Multiple consecutive spaces', suggestion: ' ' },
      { pattern: /([.!?])\s*([a-z])/g, type: 'capitalization', message: 'Sentence should start with capital letter' },
      { pattern: /\s+([.,;!?])/g, type: 'punctuation', message: 'No space before punctuation' },
      { pattern: /their\s+are\b/gi, type: 'grammar', message: 'Did you mean "there are"?', suggestion: 'there are' },
      { pattern: /your\s+(going|doing)\b/gi, type: 'grammar', message: 'Did you mean "you\'re"?', suggestion: 'you\'re' },
    ]

    commonErrors.forEach(({ pattern, type, message, suggestion }) => {
      let match
      while ((match = pattern.exec(text)) !== null) {
        issues.push({
          message,
          offset: match.index,
          length: match[0].length,
          type,
          severity: 'major',
          suggestions: suggestion ? [suggestion] : [],
          rule: { id: 'basic-check', description: 'Basic grammar rule', category: 'Grammar' },
        })
      }
    })

    const stats = {
      totalIssues: issues.length,
      grammar: issues.filter(i => i.type === 'grammar').length,
      spelling: 0,
      style: issues.filter(i => i.type === 'style').length,
      punctuation: issues.filter(i => i.type === 'punctuation').length,
      critical: 0,
      major: issues.length,
      minor: 0,
    }

    return {
      issues,
      stats,
      qualityScore: this.calculateQualityScore(stats, text.length),
      language: 'English',
      checkedAt: new Date(),
      fallback: true,
    }
  }

  /**
   * Enhance text for academic tone
   */
  async enhanceAcademicTone(text) {
    const suggestions = []

    // Replace informal words with academic alternatives
    const informalToFormal = {
      'a lot of': 'numerous',
      'lots of': 'many',
      'big': 'significant',
      'small': 'minimal',
      'get': 'obtain',
      'got': 'obtained',
      'show': 'demonstrate',
      'shows': 'demonstrates',
      'really': 'considerably',
      'very': 'highly',
      'things': 'aspects',
      'stuff': 'materials',
      'kids': 'children',
      'guys': 'individuals',
      'okay': 'acceptable',
      'good': 'effective',
      'bad': 'ineffective',
      'pretty': 'fairly',
      'kind of': 'somewhat',
      'sort of': 'somewhat',
    }

    Object.entries(informalToFormal).forEach(([informal, formal]) => {
      const regex = new RegExp(`\\b${informal}\\b`, 'gi')
      if (regex.test(text)) {
        suggestions.push({
          type: 'academic-tone',
          informal,
          formal,
          message: `Consider using "${formal}" instead of "${informal}" for more formal tone`,
        })
      }
    })

    // Check for contractions
    const contractions = text.match(/\b\w+'\w+\b/g) || []
    contractions.forEach(contraction => {
      suggestions.push({
        type: 'contraction',
        text: contraction,
        message: `Avoid contractions in academic writing. Expand "${contraction}"`,
      })
    })

    // Check for first-person pronouns (context-dependent)
    const firstPerson = text.match(/\b(I|me|my|mine|we|us|our|ours)\b/gi) || []
    if (firstPerson.length > 0) {
      suggestions.push({
        type: 'first-person',
        count: firstPerson.length,
        message: 'Consider using passive voice or third person in academic writing',
      })
    }

    return {
      suggestions,
      academicScore: Math.max(0, 100 - (suggestions.length * 5)),
    }
  }

  /**
   * Get readability metrics
   */
  calculateReadability(text) {
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0)
    const words = text.split(/\s+/).filter(w => w.length > 0)
    const syllables = words.reduce((sum, word) => sum + this.countSyllables(word), 0)
    const characters = text.replace(/\s/g, '').length

    // Flesch Reading Ease
    const fleschScore = 206.835 - 1.015 * (words.length / sentences.length) - 84.6 * (syllables / words.length)
    
    // Gunning Fog Index
    const complexWords = words.filter(w => this.countSyllables(w) > 2).length
    const fogIndex = 0.4 * ((words.length / sentences.length) + 100 * (complexWords / words.length))

    return {
      sentences: sentences.length,
      words: words.length,
      characters,
      syllables,
      avgWordsPerSentence: Math.round((words.length / sentences.length) * 10) / 10,
      avgSyllablesPerWord: Math.round((syllables / words.length) * 100) / 100,
      fleschReadingEase: Math.round(fleschScore),
      fleschLevel: this.getFleschLevel(fleschScore),
      gunningFogIndex: Math.round(fogIndex * 10) / 10,
    }
  }

  /**
   * Count syllables in a word (approximation)
   */
  countSyllables(word) {
    word = word.toLowerCase().replace(/[^a-z]/g, '')
    if (word.length <= 3) return 1
    
    const vowels = word.match(/[aeiouy]+/g)
    let count = vowels ? vowels.length : 1
    
    if (word.endsWith('e')) count--
    if (word.endsWith('le') && word.length > 2) count++
    
    return Math.max(1, count)
  }

  /**
   * Get Flesch reading level description
   */
  getFleschLevel(score) {
    if (score >= 90) return 'Very Easy (5th grade)'
    if (score >= 80) return 'Easy (6th grade)'
    if (score >= 70) return 'Fairly Easy (7th grade)'
    if (score >= 60) return 'Standard (8th-9th grade)'
    if (score >= 50) return 'Fairly Difficult (10th-12th grade)'
    if (score >= 30) return 'Difficult (College)'
    return 'Very Difficult (College Graduate)'
  }
}

export default new GrammarService()
