// backend/routes/sales.js - FIXED ROUTES
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

// GET /api/v1/sales - Get all sales with filtering and pagination
router.get("/", validateQuery, getAllSales);

// GET /api/v1/sales/recent - Get recent sales
router.get("/recent", getRecentSales);

// GET /api/v1/sales/stats - Get sales statistics
router.get("/stats", validateDateRange, getSalesStats);

// GET /api/v1/sales/by-date - Get sales by date range
router.get("/by-date", validateDateRange, getSalesByDateRange);

// GET /api/v1/sales/top-products - Get top selling products
router.get("/top-products", getTopSellingProducts);

// GET /api/v1/sales/profit - Get sales profit analysis
router.get("/profit", validateDateRange, getSalesProfit);

// GET /api/v1/sales/:id - Get single sale
router.get("/:id", validateObjectId, getSale);

// POST /api/v1/sales - Create new sale (with enhanced validation)
router.post("/", validateSale, createSale);

export default router;

// backend/routes/inventory.js - INVENTORY ROUTES
import express from "express";
import {
  addInventoryBatch,
  getProductBatches,
  getAllBatches,
  getInventorySummary,
  updateInventoryBatch,
  deactivateInventoryBatch,
  getLowStockProducts,
  adjustInventoryBatch,
  getExpiringBatches,
} from "../controllers/inventoryController.js";
import {
  validateInventoryBatch,
  validateObjectId,
  validateQuery,
} from "../middleware/validation.js";

const inventoryRouter = express.Router();

// GET /api/v1/inventory/summary - Get inventory summary
inventoryRouter.get("/summary", getInventorySummary);

// GET /api/v1/inventory/low-stock - Get low stock products
inventoryRouter.get("/low-stock", getLowStockProducts);

// GET /api/v1/inventory/expiring - Get expiring batches
inventoryRouter.get("/expiring", getExpiringBatches);

// GET /api/v1/inventory/batches - Get all batches with filtering
inventoryRouter.get("/batches", validateQuery, getAllBatches);

// POST /api/v1/inventory/batches - Add new inventory batch
inventoryRouter.post("/batches", validateInventoryBatch, addInventoryBatch);

// GET /api/v1/inventory/products/:productId/batches - Get batches for specific product
inventoryRouter.get(
  "/products/:productId/batches",
  validateObjectId,
  getProductBatches
);

// PUT /api/v1/inventory/batches/:id - Update inventory batch
inventoryRouter.put("/batches/:id", validateObjectId, updateInventoryBatch);

// PUT /api/v1/inventory/batches/:id/adjust - Adjust inventory batch quantity
inventoryRouter.put(
  "/batches/:id/adjust",
  validateObjectId,
  adjustInventoryBatch
);

// DELETE /api/v1/inventory/batches/:id - Deactivate inventory batch
inventoryRouter.delete(
  "/batches/:id",
  validateObjectId,
  deactivateInventoryBatch
);

export { inventoryRouter };

// backend/middleware/validation.js - ENHANCED VALIDATION
import { body, query, param, validationResult } from "express-validator";
import { AppError } from "./errorHandler.js";

// Handle validation results
export const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const errorMessages = errors.array().map((error) => {
      return `${error.param}: ${error.msg}`;
    });
    return next(
      new AppError(`Validation Error: ${errorMessages.join(", ")}`, 400)
    );
  }
  next();
};

