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
      const response = await api.post("/products", product);
      console.log("✅ Product created, raw response:", response.data);

      // The response interceptor should have already transformed this
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
      const response = await api.get("/dashboard/overview");

      // Transform dashboard response
      if (response.data && response.data.status === "success") {
        const data = response.data.data;
        return {
          success: true,
          data: {
            totalProducts: data.products?.totalProducts || 0,
            totalSales: data.sales?.period?.totalSales || 0,
            totalRevenue: data.sales?.period?.totalRevenue || 0,
            totalProfit: data.profit?.totalProfit || 0,
            lowStockProducts: data.products?.lowStockCount || 0,
            recentSales: data.recentSales || [],
            topProducts: data.topProducts || [],
            salesByCategory: data.categoryDistribution || [],
            monthlySales: data.monthlySalesData || [],
          },
        };
      }

      return response.data;
    } catch (error) {
      console.error("❌ Error fetching dashboard overview:", error);
      // Return empty data instead of throwing
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
