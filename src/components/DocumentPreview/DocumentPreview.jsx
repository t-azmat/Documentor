import { FaTimes } from 'react-icons/fa'

const DocumentPreview = ({ document, onClose }) => {
  const fileUrl = `${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/documents/${document._id}/view`
  const token = localStorage.getItem('token')
  
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl max-w-5xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">{document.title}</h2>
            <div className="flex items-center gap-3 mt-2 text-sm text-gray-600">
              <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                document.status === 'formatted'
                  ? 'bg-green-100 text-green-800'
                  : 'bg-blue-100 text-blue-800'
              }`}>
                {document.status}
              </span>
              {document.formatting?.style && (
                <span>Style: {document.formatting.style}</span>
              )}
              <span>•</span>
              <span>{document.fileType?.toUpperCase()}</span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <FaTimes className="text-gray-600" />
          </button>
        </div>

        {/* Preview Content */}
        <div className="flex-1 overflow-hidden bg-gray-900">
          {document.fileType === 'pdf' || document.fileType === 'txt' || document.fileType === 'docx' ? (
            <iframe
              src={`${fileUrl}?token=${token}`}
              className="w-full h-full bg-white"
              title={document.title}
            />
          ) : (
            <div className="flex items-center justify-center h-full">
              <div className="text-center text-white bg-gray-800 p-8 rounded-lg">
                <p className="mb-4">Preview not available for {document.fileType.toUpperCase()} files</p>
                <p className="text-sm text-gray-400 mb-6">
                  Please download the file to view it in an appropriate application
                </p>
                <button
                  onClick={onClose}
                  className="btn-secondary"
                >
                  Close
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="border-t border-gray-200 p-4 flex gap-3">
          <button onClick={onClose} className="btn-secondary flex-1">
            Close
          </button>
        </div>
      </div>
    </div>
  )
}

export default DocumentPreview
