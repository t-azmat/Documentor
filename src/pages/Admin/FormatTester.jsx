import { useEffect, useState } from 'react'
import { FaCheckCircle, FaExclamationTriangle, FaPauseCircle, FaPlay, FaTimesCircle } from 'react-icons/fa'
import { adminAPI } from '../../services/api'

const FormatTester = () => {
  const [jobs, setJobs] = useState([])
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchFormattingJobs = async () => {
      try {
        const response = await adminAPI.getFormattingJobs()
        setJobs(response.data.jobs || [])
        setStats(response.data.stats || null)
      } catch (error) {
        console.error('Error fetching formatting jobs:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchFormattingJobs()
  }, [])

  const getStatusIcon = (status) => {
    switch (status) {
      case 'completed':
        return <FaCheckCircle className="text-green-600" />
      case 'failed':
        return <FaTimesCircle className="text-red-600" />
      case 'running':
        return <FaPlay className="text-blue-600" />
      case 'queued':
      case 'canceled':
        return <FaPauseCircle className="text-yellow-600" />
      default:
        return <FaExclamationTriangle className="text-yellow-600" />
    }
  }

  const getStatusColor = (status) => {
    switch (status) {
      case 'completed':
        return 'bg-green-50 border-green-200'
      case 'failed':
        return 'bg-red-50 border-red-200'
      case 'running':
        return 'bg-blue-50 border-blue-200'
      case 'queued':
      case 'canceled':
        return 'bg-yellow-50 border-yellow-200'
      default:
        return 'bg-gray-50 border-gray-200'
    }
  }

  const formatDate = (value) => {
    if (!value) return 'N/A'
    return new Date(value).toLocaleString()
  }

  if (loading) {
    return <div className="py-12 text-center text-gray-600">Loading formatting activity...</div>
  }

  return (
    <div>
      <div className="mb-6">
        <h2 className="mb-1 text-xl font-bold text-gray-900">Formatting Pipeline</h2>
        <p className="text-sm text-gray-600">Monitor live formatting jobs and processing health across the system</p>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-5">
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <div className="text-2xl font-bold text-gray-900">{stats?.total || 0}</div>
          <div className="text-sm text-gray-600">Total Jobs</div>
        </div>
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
          <div className="text-2xl font-bold text-blue-700">{stats?.running || 0}</div>
          <div className="text-sm text-blue-800">Running</div>
        </div>
        <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-4">
          <div className="text-2xl font-bold text-yellow-700">{stats?.queued || 0}</div>
          <div className="text-sm text-yellow-800">Queued</div>
        </div>
        <div className="rounded-lg border border-green-200 bg-green-50 p-4">
          <div className="text-2xl font-bold text-green-700">{stats?.completed || 0}</div>
          <div className="text-sm text-green-800">Completed</div>
        </div>
        <div className="rounded-lg border border-red-200 bg-red-50 p-4">
          <div className="text-2xl font-bold text-red-700">{stats?.failed || 0}</div>
          <div className="text-sm text-red-800">Failed</div>
        </div>
      </div>

      <div className="space-y-3">
        {jobs.length === 0 ? (
          <div className="rounded-lg border border-gray-200 bg-gray-50 p-12 text-center">
            <FaCheckCircle className="mx-auto mb-3 text-5xl text-gray-300" />
            <p className="text-gray-600">No formatting jobs found</p>
          </div>
        ) : (
          jobs.map((job) => (
            <div key={job._id} className={`rounded-lg border p-4 ${getStatusColor(job.status)}`}>
              <div className="flex items-start gap-3">
                <div className="mt-1 text-xl">
                  {getStatusIcon(job.status)}
                </div>
                <div className="flex-1">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <div className="font-semibold text-gray-900">
                        {job.documentId?.title || job.source?.title || 'Untitled document'}
                      </div>
                      <div className="text-sm text-gray-600">
                        {job.style} - {job.status} - {job.userId?.name || 'Unknown user'}
                      </div>
                    </div>
                    <div className="text-xs text-gray-500">{formatDate(job.createdAt)}</div>
                  </div>

                  <div className="mt-3 grid grid-cols-1 gap-3 text-sm md:grid-cols-3">
                    <div className="rounded-lg bg-white/70 px-3 py-2">
                      <div className="text-gray-500">Progress</div>
                      <div className="font-medium text-gray-900">
                        {job.progress?.percentage || 0}% - {job.progress?.stageName || 'queued'}
                      </div>
                    </div>
                    <div className="rounded-lg bg-white/70 px-3 py-2">
                      <div className="text-gray-500">Chunks</div>
                      <div className="font-medium text-gray-900">
                        {job.progress?.currentChunk || 0} / {job.progress?.totalChunks || 0}
                      </div>
                    </div>
                    <div className="rounded-lg bg-white/70 px-3 py-2">
                      <div className="text-gray-500">Duration</div>
                      <div className="font-medium text-gray-900">
                        {job.metrics?.totalElapsedMs || job.progress?.elapsedMs || 0} ms
                      </div>
                    </div>
                  </div>

                  {job.progress?.message ? (
                    <p className="mt-3 text-sm text-gray-700">{job.progress.message}</p>
                  ) : null}

                  {job.error?.message ? (
                    <p className="mt-2 text-sm text-red-700">Error: {job.error.message}</p>
                  ) : null}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

export default FormatTester
