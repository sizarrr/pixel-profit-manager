import axios from "axios";

// Create axios instance with base configuration
const api = axios.create({
  baseURL: "/api/v1",
  timeout: 30000,
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
          data: response.data.data,
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

// Enhanced Types with FIFO support
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
  // FIFO-specific fields
  currentBuyPrice?: number;
  currentSellPrice?: number;
  totalQuantity?: number;
}

export interface InventoryBatch {
  _id: string;
  productId: string;
  batchNumber: string;
  purchaseDate: string;
  expiryDate?: string;
  buyPrice: number;
  sellPrice: number;
  initialQuantity: number;
  remainingQuantity: number;
  supplierName?: string;
  invoiceNumber?: string;
  notes?: string;
  status: "active" | "depleted" | "expired" | "cancelled";
  costDetails?: {
    shippingCost?: number;
    taxAmount?: number;
    otherCosts?: number;
  };
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
      batchNumber: string;
      quantity: number;
      buyPrice: number;
      sellPrice: number;
      profit: number;
    }[];
    totalCost?: number;
    totalPrice?: number;
    totalProfit?: number;
  }[];
  totalAmount: number;
  cashierName: string;
  paymentMethod: string;
  receiptNumber: string;
  createdAt: string;
  updatedAt: string;
  // FIFO-specific fields
  subtotal?: number;
  taxRate?: number;
  taxAmount?: number;
  discountAmount?: number;
  totalCost?: number;
  totalProfit?: number;
  status?: "completed" | "refunded" | "partial_refund" | "cancelled";
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

      const cleanProduct = {
        ...product,
        barcode: product.barcode?.trim() || undefined,
      };

      if (
        cleanProduct.barcode &&
        !barcodeUtils.validateBarcode(cleanProduct.barcode)
      ) {
        throw new Error("Invalid barcode format");
      }

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

      if (!id || typeof id !== "string" || id.trim() === "") {
        throw new Error("Invalid product ID");
      }

      const cleanProduct: any = {};

      Object.keys(product).forEach((key) => {
        const value = product[key];

        if (value !== undefined && value !== null) {
          switch (key) {
            case "name":
            case "category":
            case "description":
              if (typeof value === "string") {
                const trimmed = value.trim();
                if (trimmed.length > 0) {
                  cleanProduct[key] = trimmed;
                }
              }
              break;

            case "buyPrice":
            case "sellPrice":
              const numValue =
                typeof value === "string" ? parseFloat(value) : Number(value);
              if (!isNaN(numValue) && numValue >= 0) {
                cleanProduct[key] = Math.round(numValue * 100) / 100;
              }
              break;

            case "quantity":
            case "lowStockThreshold":
              const intValue =
                typeof value === "string" ? parseInt(value) : Number(value);
              if (!isNaN(intValue) && intValue >= 0) {
                cleanProduct[key] = intValue;
              }
              break;

            case "barcode":
              if (value === "" || value === null) {
                cleanProduct[key] = null;
              } else if (typeof value === "string") {
                const trimmed = value.trim();
                if (trimmed === "") {
                  cleanProduct[key] = null;
                } else {
                  if (barcodeUtils.validateBarcode(trimmed)) {
                    cleanProduct[key] = trimmed;
                  } else {
                    throw new Error("Invalid barcode format");
                  }
                }
              }
              break;

            case "isActive":
              cleanProduct[key] = Boolean(value);
              break;

            default:
              cleanProduct[key] = value;
          }
        } else if (key === "barcode" && (value === null || value === "")) {
          cleanProduct[key] = null;
        }
      });

      console.log("🧹 Cleaned update data:", cleanProduct);

      if (Object.keys(cleanProduct).length === 0) {
        console.log("⚠️ No valid fields to update");
        throw new Error("No valid fields to update");
      }

      const response = await api.put(`/products/${id}`, cleanProduct);
      console.log("✅ Product updated successfully");

      return response.data;
    } catch (error: any) {
      console.error("❌ Error updating product:", error);

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

  // Inventory/FIFO Methods
  async addInventoryBatch(batchData: {
    productId: string;
    purchaseDate?: Date;
    expiryDate?: Date;
    buyPrice: number;
    sellPrice: number;
    quantity: number;
    supplierName?: string;
    invoiceNumber?: string;
    notes?: string;
    shippingCost?: number;
    taxAmount?: number;
    otherCosts?: number;
  }) {
    try {
      console.log("🚀 Adding inventory batch:", batchData);

      const requestData = {
        productId: batchData.productId,
        purchaseDate:
          batchData.purchaseDate?.toISOString() || new Date().toISOString(),
        expiryDate: batchData.expiryDate?.toISOString(),
        buyPrice: Number(batchData.buyPrice),
        sellPrice: Number(batchData.sellPrice),
        quantity: Number(batchData.quantity),
        supplierName: batchData.supplierName,
        invoiceNumber: batchData.invoiceNumber,
        notes: batchData.notes,
        shippingCost: batchData.shippingCost || 0,
        taxAmount: batchData.taxAmount || 0,
        otherCosts: batchData.otherCosts || 0,
      };

      const response = await api.post("/inventory/batches", requestData);
      console.log("✅ Inventory batch added successfully");

      return response.data;
    } catch (error) {
      console.error("❌ Error adding inventory batch:", error);
      throw error;
    }
  },

  async getProductBatches(productId: string) {
    try {
      console.log("🔍 Getting batches for product:", productId);

      const response = await api.get(
        `/inventory/products/${productId}/batches`
      );
      console.log("✅ Product batches fetched:", response.data);

      return response.data;
    } catch (error) {
      console.error("❌ Error fetching product batches:", error);
      throw error;
    }
  },

  async getInventoryBatches(params?: {
    page?: number;
    limit?: number;
    productId?: string;
    status?: string;
  }) {
    try {
      const response = await api.get("/inventory/batches", { params });
      return response.data;
    } catch (error) {
      console.error("❌ Error fetching inventory batches:", error);
      throw error;
    }
  },

  async updateInventoryBatch(
    batchId: string,
    updates: Partial<InventoryBatch>
  ) {
    try {
      const response = await api.patch(
        `/inventory/batches/${batchId}`,
        updates
      );
      return response.data;
    } catch (error) {
      console.error("❌ Error updating inventory batch:", error);
      throw error;
    }
  },

  async getInventoryValuation() {
    try {
      const response = await api.get("/inventory/valuation");
      return response.data;
    } catch (error) {
      console.error("❌ Error fetching inventory valuation:", error);
      throw error;
    }
  },

  async getExpiringBatches(days: number = 30) {
    try {
      const response = await api.get(`/inventory/expiring?days=${days}`);
      return response.data;
    } catch (error) {
      console.error("❌ Error fetching expiring batches:", error);
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
    customerName?: string;
    customerPhone?: string;
    taxRate?: number;
    discountAmount?: number;
    notes?: string;
  }) {
    try {
      console.log("🚀 Creating FIFO sale:", sale);

      // Ensure all numeric values are properly formatted
      const saleData = {
        ...sale,
        products: sale.products.map((p) => ({
          ...p,
          quantity: Number(p.quantity),
          sellPrice: Number(p.sellPrice),
          total: Number(p.total),
        })),
        totalAmount: Number(sale.totalAmount),
        taxRate: sale.taxRate ? Number(sale.taxRate) : 0,
        discountAmount: sale.discountAmount ? Number(sale.discountAmount) : 0,
        paymentMethod: sale.paymentMethod || "cash",
      };

      const response = await api.post("/sales", saleData);
      console.log("✅ FIFO sale created successfully with batch allocations");

      return response.data;
    } catch (error) {
      console.error("❌ Error creating sale:", error);
      throw error;
    }
  },

  async getSalesBatchDetails(saleId: string) {
    try {
      const response = await api.get(`/sales/${saleId}/batches`);
      return response.data;
    } catch (error) {
      console.error("❌ Error fetching sale batch details:", error);
      throw error;
    }
  },

  async processSaleRefund(
    saleId: string,
    refundData: {
      refundItems: Array<{
        productId: string;
        quantity: number;
      }>;
      refundReason: string;
    }
  ) {
    try {
      const response = await api.post(`/sales/${saleId}/refund`, refundData);
      return response.data;
    } catch (error) {
      console.error("❌ Error processing sale refund:", error);
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

  async getSalesProfit() {
    try {
      const response = await api.get("/sales/profit");
      return response.data;
    } catch (error) {
      console.error("❌ Error fetching sales profit:", error);
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
