import mongoose from 'mongoose'

const styleTemplateSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  type: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    trim: true,
    default: ''
  },
  rules: {
    titleFormat: { type: String, default: '' },
    headingFormat: { type: String, default: '' },
    citationFormat: { type: String, default: '' },
    referenceFormat: { type: String, default: '' },
    margins: { type: String, default: '' },
    fontSize: { type: String, default: '' },
    lineSpacing: { type: String, default: '' }
  },
  active: {
    type: Boolean,
    default: true
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  }
}, {
  timestamps: true
})

styleTemplateSchema.index({ type: 1, createdAt: -1 })

const StyleTemplate = mongoose.model('StyleTemplate', styleTemplateSchema)

export default StyleTemplate
