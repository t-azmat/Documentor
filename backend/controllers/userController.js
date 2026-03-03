import User from '../models/User.js'

// @desc    Get user profile
// @route   GET /api/users/profile
// @access  Private
export const getUserProfile = async (req, res, next) => {
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

// @desc    Update user profile
// @route   PUT /api/users/profile
// @access  Private
export const updateUserProfile = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id)

    if (!user) {
      return res.status(404).json({
        status: 'error',
        message: 'User not found'
      })
    }

    user.name = req.body.name || user.name
    user.avatar = req.body.avatar || user.avatar

    if (req.body.email && req.body.email !== user.email) {
      // Check if email already exists
      const emailExists = await User.findOne({ email: req.body.email })
      if (emailExists) {
        return res.status(400).json({
          status: 'error',
          message: 'Email already in use'
        })
      }
      user.email = req.body.email
      user.emailVerified = false
    }

    const updatedUser = await user.save()

    res.status(200).json({
      status: 'success',
      user: {
        id: updatedUser._id,
        name: updatedUser.name,
        email: updatedUser.email,
        avatar: updatedUser.avatar,
        emailVerified: updatedUser.emailVerified,
        authProvider: updatedUser.authProvider,
        subscription: updatedUser.subscription,
        usage: updatedUser.usage
      }
    })
  } catch (error) {
    next(error)
  }
}

// @desc    Update password
// @route   PUT /api/users/password
// @access  Private
export const updatePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body

    const user = await User.findById(req.user.id).select('+password')

    // Check current password
    const isMatch = await user.matchPassword(currentPassword)
    if (!isMatch) {
      return res.status(401).json({
        status: 'error',
        message: 'Current password is incorrect'
      })
    }

    // Update password
    user.password = newPassword
    await user.save()

    res.status(200).json({
      status: 'success',
      message: 'Password updated successfully'
    })
  } catch (error) {
    next(error)
  }
}

// @desc    Get user usage statistics
// @route   GET /api/users/usage
// @access  Private
export const getUserUsage = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id)
    const limits = user.getUsageLimits()

    res.status(200).json({
      status: 'success',
      usage: user.usage,
      limits,
      subscription: user.subscription
    })
  } catch (error) {
    next(error)
  }
}

// @desc    Delete user account
// @route   DELETE /api/users/account
// @access  Private
export const deleteUserAccount = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id)

    // Cancel subscription if active
    if (user.subscription.stripeSubscriptionId) {
      const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)
      await stripe.subscriptions.cancel(user.subscription.stripeSubscriptionId)
    }

    await user.deleteOne()

    res.status(200).json({
      status: 'success',
      message: 'Account deleted successfully'
    })
  } catch (error) {
    next(error)
  }
}
