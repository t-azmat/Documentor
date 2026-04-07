import { useState, useRef, useMemo } from 'react'
import { FaMagic, FaUpload, FaFileAlt, FaSpellCheck, FaCheck, FaUndo, FaCopy, FaDownload } from 'react-icons/fa'
import { grammarAPI } from '../../services/api'
import { fileExtractorAPI } from '../../services/pythonNlpService'
import { getSentenceChanges, getChangeStats, computeWordDiff } from '../../utils/textDiff'

const GrammarEnhancerPage = () => {
  const [inputText, setInputText] = useState('')
  const [enhancedText, setEnhancedText] = useState('')
  const [suggestions, setSuggestions] = useState([])
  const [stats, setStats] = useState(null)
  const [sentenceChanges, setSentenceChanges] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [activeTab, setActiveTab] = useState('editor')
  const [hasEnhanced, setHasEnhanced] = useState(false)
  const textareaRef = useRef(null)

  /**
   * Line-preserving inline diff: splits inputText on \n so paragraph/line
   * structure from the uploaded file is kept, then highlights changed words.
   */
  const docDiff = useMemo(() => {
    if (!inputText || sentenceChanges.length === 0) return null
    const changed = sentenceChanges.filter(c => c.changed && c.original?.trim())
    if (changed.length === 0) return null

    const sentDiffs = {}
    changed.forEach(c => {
      sentDiffs[c.original.trim()] = computeWordDiff(
        c.original.trim(),
        (c.enhanced || c.original).trim()
      )
    })

    const lines = inputText.split('\n')
    return lines.flatMap((line, li) => {
      let segments = [{ type: 'text', text: line }]
      for (const [origSent, diffs] of Object.entries(sentDiffs)) {
        const next = []
        for (const seg of segments) {
          if (seg.type !== 'text') { next.push(seg); continue }
          const pos = seg.text.indexOf(origSent)
          if (pos === -1) { next.push(seg); continue }
          if (pos > 0) next.push({ type: 'text', text: seg.text.slice(0, pos) })
          next.push({ type: 'diff', diffs })
          const after = seg.text.slice(pos + origSent.length)
          if (after) next.push({ type: 'text', text: after })
        }
        segments = next
      }
      const els = segments.flatMap((seg, si) => {
        if (seg.type === 'text') return [<span key={`L${li}-s${si}`}>{seg.text}</span>]
        return seg.diffs.map((tok, ti) => {
          if (tok.type === 'remove')
            return <span key={`L${li}-s${si}-t${ti}`} className="bg-red-100 text-red-700 line-through rounded px-px">{tok.text}</span>
          if (tok.type === 'add')
            return <span key={`L${li}-s${si}-t${ti}`} className="bg-green-100 text-green-800 font-semibold rounded px-px">{tok.text}</span>
          return <span key={`L${li}-s${si}-t${ti}`}>{tok.text}</span>
        })
      })
      if (li < lines.length - 1) els.push(<br key={`br${li}`} />)
      return els
    })
  }, [inputText, sentenceChanges])

  const handleEnhance = async () => {
    if (!inputText.trim()) {
      setError('Please enter some text to enhance')
      return
    }

    setLoading(true)
    setError(null)
    try {
      const response = await grammarAPI.enhance({ text: inputText })
      const { enhanced, changes } = response.data.data

      setEnhancedText(enhanced)
      setHasEnhanced(true)

      // Get suggestions
      const suggestionsResponse = await grammarAPI.getSuggestions({ text: inputText })
      setSuggestions(suggestionsResponse.data.data.suggestions || [])

      // Calculate stats
      const localChanges = getSentenceChanges(inputText, enhanced)
      const changeStats = getChangeStats(localChanges)
      setStats(changeStats)
      setSentenceChanges(localChanges)

      setActiveTab('results')
    } catch (err) {
      const errorMsg = err.response?.data?.message || err.message || 'Failed to enhance text'
      setError(errorMsg)
    } finally {
      setLoading(false)
    }
  }

  const handleCopyEnhanced = () => {
    navigator.clipboard.writeText(enhancedText)
    alert('Enhanced text copied to clipboard!')
  }

  const handleApplyEnhanced = () => {
    setInputText(enhancedText)
    setEnhancedText('')
    setHasEnhanced(false)
    setActiveTab('editor')
  }

  const handleReset = () => {
    setInputText('')
    setEnhancedText('')
    setSuggestions([])
    setStats(null)
    setSentenceChanges([])
    setError(null)
    setHasEnhanced(false)
    setActiveTab('editor')
  }

  const handleLoadFile = async (e) => {
    const file = e.target.files[0]
    if (!file) return

    setLoading(true)
    setError(null)

    try {
      // Use centralized file extractor for PDF, DOCX, TXT, LaTeX
      const response = await fileExtractorAPI.extractText(file)
      
      if (response.data.success) {
        setInputText(response.data.text)
        // Show file info
        console.log(`Loaded ${response.data.file_type.toUpperCase()}: ${response.data.word_count} words`)
      } else {
        setError(response.data.error || 'Failed to extract text from file')
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load file: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleDownloadEnhanced = () => {
    const element = document.createElement('a')
    const file = new Blob([enhancedText], { type: 'text/plain' })
    element.href = URL.createObjectURL(file)
    element.download = 'enhanced-document.txt'
    document.body.appendChild(element)
    element.click()
    document.body.removeChild(element)
  }

  const characterCount = inputText.length
  const wordCount = inputText.trim() ? inputText.trim().split(/\s+/).length : 0

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-3 bg-indigo-100 rounded-lg">
            <FaMagic className="text-2xl text-indigo-600" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Grammar Enhancer</h1>
            <p className="text-gray-600 mt-1">AI-powered text enhancement and analysis</p>
          </div>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-red-800">
            <strong>Error:</strong> {error}
          </p>
        </div>
      )}

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Input/Results */}
        <div className="lg:col-span-2 space-y-4">
          {/* Tabs */}
          <div className="flex gap-2 border-b border-gray-200">
            <button
              onClick={() => setActiveTab('editor')}
              className={`px-4 py-2 font-medium border-b-2 transition-colors ${
                activeTab === 'editor'
                  ? 'border-indigo-600 text-indigo-600'
                  : 'border-transparent text-gray-600 hover:text-gray-900'
              }`}
            >
              <FaFileAlt className="inline mr-2" />
              Original Text
            </button>
            {hasEnhanced && (
              <button
                onClick={() => setActiveTab('results')}
                className={`px-4 py-2 font-medium border-b-2 transition-colors ${
                  activeTab === 'results'
                    ? 'border-indigo-600 text-indigo-600'
                    : 'border-transparent text-gray-600 hover:text-gray-900'
                }`}
              >
                <FaMagic className="inline mr-2" />
                Enhanced Text
              </button>
            )}
          </div>

          {/* Editor Tab */}
          {activeTab === 'editor' && (
            <div className="space-y-4">
              {/* Textarea */}
              <div className="bg-white rounded-lg border border-gray-200 overflow-hidden shadow-sm">
                <textarea
                  ref={textareaRef}
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  placeholder="Paste your text here or upload a file... Your document will be enhanced using AI."
                  className="w-full h-96 p-4 resize-none focus:outline-none font-mono text-sm"
                />
              </div>

              {/* Character Count */}
              <div className="flex items-center gap-4 text-sm text-gray-600">
                <span>Characters: {characterCount.toLocaleString()}</span>
                <span>Words: {wordCount.toLocaleString()}</span>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-wrap gap-3">
                <button
                  onClick={handleEnhance}
                  disabled={loading || !inputText.trim()}
                  className="flex-1 btn-primary flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <>
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                      Enhancing...
                    </>
                  ) : (
                    <>
                      <FaMagic />
                      Enhance Text
                    </>
                  )}
                </button>

                <label className="flex-1 btn-secondary flex items-center justify-center gap-2 cursor-pointer">
                  <FaUpload />
                  Load File
                  <input
                    type="file"
                    accept=".txt,.doc,.docx,.pdf,.tex,.latex"
                    onChange={handleLoadFile}
                    className="hidden"
                    disabled={loading}
                  />
                </label>

                <button
                  onClick={handleReset}
                  disabled={!inputText && !enhancedText}
                  className="flex-1 btn-secondary flex items-center justify-center gap-2"
                >
                  <FaUndo />
                  Reset
                </button>
              </div>
            </div>
          )}

          {/* Results Tab */}
          {activeTab === 'results' && hasEnhanced && (
            <div className="space-y-4">
              {/* Side-by-Side Comparison */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

                {/* Left: Original */}
                <div className="bg-white rounded-lg border border-gray-200 overflow-hidden shadow-sm">
                  <div className="bg-gray-50 border-b border-gray-200 px-4 py-3 flex items-center gap-2">
                    <span className="inline-block w-3 h-3 rounded-full bg-gray-400"></span>
                    <h3 className="font-semibold text-gray-900 text-sm">Original</h3>
                  </div>
                  <div className="w-full h-96 p-4 overflow-y-auto font-mono text-sm whitespace-pre-wrap leading-relaxed text-gray-700">
                    {inputText}
                  </div>
                </div>

                {/* Right: Enhanced with diff */}
                <div className="bg-white rounded-lg border border-gray-200 overflow-hidden shadow-sm">
                  <div className="bg-indigo-50 border-b border-indigo-200 px-4 py-3 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="inline-block w-3 h-3 rounded-full bg-indigo-400"></span>
                      <h3 className="font-semibold text-gray-900 text-sm">Enhanced</h3>
                    </div>
                    {docDiff && (
                      <span className="text-xs text-gray-500 flex items-center gap-1.5">
                        <span className="bg-red-100 text-red-700 line-through px-1 rounded">removed</span>
                        <span className="text-gray-400">/</span>
                        <span className="bg-green-100 text-green-800 font-semibold px-1 rounded">added</span>
                      </span>
                    )}
                  </div>
                  <div className="w-full h-96 p-4 overflow-y-auto font-mono text-sm bg-indigo-50 whitespace-pre-wrap leading-relaxed">
                    {docDiff || enhancedText}
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-wrap gap-3">
                <button
                  onClick={handleCopyEnhanced}
                  className="flex-1 btn-secondary flex items-center justify-center gap-2"
                >
                  <FaCopy />
                  Copy to Clipboard
                </button>

                <button
                  onClick={handleDownloadEnhanced}
                  className="flex-1 btn-secondary flex items-center justify-center gap-2"
                >
                  <FaDownload />
                  Download
                </button>

                <button
                  onClick={handleApplyEnhanced}
                  className="flex-1 btn-primary flex items-center justify-center gap-2"
                >
                  <FaCheck />
                  Use This Version
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Right: Info Panel */}
        <div className="space-y-4">
          {/* Statistics Card */}
          {stats && (
            <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
              <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <FaSpellCheck className="text-indigo-600" />
                Statistics
              </h3>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">Total Sentences</span>
                  <span className="text-2xl font-bold text-gray-900">{stats.total}</span>
                </div>
                <div className="flex items-center justify-between pb-3 border-b border-gray-200">
                  <span className="text-gray-600">Changed</span>
                  <span className="text-2xl font-bold text-green-600">{stats.changed}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">Change Rate</span>
                  <span className="text-2xl font-bold text-indigo-600">{stats.changePercentage}%</span>
                </div>
              </div>
            </div>
          )}

          {/* Suggestions Card */}
          {suggestions.length > 0 && (
            <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
              <h3 className="font-semibold text-gray-900 mb-4">Suggestions</h3>
              <div className="space-y-3 max-h-64 overflow-y-auto">
                {suggestions.map((suggestion, idx) => (
                  <div key={idx} className="p-3 bg-blue-50 border border-blue-200 rounded">
                    <p className="font-medium text-gray-900 text-sm">{suggestion.type}</p>
                    <p className="text-gray-600 text-xs mt-1">{suggestion.description}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Help Card */}
          <div className="bg-blue-50 rounded-lg border border-blue-200 p-6">
            <h3 className="font-semibold text-blue-900 mb-3">💡 Tips</h3>
            <ul className="space-y-2 text-sm text-blue-800">
              <li>✓ Paste text or upload a file</li>
              <li>✓ Click "Enhance Text"</li>
              <li>✓ Review the improvements</li>
              <li>✓ Copy or download results</li>
              <li>✓ Use the enhanced version</li>
            </ul>
          </div>

          {/* Info Card */}
          <div className="bg-indigo-50 rounded-lg border border-indigo-200 p-6">
            <h3 className="font-semibold text-indigo-900 mb-3">ℹ️ About</h3>
            <p className="text-sm text-indigo-800 mb-3">
              This tool uses AI to enhance your text by improving grammar, clarity, and style.
            </p>
            <ul className="space-y-1 text-xs text-indigo-700">
              <li>• Grammar correction</li>
              <li>• Clarity improvement</li>
              <li>• Professional tone</li>
              <li>• Sentence optimization</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}

export default GrammarEnhancerPage
