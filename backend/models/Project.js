import mongoose from 'mongoose'

const projectSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  name: {
    type: String,
    required: [true, 'Please provide a project name'],
    trim: true
  },
  description: {
    type: String,
    trim: true
  },
  category: {
    type: String,
    enum: ['thesis', 'research-paper', 'conference', 'journal', 'coursework', 'other'],
    default: 'other'
  },
  color: {
    type: String,
    default: '#3B82F6' // Blue
  },
  icon: {
    type: String,
    default: 'folder'
  },
  status: {
    type: String,
    enum: ['active', 'completed', 'archived'],
    default: 'active'
  },
  deadline: {
    type: Date,
    default: null
  },
  documents: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Document'
  }],
  stats: {
    totalDocuments: {
      type: Number,
      default: 0
    },
    completedDocuments: {
      type: Number,
      default: 0
    },
    totalWords: {
      type: Number,
      default: 0
    }
  }
}, {
  timestamps: true
})

// Index for faster queries
projectSchema.index({ userId: 1, status: 1 })

const Project = mongoose.model('Project', projectSchema)

export default Project
