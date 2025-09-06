import { body, query, param, validationResult } from "express-validator";
import { AppError } from "./errorHandler.js";

// Handle validation results
export const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const errorMessages = errors.array().map((error) => error.msg);
    return next(
      new AppError(`Validation Error: ${errorMessages.join(", ")}`, 400)
    );
  }
  next();
};

// Product validation rules
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
    .isFloat({ min: 0 })
    .withMessage("Buy price cannot be negative"),

  body("sellPrice")
    .isNumeric()
    .withMessage("Sell price must be a number")
    .isFloat({ min: 0 })
    .withMessage("Sell price cannot be negative")
    .custom((value, { req }) => {
      if (parseFloat(value) < parseFloat(req.body.buyPrice)) {
        throw new Error(
          "Sell price must be greater than or equal to buy price"
        );
      }
      return true;
    }),

  body("quantity")
    .isInt({ min: 0 })
    .withMessage("Quantity must be a non-negative integer"),

  body("description")
    .trim()
    .notEmpty()
    .withMessage("Description is required")
    .isLength({ min: 10, max: 500 })
    .withMessage("Description must be between 10 and 500 characters"),

  body("barcode")
    .optional()
    .isLength({ min: 8, max: 50 })
    .withMessage("Barcode must be between 8 and 50 characters")
    .matches(/^[0-9A-Za-z-_]+$/)
    .withMessage(
      "Barcode can only contain alphanumeric characters, hyphens, and underscores"
    ),

  body("lowStockThreshold")
    .optional()
    .isInt({ min: 0 })
    .withMessage("Low stock threshold must be a non-negative integer"),

  body("image").optional().isURL().withMessage("Image must be a valid URL"),

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
    .isFloat({ min: 0 })
    .withMessage("Buy price cannot be negative"),

  body("sellPrice")
    .optional()
    .isNumeric()
    .withMessage("Sell price must be a number")
    .isFloat({ min: 0 })
    .withMessage("Sell price cannot be negative")
    .custom((value, { req }) => {
      // Only validate cross-field relationship if both prices are provided
      if (req.body.buyPrice !== undefined && value !== undefined) {
        if (parseFloat(value) < parseFloat(req.body.buyPrice)) {
          throw new Error(
            "Sell price must be greater than or equal to buy price"
          );
        }
      }
      return true;
    }),

  body("quantity")
    .optional()
    .isInt({ min: 0 })
    .withMessage("Quantity must be a non-negative integer"),

  body("description")
    .optional()
    .trim()
    .isLength({ min: 10, max: 500 })
    .withMessage("Description must be between 10 and 500 characters"),

  body("barcode")
    .optional()
    .isLength({ min: 8, max: 50 })
    .withMessage("Barcode must be between 8 and 50 characters")
    .matches(/^[0-9A-Za-z-_]+$/)
    .withMessage(
      "Barcode can only contain alphanumeric characters, hyphens, and underscores"
    ),

  body("lowStockThreshold")
    .optional()
    .isInt({ min: 0 })
    .withMessage("Low stock threshold must be a non-negative integer"),

  body("image").optional().isURL().withMessage("Image must be a valid URL"),

  handleValidationErrors,
];

// Sale validation rules
export const validateSale = [
  body("products")
    .isArray({ min: 1 })
    .withMessage(
      "Products array is required and must contain at least one item"
    ),

  body("products.*.productId")
    .isMongoId()
    .withMessage("Product ID must be a valid MongoDB ObjectId"),

  body("products.*.productName")
    .trim()
    .notEmpty()
    .withMessage("Product name is required"),

  body("products.*.quantity")
    .isInt({ min: 1 })
    .withMessage("Quantity must be at least 1"),

  body("products.*.sellPrice")
    .isNumeric()
    .withMessage("Sell price must be a number")
    .isFloat({ min: 0 })
    .withMessage("Sell price cannot be negative"),

  body("products.*.total")
    .isNumeric()
    .withMessage("Total must be a number")
    .isFloat({ min: 0 })
    .withMessage("Total cannot be negative"),

  body("totalAmount")
    .isNumeric()
    .withMessage("Total amount must be a number")
    .isFloat({ min: 0 })
    .withMessage("Total amount cannot be negative"),

  body("cashierName")
    .trim()
    .notEmpty()
    .withMessage("Cashier name is required")
    .isLength({ min: 2, max: 100 })
    .withMessage("Cashier name must be between 2 and 100 characters"),

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

  handleValidationErrors,
];

// MongoDB ObjectId validation
export const validateObjectId = [
  param("id").isMongoId().withMessage("Invalid ID format"),

  handleValidationErrors,
];

// Barcode validation for URL parameter
export const validateBarcode = [
  param("barcode")
    .isLength({ min: 8, max: 50 })
    .withMessage("Barcode must be between 8 and 50 characters")
    .matches(/^[0-9A-Za-z-_]+$/)
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
    .isLength({ min: 8, max: 50 })
    .withMessage("Barcode must be between 8 and 50 characters")
    .matches(/^[0-9A-Za-z-_]+$/)
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
      if (
        req.query.startDate &&
        new Date(value) < new Date(req.query.startDate)
      ) {
        throw new Error("End date must be after start date");
      }
      return true;
    }),

  handleValidationErrors,
];

// Inventory batch validation rules
export const validateInventoryBatch = [
  body("productId")
    .notEmpty()
    .withMessage("Product ID is required")
    .isMongoId()
    .withMessage("Product ID must be a valid MongoDB ObjectId"),

  body("buyPrice")
    .isNumeric()
    .withMessage("Buy price must be a number")
    .isFloat({ min: 0 })
    .withMessage("Buy price cannot be negative"),

  body("quantity")
    .isInt({ min: 1 })
    .withMessage("Quantity must be a positive integer"),

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
      const purchaseDate = req.body.purchaseDate || new Date();
      if (new Date(value) <= new Date(purchaseDate)) {
        throw new Error("Expiry date must be after purchase date");
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
