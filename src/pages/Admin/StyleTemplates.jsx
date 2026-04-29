import { useEffect, useState } from 'react'
import { FaPlus, FaEdit, FaTrash, FaSave, FaTimes, FaFileAlt } from 'react-icons/fa'
import { adminAPI } from '../../services/api'

const emptyForm = {
  name: '',
  type: 'APA 7',
  rules: {
    titleFormat: '',
    headingFormat: '',
    citationFormat: '',
    referenceFormat: '',
    margins: '',
    fontSize: '',
    lineSpacing: '',
  },
  description: ''
}

const StyleTemplates = () => {
  const [templates, setTemplates] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [formData, setFormData] = useState(emptyForm)

  const fetchTemplates = async () => {
    try {
      const response = await adminAPI.getTemplates()
      setTemplates(response.data.templates || [])
    } catch (error) {
      console.error('Error fetching templates:', error)
      alert(error.response?.data?.message || 'Failed to load templates')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchTemplates()
  }, [])

  const resetForm = () => {
    setFormData(emptyForm)
    setEditingId(null)
    setShowForm(false)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    try {
      if (editingId) {
        await adminAPI.updateTemplate(editingId, formData)
      } else {
        await adminAPI.createTemplate(formData)
      }
      resetForm()
      fetchTemplates()
    } catch (error) {
      console.error('Error saving template:', error)
      alert(error.response?.data?.message || 'Failed to save template')
    }
  }

  const handleEdit = (template) => {
    setFormData({
      name: template.name || '',
      type: template.type || 'APA 7',
      description: template.description || '',
      rules: {
        titleFormat: template.rules?.titleFormat || '',
        headingFormat: template.rules?.headingFormat || '',
        citationFormat: template.rules?.citationFormat || '',
        referenceFormat: template.rules?.referenceFormat || '',
        margins: template.rules?.margins || '',
        fontSize: template.rules?.fontSize || '',
        lineSpacing: template.rules?.lineSpacing || ''
      }
    })
    setEditingId(template.id || template._id)
    setShowForm(true)
  }

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this template?')) return
    try {
      await adminAPI.deleteTemplate(id)
      fetchTemplates()
    } catch (error) {
      console.error('Error deleting template:', error)
      alert(error.response?.data?.message || 'Failed to delete template')
    }
  }

  if (loading) {
    return <div className="py-12 text-center text-gray-600">Loading templates...</div>
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Style Templates</h2>
          <p className="mt-1 text-sm text-gray-600">{templates.length} template(s) available</p>
        </div>
        <button
          onClick={() => setShowForm((value) => !value)}
          className="btn-primary flex items-center gap-2"
        >
          {showForm ? <FaTimes /> : <FaPlus />}
          {showForm ? 'Cancel' : 'Add Template'}
        </button>
      </div>

      {showForm && (
        <div className="mb-6 rounded-lg border border-gray-200 bg-gray-50 p-6">
          <h3 className="mb-4 font-semibold text-gray-900">
            {editingId ? 'Edit Template' : 'New Template'}
          </h3>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full rounded-lg border border-gray-300 px-3 py-2"
                placeholder="Template name"
                required
              />
              <select
                value={formData.type}
                onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                className="w-full rounded-lg border border-gray-300 px-3 py-2"
              >
                <option>APA 7</option>
                <option>MLA 9</option>
                <option>Chicago 17</option>
                <option>IEEE</option>
                <option>Harvard</option>
                <option>Vancouver</option>
              </select>
            </div>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full rounded-lg border border-gray-300 px-3 py-2"
              rows="2"
              placeholder="Brief description"
            />
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {Object.entries(formData.rules).map(([key, value]) => (
                <input
                  key={key}
                  type="text"
                  value={value}
                  onChange={(e) => setFormData({
                    ...formData,
                    rules: { ...formData.rules, [key]: e.target.value }
                  })}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2"
                  placeholder={key}
                />
              ))}
            </div>
            <div className="flex gap-3 pt-2">
              <button type="button" onClick={resetForm} className="btn-secondary">Cancel</button>
              <button type="submit" className="btn-primary flex items-center gap-2">
                <FaSave />
                {editingId ? 'Update Template' : 'Create Template'}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="space-y-4">
        {templates.length === 0 ? (
          <div className="rounded-lg border border-gray-200 bg-gray-50 py-12 text-center">
            <FaFileAlt className="mx-auto mb-3 text-5xl text-gray-300" />
            <p className="text-gray-600">No style templates yet</p>
          </div>
        ) : (
          templates.map((template) => (
            <div key={template.id || template._id} className="rounded-lg border border-gray-200 bg-white p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="mb-2 flex items-center gap-3">
                    <h3 className="text-lg font-semibold text-gray-900">{template.name}</h3>
                    <span className="rounded bg-blue-100 px-2 py-1 text-xs font-medium text-blue-700">
                      {template.type}
                    </span>
                  </div>
                  {template.description ? <p className="mb-3 text-sm text-gray-600">{template.description}</p> : null}
                  <div className="grid grid-cols-2 gap-3 text-sm md:grid-cols-4">
                    {Object.entries(template.rules || {}).filter(([, value]) => value).slice(0, 4).map(([key, value]) => (
                      <div key={key}>
                        <span className="font-medium text-gray-700">{key}:</span>
                        <span className="ml-1 text-gray-600">{value}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => handleEdit(template)} className="rounded-lg p-2 text-blue-600 hover:bg-blue-50">
                    <FaEdit />
                  </button>
                  <button onClick={() => handleDelete(template.id || template._id)} className="rounded-lg p-2 text-red-600 hover:bg-red-50">
                    <FaTrash />
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

export default StyleTemplates
