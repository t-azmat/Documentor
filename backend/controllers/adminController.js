import User from '../models/User.js'
import Project from '../models/Project.js'
import Document from '../models/Document.js'
import FormattingJob from '../models/FormattingJob.js'
import StyleTemplate from '../models/StyleTemplate.js'
import AdminLog from '../models/AdminLog.js'
import { logAdminEvent } from '../services/adminLogService.js'

const serializeTemplate = (template) => ({
  id: template._id,
  _id: template._id,
  name: template.name,
  type: template.type,
  description: template.description,
  rules: template.rules || {},
  active: template.active,
  createdBy: template.createdBy,
  createdAt: template.createdAt,
  updatedAt: template.updatedAt
})

export const getAdminOverview = async (req, res, next) => {
  try {
    const [
      totalUsers,
      totalProjects,
      totalDocuments,
      totalTemplates,
      totalFormattingJobs,
      recentLogs,
      recentProjects,
      recentTemplates
    ] = await Promise.all([
      User.countDocuments(),
      Project.countDocuments(),
      Document.countDocuments(),
      StyleTemplate.countDocuments(),
      FormattingJob.countDocuments(),
      AdminLog.find().sort({ createdAt: -1 }).limit(8),
      Project.find().sort({ createdAt: -1 }).limit(6).populate('userId', 'name email'),
      StyleTemplate.find().sort({ createdAt: -1 }).limit(6).populate('createdBy', 'name email')
    ])

    res.status(200).json({
      status: 'success',
      overview: {
        counts: {
          users: totalUsers,
          projects: totalProjects,
          documents: totalDocuments,
          templates: totalTemplates,
          formattingJobs: totalFormattingJobs
        },
        system: {
          apiStatus: 'online',
          timestamp: new Date().toISOString(),
          nodeEnv: process.env.NODE_ENV || 'development'
        },
        recentLogs,
        recentProjects,
        recentTemplates: recentTemplates.map(serializeTemplate)
      }
    })
  } catch (error) {
    next(error)
  }
}

export const getAdminUsers = async (req, res, next) => {
  try {
    const users = await User.find().sort({ createdAt: -1 }).lean()
    const userIds = users.map((user) => user._id)

    const documentCounts = await Document.aggregate([
      { $match: { userId: { $in: userIds } } },
      { $group: { _id: '$userId', count: { $sum: 1 } } }
    ])

    const documentMap = new Map(documentCounts.map((item) => [String(item._id), item.count]))

    const enrichedUsers = users.map((user) => ({
      id: user._id,
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role || 'user',
      status: user.status || 'active',
      subscription: user.subscription,
      usage: user.usage,
      lastLogin: user.lastLogin,
      createdAt: user.createdAt,
      documentsCount: documentMap.get(String(user._id)) || 0
    }))

    res.status(200).json({
      status: 'success',
      users: enrichedUsers
    })
  } catch (error) {
    next(error)
  }
}

export const updateAdminUser = async (req, res, next) => {
  try {
    const { id } = req.params
    const { role, status } = req.body || {}

    const user = await User.findById(id)
    if (!user) {
      return res.status(404).json({ status: 'error', message: 'User not found' })
    }

    if (role) user.role = role
    if (status) user.status = status
    await user.save()

    await logAdminEvent({
      type: 'info',
      action: 'admin_user_updated',
      entityType: 'user',
      entityId: user._id.toString(),
      message: `Admin updated user ${user.email}`,
      details: `Role=${user.role}, Status=${user.status}`,
      metadata: { role: user.role, status: user.status },
      userId: req.user?._id
    })

    res.status(200).json({
      status: 'success',
      user: {
        id: user._id,
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        status: user.status,
        lastLogin: user.lastLogin
      }
    })
  } catch (error) {
    next(error)
  }
}

