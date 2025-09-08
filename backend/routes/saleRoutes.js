// backend/routes/saleRoutes.js - FIXED SALE ROUTES
import express from "express";
import {
  getAllSales,
  getSale,
  createSale,
  getRecentSales,
  getSalesStats,
  getSalesByDateRange,
  getTopSellingProducts,
  getSalesProfit,
} from "../controllers/saleController.js";
import {
  validateSale,
  validateObjectId,
  validateQuery,
  validateDateRange,
} from "../middleware/validation.js";

const router = express.Router();

// Sales statistics and analytics endpoints - MUST COME BEFORE /:id
router.get("/recent", getRecentSales);
router.get("/stats", validateDateRange, getSalesStats);
router.get("/by-date", validateDateRange, getSalesByDateRange);
router.get("/top-products", getTopSellingProducts);
router.get("/profit", validateDateRange, getSalesProfit);

// Main CRUD operations
router
  .route("/")
  .get(validateQuery, getAllSales)
  .post(validateSale, createSale);

router.route("/:id").get(validateObjectId, getSale);

export default router;
