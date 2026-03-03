import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
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
import { errorHandler } from './middleware/errorMiddleware.js'

// Load env vars
dotenv.config()

// Connect to database
connectDB()

const app = express()

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true
}))
app.use(express.json())
app.use(express.urlencoded({ extended: true }))

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

app.listen(PORT, () => {
  console.log(`🚀 Server running in ${process.env.NODE_ENV} mode on port ${PORT}`)
})

export default app
