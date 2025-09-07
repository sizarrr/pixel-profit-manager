import axios from "axios";

// Create axios instance with base configuration
const api = axios.create({
  baseURL: "/api/v1",
  timeout: 30000, // Increased timeout for update operations
  headers: {
    "Content-Type": "application/json",
  },
});

// Request interceptor for logging and auth
api.interceptors.request.use(
  (config) => {
    console.log(
      `🚀 API Request: ${config.method?.toUpperCase()} ${config.url}`
    );
    if (config.data) {
      console.log("📤 Request Data:", JSON.stringify(config.data, null, 2));
    }
    return config;
  },
  (error) => {
    console.error("❌ Request Error:", error);
    return Promise.reject(error);
  }
);

// Response interceptor to transform backend response format
api.interceptors.response.use(
  (response) => {
    console.log(
      `✅ API Response: ${response.config.method?.toUpperCase()} ${
        response.config.url
      } - ${response.status}`
    );

    // Transform backend response to match frontend expectations
    if (response.data && response.data.status === "success") {
      return {
        ...response,
        data: {
          success: true,
          data:
            response.data.data?.product ||
            response.data.data?.products ||
            response.data.data ||
            response.data.data,
          message: response.data.message,
        },
      };
    }
    return response;
  },
  (error) => {
    console.error("❌ API Error Details:");
    console.error("Status:", error.response?.status);
    console.error("Status Text:", error.response?.statusText);
    console.error("Response Data:", error.response?.data);
    console.error("Request URL:", error.config?.url);
    console.error("Request Method:", error.config?.method);
    console.error("Request Data:", error.config?.data);

    // Transform error response to be more informative
    if (error.response?.data) {
      const errorData = error.response.data;

      // Create a detailed error object
      const transformedError = {
        ...error,
        response: {
          ...error.response,
          data: {
            success: false,
            message:
              errorData.message ||
              errorData.error ||
              `HTTP ${error.response.status} Error`,
            error: errorData.error,
            statusCode: error.response.status,
            details: errorData.details || errorData.stack,
          },
        },
      };

      return Promise.reject(transformedError);
    }

    // Network or other errors
    error.response = {
      data: {
        success: false,
        message: error.message || "Network error occurred",
        error: "NETWORK_ERROR",
        statusCode: 0,
      },
    };

    return Promise.reject(error);
  }
);

