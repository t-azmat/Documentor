import { useEffect, useState } from 'react'
import { FaCheckCircle, FaClock, FaCopy, FaFileAlt, FaFolderOpen, FaServer, FaUserFriends } from 'react-icons/fa'
import { adminAPI } from '../../services/api'
import useAuthStore from '../../store/authStore'

const StatCard = ({ icon: Icon, label, value, tone = 'blue' }) => {
  const tones = {
    blue: {
      card: 'border-purple-400/25 bg-purple-400/10',
      icon: 'bg-purple-400/15 text-purple-200',
      accent: 'bg-purple-400'
    },
    green: {
      card: 'border-violet-400/25 bg-violet-400/10',
      icon: 'bg-violet-400/15 text-violet-200',
      accent: 'bg-violet-400'
    },
    amber: {
      card: 'border-fuchsia-400/25 bg-fuchsia-400/10',
      icon: 'bg-fuchsia-400/15 text-fuchsia-200',
      accent: 'bg-fuchsia-400'
    },
    slate: {
      card: 'border-indigo-400/25 bg-indigo-400/10',
      icon: 'bg-indigo-400/15 text-indigo-200',
      accent: 'bg-indigo-400'
    }
  }
  const toneClasses = tones[tone] || tones.blue

  return (
    <div className={`relative overflow-hidden rounded-xl border p-4 ${toneClasses.card}`}>
      <div className={`absolute inset-x-0 top-0 h-0.5 ${toneClasses.accent}`} />
      <div className="flex items-center gap-3">
        <div className={`rounded-lg p-3 ${toneClasses.icon}`}>
          <Icon className="text-lg" />
        </div>
        <div>
          <div className="text-2xl font-black text-white">{value}</div>
          <div className="text-sm font-medium text-slate-400">{label}</div>
        </div>
      </div>
    </div>
  )
}

const formatDate = (value) => {
  if (!value) return 'N/A'
  return new Date(value).toLocaleString()
}

