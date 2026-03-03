import { useState, useEffect } from 'react'
import { 
  FaSpellCheck, 
  FaTimes, 
  FaMagic, 
  FaCheck, 
  FaUndo, 
  FaLightbulb,
  FaChartBar 
} from 'react-icons/fa'
import { grammarAPI } from '../../services/api'
import { getSentenceChanges, getChangeStats, createSideBySideComparison, visualizeSentenceDiff } from '../../utils/textDiff'

const GrammarEnhancer = ({ text, documentId, onClose, onApplyChanges }) => {
  const [enhancedText, setEnhancedText] = useState('')
  const [originalText, setOriginalText] = useState(text)
  const [suggestions, setSuggestions] = useState([])
  const [changes, setChanges] = useState([])
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(false)
  const [appliedSuggestions, setAppliedSuggestions] = useState(new Set())
  const [activeTab, setActiveTab] = useState('enhanced') // 'enhanced' or 'suggestions'
  const [error, setError] = useState(null)

  useEffect(() => {
    if (text) {
      enhanceDocument()
    }
  }, [])

  const enhanceDocument = async () => {
    setLoading(true)
    setError(null)
    try {
      // Get enhancement
      const enhanceResponse = await grammarAPI.enhance({ text })
      const { enhanced, changes: textChanges } = enhanceResponse.data.data

      setEnhancedText(enhanced)

      // Get suggestions for additional improvements
      const suggestionsResponse = await grammarAPI.getSuggestions({ text })
      const suggestionsList = suggestionsResponse.data.data.suggestions || []

      setSuggestions(suggestionsList)

      // Calculate changes
      const sentenceChanges = getSentenceChanges(text, enhanced)
      setChanges(sentenceChanges)

      // Get statistics
      const changeStats = getChangeStats(sentenceChanges)
      setStats(changeStats)
    } catch (err) {
      const errorMsg = err.response?.data?.message || err.message || 'Failed to enhance document'
      setError(errorMsg)
      // Still show basic enhancement if API fails
      setEnhancedText(text)
    } finally {
      setLoading(false)
    }
  }

  const handleApplyEnhancement = async () => {
    try {
      if (onApplyChanges) {
        onApplyChanges(enhancedText)
      }
      alert('Enhancement applied successfully!')
      onClose()
    } catch (err) {
      alert('Failed to apply enhancement')
    }
  }

  const handleReset = () => {
    setEnhancedText(originalText)
    setChanges([])
    setSuggestions([])
    setStats(null)
  }

  const toggleSuggestion = (index) => {
    const newApplied = new Set(appliedSuggestions)
    if (newApplied.has(index)) {
      newApplied.delete(index)
    } else {
      newApplied.add(index)
    }
    setAppliedSuggestions(newApplied)
  }

  const getChangedSentences = () => changes.filter((c) => c.changed)

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-6xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-indigo-50">
          <div className="flex items-center gap-3">
            <FaMagic className="text-2xl text-indigo-600" />
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Grammar Enhancer</h2>
              <p className="text-sm text-gray-600 mt-1">AI-powered document enhancement</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-200 rounded-lg transition-colors"
          >
            <FaTimes className="text-gray-600 text-xl" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 px-6 pt-4 border-b border-gray-200">
          <button
            onClick={() => setActiveTab('enhanced')}
            className={`px-4 py-2 font-medium rounded-t-lg transition-colors ${
              activeTab === 'enhanced'
                ? 'bg-indigo-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            <FaMagic className="inline mr-2" />
            Enhanced Version
          </button>
          <button
            onClick={() => setActiveTab('suggestions')}
            className={`px-4 py-2 font-medium rounded-t-lg transition-colors ${
              activeTab === 'suggestions'
                ? 'bg-indigo-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            <FaLightbulb className="inline mr-2" />
            Suggestions ({suggestions.length})
          </button>
          <button
            onClick={() => setActiveTab('stats')}
            className={`px-4 py-2 font-medium rounded-t-lg transition-colors ${
              activeTab === 'stats'
                ? 'bg-indigo-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            <FaChartBar className="inline mr-2" />
            Statistics
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {error && (
            <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-red-800">
                <strong>Error:</strong> {error}
              </p>
            </div>
          )}

          {loading ? (
            <div className="text-center py-12">
              <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
              <p className="mt-4 text-gray-600">Enhancing your document...</p>
            </div>
          ) : activeTab === 'enhanced' ? (
            <div className="space-y-6">
              {/* Original and Enhanced Side by Side */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Original */}
                <div>
                  <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                    <span className="inline-block w-3 h-3 rounded-full bg-gray-400"></span>
                    Original Text
                  </h3>
                  <div className="bg-gray-50 p-4 rounded-lg border border-gray-200 max-h-64 overflow-y-auto">
                    <p className="text-gray-700 whitespace-pre-wrap text-sm leading-relaxed">
                      {originalText}
                    </p>
                  </div>
                </div>

                {/* Enhanced */}
                <div>
                  <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                    <span className="inline-block w-3 h-3 rounded-full bg-indigo-400"></span>
                    Enhanced Text
                  </h3>
                  <div className="bg-indigo-50 p-4 rounded-lg border border-indigo-200 max-h-64 overflow-y-auto">
                    <p className="text-gray-700 whitespace-pre-wrap text-sm leading-relaxed">
                      {enhancedText}
                    </p>
                  </div>
                </div>
              </div>

              {/* Changes Breakdown */}
              {getChangedSentences().length > 0 && (
                <div className="mt-6 pt-6 border-t border-gray-200">
                  <h3 className="font-semibold text-gray-900 mb-4">
                    Changes Made ({getChangedSentences().length})
                  </h3>
                  <div className="space-y-3 max-h-64 overflow-y-auto">
                    {getChangedSentences().map((change) => {
                      const diff = visualizeSentenceDiff(change.original, change.enhanced)
                      return (
                        <div key={change.index} className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
                          <div className="text-xs font-medium text-amber-800 mb-2">Sentence {change.index + 1}</div>
                          <div className="text-sm space-y-2">
                            <div>
                              <span className="text-gray-600">Original: </span>
                              <span className="text-gray-800">{change.original}</span>
                            </div>
                            <div>
                              <span className="text-gray-600">Enhanced: </span>
                              <span className="text-indigo-800 font-medium">{change.enhanced}</span>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          ) : activeTab === 'suggestions' ? (
            <div className="space-y-4 max-h-96 overflow-y-auto">
              {suggestions.length > 0 ? (
                suggestions.map((suggestion, idx) => (
                  <div
                    key={idx}
                    className="p-4 border border-blue-200 bg-blue-50 rounded-lg cursor-pointer hover:bg-blue-100 transition-colors"
                    onClick={() => toggleSuggestion(idx)}
                  >
                    <div className="flex items-start gap-3">
                      <input
                        type="checkbox"
                        checked={appliedSuggestions.has(idx)}
                        onChange={() => toggleSuggestion(idx)}
                        className="mt-1 w-5 h-5"
                      />
                      <div className="flex-1">
                        <p className="font-medium text-gray-900">{suggestion.type}</p>
                        <p className="text-gray-700 mt-1">{suggestion.description}</p>
                        {suggestion.example && (
                          <div className="mt-2 text-sm bg-white p-2 rounded border border-blue-100">
                            <span className="text-gray-600">Example: </span>
                            <span className="text-gray-800">{suggestion.example}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-8">
                  <FaLightbulb className="text-4xl text-gray-300 mx-auto mb-3" />
                  <p className="text-gray-600">No additional suggestions at this time</p>
                </div>
              )}
            </div>
          ) : activeTab === 'stats' ? (
            <div className="space-y-6">
              {stats && (
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="bg-blue-50 p-6 rounded-lg border border-blue-200">
                    <p className="text-sm text-blue-600 font-medium">Total Sentences</p>
                    <p className="text-3xl font-bold text-blue-900 mt-2">{stats.total}</p>
                  </div>
                  <div className="bg-green-50 p-6 rounded-lg border border-green-200">
                    <p className="text-sm text-green-600 font-medium">Sentences Changed</p>
                    <p className="text-3xl font-bold text-green-900 mt-2">{stats.changed}</p>
                  </div>
                  <div className="bg-gray-50 p-6 rounded-lg border border-gray-200">
                    <p className="text-sm text-gray-600 font-medium">Unchanged</p>
                    <p className="text-3xl font-bold text-gray-900 mt-2">{stats.unchanged}</p>
                  </div>
                  <div className="bg-indigo-50 p-6 rounded-lg border border-indigo-200">
                    <p className="text-sm text-indigo-600 font-medium">Change Rate</p>
                    <p className="text-3xl font-bold text-indigo-900 mt-2">{stats.changePercentage}%</p>
                  </div>
                </div>
              )}

              {/* Reading Level Improvements */}
              <div className="bg-purple-50 border border-purple-200 p-6 rounded-lg">
                <h3 className="font-semibold text-gray-900 mb-4">Improvements</h3>
                <ul className="space-y-2">
                  <li className="flex items-center gap-2 text-gray-700">
                    <FaCheck className="text-green-600" />
                    <span>Enhanced readability and clarity</span>
                  </li>
                  <li className="flex items-center gap-2 text-gray-700">
                    <FaCheck className="text-green-600" />
                    <span>Corrected grammar and spelling</span>
                  </li>
                  <li className="flex items-center gap-2 text-gray-700">
                    <FaCheck className="text-green-600" />
                    <span>Improved word choice and flow</span>
                  </li>
                  <li className="flex items-center gap-2 text-gray-700">
                    <FaCheck className="text-green-600" />
                    <span>Professional tone enhancement</span>
                  </li>
                </ul>
              </div>
            </div>
          ) : null}
        </div>

        {/* Footer */}
        <div className="border-t border-gray-200 p-4 bg-gray-50 flex gap-3">
          <button
            onClick={handleReset}
            className="btn-secondary flex items-center gap-2"
            title="Reset to original text"
          >
            <FaUndo />
            Reset
          </button>
          <div className="flex-1"></div>
          <button onClick={onClose} className="btn-secondary">
            Close
          </button>
          <button
            onClick={handleApplyEnhancement}
            disabled={loading}
            className="btn-primary flex items-center gap-2"
          >
            {loading ? (
              <>
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                Processing...
              </>
            ) : (
              <>
                <FaCheck />
                Apply Enhancement
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}

export default GrammarEnhancer
