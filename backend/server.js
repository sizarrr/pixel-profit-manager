import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import compression from "compression";
import rateLimit from "express-rate-limit";

import config from "./config/config.js";
import connectDB from "./config/database.js";
import routes from "./routes/index.js";
import errorHandler, { notFound } from "./middleware/errorHandler.js";

// Create Express application
const app = express();
let server; // Will hold the HTTP server instance once started

// Connect to MongoDB
connectDB();

// Trust proxy (for rate limiting behind reverse proxy)
app.set("trust proxy", 1);

// Security middleware
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
  })
);

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

app.use(limiter);

// CORS configuration
app.use(
  cors({
    origin: config.corsOrigin,
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
  })
);

// Compression middleware
app.use(compression());

// Logging middleware
if (config.isDevelopment) {
  app.use(morgan("dev"));
} else {
  app.use(morgan("combined"));
}

// Body parsing middleware
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// API routes
app.use(config.apiPrefix, routes);

// Root endpoint
app.get("/", (req, res) => {
  res.status(200).json({
    status: "success",
    message: "Welcome to Store Management API",
    version: "1.0.0",
    documentation: `${req.protocol}://${req.get("host")}${
      config.apiPrefix
    }/health`,
    endpoints: {
      products: `${req.protocol}://${req.get("host")}${
        config.apiPrefix
      }/products`,
      sales: `${req.protocol}://${req.get("host")}${config.apiPrefix}/sales`,
      dashboard: `${req.protocol}://${req.get("host")}${
        config.apiPrefix
      }/dashboard`,
    },
  });
});

// Handle 404 errors
app.use(notFound);

// Global error handling middleware
app.use(errorHandler);

// Graceful shutdown handlers
const gracefulShutdown = (signal) => {
  console.log(`\n🔄 Received ${signal}. Graceful shutdown initiated...`);

  if (server && typeof server.close === "function") {
    server.close(() => {
      console.log("📪 HTTP server closed.");
      process.exit(0);
    });

    // Force close after 30 seconds
    setTimeout(() => {
      console.error(
        "❌ Could not close connections in time, forcefully shutting down"
      );
      process.exit(1);
    }, 30000);
  } else {
    // Server not yet started; exit immediately
    process.exit(0);
  }
};

// Handle unhandled promise rejections
process.on("unhandledRejection", (err, promise) => {
  console.error("❌ Unhandled Promise Rejection:", err.message);
  console.error(
    "💥 Shutting down the server due to unhandled promise rejection"
  );
  gracefulShutdown("UNHANDLED_REJECTION");
});

// Handle uncaught exceptions
process.on("uncaughtException", (err) => {
  console.error("❌ Uncaught Exception:", err.message);
  console.error("💥 Shutting down the server due to uncaught exception");
  process.exit(1);
});

// Graceful shutdown signals
process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));

// Start server
const PORT = config.port;
server = app.listen(PORT, () => {
  console.log(`
🚀 Store Management API Server Started!
📍 Environment: ${config.nodeEnv}
🌐 Port: ${PORT}
📊 API Base URL: http://localhost:${PORT}${config.apiPrefix}
🏥 Health Check: http://localhost:${PORT}${config.apiPrefix}/health
📚 API Documentation:
   - Products: http://localhost:${PORT}${config.apiPrefix}/products
   - Sales: http://localhost:${PORT}${config.apiPrefix}/sales  
   - Dashboard: http://localhost:${PORT}${config.apiPrefix}/dashboard

${
  config.isDevelopment
    ? "🔧 Development Mode - Detailed logging enabled"
    : "🔒 Production Mode - Security enhanced"
}
  `);
});

export default app;
