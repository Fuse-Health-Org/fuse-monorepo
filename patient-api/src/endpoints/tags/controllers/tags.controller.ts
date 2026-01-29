import { Request, Response } from 'express';
import Tag from '../../../models/Tag';
import UserTag from '../../../models/UserTag';
import User from '../../../models/User';
import { getCurrentUser } from '../../../config/jwt';
import { Op } from 'sequelize';

/**
 * GET /tags
 * List all tags for the current clinic
 */
export const listTags = async (req: Request, res: Response) => {
  try {
    const currentUser = getCurrentUser(req);
    if (!currentUser) {
      return res.status(401).json({
        success: false,
        message: "User authentication required"
      });
    }

    if (!currentUser.clinicId) {
      return res.status(400).json({
        success: false,
        message: "User does not belong to a clinic"
      });
    }

    const { category, isActive } = req.query;

    const whereClause: any = {
      clinicId: currentUser.clinicId
    };

    if (category) {
      whereClause.category = category;
    }

    if (isActive !== undefined) {
      whereClause.isActive = isActive === 'true';
    }

    const tags = await Tag.findAll({
      where: whereClause,
      order: [['name', 'ASC']]
    });

    // Enrich with user counts
    const enrichedTags = await Promise.all(
      tags.map(async (tag) => {
        const userCount = await UserTag.count({
          where: { tagId: tag.id }
        });
        return {
          ...tag.toJSON(),
          userCount
        };
      })
    );

    res.status(200).json({
      success: true,
      data: enrichedTags
    });

  } catch (error) {
    console.error('❌ Error fetching tags:', error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch tags"
    });
  }
};

/**
 * POST /tags
 * Create a new tag
 */
export const createTag = async (req: Request, res: Response) => {
  try {
    const currentUser = getCurrentUser(req);
    if (!currentUser) {
      return res.status(401).json({
        success: false,
        message: "User authentication required"
      });
    }

    if (!currentUser.clinicId) {
      return res.status(400).json({
        success: false,
        message: "User does not belong to a clinic"
      });
    }

    const { name, description, category, color } = req.body;

    // Validate required fields
    if (!name || !name.trim()) {
      return res.status(400).json({
        success: false,
        message: "Tag name is required"
      });
    }

    // Check if tag with same name already exists in this clinic
    const existingTag = await Tag.findOne({
      where: {
        clinicId: currentUser.clinicId,
        name: name.trim()
      }
    });

    if (existingTag) {
      return res.status(400).json({
        success: false,
        message: "A tag with this name already exists"
      });
    }

    const tag = await Tag.create({
      clinicId: currentUser.clinicId,
      name: name.trim(),
      description: description?.trim() || null,
      category: category || 'custom',
      color: color || '#3B82F6',
      isActive: true
    });

    console.log(`✅ Tag created: ${tag.name} (${tag.id})`);

    res.status(201).json({
      success: true,
      data: tag
    });

  } catch (error) {
    console.error('❌ Error creating tag:', error);
    res.status(500).json({
      success: false,
      message: "Failed to create tag"
    });
  }
};

/**
 * PUT /tags/:id
 * Update a tag
 */
export const updateTag = async (req: Request, res: Response) => {
  try {
    const currentUser = getCurrentUser(req);
    if (!currentUser) {
      return res.status(401).json({
        success: false,
        message: "User authentication required"
      });
    }

    const { id } = req.params;
    const { name, description, category, color, isActive } = req.body;

    const tag = await Tag.findOne({
      where: {
        id,
        clinicId: currentUser.clinicId
      }
    });

    if (!tag) {
      return res.status(404).json({
        success: false,
        message: "Tag not found"
      });
    }

    // Check for duplicate name if changing name
    if (name && name !== tag.name) {
      const existingTag = await Tag.findOne({
        where: {
          clinicId: currentUser.clinicId,
          name: name.trim(),
          id: { [Op.ne]: id }
        }
      });

      if (existingTag) {
        return res.status(400).json({
          success: false,
          message: "A tag with this name already exists"
        });
      }
    }

    // Update fields
    if (name !== undefined) tag.name = name.trim();
    if (description !== undefined) tag.description = description?.trim() || null;
    if (category !== undefined) tag.category = category;
    if (color !== undefined) tag.color = color;
    if (isActive !== undefined) tag.isActive = isActive;

    await tag.save();

    console.log(`✅ Tag updated: ${tag.name} (${tag.id})`);

    res.status(200).json({
      success: true,
      data: tag
    });

  } catch (error) {
    console.error('❌ Error updating tag:', error);
    res.status(500).json({
      success: false,
      message: "Failed to update tag"
    });
  }
};

/**
 * DELETE /tags/:id
 * Delete a tag
 */
