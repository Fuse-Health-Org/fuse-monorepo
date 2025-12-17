import { Router } from 'express';
import { authenticateJWT } from '../../../config/jwt';
import * as ProductsController from '../controllers/products.controller';

const router = Router();

// Public routes
router.get('/products/:id', ProductsController.getProduct);

// Protected routes
router.get('/products/by-clinic/:clinicId', authenticateJWT, ProductsController.getProductsByClinic);
router.post('/products', authenticateJWT, ProductsController.createProduct);
router.put('/products/:id', authenticateJWT, ProductsController.updateProduct);
router.delete('/products/:id', authenticateJWT, ProductsController.deleteProduct);

// Products Management (Tenant Products)
router.get('/products-management', authenticateJWT, ProductsController.listTenantProducts);
router.get('/products-management/:id', authenticateJWT, ProductsController.getTenantProduct);
router.post('/products-management', authenticateJWT, ProductsController.createTenantProduct);
router.put('/products-management/:id', authenticateJWT, ProductsController.updateTenantProduct);
router.delete('/products-management/:id', authenticateJWT, ProductsController.deleteTenantProduct);

export default router;

