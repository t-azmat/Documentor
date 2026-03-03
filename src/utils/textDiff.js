/**
 * Text Diff Utilities
 * Utilities for tracking and visualizing changes between original and enhanced text
 */

/**
 * Calculate word-level diffs between original and enhanced text
 * @param {string} original - Original text
 * @param {string} enhanced - Enhanced text
 * @returns {Array} Array of diff objects with type and text
 */
export const getWordDiffs = (original, enhanced) => {
  if (!original || !enhanced) return []

  const origWords = original.split(/(\s+)/)
  const enhWords = enhanced.split(/(\s+)/)
  const diffs = []

  let origIdx = 0
  let enhIdx = 0

  while (origIdx < origWords.length || enhIdx < origWords.length) {
    if (origIdx >= origWords.length) {
      diffs.push({ type: 'add', text: enhWords[enhIdx] })
      enhIdx++
    } else if (enhIdx >= enhWords.length) {
      diffs.push({ type: 'remove', text: origWords[origIdx] })
      origIdx++
    } else if (origWords[origIdx] === enhWords[enhIdx]) {
      diffs.push({ type: 'unchanged', text: origWords[origIdx] })
      origIdx++
      enhIdx++
    } else {
      // Look ahead for matches
      let foundMatch = false

      for (let i = 1; i < Math.min(3, enhWords.length - enhIdx); i++) {
        if (origWords[origIdx] === enhWords[enhIdx + i]) {
          for (let j = 0; j < i; j++) {
            diffs.push({ type: 'add', text: enhWords[enhIdx + j] })
          }
          enhIdx += i
          foundMatch = true
          break
        }
      }

      if (!foundMatch) {
        diffs.push({ type: 'remove', text: origWords[origIdx] })
        origIdx++
      }
    }
  }

  return diffs
}

/**
 * Get sentence-level changes
 * @param {string} original - Original text
 * @param {string} enhanced - Enhanced text
 * @returns {Array} Array of sentence changes
 */
export const getSentenceChanges = (original, enhanced) => {
  if (!original || !enhanced) return []

  // Split by common sentence endings
  const sentenceRegex = /[.!?]+\s+/
  const origSentences = original
    .split(sentenceRegex)
    .filter((s) => s.trim())
    .map((s) => s.trim())
  const enhSentences = enhanced
    .split(sentenceRegex)
    .filter((s) => s.trim())
    .map((s) => s.trim())

  const changes = []

  for (let i = 0; i < Math.max(origSentences.length, enhSentences.length); i++) {
    const origSent = origSentences[i] || ''
    const enhSent = enhSentences[i] || ''

    if (origSent !== enhSent) {
      changes.push({
        index: i,
        original: origSent,
        enhanced: enhSent,
        changed: true,
      })
    } else {
      changes.push({
        index: i,
        original: origSent,
        enhanced: enhSent,
        changed: false,
      })
    }
  }

  return changes
}

/**
 * Highlight differences in text with HTML markup
 * @param {string} text - Text to highlight
 * @param {string} type - Type of highlight: 'add', 'remove', 'change'
 * @returns {string} HTML with highlighting
 */
export const highlightDiff = (text, type = 'change') => {
  if (!text) return ''

  const className = {
    add: 'bg-green-200 text-green-900 font-medium',
    remove: 'bg-red-200 text-red-900 font-medium line-through',
    change: 'bg-yellow-200 text-yellow-900 font-medium',
  }[type] || 'bg-yellow-200'

  return `<span class="${className}">${text}</span>`
}

/**
 * Create a visual diff showing what changed
 * @param {string} original - Original sentence
 * @param {string} enhanced - Enhanced sentence
 * @returns {Object} Object with highlighted versions
 */
export const visualizeSentenceDiff = (original, enhanced) => {
  if (!original || !enhanced) {
    return {
      original,
      enhanced,
      diffs: [],
    }
  }

  // Split into words while preserving spaces
  const origWords = original.match(/\S+|\s+/g) || []
  const enhWords = enhanced.match(/\S+|\s+/g) || []

  const diffs = []
  let origIdx = 0
  let enhIdx = 0

  while (origIdx < origWords.length || enhIdx < enhWords.length) {
    const origWord = origWords[origIdx]
    const enhWord = enhWords[enhIdx]

    if (origWord === enhWord || (origWord?.trim() === '' && enhWord?.trim() === '')) {
      if (origWord?.trim() !== '') {
        diffs.push({ type: 'unchanged', text: origWord })
      }
      origIdx++
      enhIdx++
    } else if (origWord?.trim() === '') {
      diffs.push({ type: 'unchanged', text: origWord })
      origIdx++
    } else if (enhWord?.trim() === '') {
      diffs.push({ type: 'unchanged', text: enhWord })
      enhIdx++
    } else {
      diffs.push({ type: 'change', original: origWord, enhanced: enhWord })
      origIdx++
      enhIdx++
    }
  }

  return {
    original,
    enhanced,
    diffs,
  }
}

/**
 * Count statistics about changes
 * @param {Array} changes - Array of change objects from getSentenceChanges
 * @returns {Object} Statistics object
 */
export const getChangeStats = (changes) => {
  return {
    total: changes.length,
    changed: changes.filter((c) => c.changed).length,
    unchanged: changes.filter((c) => !c.changed).length,
    changePercentage: changes.length > 0
      ? Math.round((changes.filter((c) => c.changed).length / changes.length) * 100)
      : 0,
  }
}

/**
 * Format text for display with line breaks preserved
 * @param {string} text - Text to format
 * @returns {Array} Array of text segments
 */
export const formatTextForDisplay = (text) => {
  if (!text) return []

  return text
    .split('\n')
    .filter((line) => line.trim())
    .map((line) => line.trim())
}

/**
 * Create a side-by-side comparison of sentences
 * @param {Array} changes - Array of sentence changes
 * @returns {Array} Formatted comparison array
 */
export const createSideBySideComparison = (changes) => {
  return changes
    .filter((change) => change.changed)
    .map((change) => ({
      ...change,
      diff: visualizeSentenceDiff(change.original, change.enhanced),
    }))
}
