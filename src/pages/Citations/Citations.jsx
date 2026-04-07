import { useState } from 'react'
import { FaQuoteRight, FaPlus, FaCopy, FaTrash, FaFileUpload } from 'react-icons/fa'
import CitationManager from '../../components/CitationManager/CitationManager'

const emptyCitation = { type: 'Book', authors: '', year: '', title: '', publisher: '' }

const formatCitationString = (c, style) => {
  const { type, authors, year, title, publisher } = c
  if (style === 'APA') return `${authors} (${year}). ${title}. ${publisher}.`
  if (style === 'MLA') return `${authors}. "${title}." ${publisher}, ${year}.`
  if (style === 'Chicago') return `${authors}. ${title}. ${publisher}, ${year}.`
  if (style === 'Harvard') return `${authors} ${year}, '${title}', ${publisher}.`
  if (style === 'IEEE') return `${authors}, "${title}," ${publisher}, ${year}.`
  return `${authors} (${year}). ${title}. ${publisher}.`
}

const Citations = () => {
  const [citations, setCitations] = useState([])
  const [selectedStyle, setSelectedStyle] = useState('APA')
  const [showAddForm, setShowAddForm] = useState(false)
  const [activeTab, setActiveTab] = useState('analyze') // 'analyze' or 'manual'
  const [newCitation, setNewCitation] = useState(emptyCitation)
  const [formError, setFormError] = useState(null)

  const styles = ['APA', 'MLA', 'Chicago', 'Harvard', 'IEEE']

  const handleCopyCitation = (citationText) => {
    navigator.clipboard.writeText(citationText)
  }

  const handleDeleteCitation = (id) => {
    if (window.confirm('Are you sure you want to delete this citation?')) {
      setCitations(citations.filter(c => c.id !== id))
    }
  }

  const handleAddCitationSubmit = () => {
    if (!newCitation.authors.trim() || !newCitation.title.trim()) {
      setFormError('Author and title are required')
      return
    }
    const citationStr = formatCitationString(newCitation, selectedStyle)
    setCitations(prev => [...prev, { ...newCitation, id: Date.now(), citation: citationStr }])
    setNewCitation(emptyCitation)
    setFormError(null)
    setShowAddForm(false)
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Citation Manager</h1>
          <p className="mt-1 text-sm text-gray-600">
            Analyze documents and manage citations with line-by-line tracking
          </p>
        </div>
        <button
          onClick={() => setShowAddForm(true)}
          className="btn-primary flex items-center gap-2"
        >
          <FaPlus />
          Add Citation
        </button>
      </div>

      {/* Tab Navigation */}
      <div className="bg-white rounded-lg border border-gray-200 mb-6">
        <div className="flex border-b border-gray-200">
          <button
            onClick={() => setActiveTab('analyze')}
            className={`flex-1 px-6 py-3 font-medium transition-colors ${
              activeTab === 'analyze'
                ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50'
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
            }`}
          >
            <div className="flex items-center justify-center gap-2">
              <FaFileUpload />
              Document Analysis
            </div>
          </button>
          <button
            onClick={() => setActiveTab('manual')}
            className={`flex-1 px-6 py-3 font-medium transition-colors ${
              activeTab === 'manual'
                ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50'
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
            }`}
          >
            <div className="flex items-center justify-center gap-2">
              <FaQuoteRight />
              Manual Citations
            </div>
          </button>
        </div>
      </div>

      {/* Tab Content */}
      {activeTab === 'analyze' ? (
        <CitationManager />
      ) : (
        <>
          {/* Style Selector */}
          <div className="bg-white p-4 rounded-lg border border-gray-200 mb-6">
            <div className="flex items-center gap-3">
              <span className="text-sm font-semibold text-gray-900">Citation Style:</span>
              <div className="flex flex-wrap gap-2">
                {styles.map((style) => (
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
            </div>
          </div>

          {/* Citations List */}
          {citations.length === 0 ? (
            <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
              <FaQuoteRight className="text-6xl text-gray-300 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-gray-900 mb-2">
                No citations yet
              </h3>
              <p className="text-gray-600 mb-6">
                Add your first citation to get started
              </p>
              <button
                onClick={() => setShowAddForm(true)}
                className="btn-primary inline-flex items-center gap-2"
              >
                <FaPlus />
                Add Citation
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {citations.map((citation) => (
                <div
                  key={citation.id}
                  className="bg-white rounded-lg border border-gray-200 p-5 hover:shadow-md transition-shadow"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <span className="px-3 py-1 bg-blue-100 text-blue-700 text-xs font-medium rounded-full">
                          {citation.type}
                        </span>
                        <span className="text-sm text-gray-600">{citation.year}</span>
                      </div>
                      
                      <h3 className="font-semibold text-gray-900 mb-1">
                        {citation.title}
                      </h3>
                      
                      <p className="text-sm text-gray-600 mb-3">
                        {citation.authors}
                      </p>
                      
                      <div className="bg-gray-50 rounded-lg p-3 mb-3">
                        <p className="text-sm text-gray-700 font-mono">
                          {formatCitationString(citation, selectedStyle)}
                        </p>
                      </div>
                    </div>

                    <div className="flex gap-2 ml-4">
                      <button
                        onClick={() => handleCopyCitation(formatCitationString(citation, selectedStyle))}
                        className="p-2 hover:bg-blue-50 rounded-lg transition-colors"
                        title="Copy Citation"
                      >
                        <FaCopy className="text-blue-600" />
                      </button>
                      <button
                        onClick={() => handleDeleteCitation(citation.id)}
                        className="p-2 hover:bg-red-50 rounded-lg transition-colors"
                        title="Delete"
                      >
                        <FaTrash className="text-red-600" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* Add Citation Modal */}
      {showAddForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-5 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-gray-900">Add Citation</h2>
                <button
                  onClick={() => setShowAddForm(false)}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  ✕
                </button>
              </div>
            </div>
            
            <div className="p-5">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Citation Type
                  </label>
                  <select
                    className="input-field w-full"
                    value={newCitation.type}
                    onChange={e => setNewCitation(p => ({ ...p, type: e.target.value }))}
                  >
                    <option>Book</option>
                    <option>Journal Article</option>
                    <option>Website</option>
                    <option>Conference Paper</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Author(s) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="Last name, First initial"
                    className="input-field w-full"
                    value={newCitation.authors}
                    onChange={e => setNewCitation(p => ({ ...p, authors: e.target.value }))}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Title <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="Title of the work"
                    className="input-field w-full"
                    value={newCitation.title}
                    onChange={e => setNewCitation(p => ({ ...p, title: e.target.value }))}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Year
                    </label>
                    <input
                      type="text"
                      placeholder="2024"
                      className="input-field w-full"
                      value={newCitation.year}
                      onChange={e => setNewCitation(p => ({ ...p, year: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Publisher/Journal
                    </label>
                    <input
                      type="text"
                      placeholder="Publisher name"
                      className="input-field w-full"
                      value={newCitation.publisher}
                      onChange={e => setNewCitation(p => ({ ...p, publisher: e.target.value }))}
                    />
                  </div>
                </div>
              </div>

              {formError && (
                <p className="mt-3 text-sm text-red-600 font-medium">{formError}</p>
              )}

              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => { setShowAddForm(false); setFormError(null); setNewCitation(emptyCitation) }}
                  className="btn-secondary flex-1"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAddCitationSubmit}
                  className="btn-primary flex-1"
                >
                  Add Citation
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default Citations
