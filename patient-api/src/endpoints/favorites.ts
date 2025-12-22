import { Router, Request, Response } from 'express';
import BrandFavoritedProduct from '../models/BrandFavoritedProduct';
import Product from '../models/Product';
import { authenticateJWT, getCurrentUser } from '../config/jwt';

const router = Router();

/**
 * Get all favorited products for the current user's clinic
 * GET /favorites
 * Requires authentication
 */
router.get('/favorites', authenticateJWT, async (req: Request, res: Response) => {
  try {
    const currentUser = getCurrentUser(req);
    if (!currentUser) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
      });
    }

    const clinicId = (currentUser as any).clinicId;
    if (!clinicId) {
      return res.status(400).json({
        success: false,
        error: 'User is not associated with a clinic',
      });
    }

    const favorites = await BrandFavoritedProduct.findAll({
      where: { clinicId },
      include: [
        {
          model: Product,
          as: 'product',
        },
      ],
    });

    return res.json({
      success: true,
      data: favorites.map((fav) => ({
        id: fav.id,
        productId: fav.productId,
        product: fav.product,
        createdAt: fav.createdAt,
      })),
    });
  } catch (error) {
    console.error('❌ Error getting favorites:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to get favorites',
    });
  }
});

/**
 * Get list of favorited product IDs for the current user's clinic
 * GET /favorites/ids
 * Requires authentication
 */
router.get('/favorites/ids', authenticateJWT, async (req: Request, res: Response) => {
  try {
    const currentUser = getCurrentUser(req);
    if (!currentUser) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
      });
    }

    const clinicId = (currentUser as any).clinicId;
    if (!clinicId) {
      return res.status(400).json({
        success: false,
        error: 'User is not associated with a clinic',
      });
    }

    const favorites = await BrandFavoritedProduct.findAll({
      where: { clinicId },
      attributes: ['productId'],
    });

    return res.json({
      success: true,
      data: favorites.map((fav) => fav.productId),
    });
  } catch (error) {
    console.error('❌ Error getting favorite IDs:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to get favorite IDs',
    });
  }
});

/**
 * Toggle favorite for a product
 * POST /favorites/toggle
 * Body: { productId }
 * Requires authentication
 */
router.post('/favorites/toggle', authenticateJWT, async (req: Request, res: Response) => {
  try {
    const currentUser = getCurrentUser(req);
    if (!currentUser) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
      });
    }

    const clinicId = (currentUser as any).clinicId;
    if (!clinicId) {
      return res.status(400).json({
        success: false,
        error: 'User is not associated with a clinic',
      });
    }

    const { productId } = req.body;
    if (!productId) {
      return res.status(400).json({
        success: false,
        error: 'productId is required',
      });
    }

    // Verify product exists
    const product = await Product.findByPk(productId);
    if (!product) {
      return res.status(404).json({
        success: false,
        error: 'Product not found',
      });
    }

    // Check if already favorited
    const existing = await BrandFavoritedProduct.findOne({
      where: { clinicId, productId },
    });

    let isFavorited: boolean;

    if (existing) {
      // Remove from favorites
      await existing.destroy();
      isFavorited = false;
    } else {
      // Add to favorites
      await BrandFavoritedProduct.create({
        clinicId,
        productId,
      });
      isFavorited = true;
    }

    return res.json({
      success: true,
      data: {
        productId,
        isFavorited,
      },
    });
  } catch (error) {
    console.error('❌ Error toggling favorite:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to toggle favorite',
    });
  }
});

/**
 * Add a product to favorites
 * POST /favorites
 * Body: { productId }
 * Requires authentication
 */
