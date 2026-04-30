import { useMemo, useState } from 'react'
import { useNavigate, useLocation, Link } from 'react-router-dom'
import {
  FaAlignLeft,
  FaBars,
  FaBell,
  FaBook,
  FaCode,
  FaCrown,
  FaFileAlt,
  FaFilePdf,
  FaFileWord,
  FaFolder,
  FaMagic,
  FaQuoteRight,
  FaRobot,
  FaSearch,
  FaSignOutAlt,
  FaMoon,
  FaSun,
  FaTimes,
  FaUpload,
} from 'react-icons/fa'
import { MdDashboard } from 'react-icons/md'
import useAuthStore from '../../store/authStore'
import useTheme from '../../hooks/useTheme'
import BrandMark from '../BrandLogo/BrandMark'

const menuItems = [
  { icon: MdDashboard, label: 'Dashboard', path: '/dashboard' },
  { icon: FaFileAlt, label: 'Documents', path: '/documents' },
  { icon: FaFolder, label: 'Projects', path: '/projects' },
  { icon: FaBook, label: 'Templates', path: '/templates' },
  { icon: FaMagic, label: 'Grammar Enhancer', path: '/grammar-enhancer' },
  { icon: FaAlignLeft, label: 'Formatting', path: '/formatting', formats: true },
  { icon: FaQuoteRight, label: 'Citations', path: '/citations' },
  { icon: FaSearch, label: 'Plagiarism', path: '/plagiarism' },
  { icon: FaRobot, label: 'AI Detector', path: '/ai-detector' },
]

const titles = {
  '/dashboard': 'Dashboard',
  '/documents': 'Documents',
  '/projects': 'Projects',
  '/templates': 'Templates',
  '/grammar-enhancer': 'Grammar Enhancer',
  '/formatting': 'Document Formatting',
  '/citations': 'Citation Manager',
  '/plagiarism': 'Plagiarism Check',
  '/ai-detector': 'AI Content Detector',
}

