import express from "express";
import productRoutes from "./productRoutes.js";
import saleRoutes from "./saleRoutes.js";
import dashboardRoutes from "./dashboardRoutes.js";

const router = express.Router();

// API Routes
router.use("/products", productRoutes);
router.use("/sales", saleRoutes);
router.use("/dashboard", dashboardRoutes);

// Health check endpoint
router.get("/health", (req, res) => {
  res.status(200).json({
    status: "success",
    message: "Store Management API is running",
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || "development",
  });
});

export default router;
