import jwt from 'jsonwebtoken'
import User from '../models/User.js'

export const protect = async (req, res, next) => {
  let token

  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    try {
      // Get token from header
      token = req.headers.authorization.split(' ')[1]

      // Verify token
      const decoded = jwt.verify(token, process.env.JWT_SECRET)

      // Get user from token
      req.user = await User.findById(decoded.id).select('-password')

      if (!req.user) {
        return res.status(401).json({
          status: 'error',
          message: 'User not found'
        })
      }

      // Reset monthly usage if needed
      req.user.resetMonthlyUsage()
      
      next()
    } catch (error) {
      console.error(error)
      return res.status(401).json({
        status: 'error',
        message: 'Not authorized, token failed'
      })
    }
  }

  if (!token) {
    return res.status(401).json({
      status: 'error',
      message: 'Not authorized, no token'
    })
  }
}

// Check subscription plan
export const requirePlan = (...plans) => {
  return (req, res, next) => {
    if (!plans.includes(req.user.subscription.plan)) {
      return res.status(403).json({
        status: 'error',
        message: `This feature requires ${plans.join(' or ')} plan`,
        currentPlan: req.user.subscription.plan
      })
    }
    next()
  }
}

// Check feature access
export const requireFeature = (feature) => {
  return (req, res, next) => {
    if (!req.user.hasFeatureAccess(feature)) {
      return res.status(403).json({
        status: 'error',
        message: `Your plan does not include access to ${feature}`,
        currentPlan: req.user.subscription.plan
      })
    }
    next()
  }
}

export const requireRole = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        status: 'error',
        message: 'Not authorized'
      })
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        status: 'error',
        message: 'You do not have permission to access this resource'
      })
    }

    next()
  }
}