const Layout = ({ children }) => {
  const navigate = useNavigate()
  const location = useLocation()
  const { user, subscription, logout } = useAuthStore()
  const { theme, isDark, toggleTheme } = useTheme()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')

  const pageTitle = titles[location.pathname] || 'DocuMentor'
  const initials = useMemo(() => {
    const source = user?.name || user?.fullName || user?.email || 'DM'
    return source
      .split(/[ @._-]+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join('') || 'DM'
  }, [user])

  const planName = subscription?.plan || user?.subscription?.plan || 'Free'
  const used = subscription?.usage?.documentsThisMonth || user?.usage?.documentsThisMonth || 0
  const limit = subscription?.limits?.documentsPerMonth || user?.limits?.documentsPerMonth || 5
  const percent = Math.min(100, Math.round((used / Math.max(limit, 1)) * 100))

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  const isActive = (path) => location.pathname === path

  const handleSearchSubmit = (event) => {
    event.preventDefault()
    if (searchQuery.trim()) navigate('/documents')
  }

  return (
    <div className="documentor-shell flex h-screen overflow-hidden" data-theme={theme}>
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-64 flex-col overflow-hidden border-r border-white/10 bg-[#11141b] shadow-2xl transition-transform duration-300 ease-in-out ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        } lg:translate-x-0`}
      >
        <div className="pointer-events-none absolute -left-24 -top-24 h-72 w-72 rounded-full bg-amber-400/10 blur-3xl" />

        <div className="relative flex items-center justify-between border-b border-white/10 px-5 py-5">
          <Link to="/dashboard" className="flex min-w-0 items-center gap-3 transition-opacity hover:opacity-90">
            <BrandMark className="h-10 w-10 flex-shrink-0" />
            <div className="min-w-0">
              <h1 className="truncate text-lg font-black tracking-normal text-white">
                Docu<span className="text-[#8b5cf6]">Mentor</span>
              </h1>
              <p className="truncate text-[11px] font-medium text-slate-400">Academic document suite</p>
            </div>
          </Link>
          <button
            onClick={() => setSidebarOpen(false)}
            className="rounded-lg p-2 text-slate-300 transition-colors hover:bg-white/10 hover:text-white lg:hidden"
            aria-label="Close navigation"
          >
            <FaTimes />
          </button>
        </div>

        <div className="px-5 pb-2 pt-5 text-[10px] font-bold uppercase tracking-[0.22em] text-slate-500">
          Workspace
        </div>

        <nav className="relative flex-1 space-y-1 overflow-y-auto px-3 pb-4">
          {menuItems.map((item) => {
            const Icon = item.icon
            return (
              <button
                key={item.path}
                onClick={() => {
                  navigate(item.path)
                  setSidebarOpen(false)
                }}
                className={`group relative flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition-all duration-200 ${
                  isActive(item.path)
                    ? 'bg-[#8b5cf6]/10 text-[#8b5cf6] shadow-[inset_3px_0_0_#8b5cf6]'
                    : 'text-slate-400 hover:bg-white/10 hover:text-white'
                }`}
              >
                <Icon className="h-4 w-4 flex-shrink-0" />
                <span className="min-w-0 flex-1 truncate font-medium">{item.label}</span>
                {item.formats && (
                  <span className="hidden items-center gap-1 sm:flex">
                    <FaFilePdf className="text-[11px] text-rose-400" />
                    <FaFileWord className="text-[11px] text-sky-400" />
                    <FaCode className="text-[11px] text-emerald-400" />
                  </span>
                )}
              </button>
            )
          })}
        </nav>

        <div className="relative border-t border-white/10 p-4">
          <div className="rounded-lg border border-[#8b5cf6]/20 bg-[#8b5cf6]/10 p-3">
            <div className="mb-1 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#8b5cf6]">
              <FaCrown />
              {planName} Plan
            </div>
            <p className="mb-3 text-xs text-slate-400">
              {Math.max(limit - used, 0)} documents remaining
            </p>
            <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full rounded-full bg-[#8b5cf6] transition-all duration-500"
                style={{ width: `${percent}%` }}
              />
            </div>
            <button
              onClick={() => navigate('/pricing')}
              className="mt-3 flex w-full items-center justify-center gap-2 rounded-md bg-[#8b5cf6] px-3 py-2 text-xs font-black text-white transition hover:opacity-90"
            >
              Upgrade
            </button>
          </div>

          <button
            onClick={handleLogout}
            className="mt-3 flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-slate-400 transition-colors hover:bg-white/10 hover:text-white"
          >
            <FaSignOutAlt className="h-4 w-4" />
            Logout
          </button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden lg:ml-64">
        <header className="flex h-16 min-h-16 items-center gap-3 border-b border-white/10 bg-[#11141b] px-4 shadow-sm sm:px-6">
          <button
            onClick={() => setSidebarOpen(true)}
            className="rounded-lg border border-white/10 bg-white/5 p-2 text-slate-200 transition hover:bg-white/10 lg:hidden"
            aria-label="Open navigation"
          >
            <FaBars />
          </button>

          <div className="min-w-0 flex-1">
            <h2 className="truncate text-lg font-black text-white sm:text-xl">
              {pageTitle.split(' ')[0]}
              {pageTitle.includes(' ') && (
                <span className="text-[#8b5cf6]"> {pageTitle.split(' ').slice(1).join(' ')}</span>
              )}
            </h2>
          </div>

          <form
            onSubmit={handleSearchSubmit}
            className="hidden w-64 items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-slate-300 md:flex"
          >
            <FaSearch className="h-3.5 w-3.5 text-slate-500" />
            <input
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search documents..."
              className="w-full bg-transparent text-sm text-slate-100 outline-none placeholder:text-slate-500"
            />
          </form>

          <button
            className="relative hidden h-9 w-9 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-slate-300 transition hover:bg-white/10 hover:text-white sm:flex"
            aria-label="Notifications"
          >
            <FaBell className="h-4 w-4" />
            <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-[#8b5cf6]" />
          </button>

          <button
            onClick={toggleTheme}
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-slate-300 transition hover:bg-white/10 hover:text-white"
            aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
            title={isDark ? 'Light mode' : 'Dark mode'}
          >
            {isDark ? <FaSun className="h-4 w-4" /> : <FaMoon className="h-4 w-4" />}
          </button>

          <button
            onClick={() => navigate('/documents')}
            className="hidden h-9 w-9 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-slate-300 transition hover:bg-white/10 hover:text-white sm:flex"
            aria-label="Upload"
          >
            <FaUpload className="h-4 w-4" />
          </button>

          <div className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-[#8b5cf6]/30 bg-[#8b5cf6] text-xs font-black text-white">
            {initials}
          </div>
        </header>

        <main className="flex-1 overflow-x-hidden overflow-y-auto bg-[#0c0e13]">
          {children}
        </main>
      </div>

      {sidebarOpen && (
        <button
          className="fixed inset-0 z-40 bg-black/60 lg:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-label="Close navigation overlay"
        />
      )}
    </div>
  )
}

export default Layout
