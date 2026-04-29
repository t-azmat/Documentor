import { useState, useEffect } from 'react'
import { 
  FaTimes, FaEdit, FaEye, FaSpellCheck, FaSearch, 
  FaQuoteRight, FaAlignLeft, FaListOl,
  FaSave, FaDownload, FaFileAlt, FaRobot
} from 'react-icons/fa'
import GrammarChecker from '../GrammarChecker/GrammarChecker'
import PlagiarismDetector from '../PlagiarismChecker/PlagiarismDetector'
import AIDetector from '../AIDetector/AIDetector'
import CitationManager from '../CitationManager/CitationManager'
import FormatDocument from '../FormatDocument/FormatDocument'
import SectionDetector from '../NLPAnalysis/SectionDetector'
import DocumentRenderer from '../DocumentRenderer/DocumentRenderer'
import { documentAPI } from '../../services/documentService'

const DocumentWorkspace = ({ document, onClose, onDocumentUpdate }) => {
  const [viewMode, setViewMode] = useState('view') // 'view' or 'edit'
  const [activeTool, setActiveTool] = useState(null) // which tool modal is open
  const [editedContent, setEditedContent] = useState(document.content?.raw || '')
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
  const [fullDocument, setFullDocument] = useState(document)
  const [isLoadingDocument, setIsLoadingDocument] = useState(false)

  const documentId = document?._id

  useEffect(() => {
    setEditedContent(document?.content?.raw || '')
    if (documentId) {
      fetchFullDocument(documentId)
    } else if (document) {
      setFullDocument(document)
    }
  }, [documentId])

  const fetchFullDocument = async (docId) => {
    try {
      if (!docId) {
        console.warn('[DocumentWorkspace] No document ID available')
        setFullDocument(document)
        return
      }
      setIsLoadingDocument(true)
      const response = await documentAPI.getOne(docId)
      setFullDocument(response.data.document)
    } catch (error) {
      console.error('Failed to fetch full document:', error)
      setFullDocument(document)
    } finally {
      setIsLoadingDocument(false)
    }
  }

  const handleContentChange = (e) => {
    setEditedContent(e.target.value)
    setHasUnsavedChanges(true)
  }

  const handleSaveChanges = async () => {
    try {
      if (!document?._id) {
        throw new Error('Cannot save: document ID is missing')
      }
      await onDocumentUpdate(document._id, { 'content.raw': editedContent })
      setHasUnsavedChanges(false)
      setViewMode('view')
    } catch (error) {
      console.error('Failed to save changes:', error)
      alert('Failed to save changes: ' + error.message)
    }
  }

  const handleDownload = () => {
    const blob = new Blob([editedContent], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = window.document.createElement('a')
    a.href = url
    a.download = `${document.title}.txt`
    window.document.body.appendChild(a)
    a.click()
    window.document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const handleGrammarApply = async (enhancedText) => {
    setEditedContent(enhancedText)
    setHasUnsavedChanges(true)
    setActiveTool(null)
    setViewMode('edit')
  }

  const handleFormatSuccess = async (updatedDoc) => {
    if (updatedDoc.content?.formatted) {
      setEditedContent(updatedDoc.content.formatted)
      setHasUnsavedChanges(true)
      setActiveTool(null)
      setViewMode('edit')
    }
    // Notify parent to refresh document list
    if (onDocumentUpdate && document?._id) {
      try {
        await onDocumentUpdate(document._id, { 'content.formatted': updatedDoc.content?.formatted })
      } catch (error) {
        console.error('Failed to update document:', error)
      }
    }
  }

  const tools = [
    { id: 'grammar', name: 'Grammar Enhancer', icon: FaSpellCheck, color: 'bg-blue-600', hoverColor: 'hover:bg-blue-700' },
    { id: 'plagiarism', name: 'Plagiarism Detector', icon: FaSearch, color: 'bg-red-600', hoverColor: 'hover:bg-red-700' },
    { id: 'ai-detect', name: 'AI Detector', icon: FaRobot, color: 'bg-purple-600', hoverColor: 'hover:bg-purple-700' },
    { id: 'citations', name: 'Citation Analysis', icon: FaQuoteRight, color: 'bg-purple-600', hoverColor: 'hover:bg-purple-700' },
    { id: 'format', name: 'Format Document', icon: FaAlignLeft, color: 'bg-green-600', hoverColor: 'hover:bg-green-700' },
    { id: 'sections', name: 'Section Detector', icon: FaListOl, color: 'bg-orange-600', hoverColor: 'hover:bg-orange-700' }
  ]

  const currentDoc = { ...document, content: { raw: editedContent } }

  return (
    <>
      {/* Main Document Workspace */}
      <div className="fixed inset-0 bg-gray-900 bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl max-w-7xl w-full h-[95vh] flex flex-col shadow-2xl">
        {/* Header with Tools */}
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-6 py-4 rounded-t-xl">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <FaFileAlt className="text-2xl" />
              <div>
                <h2 className="text-xl font-bold">{document.title || 'Untitled'}</h2>
                <p className="text-sm text-blue-100">
                  {(document.fileType || 'file').toUpperCase()} • {((document.fileSize || 0) / 1024).toFixed(1)} KB
                  {hasUnsavedChanges && ' • Unsaved changes'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {/* View/Edit Toggle */}
              <div className="flex bg-blue-700 rounded-lg p-1">
                <button
                  onClick={() => setViewMode('view')}
                  className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                    viewMode === 'view'
                      ? 'bg-white text-blue-600'
                      : 'text-white hover:bg-blue-600'
                  }`}
                >
                  <FaEye className="inline mr-1" />
                  View
                </button>
                <button
                  onClick={() => setViewMode('edit')}
                  className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                    viewMode === 'edit'
                      ? 'bg-white text-blue-600'
                      : 'text-white hover:bg-blue-600'
                  }`}
                >
                  <FaEdit className="inline mr-1" />
                  Edit
                </button>
              </div>

              {hasUnsavedChanges && (
                <button
                  onClick={handleSaveChanges}
                  className="px-4 py-2 bg-white text-blue-600 hover:bg-blue-50 rounded-lg transition-colors flex items-center gap-2 font-medium"
                >
                  <FaSave />
                  Save
                </button>
              )}
              
              <button
                onClick={handleDownload}
                className="px-4 py-2 bg-white text-blue-600 hover:bg-blue-50 rounded-lg transition-colors flex items-center gap-2 font-medium"
              >
                <FaDownload />
                Download
              </button>

              <button
                onClick={onClose}
                className="p-2 hover:bg-blue-700 rounded-lg transition-colors"
              >
                <FaTimes className="text-xl" />
              </button>
            </div>
          </div>

          {/* Tool Buttons */}
          <div className="flex flex-wrap gap-2">
            {tools.map((tool) => {
              const Icon = tool.icon
              return (
                <button
                  key={tool.id}
                  onClick={() => setActiveTool(tool.id)}
                  className={`${tool.color} ${tool.hoverColor} text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2`}
                >
                  <Icon />
                  {tool.name}
                </button>
              )
            })}
          </div>
        </div>

        {/* Document Content */}
        <div className="flex-1 overflow-y-auto p-6 bg-gray-50">
          {viewMode === 'edit' ? (
            <textarea
              value={editedContent}
              onChange={handleContentChange}
              className="w-full h-full min-h-[500px] p-6 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none font-mono text-sm bg-white"
              placeholder="Enter document content..."
            />
          ) : (
            <div className="bg-white p-8 rounded-lg border border-gray-200 min-h-[500px]">
              <div className="prose max-w-none">
                {isLoadingDocument ? (
                  <div className="text-center py-8 text-gray-500">Loading document...</div>
                ) : (
                  <DocumentRenderer document={fullDocument} />
                )}
              </div>
            </div>
          )}
        </div>
      </div>
      </div>

      {/* Tool Modals */}
      {activeTool === 'grammar' && document?._id && (
        <GrammarChecker
          text={editedContent}
          documentId={document._id}
          onClose={() => setActiveTool(null)}
          onApplyChanges={handleGrammarApply}
        />
      )}

      {activeTool === 'plagiarism' && (
        <PlagiarismDetector
          document={currentDoc}
          onClose={() => setActiveTool(null)}
        />
      )}

      {activeTool === 'ai-detect' && (
        <AIDetector
          document={currentDoc}
          onClose={() => setActiveTool(null)}
        />
      )}

      {activeTool === 'citations' && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-xl max-w-7xl w-full max-h-[95vh] overflow-hidden flex flex-col">
            <div className="bg-gradient-to-r from-purple-600 to-pink-600 text-white p-6 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <FaQuoteRight className="text-2xl" />
                <div>
                  <h2 className="text-2xl font-bold">Citation Analysis</h2>
                  <p className="text-sm text-purple-100 mt-1">{document.title}</p>
                </div>
              </div>
              <button
                onClick={() => setActiveTool(null)}
                className="p-2 hover:bg-purple-700 rounded-lg transition-colors"
              >
                <FaTimes className="text-xl" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-6 bg-gray-50">
              <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-sm text-blue-800">
                  <strong>Note:</strong> You can upload a file below or paste text to analyze citations for this document: <strong>{document.title}</strong>
                </p>
              </div>
              <CitationManager document={document} />
            </div>
          </div>
        </div>
      )}

      {activeTool === 'format' && (
        <FormatDocument
          document={currentDoc}
          onFormatSuccess={handleFormatSuccess}
          onClose={() => setActiveTool(null)}
        />
      )}


      {activeTool === 'sections' && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-xl max-w-6xl w-full max-h-[95vh] overflow-hidden flex flex-col">
            <div className="bg-gradient-to-r from-orange-600 to-red-600 text-white p-6 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <FaListOl className="text-2xl" />
                <div>
                  <h2 className="text-2xl font-bold">Section Detector</h2>
                  <p className="text-sm text-orange-100 mt-1">{document.title}</p>
                </div>
              </div>
              <button
                onClick={() => setActiveTool(null)}
                className="p-2 hover:bg-orange-700 rounded-lg transition-colors"
              >
                <FaTimes className="text-xl" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-6 bg-gray-50">
              <SectionDetector 
                document={currentDoc} 
                onClose={() => setActiveTool(null)}
                onExtractSuccess={(extracted) => {
                  // Handle extracted sections if needed
                  console.log('Sections extracted:', extracted)
                }}
              />
            </div>
          </div>
        </div>
      )}
    </>
  )
}

export default DocumentWorkspace
