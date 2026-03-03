import mongoose from 'mongoose'
import bcrypt from 'bcryptjs'

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Please provide a name'],
    trim: true
  },
  email: {
    type: String,
    required: [true, 'Please provide an email'],
    unique: true,
    lowercase: true,
    trim: true,
    match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please provide a valid email']
  },
  password: {
    type: String,
    required: [true, 'Please provide a password'],
    minlength: 8,
    select: false
  },
  authProvider: {
    type: String,
    enum: ['local', 'google', 'facebook', 'apple'],
    default: 'local'
  },
  providerId: {
    type: String,
    default: null
  },
  avatar: {
    type: String,
    default: null
  },
  emailVerified: {
    type: Boolean,
    default: false
  },
  subscription: {
    plan: {
      type: String,
      enum: ['free', 'premium', 'team'],
      default: 'free'
    },
    status: {
      type: String,
      enum: ['active', 'inactive', 'cancelled', 'past_due'],
      default: 'active'
    },
    billingCycle: {
      type: String,
      enum: ['monthly', 'annual'],
      default: 'monthly'
    },
    startDate: {
      type: Date,
      default: Date.now
    },
    endDate: {
      type: Date,
      default: null
    },
    stripeCustomerId: {
      type: String,
      default: null
    },
    stripeSubscriptionId: {
      type: String,
      default: null
    },
    amount: {
      type: Number,
      default: 0
    }
  },
  usage: {
    documentsProcessed: {
      type: Number,
      default: 0
    },
    documentsThisMonth: {
      type: Number,
      default: 0
    },
    plagiarismChecksUsed: {
      type: Number,
      default: 0
    },
    storageUsed: {
      type: Number,
      default: 0 // in bytes
    },
    lastResetDate: {
      type: Date,
      default: Date.now
    }
  },
  resetPasswordToken: String,
  resetPasswordExpire: Date,
  emailVerificationToken: String,
  emailVerificationExpire: Date
}, {
  timestamps: true
})

// Encrypt password before saving
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) {
    next()
  }
  
  const salt = await bcrypt.genSalt(10)
  this.password = await bcrypt.hash(this.password, salt)
})

// Match password
userSchema.methods.matchPassword = async function(enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password)
}

// Reset monthly usage
userSchema.methods.resetMonthlyUsage = function() {
  const now = new Date()
  const lastReset = new Date(this.usage.lastResetDate)
  
  // If more than 30 days have passed
  if (now - lastReset > 30 * 24 * 60 * 60 * 1000) {
    this.usage.documentsThisMonth = 0
    this.usage.plagiarismChecksUsed = 0
    this.usage.lastResetDate = now
  }
}

// Check if user has access to feature
userSchema.methods.hasFeatureAccess = function(feature) {
  const plan = this.subscription.plan
  
  const features = {
    free: ['basic_formatting', 'grammar_check', 'pdf_export'],
    premium: ['basic_formatting', 'grammar_check', 'pdf_export', 'all_formats', 
               'citation_assistant', 'plagiarism_check', 'advanced_formatting', 
               'docx_export', 'latex_export'],
    team: ['basic_formatting', 'grammar_check', 'pdf_export', 'all_formats', 
           'citation_assistant', 'plagiarism_check', 'advanced_formatting', 
           'docx_export', 'latex_export', 'team_collaboration', 'custom_templates',
           'api_access', 'priority_support']
  }
  
  return features[plan]?.includes(feature) || false
}

// Get usage limits
userSchema.methods.getUsageLimits = function() {
  const limits = {
    free: {
      documentsPerMonth: 5,
      plagiarismChecksPerMonth: 0,
      storageLimit: 100 * 1024 * 1024 // 100MB
    },
    premium: {
      documentsPerMonth: -1, // unlimited
      plagiarismChecksPerMonth: 10,
      storageLimit: 10 * 1024 * 1024 * 1024 // 10GB
    },
    team: {
      documentsPerMonth: -1, // unlimited
      plagiarismChecksPerMonth: -1, // unlimited
      storageLimit: 100 * 1024 * 1024 * 1024 // 100GB
    }
  }
  
  return limits[this.subscription.plan]
}

const User = mongoose.model('User', userSchema)

export default User