router.post('/favorites', authenticateJWT, async (req: Request, res: Response) => {
  try {
    const currentUser = getCurrentUser(req);
    if (!currentUser) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
      });
    }

    const clinicId = (currentUser as any).clinicId;
    if (!clinicId) {
      return res.status(400).json({
        success: false,
        error: 'User is not associated with a clinic',
      });
    }

    const { productId } = req.body;
    if (!productId) {
      return res.status(400).json({
        success: false,
        error: 'productId is required',
      });
    }

    // Verify product exists
    const product = await Product.findByPk(productId);
    if (!product) {
      return res.status(404).json({
        success: false,
        error: 'Product not found',
      });
    }

    // Check if already favorited
    const existing = await BrandFavoritedProduct.findOne({
      where: { clinicId, productId },
    });

    if (existing) {
      return res.json({
        success: true,
        data: {
          id: existing.id,
          productId: existing.productId,
          alreadyExists: true,
        },
      });
    }

    // Create new favorite
    const favorite = await BrandFavoritedProduct.create({
      clinicId,
      productId,
    });

    return res.json({
      success: true,
      data: {
        id: favorite.id,
        productId: favorite.productId,
        alreadyExists: false,
      },
    });
  } catch (error) {
    console.error('❌ Error adding favorite:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to add favorite',
    });
  }
});

/**
 * Remove a product from favorites
 * DELETE /favorites/:productId
 * Requires authentication
 */
router.delete('/favorites/:productId', authenticateJWT, async (req: Request, res: Response) => {
  try {
    const currentUser = getCurrentUser(req);
    if (!currentUser) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
      });
    }

    const clinicId = (currentUser as any).clinicId;
    if (!clinicId) {
      return res.status(400).json({
        success: false,
        error: 'User is not associated with a clinic',
      });
    }

    const { productId } = req.params;

    const favorite = await BrandFavoritedProduct.findOne({
      where: { clinicId, productId },
    });

    if (!favorite) {
      return res.status(404).json({
        success: false,
        error: 'Favorite not found',
      });
    }

    await favorite.destroy();

    return res.json({
      success: true,
      data: {
        productId,
        removed: true,
      },
    });
  } catch (error) {
    console.error('❌ Error removing favorite:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to remove favorite',
    });
  }
});

/**
 * Sync favorites from localStorage (batch upsert)
 * POST /favorites/sync
 * Body: { productIds: string[] }
 * Requires authentication
 */
router.post('/favorites/sync', authenticateJWT, async (req: Request, res: Response) => {
  try {
    const currentUser = getCurrentUser(req);
    if (!currentUser) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
      });
    }

    const clinicId = (currentUser as any).clinicId;
    if (!clinicId) {
      return res.status(400).json({
        success: false,
        error: 'User is not associated with a clinic',
      });
    }

    const { productIds } = req.body;
    if (!productIds || !Array.isArray(productIds)) {
      return res.status(400).json({
        success: false,
        error: 'productIds array is required',
      });
    }

    // Get existing favorites
    const existingFavorites = await BrandFavoritedProduct.findAll({
      where: { clinicId },
      attributes: ['productId'],
    });
    const existingIds = new Set(existingFavorites.map((f) => f.productId));

    // Find new favorites to add
    const newIds = productIds.filter((id: string) => !existingIds.has(id));

    // Verify products exist
    const validProducts = await Product.findAll({
      where: { id: newIds },
      attributes: ['id'],
    });
    const validProductIds = new Set(validProducts.map((p) => p.id));

    // Create new favorites
    const created: string[] = [];
    for (const productId of newIds) {
      if (validProductIds.has(productId)) {
        await BrandFavoritedProduct.create({
          clinicId,
          productId,
        });
        created.push(productId);
      }
    }

    // Get final list of all favorites
    const allFavorites = await BrandFavoritedProduct.findAll({
      where: { clinicId },
      attributes: ['productId'],
    });

    return res.json({
      success: true,
      data: {
        synced: created.length,
        total: allFavorites.length,
        productIds: allFavorites.map((f) => f.productId),
      },
    });
  } catch (error) {
    console.error('❌ Error syncing favorites:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to sync favorites',
    });
  }
});

export default router;
