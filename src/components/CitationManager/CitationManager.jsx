import { useState, useEffect } from 'react'
import { 
  FaUpload, FaCheckCircle, FaExclamationTriangle, 
  FaFileAlt, FaLink, FaDownload, FaSpinner, FaPlus, FaEdit, FaTimes, FaBook 
} from 'react-icons/fa'
import { citationAPI } from '../../services/pythonNlpService'

const CitationManager = ({ document: propDocument }) => {
  const [file, setFile] = useState(null)
  const [loading, setLoading] = useState(false)
  const [documentText, setDocumentText] = useState('')
  const [analysis, setAnalysis] = useState(null)
  const [selectedStyle, setSelectedStyle] = useState('APA')
  const [error, setError] = useState(null)
  
  // New states for mode selection
  const [mode, setMode] = useState(null) // 'extract' or 'add'
  const [showModeSelection, setShowModeSelection] = useState(false)
  const [pendingFile, setPendingFile] = useState(null)
  const [manualCitations, setManualCitations] = useState([])
  const [editingCitationId, setEditingCitationId] = useState(null)
  const [removedCitationIndices, setRemovedCitationIndices] = useState(new Set())
  const [newCitation, setNewCitation] = useState({
    author: '',
    year: '',
    title: '',
    source: '',
    pages: '',
    doi: '',
    url: ''
  })

  // Helper: run analysis on the prop document's text
  const analyzeDocumentText = (doc) => {
    const text = doc.content?.raw || ''
    if (!text.trim()) return
    setMode('extract')
    setFile({ name: doc.title || 'Document' })
    setDocumentText(text)
    setAnalysis(null)
    setError(null)
    setRemovedCitationIndices(new Set())
    setLoading(true)
    citationAPI.extractFromText(text)
      .then(response => {
        const data = response.data
        setAnalysis(data)
        if (data.detected_style && data.detected_style !== 'Unknown') {
          setSelectedStyle(data.detected_style)
        }
      })
      .catch(err => {
        console.error('Auto citation analysis failed:', err)
        setError('Could not auto-analyze document citations. You can still upload a file manually.')
      })
      .finally(() => setLoading(false))
  }

  // Load state from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem('citationManager_state')
    let restoredForThisDoc = false

    if (propDocument) {
      // Only restore cache if it belongs to this exact document
      if (saved) {
        try {
          const parsed = JSON.parse(saved)
          if (parsed.documentId === propDocument._id && parsed.analysis) {
            setMode(parsed.mode || 'extract')
            setFile({ name: parsed.fileName || propDocument.title })
            setDocumentText(parsed.documentText || '')
            setAnalysis(parsed.analysis)
            setSelectedStyle(parsed.style || 'APA')
            setManualCitations(parsed.citations || [])
            restoredForThisDoc = true
          }
        } catch (err) {
          console.error('Failed to load saved state:', err)
        }
      }
      if (!restoredForThisDoc) {
        analyzeDocumentText(propDocument)
      }
    } else {
      // Standalone mode: restore any saved manual-upload state
      if (saved) {
        try {
          const parsed = JSON.parse(saved)
          if (!parsed.documentId) { // only restore states that weren't tied to a document
            setManualCitations(parsed.citations || [])
            setSelectedStyle(parsed.style || 'APA')
            setMode(parsed.mode || null)
            if (parsed.fileName) setFile({ name: parsed.fileName })
            if (parsed.documentText) setDocumentText(parsed.documentText)
            if (parsed.analysis) setAnalysis(parsed.analysis)
          }
        } catch (err) {
          console.error('Failed to load saved state:', err)
        }
      }
    }
  }, [])

  // Re-analyze whenever the user switches to a different document
  useEffect(() => {
    if (!propDocument) return
    const saved = localStorage.getItem('citationManager_state')
    if (saved) {
      try {
        const parsed = JSON.parse(saved)
        if (parsed.documentId === propDocument._id) return // same doc, already loaded
      } catch (_) {}
    }
    analyzeDocumentText(propDocument)
  }, [propDocument?._id])

  // Save full state to localStorage whenever anything changes
  useEffect(() => {
    if (mode) {
      try {
        localStorage.setItem('citationManager_state', JSON.stringify({
          documentId: propDocument?._id || null,
          citations: manualCitations,
          style: selectedStyle,
          mode,
          fileName: file?.name || null,
          documentText: documentText || null,
          analysis: analysis || null,
          lastUpdated: new Date().toISOString()
        }))
      } catch (err) {
        // analysis can be large – if storage is full, save without it
        localStorage.setItem('citationManager_state', JSON.stringify({
          documentId: propDocument?._id || null,
          citations: manualCitations,
          style: selectedStyle,
          mode,
          fileName: file?.name || null,
          documentText: documentText || null,
          analysis: null,
          lastUpdated: new Date().toISOString()
        }))
      }
    }
  }, [manualCitations, selectedStyle, mode, file, documentText, analysis])

  const citationStyles = {
    APA: 'American Psychological Association (7th ed.)',
    MLA: 'Modern Language Association (9th ed.)',
    Chicago: 'Chicago Manual of Style (17th ed.)',
    Harvard: 'Harvard Referencing Style'
  }

  const handleFileUpload = async (e) => {
    const selectedFile = e.target.files[0]
    if (!selectedFile) return

    // Store file and show mode selection dialog
    setPendingFile(selectedFile)
    setShowModeSelection(true)
    setError(null)
  }

  const handleModeSelection = async (selectedMode) => {
    setMode(selectedMode)
    setShowModeSelection(false)
    setFile(pendingFile)
    setRemovedCitationIndices(new Set())

    if (selectedMode === 'extract') {
      // Extract citations from document
      setLoading(true)
      try {
        const response = await citationAPI.extractFromFile(pendingFile)
        const data = response.data

        setDocumentText(data.text)
        setAnalysis(data)
        
        if (data.detected_style && data.detected_style !== 'Unknown') {
          setSelectedStyle(data.detected_style)
        }
      } catch (err) {
        console.error('File upload error:', err)
        const errorMessage = err.response?.data?.error || err.response?.data?.message || err.message || 'Failed to process file'
        setError(errorMessage)
      } finally {
        setLoading(false)
      }
    } else if (selectedMode === 'add') {
      // Load document text for reference but don't extract citations
      setLoading(true)
      try {
        const response = await citationAPI.extractFromFile(pendingFile)
        const data = response.data
        setDocumentText(data.text)
      } catch (err) {
        console.error('File load error:', err)
        const errorMessage = err.response?.data?.error || err.response?.data?.message || err.message || 'Failed to load file'
        setError(errorMessage)
      } finally {
        setLoading(false)
      }
    }
  }

  const handleAddCitation = () => {
    if (!newCitation.author || !newCitation.title) {
      setError('Author and title are required')
      return
    }

    if (editingCitationId) {
      // Update existing citation
      setManualCitations(manualCitations.map(cit => 
        cit.id === editingCitationId ? { ...newCitation, id: editingCitationId } : cit
      ))
      setEditingCitationId(null)
    } else {
      // Add new citation
      setManualCitations([...manualCitations, { ...newCitation, id: Date.now() }])
    }
    
    // Reset form
    setNewCitation({
      author: '',
      year: '',
      title: '',
      source: '',
      pages: '',
      doi: '',
      url: ''
    })
    setError(null)
  }

  const handleEditCitation = (citation) => {
    setNewCitation({
      author: citation.author,
      year: citation.year,
      title: citation.title,
      source: citation.source,
      pages: citation.pages,
      doi: citation.doi,
      url: citation.url
    })
    setEditingCitationId(citation.id)
    // Scroll to form
    document.getElementById('citation-form')?.scrollIntoView({ behavior: 'smooth' })
  }

  const handleCancelEdit = () => {
    setEditingCitationId(null)
    setNewCitation({
      author: '',
      year: '',
      title: '',
      source: '',
      pages: '',
      doi: '',
      url: ''
    })
    setError(null)
  }

  const handleDeleteCitation = (id) => {
    setManualCitations(manualCitations.filter(cit => cit.id !== id))
    if (editingCitationId === id) {
      handleCancelEdit()
    }
  }

  const handleClearAll = () => {
    if (!window.confirm('Are you sure you want to clear all citations? This cannot be undone.')) return
    setManualCitations([])
    setAnalysis(null)
    setDocumentText('')
    setFile(null)
    setMode(null)
    setRemovedCitationIndices(new Set())
    localStorage.removeItem('citationManager_state')
    setEditingCitationId(null)
    setNewCitation({
      author: '',
      year: '',
      title: '',
      source: '',
      pages: '',
      doi: '',
      url: ''
    })
  }

  const handleRemoveExtractedCitation = (idx) => {
    setRemovedCitationIndices(prev => new Set([...prev, idx]))
  }

  const formatManualCitation = (citation, style) => {
    switch (style) {
      case 'APA':
        return `${citation.author}${citation.year ? ` (${citation.year})` : ''}. ${citation.title}. ${citation.source || ''}${citation.pages ? `, ${citation.pages}` : ''}${citation.doi ? `. https://doi.org/${citation.doi}` : citation.url ? ` ${citation.url}` : ''}`
      
      case 'MLA':
        return `${citation.author}. "${citation.title}." ${citation.source || ''}${citation.pages ? `, pp. ${citation.pages}` : ''}${citation.url ? `, ${citation.url}` : ''}.`
      
      case 'Chicago':
        return `${citation.author}${citation.year ? `. ${citation.year}` : ''}. "${citation.title}." ${citation.source || ''}${citation.pages ? `, ${citation.pages}` : ''}${citation.url ? `. ${citation.url}` : ''}.`
      
      case 'Harvard':
        return `${citation.author}${citation.year ? ` ${citation.year}` : ''}, ${citation.title}, ${citation.source || ''}${citation.pages ? `, pp.${citation.pages}` : ''}${citation.url ? `, available at: ${citation.url}` : ''}.`
      
      default:
        return `${citation.author} (${citation.year}). ${citation.title}. ${citation.source}`
    }
  }

  const handleDownloadManualCitations = () => {
    const formattedList = manualCitations
      .map(cit => formatManualCitation(cit, selectedStyle))
      .join('\n\n')
    
    const blob = new Blob([formattedList], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `citations_${selectedStyle.toLowerCase()}_${Date.now()}.txt`
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleFormatDocument = async () => {
    if (!documentText) return

    setLoading(true)
    setError(null)

    try {
      const response = await citationAPI.formatDocument(documentText, selectedStyle)
      const formattedText = response.data.formatted_text

      // Create download
      const blob = new Blob([formattedText], { type: 'text/plain' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `formatted_${selectedStyle.toLowerCase()}_${Date.now()}.txt`
      a.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      console.error('Format error:', err)
      setError(err.response?.data?.error || 'Failed to format document')
    } finally {
      setLoading(false)
    }
  }

  const getMatchQuality = () => {
    if (!analysis || !analysis.citations || analysis.citations.length === 0) return 0
    return Math.round((analysis.matched_count / analysis.citations.length) * 100)
  }

  const getMatchStatus = () => {
    const quality = getMatchQuality()
    if (quality === 100) return { color: 'green', text: 'Perfect', icon: FaCheckCircle }
    if (quality >= 80) return { color: 'blue', text: 'Good', icon: FaCheckCircle }
    if (quality >= 50) return { color: 'yellow', text: 'Fair', icon: FaExclamationTriangle }
    return { color: 'red', text: 'Needs Attention', icon: FaExclamationTriangle }
  }

  return (
    <div className="space-y-6">
      {/* Persistence Status Banner - Extract Mode */}
      {mode === 'extract' && analysis && (
        <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FaCheckCircle className="text-purple-600" />
              <div>
                <p className="text-sm font-medium text-purple-900">Analysis Active</p>
                <p className="text-xs text-purple-700">
                  Extracted citations are saved. You can switch panels and return anytime.
                  {removedCitationIndices.size > 0 && ` (${removedCitationIndices.size} removed)`}
                </p>
              </div>
            </div>
            <button
              onClick={() => {
                if (window.confirm('Clear this analysis and start fresh?')) {
                  handleClearAll()
                  if (propDocument) analyzeDocumentText(propDocument)
                }
              }}
              className="text-xs text-purple-700 hover:text-purple-900 underline"
            >
              Re-analyze
            </button>
          </div>
        </div>
      )}

      {/* Persistence Status Banner - Add Mode */}
      {mode === 'add' && manualCitations.length > 0 && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FaCheckCircle className="text-green-600" />
              <div>
                <p className="text-sm font-medium text-green-900">
                  Citation Collection Active
                </p>
                <p className="text-xs text-green-700">
                  Your {manualCitations.length} citation{manualCitations.length !== 1 ? 's are' : ' is'} auto-saved. You can switch panels and return anytime.
                </p>
              </div>
            </div>
            <button
              onClick={() => {
                if (window.confirm('Start a new collection? This will clear all current citations.')) {
                  handleClearAll()
                  setMode(null)
                  setFile(null)
                }
              }}
              className="text-xs text-green-700 hover:text-green-900 underline"
            >
              Start New Collection
            </button>
          </div>
        </div>
      )}

      {/* Mode Selection Dialog */}
      {showModeSelection && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[70]">
          <div className="bg-white rounded-xl max-w-md w-full p-6 shadow-2xl">
            <h3 className="text-xl font-bold text-gray-900 mb-4">How would you like to use this document?</h3>
            <p className="text-sm text-gray-600 mb-6">
              Choose how you want to work with citations in this document.
            </p>
            
            <div className="space-y-3">
              <button
                onClick={() => handleModeSelection('extract')}
                className="w-full bg-purple-600 hover:bg-purple-700 text-white p-4 rounded-lg text-left transition-colors"
              >
                <div className="flex items-start gap-3">
                  <FaFileAlt className="text-2xl mt-1" />
                  <div>
                    <div className="font-semibold mb-1">Extract Citations</div>
                    <div className="text-sm text-purple-100">
                      Automatically detect and analyze existing citations in the document
                    </div>
                  </div>
                </div>
              </button>

              <button
                onClick={() => handleModeSelection('add')}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white p-4 rounded-lg text-left transition-colors"
              >
                <div className="flex items-start gap-3">
                  <FaPlus className="text-2xl mt-1" />
                  <div>
                    <div className="font-semibold mb-1">Add Citations Manually</div>
                    <div className="text-sm text-blue-100">
                      Create your own citation list with this document as reference
                    </div>
                  </div>
                </div>
              </button>
            </div>

            <button
              onClick={() => {
                setShowModeSelection(false)
                setPendingFile(null)
              }}
              className="mt-4 w-full px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Document source — compact bar when opened from workspace, full upload when standalone */}
      {propDocument ? (
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center gap-3">
            <FaFileAlt className="text-blue-600 text-lg flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-gray-900 truncate">{propDocument.title}</p>
              {analysis && (
                <p className="text-xs text-gray-500">
                  {analysis.word_count} words · {analysis.citations?.length || 0} citations detected
                </p>
              )}
            </div>
            {loading && (
              <div className="flex items-center gap-2 text-blue-600 text-sm">
                <FaSpinner className="animate-spin" />
                <span>Analyzing…</span>
              </div>
            )}
          </div>
          {error && (
            <div className="mt-3 bg-red-50 border border-red-200 rounded-lg p-3">
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            📤 Upload Document
          </h3>

          <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-blue-500 transition-colors">
            <input
              type="file"
              id="citation-file-upload"
              accept=".pdf,.docx,.txt,.tex,.latex"
              onChange={handleFileUpload}
              className="hidden"
            />
            <label
              htmlFor="citation-file-upload"
              className="cursor-pointer flex flex-col items-center"
            >
              <FaUpload className="text-4xl text-gray-400 mb-3" />
              <span className="text-sm text-gray-600">
                {file ? file.name : 'Click to upload or drag and drop'}
              </span>
              <span className="text-xs text-gray-500 mt-1">
                PDF, DOCX, TXT, LaTeX (Max 10MB)
              </span>
            </label>
          </div>

          {loading && (
            <div className="mt-4 flex items-center justify-center gap-2 text-blue-600">
              <FaSpinner className="animate-spin" />
              <span>Processing document...</span>
            </div>
          )}

          {error && (
            <div className="mt-4 bg-red-50 border border-red-200 rounded-lg p-3">
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}

          {analysis && (
            <div className="mt-4 bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FaFileAlt className="text-blue-600" />
                  <span className="text-sm font-medium text-gray-900">
                    {file?.name}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-sm text-gray-600">
                    {analysis.word_count} words | {analysis.char_count} characters
                  </div>
                  <button
                    onClick={() => {
                      if (window.confirm('Remove this document? All extracted data will be cleared.')) {
                        setAnalysis(null)
                        setDocumentText('')
                        setFile(null)
                        setMode(null)
                        setRemovedCitationIndices(new Set())
                        localStorage.removeItem('citationManager_state')
                      }
                    }}
                    className="p-1 text-red-500 hover:text-red-700 hover:bg-red-50 rounded"
                    title="Remove document"
                  >
                    <FaTimes />
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Manual Citation Entry Mode */}
      {mode === 'add' && file && (
        <>
          {/* Document Reference */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <FaBook className="text-blue-600 text-xl mt-1" />
              <div className="flex-1">
                <h4 className="font-semibold text-blue-900 mb-2">Reference Document</h4>
                <p className="text-sm text-blue-800">
                  <strong>{file.name}</strong> - Use this document as context while adding citations
                </p>
                {documentText && (
                  <details className="mt-2">
                    <summary className="text-xs text-blue-700 cursor-pointer hover:text-blue-900">
                      View document content
                    </summary>
                    <div className="mt-2 p-3 bg-white rounded border border-blue-200 max-h-48 overflow-y-auto">
                      <pre className="text-xs text-gray-700 whitespace-pre-wrap">
                        {documentText.substring(0, 1000)}...
                      </pre>
                    </div>
                  </details>
                )}
              </div>
            </div>
          </div>

          {/* Style Selector for Manual Mode */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              📋 Citation Style
            </h3>
            
            <div className="mb-3 bg-blue-50 border border-blue-200 rounded-lg p-3">
              <p className="text-sm text-blue-800">
                💡 <strong>Tip:</strong> Change the style anytime! All citations in your list will automatically update to the new format.
              </p>
            </div>
            
            <div className="flex flex-wrap gap-2">
              {Object.keys(citationStyles).map((style) => (
                <button
                  key={style}
                  onClick={() => setSelectedStyle(style)}
                  className={`px-4 py-2 rounded-lg font-medium transition-all ${
                    selectedStyle === style
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {style}
                </button>
              ))}
            </div>
            
            <p className="text-xs text-gray-500 mt-2">
              {citationStyles[selectedStyle]}
            </p>
          </div>

          {/* Add Citation Form */}
          <div id="citation-form" className="bg-white rounded-lg border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              {editingCitationId ? '✏️ Edit Citation' : '➕ Add Citation'}
            </h3>

            {editingCitationId && (
              <div className="mb-4 bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                <p className="text-sm text-yellow-800">
                  Editing citation. Click "Update Citation" to save changes or "Cancel" to discard.
                </p>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Author(s) <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={newCitation.author}
                  onChange={(e) => setNewCitation({...newCitation, author: e.target.value})}
                  placeholder="e.g., Smith, J., & Johnson, A."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Year
                </label>
                <input
                  type="text"
                  value={newCitation.year}
                  onChange={(e) => setNewCitation({...newCitation, year: e.target.value})}
                  placeholder="e.g., 2024"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Title <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={newCitation.title}
                  onChange={(e) => setNewCitation({...newCitation, title: e.target.value})}
                  placeholder="e.g., Machine Learning in Natural Language Processing"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Source (Journal/Book/Website)
                </label>
                <input
                  type="text"
                  value={newCitation.source}
                  onChange={(e) => setNewCitation({...newCitation, source: e.target.value})}
                  placeholder="e.g., Journal of AI Research"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Pages
                </label>
                <input
                  type="text"
                  value={newCitation.pages}
                  onChange={(e) => setNewCitation({...newCitation, pages: e.target.value})}
                  placeholder="e.g., 45-67"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  DOI
                </label>
                <input
                  type="text"
                  value={newCitation.doi}
                  onChange={(e) => setNewCitation({...newCitation, doi: e.target.value})}
                  placeholder="e.g., 10.1234/example"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  URL
                </label>
                <input
                  type="text"
                  value={newCitation.url}
                  onChange={(e) => setNewCitation({...newCitation, url: e.target.value})}
                  placeholder="e.g., https://example.com/article"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>

            <div className="mt-4 flex gap-2">
              <button
                onClick={handleAddCitation}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white px-4 py-3 rounded-lg font-medium flex items-center justify-center gap-2"
              >
                {editingCitationId ? (
                  <>
                    <FaEdit />
                    Update Citation
                  </>
                ) : (
                  <>
                    <FaPlus />
                    Add Citation to List
                  </>
                )}
              </button>
              
              {editingCitationId && (
                <button
                  onClick={handleCancelEdit}
                  className="px-6 bg-gray-200 hover:bg-gray-300 text-gray-700 py-3 rounded-lg font-medium"
                >
                  Cancel
                </button>
              )}
            </div>
          </div>

          {/* Manual Citations List */}
          {manualCitations.length > 0 && (
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">
                  📚 Your Citation List ({manualCitations.length})
                </h3>
                <div className="flex gap-2">
                  <button
                    onClick={handleClearAll}
                    className="bg-red-100 hover:bg-red-200 text-red-700 px-4 py-2 rounded-lg flex items-center gap-2 text-sm font-medium"
                  >
                    <FaTimes />
                    Clear All
                  </button>
                  <button
                    onClick={handleDownloadManualCitations}
                    className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 text-sm font-medium"
                  >
                    <FaDownload />
                    Download as {selectedStyle}
                  </button>
                </div>
              </div>

              <div className="space-y-3">
                {manualCitations.map((citation, idx) => (
                  <div
                    key={citation.id}
                    className={`border rounded-lg p-4 transition-all ${
                      editingCitationId === citation.id
                        ? 'border-blue-500 bg-blue-50 shadow-md'
                        : 'border-gray-200 hover:shadow-md'
                    }`}
                  >
                    {editingCitationId === citation.id && (
                      <div className="mb-2 text-xs text-blue-700 font-semibold flex items-center gap-1">
                        <FaEdit />
                        Currently editing
                      </div>
                    )}
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1">
                        <div className="text-sm font-medium text-gray-900 mb-2">
                          {idx + 1}. {formatManualCitation(citation, selectedStyle)}
                        </div>
                        <div className="flex flex-wrap gap-2 text-xs text-gray-600">
                          <span className="bg-gray-100 px-2 py-1 rounded">Author: {citation.author}</span>
                          {citation.year && <span className="bg-gray-100 px-2 py-1 rounded">Year: {citation.year}</span>}
                          {citation.pages && <span className="bg-gray-100 px-2 py-1 rounded">Pages: {citation.pages}</span>}
                        </div>
                      </div>
                      <div className="flex gap-1">
                        <button
                          onClick={() => handleEditCitation(citation)}
                          className={`p-2 hover:bg-blue-50 rounded-lg ${editingCitationId === citation.id ? 'bg-blue-100 text-blue-700' : 'text-blue-600'}`}
                          title="Edit citation"
                        >
                          <FaEdit />
                        </button>
                        <button
                          onClick={() => handleDeleteCitation(citation.id)}
                          className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
                          title="Delete citation"
                        >
                          <FaTimes />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* Style Selector - Only show for Extract Mode */}
      {mode === 'extract' && analysis && (
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            📋 Citation Style
          </h3>
          
          {analysis.detected_style && analysis.detected_style !== 'Unknown' && (
            <div className="mb-4 bg-green-50 border border-green-200 rounded-lg p-3">
              <p className="text-sm text-green-800">
                ✓ Detected Style: <strong>{analysis.detected_style}</strong>
              </p>
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            {Object.keys(citationStyles).map((style) => (
              <button
                key={style}
                onClick={() => setSelectedStyle(style)}
                className={`px-4 py-2 rounded-lg font-medium transition-all ${
                  selectedStyle === style
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {style}
              </button>
            ))}
          </div>
          
          <p className="text-xs text-gray-500 mt-2">
            {citationStyles[selectedStyle]}
          </p>
        </div>
      )}

      {/* Analysis Overview - Extract Mode Only */}
      {mode === 'extract' && analysis && (
        <div className="bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg p-6 text-white">
          <h3 className="text-xl font-bold mb-4">📊 Citation Analysis Overview</h3>
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
            <div className="bg-white bg-opacity-20 rounded-lg p-4">
              <div className="text-3xl font-bold">{analysis.citations?.length || 0}</div>
              <div className="text-sm opacity-90">In-text Citations</div>
            </div>
            
            <div className="bg-white bg-opacity-20 rounded-lg p-4">
              <div className="text-3xl font-bold">{analysis.references?.length || 0}</div>
              <div className="text-sm opacity-90">References Listed</div>
            </div>
            
            <div className="bg-white bg-opacity-20 rounded-lg p-4">
              <div className="text-3xl font-bold">{analysis.matched_count || 0}</div>
              <div className="text-sm opacity-90">Matched</div>
            </div>
            
            <div className={`bg-${getMatchStatus().color}-500 rounded-lg p-4`}>
              <div className="text-3xl font-bold">{getMatchQuality()}%</div>
              <div className="text-sm opacity-90">Match Quality</div>
            </div>
          </div>

          <div className="flex items-center justify-between text-sm border-t border-white border-opacity-30 pt-3">
            <span>⚠️ {analysis.unmatched_citations || 0} unmatched citations</span>
            <span>📕 {analysis.uncited_references || 0} uncited references</span>
          </div>
        </div>
      )}

      {/* Citations with Line Numbers - Extract Mode Only */}
      {mode === 'extract' && analysis && analysis.citations && analysis.citations.length > 0 && (
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            📑 Detected Citations
          </h3>

          <div className="space-y-3">
            {analysis.citations
              .map((citation, idx) => ({ citation, idx }))
              .filter(({ idx }) => !removedCitationIndices.has(idx))
              .slice(0, 20)
              .map(({ citation, idx }) => {
              const isMatched = analysis.mapping && analysis.mapping[idx] !== undefined
              const refIndex = isMatched ? analysis.mapping[idx] : null
              const matchedRef = refIndex !== null && analysis.references[refIndex]

              return (
                <div
                  key={idx}
                  className={`border-l-4 ${
                    isMatched ? 'border-green-500 bg-green-50' : 'border-yellow-500 bg-yellow-50'
                  } rounded-lg p-4`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        {isMatched ? (
                          <FaCheckCircle className="text-green-600" />
                        ) : (
                          <FaExclamationTriangle className="text-yellow-600" />
                        )}
                        <span className="text-xs font-mono bg-gray-200 px-2 py-1 rounded">
                          Line {citation.line}
                        </span>
                        <code className="text-sm font-semibold text-gray-900">
                          {citation.text}
                        </code>
                      </div>

                      <div className="text-sm text-gray-600 mb-2">
                        {citation.author && (
                          <span>Author: <strong>{citation.author}</strong></span>
                        )}
                        {citation.year_or_page && (
                          <span className="ml-3">
                            {citation.style_type?.includes('MLA') ? 'Page' : 'Year'}: 
                            <strong> {citation.year_or_page}</strong>
                          </span>
                        )}
                      </div>

                      {citation.context && (
                        <div className="text-xs text-gray-500 italic bg-white p-2 rounded">
                          "...{citation.context}..."
                        </div>
                      )}

                      {isMatched && matchedRef && (
                        <div className="mt-3 border-t border-green-200 pt-3">
                          <div className="flex items-center gap-2 mb-1">
                            <FaLink className="text-green-600 text-xs" />
                            <span className="text-xs font-semibold text-green-700">
                              Matched to Reference (Line {matchedRef.line}):
                            </span>
                          </div>
                          <div className="text-xs text-gray-700 bg-white p-2 rounded">
                            {matchedRef.text}
                          </div>
                        </div>
                      )}
                    </div>
                    <button
                      onClick={() => handleRemoveExtractedCitation(idx)}
                      className="ml-2 p-1 text-red-400 hover:text-red-600 hover:bg-red-50 rounded flex-shrink-0"
                      title="Remove this citation"
                    >
                      <FaTimes className="text-xs" />
                    </button>
                  </div>
                </div>
              )
            })}
          </div>

          {analysis.citations.length - removedCitationIndices.size > 20 && (
            <div className="mt-4 text-center text-sm text-gray-500">
              Showing 20 of {analysis.citations.length - removedCitationIndices.size} citations
            </div>
          )}
          {removedCitationIndices.size > 0 && (
            <div className="mt-3 text-center">
              <button
                onClick={() => setRemovedCitationIndices(new Set())}
                className="text-xs text-gray-500 hover:text-gray-700 underline"
              >
                Restore {removedCitationIndices.size} removed citation{removedCitationIndices.size !== 1 ? 's' : ''}
              </button>
            </div>
          )}
        </div>
      )}

      {/* References List - Extract Mode Only */}
      {mode === 'extract' && analysis && analysis.references && analysis.references.length > 0 && (
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            📚 Reference List
          </h3>

          <div className="space-y-3">
            {analysis.references.map((reference, idx) => {
              const citationCount = Object.values(analysis.mapping || {}).filter(
                (refIdx) => refIdx === idx
              ).length
              const isCited = citationCount > 0

              return (
                <div
                  key={idx}
                  className={`border-l-4 ${
                    isCited ? 'border-green-500 bg-green-50' : 'border-gray-300 bg-gray-50'
                  } rounded-lg p-4`}
                >
                  <div className="flex items-start gap-3">
                    <span className="text-xs font-mono bg-gray-200 px-2 py-1 rounded mt-1">
                      Line {reference.line}
                    </span>
                    <div className="flex-1">
                      <p className="text-sm text-gray-900">{reference.text}</p>
                      {isCited ? (
                        <p className="text-xs text-green-700 mt-2">
                          ✓ Cited {citationCount} time(s) in the document
                        </p>
                      ) : (
                        <p className="text-xs text-gray-500 mt-2">
                          ⚠️ Not cited in the document
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Citation-Reference Mapping Table - Extract Mode Only */}
      {mode === 'extract' && analysis && analysis.citations && analysis.references && Object.keys(analysis.mapping || {}).length > 0 && (
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            🔗 Citation-Reference Mapping
          </h3>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Citation
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Line
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Author
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                    →
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Reference
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Ref Line
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {Object.entries(analysis.mapping).map(([citIdx, refIdx]) => {
                  const citation = analysis.citations[parseInt(citIdx)]
                  const reference = analysis.references[refIdx]

                  return (
                    <tr key={citIdx} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm">
                        <code className="bg-gray-100 px-2 py-1 rounded">
                          {citation?.text}
                        </code>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {citation?.line}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900">
                        {citation?.author || 'N/A'}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <FaLink className="text-blue-500 mx-auto" />
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700">
                        {reference?.text?.substring(0, 60)}
                        {reference?.text?.length > 60 ? '...' : ''}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {reference?.line}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Unmatched Citations Warning - Extract Mode Only */}
      {mode === 'extract' && analysis && analysis.unmatched_citations > 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <FaExclamationTriangle className="text-yellow-600 mt-1" />
            <div>
              <h4 className="font-semibold text-yellow-900 mb-2">
                Unmatched Citations ({analysis.unmatched_citations})
              </h4>
              <p className="text-sm text-yellow-800">
                The following citations do not have corresponding entries in the reference list:
              </p>
              <div className="mt-2 space-y-1">
                {analysis.citations
                  .filter((_, idx) => !analysis.mapping || analysis.mapping[idx] === undefined)
                  .slice(0, 10)
                  .map((citation, idx) => (
                    <div key={idx} className="text-sm flex items-center gap-2">
                      <span className="font-mono bg-yellow-100 px-2 py-1 rounded text-xs">
                        Line {citation.line}
                      </span>
                      <code>{citation.text}</code>
                      <span className="text-gray-600">
                        ({citation.author || 'Unknown author'})
                      </span>
                    </div>
                  ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Actions - Extract Mode Only */}
      {mode === 'extract' && analysis && (
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            ✨ Actions
          </h3>

          <div className="flex gap-3">
            <button
              onClick={handleFormatDocument}
              disabled={loading}
              className="btn-primary flex-1 flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <FaSpinner className="animate-spin" />
                  Formatting...
                </>
              ) : (
                <>
                  <FaDownload />
                  Format & Download as {selectedStyle}
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default CitationManager
