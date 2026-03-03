import { useState, useEffect } from 'react'
import { FaUpload, FaFileAlt, FaTrash, FaDownload, FaFilter, FaSearch, FaFolderOpen, FaEdit } from 'react-icons/fa'
import { documentAPI } from '../../services/documentService'
import UploadDocument from '../../components/UploadDocument/UploadDocument'
import DocumentWorkspace from '../../components/DocumentWorkspace/DocumentWorkspace'

const Documents = () => {
  const [documents, setDocuments] = useState([])
  const [loading, setLoading] = useState(true)
  const [showUpload, setShowUpload] = useState(false)
  const [openDocument, setOpenDocument] = useState(null) // Unified workspace view
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [stats, setStats] = useState({
    total: 0,
    uploaded: 0,
    processing: 0,
    formatted: 0,
  })

  useEffect(() => {
    fetchDocuments()
    fetchStats()
  }, [statusFilter])

  const fetchDocuments = async () => {
    try {
      setLoading(true)
      const params = statusFilter !== 'all' ? { status: statusFilter } : {}
      const response = await documentAPI.getAll(params)
      setDocuments(response.data.documents)
    } catch (err) {
      console.error('Failed to fetch documents:', err)
    } finally {
      setLoading(false)
    }
  }

  const fetchStats = async () => {
    try {
      const response = await documentAPI.getStats()
      setStats(response.data.stats)
    } catch (err) {
      console.error('Failed to fetch stats:', err)
    }
  }

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this document?')) return

    try {
      await documentAPI.delete(id)
      setDocuments(documents.filter((doc) => doc._id !== id))
      fetchStats()
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to delete document')
    }
  }

  const handleUploadSuccess = (newDoc) => {
    setDocuments([newDoc, ...documents])
    fetchStats()
  }

  const handleOpenDocument = (doc) => {
    setOpenDocument(doc)
  }

  const handleDocumentUpdate = async (docId, updates) => {
    try {
      const response = await documentAPI.update(docId, updates)
      
      // Update local state
      setDocuments(
        documents.map((doc) =>
          doc._id === docId ? response.data.document : doc
        )
      )
      
      // Update open document if it's the one being edited
      if (openDocument?._id === docId) {
        setOpenDocument(response.data.document)
      }
      
      fetchStats()
    } catch (err) {
      throw new Error(err.response?.data?.message || 'Failed to update document')
    }
  }

  const handleDownload = async (doc) => {
    try {
      const response = await fetch(
        `${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/documents/${doc._id}/download`,
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem('token')}`,
          },
        }
      )

      if (!response.ok) throw new Error('Failed to download document')

      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${doc.title}.${doc.fileType}`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
    } catch (err) {
      alert(err.message || 'Failed to download document')
    }
  }

  const filteredDocuments = documents.filter((doc) =>
    doc.title.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const getStatusColor = (status) => {
    switch (status) {
      case 'uploaded':
        return 'bg-blue-100 text-blue-800'
      case 'processing':
        return 'bg-yellow-100 text-yellow-800'
      case 'formatted':
        return 'bg-green-100 text-green-800'
      case 'failed':
        return 'bg-red-100 text-red-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const getFileIcon = (fileType) => {
    switch (fileType) {
      case 'pdf':
        return '📕'
      case 'docx':
        return '📘'
      case 'txt':
        return '📄'
      default:
        return '📄'
    }
  }

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i]
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">My Documents</h1>
          <p className="mt-1 text-sm text-gray-600">
            Manage and format your research documents
          </p>
        </div>
        <button
          onClick={() => setShowUpload(true)}
          className="btn-primary flex items-center gap-2"
        >
          <FaUpload />
          Upload Document
        </button>
      </div>
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white p-5 rounded-lg border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Documents</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{stats.total}</p>
            </div>
            <div className="p-3 bg-blue-100 rounded-lg">
              <FaFileAlt className="text-xl text-blue-600" />
            </div>
          </div>
        </div>

        <div className="bg-white p-5 rounded-lg border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Uploaded</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{stats.uploaded}</p>
            </div>
            <div className="p-3 bg-blue-100 rounded-lg">
              <FaUpload className="text-xl text-blue-600" />
            </div>
          </div>
        </div>

        <div className="bg-white p-5 rounded-lg border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Processing</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{stats.processing}</p>
            </div>
            <div className="p-3 bg-yellow-100 rounded-lg">
              <FaEdit className="text-xl text-yellow-600" />
            </div>
          </div>
        </div>

        <div className="bg-white p-5 rounded-lg border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Formatted</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{stats.formatted}</p>
            </div>
            <div className="p-3 bg-green-100 rounded-lg">
              <FaFileAlt className="text-xl text-green-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Filters and Search */}
      <div className="bg-white p-4 rounded-lg border border-gray-200 mb-6">
        <div className="flex flex-col sm:flex-row gap-4">
          {/* Search */}
          <div className="flex-1 relative">
            <FaSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search documents..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* Status Filter */}
          <div className="sm:w-64">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">All Status</option>
              <option value="uploaded">Uploaded</option>
              <option value="processing">Processing</option>
              <option value="formatted">Formatted</option>
              <option value="failed">Failed</option>
            </select>
          </div>
        </div>
        </div>

      {/* Documents List */}
      {loading ? (
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          <p className="mt-4 text-gray-600">Loading documents...</p>
        </div>
      ) : filteredDocuments.length === 0 ? (
        <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
          <FaFileAlt className="text-6xl text-gray-300 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-gray-900 mb-2">No documents found</h3>
          <p className="text-gray-600 mb-6">
            {searchQuery
              ? 'Try adjusting your search query'
              : 'Upload your first document to get started'}
          </p>
          {!searchQuery && (
            <button
              onClick={() => setShowUpload(true)}
              className="btn-primary inline-flex items-center gap-2"
            >
              <FaUpload />
              Upload Document
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {filteredDocuments.map((doc) => (
            <div
              key={doc._id}
              className="bg-white rounded-lg border border-gray-200 p-5 hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-4 flex-1">
                  <div className="text-4xl">{getFileIcon(doc.fileType)}</div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-lg font-semibold text-gray-900 mb-1">
                      {doc.title}
                    </h3>
                    <div className="flex flex-wrap items-center gap-2 text-sm text-gray-600">
                      <span className="flex items-center gap-1">
                        📄 {doc.fileType.toUpperCase()}
                      </span>
                      <span>•</span>
                      <span>{formatFileSize(doc.fileSize)}</span>
                      <span>•</span>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(doc.status)}`}>
                        {doc.status}
                      </span>
                      {doc.formatting?.style && (
                        <>
                          <span>•</span>
                          <span>📝 {doc.formatting.style}</span>
                        </>
                      )}
                    </div>
                    <p className="text-sm text-gray-500 mt-2">
                      Uploaded {new Date(doc.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 ml-4">
                  <button
                    onClick={() => handleOpenDocument(doc)}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors flex items-center gap-2 font-medium"
                    title="Open Document Workspace"
                  >
                    <FaFolderOpen />
                    Open
                  </button>
                  <button
                    onClick={() => handleDownload(doc)}
                    className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                    title="Download"
                  >
                    <FaDownload className="text-gray-600" />
                  </button>
                  <button
                    onClick={() => handleDelete(doc._id)}
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

      {/* Upload Modal */}
      {showUpload && (
        <UploadDocument
          onClose={() => setShowUpload(false)}
          onUploadSuccess={handleUploadSuccess}
        />
      )}

      {/* Unified Document Workspace */}
      {openDocument && (
        <DocumentWorkspace
          document={openDocument}
          onClose={() => setOpenDocument(null)}
          onDocumentUpdate={handleDocumentUpdate}
        />
      )}
    </div>
  )
}

export default Documents
