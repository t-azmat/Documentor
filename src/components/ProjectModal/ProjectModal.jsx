import { useState } from 'react'
import { FaTimes, FaFolderPlus } from 'react-icons/fa'
import { projectAPI } from '../../services/documentService'

const ProjectModal = ({ onClose, onSuccess, editProject = null }) => {
  const [formData, setFormData] = useState({
    name: editProject?.name || '',
    description: editProject?.description || '',
    category: editProject?.category || 'research-paper',
    color: editProject?.color || '#3B82F6',
    deadline: editProject?.deadline ? new Date(editProject.deadline).toISOString().split('T')[0] : '',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const categories = [
    { value: 'thesis', label: 'Thesis', icon: '📚' },
    { value: 'research-paper', label: 'Research Paper', icon: '📄' },
    { value: 'conference', label: 'Conference Paper', icon: '🎤' },
    { value: 'journal', label: 'Journal Article', icon: '📰' },
    { value: 'coursework', label: 'Coursework', icon: '✏️' },
    { value: 'other', label: 'Other', icon: '📁' },
  ]

  const colors = [
    '#3B82F6', // Blue
    '#10B981', // Green
    '#F59E0B', // Yellow
    '#EF4444', // Red
    '#8B5CF6', // Purple
    '#EC4899', // Pink
    '#06B6D4', // Cyan
    '#F97316', // Orange
  ]

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    })
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      let response
      if (editProject) {
        response = await projectAPI.update(editProject._id, formData)
      } else {
        response = await projectAPI.create(formData)
      }
      
      onSuccess?.(response.data.project)
      onClose()
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to save project')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl max-w-2xl w-full mx-4">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <FaFolderPlus className="text-primary-600 text-2xl" />
            <h2 className="text-2xl font-bold text-gray-900">
              {editProject ? 'Edit Project' : 'Create New Project'}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <FaTimes className="text-gray-600" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
              {error}
            </div>
          )}

          {/* Project Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Project Name *
            </label>
            <input
              type="text"
              name="name"
              value={formData.name}
              onChange={handleChange}
              placeholder="e.g., Machine Learning Research"
              className="input-field"
              required
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Description
            </label>
            <textarea
              name="description"
              value={formData.description}
              onChange={handleChange}
              placeholder="Brief description of your project..."
              rows="3"
              className="input-field resize-none"
            />
          </div>

          {/* Category */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">
              Category *
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {categories.map((cat) => (
                <label
                  key={cat.value}
                  className={`relative flex items-center gap-3 p-3 border-2 rounded-lg cursor-pointer transition-all ${
                    formData.category === cat.value
                      ? 'border-primary-500 bg-primary-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <input
                    type="radio"
                    name="category"
                    value={cat.value}
                    checked={formData.category === cat.value}
                    onChange={handleChange}
                    className="sr-only"
                  />
                  <span className="text-2xl">{cat.icon}</span>
                  <span className="text-sm font-medium text-gray-900">
                    {cat.label}
                  </span>
                </label>
              ))}
            </div>
          </div>

          {/* Color */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">
              Project Color
            </label>
            <div className="flex gap-3 flex-wrap">
              {colors.map((color) => (
                <label
                  key={color}
                  className="relative cursor-pointer"
                >
                  <input
                    type="radio"
                    name="color"
                    value={color}
                    checked={formData.color === color}
                    onChange={handleChange}
                    className="sr-only"
                  />
                  <div
                    className={`w-10 h-10 rounded-full transition-transform ${
                      formData.color === color
                        ? 'ring-2 ring-offset-2 ring-gray-400 scale-110'
                        : 'hover:scale-105'
                    }`}
                    style={{ backgroundColor: color }}
                  />
                </label>
              ))}
            </div>
          </div>

          {/* Deadline */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Deadline (Optional)
            </label>
            <input
              type="date"
              name="deadline"
              value={formData.deadline}
              onChange={handleChange}
              className="input-field"
              min={new Date().toISOString().split('T')[0]}
            />
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="btn-secondary flex-1"
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn-primary flex-1"
              disabled={loading}
            >
              {loading ? 'Saving...' : editProject ? 'Update Project' : 'Create Project'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default ProjectModal