// Types
export interface Product {
  _id: string;
  name: string;
  category: string;
  buyPrice: number;
  sellPrice: number;
  quantity: number;
  description?: string;
  barcode?: string;
  lowStockThreshold: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Sale {
  _id: string;
  products: {
    productId: string;
    productName: string;
    quantity: number;
    sellPrice: number;
    total: number;
    batchAllocations?: {
      batchId: string;
      quantity: number;
      buyPrice: number;
      batchNumber: string;
    }[];
  }[];
  totalAmount: number;
  cashierName: string;
  paymentMethod: string;
  receiptNumber: string;
  createdAt: string;
  updatedAt: string;
}

export interface DashboardOverview {
  totalProducts: number;
  totalSales: number;
  totalRevenue: number;
  totalProfit: number;
  lowStockProducts: number;
  recentSales: Sale[];
  topProducts: Array<{
    _id: string;
    name: string;
    totalSold: number;
    revenue: number;
  }>;
  salesByCategory: Array<{
    _id: string;
    totalSales: number;
    totalRevenue: number;
  }>;
  monthlySales: Array<{
    month: string;
    sales: number;
    revenue: number;
  }>;
}

// Barcode Utility Functions
export const barcodeUtils = {
  validateBarcode: (barcode: string): boolean => {
    if (!barcode || typeof barcode !== "string") return false;
    const trimmed = barcode.trim();
    return /^[a-zA-Z0-9\-_]{6,50}$/.test(trimmed);
  },

  formatBarcode: (barcode: string): string => {
    if (!barcode) return "";
    return barcode.trim().toUpperCase();
  },

  isBarcodeLike: (input: string): boolean => {
    if (!input || typeof input !== "string") return false;
    const trimmed = input.trim();
    return /^\d{8,}$/.test(trimmed) || /^[a-zA-Z0-9]{8,}$/.test(trimmed);
  },

  cleanBarcode: (barcode: string): string => {
    if (!barcode) return "";
    return barcode
      .trim()
      .replace(/[^a-zA-Z0-9\-_]/g, "")
      .toUpperCase();
  },
};

// API Methods
export const apiService = {
  // Products
  async getProducts(params?: {
    page?: number;
    limit?: number;
    category?: string;
    search?: string;
    sortBy?: string;
    sortOrder?: "asc" | "desc";
  }) {
    try {
      const response = await api.get("/products", { params });
      console.log("✅ Products fetched:", response.data);

      if (response.data.success && response.data.data) {
        return {
          success: true,
          data: {
            products: Array.isArray(response.data.data)
              ? response.data.data
              : response.data.data.products || [],
          },
        };
      }

      return response.data;
    } catch (error) {
      console.error("❌ Error fetching products:", error);
      throw error;
    }
  },

  async getProduct(id: string) {
    try {
      const response = await api.get(`/products/${id}`);
      return response.data;
    } catch (error) {
      console.error("❌ Error fetching product:", error);
      throw error;
    }
  },

  async createProduct(
    product: Omit<Product, "_id" | "createdAt" | "updatedAt">
  ) {
    try {
      console.log("🚀 Creating product:", product);

      // Clean up the product data before sending
      const cleanProduct = {
        ...product,
        barcode: product.barcode?.trim() || undefined,
      };

      // Validate barcode if provided
      if (
        cleanProduct.barcode &&
        !barcodeUtils.validateBarcode(cleanProduct.barcode)
      ) {
        throw new Error("Invalid barcode format");
      }

      // Remove undefined values
      Object.keys(cleanProduct).forEach((key) => {
        if (cleanProduct[key] === undefined) {
          delete cleanProduct[key];
        }
      });

      const response = await api.post("/products", cleanProduct);
      console.log("✅ Product created successfully");

      return response.data;
    } catch (error) {
      console.error("❌ Error creating product:", error);
      throw error;
    }
  },

  async updateProduct(id: string, product: Partial<Product>) {
    try {
      console.log("🔄 Updating product:", id);
      console.log("📝 Update data:", product);

      // Validate ID format
      if (!id || typeof id !== "string" || id.trim() === "") {
        throw new Error("Invalid product ID");
      }

      // Clean and validate the update data
      const cleanProduct: any = {};

      // Only include defined values and clean them appropriately
      Object.keys(product).forEach((key) => {
        const value = product[key];

        if (value !== undefined && value !== null) {
          switch (key) {
            case "name":
            case "category":
            case "description":
              // String fields - trim and validate length
              if (typeof value === "string") {
                const trimmed = value.trim();
                if (trimmed.length > 0) {
                  cleanProduct[key] = trimmed;
                }
              }
              break;

            case "buyPrice":
            case "sellPrice":
              // Price fields - ensure they're valid numbers
              const numValue =
                typeof value === "string" ? parseFloat(value) : Number(value);
              if (!isNaN(numValue) && numValue >= 0) {
                cleanProduct[key] = Math.round(numValue * 100) / 100; // Round to 2 decimals
              }
              break;

            case "quantity":
            case "lowStockThreshold":
              // Integer fields
              const intValue =
                typeof value === "string" ? parseInt(value) : Number(value);
              if (!isNaN(intValue) && intValue >= 0) {
                cleanProduct[key] = intValue;
              }
              break;

            case "barcode":
              // Special handling for barcode - can be empty string, null, or valid barcode
              if (value === "" || value === null) {
                cleanProduct[key] = null;
              } else if (typeof value === "string") {
                const trimmed = value.trim();
                if (trimmed === "") {
                  cleanProduct[key] = null;
                } else {
                  // Validate barcode format
                  if (barcodeUtils.validateBarcode(trimmed)) {
                    cleanProduct[key] = trimmed;
                  } else {
                    throw new Error("Invalid barcode format");
                  }
                }
              }
              break;

            case "isActive":
              // Boolean field
              cleanProduct[key] = Boolean(value);
              break;

            default:
              // For any other fields, include as-is if they're not undefined/null
              cleanProduct[key] = value;
          }
        } else if (key === "barcode" && (value === null || value === "")) {
          // Special case: explicitly setting barcode to null/empty
          cleanProduct[key] = null;
        }
      });

      console.log("🧹 Cleaned update data:", cleanProduct);

      // Validate prices relationship if both are being updated or one is being updated
      if (
        cleanProduct.buyPrice !== undefined ||
        cleanProduct.sellPrice !== undefined
      ) {
        // We can't validate the relationship here without knowing the current values
        // The backend will handle this validation
      }

      // Make sure we have at least one field to update
      if (Object.keys(cleanProduct).length === 0) {
        console.log("⚠️ No valid fields to update");
        throw new Error("No valid fields to update");
      }

      const response = await api.put(`/products/${id}`, cleanProduct);
      console.log("✅ Product updated successfully");

      return response.data;
    } catch (error: any) {
      console.error("❌ Error updating product:", error);

      // Re-throw with more context
      if (error.response?.data?.message) {
        const enhancedError = new Error(error.response.data.message);
        enhancedError.response = error.response;
        throw enhancedError;
      }

      throw error;
    }
  },

  async deleteProduct(id: string) {
    try {
      console.log("🗑️ Deleting product:", id);
      const response = await api.delete(`/products/${id}`);
      console.log("✅ Product deleted successfully");

      return {
        success: true,
        message: "Product deleted successfully",
      };
    } catch (error) {
      console.error("❌ Error deleting product:", error);
      throw error;
    }
  },

  async getLowStockProducts() {
    try {
      const response = await api.get("/products/low-stock");
      return response.data;
    } catch (error) {
      console.error("❌ Error fetching low stock products:", error);
      throw error;
    }
  },

  async getProductCategories() {
    try {
      const response = await api.get("/products/categories");
      return response.data;
    } catch (error) {
      console.error("❌ Error fetching categories:", error);
      throw error;
    }
  },

  async getProductByBarcode(barcode: string) {
    try {
      console.log("🔍 API: Searching for barcode:", barcode);

      const cleanedBarcode = barcodeUtils.cleanBarcode(barcode);
      if (!barcodeUtils.validateBarcode(cleanedBarcode)) {
        throw new Error("Invalid barcode format");
      }

      const response = await api.get(
        `/products/barcode/${encodeURIComponent(cleanedBarcode)}`
      );
      console.log("✅ API: Barcode search response:", response.data);
      return response.data;
    } catch (error) {
      console.error("❌ API: Error fetching product by barcode:", error);

      if (error.response?.status === 404) {
        return {
          success: false,
          message: "Product not found",
          data: null,
        };
      }
      throw error;
    }
  },

  async searchProducts(query: string) {
    try {
      console.log("🔍 API: Searching products with query:", query);

      const response = await api.get(
        `/products/search?query=${encodeURIComponent(query)}`
      );
      console.log("✅ API: Search results:", response.data);

      return response.data;
    } catch (error) {
      console.error("❌ API: Error searching products:", error);
      throw error;
    }
  },

  // Sales
  async getSales(params?: {
    page?: number;
    limit?: number;
    startDate?: string;
    endDate?: string;
    cashierName?: string;
  }) {
    try {
      const response = await api.get("/sales", { params });

      if (response.data.success && response.data.data) {
        return {
          success: true,
          data: {
            sales: Array.isArray(response.data.data)
              ? response.data.data
              : response.data.data.sales || [],
          },
        };
      }

      return response.data;
    } catch (error) {
      console.error("❌ Error fetching sales:", error);
      throw error;
    }
  },

  async getSale(id: string) {
    try {
      const response = await api.get(`/sales/${id}`);
      return response.data;
    } catch (error) {
      console.error("❌ Error fetching sale:", error);
      throw error;
    }
  },

  async createSale(sale: {
    products: Array<{
      productId: string;
      productName: string;
      quantity: number;
      sellPrice: number;
      total: number;
    }>;
    totalAmount: number;
    cashierName: string;
    paymentMethod?: string;
  }) {
    try {
      const response = await api.post("/sales", sale);
      return response.data;
    } catch (error) {
      console.error("❌ Error creating sale:", error);
      throw error;
    }
  },

  async getSalesStats() {
    try {
      const response = await api.get("/sales/stats");
      return response.data;
    } catch (error) {
      console.error("❌ Error fetching sales stats:", error);
      throw error;
    }
  },

  async getTopProducts() {
    try {
      const response = await api.get("/sales/top-products");
      return response.data;
    } catch (error) {
      console.error("❌ Error fetching top products:", error);
      throw error;
    }
  },

  // Dashboard
  async getDashboardOverview() {
    try {
      console.log("🔍 Fetching dashboard overview...");
      const response = await api.get("/dashboard/overview");

      if (response.data && response.data.status === "success") {
        const data = response.data.data;

        const transformedData = {
          totalProducts: data.products?.totalProducts || 0,
          totalSales: data.sales?.period?.totalSales || 0,
          totalRevenue: data.sales?.period?.totalRevenue || 0,
          totalProfit: data.profit?.totalProfit || 0,
          lowStockProducts: data.products?.lowStockCount || 0,
          recentSales: Array.isArray(data.recentSales) ? data.recentSales : [],
          topProducts: Array.isArray(data.topProducts) ? data.topProducts : [],
          salesByCategory: Array.isArray(data.categoryDistribution)
            ? data.categoryDistribution
            : [],
          monthlySales: Array.isArray(data.monthlySalesData)
            ? data.monthlySalesData
            : [],
        };

        return {
          success: true,
          data: transformedData,
        };
      }

      return {
        success: true,
        data: {
          totalProducts: 0,
          totalSales: 0,
          totalRevenue: 0,
          totalProfit: 0,
          lowStockProducts: 0,
          recentSales: [],
          topProducts: [],
          salesByCategory: [],
          monthlySales: [],
        },
      };
    } catch (error) {
      console.error("❌ Error fetching dashboard overview:", error);

      return {
        success: true,
        data: {
          totalProducts: 0,
          totalSales: 0,
          totalRevenue: 0,
          totalProfit: 0,
          lowStockProducts: 0,
          recentSales: [],
          topProducts: [],
          salesByCategory: [],
          monthlySales: [],
        },
      };
    }
  },

  async getDashboardAnalytics() {
    try {
      const response = await api.get("/dashboard/analytics");
      return response.data;
    } catch (error) {
      console.error("❌ Error fetching dashboard analytics:", error);
      throw error;
    }
  },

  async getInventoryInsights() {
    try {
      const response = await api.get("/dashboard/inventory-insights");
      return response.data;
    } catch (error) {
      console.error("❌ Error fetching inventory insights:", error);
      throw error;
    }
  },

  // Health check
  async healthCheck() {
    try {
      const response = await api.get("/health");
      console.log("✅ Health check passed:", response.data);
      return response.data;
    } catch (error) {
      console.error("❌ Health check failed:", error);
      throw error;
    }
  },
};

export default apiService;
