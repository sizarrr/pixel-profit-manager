// backend/routes/index.js - MAIN ROUTES INDEX
import express from "express";
import productRoutes from "./productRoutes.js";
import saleRoutes from "./saleRoutes.js";
import dashboardRoutes from "./dashboardRoutes.js";
import inventoryRoutes from "./inventoryRoutes.js";

const router = express.Router();

// API Routes
router.use("/products", productRoutes);
router.use("/sales", saleRoutes);
router.use("/dashboard", dashboardRoutes);
router.use("/inventory", inventoryRoutes);

// Health check endpoint
router.get("/health", (req, res) => {
  res.status(200).json({
    status: "success",
    message: "Store Management API is running",
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || "development",
  });
});

// API info endpoint
router.get("/", (req, res) => {
  res.status(200).json({
    status: "success",
    message: "Store Management API v1.0",
    endpoints: {
      products: "/products",
      sales: "/sales",
      dashboard: "/dashboard",
      inventory: "/inventory",
      health: "/health",
    },
  });
});

export default router;
