import express from "express";
import {
  getAllProducts,
  getProduct,
  getProductByBarcode,
  createProduct,
  updateProduct,
  deleteProduct,
  getLowStockProducts,
  getCategories,
  updateQuantity,
  getProductStats,
  searchProducts,
} from "../controllers/productController.js";
import {
  validateProduct,
  validateProductUpdate,
  validateObjectId,
  validateQuery,
  validateBarcode,
} from "../middleware/validation.js";

const router = express.Router();

// Product statistics
router.get("/stats", getProductStats);

// Low stock products
router.get("/low-stock", getLowStockProducts);

// Product categories
router.get("/categories", getCategories);

// Search products (for barcode and text search)
router.get("/search", searchProducts);

// Barcode lookup - must come before /:id route
router.get("/barcode/:barcode", validateBarcode, getProductByBarcode);

// Main product routes
router
  .route("/")
  .get(validateQuery, getAllProducts)
  .post(validateProduct, createProduct);

router
  .route("/:id")
  .get(validateObjectId, getProduct)
  .put(validateObjectId, validateProductUpdate, updateProduct)
  .delete(validateObjectId, deleteProduct);

// Update product quantity
router.patch("/:id/quantity", validateObjectId, updateQuantity);

export default router;
