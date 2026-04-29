import { useEffect, useMemo, useState } from 'react'
import { FaFolderOpen, FaSearch } from 'react-icons/fa'
import { adminAPI } from '../../services/api'

const formatDate = (value) => {
  if (!value) return 'No deadline'
  return new Date(value).toLocaleDateString()
}

const ProjectsOverview = () => {
  const [projects, setProjects] = useState([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')

  useEffect(() => {
    const fetchProjects = async () => {
      try {
        const response = await adminAPI.getProjects()
        setProjects(response.data.projects || [])
      } catch (error) {
        console.error('Error fetching projects:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchProjects()
  }, [])

  const filteredProjects = useMemo(() => {
    const value = query.trim().toLowerCase()
    if (!value) return projects

    return projects.filter((project) => {
      const parts = [
        project.name,
        project.description,
        project.category,
        project.status,
        project.userId?.name,
        project.userId?.email
      ]

      return parts.some((part) => String(part || '').toLowerCase().includes(value))
    })
  }, [projects, query])

  if (loading) {
    return <div className="py-12 text-center text-gray-600">Loading projects...</div>
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-gray-900">Projects</h2>
        <p className="mt-1 text-sm text-gray-600">Browse all project setups across the system.</p>
      </div>

      <div className="relative">
        <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="w-full rounded-xl border border-gray-300 py-3 pl-10 pr-4"
          placeholder="Search by project, owner, category, or status"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        {filteredProjects.length ? filteredProjects.map((project) => (
          <div key={project._id} className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <FaFolderOpen className="text-blue-600" />
                  <h3 className="text-lg font-semibold text-gray-900">{project.name}</h3>
                </div>
                {project.description ? (
                  <p className="mt-2 text-sm text-gray-600">{project.description}</p>
                ) : (
                  <p className="mt-2 text-sm text-gray-400">No description provided.</p>
                )}
              </div>
              <span className={`rounded-full px-3 py-1 text-xs font-medium ${
                project.status === 'completed'
                  ? 'bg-green-100 text-green-700'
                  : project.status === 'archived'
                    ? 'bg-gray-100 text-gray-700'
                    : 'bg-blue-100 text-blue-700'
              }`}>
                {project.status}
              </span>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-lg bg-gray-50 p-3">
                <div className="text-gray-500">Owner</div>
                <div className="font-medium text-gray-900">{project.userId?.name || 'Unknown'}</div>
                <div className="text-xs text-gray-500">{project.userId?.email || 'No email'}</div>
              </div>
              <div className="rounded-lg bg-gray-50 p-3">
                <div className="text-gray-500">Category</div>
                <div className="font-medium capitalize text-gray-900">
                  {String(project.category || 'other').replace(/-/g, ' ')}
                </div>
              </div>
              <div className="rounded-lg bg-gray-50 p-3">
                <div className="text-gray-500">Documents</div>
                <div className="font-medium text-gray-900">{project.documents?.length || 0}</div>
              </div>
              <div className="rounded-lg bg-gray-50 p-3">
                <div className="text-gray-500">Deadline</div>
                <div className="font-medium text-gray-900">{formatDate(project.deadline)}</div>
              </div>
            </div>

            {project.documents?.length ? (
              <div className="mt-4">
                <div className="mb-2 text-sm font-medium text-gray-700">Attached documents</div>
                <div className="space-y-2">
                  {project.documents.slice(0, 4).map((document) => (
                    <div key={document._id} className="rounded-lg border border-gray-100 px-3 py-2 text-sm text-gray-700">
                      {document.title || 'Untitled document'} - {document.status || 'unknown'}
                    </div>
                  ))}
                  {project.documents.length > 4 ? (
                    <div className="text-xs text-gray-500">+{project.documents.length - 4} more documents</div>
                  ) : null}
                </div>
              </div>
            ) : null}
          </div>
        )) : (
          <div className="rounded-xl border border-gray-200 bg-gray-50 p-12 text-center text-gray-500 xl:col-span-2">
            No projects matched your search.
          </div>
        )}
      </div>
    </div>
  )
}

export default ProjectsOverview
