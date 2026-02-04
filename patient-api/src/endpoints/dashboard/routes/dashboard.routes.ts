import { Router } from 'express';
import { authenticateJWT } from '../../../config/jwt';
import * as DashboardController from '../controllers/dashboard.controller';

const router = Router();

// Reports
router.get('/dashboard/metrics', authenticateJWT, DashboardController.getDashboardMetrics);
router.get('/dashboard/earnings-report', authenticateJWT, DashboardController.getDashboardEarningsReport);
router.get('/dashboard/recent-activity', authenticateJWT, DashboardController.getDashboardRecentActivity);

// Charts
router.get('/dashboard/revenue-chart', authenticateJWT, DashboardController.getDashboardRevenueChart);

//Futures
router.get('/dashboard/projected-revenue', authenticateJWT, DashboardController.getDashboardProjectedRevenue);

export default router;

