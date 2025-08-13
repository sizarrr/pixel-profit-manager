import React, { createContext, useContext, useState, useEffect } from "react";
import { apiService, Product as ApiProduct, Sale as ApiSale } from "../lib/api";

export interface Product {
  id: string;
  name: string;
  category: string;
  buyPrice: number;
  sellPrice: number;
  quantity: number;
  description: string;
  image?: string;
  barcode?: string; // New field
  lowStockThreshold: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface Sale {
  id: string;
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
  date: Date;
}

interface DashboardData {
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
    profit?: number;
  }>;
}

interface MonthlyData {
  month: string;
  sales: number;
  profit: number;
}

interface StoreContextType {
  products: Product[];
  sales: Sale[];
  dashboardData: DashboardData | null;
  loading: boolean;
  error: string | null;
  addProduct: (
    product: Omit<Product, "id" | "createdAt" | "updatedAt" | "isActive">
  ) => Promise<void>;
  updateProduct: (id: string, product: Partial<Product>) => Promise<void>;
  deleteProduct: (id: string) => Promise<void>;
  addSale: (sale: Omit<Sale, "id" | "date" | "receiptNumber">) => Promise<void>;
  getLowStockProducts: () => Product[];
  getTodaysSales: () => number;
  getMonthlyStats: () => { sales: number; profit: number };
  getCategoryDistribution: () => {
    name: string;
    value: number;
    count: number;
  }[];
  getMonthlySalesData: () => MonthlyData[];
  refreshData: () => Promise<void>;
  searchProductByBarcode: (barcode: string) => Promise<Product | null>;
}

const StoreContext = createContext<StoreContextType | undefined>(undefined);

export const useStore = () => {
  const context = useContext(StoreContext);
  if (context === undefined) {
    throw new Error("useStore must be used within a StoreProvider");
  }
  return context;
};

// Helper function to convert API product to local product format
const convertApiProduct = (apiProduct: ApiProduct): Product => ({
  id: apiProduct._id,
  name: apiProduct.name,
  category: apiProduct.category,
  buyPrice: apiProduct.buyPrice,
  sellPrice: apiProduct.sellPrice,
  quantity: apiProduct.quantity,
  description: apiProduct.description || "",
  barcode: apiProduct.barcode, // New field
  lowStockThreshold: apiProduct.lowStockThreshold,
  isActive: apiProduct.isActive,
  createdAt: new Date(apiProduct.createdAt),
  updatedAt: new Date(apiProduct.updatedAt),
});

// Helper function to convert API sale to local sale format
const convertApiSale = (apiSale: ApiSale): Sale => ({
  id: apiSale._id,
  products: apiSale.products,
  totalAmount: apiSale.totalAmount,
  cashierName: apiSale.cashierName,
  paymentMethod: apiSale.paymentMethod,
  receiptNumber: apiSale.receiptNumber,
  date: new Date(apiSale.createdAt),
});

// Helper function to calculate profit for a sale
const calculateSaleProfit = (sale: Sale, products: Product[]): number => {
  return sale.products.reduce((saleProfit, saleProduct) => {
    const originalProduct = products.find(
      (p) => p.id === saleProduct.productId
    );
    if (originalProduct) {
      const profit =
        (saleProduct.sellPrice - originalProduct.buyPrice) *
        saleProduct.quantity;
      return saleProfit + Math.max(0, profit); // Ensure profit is not negative
    }
    return saleProfit;
  }, 0);
};

// Helper function to get month name from date
const getMonthName = (date: Date): string => {
  const months = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];
  return months[date.getMonth()];
};

// Helper function to get last 6 months data
const getLast6MonthsData = (
  sales: Sale[],
  products: Product[]
): MonthlyData[] => {
  const now = new Date();
  const monthsData: MonthlyData[] = [];

  // Generate last 6 months including current month
  for (let i = 5; i >= 0; i--) {
    const monthDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const monthName = getMonthName(monthDate);
    const year = monthDate.getFullYear();
    const month = monthDate.getMonth();

    // Filter sales for this month
    const monthSales = sales.filter((sale) => {
      const saleDate = new Date(sale.date);
      return saleDate.getFullYear() === year && saleDate.getMonth() === month;
    });

    // Calculate totals for this month
    const totalSales = monthSales.reduce(
      (sum, sale) => sum + sale.totalAmount,
      0
    );
    const totalProfit = monthSales.reduce((profit, sale) => {
      return profit + calculateSaleProfit(sale, products);
    }, 0);

    monthsData.push({
      month: monthName,
      sales: Math.round(totalSales * 100) / 100, // Round to 2 decimal places
      profit: Math.round(totalProfit * 100) / 100,
    });
  }

  return monthsData;
};