// Enhanced sale validation with detailed error messages
export const validateSale = [
  body("products")
    .isArray({ min: 1 })
    .withMessage(
      "Products array is required and must contain at least one item"
    ),

  body("products.*.productId")
    .notEmpty()
    .withMessage("Product ID is required")
    .isMongoId()
    .withMessage("Product ID must be a valid MongoDB ObjectId"),

  body("products.*.productName")
    .trim()
    .notEmpty()
    .withMessage("Product name is required")
    .isLength({ min: 1, max: 200 })
    .withMessage("Product name must be between 1 and 200 characters"),

  body("products.*.quantity")
    .isNumeric()
    .withMessage("Quantity must be a number")
    .custom((value) => {
      const num = Number(value);
      if (!Number.isFinite(num) || num <= 0) {
        throw new Error("Quantity must be a positive number greater than 0");
      }
      return true;
    }),

  body("products.*.sellPrice")
    .isNumeric()
    .withMessage("Sell price must be a number")
    .custom((value) => {
      const num = Number(value);
      if (!Number.isFinite(num) || num < 0) {
        throw new Error("Sell price must be a non-negative number");
      }
      return true;
    }),

  body("products.*.total")
    .isNumeric()
    .withMessage("Total must be a number")
    .custom((value) => {
      const num = Number(value);
      if (!Number.isFinite(num) || num < 0) {
        throw new Error("Total must be a non-negative number");
      }
      return true;
    }),

  body("totalAmount")
    .isNumeric()
    .withMessage("Total amount must be a number")
    .custom((value) => {
      const num = Number(value);
      if (!Number.isFinite(num) || num <= 0) {
        throw new Error(
          "Total amount must be a positive number greater than 0"
        );
      }
      return true;
    }),

  body("cashierName")
    .trim()
    .notEmpty()
    .withMessage("Cashier name is required")
    .isLength({ min: 1, max: 100 })
    .withMessage("Cashier name must be between 1 and 100 characters"),

  body("paymentMethod")
    .optional()
    .isIn(["cash", "card", "digital"])
    .withMessage("Payment method must be cash, card, or digital"),

  body("customerName")
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage("Customer name cannot exceed 100 characters"),

  body("notes")
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage("Notes cannot exceed 500 characters"),

  // Cross-field validation for product totals
  body().custom((value, { req }) => {
    const { products, totalAmount } = req.body;

    if (!products || !Array.isArray(products)) {
      return true; // Will be caught by other validators
    }

    // Validate individual product calculations
    for (let i = 0; i < products.length; i++) {
      const product = products[i];
      const expectedTotal =
        Math.round(Number(product.sellPrice) * Number(product.quantity) * 100) /
        100;
      const actualTotal = Math.round(Number(product.total) * 100) / 100;

      if (Math.abs(actualTotal - expectedTotal) > 0.01) {
        throw new Error(
          `Product ${i + 1} (${
            product.productName
          }): Total (${actualTotal}) does not match sellPrice × quantity (${expectedTotal})`
        );
      }
    }

    // Validate total amount matches sum of product totals
    const calculatedTotal = products.reduce((sum, product) => {
      return sum + Math.round(Number(product.total) * 100) / 100;
    }, 0);

    const providedTotal = Math.round(Number(totalAmount) * 100) / 100;

    if (Math.abs(providedTotal - calculatedTotal) > 0.01) {
      throw new Error(
        `Total amount (${providedTotal}) does not match sum of product totals (${calculatedTotal})`
      );
    }

    return true;
  }),

  handleValidationErrors,
];

// Enhanced inventory batch validation
export const validateInventoryBatch = [
  body("productId")
    .notEmpty()
    .withMessage("Product ID is required")
    .isMongoId()
    .withMessage("Product ID must be a valid MongoDB ObjectId"),

  body("buyPrice")
    .isNumeric()
    .withMessage("Buy price must be a number")
    .custom((value) => {
      const num = Number(value);
      if (!Number.isFinite(num) || num < 0) {
        throw new Error("Buy price must be a non-negative number");
      }
      return true;
    }),

  body("quantity")
    .isNumeric()
    .withMessage("Quantity must be a number")
    .custom((value) => {
      const num = Number(value);
      if (!Number.isFinite(num) || num <= 0 || !Number.isInteger(num)) {
        throw new Error("Quantity must be a positive integer");
      }
      return true;
    }),

  body("purchaseDate")
    .optional()
    .isISO8601()
    .withMessage("Purchase date must be a valid ISO 8601 date")
    .custom((value) => {
      if (new Date(value) > new Date()) {
        throw new Error("Purchase date cannot be in the future");
      }
      return true;
    }),

  body("expiryDate")
    .optional()
    .isISO8601()
    .withMessage("Expiry date must be a valid ISO 8601 date")
    .custom((value, { req }) => {
      if (value) {
        const expiryDate = new Date(value);
        const purchaseDate = req.body.purchaseDate
          ? new Date(req.body.purchaseDate)
          : new Date();

        if (expiryDate <= purchaseDate) {
          throw new Error("Expiry date must be after purchase date");
        }
      }
      return true;
    }),

  body("supplierName")
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage("Supplier name cannot exceed 100 characters"),

  body("notes")
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage("Notes cannot exceed 500 characters"),

  handleValidationErrors,
];

