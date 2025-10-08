// backend/routes/loanRoutes.js - Loan Sales Routes
import express from "express";
import {
  getAllLoans,
  getLoan,
  createLoanFromSale,
  createLoanDirect,
  recordPayment,
  getLoanStatistics,
  getOverdueLoans,
  updateLoanStatus,
  getLoansByDateRange,
  getCustomerLoans,
} from "../controllers/loanController.js";
import {
  validateObjectId,
  validateQuery,
  validateDateRange,
} from "../middleware/validation.js";

const router = express.Router();

// Loan analytics and statistics endpoints
router.get("/statistics", getLoanStatistics);
router.get("/overdue", getOverdueLoans);
router.get("/by-date", validateDateRange, getLoansByDateRange);
router.get("/customer", getCustomerLoans);

// Direct loan creation (without sale)
router.post("/direct", createLoanDirect);

// Main CRUD operations
router
  .route("/")
  .get(validateQuery, getAllLoans)
  .post(createLoanFromSale);

// Individual loan operations
router.route("/:id").get(validateObjectId, getLoan);

// Payment operations
router.post("/:id/payment", validateObjectId, recordPayment);

// Status updates
router.patch("/:id/status", validateObjectId, updateLoanStatus);

export default router;