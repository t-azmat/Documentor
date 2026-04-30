import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { FaApple, FaFacebook, FaGoogle, FaMoon, FaShieldAlt, FaSun } from 'react-icons/fa'
import { FaUserShield } from 'react-icons/fa6'
import { MdEmail, MdLock } from 'react-icons/md'
import useAuthStore from '../../store/authStore'
import { authAPI } from '../../services/api'
import useTheme from '../../hooks/useTheme'
import BrandMark from '../../components/BrandLogo/BrandMark'

const Login = () => {
  const navigate = useNavigate()
  const { login } = useAuthStore()
  const { theme, isDark, toggleTheme } = useTheme()
  const [formData, setFormData] = useState({
    email: '',
    password: '',
  })
  const [rememberMe, setRememberMe] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value })
    setError('')
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const response = await authAPI.login(formData)
      login(response.data.user, response.data.token)
      navigate('/dashboard')
    } catch (err) {
      setError(err.response?.data?.message || 'Login failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleSocialLogin = (provider) => {
    console.log(`Login with ${provider}`)
    alert(`${provider} login will be implemented with OAuth`)
  }

  return (
    <div className="documentor-shell auth-animated-bg min-h-screen overflow-hidden bg-[#0c0e13] text-slate-100" data-theme={theme}>
      <header className="absolute inset-x-0 top-0 z-20 flex h-16 items-center justify-end bg-transparent px-4 sm:px-6">
        <button
          onClick={toggleTheme}
          className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-slate-300 transition hover:bg-white/10 hover:text-white"
          aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
          title={isDark ? 'Light mode' : 'Dark mode'}
        >
          {isDark ? <FaSun className="h-4 w-4" /> : <FaMoon className="h-4 w-4" />}
        </button>
      </header>
      <div className="mx-auto grid min-h-screen w-full max-w-6xl grid-cols-1 items-center gap-8 px-4 py-8 lg:grid-cols-[1fr_440px] lg:px-8">
        <section className="relative hidden min-h-[680px] overflow-hidden rounded-xl border border-white/10 bg-[#11141b] p-8 shadow-2xl lg:flex lg:flex-col lg:justify-between">
          <div className="pointer-events-none absolute -left-32 -top-32 h-96 w-96 rounded-full bg-[#8b5cf6]/15 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-28 right-4 h-80 w-80 rounded-full bg-sky-500/10 blur-3xl" />

          <div className="relative">
            <div className="mb-10 flex items-center gap-3">
              <BrandMark className="h-11 w-11 flex-shrink-0" />
              <div>
                <h1 className="text-xl font-black">
                  Docu<span className="text-[#8b5cf6]">Mentor</span>
                </h1>
                <p className="text-xs font-medium text-slate-400">Academic document intelligence</p>
              </div>
            </div>

            <p className="max-w-xl text-5xl font-black leading-tight tracking-normal text-white">
              Format, check, cite, and polish research documents in one workspace.
            </p>
            <p className="mt-5 max-w-lg text-base leading-7 text-slate-400">
              A focused suite for students, researchers, and admins managing document quality from upload to final export.
            </p>
          </div>

          <div className="relative grid grid-cols-3 gap-3">
            {[
              ['Grammar', 'AI revision'],
              ['Citations', 'Source checks'],
              ['Admin', 'System control'],
            ].map(([label, detail]) => (
              <div key={label} className="rounded-lg border border-white/10 bg-white/5 p-4">
                <p className="text-sm font-bold text-white">{label}</p>
                <p className="mt-1 text-xs text-slate-500">{detail}</p>
              </div>
            ))}
          </div>
        </section>

        <main className="mx-auto w-full max-w-md">
          <div className="mb-8 text-center lg:text-left">
            <BrandMark className="mb-4 inline-block h-14 w-14" />
            <h1 className="text-3xl font-black text-white">Welcome back</h1>
            <p className="mt-2 text-sm text-slate-400">Sign in to continue formatting your documents</p>
          </div>

          <div className="rounded-xl border border-white/10 bg-[#13161e] p-6 shadow-2xl">
            <div className="space-y-3">
              <button
                onClick={() => handleSocialLogin('google')}
                className="flex w-full items-center justify-center gap-3 rounded-lg border border-white/10 bg-white/5 px-4 py-3 transition-colors duration-200 hover:bg-white/10"
              >
                <FaGoogle className="text-xl text-red-500" />
                <span className="font-medium text-slate-100">Continue with Google</span>
              </button>
              <button
                onClick={() => handleSocialLogin('facebook')}
                className="flex w-full items-center justify-center gap-3 rounded-lg border border-white/10 bg-white/5 px-4 py-3 transition-colors duration-200 hover:bg-white/10"
              >
                <FaFacebook className="text-xl text-blue-500" />
                <span className="font-medium text-slate-100">Continue with Facebook</span>
              </button>
              <button
                onClick={() => handleSocialLogin('apple')}
                className="flex w-full items-center justify-center gap-3 rounded-lg border border-white/10 bg-white/5 px-4 py-3 transition-colors duration-200 hover:bg-white/10"
              >
                <FaApple className="text-xl text-slate-100" />
                <span className="font-medium text-slate-100">Continue with Apple</span>
              </button>
            </div>

            <div className="relative my-6">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-white/10" />
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="bg-[#13161e] px-4 text-slate-500">Or continue with email</span>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="rounded-lg border border-red-400/25 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                  {error}
                </div>
              )}

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-300">
                  Email address
                </label>
                <div className="relative">
                  <MdEmail className="absolute left-4 top-1/2 -translate-y-1/2 text-xl text-slate-500" />
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    placeholder="Enter your email"
                    className="w-full rounded-lg border border-white/10 bg-[#1a1e29] px-4 py-3 pl-12 text-slate-100 outline-none transition placeholder:text-slate-600 focus:border-[#8b5cf6]/60 focus:ring-4 focus:ring-[#8b5cf6]/10"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-300">
                  Password
                </label>
                <div className="relative">
                  <MdLock className="absolute left-4 top-1/2 -translate-y-1/2 text-xl text-slate-500" />
                  <input
                    type="password"
                    name="password"
                    value={formData.password}
                    onChange={handleChange}
                    placeholder="Enter your password"
                    className="w-full rounded-lg border border-white/10 bg-[#1a1e29] px-4 py-3 pl-12 text-slate-100 outline-none transition placeholder:text-slate-600 focus:border-[#8b5cf6]/60 focus:ring-4 focus:ring-[#8b5cf6]/10"
                    required
                  />
                </div>
              </div>

              <div className="flex items-center justify-between">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="h-4 w-4 rounded border-white/20 bg-[#1a1e29] text-[#8b5cf6] focus:ring-[#8b5cf6]"
                  />
                  <span className="ml-2 text-sm text-slate-400">Remember me</span>
                </label>
                <Link
                  to="/forgot-password"
                  className="text-sm font-medium text-[#8b5cf6] hover:text-[#a78bfa]"
                >
                  Forgot password?
                </Link>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-lg bg-[#8b5cf6] px-6 py-3 font-black text-white transition hover:bg-[#7c3aed] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? 'Signing in...' : 'Sign in'}
              </button>
            </form>

            <div className="mt-4 rounded-lg border border-[#8b5cf6]/20 bg-[#8b5cf6]/10 p-4">
              <div className="flex items-start gap-3">
                <div className="rounded-lg bg-[#8b5cf6] p-2 text-white shadow-sm">
                  <FaUserShield />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-slate-100">Admin Access</h3>
                  <p className="mt-1 text-sm text-slate-400">
                    Sign in with your admin account, then open the administration workspace for logs, users, projects, and templates.
                  </p>
                  <div className="mt-3">
                    <Link
                      to="/admin"
                      className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-[#8b5cf6] transition-colors hover:bg-white/10"
                    >
                      <FaShieldAlt />
                      View Admin Stats
                    </Link>
                  </div>
                </div>
              </div>
            </div>

            <p className="mt-6 text-center text-sm text-slate-400">
              Don't have an account?{' '}
              <Link to="/signup" className="font-medium text-[#8b5cf6] hover:text-[#a78bfa]">
                Sign up for free
              </Link>
            </p>
          </div>

          <p className="mt-6 text-center text-xs text-slate-500">
            By signing in, you agree to our{' '}
            <a href="#" className="text-[#8b5cf6] hover:underline">Terms of Service</a>
            {' '}and{' '}
            <a href="#" className="text-[#8b5cf6] hover:underline">Privacy Policy</a>
          </p>
        </main>
      </div>
    </div>
  )
}

export default Login
