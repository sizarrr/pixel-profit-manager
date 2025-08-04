
import React, { createContext, useContext, useState, useEffect } from 'react';
import { productsApi, salesApi, analyticsApi } from '@/services/api';

export interface Product {
  id: string;
  name: string;
  category: string;
  buyPrice: number;
  sellPrice: number;
  quantity: number;
  description: string;
  image?: string;
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
  date: Date;
}

interface StoreContextType {
  products: Product[];
  sales: Sale[];
  loading: boolean;
  error: string | null;
  addProduct: (product: Omit<Product, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>;
  updateProduct: (id: string, product: Partial<Product>) => Promise<void>;
  deleteProduct: (id: string) => Promise<void>;
  addSale: (sale: Omit<Sale, 'id' | 'date'>) => Promise<void>;
  refreshProducts: () => Promise<void>;
  refreshSales: () => Promise<void>;
  getLowStockProducts: () => Product[];
  getTodaysSales: () => number;
  getMonthlyStats: () => { sales: number; profit: number };
  getCategoryDistribution: () => { name: string; value: number; count: number }[];
  getMonthlySalesData: () => { month: string; sales: number; profit: number }[];
}

const StoreContext = createContext<StoreContextType | undefined>(undefined);

export const useStore = () => {
  const context = useContext(StoreContext);
  if (context === undefined) {
    throw new Error('useStore must be used within a StoreProvider');
  }
  return context;
};

// Mock data for demonstration
const mockProducts: Product[] = [
  {
    id: '1',
    name: 'Gaming Laptop RTX 4060',
    category: 'Laptops',
    buyPrice: 800,
    sellPrice: 1200,
    quantity: 15,
    description: 'High-performance gaming laptop with RTX 4060',
    createdAt: new Date('2024-01-15'),
    updatedAt: new Date('2024-01-15')
  },
  {
    id: '2',
    name: 'Wireless Gaming Mouse',
    category: 'Accessories',
    buyPrice: 25,
    sellPrice: 45,
    quantity: 3,
    description: 'Ergonomic wireless gaming mouse',
    createdAt: new Date('2024-01-10'),
    updatedAt: new Date('2024-01-10')
  },
  {
    id: '3',
    name: 'Mechanical Keyboard RGB',
    category: 'Accessories',
    buyPrice: 60,
    sellPrice: 95,
    quantity: 8,
    description: 'RGB mechanical keyboard with Cherry MX switches',
    createdAt: new Date('2024-01-12'),
    updatedAt: new Date('2024-01-12')
  },
  {
    id: '4',
    name: '27" 4K Monitor',
    category: 'Monitors',
    buyPrice: 300,
    sellPrice: 450,
    quantity: 12,
    description: '27-inch 4K UHD monitor with HDR support',
    createdAt: new Date('2024-01-08'),
    updatedAt: new Date('2024-01-08')
  }
];

const mockSales: Sale[] = [
  {
    id: '1',
    products: [
      { productId: '1', productName: 'Gaming Laptop RTX 4060', quantity: 1, sellPrice: 1200, total: 1200 }
    ],
    totalAmount: 1200,
    cashierName: 'Store Cashier',
    date: new Date()
  },
  {
    id: '2',
    products: [
      { productId: '2', productName: 'Wireless Gaming Mouse', quantity: 2, sellPrice: 45, total: 90 },
      { productId: '3', productName: 'Mechanical Keyboard RGB', quantity: 1, sellPrice: 95, total: 95 }
    ],
    totalAmount: 185,
    cashierName: 'Store Cashier',
    date: new Date(Date.now() - 24 * 60 * 60 * 1000) // Yesterday
  }
];

export const StoreProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [products, setProducts] = useState<Product[]>(mockProducts);
  const [sales, setSales] = useState<Sale[]>(mockSales);

  const addProduct = (productData: Omit<Product, 'id' | 'createdAt' | 'updatedAt'>) => {
    const newProduct: Product = {
      ...productData,
      id: Date.now().toString(),
      createdAt: new Date(),
      updatedAt: new Date()
    };
    setProducts(prev => [...prev, newProduct]);
  };

  const updateProduct = (id: string, productData: Partial<Product>) => {
    setProducts(prev => prev.map(product => 
      product.id === id 
        ? { ...product, ...productData, updatedAt: new Date() }
        : product
    ));
  };

  const deleteProduct = (id: string) => {
    setProducts(prev => prev.filter(product => product.id !== id));
  };

  const addSale = (saleData: Omit<Sale, 'id' | 'date'>) => {
    const newSale: Sale = {
      ...saleData,
      id: Date.now().toString(),
      date: new Date()
    };
    
    // Update product quantities
    saleData.products.forEach(saleProduct => {
      updateProduct(saleProduct.productId, {
        quantity: products.find(p => p.id === saleProduct.productId)!.quantity - saleProduct.quantity
      });
    });
    
    setSales(prev => [newSale, ...prev]);
  };

  const getLowStockProducts = () => {
    return products.filter(product => product.quantity <= 5);
  };

  const getTodaysSales = () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    return sales
      .filter(sale => sale.date >= today)
      .reduce((total, sale) => total + sale.totalAmount, 0);
  };

  const getMonthlyStats = () => {
    const thisMonth = new Date();
    thisMonth.setDate(1);
    thisMonth.setHours(0, 0, 0, 0);
    
    const monthlySales = sales.filter(sale => sale.date >= thisMonth);
    const totalSales = monthlySales.reduce((total, sale) => total + sale.totalAmount, 0);
    
    // Calculate profit
    const totalProfit = monthlySales.reduce((profit, sale) => {
      const saleProfit = sale.products.reduce((sp, product) => {
        const originalProduct = products.find(p => p.id === product.productId);
        if (originalProduct) {
          return sp + ((product.sellPrice - originalProduct.buyPrice) * product.quantity);
        }
        return sp;
      }, 0);
      return profit + saleProfit;
    }, 0);
    
    return { sales: totalSales, profit: totalProfit };
  };

  const getCategoryDistribution = () => {
    const categoryMap = new Map<string, { value: number; count: number }>();
    
    products.forEach(product => {
      const current = categoryMap.get(product.category) || { value: 0, count: 0 };
      categoryMap.set(product.category, {
        value: current.value + (product.sellPrice * product.quantity),
        count: current.count + product.quantity
      });
    });
    
    return Array.from(categoryMap.entries()).map(([name, data]) => ({
      name,
      value: data.value,
      count: data.count
    }));
  };

  const getMonthlySalesData = () => {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const currentMonth = new Date().getMonth();
    
    return months.slice(0, currentMonth + 1).map((month, index) => {
      const monthSales = sales.filter(sale => sale.date.getMonth() === index);
      const totalSales = monthSales.reduce((total, sale) => total + sale.totalAmount, 0);
      const totalProfit = monthSales.reduce((profit, sale) => {
        const saleProfit = sale.products.reduce((sp, product) => {
          const originalProduct = products.find(p => p.id === product.productId);
          if (originalProduct) {
            return sp + ((product.sellPrice - originalProduct.buyPrice) * product.quantity);
          }
          return sp;
        }, 0);
        return profit + saleProfit;
      }, 0);
      
      return { month, sales: totalSales, profit: totalProfit };
    });
  };

  return (
    <StoreContext.Provider value={{
      products,
      sales,
      addProduct,
      updateProduct,
      deleteProduct,
      addSale,
      getLowStockProducts,
      getTodaysSales,
      getMonthlyStats,
      getCategoryDistribution,
      getMonthlySalesData
    }}>
      {children}
    </StoreContext.Provider>
  );
};
