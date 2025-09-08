// backend/server.js - MAIN SERVER FILE WITH FIFO SUPPORT
import express from "express";
import cors from "cors";
import helmet from "helmet";
import compression from "compression";
import rateLimit from "express-rate-limit";
import connectDB from "./config/database.js";
import config from "./config/config.js";
import errorHandler, { notFound } from "./middleware/errorHandler.js";

// Import routes
import productRoutes from "./routes/products.js";
import salesRoutes from "./routes/sales.js";
import { inventoryRouter } from "./routes/inventory.js";
import dashboardRoutes from "./routes/dashboard.js";

const app = express();

// Trust proxy for rate limiting behind reverse proxy
app.set("trust proxy", 1);

// Security middleware
app.use(
  helmet({
    crossOriginEmbedderPolicy: false,
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'"],
        imgSrc: ["'self'", "data:", "https:"],
      },
    },
  })
);

// Compression middleware
app.use(compression());

// Rate limiting
const limiter = rateLimit({
  windowMs: config.rateLimitWindowMs,
  max: config.rateLimitMaxRequests,
  message: {
    status: "error",
    message: "Too many requests from this IP, please try again later.",
  },
  standardHeaders: true,
  legacyHeaders: false,
});

app.use("/api/", limiter);

// CORS configuration
app.use(
  cors({
    origin: function (origin, callback) {
      // Allow requests with no origin (like mobile apps or curl requests)
      if (!origin) return callback(null, true);

      const allowedOrigins = [
        config.corsOrigin,
        "http://localhost:3000",
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:3000",
      ];

      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      callback(new Error("Not allowed by CORS"));
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
  })
);

// Body parsing middleware
app.use(
  express.json({
    limit: "10mb",
    verify: (req, res, buf) => {
      try {
        JSON.parse(buf);
      } catch (e) {
        res.status(400).json({
          status: "error",
          message: "Invalid JSON in request body",
        });
        throw new Error("Invalid JSON");
      }
    },
  })
);

app.use(
  express.urlencoded({
    extended: true,
    limit: "10mb",
  })
);

// Request logging middleware
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  if (req.body && Object.keys(req.body).length > 0) {
    console.log("Request body keys:", Object.keys(req.body));
  }
  next();
});

// Health check endpoint
app.get("/health", (req, res) => {
  res.status(200).json({
    status: "success",
    message: "Server is running",
    timestamp: new Date().toISOString(),
    environment: config.nodeEnv,
    features: {
      fifo: true,
      inventoryBatches: true,
      realTimeStock: true,
    },
  });
});

// API Routes
app.use(`${config.apiPrefix}/products`, productRoutes);
app.use(`${config.apiPrefix}/sales`, salesRoutes);
app.use(`${config.apiPrefix}/inventory`, inventoryRouter);
app.use(`${config.apiPrefix}/dashboard`, dashboardRoutes);

// API documentation endpoint
app.get(`${config.apiPrefix}/docs`, (req, res) => {
  res.json({
    status: "success",
    data: {
      name: "Store Management API with FIFO Inventory",
      version: "1.0.0",
      description: "Complete inventory management system with FIFO support",
      endpoints: {
        products: {
          "GET /api/v1/products":
            "Get all products with filtering and pagination",
          "GET /api/v1/products/:id": "Get single product by ID",
          "GET /api/v1/products/barcode/:barcode": "Get product by barcode",
          "POST /api/v1/products": "Create new product",
          "PUT /api/v1/products/:id": "Update product",
          "DELETE /api/v1/products/:id": "Delete product (soft delete)",
        },
        sales: {
          "GET /api/v1/sales": "Get all sales with filtering",
          "GET /api/v1/sales/:id": "Get single sale by ID",
          "POST /api/v1/sales": "Create new sale (FIFO processing)",
          "GET /api/v1/sales/stats": "Get sales statistics",
          "GET /api/v1/sales/profit": "Get profit analysis with FIFO costs",
        },
        inventory: {
          "GET /api/v1/inventory/summary":
            "Get inventory summary with FIFO costs",
          "GET /api/v1/inventory/batches": "Get all inventory batches",
          "POST /api/v1/inventory/batches": "Add new inventory batch",
          "GET /api/v1/inventory/products/:id/batches":
            "Get batches for product",
          "PUT /api/v1/inventory/batches/:id": "Update inventory batch",
          "PUT /api/v1/inventory/batches/:id/adjust": "Adjust batch quantity",
          "GET /api/v1/inventory/low-stock": "Get low stock products",
          "GET /api/v1/inventory/expiring": "Get expiring batches",
        },
        dashboard: {
          "GET /api/v1/dashboard/overview":
            "Get dashboard overview with FIFO profits",
          "GET /api/v1/dashboard/analytics": "Get detailed analytics",
        },
      },
      features: {
        fifo: {
          description: "First-In-First-Out inventory management",
          benefits: [
            "Accurate cost tracking per sale",
            "Proper inventory valuation",
            "Automated oldest-stock-first allocation",
            "Detailed batch tracking and reporting",
          ],
        },
        validation: {
          description: "Comprehensive input validation",
          features: [
            "MongoDB ObjectId validation",
            "Price and quantity validation",
            "Cross-field validation for totals",
            "Barcode format validation",
          ],
        },
      },
    },
  });
});

// Catch-all for undefined API routes
app.all(`${config.apiPrefix}/*`, notFound);

// Global error handling middleware
app.use(errorHandler);

// Graceful shutdown handler
const gracefulShutdown = (signal) => {
  console.log(`\n${signal} received. Starting graceful shutdown...`);

  server.close((err) => {
    if (err) {
      console.error("Error during server shutdown:", err);
      process.exit(1);
    }

    console.log("HTTP server closed.");

    // Close database connection
    if (mongoose.connection.readyState === 1) {
      mongoose.connection.close(() => {
        console.log("MongoDB connection closed.");
        process.exit(0);
      });
    } else {
      process.exit(0);
    }
  });

  // Force close after 10 seconds
  setTimeout(() => {
    console.error("Forced shutdown after 10 seconds");
    process.exit(1);
  }, 10000);
};

// Start server
const startServer = async () => {
  try {
    // Connect to database
    await connectDB();
    console.log("✅ Database connected successfully");

    // Start HTTP server
    const PORT = config.port;
    const server = app.listen(PORT, () => {
      console.log(
        `🚀 Server running on port ${PORT} in ${config.nodeEnv} mode`
      );
      console.log(
        `📚 API Documentation: http://localhost:${PORT}${config.apiPrefix}/docs`
      );
      console.log(`🏥 Health Check: http://localhost:${PORT}/health`);
      console.log(`🔄 FIFO Inventory Management: ENABLED`);

      if (config.isDevelopment) {
        console.log(`🌐 Frontend URL: ${config.corsOrigin}`);
      }
    });

    // Graceful shutdown handlers
    process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
    process.on("SIGINT", () => gracefulShutdown("SIGINT"));

    // Handle uncaught exceptions
    process.on("uncaughtException", (err) => {
      console.error("Uncaught Exception:", err);
      gracefulShutdown("UNCAUGHT_EXCEPTION");
    });

    // Handle unhandled promise rejections
    process.on("unhandledRejection", (reason, promise) => {
      console.error("Unhandled Rejection at:", promise, "reason:", reason);
      gracefulShutdown("UNHANDLED_REJECTION");
    });

    return server;
  } catch (error) {
    console.error("❌ Failed to start server:", error);
    process.exit(1);
  }
};

// Start the server
const server = await startServer();

export default app;
