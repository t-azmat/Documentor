import { useState } from 'react'
import { useNavigate, useLocation, Link } from 'react-router-dom'
import { FaFileAlt, FaLayerGroup, FaQuoteRight, FaSearch, FaBars, FaTimes, FaSignOutAlt, FaMagic } from 'react-icons/fa'

const Layout = ({ children }) => {
  const navigate = useNavigate()
  const location = useLocation()
  const [sidebarOpen, setSidebarOpen] = useState(true)

  const menuItems = [
    { icon: FaFileAlt, label: 'Documents', path: '/documents' },
    { icon: FaMagic, label: 'Grammar Enhancer', path: '/grammar-enhancer' },
    { icon: FaLayerGroup, label: 'Templates', path: '/templates' },
    { icon: FaQuoteRight, label: 'Citations', path: '/citations' },
    { icon: FaSearch, label: 'Plagiarism', path: '/plagiarism' },
  ]

  const handleLogout = () => {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    navigate('/login')
  }

  const isActive = (path) => location.pathname === path

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-64 bg-gradient-to-b from-blue-600 to-blue-700 shadow-xl transform transition-transform duration-300 ease-in-out ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        } lg:translate-x-0`}
      >
        {/* Logo */}
        <div className="flex items-center justify-between px-6 py-6 border-b border-blue-500">
          <Link to="/dashboard" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
            <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center">
              <FaFileAlt className="text-blue-600 text-xl" />
            </div>
            <h1 className="text-white text-xl font-bold">DocuMentor</h1>
          </Link>
          <button
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden text-white hover:bg-blue-700 p-2 rounded-lg"
          >
            <FaTimes />
          </button>
        </div>

        {/* Tools Label */}
        <div className="px-6 py-4">
          <span className="text-blue-200 text-xs font-semibold uppercase tracking-wider">
            Tools
          </span>
        </div>

        {/* Navigation */}
        <nav className="px-3 space-y-1">
          {menuItems.map((item) => (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 ${
                isActive(item.path)
                  ? 'bg-blue-700 text-white shadow-lg'
                  : 'text-blue-100 hover:bg-blue-700 hover:text-white'
              }`}
            >
              <item.icon className="text-lg" />
              <span className="font-medium">{item.label}</span>
            </button>
          ))}
        </nav>

        {/* Logout */}
        <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-blue-500">
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-4 py-3 text-blue-100 hover:bg-blue-700 hover:text-white rounded-lg transition-all duration-200"
          >
            <FaSignOutAlt className="text-lg" />
            <span className="font-medium">Logout</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden lg:ml-64">
        {/* Mobile Header */}
        <header className="lg:hidden bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between shadow-sm">
          <button
            onClick={() => setSidebarOpen(true)}
            className="text-gray-600 hover:text-gray-900 p-2"
          >
            <FaBars className="text-xl" />
          </button>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
              <FaFileAlt className="text-white text-sm" />
            </div>
            <span className="text-gray-900 font-bold">DocuMentor</span>
          </div>
          <div className="w-10" /> {/* Spacer */}
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-x-hidden overflow-y-auto">
          {children}
        </main>
      </div>

      {/* Mobile Overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}
    </div>
  )
}

export default Layout
