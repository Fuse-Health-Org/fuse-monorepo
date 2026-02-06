import express, { Request, Response } from 'express';
import { authenticateJWT } from '../../middleware/auth';

const router = express.Router();

// Placeholder Beluga products for testing
// All IDs start with "PLACEHOLDER-" so they can be easily identified and deleted later
const PLACEHOLDER_BELUGA_PRODUCTS = [
  {
    id: 'PLACEHOLDER-BELUGA-001',
    name: 'Semaglutide 2.5mg/ml (Beluga)',
    description: 'Weight loss medication - Injectable',
    category: 'Weight Loss',
    type: 'Injectable',
    strength: '2.5mg/ml',
  },
  {
    id: 'PLACEHOLDER-BELUGA-002',
    name: 'Tirzepatide 5mg/ml (Beluga)',
    description: 'Weight loss and diabetes medication - Injectable',
    category: 'Weight Loss',
    type: 'Injectable',
    strength: '5mg/ml',
  },
  {
    id: 'PLACEHOLDER-BELUGA-003',
    name: 'NAD+ 200mg/ml (Beluga)',
    description: 'Cellular energy and anti-aging - Injectable',
    category: 'Performance',
    type: 'Injectable',
    strength: '200mg/ml',
  },
  {
    id: 'PLACEHOLDER-BELUGA-004',
    name: 'Testosterone Cypionate 200mg/ml (Beluga)',
    description: 'Hormone replacement therapy - Injectable',
    category: 'Hormones',
    type: 'Injectable',
    strength: '200mg/ml',
  },
  {
    id: 'PLACEHOLDER-BELUGA-005',
    name: 'BPC-157 500mcg (Beluga)',
    description: 'Tissue repair peptide - Injectable',
    category: 'Performance',
    type: 'Injectable',
    strength: '500mcg',
  },
  {
    id: 'PLACEHOLDER-BELUGA-006',
    name: 'Sermorelin 3mg (Beluga)',
    description: 'Growth hormone secretagogue - Injectable',
    category: 'Performance',
    type: 'Injectable',
    strength: '3mg',
  },
  {
    id: 'PLACEHOLDER-BELUGA-007',
    name: 'CJC-1295 + Ipamorelin 5mg (Beluga)',
    description: 'Growth hormone peptide combination - Injectable',
    category: 'Performance',
    type: 'Injectable',
    strength: '5mg',
  },
  {
    id: 'PLACEHOLDER-BELUGA-008',
    name: 'Glutathione 200mg/ml (Beluga)',
    description: 'Antioxidant and detoxification - Injectable',
    category: 'Wellness',
    type: 'Injectable',
    strength: '200mg/ml',
  },
  {
    id: 'PLACEHOLDER-BELUGA-009',
    name: 'Vitamin B12 1000mcg/ml (Beluga)',
    description: 'Energy and metabolism support - Injectable',
    category: 'Vitamins',
    type: 'Injectable',
    strength: '1000mcg/ml',
  },
  {
    id: 'PLACEHOLDER-BELUGA-010',
    name: 'PT-141 (Bremelanotide) 10mg (Beluga)',
    description: 'Sexual wellness peptide - Injectable',
    category: 'Sexual Health',
    type: 'Injectable',
    strength: '10mg',
  },
];

/**
 * GET /beluga/products
 * Get list of placeholder Beluga products
 * 
 * These are mock products for testing integration.
 * All product IDs start with "PLACEHOLDER-" for easy identification and cleanup.
 */
router.get('/products', authenticateJWT, async (req: Request, res: Response) => {
  try {
    // In the future, this will make an actual API call to Beluga
    // For now, return placeholder data
    
    return res.json({
      success: true,
      data: PLACEHOLDER_BELUGA_PRODUCTS,
      message: 'Placeholder data - Beluga integration coming soon',
    });
  } catch (error) {
    console.error('❌ Error fetching Beluga products:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch Beluga products',
    });
  }
});

/**
 * GET /beluga/products/:productId
 * Get a single Beluga product by ID
 */
router.get('/products/:productId', authenticateJWT, async (req: Request, res: Response) => {
  try {
    const { productId } = req.params;
    
    const product = PLACEHOLDER_BELUGA_PRODUCTS.find(p => p.id === productId);
    
    if (!product) {
      return res.status(404).json({
        success: false,
        error: 'Beluga product not found',
      });
    }
    
    return res.json({
      success: true,
      data: product,
      message: 'Placeholder data - Beluga integration coming soon',
    });
  } catch (error) {
    console.error('❌ Error fetching Beluga product:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch Beluga product',
    });
  }
});

export default router;