export const getAdminTemplates = async (req, res, next) => {
  try {
    const templates = await StyleTemplate.find()
      .sort({ updatedAt: -1 })
      .populate('createdBy', 'name email')

    res.status(200).json({
      status: 'success',
      templates: templates.map(serializeTemplate)
    })
  } catch (error) {
    next(error)
  }
}

export const createAdminTemplate = async (req, res, next) => {
  try {
    const template = await StyleTemplate.create({
      ...req.body,
      createdBy: req.user?._id || null
    })

    await logAdminEvent({
      type: 'info',
      action: 'template_created',
      entityType: 'template',
      entityId: template._id.toString(),
      message: `Template created: ${template.name}`,
      details: template.type,
      userId: req.user?._id
    })

    res.status(201).json({
      status: 'success',
      template: serializeTemplate(template)
    })
  } catch (error) {
    next(error)
  }
}

export const updateAdminTemplate = async (req, res, next) => {
  try {
    const template = await StyleTemplate.findByIdAndUpdate(
      req.params.id,
      { ...req.body },
      { new: true, runValidators: true }
    )

    if (!template) {
      return res.status(404).json({ status: 'error', message: 'Template not found' })
    }

    await logAdminEvent({
      type: 'info',
      action: 'template_updated',
      entityType: 'template',
      entityId: template._id.toString(),
      message: `Template updated: ${template.name}`,
      details: template.type,
      userId: req.user?._id
    })

    res.status(200).json({
      status: 'success',
      template: serializeTemplate(template)
    })
  } catch (error) {
    next(error)
  }
}

export const deleteAdminTemplate = async (req, res, next) => {
  try {
    const template = await StyleTemplate.findById(req.params.id)
    if (!template) {
      return res.status(404).json({ status: 'error', message: 'Template not found' })
    }

    await template.deleteOne()

    await logAdminEvent({
      type: 'warning',
      action: 'template_deleted',
      entityType: 'template',
      entityId: template._id.toString(),
      message: `Template deleted: ${template.name}`,
      details: template.type,
      userId: req.user?._id
    })

    res.status(200).json({
      status: 'success',
      message: 'Template deleted successfully'
    })
  } catch (error) {
    next(error)
  }
}

export const getAdminLogs = async (req, res, next) => {
  try {
    const { type } = req.query
    const query = {}
    if (type && type !== 'all') query.type = type

    const logs = await AdminLog.find(query)
      .sort({ createdAt: -1 })
      .limit(200)
      .populate('userId', 'name email')

    const stats = {
      totalLogs: await AdminLog.countDocuments(),
      errors: await AdminLog.countDocuments({ type: 'error' }),
      warnings: await AdminLog.countDocuments({ type: 'warning' }),
      info: await AdminLog.countDocuments({ type: 'info' })
    }

    res.status(200).json({
      status: 'success',
      logs,
      stats
    })
  } catch (error) {
    next(error)
  }
}

export const getAdminProjects = async (req, res, next) => {
  try {
    const projects = await Project.find()
      .sort({ createdAt: -1 })
      .populate('userId', 'name email')
      .populate('documents', 'title status')

    res.status(200).json({
      status: 'success',
      projects
    })
  } catch (error) {
    next(error)
  }
}

export const getAdminFormattingJobs = async (req, res, next) => {
  try {
    const jobs = await FormattingJob.find()
      .sort({ createdAt: -1 })
      .limit(100)
      .populate('userId', 'name email')
      .populate('documentId', 'title status')
      .lean()

    const stats = {
      total: await FormattingJob.countDocuments(),
      queued: await FormattingJob.countDocuments({ status: 'queued' }),
      running: await FormattingJob.countDocuments({ status: 'running' }),
      completed: await FormattingJob.countDocuments({ status: 'completed' }),
      failed: await FormattingJob.countDocuments({ status: 'failed' }),
      canceled: await FormattingJob.countDocuments({ status: 'canceled' })
    }

    res.status(200).json({
      status: 'success',
      jobs,
      stats
    })
  } catch (error) {
    next(error)
  }
}
