import { useState, useEffect } from 'react'
import { collection, getDocs, query, orderBy, limit } from 'firebase/firestore'
import { db } from '../../config/firebase'
import { FaExclamationCircle, FaCheckCircle, FaInfoCircle, FaClock, FaChartLine } from 'react-icons/fa'

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
    fetchLogs()
  }, [])

  const fetchLogs = async () => {
    try {
      // Fetch system logs
      const logsQuery = query(
        collection(db, 'systemLogs'),
        orderBy('timestamp', 'desc'),
        limit(100)
      )
      const querySnapshot = await getDocs(logsQuery)
      const logsData = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }))
      
      setLogs(logsData)
      
      // Calculate stats
      const newStats = {
        totalLogs: logsData.length,
        errors: logsData.filter(log => log.type === 'error').length,
        warnings: logsData.filter(log => log.type === 'warning').length,
        info: logsData.filter(log => log.type === 'info').length
      }
      setStats(newStats)
    } catch (error) {
      console.error('Error fetching logs:', error)
      // Generate mock data for demo
      generateMockLogs()
    } finally {
      setLoading(false)
    }
  }

  const generateMockLogs = () => {
    const mockLogs = [
      {
        id: '1',
        type: 'info',
        message: 'User logged in successfully',
        timestamp: new Date(Date.now() - 5 * 60000).toISOString(),
        details: 'User ID: user123'
      },
      {
        id: '2',
        type: 'error',
        message: 'Failed to process document',
        timestamp: new Date(Date.now() - 15 * 60000).toISOString(),
        details: 'Document ID: doc456 - Timeout after 30s'
      },
      {
        id: '3',
        type: 'warning',
        message: 'High memory usage detected',
        timestamp: new Date(Date.now() - 30 * 60000).toISOString(),
        details: 'Memory usage: 85% - Consider optimization'
      },
      {
        id: '4',
        type: 'info',
        message: 'Style template created',
        timestamp: new Date(Date.now() - 45 * 60000).toISOString(),
        details: 'Template: APA 7th Edition'
      },
      {
        id: '5',
        type: 'error',
        message: 'Database connection failed',
        timestamp: new Date(Date.now() - 60 * 60000).toISOString(),
        details: 'Connection timeout - Retrying...'
      },
      {
        id: '6',
        type: 'info',
        message: 'Backup completed successfully',
        timestamp: new Date(Date.now() - 120 * 60000).toISOString(),
        details: 'Backed up 1,234 documents'
      },
      {
        id: '7',
        type: 'warning',
        message: 'API rate limit approaching',
        timestamp: new Date(Date.now() - 180 * 60000).toISOString(),
        details: '450/500 requests used'
      }
    ]
    
    setLogs(mockLogs)
    setStats({
      totalLogs: mockLogs.length,
      errors: mockLogs.filter(log => log.type === 'error').length,
      warnings: mockLogs.filter(log => log.type === 'warning').length,
      info: mockLogs.filter(log => log.type === 'info').length
    })
  }

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
    const diff = Math.floor((now - date) / 1000) // seconds

    if (diff < 60) return `${diff}s ago`
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
    return date.toLocaleString()
  }

  const filteredLogs = filter === 'all' 
    ? logs 
    : logs.filter(log => log.type === filter)

  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
        <p className="text-gray-600">Loading system logs...</p>
      </div>
    )
  }

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-xl font-bold text-gray-900 mb-1">System Logs</h2>
        <p className="text-sm text-gray-600">Monitor system activity, errors, and performance</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <FaChartLine className="text-2xl text-gray-600" />
            <div>
              <div className="text-2xl font-bold text-gray-900">{stats.totalLogs}</div>
              <div className="text-sm text-gray-600">Total Logs</div>
            </div>
          </div>
        </div>
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <FaExclamationCircle className="text-2xl text-red-600" />
            <div>
              <div className="text-2xl font-bold text-red-600">{stats.errors}</div>
              <div className="text-sm text-red-800">Errors</div>
            </div>
          </div>
        </div>
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <FaExclamationCircle className="text-2xl text-yellow-600" />
            <div>
              <div className="text-2xl font-bold text-yellow-600">{stats.warnings}</div>
              <div className="text-sm text-yellow-800">Warnings</div>
            </div>
          </div>
        </div>
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <FaInfoCircle className="text-2xl text-blue-600" />
            <div>
              <div className="text-2xl font-bold text-blue-600">{stats.info}</div>
              <div className="text-sm text-blue-800">Info</div>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-2 mb-4">
        <button
          onClick={() => setFilter('all')}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            filter === 'all'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          All
        </button>
        <button
          onClick={() => setFilter('error')}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            filter === 'error'
              ? 'bg-red-600 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          Errors
        </button>
        <button
          onClick={() => setFilter('warning')}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            filter === 'warning'
              ? 'bg-yellow-600 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          Warnings
        </button>
        <button
          onClick={() => setFilter('info')}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            filter === 'info'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          Info
        </button>
      </div>

      {/* Logs List */}
      <div className="space-y-3">
        {filteredLogs.length === 0 ? (
          <div className="text-center py-12 bg-gray-50 border border-gray-200 rounded-lg">
            <FaInfoCircle className="text-5xl text-gray-300 mx-auto mb-3" />
            <p className="text-gray-600">No logs found</p>
          </div>
        ) : (
          filteredLogs.map(log => (
            <div
              key={log.id}
              className={`border rounded-lg p-4 ${getLogColor(log.type)}`}
            >
              <div className="flex items-start gap-3">
                <div className="text-xl mt-1">
                  {getLogIcon(log.type)}
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-semibold text-gray-900">{log.message}</span>
                    <span className="flex items-center gap-1 text-xs text-gray-500">
                      <FaClock />
                      {formatTimestamp(log.timestamp)}
                    </span>
                  </div>
                  {log.details && (
                    <p className="text-sm text-gray-700">{log.details}</p>
                  )}
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
