import mongoose from 'mongoose'

const adminLogSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ['info', 'warning', 'error'],
    default: 'info'
  },
  action: {
    type: String,
    required: true,
    trim: true
  },
  entityType: {
    type: String,
    trim: true,
    default: ''
  },
  entityId: {
    type: String,
    default: ''
  },
  message: {
    type: String,
    required: true,
    trim: true
  },
  details: {
    type: String,
    default: ''
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  }
}, {
  timestamps: true
})

adminLogSchema.index({ createdAt: -1 })
adminLogSchema.index({ type: 1, createdAt: -1 })

const AdminLog = mongoose.model('AdminLog', adminLogSchema)

export default AdminLog
