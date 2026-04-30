import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'
import connectDB from './config/db.js'
import authRoutes from './routes/authRoutes.js'
import subscriptionRoutes from './routes/subscriptionRoutes.js'
import userRoutes from './routes/userRoutes.js'
import documentRoutes from './routes/documentRoutes.js'
import projectRoutes from './routes/projectRoutes.js'
import grammarRoutes from './routes/grammarRoutes.js'
import plagiarismRoutes from './routes/plagiarismRoutes.js'
import nlpRoutes from './routes/nlpRoutes.js'
import citationRoutes from './routes/citationRoutes.js'
import formattingJobRoutes from './routes/formattingJobRoutes.js'
import adminRoutes from './routes/adminRoutes.js'
import formattingJobQueue from './services/formattingJobQueue.js'
import { ensureAdminAccount } from './services/adminBootstrapService.js'
import { errorHandler } from './middleware/errorMiddleware.js'

// Load env vars
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const envPath = path.join(__dirname, '.env')
const envExamplePath = path.join(__dirname, '.env.example')
dotenv.config({ path: envPath })

if (!process.env.MONGODB_URI && !process.env.MONGO_URI) {
  dotenv.config({ path: envExamplePath })
}

const app = express()
const bodyParserLimit = process.env.BODY_PARSER_LIMIT || '5mb'
const defaultAllowedOrigins = [
  'http://localhost:3000',
  'http://localhost:5173',
  'http://127.0.0.1:3000',
  'http://127.0.0.1:5173'
]
const configuredOrigins = [
  process.env.FRONTEND_URL,
  ...(process.env.FRONTEND_URLS || '').split(',')
]
  .map((value) => String(value || '').trim())
  .filter(Boolean)

const allowedOrigins = [...new Set([...defaultAllowedOrigins, ...configuredOrigins])]
const defaultAllowedOriginPatterns = [
  /^https:\/\/documentor-one\.vercel\.app$/,
  /^https:\/\/documentor-[a-z0-9-]+-t-azmats-projects\.vercel\.app$/
]
const configuredOriginPatterns = (process.env.FRONTEND_ORIGIN_PATTERNS || '')
  .split(',')
  .map((value) => String(value || '').trim())
  .filter(Boolean)
  .map((value) => new RegExp(value))

const allowedOriginPatterns = [...defaultAllowedOriginPatterns, ...configuredOriginPatterns]
const corsOptions = {
  origin(origin, callback) {
    // Allow non-browser requests and local tools without an Origin header.
    if (!origin) {
      return callback(null, true)
    }

    if (allowedOrigins.includes(origin) || allowedOriginPatterns.some((pattern) => pattern.test(origin))) {
      return callback(null, true)
    }

    return callback(new Error(`CORS blocked for origin: ${origin}`))
  },
  credentials: true
}

// Middleware
app.use(cors(corsOptions))
app.options('*', cors(corsOptions))
app.use(express.json({ limit: bodyParserLimit }))
app.use(express.urlencoded({ limit: bodyParserLimit, extended: true }))

// Routes
app.use('/api/auth', authRoutes)
app.use('/api/subscriptions', subscriptionRoutes)
app.use('/api/users', userRoutes)
app.use('/api/documents', documentRoutes)
app.use('/api/projects', projectRoutes)
app.use('/api/grammar', grammarRoutes)
app.use('/api/plagiarism', plagiarismRoutes)
app.use('/api/nlp', nlpRoutes)
app.use('/api/citations', citationRoutes)
app.use('/api/formatting-jobs', formattingJobRoutes)
app.use('/api/admin', adminRoutes)

// Health check
app.get('/api/health', (req, res) => {
  res.status(200).json({ 
    status: 'success', 
    message: 'Documentor API is running',
    timestamp: new Date().toISOString()
  })
})

// Error handler
app.use(errorHandler)

const PORT = process.env.PORT || 5000

const startServer = async () => {
  await connectDB()
  await ensureAdminAccount()
  await formattingJobQueue.start()

  const server = app.listen(PORT, () => {
    console.log(`🚀 Server running in ${process.env.NODE_ENV} mode on port ${PORT}`)
  })

  const shutdown = async (signal) => {
    console.log(`[Server] Received ${signal}, shutting down formatting queue...`)
    await formattingJobQueue.stop()
    server.close(() => {
      process.exit(0)
    })
  }

  process.on('SIGINT', () => shutdown('SIGINT'))
  process.on('SIGTERM', () => shutdown('SIGTERM'))
}

startServer().catch((error) => {
  console.error('[Server] Failed to start:', error)
  process.exit(1)
})

export default app
