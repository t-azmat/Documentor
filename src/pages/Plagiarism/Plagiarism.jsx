import { useState } from 'react'
import { FaUpload, FaFileAlt, FaTimes } from 'react-icons/fa'
import PlagiarismDetector from '../../components/PlagiarismChecker/PlagiarismDetector'
import { fileExtractorAPI } from '../../services/pythonNlpService'

const Plagiarism = () => {
  const [document, setDocument] = useState(null)
  const [showChecker, setShowChecker] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleFileUpload = async (e) => {
    const file = e.target.files[0]
    if (!file) return

    setLoading(true)
    
    try {
      // Use centralized file extractor for PDF, DOCX, TXT, LaTeX
      const response = await fileExtractorAPI.extractText(file)
      
      if (response.data.success) {
        setDocument({
          id: Date.now(),
          title: file.name,
          content: response.data.text,
          uploadDate: new Date().toLocaleDateString(),
          fileType: response.data.file_type,
          wordCount: response.data.word_count,
          charCount: response.data.char_count
        })
        setShowChecker(true)
      } else {
        alert(response.data.error || 'Failed to extract text from file')
      }
    } catch (err) {
      console.error('File upload error:', err)
      alert(err.response?.data?.error || 'Error reading file. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleCloseChecker = () => {
    setShowChecker(false)
    setDocument(null)
  }

  const handlePlagiarismCheckSuccess = (results) => {
    console.log('Plagiarism check completed:', results)
  }

  return (
    <div className="p-5">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Plagiarism Checker</h1>
          <p className="text-gray-600">
            Upload or paste your document to check for plagiarism and verify originality
          </p>
        </div>

        {!showChecker ? (
          <>
            {/* Upload Section */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
              {/* File Upload Card */}
              <div className="bg-white border-2 border-dashed border-blue-300 rounded-lg p-8 text-center hover:border-blue-500 transition-colors cursor-pointer"
                   onClick={() => document.getElementById('fileInput').click()}>
                <FaUpload className="text-4xl text-blue-600 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Upload Document</h3>
                <p className="text-gray-600 mb-4">Drag and drop or click to select a file</p>
                <input
                  id="fileInput"
                  type="file"
                  accept=".txt,.pdf,.docx,.tex,.latex"
                  onChange={handleFileUpload}
                  className="hidden"
                  disabled={loading}
                />
                <p className="text-sm text-gray-500">Supported: PDF, DOCX, TXT, LaTeX</p>
              </div>

              {/* Paste Text Card */}
              <div className="bg-white border border-gray-200 rounded-lg p-8">
                <FaFileAlt className="text-4xl text-purple-600 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Paste Text</h3>
                <p className="text-gray-600 mb-4">Or paste your text directly</p>
                <textarea
                  placeholder="Paste your document text here..."
                  className="w-full h-40 p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none"
                  onChange={(e) => {
                    if (e.target.value.trim()) {
                      setDocument({
                        id: Date.now(),
                        title: 'Pasted Document',
                        content: e.target.value,
                        uploadDate: new Date().toLocaleDateString(),
                      })
                    } else {
                      setDocument(null)
                    }
                  }}
                />
                <button
                  onClick={() => {
                    if (document) {
                      setShowChecker(true)
                    }
                  }}
                  disabled={!document}
                  className="mt-4 w-full bg-purple-600 text-white py-2 px-4 rounded-lg hover:bg-purple-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors font-medium"
                >
                  Check Plagiarism
                </button>
              </div>
            </div>

            {/* Current Document Card */}
            {document && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <FaFileAlt className="text-2xl text-blue-600" />
                    <div>
                      <h4 className="font-semibold text-gray-900">{document.title}</h4>
                      <p className="text-sm text-gray-600">Uploaded on {document.uploadDate}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      setDocument(null)
                      setShowChecker(false)
                    }}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <FaTimes className="text-xl" />
                  </button>
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="bg-white rounded-lg shadow-lg">
            {document && (
              <PlagiarismDetector
                document={document}
                onClose={handleCloseChecker}
                onCheckSuccess={handlePlagiarismCheckSuccess}
              />
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export default Plagiarism
