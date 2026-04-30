import { useState } from 'react'
import { Link } from 'react-router-dom'
import { FaChartLine, FaCheckCircle, FaCog, FaFileAlt, FaFolderOpen, FaMoon, FaServer, FaShieldAlt, FaSun, FaUsers } from 'react-icons/fa'
import useAuthStore from '../../store/authStore'
import useTheme from '../../hooks/useTheme'
import AdminOverview from './AdminOverview'
import StyleTemplates from './StyleTemplates'
import FormatTester from './FormatTester'
import SystemLogs from './SystemLogs'
import UserManagement from './UserManagement'
import ProjectsOverview from './ProjectsOverview'
import BrandMark from '../../components/BrandLogo/BrandMark'

const Admin = () => {
  const [activeTab, setActiveTab] = useState('overview')
  const { user, isAuthenticated } = useAuthStore()
  const { theme, isDark, toggleTheme } = useTheme()
  const isAdmin = isAuthenticated && user?.role === 'admin'

  const adminTabs = [
    { id: 'overview', label: 'Overview', icon: FaServer, component: AdminOverview },
    { id: 'projects', label: 'Projects', icon: FaFolderOpen, component: ProjectsOverview },
    { id: 'templates', label: 'Style Templates', icon: FaFileAlt, component: StyleTemplates },
    { id: 'formatter', label: 'Formatting Jobs', icon: FaCheckCircle, component: FormatTester },
    { id: 'logs', label: 'System Logs', icon: FaChartLine, component: SystemLogs },
    { id: 'users', label: 'User Management', icon: FaUsers, component: UserManagement },
  ]

  const tabs = isAdmin
    ? adminTabs
    : [{ id: 'overview', label: 'Overview', icon: FaServer, component: AdminOverview }]

  const ActiveComponent = tabs.find(tab => tab.id === activeTab)?.component

  return (
    <div className="documentor-shell min-h-screen bg-[#0c0e13] text-slate-100" data-theme={theme}>
      <header className="border-b border-white/10 bg-[#11141b] shadow-sm">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 py-4">
          <Link to="/dashboard" className="flex min-w-0 items-center gap-3 transition-opacity hover:opacity-90">
            <BrandMark className="h-10 w-10 flex-shrink-0" />
            <div className="min-w-0">
              <div className="truncate text-lg font-black text-white">
                Docu<span className="text-[#8b5cf6]">Mentor</span>
                <span className="ml-2 text-sm font-semibold text-slate-500">/ Admin</span>
              </div>
              <p className="truncate text-xs text-slate-500">Operations and system control</p>
            </div>
          </Link>
          <div className="hidden items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-300 sm:flex">
            <FaUsers className="text-[#8b5cf6]" />
            <span>{isAdmin ? 'Admin workspace' : 'Public stats mode'}</span>
          </div>
          <button
            onClick={toggleTheme}
            className="flex h-10 w-10 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-slate-300 transition hover:bg-white/10 hover:text-white"
            aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
            title={isDark ? 'Light mode' : 'Dark mode'}
          >
            {isDark ? <FaSun /> : <FaMoon />}
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-5 py-6">
        <section className="relative mb-6 overflow-hidden rounded-xl border border-white/10 bg-[#11141b] p-6 shadow-2xl">
          <div className="pointer-events-none absolute -left-24 -top-24 h-72 w-72 rounded-full bg-[#8b5cf6]/10 blur-3xl" />
          <div className="relative flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="mb-2 flex items-center gap-3">
                <div className="rounded-lg bg-[#8b5cf6]/10 p-3 text-[#8b5cf6]">
                  <FaCog className="text-2xl" />
                </div>
                <div>
                  <h1 className="text-2xl font-black text-white">Admin Panel</h1>
                  <p className="mt-1 text-sm text-slate-400">
                    {isAdmin
                      ? 'Manage style templates, test formatting, monitor system, and control users'
                      : 'Stats mode is available publicly for now. Sign in as an admin to unlock management tools.'}
                  </p>
                </div>
              </div>
            </div>

            {!isAdmin ? (
              <Link
                to="/login"
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#8b5cf6] px-4 py-2 text-sm font-black text-white transition hover:bg-[#7c3aed]"
              >
                <FaShieldAlt />
                Go to login
              </Link>
            ) : (
              <div className="rounded-lg border border-emerald-400/20 bg-emerald-400/10 px-4 py-3 text-sm font-semibold text-emerald-300">
                Admin privileges active
              </div>
            )}
          </div>
        </section>

        <section className="overflow-hidden rounded-xl border border-white/10 bg-[#13161e] shadow-2xl">
          <div className="border-b border-white/10 bg-[#11141b]">
            <div className="flex overflow-x-auto px-2 pt-2">
              {tabs.map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 whitespace-nowrap rounded-t-lg border-b-2 px-5 py-4 text-sm font-bold transition-colors ${
                    activeTab === tab.id
                      ? 'border-[#8b5cf6] bg-[#8b5cf6]/10 text-[#8b5cf6]'
                      : 'border-transparent text-slate-400 hover:bg-white/5 hover:text-white'
                  }`}
                >
                  <tab.icon />
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          <div className="p-5 sm:p-6">
            {ActiveComponent && <ActiveComponent />}
          </div>
        </section>
      </main>
    </div>
  )
}

export default Admin
