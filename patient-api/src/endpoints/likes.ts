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
    const { tenantProductId, anonymousId, sourceType = 'brand', affiliateId } = req.body;

    console.log('💗 [LIKE TOGGLE API] ===== NEW LIKE TOGGLE REQUEST =====');
    console.log('💗 [LIKE TOGGLE API] Request body:', {
      tenantProductId,
      anonymousId: anonymousId ? anonymousId.substring(0, 8) + '...' : 'null',
      sourceType,
      affiliateId: affiliateId || 'null',
      timestamp: new Date().toISOString(),
    });

    if (!tenantProductId) {
      return res.status(400).json({
        success: false,
        error: 'tenantProductId is required',
      });
    }

    // Validate sourceType
    if (!['brand', 'affiliate'].includes(sourceType)) {
      return res.status(400).json({
        success: false,
        error: 'sourceType must be either "brand" or "affiliate"',
      });
    }

    console.log('💗 [LIKE TOGGLE API] Source validation:', {
      sourceType,
      isAffiliate: sourceType === 'affiliate',
      hasAffiliateId: !!affiliateId,
    });

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

    console.log('💗 [LIKE TOGGLE API] User info:', {
      userId: userId || 'anonymous',
      hasUserId: !!userId,
    });

    // Must have either userId or anonymousId
    if (!userId && !anonymousId) {
      return res.status(400).json({
        success: false,
        error: 'Either login or provide anonymousId',
      });
    }

    // Find existing like with sourceType and affiliateId
    const whereClause: any = userId
      ? { 
          tenantProductId, 
          userId, 
          sourceType,
          affiliateId: sourceType === 'affiliate' ? affiliateId : null
        }
      : { 
          tenantProductId, 
          anonymousId, 
          sourceType,
          affiliateId: sourceType === 'affiliate' ? affiliateId : null
        };

    console.log('💗 [LIKE TOGGLE API] Searching for existing like with:', whereClause);

    let like = await Like.findOne({ where: whereClause });

    console.log('💗 [LIKE TOGGLE API] Existing like found:', like ? 'YES' : 'NO');

    if (like) {
      // Toggle the liked status
      const previousStatus = like.liked;
      like.liked = !like.liked;
      await like.save();
      console.log('💗 [LIKE TOGGLE API] Toggled like status:', {
        previousStatus,
        newStatus: like.liked,
        action: like.liked ? 'LIKED' : 'UNLIKED',
      });
    } else {
      // Create new like
      const newLikeData = {
        tenantProductId,
        userId,
        anonymousId: userId ? null : anonymousId,
        liked: true,
        sourceType,
        affiliateId: sourceType === 'affiliate' ? affiliateId : null,
      };
      console.log('💗 [LIKE TOGGLE API] Creating new like with data:', newLikeData);
      like = await Like.create(newLikeData);
      console.log('💗 [LIKE TOGGLE API] New like created with ID:', like.id);
    }

    // Get updated like count for this product filtered by sourceType
    const likeCountWhere: any = {
      tenantProductId,
      liked: true,
      sourceType,
    };
    if (sourceType === 'affiliate' && affiliateId) {
      likeCountWhere.affiliateId = affiliateId;
    }
    
    const likeCount = await Like.count({ where: likeCountWhere });

    console.log('💗 [LIKE TOGGLE API] Final like count for this source:', {
      sourceType,
      affiliateId: affiliateId || 'null',
      likeCount,
    });

    console.log('💗 [LIKE TOGGLE API] ===== REQUEST COMPLETED =====\n');

    return res.json({
      success: true,
      liked: like.liked,
      likeCount,
    });
  } catch (error) {
    console.error('❌ [LIKE TOGGLE API] Error toggling like:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to toggle like',
    });
  }
});

/**
 * Get like status and count for a product
 * GET /likes/:tenantProductId
 * Query: { anonymousId?, sourceType?, affiliateId? }
 */
