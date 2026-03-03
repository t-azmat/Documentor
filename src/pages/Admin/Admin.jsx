import { useState } from 'react'
import { FaCog, FaFileAlt, FaCheckCircle, FaChartLine, FaUsers } from 'react-icons/fa'
import StyleTemplates from './StyleTemplates'
import FormatTester from './FormatTester'
import SystemLogs from './SystemLogs'
import UserManagement from './UserManagement'

const Admin = () => {
  const [activeTab, setActiveTab] = useState('templates')

  const tabs = [
    { id: 'templates', label: 'Style Templates', icon: FaFileAlt, component: StyleTemplates },
    { id: 'formatter', label: 'Test Formatting', icon: FaCheckCircle, component: FormatTester },
    { id: 'logs', label: 'System Logs', icon: FaChartLine, component: SystemLogs },
    { id: 'users', label: 'User Management', icon: FaUsers, component: UserManagement },
  ]

  const ActiveComponent = tabs.find(tab => tab.id === activeTab)?.component

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Standalone top bar */}
      <header className="bg-gradient-to-r from-blue-600 to-blue-700 shadow-md">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-white rounded-lg flex items-center justify-center">
              <FaFileAlt className="text-blue-600 text-lg" />
            </div>
            <span className="text-white text-lg font-bold">DocuMentor</span>
            <span className="text-blue-200 text-sm font-medium">/ Admin</span>
          </div>
          <div className="flex items-center gap-2 text-blue-100 text-sm">
            <FaUsers className="text-base" />
            <span>User Activity Monitor</span>
          </div>
        </div>
      </header>

      <div className="p-5">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-2">
            <FaCog className="text-3xl text-blue-600" />
            <h1 className="text-2xl font-bold text-gray-900">Admin Panel</h1>
          </div>
          <p className="text-gray-600">Manage style templates, test formatting, monitor system, and control users</p>
        </div>

        {/* Tabs */}
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <div className="border-b border-gray-200">
            <div className="flex overflow-x-auto">
              {tabs.map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-6 py-4 border-b-2 font-medium transition-colors whitespace-nowrap ${
                    activeTab === tab.id
                      ? 'border-blue-600 text-blue-600 bg-blue-50'
                      : 'border-transparent text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                  }`}
                >
                  <tab.icon />
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* Tab Content */}
          <div className="p-6">
            {ActiveComponent && <ActiveComponent />}
          </div>
        </div>
      </div>
      </div>
    </div>
  )
}

export default Admin
