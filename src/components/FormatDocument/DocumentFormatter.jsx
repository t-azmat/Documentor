import { useState, useEffect } from 'react'
import {
  FaFileAlt,
  FaTimes,
  FaCheckCircle,
  FaSpinner,
  FaBook,
  FaHeading,
  FaQuoteLeft,
  FaLink,
  FaCopy,
  FaDownload,
  FaEye,
  FaEdit,
  FaExclamationCircle,
  FaInfo,
  FaCheckSquare,
  FaTasks,
  FaQuoteRight,
} from 'react-icons/fa'
import { citationAPI } from '../../services/pythonNlpService'

const DocumentFormatter = ({ document, onClose, onFormatSuccess }) => {
  // State Management
  const [selectedStyle, setSelectedStyle] = useState('APA')
  const [formatting, setFormatting] = useState(false)
  const [formattedContent, setFormattedContent] = useState(null)
  const [preview, setPreview] = useState(false)
  const [error, setError] = useState('')
  const [activeTab, setActiveTab] = useState('styles') // 'styles', 'preview', 'rules', 'citations'
  const [appliedRules, setAppliedRules] = useState([])
  const [copySuccess, setCopySuccess] = useState(false)
  const [citationAnalysis, setCitationAnalysis] = useState(null)
  const [analyzingCitations, setAnalyzingCitations] = useState(false)

  // Formatting styles with descriptions
  const styles = [
    {
      id: 'APA',
      name: 'APA',
      edition: '7th Edition',
      organization: 'American Psychological Association',
      description: 'Widely used in social sciences, psychology, and education',
      example: 'Smith, J. (2023). Title of work. Publisher Name.',
      features: [
        'Double spacing',
        'Times New Roman 12pt',
        'References on separate page',
        'Author-date citations',
        'Hanging indentation',
      ],
    },
    {
      id: 'MLA',
      name: 'MLA',
      edition: '9th Edition',
      organization: 'Modern Language Association',
      description: 'Common in humanities, literature, and language studies',
      example: 'Smith, John. "Title of Work." Publisher Name, 2023.',
      features: [
        'Double spacing',
        'Times New Roman 12pt',
        'Works Cited page',
        'In-text parenthetical citations',
        'Hanging indentation',
      ],
    },
    {
      id: 'IEEE',
      name: 'IEEE',
      edition: 'Latest',
      organization: 'Institute of Electrical and Electronics Engineers',
      description: 'Standard for technical, engineering, and computer science papers',
      example: '[1] J. Smith, "Title of work," Publisher, 2023.',
      features: [
        'Numbered citations [#]',
        'Compact reference list',
        'Technical paper format',
        'Equation numbering',
        'Figure and table numbering',
      ],
    },
    {
      id: 'Chicago',
      name: 'Chicago',
      edition: '17th Edition',
      organization: 'Chicago Manual of Style',
      description: 'Used in history, philosophy, and some business fields',
      example: 'Smith, John. Title of Work. Publisher, 2023.',
      features: [
        'Bibliography page',
        'Footnotes/endnotes',
        'Flexible spacing options',
        'Detailed source information',
        'Notes and bibliography method',
      ],
    },
    {
      id: 'Harvard',
      name: 'Harvard',
      edition: 'Latest',
      organization: 'Harvard Referencing System',
      description: 'Popular in UK universities and scientific research',
      example: 'Smith, J., 2023. Title of work. Publisher Name.',
      features: [
        'Author-date citations',
        'Reference list format',
        'Parenthetical citations',
        'Chronological references',
        'In-text year and page numbers',
      ],
    },
  ]

  // Apply formatting
  const handleApplyFormatting = async () => {
    setFormatting(true)
    setError('')
    setFormattedContent(null)

    try {
      if (!document?.content) {
        setError('No document content found')
        setFormatting(false)
        return
      }

      const response = await fetch(
        `${import.meta.env.VITE_NLP_API_URL || 'http://localhost:5001'}/api/formatting/apply`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            content: {
              title: document.title || 'Untitled Document',
              body: document.content,
              sections: [],
              references: [],
            },
            style: selectedStyle,
          }),
        }
      )

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to format document')
      }

      const data = await response.json()
      setFormattedContent(data.data?.formatted || data.data)
      setAppliedRules(data.data?.appliedRules || [])
      setActiveTab('preview')
    } catch (err) {
      setError(err.message || 'Failed to format document')
      console.error('Formatting error:', err)
    } finally {
      setFormatting(false)
    }
  }

  // Copy to clipboard
  const handleCopyFormatted = async () => {
    try {
      await navigator.clipboard.writeText(formattedContent)
      setCopySuccess(true)
      setTimeout(() => setCopySuccess(false), 2000)
    } catch (err) {
      setError('Failed to copy to clipboard')
    }
  }

  // Save formatted document
  const handleSaveFormatted = async () => {
    try {
      const response = await fetch(
        `${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/documents/${document._id}`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${localStorage.getItem('token')}`,
          },
          body: JSON.stringify({
            content: formattedContent,
            'formatting.style': selectedStyle,
            'formatting.appliedAt': new Date().toISOString(),
          }),
        }
      )

      if (!response.ok) throw new Error('Failed to save document')

      const data = await response.json()
      onFormatSuccess?.(data.document)
      setError('')
    } catch (err) {
      setError('Failed to save document: ' + err.message)
    }
  }

  // Analyze citations
  const analyzeCitations = async () => {
    setAnalyzingCitations(true)
    setError('')

    try {
      const text = document?.content?.raw || document?.content || ''
      if (!text) {
        setError('No document content to analyze')
        return
      }

      const response = await citationAPI.matchCitations(text)
      setCitationAnalysis(response.data)
    } catch (err) {
      console.error('Citation analysis error:', err)
      setError('Failed to analyze citations: ' + (err.response?.data?.error || err.message))
    } finally {
      setAnalyzingCitations(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl max-w-5xl w-full max-h-[95vh] overflow-hidden flex flex-col shadow-2xl">
        {/* Header */}
        <div className="bg-gradient-to-r from-purple-600 to-purple-800 text-white p-6 border-b border-purple-700">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="bg-white bg-opacity-20 p-3 rounded-lg">
                <FaBook className="text-3xl" />
              </div>
              <div>
                <h2 className="text-2xl font-bold">Document Formatter</h2>
                <p className="text-purple-100 text-sm mt-1">
                  {document?.title || 'Document'} - Apply Citation Styles
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-purple-500 rounded-lg transition-colors"
            >
              <FaTimes className="text-xl" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {!formattedContent ? (
            <div className="p-8">
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

              {/* Document Info */}
              <div className="bg-purple-50 border border-purple-200 rounded-lg p-6 mb-8">
                <div className="flex items-start gap-3">
                  <FaFileAlt className="text-purple-600 mt-1 flex-shrink-0" />
                  <div className="flex-1">
                    <h3 className="font-semibold text-gray-900">Document Information</h3>
                    <p className="text-sm text-gray-600 mt-1">
                      {document?.title || 'Untitled Document'}
                    </p>
                    <p className="text-xs text-gray-500 mt-2">
                      {document?.content?.length || 0} characters • Last modified{' '}
                      {document?.updatedAt
                        ? new Date(document.updatedAt).toLocaleDateString()
                        : 'Unknown'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Style Selection */}
              <div className="mb-8">
                <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <FaBook className="text-purple-600" />
                  Select Formatting Style
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {styles.map((style) => (
                    <label
                      key={style.id}
                      className={`border-2 rounded-lg p-6 cursor-pointer transition-all ${
                        selectedStyle === style.id
                          ? 'border-purple-500 bg-purple-50'
                          : 'border-gray-200 hover:border-purple-300 hover:bg-gray-50'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <input
                          type="radio"
                          name="style"
                          value={style.id}
                          checked={selectedStyle === style.id}
                          onChange={(e) => setSelectedStyle(e.target.value)}
                          disabled={formatting}
                          className="mt-1 w-5 h-5 text-purple-600 cursor-pointer"
                        />
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <h4 className="font-bold text-lg text-gray-900">{style.name}</h4>
                            <span className="text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded">
                              {style.edition}
                            </span>
                          </div>
                          <p className="text-xs text-gray-600 mb-3">{style.organization}</p>
                          <p className="text-sm text-gray-700 mb-3">{style.description}</p>

                          <div className="bg-white border border-gray-200 rounded p-3 mb-3">
                            <p className="text-xs text-gray-600 mb-1">Example:</p>
                            <p className="text-xs font-mono text-gray-900">{style.example}</p>
                          </div>

                          <div className="space-y-1">
                            {style.features.map((feature, idx) => (
                              <div key={idx} className="text-xs text-gray-600 flex items-center gap-2">
                                <FaCheckSquare className="text-purple-500" />
                                {feature}
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              {/* Information Box */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex gap-3">
                <FaInfo className="text-blue-600 flex-shrink-0 mt-1" />
                <div className="text-sm text-blue-800">
                  <p className="font-semibold mb-2">What happens when you format:</p>
                  <ul className="space-y-1 text-xs">
                    <li>✓ Applies consistent spacing and font settings</li>
                    <li>✓ Formats citations and references</li>
                    <li>✓ Adjusts heading styles per selected format</li>
                    <li>✓ Creates proper bibliography formatting</li>
                    <li>✓ Maintains your original content and structure</li>
                  </ul>
                </div>
              </div>
            </div>
          ) : (
            // Results View
            <div className="p-8">
              {/* Tabs */}
              <div className="flex gap-2 mb-6 border-b border-gray-200">
                {[
                  { id: 'preview', label: 'Preview', icon: FaEye },
                  { id: 'rules', label: 'Applied Rules', icon: FaTasks },
                  { id: 'citations', label: 'Citation Analysis', icon: FaQuoteRight },
                ].map(({ id, label, icon: Icon }) => (
                  <button
                    key={id}
                    onClick={() => {
                      setActiveTab(id)
                      if (id === 'citations' && !citationAnalysis) {
                        analyzeCitations()
                      }
                    }}
                    className={`px-4 py-3 font-medium border-b-2 transition-colors flex items-center gap-2 ${
                      activeTab === id
                        ? 'border-purple-600 text-purple-600'
                        : 'border-transparent text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    <Icon className="text-lg" />
                    {label}
                  </button>
                ))}
              </div>

              {/* Preview Tab */}
              {activeTab === 'preview' && (
                <div className="space-y-4">
                  {/* Format Summary */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                    <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg p-4 border border-purple-200">
                      <p className="text-xs text-gray-600 mb-1">Selected Style</p>
                      <p className="text-xl font-bold text-purple-700">{selectedStyle}</p>
                    </div>
                    <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg p-4 border border-blue-200">
                      <p className="text-xs text-gray-600 mb-1">Rules Applied</p>
                      <p className="text-xl font-bold text-blue-700">{appliedRules.length}</p>
                    </div>
                    <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-lg p-4 border border-green-200">
                      <p className="text-xs text-gray-600 mb-1">Status</p>
                      <p className="text-xl font-bold text-green-700">Ready</p>
                    </div>
                  </div>

                  {/* Formatted Content */}
                  <div className="bg-white border-2 border-gray-200 rounded-lg p-8 max-h-96 overflow-y-auto whitespace-pre-wrap font-serif text-gray-900 leading-relaxed">
                    {formattedContent}
                  </div>

                  {/* Info */}
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex gap-3">
                    <FaInfo className="text-blue-600 flex-shrink-0 mt-1" />
                    <div className="text-sm text-blue-800">
                      <p className="font-semibold mb-2">Next steps:</p>
                      <ul className="space-y-1 text-xs">
                        <li>✓ Copy the formatted text to use elsewhere</li>
                        <li>✓ Save to update your document in Documentor</li>
                        <li>✓ Review formatting rules applied below</li>
                      </ul>
                    </div>
                  </div>
                </div>
              )}

              {/* Rules Tab */}
              {activeTab === 'rules' && (
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {appliedRules && appliedRules.length > 0 ? (
                    appliedRules.map((rule, index) => (
                      <div key={index} className="border border-gray-200 rounded-lg p-4 hover:border-purple-300 transition-colors">
                        <div className="flex items-start gap-3">
                          <FaCheckCircle className="text-green-600 flex-shrink-0 mt-1" />
                          <div className="flex-1">
                            <h4 className="font-semibold text-gray-900">{rule.rule}</h4>
                            <p className="text-sm text-gray-600 mt-1">{rule.description}</p>
                            {rule.applied && (
                              <p className="text-xs text-green-700 mt-2 flex items-center gap-1">
                                <FaCheckCircle />
                                Applied to document
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-8 text-gray-500">
                      <FaTasks className="text-3xl mx-auto mb-2 opacity-50" />
                      <p>No rules to display</p>
                    </div>
                  )}
                </div>
              )}

              {/* Citations Tab */}
              {activeTab === 'citations' && (
                <div className="space-y-4 max-h-96 overflow-y-auto">
                  {analyzingCitations ? (
                    <div className="text-center py-12">
                      <FaSpinner className="animate-spin text-4xl text-purple-600 mx-auto mb-4" />
                      <p className="text-gray-600">Analyzing citations...</p>
                    </div>
                  ) : citationAnalysis ? (
                    <>
                      {/* Citation Statistics */}
                      <div className="grid grid-cols-4 gap-3 mb-4">
                        <div className="bg-blue-50 rounded-lg p-3 border border-blue-200 text-center">
                          <div className="text-2xl font-bold text-blue-700">
                            {citationAnalysis.citations?.length || 0}
                          </div>
                          <div className="text-xs text-gray-600">Citations</div>
                        </div>
                        <div className="bg-green-50 rounded-lg p-3 border border-green-200 text-center">
                          <div className="text-2xl font-bold text-green-700">
                            {citationAnalysis.references?.length || 0}
                          </div>
                          <div className="text-xs text-gray-600">References</div>
                        </div>
                        <div className="bg-purple-50 rounded-lg p-3 border border-purple-200 text-center">
                          <div className="text-2xl font-bold text-purple-700">
                            {citationAnalysis.matched_count || 0}
                          </div>
                          <div className="text-xs text-gray-600">Matched</div>
                        </div>
                        <div className="bg-yellow-50 rounded-lg p-3 border border-yellow-200 text-center">
                          <div className="text-2xl font-bold text-yellow-700">
                            {citationAnalysis.unmatched_citations || 0}
                          </div>
                          <div className="text-xs text-gray-600">Unmatched</div>
                        </div>
                      </div>

                      {/* Citation List Preview */}
                      {citationAnalysis.citations && citationAnalysis.citations.length > 0 && (
                        <div className="space-y-2">
                          <h4 className="font-semibold text-gray-900 mb-2">In-text Citations</h4>
                          {citationAnalysis.citations.slice(0, 5).map((citation, idx) => {
                            const isMatched = citationAnalysis.mapping && 
                                            citationAnalysis.mapping[idx] !== undefined

                            return (
                              <div
                                key={idx}
                                className={`border-l-4 p-3 rounded ${
                                  isMatched 
                                    ? 'border-green-500 bg-green-50' 
                                    : 'border-yellow-500 bg-yellow-50'
                                }`}
                              >
                                <div className="flex items-center gap-2">
                                  {isMatched ? (
                                    <FaCheckCircle className="text-green-600" />
                                  ) : (
                                    <FaExclamationCircle className="text-yellow-600" />
                                  )}
                                  <code className="text-sm font-semibold">{citation.text}</code>
                                  <span className="text-xs bg-gray-200 px-2 py-1 rounded">
                                    Line {citation.line}
                                  </span>
                                </div>
                                {citation.author && (
                                  <p className="text-xs text-gray-600 mt-1 ml-6">
                                    Author: {citation.author}
                                  </p>
                                )}
                              </div>
                            )
                          })}
                          {citationAnalysis.citations.length > 5 && (
                            <p className="text-xs text-gray-500 text-center">
                              + {citationAnalysis.citations.length - 5} more citations
                            </p>
                          )}
                        </div>
                      )}

                      {/* Recommendations */}
                      {citationAnalysis.unmatched_citations > 0 && (
                        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                          <div className="flex items-start gap-2">
                            <FaExclamationCircle className="text-yellow-600 mt-1" />
                            <div>
                              <h4 className="font-semibold text-yellow-900 text-sm">
                                Action Required
                              </h4>
                              <p className="text-xs text-yellow-800 mt-1">
                                {citationAnalysis.unmatched_citations} citation(s) do not have 
                                matching entries in the reference list. Consider adding them to 
                                ensure proper academic formatting.
                              </p>
                            </div>
                          </div>
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="text-center py-12">
                      <FaQuoteRight className="text-4xl text-gray-300 mx-auto mb-4" />
                      <p className="text-gray-600 mb-4">Click to analyze document citations</p>
                      <button
                        onClick={analyzeCitations}
                        className="btn-primary inline-flex items-center gap-2"
                      >
                        <FaQuoteRight />
                        Analyze Citations
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-gray-200 p-6 bg-gray-50 flex gap-3">
          {formattedContent ? (
            <>
              <button
                onClick={() => {
                  setFormattedContent(null)
                  setAppliedRules([])
                  setError('')
                }}
                className="flex-1 px-4 py-3 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-100 transition-colors"
              >
                Format Another Style
              </button>
              <button
                onClick={handleCopyFormatted}
                className="flex-1 px-4 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
              >
                <FaCopy />
                {copySuccess ? 'Copied!' : 'Copy Text'}
              </button>
              <button
                onClick={handleSaveFormatted}
                className="flex-1 px-4 py-3 bg-purple-600 text-white font-medium rounded-lg hover:bg-purple-700 transition-colors flex items-center justify-center gap-2"
              >
                <FaDownload />
                Save Document
              </button>
              <button
                onClick={onClose}
                className="flex-1 px-4 py-3 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-100 transition-colors"
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
                onClick={handleApplyFormatting}
                disabled={formatting}
                className="flex-1 px-4 py-3 bg-purple-600 text-white font-medium rounded-lg hover:bg-purple-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {formatting ? (
                  <>
                    <FaSpinner className="animate-spin" />
                    Formatting...
                  </>
                ) : (
                  <>
                    <FaBook />
                    Apply Formatting
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

export default DocumentFormatter