export const StoreProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [products, setProducts] = useState<Product[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(
    null
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load initial data
  const loadData = async () => {
    setLoading(true);
    setError(null);

    try {
      // Load products, sales, and dashboard data in parallel
      const [productsResponse, salesResponse, dashboardResponse] =
        await Promise.all([
          apiService.getProducts(),
          apiService.getSales(),
          apiService.getDashboardOverview(),
        ]);

      if (productsResponse.success) {
        setProducts(productsResponse.data.products.map(convertApiProduct));
      }

      if (salesResponse.success) {
        setSales(salesResponse.data.sales.map(convertApiSale));
      }

      if (dashboardResponse.success) {
        const data = dashboardResponse.data;
        setDashboardData({
          ...data,
          recentSales: data.recentSales.map(convertApiSale),
          // Ensure monthlySales has proper structure
          monthlySales: data.monthlySales || [],
        });
      }
    } catch (err) {
      console.error("Error loading data:", err);
      setError("Failed to load data from server");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const addProduct = async (
    productData: Omit<Product, "id" | "createdAt" | "updatedAt" | "isActive">
  ) => {
    setLoading(true);
    setError(null);

    try {
      const response = await apiService.createProduct({
        name: productData.name,
        category: productData.category,
        buyPrice: productData.buyPrice,
        sellPrice: productData.sellPrice,
        quantity: productData.quantity,
        description: productData.description,
        barcode: productData.barcode, // Make sure barcode is included
        lowStockThreshold: productData.lowStockThreshold || 5,
        isActive: true,
      });

      if (response.success) {
        const newProduct = convertApiProduct(response.data);
        setProducts((prev) => [...prev, newProduct]);
      }
    } catch (err) {
      console.error("Error adding product:", err);
      setError("Failed to add product");
      throw err;
    } finally {
      setLoading(false);
    }
  };
  const updateProduct = async (id: string, productData: Partial<Product>) => {
    setLoading(true);
    setError(null);

    try {
      const response = await apiService.updateProduct(id, {
        name: productData.name,
        category: productData.category,
        buyPrice: productData.buyPrice,
        sellPrice: productData.sellPrice,
        quantity: productData.quantity,
        description: productData.description,
        lowStockThreshold: productData.lowStockThreshold,
        isActive: productData.isActive,
      });

      if (response.success) {
        const updatedProduct = convertApiProduct(response.data);
        setProducts((prev) =>
          prev.map((product) => (product.id === id ? updatedProduct : product))
        );
      }
    } catch (err) {
      console.error("Error updating product:", err);
      setError("Failed to update product");
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const deleteProduct = async (id: string) => {
    setLoading(true);
    setError(null);

    try {
      const response = await apiService.deleteProduct(id);

      if (response.success) {
        setProducts((prev) => prev.filter((product) => product.id !== id));
      }
    } catch (err) {
      console.error("Error deleting product:", err);
      setError("Failed to delete product");
      throw err;
    } finally {
      setLoading(false);
    }
  };
  const searchProductByBarcode = async (
    barcode: string
  ): Promise<Product | null> => {
    try {
      console.log("🔍 Searching for barcode:", barcode);

      // First try API search
      const response = await apiService.getProductByBarcode(barcode);
      if (response.success && response.data && response.data.product) {
        console.log("✅ Found product via API:", response.data.product);
        return convertApiProduct(response.data.product);
      }
    } catch (error) {
      console.warn("⚠️ API barcode search failed, trying local search:", error);
    }

    try {
      // Fallback to local products search
      const localProduct = products.find(
        (p) =>
          p.barcode === barcode.trim() ||
          p.name.toLowerCase().includes(barcode.toLowerCase()) ||
          p.id === barcode.trim()
      );

      if (localProduct) {
        console.log("✅ Found product locally:", localProduct);
        return localProduct;
      }

      // If still not found, try searching via regular products API with barcode term
      const searchResponse = await apiService.getProducts({
        search: barcode,
        limit: 1,
      });
      if (
        searchResponse.success &&
        searchResponse.data.products &&
        searchResponse.data.products.length > 0
      ) {
        const foundProduct = searchResponse.data.products[0];
        console.log("✅ Found product via search API:", foundProduct);
        return convertApiProduct(foundProduct);
      }
    } catch (error) {
      console.error("❌ Local barcode search failed:", error);
    }

    console.log("❌ No product found for barcode:", barcode);
    return null;
  };
  const addSale = async (
    saleData: Omit<Sale, "id" | "date" | "receiptNumber">
  ) => {
    setLoading(true);
    setError(null);

    try {
      const response = await apiService.createSale({
        products: saleData.products,
        totalAmount: saleData.totalAmount,
        cashierName: saleData.cashierName,
        paymentMethod: saleData.paymentMethod || "cash",
      });

      if (response.success) {
        const newSale = convertApiSale(response.data);
        setSales((prev) => [newSale, ...prev]);

        // Refresh products to get updated quantities
        const productsResponse = await apiService.getProducts();
        if (productsResponse.success) {
          setProducts(productsResponse.data.products.map(convertApiProduct));
        }

        // Refresh dashboard data to update charts
        await refreshDashboardData();
      }
    } catch (err) {
      console.error("Error adding sale:", err);
      setError("Failed to process sale");
      throw err;
    } finally {
      setLoading(false);
    }
  };

  // Separate function to refresh dashboard data
  const refreshDashboardData = async () => {
    try {
      const dashboardResponse = await apiService.getDashboardOverview();
      if (dashboardResponse.success) {
        const data = dashboardResponse.data;
        setDashboardData({
          ...data,
          recentSales: data.recentSales.map(convertApiSale),
          monthlySales: data.monthlySales || [],
        });
      }
    } catch (err) {
      console.error("Error refreshing dashboard data:", err);
    }
  };

  const refreshData = async () => {
    await loadData();
  };

  // These methods work with local data for performance
  const getLowStockProducts = () => {
    return products.filter(
      (product) => product.quantity <= (product.lowStockThreshold || 5)
    );
  };

  const getTodaysSales = () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return sales
      .filter((sale) => sale.date >= today)
      .reduce((total, sale) => total + sale.totalAmount, 0);
  };

  const getMonthlyStats = () => {
    const thisMonth = new Date();
    thisMonth.setDate(1);
    thisMonth.setHours(0, 0, 0, 0);

    const monthlySales = sales.filter((sale) => sale.date >= thisMonth);
    const totalSales = monthlySales.reduce(
      (total, sale) => total + sale.totalAmount,
      0
    );

    // Calculate profit using the helper function
    const totalProfit = monthlySales.reduce((profit, sale) => {
      return profit + calculateSaleProfit(sale, products);
    }, 0);

    return {
      sales: Math.round(totalSales * 100) / 100,
      profit: Math.round(totalProfit * 100) / 100,
    };
  };

  const getCategoryDistribution = () => {
    const categoryMap = new Map<string, { value: number; count: number }>();

    products.forEach((product) => {
      const current = categoryMap.get(product.category) || {
        value: 0,
        count: 0,
      };
      categoryMap.set(product.category, {
        value: current.value + product.sellPrice * product.quantity,
        count: current.count + product.quantity,
      });
    });

    return Array.from(categoryMap.entries()).map(([name, data]) => ({
      name,
      value: data.value,
      count: data.count,
    }));
  };

  const getMonthlySalesData = (): MonthlyData[] => {
    try {
      // First, try to use dashboard data from API
      if (
        dashboardData?.monthlySales &&
        dashboardData.monthlySales.length > 0
      ) {
        console.log("Using dashboard API data for monthly sales");
        return dashboardData.monthlySales.map((ms) => ({
          month: ms.month,
          sales: ms.revenue || ms.sales || 0,
          profit: ms.profit || (ms.revenue ? ms.revenue * 0.2 : 0), // Estimate 20% profit margin if not provided
        }));
      }

      // Fallback to local calculation with improved logic
      console.log("Using local calculation for monthly sales data");
      return getLast6MonthsData(sales, products);
    } catch (error) {
      console.error("Error in getMonthlySalesData:", error);
      // Return empty data structure to prevent chart crashes
      return [
        { month: "Jan", sales: 0, profit: 0 },
        { month: "Feb", sales: 0, profit: 0 },
        { month: "Mar", sales: 0, profit: 0 },
        { month: "Apr", sales: 0, profit: 0 },
        { month: "May", sales: 0, profit: 0 },
        { month: "Jun", sales: 0, profit: 0 },
      ];
    }
  };

  return (
    <StoreContext.Provider
      value={{
        products,
        sales,
        dashboardData,
        loading,
        error,
        addProduct,
        updateProduct,
        deleteProduct,
        addSale,
        getLowStockProducts,
        getTodaysSales,
        getMonthlyStats,
        getCategoryDistribution,
        getMonthlySalesData,
        refreshData,
        searchProductByBarcode,
      }}
    >
      {children}
    </StoreContext.Provider>
  );
};
