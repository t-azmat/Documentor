import User from '../models/User.js'
import { logAdminEvent } from './adminLogService.js'

const isEnabled = () => String(process.env.ADMIN_BOOTSTRAP_ENABLED || '').toLowerCase() === 'true'
const shouldResetPassword = () => String(process.env.ADMIN_RESET_PASSWORD_ON_START || '').toLowerCase() === 'true'

export const ensureAdminAccount = async () => {
  if (!isEnabled()) {
    console.log('[Admin Bootstrap] Skipped: ADMIN_BOOTSTRAP_ENABLED is not true')
    return
  }

  const email = (process.env.ADMIN_EMAIL || '').trim().toLowerCase()
  const password = process.env.ADMIN_PASSWORD || ''
  const name = (process.env.ADMIN_NAME || 'System Administrator').trim()
  const status = (process.env.ADMIN_STATUS || 'active').trim()

  if (!email || !password) {
    console.warn('[Admin Bootstrap] Skipped: ADMIN_EMAIL or ADMIN_PASSWORD is missing')
    return
  }

  let user = await User.findOne({ email }).select('+password')
  let action = 'updated'

  if (!user) {
    user = await User.create({
      name,
      email,
      password,
      role: 'admin',
      status,
      authProvider: 'local',
      emailVerified: true
    })
    action = 'created'
  } else {
    user.name = name
    user.role = 'admin'
    user.status = status
    user.authProvider = 'local'
    user.emailVerified = true

    if (shouldResetPassword()) {
      user.password = password
    }

    await user.save()
  }

  await logAdminEvent({
    type: 'info',
    action: action === 'created' ? 'admin_bootstrap_created' : 'admin_bootstrap_updated',
    entityType: 'user',
    entityId: user._id.toString(),
    message: `Admin account ${action}: ${user.email}`,
    details: 'Environment bootstrap',
    userId: user._id,
    metadata: {
      role: user.role,
      status: user.status,
      passwordResetOnStart: shouldResetPassword()
    }
  })

  console.log(`[Admin Bootstrap] Admin account ${action} for ${user.email}`)
}
