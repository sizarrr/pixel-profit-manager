import express from 'express';
import {
  addInventoryBatch,
  getProductBatches,
  getAllBatches,
  getInventorySummary,
  updateInventoryBatch,
  deactivateInventoryBatch,
  getLowStockProducts
} from '../controllers/inventoryController.js';
import {
  validateObjectId,
  validateQuery,
  validateInventoryBatch
} from '../middleware/validation.js';

const router = express.Router();

// Inventory summary and analytics
router.get('/summary', getInventorySummary);
router.get('/low-stock', getLowStockProducts);

// Batch management routes
router
  .route('/batches')
  .get(validateQuery, getAllBatches)
  .post(validateInventoryBatch, addInventoryBatch);

router
  .route('/batches/:id')
  .patch(validateObjectId, updateInventoryBatch)
  .delete(validateObjectId, deactivateInventoryBatch);

// Product-specific batch routes
router.get('/products/:productId/batches', validateObjectId, getProductBatches);

export default router;