import { useState } from 'react'
import { FaTimes, FaEdit, FaSave } from 'react-icons/fa'

const DocumentEditor = ({ document, onClose, onSave }) => {
  const [title, setTitle] = useState(document.title)
  const [content, setContent] = useState(document.content?.raw || '')
  const [formattingStyle, setFormattingStyle] = useState(document.formatting?.style || 'APA')
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    setSaving(true)
    try {
      await onSave({
        title,
        content,
        formattingStyle,
      })
      onClose()
    } catch (error) {
      alert('Failed to save changes')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl max-w-5xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <FaEdit className="text-2xl text-primary-600" />
            <h2 className="text-2xl font-bold text-gray-900">Edit Document</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <FaTimes className="text-gray-600" />
          </button>
        </div>

        {/* Editor */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="space-y-6">
            {/* Title */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Document Title
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
            </div>

            {/* Formatting Style */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Formatting Style
              </label>
              <select
                value={formattingStyle}
                onChange={(e) => setFormattingStyle(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              >
                <option value="APA">APA (7th Edition)</option>
                <option value="MLA">MLA (9th Edition)</option>
                <option value="IEEE">IEEE</option>
                <option value="Chicago">Chicago</option>
                <option value="Harvard">Harvard</option>
              </select>
            </div>

            {/* Content */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Content
              </label>
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                rows={20}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent font-mono text-sm resize-none"
                placeholder="Enter your document content..."
              />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-gray-200 p-4 flex gap-3">
          <button onClick={onClose} className="btn-secondary flex-1">
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="btn-primary flex-1 flex items-center justify-center gap-2"
          >
            {saving ? (
              <>
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                Saving...
              </>
            ) : (
              <>
                <FaSave />
                Save Changes
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}

export default DocumentEditor