router.get('/likes/:tenantProductId', async (req: Request, res: Response) => {
  try {
    const { tenantProductId } = req.params;
    const { anonymousId, sourceType = 'brand', affiliateId } = req.query;

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

    // Get total like count filtered by sourceType
    const whereCount: any = {
      tenantProductId,
      liked: true,
      sourceType: sourceType as string,
    };
    if (sourceType === 'affiliate' && affiliateId) {
      whereCount.affiliateId = affiliateId as string;
    }
    const likeCount = await Like.count({ where: whereCount });

    // Check if current user/anonymous has liked
    let userLiked = false;
    if (userId) {
      const whereUser: any = { tenantProductId, userId, liked: true, sourceType: sourceType as string };
      if (sourceType === 'affiliate' && affiliateId) {
        whereUser.affiliateId = affiliateId as string;
      }
      const userLike = await Like.findOne({ where: whereUser });
      userLiked = !!userLike;
    } else if (anonymousId) {
      const whereAnon: any = { 
        tenantProductId, 
        anonymousId: anonymousId as string, 
        liked: true,
        sourceType: sourceType as string,
      };
      if (sourceType === 'affiliate' && affiliateId) {
        whereAnon.affiliateId = affiliateId as string;
      }
      const anonLike = await Like.findOne({ where: whereAnon });
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
 * Body: { tenantProductIds: string[], anonymousId?: string, sourceType?: string, affiliateId?: string }
 */
router.post('/likes/batch', async (req: Request, res: Response) => {
  try {
    const { tenantProductIds, anonymousId, sourceType = 'brand', affiliateId } = req.body;

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

    // Get like counts for all products filtered by sourceType
    const whereClause: any = {
      tenantProductId: { [Op.in]: tenantProductIds },
      liked: true,
      sourceType,
    };
    if (sourceType === 'affiliate' && affiliateId) {
      whereClause.affiliateId = affiliateId;
    }
    const likes = await Like.findAll({
      where: whereClause,
      attributes: ['tenantProductId', 'userId', 'anonymousId', 'sourceType', 'affiliateId'],
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

/**
 * Admin: Get likes analytics for a product
 * GET /likes/admin/analytics/:tenantProductId
 * Requires authentication
 */
router.get('/likes/admin/analytics/:tenantProductId', authenticateJWT, async (req: Request, res: Response) => {
  try {
    const currentUser = getCurrentUser(req);
    if (!currentUser) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
      });
    }

    const { tenantProductId } = req.params;

    console.log('📊 [LIKES ANALYTICS] Fetching analytics for product:', tenantProductId);

    // Get total likes count for brand portal only
    const totalLikes = await Like.count({
      where: {
        tenantProductId,
        liked: true,
        sourceType: 'brand',
      },
    });

    console.log('📊 [LIKES ANALYTICS] Total likes:', totalLikes);

    // Get likes by logged-in users (brand portal)
    const userLikes = await Like.count({
      where: {
        tenantProductId,
        liked: true,
        userId: { [Op.ne]: null },
        sourceType: 'brand',
      },
    });

    // Get likes by anonymous users (brand portal)
    const anonymousLikes = await Like.count({
      where: {
        tenantProductId,
        liked: true,
        anonymousId: { [Op.ne]: null },
        sourceType: 'brand',
      },
    });

    // Get recent likes (last 30 days) with daily breakdown for brand portal
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const recentLikes = await Like.findAll({
      where: {
        tenantProductId,
        liked: true,
        createdAt: { [Op.gte]: thirtyDaysAgo },
        sourceType: 'brand',
      },
      attributes: ['createdAt'],
      order: [['createdAt', 'ASC']],
    });

    // Group by day
    const dailyLikes: Record<string, number> = {};
    recentLikes.forEach((like) => {
      const date = new Date(like.createdAt).toISOString().split('T')[0];
      dailyLikes[date] = (dailyLikes[date] || 0) + 1;
    });

    // Convert to array for charting
    const dailyLikesArray = Object.entries(dailyLikes).map(([date, count]) => ({
      date,
      count,
    }));

    console.log('📊 [LIKES ANALYTICS] Response:', {
      totalLikes,
      userLikes,
      anonymousLikes,
      dailyLikesCount: dailyLikesArray.length,
    });

    return res.json({
      success: true,
      data: {
        totalLikes,
        userLikes,
        anonymousLikes,
        dailyLikes: dailyLikesArray,
      },
    });
  } catch (error) {
    console.error('❌ [LIKES ANALYTICS] Error getting likes analytics:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to get likes analytics',
    });
  }
});

/**
 * Admin: Get likes count for multiple products (for product list page)
 * POST /likes/admin/counts
 * Body: { tenantProductIds: string[] }
 * Requires authentication
 */
router.post('/likes/admin/counts', authenticateJWT, async (req: Request, res: Response) => {
  try {
    const currentUser = getCurrentUser(req);
    if (!currentUser) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
      });
    }

    const { tenantProductIds } = req.body;

    console.log('📊 [LIKES API] Fetching counts for products:', tenantProductIds);

    if (!tenantProductIds || !Array.isArray(tenantProductIds)) {
      return res.status(400).json({
        success: false,
        error: 'tenantProductIds array is required',
      });
    }

    // Get like counts for all products (brand portal only)
    const likes = await Like.findAll({
      where: {
        tenantProductId: { [Op.in]: tenantProductIds },
        liked: true,
        sourceType: 'brand',
      },
      attributes: ['tenantProductId'],
    });

    console.log('📊 [LIKES API] Found likes:', likes.length);

    // Count likes per product
    const likeCounts: Record<string, number> = {};
    tenantProductIds.forEach((id: string) => {
      likeCounts[id] = 0;
    });
    likes.forEach((like) => {
      likeCounts[like.tenantProductId] = (likeCounts[like.tenantProductId] || 0) + 1;
    });

    console.log('📊 [LIKES API] Like counts by product:', likeCounts);

    return res.json({
      success: true,
      data: likeCounts,
    });
  } catch (error) {
    console.error('❌ [LIKES API] Error getting likes counts:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to get likes counts',
    });
  }
});

/**
 * Public: Get likes count for multiple products (for affiliate portal)
 * POST /likes/public/counts
 * Body: { tenantProductIds: string[], affiliateId?: string }
 * No authentication required
 */
router.post('/likes/public/counts', async (req: Request, res: Response) => {
  try {
    const { tenantProductIds, affiliateId } = req.body;

    console.log('📊 [PUBLIC LIKES API] Fetching counts for products:', tenantProductIds, 'affiliateId:', affiliateId);

    if (!tenantProductIds || !Array.isArray(tenantProductIds)) {
      return res.status(400).json({
        success: false,
        error: 'tenantProductIds array is required',
      });
    }

    // Get like counts for all products from affiliate portal
    const whereClause: any = {
      tenantProductId: { [Op.in]: tenantProductIds },
      liked: true,
      sourceType: 'affiliate',
    };
    if (affiliateId) {
      whereClause.affiliateId = affiliateId;
    }
    
    const likes = await Like.findAll({
      where: whereClause,
      attributes: ['tenantProductId'],
    });

    console.log('📊 [PUBLIC LIKES API] Found likes:', likes.length);

    // Count likes per product
    const likeCounts: Record<string, number> = {};
    tenantProductIds.forEach((id: string) => {
      likeCounts[id] = 0;
    });
    likes.forEach((like) => {
      likeCounts[like.tenantProductId] = (likeCounts[like.tenantProductId] || 0) + 1;
    });

    console.log('📊 [PUBLIC LIKES API] Like counts by product:', likeCounts);

    return res.json({
      success: true,
      data: likeCounts,
    });
  } catch (error) {
    console.error('❌ [PUBLIC LIKES API] Error getting likes counts:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to get likes counts',
    });
  }
});

