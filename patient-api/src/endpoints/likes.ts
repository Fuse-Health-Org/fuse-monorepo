import { Router, Request, Response } from 'express';
import Like from '../models/Like';
import TenantProduct from '../models/TenantProduct';
import { authenticateJWT, getCurrentUser } from '../config/jwt';
import { Op } from 'sequelize';

const router = Router();

/**
 * Toggle like for a product
 * POST /likes/toggle
 * Body: { tenantProductId, anonymousId? }
 * 
 * If user is logged in, uses userId.
 * If not logged in, uses anonymousId from localStorage.
 */
router.post('/likes/toggle', async (req: Request, res: Response) => {
  try {
    const { tenantProductId, anonymousId } = req.body;

    if (!tenantProductId) {
      return res.status(400).json({
        success: false,
        error: 'tenantProductId is required',
      });
    }

    // Verify tenant product exists
    const tenantProduct = await TenantProduct.findByPk(tenantProductId);
    if (!tenantProduct) {
      return res.status(404).json({
        success: false,
        error: 'Product not found',
      });
    }

    // Try to get current user from JWT (optional auth)
    let userId: string | null = null;
    try {
      // Parse JWT if present but don't require it
      const authHeader = req.headers.authorization;
      if (authHeader && authHeader.startsWith('Bearer ')) {
        const jwt = require('jsonwebtoken');
        const token = authHeader.substring(7);
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key') as any;
        userId = decoded.id || decoded.userId || null;
      }
    } catch (e) {
      // JWT invalid or expired, continue as anonymous
      userId = null;
    }

    // Must have either userId or anonymousId
    if (!userId && !anonymousId) {
      return res.status(400).json({
        success: false,
        error: 'Either login or provide anonymousId',
      });
    }

    // Find existing like
    const whereClause = userId
      ? { tenantProductId, userId }
      : { tenantProductId, anonymousId };

    let like = await Like.findOne({ where: whereClause });

    if (like) {
      // Toggle the liked status
      like.liked = !like.liked;
      await like.save();
    } else {
      // Create new like
      like = await Like.create({
        tenantProductId,
        userId,
        anonymousId: userId ? null : anonymousId,
        liked: true,
      });
    }

    // Get updated like count for this product
    const likeCount = await Like.count({
      where: {
        tenantProductId,
        liked: true,
      },
    });

    return res.json({
      success: true,
      liked: like.liked,
      likeCount,
    });
  } catch (error) {
    console.error('❌ Error toggling like:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to toggle like',
    });
  }
});

/**
 * Get like status and count for a product
 * GET /likes/:tenantProductId
 * Query: { anonymousId? }
 */
router.get('/likes/:tenantProductId', async (req: Request, res: Response) => {
  try {
    const { tenantProductId } = req.params;
    const { anonymousId } = req.query;

    // Verify tenant product exists
    const tenantProduct = await TenantProduct.findByPk(tenantProductId);
    if (!tenantProduct) {
      return res.status(404).json({
        success: false,
        error: 'Product not found',
      });
    }

    // Try to get current user from JWT (optional auth)
    let userId: string | null = null;
    try {
      const authHeader = req.headers.authorization;
      if (authHeader && authHeader.startsWith('Bearer ')) {
        const jwt = require('jsonwebtoken');
        const token = authHeader.substring(7);
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key') as any;
        userId = decoded.id || decoded.userId || null;
      }
    } catch (e) {
      userId = null;
    }

    // Get total like count
    const likeCount = await Like.count({
      where: {
        tenantProductId,
        liked: true,
      },
    });

    // Check if current user/anonymous has liked
    let userLiked = false;
    if (userId) {
      const userLike = await Like.findOne({
        where: { tenantProductId, userId, liked: true },
      });
      userLiked = !!userLike;
    } else if (anonymousId) {
      const anonLike = await Like.findOne({
        where: { tenantProductId, anonymousId: anonymousId as string, liked: true },
      });
      userLiked = !!anonLike;
    }

    return res.json({
      success: true,
      likeCount,
      userLiked,
    });
  } catch (error) {
    console.error('❌ Error getting like status:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to get like status',
    });
  }
});

