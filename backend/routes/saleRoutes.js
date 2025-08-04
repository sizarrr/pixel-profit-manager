import express from 'express';
import {
  getAllSales,
  getSale,
  createSale,
  getRecentSales,
  getSalesStats,
  getSalesByDateRange,
  getTopSellingProducts,
  getSalesProfit
} from '../controllers/saleController.js';
import {
  validateSale,
  validateObjectId,
  validateQuery,
  validateDateRange
} from '../middleware/validation.js';

const router = express.Router();

// Sales analytics endpoints
router.get('/stats', validateDateRange, getSalesStats);
router.get('/analytics', validateDateRange, getSalesByDateRange);
router.get('/top-products', validateDateRange, getTopSellingProducts);
router.get('/profit', validateDateRange, getSalesProfit);
router.get('/recent', getRecentSales);

// Main sales routes
router
  .route('/')
  .get(validateQuery, validateDateRange, getAllSales)
  .post(validateSale, createSale);

router
  .route('/:id')
  .get(validateObjectId, getSale);

export default router;