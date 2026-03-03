import { useState, useEffect } from 'react'
import { FaUpload, FaTimes, FaFileAlt, FaCheckCircle } from 'react-icons/fa'
import { documentAPI, projectAPI } from '../../services/documentService'

const UploadDocument = ({ onClose, onUploadSuccess }) => {
  const [file, setFile] = useState(null)
  const [title, setTitle] = useState('')
  const [projectId, setProjectId] = useState('')
  const [projects, setProjects] = useState([])
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [dragActive, setDragActive] = useState(false)

  useEffect(() => {
    fetchProjects()
  }, [])

  const fetchProjects = async () => {
    try {
      const response = await projectAPI.getAll()
      setProjects(response.data.projects)
    } catch (err) {
      console.error('Failed to fetch projects:', err)
    }
  }

  const handleDrag = (e) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true)
    } else if (e.type === "dragleave") {
      setDragActive(false)
    }
  }

  const handleDrop = (e) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelect(e.dataTransfer.files[0])
    }
  }

  const handleFileSelect = (selectedFile) => {
    const allowedTypes = [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/plain',
      'application/x-tex',
      'application/x-latex'
    ]
    const allowedExts = ['.pdf', '.docx', '.txt', '.tex', '.latex']
    const fileExt = selectedFile.name.toLowerCase().match(/\.[^.]+$/)
    
    if (!allowedTypes.includes(selectedFile.type) && (!fileExt || !allowedExts.includes(fileExt[0]))) {
      setError('Invalid file type. Only PDF, DOCX, TXT, and LaTeX files are allowed.')
      return
    }

    if (selectedFile.size > 10 * 1024 * 1024) {
      setError('File size must be less than 10MB')
      return
    }

    setFile(selectedFile)
    if (!title) {
      setTitle(selectedFile.name.replace(/\.[^/.]+$/, ""))
    }
    setError('')
  }

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      handleFileSelect(e.target.files[0])
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    
    if (!file) {
      setError('Please select a file to upload')
      return
    }

    setUploading(true)
    setError('')
    setUploadProgress(0)

    const formData = new FormData()
    formData.append('file', file)
    formData.append('title', title)
    if (projectId) formData.append('projectId', projectId)

    try {
      // Simulate upload progress
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => {
          if (prev >= 90) {
            clearInterval(progressInterval)
            return prev
          }
          return prev + 10
        })
      }, 200)

      const response = await documentAPI.upload(formData)
      
      clearInterval(progressInterval)
      setUploadProgress(100)
      setSuccess(true)

      setTimeout(() => {
        onUploadSuccess?.(response.data.document)
        onClose()
      }, 1500)
    } catch (err) {
      setError(err.response?.data?.message || 'Upload failed. Please try again.')
    } finally {
      setUploading(false)
    }
  }

  if (success) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-xl p-8 max-w-md w-full mx-4 text-center">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-green-100 rounded-full mb-4">
            <FaCheckCircle className="text-green-600 text-4xl" />
          </div>
          <h3 className="text-2xl font-bold text-gray-900 mb-2">Upload Successful!</h3>
          <p className="text-gray-600">Your document has been uploaded successfully.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-2xl font-bold text-gray-900">Upload Document</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <FaTimes className="text-gray-600" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Error Message */}
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
              {error}
            </div>
          )}

          {/* File Upload Area */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Document File
            </label>
            <div
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
              className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                dragActive
                  ? 'border-primary-500 bg-primary-50'
                  : 'border-gray-300 hover:border-primary-400'
              }`}
            >
              {file ? (
                <div className="space-y-3">
                  <FaFileAlt className="text-5xl text-primary-600 mx-auto" />
                  <div>
                    <p className="font-medium text-gray-900">{file.name}</p>
                    <p className="text-sm text-gray-500">
                      {(file.size / 1024 / 1024).toFixed(2)} MB
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setFile(null)}
                    className="text-sm text-red-600 hover:text-red-700"
                  >
                    Remove file
                  </button>
                </div>
              ) : (
                <>
                  <FaUpload className="text-5xl text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-700 mb-2">
                    Drag and drop your file here, or
                  </p>
                  <label className="inline-block">
                    <span className="btn-primary cursor-pointer">
                      Browse Files
                    </span>
                    <input
                      type="file"
                      onChange={handleFileChange}
                      accept=".pdf,.docx,.txt,.tex,.latex"
                      className="hidden"
                    />
                  </label>
                  <p className="text-xs text-gray-500 mt-3">
                    Supported formats: PDF, DOCX, TXT, LaTeX (Max 10MB)
                  </p>
                </>
              )}
            </div>
          </div>

          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Document Title
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Enter document title"
              className="input-field"
              required
            />
          </div>

          {/* Project Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Add to Project (Optional)
            </label>
            <select
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
              className="input-field"
            >
              <option value="">No Project</option>
              {projects.map((project) => (
                <option key={project._id} value={project._id}>
                  {project.name}
                </option>
              ))}
            </select>
          </div>

          {/* Upload Progress */}
          {uploading && (
            <div>
              <div className="flex justify-between text-sm text-gray-600 mb-2">
                <span>Uploading...</span>
                <span>{uploadProgress}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-primary-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${uploadProgress}%` }}
                ></div>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="btn-secondary flex-1"
              disabled={uploading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn-primary flex-1"
              disabled={uploading || !file}
            >
              {uploading ? 'Uploading...' : 'Upload Document'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default UploadDocument
