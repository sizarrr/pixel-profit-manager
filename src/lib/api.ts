import axios from 'axios';

// Create axios instance with base configuration
const api = axios.create({
  baseURL: '/api/v1',
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
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

// Response interceptor for error handling
api.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    console.error('API Error:', error.response?.data || error.message);
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
    sortOrder?: 'asc' | 'desc';
  }) {
    const response = await api.get('/products', { params });
    return response.data;
  },

  async getProduct(id: string) {
    const response = await api.get(`/products/${id}`);
    return response.data;
  },

  async createProduct(product: Omit<Product, '_id' | 'createdAt' | 'updatedAt'>) {
    const response = await api.post('/products', product);
    return response.data;
  },

  async updateProduct(id: string, product: Partial<Product>) {
    const response = await api.put(`/products/${id}`, product);
    return response.data;
  },

  async deleteProduct(id: string) {
    const response = await api.delete(`/products/${id}`);
    return response.data;
  },

  async getLowStockProducts() {
    const response = await api.get('/products/low-stock');
    return response.data;
  },

  async getProductCategories() {
    const response = await api.get('/products/categories');
    return response.data;
  },

  // Sales
  async getSales(params?: {
    page?: number;
    limit?: number;
    startDate?: string;
    endDate?: string;
    cashierName?: string;
  }) {
    const response = await api.get('/sales', { params });
    return response.data;
  },

  async getSale(id: string) {
    const response = await api.get(`/sales/${id}`);
    return response.data;
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
    const response = await api.post('/sales', sale);
    return response.data;
  },

  async getSalesStats() {
    const response = await api.get('/sales/stats');
    return response.data;
  },

  async getTopProducts() {
    const response = await api.get('/sales/top-products');
    return response.data;
  },

  // Dashboard
  async getDashboardOverview() {
    const response = await api.get('/dashboard/overview');
    return response.data;
  },

  async getDashboardAnalytics() {
    const response = await api.get('/dashboard/analytics');
    return response.data;
  },

  async getInventoryInsights() {
    const response = await api.get('/dashboard/inventory-insights');
    return response.data;
  },

  // Health check
  async healthCheck() {
    const response = await api.get('/health');
    return response.data;
  },
};

export default apiService;