/**
 * Public: Get detailed likes analytics for a product (for affiliate portal)
 * GET /likes/public/analytics/:tenantProductId
 * Query: { affiliateId?: string }
 * No authentication required
 */
router.get('/likes/public/analytics/:tenantProductId', async (req: Request, res: Response) => {
  try {
    const { tenantProductId } = req.params;
    const { affiliateId } = req.query;

    console.log('📊 [PUBLIC LIKES ANALYTICS] Fetching analytics for product:', tenantProductId, 'affiliateId:', affiliateId);

    // Get total likes count for affiliate portal
    const whereBase: any = {
      tenantProductId,
      liked: true,
      sourceType: 'affiliate',
    };
    if (affiliateId) {
      whereBase.affiliateId = affiliateId as string;
    }

    const totalLikes = await Like.count({ where: whereBase });

    console.log('📊 [PUBLIC LIKES ANALYTICS] Total likes:', totalLikes);

    // Get likes by logged-in users (affiliate portal)
    const userLikes = await Like.count({
      where: {
        ...whereBase,
        userId: { [Op.ne]: null },
      },
    });

    // Get likes by anonymous users (affiliate portal)
    const anonymousLikes = await Like.count({
      where: {
        ...whereBase,
        anonymousId: { [Op.ne]: null },
      },
    });

    // Get recent likes (last 30 days) with daily breakdown for affiliate portal
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const recentLikes = await Like.findAll({
      where: {
        ...whereBase,
        createdAt: { [Op.gte]: thirtyDaysAgo },
      },
      attributes: ['createdAt'],
      order: [['createdAt', 'ASC']],
    });

    // Group by day
    const dailyLikes: Record<string, number> = {};
    recentLikes.forEach((like) => {
      const date = new Date(like.createdAt).toISOString().split('T')[0];
      dailyLikes[date] = (dailyLikes[date] || 0) + 1;
    });

    // Convert to array for charting
    const dailyLikesArray = Object.entries(dailyLikes).map(([date, count]) => ({
      date,
      count,
    }));

    console.log('📊 [PUBLIC LIKES ANALYTICS] Response:', {
      totalLikes,
      userLikes,
      anonymousLikes,
      dailyLikesCount: dailyLikesArray.length,
    });

    return res.json({
      success: true,
      data: {
        totalLikes,
        userLikes,
        anonymousLikes,
        dailyLikes: dailyLikesArray,
      },
    });
  } catch (error) {
    console.error('❌ [PUBLIC LIKES ANALYTICS] Error getting likes analytics:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to get likes analytics',
    });
  }
});

export default router;

