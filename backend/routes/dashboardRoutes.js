import express from 'express';
import {
  getDashboardOverview,
  getSalesAnalytics,
  getInventoryInsights
} from '../controllers/dashboardController.js';
import { validateDateRange } from '../middleware/validation.js';

const router = express.Router();

// Dashboard overview with all key metrics
router.get('/overview', validateDateRange, getDashboardOverview);

// Sales analytics for charts and graphs
router.get('/analytics', getSalesAnalytics);

// Inventory insights and alerts
router.get('/inventory-insights', getInventoryInsights);

export default router;