// Product validation rules (enhanced)
export const validateProduct = [
  body("name")
    .trim()
    .notEmpty()
    .withMessage("Product name is required")
    .isLength({ min: 2, max: 100 })
    .withMessage("Product name must be between 2 and 100 characters"),

  body("category")
    .trim()
    .notEmpty()
    .withMessage("Category is required")
    .isLength({ min: 2, max: 50 })
    .withMessage("Category must be between 2 and 50 characters"),

  body("buyPrice")
    .isNumeric()
    .withMessage("Buy price must be a number")
    .custom((value) => {
      const num = Number(value);
      if (!Number.isFinite(num) || num < 0) {
        throw new Error("Buy price must be a non-negative number");
      }
      return true;
    }),

  body("sellPrice")
    .isNumeric()
    .withMessage("Sell price must be a number")
    .custom((value) => {
      const num = Number(value);
      if (!Number.isFinite(num) || num < 0) {
        throw new Error("Sell price must be a non-negative number");
      }
      return true;
    }),

  body("quantity")
    .isNumeric()
    .withMessage("Quantity must be a number")
    .custom((value) => {
      const num = Number(value);
      if (!Number.isFinite(num) || num < 0 || !Number.isInteger(num)) {
        throw new Error("Quantity must be a non-negative integer");
      }
      return true;
    }),

  body("description")
    .trim()
    .notEmpty()
    .withMessage("Description is required")
    .isLength({ min: 10, max: 500 })
    .withMessage("Description must be between 10 and 500 characters"),

  body("barcode")
    .optional()
    .custom((value) => {
      if (value === null || value === undefined || value === "") {
        return true; // Allow empty/null barcodes
      }

      const trimmed = String(value).trim();
      if (trimmed.length === 0) {
        return true; // Allow empty strings
      }

      if (trimmed.length < 6 || trimmed.length > 50) {
        throw new Error(
          "Barcode must be between 6 and 50 characters when provided"
        );
      }

      if (!/^[a-zA-Z0-9\-_]+$/.test(trimmed)) {
        throw new Error(
          "Barcode can only contain alphanumeric characters, hyphens, and underscores"
        );
      }

      return true;
    }),

  body("lowStockThreshold")
    .optional()
    .isNumeric()
    .withMessage("Low stock threshold must be a number")
    .custom((value) => {
      const num = Number(value);
      if (!Number.isFinite(num) || num < 0 || !Number.isInteger(num)) {
        throw new Error("Low stock threshold must be a non-negative integer");
      }
      return true;
    }),

  body("image").optional().isURL().withMessage("Image must be a valid URL"),

  // Cross-field validation for prices
  body().custom((value, { req }) => {
    const { buyPrice, sellPrice } = req.body;

    if (buyPrice !== undefined && sellPrice !== undefined) {
      const buy = Number(buyPrice);
      const sell = Number(sellPrice);

      if (Number.isFinite(buy) && Number.isFinite(sell) && sell < buy) {
        throw new Error(
          "Sell price must be greater than or equal to buy price"
        );
      }
    }

    return true;
  }),

  handleValidationErrors,
];

