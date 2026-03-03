import { useState, useEffect } from 'react'
import { collection, addDoc, getDocs, updateDoc, deleteDoc, doc } from 'firebase/firestore'
import { db } from '../../config/firebase'
import { FaPlus, FaEdit, FaTrash, FaSave, FaTimes, FaFileAlt } from 'react-icons/fa'

const StyleTemplates = () => {
  const [templates, setTemplates] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [formData, setFormData] = useState({
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
  })

  useEffect(() => {
    fetchTemplates()
  }, [])

  const fetchTemplates = async () => {
    try {
      const querySnapshot = await getDocs(collection(db, 'styleTemplates'))
      const templatesData = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }))
      setTemplates(templatesData)
    } catch (error) {
      console.error('Error fetching templates:', error)
      alert('Failed to load templates')
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    try {
      if (editingId) {
        await updateDoc(doc(db, 'styleTemplates', editingId), {
          ...formData,
          updatedAt: new Date().toISOString()
        })
        alert('Template updated successfully!')
      } else {
        await addDoc(collection(db, 'styleTemplates'), {
          ...formData,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        })
        alert('Template created successfully!')
      }
      resetForm()
      fetchTemplates()
    } catch (error) {
      console.error('Error saving template:', error)
      alert('Failed to save template')
    }
  }

  const handleEdit = (template) => {
    setFormData({
      name: template.name,
      type: template.type,
      rules: template.rules,
      description: template.description
    })
    setEditingId(template.id)
    setShowForm(true)
  }

  const handleDelete = async (id) => {
    if (!confirm('Are you sure you want to delete this template?')) return
    
    try {
      await deleteDoc(doc(db, 'styleTemplates', id))
      alert('Template deleted successfully!')
      fetchTemplates()
    } catch (error) {
      console.error('Error deleting template:', error)
      alert('Failed to delete template')
    }
  }

  const resetForm = () => {
    setFormData({
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
    })
    setEditingId(null)
    setShowForm(false)
  }

  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
        <p className="text-gray-600">Loading templates...</p>
      </div>
    )
  }

  return (
    <div>
      {/* Header Actions */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Style Templates</h2>
          <p className="text-sm text-gray-600 mt-1">{templates.length} template(s) available</p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="btn-primary flex items-center gap-2"
        >
          {showForm ? <FaTimes /> : <FaPlus />}
          {showForm ? 'Cancel' : 'Add Template'}
        </button>
      </div>

      {/* Form */}
      {showForm && (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-6 mb-6">
          <h3 className="font-semibold text-gray-900 mb-4">
            {editingId ? 'Edit Template' : 'New Template'}
          </h3>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Template Name
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="e.g., APA 7th Edition"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Type
                </label>
                <select
                  value={formData.type}
                  onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option>APA 7</option>
                  <option>MLA 9</option>
                  <option>Chicago 17</option>
                  <option>IEEE</option>
                  <option>Harvard</option>
                  <option>Vancouver</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Description
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                rows="2"
                placeholder="Brief description of this style template"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Title Format
                </label>
                <input
                  type="text"
                  value={formData.rules.titleFormat}
                  onChange={(e) => setFormData({ 
                    ...formData, 
                    rules: { ...formData.rules, titleFormat: e.target.value }
                  })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="e.g., Bold, Centered, Title Case"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Heading Format
                </label>
                <input
                  type="text"
                  value={formData.rules.headingFormat}
                  onChange={(e) => setFormData({ 
                    ...formData, 
                    rules: { ...formData.rules, headingFormat: e.target.value }
                  })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="e.g., Bold, Left-aligned"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Citation Format
                </label>
                <input
                  type="text"
                  value={formData.rules.citationFormat}
                  onChange={(e) => setFormData({ 
                    ...formData, 
                    rules: { ...formData.rules, citationFormat: e.target.value }
                  })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="e.g., (Author, Year)"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Reference Format
                </label>
                <input
                  type="text"
                  value={formData.rules.referenceFormat}
                  onChange={(e) => setFormData({ 
                    ...formData, 
                    rules: { ...formData.rules, referenceFormat: e.target.value }
                  })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="e.g., Hanging indent, alphabetical"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Margins
                </label>
                <input
                  type="text"
                  value={formData.rules.margins}
                  onChange={(e) => setFormData({ 
                    ...formData, 
                    rules: { ...formData.rules, margins: e.target.value }
                  })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="e.g., 1 inch all sides"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Font Size
                </label>
                <input
                  type="text"
                  value={formData.rules.fontSize}
                  onChange={(e) => setFormData({ 
                    ...formData, 
                    rules: { ...formData.rules, fontSize: e.target.value }
                  })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="e.g., 12pt Times New Roman"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Line Spacing
                </label>
                <input
                  type="text"
                  value={formData.rules.lineSpacing}
                  onChange={(e) => setFormData({ 
                    ...formData, 
                    rules: { ...formData.rules, lineSpacing: e.target.value }
                  })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="e.g., Double-spaced"
                />
              </div>
            </div>

            <div className="flex gap-3 pt-4">
              <button type="button" onClick={resetForm} className="btn-secondary">
                Cancel
              </button>
              <button type="submit" className="btn-primary flex items-center gap-2">
                <FaSave />
                {editingId ? 'Update Template' : 'Create Template'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Templates List */}
      <div className="space-y-4">
        {templates.length === 0 ? (
          <div className="text-center py-12 bg-gray-50 border border-gray-200 rounded-lg">
            <FaFileAlt className="text-5xl text-gray-300 mx-auto mb-3" />
            <p className="text-gray-600">No style templates yet</p>
            <p className="text-sm text-gray-500 mt-1">Click "Add Template" to create one</p>
          </div>
        ) : (
          templates.map(template => (
            <div key={template.id} className="bg-white border border-gray-200 rounded-lg p-5 hover:shadow-sm transition-shadow">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-lg font-semibold text-gray-900">{template.name}</h3>
                    <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs font-medium rounded">
                      {template.type}
                    </span>
                  </div>
                  {template.description && (
                    <p className="text-sm text-gray-600 mb-3">{template.description}</p>
                  )}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                    {template.rules.titleFormat && (
                      <div>
                        <span className="font-medium text-gray-700">Title:</span>
                        <span className="text-gray-600 ml-1">{template.rules.titleFormat}</span>
                      </div>
                    )}
                    {template.rules.citationFormat && (
                      <div>
                        <span className="font-medium text-gray-700">Citation:</span>
                        <span className="text-gray-600 ml-1">{template.rules.citationFormat}</span>
                      </div>
                    )}
                    {template.rules.fontSize && (
                      <div>
                        <span className="font-medium text-gray-700">Font:</span>
                        <span className="text-gray-600 ml-1">{template.rules.fontSize}</span>
                      </div>
                    )}
                    {template.rules.lineSpacing && (
                      <div>
                        <span className="font-medium text-gray-700">Spacing:</span>
                        <span className="text-gray-600 ml-1">{template.rules.lineSpacing}</span>
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex gap-2 ml-4">
                  <button
                    onClick={() => handleEdit(template)}
                    className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                    title="Edit"
                  >
                    <FaEdit />
                  </button>
                  <button
                    onClick={() => handleDelete(template.id)}
                    className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    title="Delete"
                  >
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
