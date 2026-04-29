import { useEffect, useState } from 'react'
import { FaExclamationCircle, FaCheckCircle, FaInfoCircle, FaClock, FaChartLine } from 'react-icons/fa'
import { adminAPI } from '../../services/api'

const SystemLogs = () => {
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')
  const [stats, setStats] = useState({
    totalLogs: 0,
    errors: 0,
    warnings: 0,
    info: 0
  })

  useEffect(() => {
    const fetchLogs = async () => {
      try {
        setLoading(true)
        const response = await adminAPI.getLogs(filter === 'all' ? {} : { type: filter })
        const logsData = response.data.logs || []
        setLogs(logsData)
        setStats(response.data.stats || {
          totalLogs: logsData.length,
          errors: 0,
          warnings: 0,
          info: 0
        })
      } catch (error) {
        console.error('Error fetching logs:', error)
        setLogs([])
        setStats({
          totalLogs: 0,
          errors: 0,
          warnings: 0,
          info: 0
        })
      } finally {
        setLoading(false)
      }
    }

    fetchLogs()
  }, [filter])

  const getLogIcon = (type) => {
    switch (type) {
      case 'error':
        return <FaExclamationCircle className="text-red-600" />
      case 'warning':
        return <FaExclamationCircle className="text-yellow-600" />
      case 'info':
        return <FaInfoCircle className="text-blue-600" />
      default:
        return <FaCheckCircle className="text-green-600" />
    }
  }

  const getLogColor = (type) => {
    switch (type) {
      case 'error':
        return 'bg-red-50 border-red-200'
      case 'warning':
        return 'bg-yellow-50 border-yellow-200'
      case 'info':
        return 'bg-blue-50 border-blue-200'
      default:
        return 'bg-gray-50 border-gray-200'
    }
  }

  const formatTimestamp = (timestamp) => {
    const date = new Date(timestamp)
    const now = new Date()
    const diff = Math.floor((now - date) / 1000)

    if (diff < 60) return `${diff}s ago`
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
    return date.toLocaleString()
  }

  if (loading) {
    return (
      <div className="py-12 text-center">
        <div className="mb-4 inline-block h-12 w-12 animate-spin rounded-full border-b-2 border-blue-600"></div>
        <p className="text-gray-600">Loading system logs...</p>
      </div>
    )
  }

  return (
    <div>
      <div className="mb-6">
        <h2 className="mb-1 text-xl font-bold text-gray-900">System Logs</h2>
        <p className="text-sm text-gray-600">Monitor system activity, errors, and performance</p>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-4">
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <div className="flex items-center gap-3">
            <FaChartLine className="text-2xl text-gray-600" />
            <div>
              <div className="text-2xl font-bold text-gray-900">{stats.totalLogs}</div>
              <div className="text-sm text-gray-600">Total Logs</div>
            </div>
          </div>
        </div>
        <div className="rounded-lg border border-red-200 bg-red-50 p-4">
          <div className="flex items-center gap-3">
            <FaExclamationCircle className="text-2xl text-red-600" />
            <div>
              <div className="text-2xl font-bold text-red-600">{stats.errors}</div>
              <div className="text-sm text-red-800">Errors</div>
            </div>
          </div>
        </div>
        <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-4">
          <div className="flex items-center gap-3">
            <FaExclamationCircle className="text-2xl text-yellow-600" />
            <div>
              <div className="text-2xl font-bold text-yellow-600">{stats.warnings}</div>
              <div className="text-sm text-yellow-800">Warnings</div>
            </div>
          </div>
        </div>
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
          <div className="flex items-center gap-3">
            <FaInfoCircle className="text-2xl text-blue-600" />
            <div>
              <div className="text-2xl font-bold text-blue-600">{stats.info}</div>
              <div className="text-sm text-blue-800">Info</div>
            </div>
          </div>
        </div>
      </div>

      <div className="mb-4 flex gap-2">
        <button
          onClick={() => setFilter('all')}
          className={`rounded-lg px-4 py-2 font-medium transition-colors ${
            filter === 'all'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          All
        </button>
        <button
          onClick={() => setFilter('error')}
          className={`rounded-lg px-4 py-2 font-medium transition-colors ${
            filter === 'error'
              ? 'bg-red-600 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          Errors
        </button>
        <button
          onClick={() => setFilter('warning')}
          className={`rounded-lg px-4 py-2 font-medium transition-colors ${
            filter === 'warning'
              ? 'bg-yellow-600 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          Warnings
        </button>
        <button
          onClick={() => setFilter('info')}
          className={`rounded-lg px-4 py-2 font-medium transition-colors ${
            filter === 'info'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          Info
        </button>
      </div>

      <div className="space-y-3">
        {logs.length === 0 ? (
          <div className="rounded-lg border border-gray-200 bg-gray-50 py-12 text-center">
            <FaInfoCircle className="mx-auto mb-3 text-5xl text-gray-300" />
            <p className="text-gray-600">No logs found</p>
          </div>
        ) : (
          logs.map((log) => (
            <div key={log._id} className={`rounded-lg border p-4 ${getLogColor(log.type)}`}>
              <div className="flex items-start gap-3">
                <div className="mt-1 text-xl">
                  {getLogIcon(log.type)}
                </div>
                <div className="flex-1">
                  <div className="mb-1 flex items-center justify-between">
                    <span className="font-semibold text-gray-900">{log.message}</span>
                    <span className="flex items-center gap-1 text-xs text-gray-500">
                      <FaClock />
                      {formatTimestamp(log.createdAt)}
                    </span>
                  </div>
                  {log.details ? <p className="text-sm text-gray-700">{log.details}</p> : null}
                  {log.userId ? (
                    <p className="mt-2 text-xs text-gray-500">
                      User: {log.userId.name || 'Unknown'} ({log.userId.email || 'No email'})
                    </p>
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

export default SystemLogs
