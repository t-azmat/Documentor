import AdminLog from '../models/AdminLog.js'

export const logAdminEvent = async ({
  type = 'info',
  action,
  entityType = '',
  entityId = '',
  message,
  details = '',
  metadata = {},
  userId = null
}) => {
  try {
    if (!action || !message) return null

    return await AdminLog.create({
      type,
      action,
      entityType,
      entityId,
      message,
      details,
      metadata,
      userId
    })
  } catch (error) {
    console.error('[AdminLog] Failed to persist log:', error.message)
    return null
  }
}
