import { useState, useEffect } from 'react'
import { FaPlus, FaFolder, FaFileAlt, FaEdit, FaTrash, FaCalendar, FaClock } from 'react-icons/fa'
import { projectAPI, documentAPI } from '../../services/documentService'
import ProjectModal from '../../components/ProjectModal/ProjectModal'
import UploadDocument from '../../components/UploadDocument/UploadDocument'

const Projects = () => {
  const [projects, setProjects] = useState([])
  const [loading, setLoading] = useState(true)
  const [showProjectModal, setShowProjectModal] = useState(false)
  const [showUploadModal, setShowUploadModal] = useState(false)
  const [editingProject, setEditingProject] = useState(null)
  const [statusFilter, setStatusFilter] = useState('all')

  useEffect(() => {
    fetchProjects()
  }, [statusFilter])

  const fetchProjects = async () => {
    try {
      setLoading(true)
      const params = statusFilter !== 'all' ? { status: statusFilter } : {}
      const response = await projectAPI.getAll(params)
      setProjects(response.data.projects)
    } catch (err) {
      console.error('Failed to fetch projects:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleCreateProject = () => {
    setEditingProject(null)
    setShowProjectModal(true)
  }

  const handleEditProject = (project) => {
    setEditingProject(project)
    setShowProjectModal(true)
  }

  const handleDeleteProject = async (id) => {
    if (!window.confirm('Are you sure you want to delete this project? Documents will not be deleted.')) return

    try {
      await projectAPI.delete(id)
      setProjects(projects.filter((p) => p._id !== id))
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to delete project')
    }
  }

  const handleProjectSuccess = (project) => {
    if (editingProject) {
      setProjects(projects.map((p) => (p._id === project._id ? project : p)))
    } else {
      setProjects([project, ...projects])
    }
  }

  const getCategoryIcon = (category) => {
    switch (category) {
      case 'thesis':
        return '📚'
      case 'research-paper':
        return '📄'
      case 'conference':
        return '🎤'
      case 'journal':
        return '📰'
      case 'coursework':
        return '✏️'
      default:
        return '📁'
    }
  }

  const getStatusBadge = (status) => {
    const badges = {
      active: { label: 'Active', color: 'bg-green-100 text-green-800' },
      completed: { label: 'Completed', color: 'bg-blue-100 text-blue-800' },
      archived: { label: 'Archived', color: 'bg-gray-100 text-gray-800' },
    }
    const badge = badges[status] || badges.active
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${badge.color}`}>
        {badge.label}
      </span>
    )
  }

  const formatDeadline = (deadline) => {
    if (!deadline) return null
    const date = new Date(deadline)
    const now = new Date()
    const diffDays = Math.ceil((date - now) / (1000 * 60 * 60 * 24))

    if (diffDays < 0) {
      return <span className="text-red-600">Overdue</span>
    } else if (diffDays === 0) {
      return <span className="text-orange-600">Due Today</span>
    } else if (diffDays <= 7) {
      return <span className="text-yellow-600">Due in {diffDays} days</span>
    } else {
      return <span className="text-gray-600">{date.toLocaleDateString()}</span>
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Projects</h1>
              <p className="mt-1 text-sm text-gray-500">
                Organize your documents into projects
              </p>
            </div>
            <button
              onClick={handleCreateProject}
              className="btn-primary flex items-center gap-2"
            >
              <FaPlus />
              New Project
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Filter */}
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 mb-6">
          <div className="flex items-center gap-4">
            <label className="text-sm font-medium text-gray-700">Status:</label>
            <div className="flex gap-2">
              {['all', 'active', 'completed', 'archived'].map((status) => (
                <button
                  key={status}
                  onClick={() => setStatusFilter(status)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    statusFilter === status
                      ? 'bg-primary-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {status.charAt(0).toUpperCase() + status.slice(1)}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Projects Grid */}
        {loading ? (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
            <p className="mt-4 text-gray-600">Loading projects...</p>
          </div>
        ) : projects.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
            <FaFolder className="text-6xl text-gray-300 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-900 mb-2">No projects yet</h3>
            <p className="text-gray-600 mb-6">
              Create your first project to organize your documents
            </p>
            <button
              onClick={handleCreateProject}
              className="btn-primary inline-flex items-center gap-2"
            >
              <FaPlus />
              Create Project
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {projects.map((project) => (
              <div
                key={project._id}
                className="bg-white rounded-xl shadow-sm border border-gray-200 hover:shadow-lg transition-shadow overflow-hidden"
              >
                {/* Color Header */}
                <div
                  className="h-3"
                  style={{ backgroundColor: project.color }}
                ></div>

                <div className="p-6">
                  {/* Header */}
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <span className="text-3xl">
                        {getCategoryIcon(project.category)}
                      </span>
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900">
                          {project.name}
                        </h3>
                        {getStatusBadge(project.status)}
                      </div>
                    </div>
                  </div>

                  {/* Description */}
                  {project.description && (
                    <p className="text-sm text-gray-600 mb-4 line-clamp-2">
                      {project.description}
                    </p>
                  )}

                  {/* Stats */}
                  <div className="flex items-center gap-4 mb-4 text-sm">
                    <div className="flex items-center gap-2 text-gray-600">
                      <FaFileAlt />
                      <span>{project.stats?.totalDocuments || 0} docs</span>
                    </div>
                    {project.stats?.totalWords > 0 && (
                      <div className="flex items-center gap-2 text-gray-600">
                        <span>✍️</span>
                        <span>{project.stats.totalWords.toLocaleString()} words</span>
                      </div>
                    )}
                  </div>

                  {/* Deadline */}
                  {project.deadline && (
                    <div className="flex items-center gap-2 text-sm mb-4">
                      <FaCalendar className="text-gray-400" />
                      {formatDeadline(project.deadline)}
                    </div>
                  )}

                  {/* Updated At */}
                  <div className="flex items-center gap-2 text-xs text-gray-500 mb-4">
                    <FaClock />
                    <span>Updated {new Date(project.updatedAt).toLocaleDateString()}</span>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2 pt-4 border-t border-gray-200">
                    <button
                      onClick={() => handleEditProject(project)}
                      className="flex-1 py-2 px-3 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors flex items-center justify-center gap-2"
                    >
                      <FaEdit />
                      Edit
                    </button>
                    <button
                      onClick={() => handleDeleteProject(project._id)}
                      className="flex-1 py-2 px-3 text-sm font-medium text-red-600 hover:bg-red-50 rounded-lg transition-colors flex items-center justify-center gap-2"
                    >
                      <FaTrash />
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modals */}
      {showProjectModal && (
        <ProjectModal
          onClose={() => setShowProjectModal(false)}
          onSuccess={handleProjectSuccess}
          editProject={editingProject}
        />
      )}

      {showUploadModal && (
        <UploadDocument
          onClose={() => setShowUploadModal(false)}
          onUploadSuccess={() => {
            setShowUploadModal(false)
            fetchProjects()
          }}
        />
      )}
    </div>
  )
}

export default Projects