export const deleteTag = async (req: Request, res: Response) => {
  try {
    const currentUser = getCurrentUser(req);
    if (!currentUser) {
      return res.status(401).json({
        success: false,
        message: "User authentication required"
      });
    }

    const { id } = req.params;

    const tag = await Tag.findOne({
      where: {
        id,
        clinicId: currentUser.clinicId
      }
    });

    if (!tag) {
      return res.status(404).json({
        success: false,
        message: "Tag not found"
      });
    }

    // Delete all user-tag associations
    await UserTag.destroy({
      where: { tagId: tag.id }
    });

    // Delete the tag
    await tag.destroy();

    console.log(`✅ Tag deleted: ${tag.name} (${tag.id})`);

    res.status(200).json({
      success: true,
      message: "Tag deleted successfully"
    });

  } catch (error) {
    console.error('❌ Error deleting tag:', error);
    res.status(500).json({
      success: false,
      message: "Failed to delete tag"
    });
  }
};

/**
 * POST /tags/:id/assign
 * Assign a tag to a user
 */
export const assignTagToUser = async (req: Request, res: Response) => {
  try {
    const currentUser = getCurrentUser(req);
    if (!currentUser) {
      return res.status(401).json({
        success: false,
        message: "User authentication required"
      });
    }

    const { id: tagId } = req.params;
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: "userId is required"
      });
    }

    // Verify tag exists and belongs to clinic
    const tag = await Tag.findOne({
      where: {
        id: tagId,
        clinicId: currentUser.clinicId
      }
    });

    if (!tag) {
      return res.status(404).json({
        success: false,
        message: "Tag not found"
      });
    }

    // Verify user exists and belongs to clinic
    const user = await User.findOne({
      where: {
        id: userId,
        clinicId: currentUser.clinicId
      }
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    // Check if already assigned
    const existing = await UserTag.findOne({
      where: {
        userId,
        tagId
      }
    });

    if (existing) {
      return res.status(400).json({
        success: false,
        message: "Tag already assigned to this user"
      });
    }

    // Create assignment
    const userTag = await UserTag.create({
      userId,
      tagId,
      assignedBy: currentUser.id,
      assignedAt: new Date()
    });

    console.log(`✅ Tag "${tag.name}" assigned to user ${user.firstName} ${user.lastName}`);

    res.status(201).json({
      success: true,
      data: userTag
    });

  } catch (error) {
    console.error('❌ Error assigning tag:', error);
    res.status(500).json({
      success: false,
      message: "Failed to assign tag"
    });
  }
};

/**
 * DELETE /tags/:id/assign/:userId
 * Remove a tag from a user
 */
export const removeTagFromUser = async (req: Request, res: Response) => {
  try {
    const currentUser = getCurrentUser(req);
    if (!currentUser) {
      return res.status(401).json({
        success: false,
        message: "User authentication required"
      });
    }

    const { id: tagId, userId } = req.params;

    // Verify tag belongs to clinic
    const tag = await Tag.findOne({
      where: {
        id: tagId,
        clinicId: currentUser.clinicId
      }
    });

    if (!tag) {
      return res.status(404).json({
        success: false,
        message: "Tag not found"
      });
    }

    // Delete assignment
    const deleted = await UserTag.destroy({
      where: {
        userId,
        tagId
      }
    });

    if (deleted === 0) {
      return res.status(404).json({
        success: false,
        message: "Tag assignment not found"
      });
    }

    console.log(`✅ Tag "${tag.name}" removed from user ${userId}`);

    res.status(200).json({
      success: true,
      message: "Tag removed from user successfully"
    });

  } catch (error) {
    console.error('❌ Error removing tag:', error);
    res.status(500).json({
      success: false,
      message: "Failed to remove tag"
    });
  }
};

/**
 * GET /tags/:id/users
 * Get all users with a specific tag
 */
export const getUsersByTag = async (req: Request, res: Response) => {
  try {
    const currentUser = getCurrentUser(req);
    if (!currentUser) {
      return res.status(401).json({
        success: false,
        message: "User authentication required"
      });
    }

    const { id: tagId } = req.params;

    // Verify tag belongs to clinic
    const tag = await Tag.findOne({
      where: {
        id: tagId,
        clinicId: currentUser.clinicId
      }
    });

    if (!tag) {
      return res.status(404).json({
        success: false,
        message: "Tag not found"
      });
    }

    // Get all user-tag assignments for this tag
    const userTags = await UserTag.findAll({
      where: { tagId },
      include: [
        {
          model: User,
          as: 'user',
          attributes: ['id', 'firstName', 'lastName', 'email', 'phoneNumber', 'emailOptedOut', 'smsOptedOut'],
          where: { clinicId: currentUser.clinicId }
        }
      ]
    });

    const users = userTags.map(ut => ut.user);

    res.status(200).json({
      success: true,
      data: {
        tag,
        users,
        count: users.length
      }
    });

  } catch (error) {
    console.error('❌ Error fetching users by tag:', error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch users"
    });
  }
};

