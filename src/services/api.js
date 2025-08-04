const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

// Generic API request function
const apiRequest = async (endpoint, options = {}) => {
  const url = `${API_BASE_URL}${endpoint}`;
  const config = {
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    ...options,
  };

  if (config.body && typeof config.body === 'object') {
    config.body = JSON.stringify(config.body);
  }

  try {
    const response = await fetch(url, config);
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error(`API request failed: ${endpoint}`, error);
    throw error;
  }
};

// Products API
export const productsApi = {
  // Get all products
  getAll: (params = {}) => {
    const queryString = new URLSearchParams(params).toString();
    return apiRequest(`/products${queryString ? `?${queryString}` : ''}`);
  },

  // Get single product
  getById: (id) => apiRequest(`/products/${id}`),

  // Create new product
  create: (productData) => apiRequest('/products', {
    method: 'POST',
    body: productData,
  }),

  // Update product
  update: (id, productData) => apiRequest(`/products/${id}`, {
    method: 'PUT',
    body: productData,
  }),

  // Delete product
  delete: (id) => apiRequest(`/products/${id}`, {
    method: 'DELETE',
  }),

  // Get categories
  getCategories: () => apiRequest('/products/categories/list'),
};

// Sales API
export const salesApi = {
  // Get all sales
  getAll: (params = {}) => {
    const queryString = new URLSearchParams(params).toString();
    return apiRequest(`/sales${queryString ? `?${queryString}` : ''}`);
  },

  // Get single sale
  getById: (id) => apiRequest(`/sales/${id}`),

  // Create new sale
  create: (saleData) => apiRequest('/sales', {
    method: 'POST',
    body: saleData,
  }),

  // Delete/void sale
  delete: (id) => apiRequest(`/sales/${id}`, {
    method: 'DELETE',
  }),

  // Get today's summary
  getTodaySummary: () => apiRequest('/sales/today/summary'),
};

// Analytics API
export const analyticsApi = {
  // Get dashboard data
  getDashboard: () => apiRequest('/analytics/dashboard'),

  // Get monthly sales data
  getMonthlySales: (year) => {
    const params = year ? `?year=${year}` : '';
    return apiRequest(`/analytics/monthly-sales${params}`);
  },

  // Get top products
  getTopProducts: (params = {}) => {
    const queryString = new URLSearchParams(params).toString();
    return apiRequest(`/analytics/top-products${queryString ? `?${queryString}` : ''}`);
  },

  // Get sales by date
  getSalesByDate: (params) => {
    const queryString = new URLSearchParams(params).toString();
    return apiRequest(`/analytics/sales-by-date?${queryString}`);
  },

  // Get inventory value
  getInventoryValue: () => apiRequest('/analytics/inventory-value'),

  // Get profit analysis
  getProfitAnalysis: (params = {}) => {
    const queryString = new URLSearchParams(params).toString();
    return apiRequest(`/analytics/profit-analysis${queryString ? `?${queryString}` : ''}`);
  },
};

// Health check
export const healthApi = {
  check: () => apiRequest('/health'),
};

export default {
  products: productsApi,
  sales: salesApi,
  analytics: analyticsApi,
  health: healthApi,
};