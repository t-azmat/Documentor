import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { 
  FaFileUpload, FaHistory, FaCog, FaSignOutAlt, FaBell, 
  FaUserCircle, FaCrown, FaFolder, FaChartLine, FaBook 
} from 'react-icons/fa'
import { MdDashboard, MdDescription } from 'react-icons/md'
import useAuthStore from '../../store/authStore'
import { subscriptionAPI, authAPI } from '../../services/api'
import UploadDocument from '../../components/UploadDocument/UploadDocument'

const Dashboard = () => {
  const navigate = useNavigate()
  const { user, subscription, logout, updateUser } = useAuthStore()
  const [activePage, setActivePage] = useState('dashboard')
  const [loading, setLoading] = useState(true)
  const [subscriptionData, setSubscriptionData] = useState(null)
  const [usageData, setUsageData] = useState(null)
  const [showUpload, setShowUpload] = useState(false)

  useEffect(() => {
    fetchUserData()
  }, [])

  const fetchUserData = async () => {
    try {
      const [meResponse, subResponse] = await Promise.all([
        authAPI.getMe(),
        subscriptionAPI.getCurrentSubscription()
      ])
      
      updateUser(meResponse.data.user)
      setSubscriptionData(subResponse.data.subscription)
      setUsageData({
        usage: subResponse.data.usage,
        limits: subResponse.data.limits
      })
    } catch (error) {
      console.error('Failed to fetch user data:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleLogout = async () => {
    try {
      await authAPI.logout()
    } catch (error) {
      console.error('Logout error:', error)
    } finally {
      logout()
      navigate('/login')
    }
  }

  const formatBytes = (bytes) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i]
  }

  const stats = [
    { 
      label: 'Documents Processed', 
      value: usageData?.usage?.documentsProcessed || 0, 
      icon: MdDescription, 
      color: 'blue' 
    },
    { 
      label: 'This Month', 
      value: usageData?.usage?.documentsThisMonth || 0, 
      icon: FaChartLine, 
      color: 'green' 
    },
    { 
      label: 'Plagiarism Checks', 
      value: usageData?.usage?.plagiarismChecksUsed || 0, 
      icon: FaFolder, 
      color: 'purple' 
    },
    { 
      label: 'Storage Used', 
      value: formatBytes(usageData?.usage?.storageUsed || 0), 
      icon: FaFileUpload, 
      color: 'orange' 
    },
  ]

  const recentDocuments = [
    { name: 'Research Paper - AI Ethics.docx', date: '2 hours ago', status: 'Completed' },
    { name: 'Thesis Chapter 3.pdf', date: '1 day ago', status: 'Completed' },
    { name: 'Conference Paper.docx', date: '3 days ago', status: 'In Progress' },
    { name: 'Literature Review.pdf', date: '5 days ago', status: 'Completed' },
  ]

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="mt-1 text-sm text-gray-600">
          Welcome back! Here's your overview
        </p>
      </div>

      {/* Dashboard Content */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      ) : (
        <>
          {/* Stats Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            {stats.map((stat, index) => {
              const Icon = stat.icon
              return (
                <div key={index} className="bg-white rounded-lg p-5 border border-gray-200">
                  <div className="flex items-center justify-between mb-4">
                    <div className={`p-3 bg-blue-100 rounded-lg`}>
                      <Icon className={`text-xl text-blue-600`} />
                    </div>
                  </div>
                  <p className="text-2xl font-bold text-gray-900 mb-1">{stat.value}</p>
                  <p className="text-sm text-gray-600">{stat.label}</p>
                </div>
              )
            })}
          </div>

          {/* Subscription Card */}
          {subscriptionData && (
            <div className="bg-gradient-to-r from-blue-600 to-blue-700 rounded-lg p-5 text-white mb-6">
              <div className="flex items-center gap-2 mb-2">
                <FaCrown className="text-xl" />
                <span className="font-semibold capitalize">
                  {subscriptionData?.plan || 'Free'} Plan
                </span>
              </div>
              <p className="text-sm text-white/90 mb-3">
                {subscriptionData?.plan === 'premium' || subscriptionData?.plan === 'team'
                  ? `Unlimited formatting & features`
                  : `${(usageData?.limits?.documentsPerMonth || 5) - (usageData?.usage?.documentsThisMonth || 0)} documents remaining`}
              </p>
              <button
                onClick={() => navigate('/pricing')}
                className="w-full sm:w-auto bg-white text-blue-600 px-6 py-2 rounded-lg font-medium text-sm hover:bg-gray-50 transition-colors"
              >
                {subscriptionData?.plan === 'premium' || subscriptionData?.plan === 'team' ? 'Manage Plan' : 'Upgrade Now'}
              </button>
            </div>
          )}

          {/* Quick Actions */}
          <div className="bg-white rounded-lg p-5 border border-gray-200 mb-6">
            <h2 className="text-lg font-bold text-gray-900 mb-4">Quick Actions</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <button 
                onClick={() => setShowUpload(true)}
                className="flex items-center gap-3 p-4 border-2 border-dashed border-gray-300 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-all"
              >
                <FaFileUpload className="text-2xl text-blue-600" />
                <div className="text-left">
                  <p className="font-semibold text-gray-900">Upload New Document</p>
                  <p className="text-sm text-gray-600">Format a new research paper</p>
                </div>
              </button>
              <button 
                onClick={() => navigate('/projects')}
                className="flex items-center gap-3 p-4 border-2 border-dashed border-gray-300 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-all"
              >
                <FaFolder className="text-2xl text-blue-600" />
                <div className="text-left">
                  <p className="font-semibold text-gray-900">Create Project</p>
                  <p className="text-sm text-gray-600">Organize related documents</p>
                </div>
              </button>
              <button 
                onClick={() => navigate('/templates')}
                className="flex items-center gap-3 p-4 border-2 border-dashed border-gray-300 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-all"
              >
                <FaBook className="text-2xl text-blue-600" />
                <div className="text-left">
                  <p className="font-semibold text-gray-900">Browse Templates</p>
                  <p className="text-sm text-gray-600">Use formatting presets</p>
                </div>
              </button>
            </div>
          </div>

          {/* Recent Documents */}
          <div className="bg-white rounded-lg border border-gray-200">
            <div className="p-5 border-b border-gray-200">
              <h2 className="text-lg font-bold text-gray-900">Recent Documents</h2>
            </div>
            <div className="divide-y divide-gray-200">
              {recentDocuments.map((doc, index) => (
                <div key={index} className="p-5 hover:bg-gray-50 transition-colors cursor-pointer">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="p-3 bg-blue-100 rounded-lg">
                        <MdDescription className="text-xl text-blue-600" />
                      </div>
                      <div>
                        <p className="font-semibold text-gray-900">{doc.name}</p>
                        <p className="text-sm text-gray-600">{doc.date}</p>
                      </div>
                    </div>
                    <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                      doc.status === 'Completed' 
                        ? 'bg-green-100 text-green-700'
                        : 'bg-yellow-100 text-yellow-700'
                    }`}>
                      {doc.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
      
      {/* Upload Modal */}
      {showUpload && (
        <UploadDocument
          onClose={() => setShowUpload(false)}
          onUploadSuccess={() => {
            setShowUpload(false)
            fetchUserData()
          }}
        />
      )}
    </div>
  )
}

export default Dashboard
