import { useState, useEffect } from 'react'
import {
  FaSearch,
  FaTimes,
  FaExclamationTriangle,
  FaCheckCircle,
  FaTimesCircle,
  FaInfoCircle,
  FaDownload,
  FaFileAlt,
  FaLink,
  FaPercent,
  FaChartBar,
  FaSpinner,
  FaExclamationCircle,
  FaArrowRight,
  FaUpload,
} from 'react-icons/fa'
import { fileExtractorAPI } from '../../services/pythonNlpService'

const PlagiarismDetector = ({ document, onClose }) => {
  // State Management
  const [sourceTexts, setSourceTexts] = useState([''])
  const [threshold, setThreshold] = useState(0.75)
  const [checking, setChecking] = useState(false)
  const [results, setResults] = useState(null)
  const [error, setError] = useState('')
  const [activeTab, setActiveTab] = useState('results') // 'results', 'sources', 'analysis'
  const [expandedMatch, setExpandedMatch] = useState(null)
  const [selectedMatches, setSelectedMatches] = useState(new Set())

  // Handle source text input
  const handleSourceChange = (index, value) => {
    const newSources = [...sourceTexts]
    newSources[index] = value
    setSourceTexts(newSources)
  }

  // Handle source file upload (PDF, DOCX, TXT, LaTeX)
  const handleSourceFileUpload = async (e, index) => {
    const file = e.target.files[0]
    if (!file) return

    setChecking(true)
    setError('')

    try {
      const response = await fileExtractorAPI.extractText(file)
      
      if (response.data.success) {
        const newSources = [...sourceTexts]
        newSources[index] = response.data.text
        setSourceTexts(newSources)
        console.log(`Loaded ${response.data.file_type.toUpperCase()}: ${response.data.word_count} words`)
      } else {
        setError(response.data.error || 'Failed to extract text from file')
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load file: ' + err.message)
    } finally {
      setChecking(false)
    }
  }

  // Add source text field
  const addSourceField = () => {
    setSourceTexts([...sourceTexts, ''])
  }

  // Remove source text field
  const removeSourceField = (index) => {
    if (sourceTexts.length > 1) {
      setSourceTexts(sourceTexts.filter((_, i) => i !== index))
    }
  }

  // Check plagiarism
  const handleCheckPlagiarism = async () => {
    setChecking(true)
    setError('')
    setResults(null)

    try {
      // Filter empty sources and format them correctly
      const validSources = sourceTexts
        .filter((s) => s.trim().length > 0)
        .map((text, index) => ({
          text: text.trim(),
          source: `Source ${index + 1}`
        }))

      if (validSources.length === 0) {
        setError('Please provide at least one source text to check against')
        setChecking(false)
        return
      }

      if (!document?.content) {
        setError('No document content found')
        setChecking(false)
        return
      }

      const response = await fetch(
        `${import.meta.env.VITE_NLP_API_URL || 'http://localhost:5001'}/api/plagiarism/check`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            text: document.content,
            sources: validSources,
            threshold: threshold,
          }),
        }
      )

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to check plagiarism')
      }

      const data = await response.json()
      setResults(data.data)
      setActiveTab('results')
    } catch (err) {
      setError(err.message || 'Failed to check plagiarism')
      console.error('Plagiarism check error:', err)
    } finally {
      setChecking(false)
    }
  }

  // Get severity color
  const getSeverityColor = (score) => {
    if (score >= 0.9) return 'text-red-600'
    if (score >= 0.75) return 'text-orange-600'
    if (score >= 0.5) return 'text-yellow-600'
    return 'text-green-600'
  }

  // Get severity badge
  const getSeverityBadge = (score) => {
    if (score >= 0.9) return 'Critical'
    if (score >= 0.75) return 'High'
    if (score >= 0.5) return 'Medium'
    return 'Low'
  }

  // Get badge color
  const getBadgeColor = (score) => {
    if (score >= 0.9) return 'bg-red-100 text-red-800'
    if (score >= 0.75) return 'bg-orange-100 text-orange-800'
    if (score >= 0.5) return 'bg-yellow-100 text-yellow-800'
    return 'bg-green-100 text-green-800'
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl max-w-6xl w-full max-h-[95vh] overflow-hidden flex flex-col shadow-2xl">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-blue-800 text-white p-6 border-b border-blue-700">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="bg-white bg-opacity-20 p-3 rounded-lg">
                <FaSearch className="text-3xl" />
              </div>
              <div>
                <h2 className="text-2xl font-bold">Plagiarism Detection</h2>
                <p className="text-blue-100 text-sm mt-1">
                  {document?.title || 'Document'} - Semantic Similarity Analysis
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-blue-500 rounded-lg transition-colors"
            >
              <FaTimes className="text-xl" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {!results ? (
            <div className="p-8">
              {/* Document Info */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-8">
                <div className="flex items-start gap-3">
                  <FaFileAlt className="text-blue-600 mt-1 flex-shrink-0" />
                  <div className="flex-1">
                    <h3 className="font-semibold text-gray-900">Document to Check</h3>
                    <p className="text-sm text-gray-600 mt-1">
                      {document?.title || 'Untitled Document'}
                    </p>
                    <p className="text-xs text-gray-500 mt-2">
                      {document?.content?.length || 0} characters
                    </p>
                  </div>
                </div>
              </div>

              {/* Error Message */}
              {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6 flex gap-3">
                  <FaExclamationCircle className="text-red-600 flex-shrink-0 mt-1" />
                  <div>
                    <h4 className="font-semibold text-red-900">Error</h4>
                    <p className="text-sm text-red-700 mt-1">{error}</p>
                  </div>
                </div>
              )}

              {/* Threshold Setting */}
              <div className="bg-gray-50 rounded-lg p-6 mb-6">
                <div className="flex items-center justify-between mb-4">
                  <label className="block text-sm font-semibold text-gray-900">
                    <FaPercent className="inline mr-2 text-blue-600" />
                    Similarity Threshold
                  </label>
                  <span className="text-2xl font-bold text-blue-600">{(threshold * 100).toFixed(0)}%</span>
                </div>

                <div className="flex gap-4 items-center">
                  <input
                    type="range"
                    min="0.1"
                    max="1.0"
                    step="0.05"
                    value={threshold}
                    onChange={(e) => setThreshold(parseFloat(e.target.value))}
                    disabled={checking}
                    className="flex-1 h-2 bg-gray-300 rounded-lg appearance-none cursor-pointer"
                  />
                  <div className="text-xs text-gray-600 text-right w-16">
                    <div>Min: 10%</div>
                    <div>Max: 100%</div>
                  </div>
                </div>

                <div className="mt-3 flex gap-4 text-xs text-gray-600">
                  <div>
                    <span className="font-semibold text-green-700">✓ Low: </span>0-50%
                  </div>
                  <div>
                    <span className="font-semibold text-yellow-700">⚠ Medium: </span>50-75%
                  </div>
                  <div>
                    <span className="font-semibold text-red-700">✕ High: </span>75%+
                  </div>
                </div>
              </div>

              {/* Source Texts */}
              <div className="space-y-4 mb-6">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                    <FaLink className="text-blue-600" />
                    Source Documents to Check Against
                  </h3>
                  <span className="text-sm text-gray-600">
                    {sourceTexts.filter((s) => s.trim().length > 0).length} source(s) added
                  </span>
                </div>

                {sourceTexts.map((source, index) => (
                  <div key={index} className="space-y-2">
                    <div className="flex items-center gap-2">
                      <label className="text-sm font-medium text-gray-700">
                        Source {index + 1}
                      </label>
                      <label className="cursor-pointer text-blue-600 hover:text-blue-800 text-sm font-medium flex items-center gap-1">
                        <FaUpload className="text-xs" />
                        Upload File
                        <input
                          type="file"
                          accept=".pdf,.docx,.txt,.tex,.latex"
                          onChange={(e) => handleSourceFileUpload(e, index)}
                          className="hidden"
                          disabled={checking}
                        />
                      </label>
                      {sourceTexts.length > 1 && (
                        <button
                          onClick={() => removeSourceField(index)}
                          className="text-red-600 hover:text-red-800 text-sm font-medium ml-auto"
                          disabled={checking}
                        >
                          Remove
                        </button>
                      )}
                    </div>
                    <textarea
                      value={source}
                      onChange={(e) => handleSourceChange(index, e.target.value)}
                      placeholder={`Paste source text here or upload file (PDF, DOCX, TXT, LaTeX)...`}
                      disabled={checking}
                      rows="5"
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100"
                    />
                    <p className="text-xs text-gray-600">
                      {source.length} characters • {source.trim() ? source.trim().split(/\s+/).length : 0} words
                    </p>
                  </div>
                ))}

                <button
                  onClick={addSourceField}
                  disabled={checking}
                  className="w-full px-4 py-2 border border-dashed border-blue-300 text-blue-600 rounded-lg hover:bg-blue-50 transition-colors font-medium disabled:opacity-50"
                >
                  + Add Another Source
                </button>
              </div>

              {/* Info Box */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex gap-3 mb-6">
                <FaInfoCircle className="text-blue-600 flex-shrink-0 mt-1" />
                <div className="text-sm text-blue-800">
                  <p className="font-semibold mb-2">How it works:</p>
                  <ul className="space-y-1 text-xs">
                    <li>✓ Uses semantic similarity (not just word matching)</li>
                    <li>✓ Detects paraphrasing and reworded content</li>
                    <li>✓ Analyzes sentence-level similarities</li>
                    <li>✓ Provides detailed match information</li>
                  </ul>
                </div>
              </div>
            </div>
          ) : (
            // Results Tab
            <div className="p-8">
              {/* Results Summary */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
                <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg p-6 border border-blue-200">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-600 mb-2">Plagiarism Score</p>
                      <p className={`text-3xl font-bold ${getSeverityColor(results.plagiarismScore)}`}>
                        {(results.plagiarismScore * 100).toFixed(1)}%
                      </p>
                    </div>
                    <FaChartBar className={`text-3xl ${getSeverityColor(results.plagiarismScore)}`} />
                  </div>
                </div>

                <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg p-6 border border-purple-200">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-600 mb-2">Severity Level</p>
                      <p className="text-2xl font-bold text-purple-700">
                        {results.plagiarismLevel}
                      </p>
                    </div>
                    <FaExclamationCircle className="text-3xl text-purple-600" />
                  </div>
                </div>

                <div className="bg-gradient-to-br from-orange-50 to-orange-100 rounded-lg p-6 border border-orange-200">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-600 mb-2">Matches Found</p>
                      <p className="text-3xl font-bold text-orange-700">
                        {results.matches?.length || 0}
                      </p>
                    </div>
                    <FaSearch className="text-3xl text-orange-600" />
                  </div>
                </div>

                <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-lg p-6 border border-green-200">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-600 mb-2">Unique Content</p>
                      <p className="text-3xl font-bold text-green-700">
                        {(100 - results.plagiarismScore * 100).toFixed(1)}%
                      </p>
                    </div>
                    <FaCheckCircle className="text-3xl text-green-600" />
                  </div>
                </div>
              </div>

              {/* Tabs */}
              <div className="flex gap-2 mb-6 border-b border-gray-200">
                {[
                  { id: 'results', label: 'Detailed Results', icon: FaChartBar },
                  { id: 'analysis', label: 'Analysis & Stats', icon: FaSearch },
                  { id: 'recommendations', label: 'Recommendations', icon: FaArrowRight },
                ].map(({ id, label, icon: Icon }) => (
                  <button
                    key={id}
                    onClick={() => setActiveTab(id)}
                    className={`px-4 py-3 font-medium border-b-2 transition-colors flex items-center gap-2 ${
                      activeTab === id
                        ? 'border-blue-600 text-blue-600'
                        : 'border-transparent text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    <Icon className="text-lg" />
                    {label}
                  </button>
                ))}
              </div>

              {/* Detailed Results Tab */}
              {activeTab === 'results' && (
                <div className="space-y-4 max-h-96 overflow-y-auto">
                  {results.matches && results.matches.length > 0 ? (
                    results.matches.map((match, index) => (
                      <div
                        key={index}
                        className={`border rounded-lg overflow-hidden transition-all ${
                          expandedMatch === index ? 'border-blue-400 bg-blue-50' : 'border-gray-200'
                        }`}
                      >
                        {/* Match Header */}
                        <button
                          onClick={() =>
                            setExpandedMatch(expandedMatch === index ? null : index)
                          }
                          className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
                        >
                          <div className="flex-1 text-left">
                            <div className="flex items-center gap-3">
                              <span
                                className={`inline-block px-3 py-1 rounded-full text-sm font-semibold ${getBadgeColor(
                                  match.similarity
                                )}`}
                              >
                                {(match.similarity * 100).toFixed(1)}%
                              </span>
                              <p className="font-medium text-gray-900">
                                {match.source || `Source ${index + 1}`}
                              </p>
                            </div>
                            <p className="text-sm text-gray-600 mt-2 line-clamp-2">
                              {match.matchedText}
                            </p>
                          </div>
                          <FaArrowRight
                            className={`text-gray-600 transition-transform ${
                              expandedMatch === index ? 'rotate-90' : ''
                            }`}
                          />
                        </button>

                        {/* Expanded Details */}
                        {expandedMatch === index && (
                          <div className="border-t border-gray-200 px-6 py-4 bg-blue-50 space-y-4">
                            <div>
                              <p className="text-xs font-semibold text-gray-700 uppercase mb-2">
                                Matched Content
                              </p>
                              <div className="bg-white p-3 rounded border border-blue-200 text-sm text-gray-700">
                                {match.matchedText}
                              </div>
                            </div>

                            <div>
                              <p className="text-xs font-semibold text-gray-700 uppercase mb-2">
                                Your Content
                              </p>
                              <div className="bg-white p-3 rounded border border-blue-200 text-sm text-gray-700">
                                {match.originalText}
                              </div>
                            </div>

                            <div className="grid grid-cols-3 gap-3">
                              <div className="bg-white p-3 rounded border border-gray-200">
                                <p className="text-xs text-gray-600 mb-1">Similarity</p>
                                <p className="text-lg font-bold text-blue-600">
                                  {(match.similarity * 100).toFixed(1)}%
                                </p>
                              </div>
                              <div className="bg-white p-3 rounded border border-gray-200">
                                <p className="text-xs text-gray-600 mb-1">Position</p>
                                <p className="text-sm font-medium text-gray-900">
                                  Sentence {match.position || '—'}
                                </p>
                              </div>
                              <div className="bg-white p-3 rounded border border-gray-200">
                                <p className="text-xs text-gray-600 mb-1">Type</p>
                                <p className="text-sm font-medium text-gray-900">
                                  {match.matchType || 'Similar'}
                                </p>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-8">
                      <FaCheckCircle className="text-4xl text-green-500 mx-auto mb-3" />
                      <p className="text-lg font-semibold text-gray-900">No Plagiarism Detected</p>
                      <p className="text-sm text-gray-600 mt-2">
                        Your document appears to be original based on the checked sources
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Analysis Tab */}
              {activeTab === 'analysis' && (
                <div className="space-y-6 max-h-96 overflow-y-auto">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-gray-50 rounded-lg p-4">
                      <p className="text-xs text-gray-600 mb-2">Average Similarity</p>
                      <p className="text-2xl font-bold text-gray-900">
                        {results.stats?.avgSimilarity
                          ? (results.stats.avgSimilarity * 100).toFixed(1)
                          : '0.0'}
                        %
                      </p>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-4">
                      <p className="text-xs text-gray-600 mb-2">Max Similarity</p>
                      <p className="text-2xl font-bold text-gray-900">
                        {results.stats?.maxSimilarity
                          ? (results.stats.maxSimilarity * 100).toFixed(1)
                          : '0.0'}
                        %
                      </p>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-4">
                      <p className="text-xs text-gray-600 mb-2">Min Similarity</p>
                      <p className="text-2xl font-bold text-gray-900">
                        {results.stats?.minSimilarity
                          ? (results.stats.minSimilarity * 100).toFixed(1)
                          : '0.0'}
                        %
                      </p>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-4">
                      <p className="text-xs text-gray-600 mb-2">Total Sources Checked</p>
                      <p className="text-2xl font-bold text-gray-900">
                        {results.stats?.sourcesChecked || 0}
                      </p>
                    </div>
                  </div>

                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <h4 className="font-semibold text-gray-900 mb-3">Detection Method</h4>
                    <ul className="space-y-2 text-sm text-gray-700">
                      <li>
                        <span className="font-medium">✓ Semantic Analysis:</span> Detects meaning-based similarities
                      </li>
                      <li>
                        <span className="font-medium">✓ Paraphrase Detection:</span> Finds reworded content
                      </li>
                      <li>
                        <span className="font-medium">✓ Sentence-Level Matching:</span> Detailed granularity
                      </li>
                      <li>
                        <span className="font-medium">✓ Source Attribution:</span> Identifies matching sources
                      </li>
                    </ul>
                  </div>
                </div>
              )}

              {/* Recommendations Tab */}
              {activeTab === 'recommendations' && (
                <div className="space-y-4 max-h-96 overflow-y-auto">
                  {results.plagiarismScore > 0.75 && (
                    <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                      <h4 className="font-semibold text-red-900 mb-2 flex items-center gap-2">
                        <FaExclamationTriangle />
                        High Plagiarism Risk
                      </h4>
                      <p className="text-sm text-red-800 mb-3">
                        Your document has significant similarity to source materials.
                      </p>
                      <ul className="text-sm text-red-700 space-y-1">
                        <li>• Rewrite sections with high similarity scores</li>
                        <li>• Use quotation marks for directly copied text</li>
                        <li>• Add proper citations for paraphrased content</li>
                        <li>• Consider removing near-duplicate sentences</li>
                      </ul>
                    </div>
                  )}

                  {results.plagiarismScore > 0.5 && results.plagiarismScore <= 0.75 && (
                    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                      <h4 className="font-semibold text-yellow-900 mb-2 flex items-center gap-2">
                        <FaExclamationCircle />
                        Medium Plagiarism Risk
                      </h4>
                      <p className="text-sm text-yellow-800 mb-3">
                        Some content similarities detected. Review carefully.
                      </p>
                      <ul className="text-sm text-yellow-700 space-y-1">
                        <li>• Review flagged sections above</li>
                        <li>• Ensure proper paraphrasing and attribution</li>
                        <li>• Add citations where needed</li>
                      </ul>
                    </div>
                  )}

                  {results.plagiarismScore <= 0.5 && (
                    <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                      <h4 className="font-semibold text-green-900 mb-2 flex items-center gap-2">
                        <FaCheckCircle />
                        Low Plagiarism Risk
                      </h4>
                      <p className="text-sm text-green-800">
                        Your document appears to be largely original. Continue good practices!
                      </p>
                    </div>
                  )}

                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <h4 className="font-semibold text-blue-900 mb-3">General Best Practices</h4>
                    <ul className="text-sm text-blue-800 space-y-2">
                      <li>✓ Always cite your sources</li>
                      <li>✓ Use quotation marks for direct quotes</li>
                      <li>✓ Paraphrase and cite when using others' ideas</li>
                      <li>✓ Maintain your own voice and original analysis</li>
                      <li>✓ Check citations against your institution's style guide</li>
                    </ul>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-gray-200 p-6 flex gap-3 bg-gray-50">
          {results ? (
            <>
              <button
                onClick={() => {
                  setResults(null)
                  setError('')
                }}
                className="flex-1 px-4 py-3 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-100 transition-colors"
              >
                Check Another Document
              </button>
              <button
                onClick={onClose}
                className="flex-1 px-4 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors"
              >
                Close
              </button>
            </>
          ) : (
            <>
              <button
                onClick={onClose}
                className="flex-1 px-4 py-3 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-100 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleCheckPlagiarism}
                disabled={checking || sourceTexts.every((s) => s.trim().length === 0)}
                className="flex-1 px-4 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {checking ? (
                  <>
                    <FaSpinner className="animate-spin" />
                    Checking Plagiarism...
                  </>
                ) : (
                  <>
                    <FaSearch />
                    Check for Plagiarism
                  </>
                )}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

export default PlagiarismDetector
