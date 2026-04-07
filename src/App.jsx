import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { lazy, Suspense } from 'react'
import Login from './pages/Auth/Login'
import Signup from './pages/Auth/Signup'
import ForgotPassword from './pages/Auth/ForgotPassword'
import Pricing from './pages/Pricing/Pricing'
import Dashboard from './pages/Dashboard/Dashboard'
import Documents from './pages/Documents/Documents'
import Projects from './pages/Projects/Projects'
import Templates from './pages/Templates/Templates'
import Citations from './pages/Citations/Citations'
import Plagiarism from './pages/Plagiarism/Plagiarism'
import AIDetectorPage from './pages/AIDetector/AIDetectorPage'
import GrammarEnhancerPage from './pages/GrammarEnhancer/GrammarEnhancerPage'
import FormattingPage from './pages/Formatting/FormattingPage'
import Admin from './pages/Admin/Admin'
import Layout from './components/Layout/Layout'
import useAuthStore from './store/authStore'

function App() {
  const { isAuthenticated } = useAuthStore()

  return (
    <Router>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/pricing" element={<Pricing />} />
        <Route 
          path="/dashboard" 
          element={isAuthenticated ? <Layout><Dashboard /></Layout> : <Navigate to="/login" />} 
        />
        <Route 
          path="/documents" 
          element={isAuthenticated ? <Layout><Documents /></Layout> : <Navigate to="/login" />} 
        />
        <Route 
          path="/projects" 
          element={isAuthenticated ? <Layout><Projects /></Layout> : <Navigate to="/login" />} 
        />
        <Route 
          path="/templates" 
          element={isAuthenticated ? <Layout><Templates /></Layout> : <Navigate to="/login" />} 
        />
        <Route 
          path="/citations" 
          element={isAuthenticated ? <Layout><Citations /></Layout> : <Navigate to="/login" />} 
        />
        <Route 
          path="/plagiarism" 
          element={isAuthenticated ? <Layout><Plagiarism /></Layout> : <Navigate to="/login" />} 
        />
        <Route 
          path="/ai-detector" 
          element={isAuthenticated ? <Layout><AIDetectorPage /></Layout> : <Navigate to="/login" />} 
        />
        <Route 
          path="/grammar-enhancer" 
          element={isAuthenticated ? <Layout><GrammarEnhancerPage /></Layout> : <Navigate to="/login" />} 
        />
        <Route 
          path="/formatting" 
          element={isAuthenticated ? <Layout><FormattingPage /></Layout> : <Navigate to="/login" />} 
        />
        <Route path="/admin" element={<Admin />} />
        <Route path="/" element={<Navigate to="/login" />} />
      </Routes>
    </Router>
  )
}

export default App
