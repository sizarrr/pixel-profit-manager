import dotenv from "dotenv";

dotenv.config();

const resolvedNodeEnv = process.env.NODE_ENV || "development";

const config = {
  // Server Configuration
  port: process.env.PORT || 5000,
  nodeEnv: resolvedNodeEnv,

  // Database Configuration
  mongodbUri:
    process.env.MONGODB_URI || "mongodb://localhost:27017/store-management",

  // CORS Configuration
  corsOrigin: process.env.CORS_ORIGIN || "http://localhost:5173",

  // API Configuration
  apiPrefix: process.env.API_PREFIX || "/api/v1",

  // Rate Limiting
  rateLimitWindowMs: 15 * 60 * 1000, // 15 minutes
  rateLimitMaxRequests: 100, // limit each IP to 100 requests per windowMs

  // Pagination
  defaultPageSize: 20,
  maxPageSize: 100,

  // Low Stock Threshold
  defaultLowStockThreshold: 5,

  // Development settings
  isDevelopment: resolvedNodeEnv === "development",
  isProduction: resolvedNodeEnv === "production",

  // Logging
  logLevel: process.env.LOG_LEVEL || "info",
};

// Validate required environment variables
const requiredEnvVars = ["MONGODB_URI"];

if (config.isProduction) {
  requiredEnvVars.forEach((envVar) => {
    if (!process.env[envVar]) {
      console.error(`❌ Missing required environment variable: ${envVar}`);
      process.exit(1);
    }
  });
}

export default config;
