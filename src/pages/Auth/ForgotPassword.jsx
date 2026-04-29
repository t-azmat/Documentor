import { useState } from 'react'
import { Link } from 'react-router-dom'
import { MdEmail, MdArrowBack } from 'react-icons/md'
import { FaCheckCircle, FaMoon, FaSun } from 'react-icons/fa'
import { authAPI } from '../../services/api'
import useTheme from '../../hooks/useTheme'

const ForgotPassword = () => {
  const { theme, isDark, toggleTheme } = useTheme()
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [emailSent, setEmailSent] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    
    try {
      await authAPI.forgotPassword(email)
      setEmailSent(true)
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to send reset email. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  if (emailSent) {
    return (
      <div className="documentor-shell min-h-screen bg-gradient-to-br from-primary-50 via-white to-accent-50 flex items-center justify-center p-4" data-theme={theme}>
        <button
          onClick={toggleTheme}
          className="fixed right-4 top-4 z-20 flex h-10 w-10 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-slate-300 shadow-lg transition hover:bg-white/10 hover:text-white"
          aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
          title={isDark ? 'Light mode' : 'Dark mode'}
        >
          {isDark ? <FaSun /> : <FaMoon />}
        </button>
        <div className="max-w-md w-full">
          <div className="card text-center">
            <div className="inline-flex items-center justify-center w-20 h-20 bg-green-100 rounded-full mb-6">
              <FaCheckCircle className="text-green-600 text-4xl" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-3">Check your email</h2>
            <p className="text-gray-600 mb-2">
              We've sent a password reset link to
            </p>
            <p className="text-primary-600 font-medium mb-6">{email}</p>
            <p className="text-sm text-gray-500 mb-6">
              Didn't receive the email? Check your spam folder or try again.
            </p>
            <button
              onClick={() => setEmailSent(false)}
              className="btn-secondary w-full mb-3"
            >
              Try another email
            </button>
            <Link to="/login" className="block text-center text-sm text-primary-600 hover:text-primary-700 font-medium">
              Back to sign in
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="documentor-shell min-h-screen bg-gradient-to-br from-primary-50 via-white to-accent-50 flex items-center justify-center p-4" data-theme={theme}>
      <button
        onClick={toggleTheme}
        className="fixed right-4 top-4 z-20 flex h-10 w-10 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-slate-300 shadow-lg transition hover:bg-white/10 hover:text-white"
        aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
        title={isDark ? 'Light mode' : 'Dark mode'}
      >
        {isDark ? <FaSun /> : <FaMoon />}
      </button>
      <div className="max-w-md w-full">
        {/* Back Button */}
        <Link 
          to="/login" 
          className="inline-flex items-center text-gray-600 hover:text-gray-900 mb-6 transition-colors"
        >
          <MdArrowBack className="mr-2" />
          Back to login
        </Link>

        {/* Logo and Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-primary-600 rounded-2xl mb-4">
            <span className="text-3xl font-bold text-white">D</span>
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Forgot your password?</h1>
          <p className="text-gray-600">No worries, we'll send you reset instructions</p>
        </div>

        {/* Main Card */}
        <div className="card">
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Error Message */}
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                {error}
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Email address
              </label>
              <div className="relative">
                <MdEmail className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 text-xl" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value)
                    setError('')
                  }}
                  placeholder="Enter your email"
                  className="input-field pl-12"
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full"
            >
              {loading ? 'Sending...' : 'Reset password'}
            </button>
          </form>

          <p className="text-center mt-6 text-sm text-gray-600">
            Remember your password?{' '}
            <Link to="/login" className="font-medium text-primary-600 hover:text-primary-700">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}

export default ForgotPassword
