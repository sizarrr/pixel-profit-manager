import React, { createContext, useContext, useState, useEffect } from "react";
import { apiService, Product as ApiProduct, Sale as ApiSale } from "../lib/api";

// Utility function to calculate actual profit using FIFO batch allocations
export const calculateActualProfit = (saleProduct: Sale['products'][0], fallbackProduct?: Product): number => {
  if (saleProduct.batchAllocations && saleProduct.batchAllocations.length > 0) {
    // Use actual FIFO batch costs
    const totalCost = saleProduct.batchAllocations.reduce((cost, allocation) => {
      return cost + (allocation.buyPrice * allocation.quantity);
    }, 0);
    const totalRevenue = saleProduct.sellPrice * saleProduct.quantity;
    return totalRevenue - totalCost;
  } else if (fallbackProduct) {
    // Fallback to product buyPrice if no batch allocation data (for older sales)
    return (saleProduct.sellPrice - fallbackProduct.buyPrice) * saleProduct.quantity;
  }
  return 0;
};

export interface Product {
  id: string;
  _id: string; // Keep original MongoDB _id for backend operations
  name: string;
  category: string;
  buyPrice: number;
  sellPrice: number;
  quantity: number;
  description: string;
  image?: string;
  barcode?: string;
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
  _id: apiProduct._id, // Keep original MongoDB _id for backend operations
  name: apiProduct.name,
  category: apiProduct.category,
  buyPrice: apiProduct.buyPrice,
  sellPrice: apiProduct.sellPrice,
  quantity: apiProduct.quantity,
  description: apiProduct.description || "",
  barcode: apiProduct.barcode,
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
      return saleProfit + Math.max(0, profit);
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

  for (let i = 5; i >= 0; i--) {
    const monthDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const monthName = getMonthName(monthDate);
    const year = monthDate.getFullYear();
    const month = monthDate.getMonth();

    const monthSales = sales.filter((sale) => {
      const saleDate = new Date(sale.date);
      return saleDate.getFullYear() === year && saleDate.getMonth() === month;
    });

    const totalSales = monthSales.reduce(
      (sum, sale) => sum + sale.totalAmount,
      0
    );
    const totalProfit = monthSales.reduce((profit, sale) => {
      return profit + calculateSaleProfit(sale, products);
    }, 0);

    monthsData.push({
      month: monthName,
      sales: Math.round(totalSales * 100) / 100,
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
        barcode: productData.barcode,
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
    console.log("🔄 StoreContext: Updating product", id, productData);
    setLoading(true);
    setError(null);

    try {
      // Prepare the data for the API call
      const apiUpdateData: any = {};

      // Map frontend Product fields to backend fields
      if (productData.name !== undefined) apiUpdateData.name = productData.name;
      if (productData.category !== undefined)
        apiUpdateData.category = productData.category;
      if (productData.buyPrice !== undefined)
        apiUpdateData.buyPrice = productData.buyPrice;
      if (productData.sellPrice !== undefined)
        apiUpdateData.sellPrice = productData.sellPrice;
      if (productData.quantity !== undefined)
        apiUpdateData.quantity = productData.quantity;
      if (productData.description !== undefined)
        apiUpdateData.description = productData.description;
      if (productData.barcode !== undefined)
        apiUpdateData.barcode = productData.barcode;
      if (productData.lowStockThreshold !== undefined)
        apiUpdateData.lowStockThreshold = productData.lowStockThreshold;
      if (productData.isActive !== undefined)
        apiUpdateData.isActive = productData.isActive;

      console.log("📤 Sending to API:", apiUpdateData);

      const response = await apiService.updateProduct(id, apiUpdateData);

      if (response.success && response.data) {
        console.log("✅ API response successful:", response.data);
        const updatedProduct = convertApiProduct(response.data);
        console.log("✅ Converted product:", updatedProduct);

        setProducts((prev) => {
          const newProducts = prev.map((product) =>
            product.id === id ? updatedProduct : product
          );
          console.log("✅ Updated products state");
          return newProducts;
        });
      } else {
        throw new Error("Update response was not successful");
      }
    } catch (err: any) {
      console.error("❌ Error updating product:", err);

      // Extract meaningful error message
      let errorMessage = "Failed to update product";
      if (err.response?.data?.message) {
        errorMessage = err.response.data.message;
      } else if (err.message) {
        errorMessage = err.message;
      }

      setError(errorMessage);
      throw new Error(errorMessage);
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

      const response = await apiService.getProductByBarcode(barcode);
      if (response.success && response.data && response.data.product) {
        console.log("✅ Found product via API:", response.data.product);
        return convertApiProduct(response.data.product);
      }
    } catch (error) {
      console.warn("⚠️ API barcode search failed, trying local search:", error);
    }

    try {
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
      // Coerce numeric values to avoid 400 on backend due to string numbers
      const sanitizedProducts = saleData.products.map(p => ({
        ...p,
        quantity: Number(p.quantity),
        sellPrice: Number(p.sellPrice),
        total: Number(p.total)
      }));

      const response = await apiService.createSale({
        products: sanitizedProducts,
        totalAmount: Number(saleData.totalAmount),
        cashierName: saleData.cashierName,
        paymentMethod: saleData.paymentMethod || "cash",
      });

      if (response.success) {
        const newSale = convertApiSale(response.data);
        setSales((prev) => [newSale, ...prev]);

        const productsResponse = await apiService.getProducts();
        if (productsResponse.success) {
          setProducts(productsResponse.data.products.map(convertApiProduct));
        }

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
      if (
        dashboardData?.monthlySales &&
        dashboardData.monthlySales.length > 0
      ) {
        console.log("Using dashboard API data for monthly sales");
        return dashboardData.monthlySales.map((ms) => ({
          month: ms.month,
          sales: ms.revenue || ms.sales || 0,
          profit: ms.profit || (ms.revenue ? ms.revenue * 0.2 : 0),
        }));
      }

      console.log("Using local calculation for monthly sales data");
      return getLast6MonthsData(sales, products);
    } catch (error) {
      console.error("Error in getMonthlySalesData:", error);
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
