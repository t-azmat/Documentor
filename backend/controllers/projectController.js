import Project from '../models/Project.js'
import Document from '../models/Document.js'

// @desc    Create project
// @route   POST /api/projects
// @access  Private
export const createProject = async (req, res, next) => {
  try {
    const { name, description, category, color, icon, deadline } = req.body

    const project = await Project.create({
      userId: req.user.id,
      name,
      description,
      category,
      color,
      icon,
      deadline
    })

    res.status(201).json({
      status: 'success',
      project
    })
  } catch (error) {
    next(error)
  }
}

// @desc    Get all projects
// @route   GET /api/projects
// @access  Private
export const getProjects = async (req, res, next) => {
  try {
    const { status } = req.query
    
    const query = { userId: req.user.id }
    if (status) query.status = status

    const projects = await Project.find(query)
      .sort({ createdAt: -1 })
      .populate('documents', 'title status createdAt')

    res.status(200).json({
      status: 'success',
      projects
    })
  } catch (error) {
    next(error)
  }
}

// @desc    Get single project
// @route   GET /api/projects/:id
// @access  Private
export const getProject = async (req, res, next) => {
  try {
    const project = await Project.findOne({
      _id: req.params.id,
      userId: req.user.id
    }).populate('documents')

    if (!project) {
      return res.status(404).json({
        status: 'error',
        message: 'Project not found'
      })
    }

    res.status(200).json({
      status: 'success',
      project
    })
  } catch (error) {
    next(error)
  }
}

// @desc    Update project
// @route   PUT /api/projects/:id
// @access  Private
export const updateProject = async (req, res, next) => {
  try {
    const { name, description, category, color, icon, status, deadline } = req.body

    const project = await Project.findOne({
      _id: req.params.id,
      userId: req.user.id
    })

    if (!project) {
      return res.status(404).json({
        status: 'error',
        message: 'Project not found'
      })
    }

    if (name) project.name = name
    if (description !== undefined) project.description = description
    if (category) project.category = category
    if (color) project.color = color
    if (icon) project.icon = icon
    if (status) project.status = status
    if (deadline !== undefined) project.deadline = deadline

    await project.save()

    res.status(200).json({
      status: 'success',
      project
    })
  } catch (error) {
    next(error)
  }
}

// @desc    Delete project
// @route   DELETE /api/projects/:id
// @access  Private
export const deleteProject = async (req, res, next) => {
  try {
    const project = await Project.findOne({
      _id: req.params.id,
      userId: req.user.id
    })

    if (!project) {
      return res.status(404).json({
        status: 'error',
        message: 'Project not found'
      })
    }

    // Remove project reference from documents
    await Document.updateMany(
      { projectId: project._id },
      { $set: { projectId: null } }
    )

    await project.deleteOne()

    res.status(200).json({
      status: 'success',
      message: 'Project deleted successfully'
    })
  } catch (error) {
    next(error)
  }
}

// @desc    Add document to project
// @route   POST /api/projects/:id/documents/:documentId
// @access  Private
export const addDocumentToProject = async (req, res, next) => {
  try {
    const project = await Project.findOne({
      _id: req.params.id,
      userId: req.user.id
    })

    if (!project) {
      return res.status(404).json({
        status: 'error',
        message: 'Project not found'
      })
    }

    const document = await Document.findOne({
      _id: req.params.documentId,
      userId: req.user.id
    })

    if (!document) {
      return res.status(404).json({
        status: 'error',
        message: 'Document not found'
      })
    }

    // Update document
    document.projectId = project._id
    await document.save()

    // Update project
    if (!project.documents.includes(document._id)) {
      project.documents.push(document._id)
      project.stats.totalDocuments += 1
      await project.save()
    }

    res.status(200).json({
      status: 'success',
      project
    })
  } catch (error) {
    next(error)
  }
}