// Product update validation (all fields optional)
export const validateProductUpdate = [
  body("name")
    .optional()
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage("Product name must be between 2 and 100 characters"),

  body("category")
    .optional()
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage("Category must be between 2 and 50 characters"),

  body("buyPrice")
    .optional()
    .isNumeric()
    .withMessage("Buy price must be a number")
    .custom((value) => {
      const num = Number(value);
      if (!Number.isFinite(num) || num < 0) {
        throw new Error("Buy price must be a non-negative number");
      }
      return true;
    }),

  body("sellPrice")
    .optional()
    .isNumeric()
    .withMessage("Sell price must be a number")
    .custom((value) => {
      const num = Number(value);
      if (!Number.isFinite(num) || num < 0) {
        throw new Error("Sell price must be a non-negative number");
      }
      return true;
    }),

  body("quantity")
    .optional()
    .isNumeric()
    .withMessage("Quantity must be a number")
    .custom((value) => {
      const num = Number(value);
      if (!Number.isFinite(num) || num < 0 || !Number.isInteger(num)) {
        throw new Error("Quantity must be a non-negative integer");
      }
      return true;
    }),

  body("description")
    .optional()
    .trim()
    .isLength({ min: 10, max: 500 })
    .withMessage("Description must be between 10 and 500 characters"),

  body("barcode")
    .optional()
    .custom((value) => {
      if (value === null || value === undefined || value === "") {
        return true; // Allow empty/null barcodes
      }

      const trimmed = String(value).trim();
      if (trimmed.length === 0) {
        return true; // Allow empty strings
      }

      if (trimmed.length < 6 || trimmed.length > 50) {
        throw new Error(
          "Barcode must be between 6 and 50 characters when provided"
        );
      }

      if (!/^[a-zA-Z0-9\-_]+$/.test(trimmed)) {
        throw new Error(
          "Barcode can only contain alphanumeric characters, hyphens, and underscores"
        );
      }

      return true;
    }),

  body("lowStockThreshold")
    .optional()
    .isNumeric()
    .withMessage("Low stock threshold must be a number")
    .custom((value) => {
      const num = Number(value);
      if (!Number.isFinite(num) || num < 0 || !Number.isInteger(num)) {
        throw new Error("Low stock threshold must be a non-negative integer");
      }
      return true;
    }),

  body("image").optional().isURL().withMessage("Image must be a valid URL"),

  handleValidationErrors,
];

// MongoDB ObjectId validation
export const validateObjectId = [
  param("id")
    .isMongoId()
    .withMessage("Invalid ID format - must be a valid MongoDB ObjectId"),

  handleValidationErrors,
];

// Barcode validation for URL parameter
export const validateBarcode = [
  param("barcode")
    .isLength({ min: 6, max: 50 })
    .withMessage("Barcode must be between 6 and 50 characters")
    .matches(/^[0-9A-Za-z\-_]+$/)
    .withMessage(
      "Barcode can only contain alphanumeric characters, hyphens, and underscores"
    ),

  handleValidationErrors,
];

// Query validation for pagination and filtering
export const validateQuery = [
  query("page")
    .optional()
    .isInt({ min: 1 })
    .withMessage("Page must be a positive integer"),

  query("limit")
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage("Limit must be between 1 and 100"),

  query("category")
    .optional()
    .trim()
    .isLength({ min: 1, max: 50 })
    .withMessage("Category filter must be between 1 and 50 characters"),

  query("search")
    .optional()
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage("Search term must be between 1 and 100 characters"),

  query("barcode")
    .optional()
    .isLength({ min: 6, max: 50 })
    .withMessage("Barcode must be between 6 and 50 characters")
    .matches(/^[0-9A-Za-z\-_]+$/)
    .withMessage(
      "Barcode can only contain alphanumeric characters, hyphens, and underscores"
    ),

  query("sort")
    .optional()
    .isIn([
      "name",
      "-name",
      "category",
      "-category",
      "sellPrice",
      "-sellPrice",
      "quantity",
      "-quantity",
      "createdAt",
      "-createdAt",
      "purchaseDate",
      "-purchaseDate",
    ])
    .withMessage("Invalid sort field"),

  handleValidationErrors,
];

// Date range validation for analytics
export const validateDateRange = [
  query("startDate")
    .optional()
    .isISO8601()
    .withMessage("Start date must be a valid ISO 8601 date"),

  query("endDate")
    .optional()
    .isISO8601()
    .withMessage("End date must be a valid ISO 8601 date")
    .custom((value, { req }) => {
      if (req.query.startDate && value) {
        const startDate = new Date(req.query.startDate);
        const endDate = new Date(value);

        if (endDate < startDate) {
          throw new Error("End date must be after start date");
        }
      }
      return true;
    }),

  handleValidationErrors,
];