/**
 * Get likes for multiple products at once (batch)
 * POST /likes/batch
 * Body: { tenantProductIds: string[], anonymousId?: string }
 */
router.post('/likes/batch', async (req: Request, res: Response) => {
  try {
    const { tenantProductIds, anonymousId } = req.body;

    if (!tenantProductIds || !Array.isArray(tenantProductIds)) {
      return res.status(400).json({
        success: false,
        error: 'tenantProductIds array is required',
      });
    }

    // Try to get current user from JWT (optional auth)
    let userId: string | null = null;
    try {
      const authHeader = req.headers.authorization;
      if (authHeader && authHeader.startsWith('Bearer ')) {
        const jwt = require('jsonwebtoken');
        const token = authHeader.substring(7);
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key') as any;
        userId = decoded.id || decoded.userId || null;
      }
    } catch (e) {
      userId = null;
    }

    // Get like counts for all products
    const likes = await Like.findAll({
      where: {
        tenantProductId: { [Op.in]: tenantProductIds },
        liked: true,
      },
      attributes: ['tenantProductId', 'userId', 'anonymousId'],
    });

    // Build response object
    const likeCounts: Record<string, number> = {};
    const userLikes: Record<string, boolean> = {};

    // Initialize all products with 0 counts
    tenantProductIds.forEach((id: string) => {
      likeCounts[id] = 0;
      userLikes[id] = false;
    });

    // Count likes and check user's likes
    likes.forEach((like) => {
      likeCounts[like.tenantProductId] = (likeCounts[like.tenantProductId] || 0) + 1;
      
      if (userId && like.userId === userId) {
        userLikes[like.tenantProductId] = true;
      } else if (!userId && anonymousId && like.anonymousId === anonymousId) {
        userLikes[like.tenantProductId] = true;
      }
    });

    return res.json({
      success: true,
      likeCounts,
      userLikes,
    });
  } catch (error) {
    console.error('❌ Error getting batch likes:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to get batch likes',
    });
  }
});

/**
 * Get all likes by a user (for logged-in users only)
 * GET /likes/user/me
 */
router.get('/likes/user/me', authenticateJWT, async (req: Request, res: Response) => {
  try {
    const currentUser = getCurrentUser(req);
    if (!currentUser) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
      });
    }

    const likes = await Like.findAll({
      where: {
        userId: currentUser.id,
        liked: true,
      },
      include: [
        {
          model: TenantProduct,
          as: 'tenantProduct',
        },
      ],
    });

    return res.json({
      success: true,
      likes: likes.map((like) => ({
        id: like.id,
        tenantProductId: like.tenantProductId,
        tenantProduct: like.tenantProduct,
        createdAt: like.createdAt,
      })),
    });
  } catch (error) {
    console.error('❌ Error getting user likes:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to get user likes',
    });
  }
});

/**
 * Migrate anonymous likes to a user account
 * POST /likes/migrate
 * Body: { anonymousId }
 * Requires authentication
 */
router.post('/likes/migrate', authenticateJWT, async (req: Request, res: Response) => {
  try {
    const currentUser = getCurrentUser(req);
    if (!currentUser) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
      });
    }

    const { anonymousId } = req.body;
    if (!anonymousId) {
      return res.status(400).json({
        success: false,
        error: 'anonymousId is required',
      });
    }

    // Find all anonymous likes
    const anonymousLikes = await Like.findAll({
      where: {
        anonymousId,
        userId: null,
      },
    });

    let migratedCount = 0;
    let skippedCount = 0;

    for (const anonLike of anonymousLikes) {
      // Check if user already has a like for this product
      const existingUserLike = await Like.findOne({
        where: {
          tenantProductId: anonLike.tenantProductId,
          userId: currentUser.id,
        },
      });

      if (existingUserLike) {
        // User already has a like, delete the anonymous one
        await anonLike.destroy();
        skippedCount++;
      } else {
        // Migrate anonymous like to user
        anonLike.userId = currentUser.id;
        anonLike.anonymousId = null;
        await anonLike.save();
        migratedCount++;
      }
    }

    return res.json({
      success: true,
      migratedCount,
      skippedCount,
    });
  } catch (error) {
    console.error('❌ Error migrating likes:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to migrate likes',
    });
  }
});

export default router;

