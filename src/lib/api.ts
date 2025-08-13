import axios from "axios";

// Create axios instance with base configuration
const api = axios.create({
  baseURL: "/api/v1",
  timeout: 10000,
  headers: {
    "Content-Type": "application/json",
  },
});

// Request interceptor for logging and auth
api.interceptors.request.use(
  (config) => {
    console.log(`API Request: ${config.method?.toUpperCase()} ${config.url}`);
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor to transform backend response format
api.interceptors.response.use(
  (response) => {
    // Transform backend response to match frontend expectations
    if (response.data && response.data.status === "success") {
      return {
        ...response,
        data: {
          success: true,
          data:
            response.data.data?.product ||
            response.data.data?.products ||
            response.data.data,
          message: response.data.message,
        },
      };
    }
    return response;
  },
  (error) => {
    console.error("API Error:", error.response?.data || error.message);

    // Transform error response
    if (error.response?.data) {
      const errorData = error.response.data;
      error.response.data = {
        success: false,
        message: errorData.message || "An error occurred",
        error: errorData.error,
      };
    }

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

// Barcode Utility Functions - ADD THESE HERE
export const barcodeUtils = {
  // Validate barcode format
  validateBarcode: (barcode: string): boolean => {
    if (!barcode || typeof barcode !== "string") return false;

    const trimmed = barcode.trim();

    // Common barcode formats: UPC (12 digits), EAN (13 digits), Code128 (variable)
    // Allow 6-20 alphanumeric characters to be flexible
    return /^[a-zA-Z0-9]{6,20}$/.test(trimmed);
  },

  // Format barcode for display
  formatBarcode: (barcode: string): string => {
    if (!barcode) return "";
    return barcode.trim().toUpperCase();
  },

  // Check if string looks like a barcode (for auto-detection)
  isBarcodeLike: (input: string): boolean => {
    if (!input || typeof input !== "string") return false;
    const trimmed = input.trim();

    // Consider it barcode-like if it's 8+ digits or alphanumeric 8+ chars
    return /^\d{8,}$/.test(trimmed) || /^[a-zA-Z0-9]{8,}$/.test(trimmed);
  },

  // Clean barcode input (remove special chars, spaces, etc.)
  cleanBarcode: (barcode: string): string => {
    if (!barcode) return "";
    return barcode
      .trim()
      .replace(/[^a-zA-Z0-9]/g, "")
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

      // Handle the nested products array from backend
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
        barcode: product.barcode?.trim() || undefined, // Remove empty strings
      };

      // Validate barcode if provided
      if (
        cleanProduct.barcode &&
        !barcodeUtils.validateBarcode(cleanProduct.barcode)
      ) {
        throw new Error("Invalid barcode format");
      }

      // Remove undefined values to prevent backend issues
      Object.keys(cleanProduct).forEach((key) => {
        if (cleanProduct[key] === undefined) {
          delete cleanProduct[key];
        }
      });

      const response = await api.post("/products", cleanProduct);
      console.log("✅ Product created, raw response:", response.data);

      return response.data;
    } catch (error) {
      console.error("❌ Error creating product:", error);
      console.error("Error details:", {
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data,
      });
      throw error;
    }
  },

  async updateProduct(id: string, product: Partial<Product>) {
    try {
      // Validate barcode if being updated
      if (product.barcode && !barcodeUtils.validateBarcode(product.barcode)) {
        throw new Error("Invalid barcode format");
      }

      const response = await api.put(`/products/${id}`, product);
      return response.data;
    } catch (error) {
      console.error("❌ Error updating product:", error);
      throw error;
    }
  },

  async deleteProduct(id: string) {
    try {
      const response = await api.delete(`/products/${id}`);
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

      // Clean and validate barcode
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

      // If it's a 404, return a structured response instead of throwing
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

      // Use the search endpoint with proper encoding
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

      // Handle the nested sales array from backend
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
      console.log("📊 Dashboard raw response:", response.data);

      // Transform dashboard response to handle your backend structure
      if (response.data && response.data.status === "success") {
        const data = response.data.data;
        console.log("📈 Dashboard data structure:", data);

        // Safely extract data with fallbacks
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

        console.log("✅ Transformed dashboard data:", transformedData);

        return {
          success: true,
          data: transformedData,
        };
      }

      console.warn("⚠️ Dashboard response missing expected structure");
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
      console.error("🔍 Error details:", {
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data,
      });

      // Return safe fallback data instead of throwing
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
