import crypto from 'crypto'
import User from '../models/User.js'
import { sendTokenResponse } from '../utils/tokenUtils.js'

// @desc    Register user
// @route   POST /api/auth/register
// @access  Public
export const register = async (req, res, next) => {
  try {
    const { name, email, password } = req.body

    // Check if user exists
    const userExists = await User.findOne({ email })
    if (userExists) {
      return res.status(400).json({
        status: 'error',
        message: 'User already exists with this email'
      })
    }

    // Create user
    const user = await User.create({
      name,
      email,
      password,
      authProvider: 'local'
    })

    sendTokenResponse(user, 201, res)
  } catch (error) {
    next(error)
  }
}

// @desc    Login user
// @route   POST /api/auth/login
// @access  Public
export const login = async (req, res, next) => {
  try {
    const { email, password } = req.body

    // Validate email & password
    if (!email || !password) {
      return res.status(400).json({
        status: 'error',
        message: 'Please provide email and password'
      })
    }

    // Check for user
    const user = await User.findOne({ email }).select('+password')
    if (!user) {
      return res.status(401).json({
        status: 'error',
        message: 'Invalid credentials'
      })
    }

    // Check if password matches
    const isMatch = await user.matchPassword(password)
    if (!isMatch) {
      return res.status(401).json({
        status: 'error',
        message: 'Invalid credentials'
      })
    }

    sendTokenResponse(user, 200, res)
  } catch (error) {
    next(error)
  }
}

// @desc    Get current logged in user
// @route   GET /api/auth/me
// @access  Private
export const getMe = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id)

    res.status(200).json({
      status: 'success',
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        avatar: user.avatar,
        emailVerified: user.emailVerified,
        authProvider: user.authProvider,
        subscription: user.subscription,
        usage: user.usage,
        createdAt: user.createdAt
      }
    })
  } catch (error) {
    next(error)
  }
}

// @desc    Forgot password
// @route   POST /api/auth/forgot-password
// @access  Public
export const forgotPassword = async (req, res, next) => {
  try {
    const { email } = req.body

    const user = await User.findOne({ email })
    if (!user) {
      return res.status(404).json({
        status: 'error',
        message: 'No user found with that email'
      })
    }

    // Generate reset token
    const resetToken = crypto.randomBytes(32).toString('hex')
    
    user.resetPasswordToken = crypto
      .createHash('sha256')
      .update(resetToken)
      .digest('hex')
    
    user.resetPasswordExpire = Date.now() + 10 * 60 * 1000 // 10 minutes

    await user.save()

    // Create reset url
    const resetUrl = `${process.env.FRONTEND_URL}/reset-password/${resetToken}`

    // TODO: Send email with reset link
    // For now, just return success
    console.log('Reset URL:', resetUrl)

    res.status(200).json({
      status: 'success',
      message: 'Password reset email sent',
      resetToken: process.env.NODE_ENV === 'development' ? resetToken : undefined
    })
  } catch (error) {
    next(error)
  }
}

// @desc    Reset password
// @route   PUT /api/auth/reset-password/:token
// @access  Public
export const resetPassword = async (req, res, next) => {
  try {
    const { password } = req.body
    
    // Get hashed token
    const resetPasswordToken = crypto
      .createHash('sha256')
      .update(req.params.token)
      .digest('hex')

    const user = await User.findOne({
      resetPasswordToken,
      resetPasswordExpire: { $gt: Date.now() }
    })

    if (!user) {
      return res.status(400).json({
        status: 'error',
        message: 'Invalid or expired token'
      })
    }

    // Set new password
    user.password = password
    user.resetPasswordToken = undefined
    user.resetPasswordExpire = undefined
    await user.save()

    sendTokenResponse(user, 200, res)
  } catch (error) {
    next(error)
  }
}

// @desc    Social login (Google, Facebook, Apple)
// @route   POST /api/auth/social
// @access  Public
export const socialLogin = async (req, res, next) => {
  try {
    const { provider, providerId, email, name, avatar } = req.body

    // Check if user exists with this provider
    let user = await User.findOne({ providerId, authProvider: provider })

    if (!user) {
      // Check if user exists with same email
      user = await User.findOne({ email })
      
      if (user) {
        // Update existing user with provider info
        user.authProvider = provider
        user.providerId = providerId
        user.avatar = avatar || user.avatar
        user.emailVerified = true
        await user.save()
      } else {
        // Create new user
        user = await User.create({
          name,
          email,
          authProvider: provider,
          providerId,
          avatar,
          emailVerified: true,
          password: crypto.randomBytes(32).toString('hex') // Random password for social login
        })
      }
    }

    sendTokenResponse(user, 200, res)
  } catch (error) {
    next(error)
  }
}

// @desc    Logout user
// @route   POST /api/auth/logout
// @access  Private
export const logout = async (req, res, next) => {
  try {
    res.status(200).json({
      status: 'success',
      message: 'Logged out successfully'
    })
  } catch (error) {
    next(error)
  }
}
