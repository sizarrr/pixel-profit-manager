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
  }>;
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
  getMonthlySalesData: () => { month: string; sales: number; profit: number }[];
  refreshData: () => Promise<void>;
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
      }
    } catch (err) {
      console.error("Error adding sale:", err);
      setError("Failed to process sale");
      throw err;
    } finally {
      setLoading(false);
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

    // Calculate profit
    const totalProfit = monthlySales.reduce((profit, sale) => {
      const saleProfit = sale.products.reduce((sp, product) => {
        const originalProduct = products.find(
          (p) => p.id === product.productId
        );
        if (originalProduct) {
          return (
            sp +
            (product.sellPrice - originalProduct.buyPrice) * product.quantity
          );
        }
        return sp;
      }, 0);
      return profit + saleProfit;
    }, 0);

    return { sales: totalSales, profit: totalProfit };
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

  const getMonthlySalesData = () => {
    if (dashboardData?.monthlySales) {
      // Map dashboardData.monthlySales to ensure 'profit' property exists
      return dashboardData.monthlySales.map((ms) => ({
        month: ms.month,
        sales: ms.sales,
        profit:
          typeof (ms as any).profit !== "undefined"
            ? (ms as any).profit
            : typeof ms.revenue !== "undefined"
            ? ms.revenue
            : 0,
      }));
    }

    // Fallback to local calculation
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
    const currentMonth = new Date().getMonth();

    return months.slice(0, currentMonth + 1).map((month, index) => {
      const monthSales = sales.filter((sale) => sale.date.getMonth() === index);
      const totalSales = monthSales.reduce(
        (total, sale) => total + sale.totalAmount,
        0
      );
      const totalProfit = monthSales.reduce((profit, sale) => {
        const saleProfit = sale.products.reduce((sp, product) => {
          const originalProduct = products.find(
            (p) => p.id === product.productId
          );
          if (originalProduct) {
            return (
              sp +
              (product.sellPrice - originalProduct.buyPrice) * product.quantity
            );
          }
          return sp;
        }, 0);
        return profit + saleProfit;
      }, 0);

      return { month, sales: totalSales, profit: totalProfit };
    });
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
      }}
    >
      {children}
    </StoreContext.Provider>
  );
};
