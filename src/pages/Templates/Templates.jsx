import { useState } from 'react'
import { FaBook, FaFileAlt, FaDownload, FaEye } from 'react-icons/fa'

const Templates = () => {
  const [selectedStyle, setSelectedStyle] = useState('all')
  const [previewTemplate, setPreviewTemplate] = useState(null)

  const templates = [
    {
      id: 1,
      name: 'APA 7th Edition',
      style: 'APA',
      description: 'American Psychological Association format for social sciences',
      features: ['Title Page', 'Running Head', 'In-text Citations', 'Reference List'],
      preview: 'https://via.placeholder.com/400x500?text=APA+Template',
      color: '#3B82F6',
    },
    {
      id: 2,
      name: 'MLA 9th Edition',
      style: 'MLA',
      description: 'Modern Language Association format for humanities',
      features: ['Header with Last Name', 'Works Cited', 'In-text Citations', 'Double-spaced'],
      preview: 'https://via.placeholder.com/400x500?text=MLA+Template',
      color: '#10B981',
    },
    {
      id: 3,
      name: 'IEEE Standard',
      style: 'IEEE',
      description: 'Institute of Electrical and Electronics Engineers format',
      features: ['Numbered Citations', 'Reference List', 'Two-column Layout', 'Technical Format'],
      preview: 'https://via.placeholder.com/400x500?text=IEEE+Template',
      color: '#F59E0B',
    },
    {
      id: 4,
      name: 'Chicago Style',
      style: 'Chicago',
      description: 'Chicago Manual of Style for various disciplines',
      features: ['Notes-Bibliography', 'Footnotes', 'Bibliography', 'Author-Date System'],
      preview: 'https://via.placeholder.com/400x500?text=Chicago+Template',
      color: '#EF4444',
    },
    {
      id: 5,
      name: 'Harvard Referencing',
      style: 'Harvard',
      description: 'Harvard style used in many universities',
      features: ['Author-Date Citations', 'Reference List', 'In-text Citations', 'Alphabetical Order'],
      preview: 'https://via.placeholder.com/400x500?text=Harvard+Template',
      color: '#8B5CF6',
    },
  ]

  const styles = ['all', 'APA', 'MLA', 'IEEE', 'Chicago', 'Harvard']

  const filteredTemplates =
    selectedStyle === 'all'
      ? templates
      : templates.filter((t) => t.style === selectedStyle)

  const handleApplyTemplate = (template) => {
    alert(`Template "${template.name}" will be applied to your document`)
    // TODO: Implement template application logic
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Formatting Templates</h1>
        <p className="mt-1 text-sm text-gray-600">
          Browse and apply professional formatting templates to your documents
        </p>
      </div>
      {/* Style Filter */}
      <div className="bg-white p-4 rounded-lg border border-gray-200 mb-6">
        <h2 className="text-base font-semibold text-gray-900 mb-3">
          Filter by Style
        </h2>
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
              {style === 'all' ? 'All Templates' : style}
            </button>
          ))}
        </div>
      </div>

      {/* Templates Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredTemplates.map((template) => (
          <div
            key={template.id}
            className="bg-white rounded-lg border border-gray-200 hover:shadow-md transition-shadow overflow-hidden"
          >
              {/* Preview Image */}
              <div className="relative h-48 bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center">
                <div
                  className="w-32 h-40 rounded-lg shadow-lg flex items-center justify-center text-white font-bold text-xl"
                  style={{ backgroundColor: template.color }}
                >
                  {template.style}
                </div>
              </div>

            <div className="p-5">
              {/* Header */}
              <div className="mb-4">
                <h3 className="text-lg font-bold text-gray-900 mb-1">
                  {template.name}
                </h3>
                <p className="text-sm text-gray-600">{template.description}</p>
              </div>

              {/* Features */}
              <div className="mb-4">
                <h4 className="text-sm font-semibold text-gray-900 mb-2">
                  Key Features:
                </h4>
                <ul className="space-y-1">
                  {template.features.map((feature, idx) => (
                    <li key={idx} className="flex items-center gap-2 text-sm text-gray-600">
                      <span className="text-green-500">✓</span>
                      {feature}
                    </li>
                  ))}
                </ul>
              </div>

              {/* Actions */}
              <div className="flex gap-2">
                <button
                  onClick={() => setPreviewTemplate(template)}
                  className="flex-1 py-2 px-4 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors flex items-center justify-center gap-2"
                >
                  <FaEye />
                  Preview
                </button>
                <button
                  onClick={() => handleApplyTemplate(template)}
                  className="flex-1 py-2 px-4 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors flex items-center justify-center gap-2"
                >
                  <FaDownload />
                  Apply
                </button>
              </div>
            </div>
            </div>
          ))}
        </div>

      {/* Template Guidelines */}
      <div className="mt-8 bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex items-start gap-4">
          <div className="p-3 bg-blue-100 rounded-lg">
            <FaBook className="text-xl text-blue-600" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-900 mb-3">
              About Formatting Templates
            </h2>
            <div className="space-y-3 text-gray-600">
              <p>
                Our formatting templates follow the official style guides and are
                regularly updated to match the latest editions. Each template
                includes:
              </p>
              <ul className="list-disc list-inside space-y-1 ml-4">
                <li>Proper margin and spacing settings</li>
                <li>Citation format guidelines</li>
                <li>Reference list formatting</li>
                <li>Header and footer configurations</li>
                <li>Font and typography standards</li>
              </ul>
              <p className="font-medium text-gray-900">
                Simply select a template and apply it to your document. Our AI
                will automatically format your content according to the selected
                style guide.
              </p>
            </div>
          </div>
        </div>
      </div>

    {/* Preview Modal */}
    {previewTemplate && (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
          <div className="p-5 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-900">
                {previewTemplate.name} Preview
              </h2>
              <button
                onClick={() => setPreviewTemplate(null)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                ✕
              </button>
            </div>
          </div>
          <div className="p-5">
            <div className="bg-gray-100 rounded-lg p-6 mb-5">
              <div className="bg-white shadow-md rounded-lg p-8 max-w-2xl mx-auto">
                <h3 className="text-xl font-bold mb-3">Sample Document</h3>
                <p className="text-gray-700 mb-3">
                  This is a preview of how your document will look with the{' '}
                  {previewTemplate.name} formatting applied.
                </p>
                <div className="space-y-2 text-sm text-gray-600">
                  {previewTemplate.features.map((feature, idx) => (
                    <p key={idx}>
                      <strong>{feature}:</strong> Properly formatted according to
                      style guidelines.
                    </p>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setPreviewTemplate(null)}
                className="btn-secondary flex-1"
              >
                Close
              </button>
              <button
                onClick={() => {
                  handleApplyTemplate(previewTemplate)
                  setPreviewTemplate(null)
                }}
                className="btn-primary flex-1"
              >
                Apply This Template
              </button>
            </div>
          </div>
        </div>
      </div>
    )}
    </div>
  )
}

export default Templates