const AdminOverview = () => {
  const { user, isAuthenticated } = useAuthStore()
  const [overview, setOverview] = useState(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')

  useEffect(() => {
    const fetchOverview = async () => {
      setLoading(true)
      setLoadError('')

      try {
        const isAdmin = isAuthenticated && user?.role === 'admin'
        let response

        if (isAdmin) {
          try {
            response = await adminAPI.getOverview()
          } catch (adminError) {
            console.warn('Admin overview failed, falling back to public overview:', adminError)
            response = await adminAPI.getPublicOverview()
          }
        } else {
          response = await adminAPI.getPublicOverview()
        }

        setOverview(response.data.overview)
      } catch (error) {
        console.error('Error fetching admin overview:', error)
        setOverview(null)
        setLoadError(error.response?.data?.message || error.message || 'Unable to load overview')
      } finally {
        setLoading(false)
      }
    }

    fetchOverview()
  }, [isAuthenticated, user])

  if (loading) {
    return <div className="py-12 text-center text-gray-600">Loading admin overview...</div>
  }

  if (!overview) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-red-700">
        Unable to load admin overview right now.
        {loadError ? (
          <div className="mt-2 text-sm text-red-600">
            Details: {loadError}
          </div>
        ) : null}
      </div>
    )
  }

  const { counts, system, recentLogs, recentProjects, recentTemplates } = overview

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-gray-900">System Overview</h2>
        <p className="mt-1 text-sm text-gray-600">
          Live setup, activity snapshot, and the latest additions across the platform.
        </p>
        {(!isAuthenticated || user?.role !== 'admin') ? (
          <div className="mt-3 inline-flex rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700">
            Stats-only mode
          </div>
        ) : null}
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
        <StatCard icon={FaUserFriends} label="Users" value={counts.users} tone="blue" />
        <StatCard icon={FaFolderOpen} label="Projects" value={counts.projects} tone="green" />
        <StatCard icon={FaFileAlt} label="Documents" value={counts.documents} tone="amber" />
        <StatCard icon={FaCopy} label="Templates" value={counts.templates} tone="slate" />
        <StatCard icon={FaCheckCircle} label="Formatting Jobs" value={counts.formattingJobs} tone="blue" />
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <div className="rounded-xl border border-gray-200 bg-white p-5 xl:col-span-1">
          <div className="mb-4 flex items-center gap-3">
            <div className="rounded-lg bg-blue-50 p-3 text-blue-600">
              <FaServer />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">System Setup</h3>
              <p className="text-sm text-gray-500">Current backend status</p>
            </div>
          </div>
          <div className="space-y-3 text-sm">
            <div className="flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2">
              <span className="text-gray-600">API Status</span>
              <span className="font-medium capitalize text-green-700">{system.apiStatus}</span>
            </div>
            <div className="flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2">
              <span className="text-gray-600">Environment</span>
              <span className="font-medium text-gray-900">{system.nodeEnv}</span>
            </div>
            <div className="flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2">
              <span className="text-gray-600">Updated</span>
              <span className="font-medium text-gray-900">{formatDate(system.timestamp)}</span>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-5 xl:col-span-1">
          <h3 className="mb-4 font-semibold text-gray-900">Recent Projects</h3>
          <div className="space-y-3">
            {recentProjects?.length ? recentProjects.map((project) => (
              <div key={project._id} className="rounded-lg border border-gray-100 bg-gray-50 p-3">
                <div className="font-medium text-gray-900">{project.name}</div>
                <div className="mt-1 text-sm text-gray-600">
                  {project.userId?.name || 'Unknown user'} - {project.status}
                </div>
                <div className="mt-1 text-xs text-gray-500">{formatDate(project.createdAt)}</div>
              </div>
            )) : (
              <div className="rounded-lg bg-gray-50 p-4 text-sm text-gray-500">No projects yet.</div>
            )}
          </div>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-5 xl:col-span-1">
          <h3 className="mb-4 font-semibold text-gray-900">Recent Template Additions</h3>
          <div className="space-y-3">
            {recentTemplates?.length ? recentTemplates.map((template) => (
              <div key={template.id || template._id} className="rounded-lg border border-gray-100 bg-gray-50 p-3">
                <div className="font-medium text-gray-900">{template.name}</div>
                <div className="mt-1 text-sm text-gray-600">{template.type}</div>
                <div className="mt-1 text-xs text-gray-500">{formatDate(template.createdAt)}</div>
              </div>
            )) : (
              <div className="rounded-lg bg-gray-50 p-4 text-sm text-gray-500">No templates yet.</div>
            )}
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-5">
        <div className="mb-4 flex items-center gap-2">
          <FaClock className="text-blue-600" />
          <h3 className="font-semibold text-gray-900">Recent User Logs</h3>
        </div>
        <div className="space-y-3">
          {recentLogs?.length ? recentLogs.map((log) => (
            <div key={log._id} className="rounded-lg border border-gray-100 bg-gray-50 p-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className={`rounded-full px-2 py-1 text-xs font-medium ${
                  log.type === 'error'
                    ? 'bg-red-100 text-red-700'
                    : log.type === 'warning'
                      ? 'bg-amber-100 text-amber-700'
                      : 'bg-blue-100 text-blue-700'
                }`}>
                  {log.type}
                </span>
                <span className="text-sm font-medium text-gray-900">{log.message}</span>
              </div>
              {log.details ? <p className="mt-2 text-sm text-gray-600">{log.details}</p> : null}
              <div className="mt-2 text-xs text-gray-500">{formatDate(log.createdAt)}</div>
            </div>
          )) : (
            <div className="rounded-lg bg-gray-50 p-4 text-sm text-gray-500">No logs available.</div>
          )}
        </div>
      </div>
    </div>
  )
}

export default AdminOverview
