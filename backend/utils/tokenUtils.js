import jwt from 'jsonwebtoken'

// Generate JWT Token
export const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRE || '7d'
  })
}

// Send token response
export const sendTokenResponse = (user, statusCode, res) => {
  const token = generateToken(user._id)

  const userData = {
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

  res.status(statusCode).json({
    status: 'success',
    token,
    user: userData
  })
}
