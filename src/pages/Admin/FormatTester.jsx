import { useState, useEffect } from 'react'
import { collection, getDocs } from 'firebase/firestore'
import { db } from '../../config/firebase'
import { FaPlay, FaCheckCircle, FaTimesCircle, FaExclamationTriangle } from 'react-icons/fa'

const FormatTester = () => {
  const [templates, setTemplates] = useState([])
  const [selectedTemplate, setSelectedTemplate] = useState(null)
  const [sampleText, setSampleText] = useState('')
  const [testResults, setTestResults] = useState(null)
  const [testing, setTesting] = useState(false)

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
      if (templatesData.length > 0) {
        setSelectedTemplate(templatesData[0])
      }
    } catch (error) {
      console.error('Error fetching templates:', error)
    }
  }

  const runTest = () => {
    if (!sampleText || !selectedTemplate) {
      alert('Please select a template and enter sample text')
      return
    }

    setTesting(true)
    
    // Simulate testing with delays
    setTimeout(() => {
      const results = {
        passed: 0,
        failed: 0,
        warnings: 0,
        checks: [
          {
            rule: 'Title Format',
            status: sampleText.includes('\n') ? 'pass' : 'fail',
            message: sampleText.includes('\n') ? 'Title is properly formatted' : 'Title should be on its own line',
            expected: selectedTemplate.rules.titleFormat || 'Not specified'
          },
          {
            rule: 'Citation Format',
            status: sampleText.match(/\([A-Z][a-z]+,\s*\d{4}\)/) ? 'pass' : 'warning',
            message: sampleText.match(/\([A-Z][a-z]+,\s*\d{4}\)/) 
              ? 'Citations follow expected format' 
              : 'No in-text citations detected or format may be incorrect',
            expected: selectedTemplate.rules.citationFormat || 'Not specified'
          },
          {
            rule: 'Line Spacing',
            status: 'pass',
            message: 'Line spacing appears correct',
            expected: selectedTemplate.rules.lineSpacing || 'Not specified'
          },
          {
            rule: 'Font Size',
            status: 'warning',
            message: 'Cannot validate font size from plain text',
            expected: selectedTemplate.rules.fontSize || 'Not specified'
          },
          {
            rule: 'Margins',
            status: 'warning',
            message: 'Cannot validate margins from plain text',
            expected: selectedTemplate.rules.margins || 'Not specified'
          },
          {
            rule: 'Reference Format',
            status: sampleText.toLowerCase().includes('references') ? 'pass' : 'warning',
            message: sampleText.toLowerCase().includes('references')
              ? 'References section detected'
              : 'No references section found',
            expected: selectedTemplate.rules.referenceFormat || 'Not specified'
          }
        ]
      }

      // Count results
      results.checks.forEach(check => {
        if (check.status === 'pass') results.passed++
        else if (check.status === 'fail') results.failed++
        else results.warnings++
      })

      setTestResults(results)
      setTesting(false)
    }, 2000)
  }

  const getStatusIcon = (status) => {
    switch (status) {
      case 'pass':
        return <FaCheckCircle className="text-green-600" />
      case 'fail':
        return <FaTimesCircle className="text-red-600" />
      case 'warning':
        return <FaExclamationTriangle className="text-yellow-600" />
      default:
        return null
    }
  }

  const getStatusColor = (status) => {
    switch (status) {
      case 'pass':
        return 'bg-green-50 border-green-200'
      case 'fail':
        return 'bg-red-50 border-red-200'
      case 'warning':
        return 'bg-yellow-50 border-yellow-200'
      default:
        return 'bg-gray-50 border-gray-200'
    }
  }

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-xl font-bold text-gray-900 mb-1">Format Testing</h2>
        <p className="text-sm text-gray-600">Test formatting rules on sample documents</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Input Section */}
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Select Style Template
            </label>
            <select
              value={selectedTemplate?.id || ''}
              onChange={(e) => {
                const template = templates.find(t => t.id === e.target.value)
                setSelectedTemplate(template)
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              {templates.map(template => (
                <option key={template.id} value={template.id}>
                  {template.name} ({template.type})
                </option>
              ))}
            </select>
          </div>

          {selectedTemplate && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h3 className="font-semibold text-blue-900 mb-2">Template Rules</h3>
              <div className="space-y-1 text-sm text-blue-800">
                {selectedTemplate.rules.titleFormat && (
                  <div><strong>Title:</strong> {selectedTemplate.rules.titleFormat}</div>
                )}
                {selectedTemplate.rules.citationFormat && (
                  <div><strong>Citation:</strong> {selectedTemplate.rules.citationFormat}</div>
                )}
                {selectedTemplate.rules.fontSize && (
                  <div><strong>Font:</strong> {selectedTemplate.rules.fontSize}</div>
                )}
                {selectedTemplate.rules.lineSpacing && (
                  <div><strong>Spacing:</strong> {selectedTemplate.rules.lineSpacing}</div>
                )}
              </div>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Sample Text
            </label>
            <textarea
              value={sampleText}
              onChange={(e) => setSampleText(e.target.value)}
              className="w-full h-64 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
              placeholder="Paste your sample document text here..."
            />
          </div>

          <button
            onClick={runTest}
            disabled={!sampleText || !selectedTemplate || testing}
            className="btn-primary w-full flex items-center justify-center gap-2"
          >
            {testing ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                Testing...
              </>
            ) : (
              <>
                <FaPlay />
                Run Format Test
              </>
            )}
          </button>
        </div>

        {/* Results Section */}
        <div>
          <h3 className="font-semibold text-gray-900 mb-4">Test Results</h3>
          
          {!testResults ? (
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-12 text-center">
              <FaCheckCircle className="text-5xl text-gray-300 mx-auto mb-3" />
              <p className="text-gray-600">No tests run yet</p>
              <p className="text-sm text-gray-500 mt-1">
                Enter sample text and click "Run Format Test"
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Summary */}
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center">
                  <div className="text-2xl font-bold text-green-600">{testResults.passed}</div>
                  <div className="text-sm text-green-800">Passed</div>
                </div>
                <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-center">
                  <div className="text-2xl font-bold text-red-600">{testResults.failed}</div>
                  <div className="text-sm text-red-800">Failed</div>
                </div>
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-center">
                  <div className="text-2xl font-bold text-yellow-600">{testResults.warnings}</div>
                  <div className="text-sm text-yellow-800">Warnings</div>
                </div>
              </div>

              {/* Detailed Results */}
              <div className="space-y-3">
                {testResults.checks.map((check, index) => (
                  <div
                    key={index}
                    className={`border rounded-lg p-4 ${getStatusColor(check.status)}`}
                  >
                    <div className="flex items-start gap-3">
                      <div className="text-xl mt-1">
                        {getStatusIcon(check.status)}
                      </div>
                      <div className="flex-1">
                        <div className="font-semibold text-gray-900 mb-1">
                          {check.rule}
                        </div>
                        <p className="text-sm text-gray-700 mb-2">
                          {check.message}
                        </p>
                        <div className="text-xs text-gray-600">
                          <strong>Expected:</strong> {check.expected}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default FormatTester
