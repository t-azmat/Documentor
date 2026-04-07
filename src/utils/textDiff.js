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

/**
 * Compute an accurate word-level diff between two strings using LCS.
 * Preserves whitespace tokens so results can be rendered as React spans.
 *
 * Returns [{type: 'unchanged'|'add'|'remove', text: string}]
 *
 * Performance guard: if token-product > 80 000 the function falls back
 * to a single remove+add pair (avoids O(m·n) memory on very long texts).
 */
export const computeWordDiff = (original, enhanced) => {
  if (!original && !enhanced) return []
  if (!original) return [{ type: 'add', text: enhanced }]
  if (!enhanced) return [{ type: 'remove', text: original }]
  if (original === enhanced) return [{ type: 'unchanged', text: original }]

  const A = original.match(/\S+|\s+/g) || []
  const B = enhanced.match(/\S+|\s+/g) || []

  if (A.length * B.length > 80000) {
    return [{ type: 'remove', text: original }, { type: 'add', text: enhanced }]
  }

  const m = A.length
  const n = B.length
  // dp[i][j] = LCS length for A[i..] vs B[j..]
  const dp = Array.from({ length: m + 1 }, () => new Uint16Array(n + 1))
  for (let i = m - 1; i >= 0; i--) {
    for (let j = n - 1; j >= 0; j--) {
      dp[i][j] = A[i] === B[j]
        ? dp[i + 1][j + 1] + 1
        : Math.max(dp[i + 1][j], dp[i][j + 1])
    }
  }

  const result = []
  let i = 0, j = 0
  while (i < m || j < n) {
    if (i < m && j < n && A[i] === B[j]) {
      result.push({ type: 'unchanged', text: A[i] })
      i++; j++
    } else if (j < n && (i >= m || dp[i][j + 1] >= dp[i + 1][j])) {
      // Whitespace-only additions stay neutral to avoid spurious highlights
      result.push({ type: B[j].trim() ? 'add' : 'unchanged', text: B[j] })
      j++
    } else {
      result.push({ type: A[i].trim() ? 'remove' : 'unchanged', text: A[i] })
      i++
    }
  }
  return result
}
