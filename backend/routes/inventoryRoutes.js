import express from "express";
import {
  addInventoryBatch,
  getProductBatches,
  getInventoryValuation,
  getExpiringBatches,
  transferInventory,
  getBatchHistory,
} from "../controllers/inventoryController.js";
import {
  validateObjectId,
  validateQuery,
  validateInventoryBatch,
} from "../middleware/validation.js";

const router = express.Router();

// Inventory valuation and insights
router.get("/valuation", getInventoryValuation);
router.get("/expiring", getExpiringBatches);

// Batch management routes
router.post("/batches", validateInventoryBatch, addInventoryBatch);

// Product-specific batch routes
router.get("/products/:productId/batches", validateObjectId, getProductBatches);

// Batch history for audit
router.get("/batches/:batchId/history", validateObjectId, getBatchHistory);

// Transfer inventory between batches
router.post("/transfer", transferInventory);

export default router;
