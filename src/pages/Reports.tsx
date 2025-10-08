import React, { useState, useEffect } from "react";
import { useStore, calculateActualProfit } from "@/contexts/StoreContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  Area,
  AreaChart,
  Legend,
} from "recharts";
import {
  FileText,
  Download,
  Calendar as CalendarIcon,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Package,
  Users,
  Filter,
  RefreshCw,
  Eye,
  BarChart3,
  AlertCircle,
} from "lucide-react";
import { format, subDays, startOfMonth, endOfMonth, subMonths } from "date-fns";
import { Alert, AlertDescription } from "@/components/ui/alert";

const Reports = () => {
  const { products, sales, dashboardData, refreshData } = useStore();
  const { t } = useLanguage();

  // State for date range filters
  const [startDate, setStartDate] = useState<Date>(subDays(new Date(), 30));
  const [endDate, setEndDate] = useState<Date>(new Date());
  const [selectedPeriod, setSelectedPeriod] = useState("30days");
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Filter sales by date range
  const filteredSales = sales.filter((sale) => {
    const saleDate = new Date(sale.date);
    return saleDate >= startDate && saleDate <= endDate;
  });

  // Calculate metrics
  const totalRevenue = filteredSales.reduce(
    (sum, sale) => sum + sale.totalAmount,
    0
  );
  const totalSales = filteredSales.length;
  const averageSaleValue = totalSales > 0 ? totalRevenue / totalSales : 0;

  const totalProfit = filteredSales.reduce((profit, sale) => {
    // First, try to use the sale's calculated totalProfit (from backend FIFO calculation)
    if (sale.totalProfit !== undefined && sale.totalProfit !== null) {
      return profit + (Number(sale.totalProfit) || 0);
    }

    // Fallback to product-level profit calculation if sale-level profit is not available
    return (
      profit +
      sale.products.reduce((saleProfit, item) => {
        // Check if the item has pre-calculated totalProfit from FIFO
        if (item.totalProfit !== undefined && item.totalProfit !== null) {
          return saleProfit + (Number(item.totalProfit) || 0);
        }

        // Last resort: calculate using current product data (less accurate)
        const product = products.find((p) => p.id === item.productId);
        const actualProfit = calculateActualProfit(item, product);
        return saleProfit + (Number(actualProfit) || 0);
      }, 0)
    );
  }, 0);

  const profitMargin =
    totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0;

  // Handle period selection
  const handlePeriodChange = (period: string) => {
    setSelectedPeriod(period);
    const now = new Date();

    switch (period) {
      case "today":
        setStartDate(
          new Date(now.getFullYear(), now.getMonth(), now.getDate())
        );
        setEndDate(now);
        break;
      case "yesterday":
        const yesterday = subDays(now, 1);
        setStartDate(
          new Date(
            yesterday.getFullYear(),
            yesterday.getMonth(),
            yesterday.getDate()
          )
        );
        setEndDate(
          new Date(
            yesterday.getFullYear(),
            yesterday.getMonth(),
            yesterday.getDate(),
            23,
            59,
            59
          )
        );
        break;
      case "7days":
        setStartDate(subDays(now, 7));
        setEndDate(now);
        break;
      case "30days":
        setStartDate(subDays(now, 30));
        setEndDate(now);
        break;
      case "thisMonth":
        setStartDate(startOfMonth(now));
        setEndDate(endOfMonth(now));
        break;
      case "lastMonth":
        const lastMonth = subMonths(now, 1);
        setStartDate(startOfMonth(lastMonth));
        setEndDate(endOfMonth(lastMonth));
        break;
      case "90days":
        setStartDate(subDays(now, 90));
        setEndDate(now);
        break;
      case "365days":
        setStartDate(subDays(now, 365));
        setEndDate(now);
        break;
    }
  };

  // Sales by day data
  const salesByDay = () => {
    const dayMap = new Map();

    filteredSales.forEach((sale) => {
      const day = format(new Date(sale.date), "MMM dd");
      const existing = dayMap.get(day) || {
        day,
        revenue: 0,
        sales: 0,
        profit: 0,
      };

      const saleProfit =
        sale.totalProfit !== undefined && sale.totalProfit !== null
          ? Number(sale.totalProfit) || 0
          : sale.products.reduce((profit, item) => {
              if (item.totalProfit !== undefined && item.totalProfit !== null) {
                return profit + (Number(item.totalProfit) || 0);
              }
              const product = products.find((p) => p.id === item.productId);
              const actualProfit = calculateActualProfit(item, product);
              return profit + (Number(actualProfit) || 0);
            }, 0);

      dayMap.set(day, {
        day,
        revenue: existing.revenue + sale.totalAmount,
        sales: existing.sales + 1,
        profit: existing.profit + saleProfit,
      });
    });

    return Array.from(dayMap.values()).sort(
      (a, b) => new Date(a.day).getTime() - new Date(b.day).getTime()
    );
  };

  // Top selling products
  const topSellingProducts = () => {
    const productMap = new Map();

    filteredSales.forEach((sale) => {
      sale.products.forEach((item) => {
        const existing = productMap.get(item.productId) || {
          productName: item.productName,
          quantity: 0,
          revenue: 0,
          profit: 0,
        };

        // Use pre-calculated profit if available, otherwise calculate
        let profit;
        if (item.totalProfit !== undefined && item.totalProfit !== null) {
          profit = Number(item.totalProfit) || 0;
        } else {
          const product = products.find((p) => p.id === item.productId);
          profit = calculateActualProfit(item, product);
        }

        // Calculate revenue from the sale transaction - use correct field name
        let itemRevenue = 0;
        if (item.totalPrice && Number(item.totalPrice) > 0) {
          // Use totalPrice from the FIFO system (correct field)
          itemRevenue = Number(item.totalPrice);
        } else if (item.total && Number(item.total) > 0) {
          // Fallback to total if available
          itemRevenue = Number(item.total);
        } else if (item.sellPrice && item.quantity) {
          // Last resort: calculate from sellPrice * quantity
          itemRevenue = Number(item.sellPrice) * Number(item.quantity);
        }

        // Debug logging for first few items
        if (productMap.size < 3) {
          console.log("Revenue calculation debug:", {
            productName: item.productName,
            totalPrice: item.totalPrice,
            total: item.total,
            sellPrice: item.sellPrice,
            quantity: item.quantity,
            calculatedRevenue: itemRevenue
          });
        }

        productMap.set(item.productId, {
          productName: item.productName,
          quantity: existing.quantity + item.quantity,
          revenue: existing.revenue + itemRevenue,
          profit: existing.profit + (Number(profit) || 0),
        });
      });
    });

    return Array.from(productMap.values())
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 10);
  };

  // FIXED: Sales by category function with proper debugging and data handling
  const salesByCategory = () => {
    console.log("=== Reports: salesByCategory Debug ===");
    console.log("Dashboard data available:", !!dashboardData);
    console.log(
      "Dashboard categoryDistribution:",
      dashboardData?.categoryDistribution
    );
    console.log("Filtered sales count:", filteredSales.length);
    console.log("Products count:", products.length);

    // Try dashboard data first, but with proper validation
    if (
      dashboardData?.categoryDistribution &&
      Array.isArray(dashboardData.categoryDistribution) &&
      dashboardData.categoryDistribution.length > 0
    ) {
      console.log("✅ Using dashboard API data for categories");
      const dashboardCategories = dashboardData.categoryDistribution
        .map((cat) => ({
          category: cat._id || cat.name || "Unknown",
          revenue: Number(cat.totalRevenue) || 0,
          quantity: Number(cat.totalQuantity) || 0,
          sales: Number(cat.totalSales) || 0,
          profit: Number(cat.totalProfit) || 0, // Add profit if available
        }))
        .filter((cat) => cat.revenue > 0 || cat.quantity > 0); // Filter out empty categories

      console.log("Dashboard categories processed:", dashboardCategories);
      if (dashboardCategories.length > 0) {
        return dashboardCategories;
      }
    }

    console.log("📊 Fallback to manual calculation from sales data");

    // Safety checks
    if (!Array.isArray(filteredSales) || filteredSales.length === 0) {
      console.log("❌ No filtered sales available");
      return [];
    }

    if (!Array.isArray(products) || products.length === 0) {
      console.log("❌ No products available for category mapping");
      return [];
    }

    const categoryMap = new Map();

    filteredSales.forEach((sale, saleIndex) => {
      if (!sale.products || !Array.isArray(sale.products)) {
        console.log(`⚠️ Sale ${saleIndex} has no products array`);
        return;
      }

      sale.products.forEach((item, itemIndex) => {
        // Find the product to get category
        const product = products.find(
          (p) => p.id === item.productId || p._id === item.productId
        );

        if (!product) {
          if (saleIndex < 3 && itemIndex < 2) {
            // Only log first few to avoid spam
            console.log(`⚠️ Product not found for sale item:`, {
              saleIndex,
              itemIndex,
              productId: item.productId,
              productName: item.productName,
            });
          }
          return;
        }

        if (!product.category) {
          console.log(`⚠️ Product ${product.name} has no category`);
          return;
        }

        const category = product.category.trim();
        const existing = categoryMap.get(category) || {
          category,
          revenue: 0,
          quantity: 0,
          profit: 0,
          sales: 0,
        };

        // Calculate profit for this item
        let itemProfit = 0;
        if (item.totalProfit !== undefined && item.totalProfit !== null) {
          itemProfit = Number(item.totalProfit) || 0;
        } else {
          itemProfit = calculateActualProfit(item, product);
        }

        const itemRevenue =
          Number(item.totalPrice) ||
          Number(item.total) ||
          (Number(item.sellPrice) * Number(item.quantity)) ||
          0;
        const itemQuantity = Number(item.quantity) || 0;

        categoryMap.set(category, {
          category,
          revenue: existing.revenue + itemRevenue,
          quantity: existing.quantity + itemQuantity,
          profit: existing.profit + itemProfit,
          sales: existing.sales + 1, // Count number of sale items
        });

        // Log first few successful additions
        if (categoryMap.size <= 3) {
          console.log(`✅ Added to category '${category}':`, {
            itemRevenue,
            itemQuantity,
            itemProfit,
            newTotals: categoryMap.get(category),
          });
        }
      });
    });

    const result = Array.from(categoryMap.values()).filter(
      (cat) => cat.revenue > 0 || cat.quantity > 0
    );

    console.log(`📈 Manual calculation result: ${result.length} categories`);
    console.log(
      "Categories found:",
      result.map((c) => ({
        name: c.category,
        revenue: c.revenue,
        quantity: c.quantity,
      }))
    );

    // Sort by revenue descending
    return result.sort((a, b) => b.revenue - a.revenue);
  };

  // Low stock report
  const lowStockProducts = products.filter(
    (p) => p.quantity <= p.lowStockThreshold
  );

  // Inventory value by category
  const inventoryByCategory = () => {
    console.log("=== inventoryByCategory Debug ===");
    console.log("Products for inventory:", products.length);

    const categoryMap = new Map();

    products.forEach((product) => {
      if (!product || !product.category) {
        console.log("⚠️ Product missing category:", product?.name);
        return;
      }

      const quantity = Number(product.quantity) || 0;
      if (quantity <= 0) {
        return; // Skip products with no stock
      }

      const sellPrice =
        Number(product.currentSellPrice || product.sellPrice) || 0;
      const category = product.category.trim();

      const existing = categoryMap.get(category) || {
        category,
        value: 0,
        quantity: 0,
        products: 0,
      };

      categoryMap.set(category, {
        category,
        value: existing.value + sellPrice * quantity,
        quantity: existing.quantity + quantity,
        products: existing.products + 1,
      });
    });

    const result = Array.from(categoryMap.values()).filter(
      (cat) => cat.quantity > 0
    );
    console.log("Inventory categories:", result);
    return result;
  };

  // Colors for charts
  const COLORS = [
    "#3B82F6",
    "#10B981",
    "#F59E0B",
    "#EF4444",
    "#8B5CF6",
    "#06B6D4",
    "#84CC16",
    "#F97316",
  ];

  // Export functions
  const exportSalesReport = () => {
    const csvContent =
      "data:text/csv;charset=utf-8," +
      [
        "Date,Receipt Number,Customer,Cashier,Total Amount,Payment Method",
        ...filteredSales.map((sale) =>
          [
            format(new Date(sale.date), "yyyy-MM-dd HH:mm:ss"),
            sale.receiptNumber,
            "Walk-in Customer",
            sale.cashierName,
            sale.totalAmount.toFixed(2),
            sale.paymentMethod,
          ].join(",")
        ),
      ].join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute(
      "download",
      `sales_report_${format(startDate, "yyyy-MM-dd")}_to_${format(
        endDate,
        "yyyy-MM-dd"
      )}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const exportProductReport = () => {
    const csvContent =
      "data:text/csv;charset=utf-8," +
      [
        "Product Name,Category,Buy Price,Sell Price,Quantity,Low Stock Threshold,Inventory Value",
        ...products.map((product) =>
          [
            product.name,
            product.category,
            product.buyPrice.toFixed(2),
            product.sellPrice.toFixed(2),
            product.quantity,
            product.lowStockThreshold,
            (product.sellPrice * product.quantity).toFixed(2),
          ].join(",")
        ),
      ].join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute(
      "download",
      `inventory_report_${format(new Date(), "yyyy-MM-dd")}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await refreshData();
    } finally {
      setIsRefreshing(false);
    }
  };

  // Get category data for the pie chart - prioritize backend data
  const getCategoryData = () => {
    // First try to use backend categoryDistribution data
    if (dashboardData?.categoryDistribution && dashboardData.categoryDistribution.length > 0) {
      console.log("✅ Using backend categoryDistribution data:", dashboardData.categoryDistribution);
      return dashboardData.categoryDistribution.map(item => ({
        category: item._id,
        revenue: item.totalRevenue || 0,
        quantity: item.totalQuantity || 0,
        sales: item.totalSales || 0,
        profit: 0 // Backend doesn't provide profit per category yet
      }));
    }

    // Fallback to manual calculation
    console.log("⚠️ Falling back to manual category calculation");
    return salesByCategory();
  };

  const categoryData = getCategoryData();
  const hasValidCategoryData =
    categoryData &&
    categoryData.length > 0 &&
    categoryData.some((cat) =>
      (cat.revenue || 0) > 0 ||
      (cat.quantity || 0) > 0 ||
      (cat.sales || 0) > 0
    );

  // Debug logging
  console.log("=== CATEGORY DATA DEBUG ===");
  console.log("categoryData:", categoryData);
  console.log("hasValidCategoryData:", hasValidCategoryData);
  console.log("dashboardData available:", !!dashboardData);
  console.log("dashboardData.categoryDistribution:", dashboardData?.categoryDistribution);

  // Custom tooltip for category pie chart
  const CategoryTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-white p-3 border rounded-lg shadow-lg">
          <p className="font-semibold text-gray-900">{data.category}</p>
          <p className="text-sm text-green-600">
            Revenue: ${data.revenue?.toLocaleString() || 0}
          </p>
          <p className="text-sm text-blue-600">
            Quantity: {data.quantity || 0}
          </p>
          {data.profit && (
            <p className="text-sm text-purple-600">
              Profit: ${data.profit?.toLocaleString() || 0}
            </p>
          )}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">{t("reports")}</h1>
          <p className="text-gray-600">{t("reports_overview")}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="flex items-center gap-2"
          >
            <RefreshCw
              className={`w-4 h-4 ${isRefreshing ? "animate-spin" : ""}`}
            />
            {t("refresh")}
          </Button>
          <Button
            variant="outline"
            onClick={exportSalesReport}
            className="flex items-center gap-2"
          >
            <Download className="w-4 h-4" />
            {t("export_sales")}
          </Button>
        </div>
      </div>

      {/* Date Range Filter */}
      <Card>
        <CardContent className="p-6">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-gray-500" />
              <span className="font-medium">{t("time_period")}</span>
            </div>

            <div className="flex flex-wrap gap-2">
              {[
                { label: t("today"), value: "today" },
                { label: t("yesterday"), value: "yesterday" },
                { label: t("last_7_days"), value: "7days" },
                { label: t("last_30_days"), value: "30days" },
                { label: t("this_month"), value: "thisMonth" },
                { label: t("last_month"), value: "lastMonth" },
                { label: t("last_90_days"), value: "90days" },
                { label: t("last_year"), value: "365days" },
              ].map((period) => (
                <Button
                  key={period.value}
                  variant={
                    selectedPeriod === period.value ? "default" : "outline"
                  }
                  size="sm"
                  onClick={() => handlePeriodChange(period.value)}
                >
                  {period.label}
                </Button>
              ))}
            </div>

            <div className="flex items-center gap-2 ml-auto">
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="flex items-center gap-2">
                    <CalendarIcon className="w-4 h-4" />
                    {format(startDate, "MMM dd")} - {format(endDate, "MMM dd")}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="end">
                  <div className="flex">
                    <div className="p-3">
                      <div className="text-sm font-medium mb-2">
                        {t("start_date")}
                      </div>
                      <Calendar
                        mode="single"
                        selected={startDate}
                        onSelect={(date) => date && setStartDate(date)}
                      />
                    </div>
                    <div className="p-3 border-l">
                      <div className="text-sm font-medium mb-2">
                        {t("end_date")}
                      </div>
                      <Calendar
                        mode="single"
                        selected={endDate}
                        onSelect={(date) => date && setEndDate(date)}
                      />
                    </div>
                  </div>
                </PopoverContent>
              </Popover>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">
                  {t("total_revenue")}
                </p>
                <p className="text-2xl font-bold text-green-600">
                  ${totalRevenue.toFixed(2)}
                </p>
              </div>
              <div className="p-3 bg-green-100 rounded-full">
                <DollarSign className="w-6 h-6 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">
                  {t("total_sales")}
                </p>
                <p className="text-2xl font-bold text-blue-600">{totalSales}</p>
              </div>
              <div className="p-3 bg-blue-100 rounded-full">
                <BarChart3 className="w-6 h-6 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">
                  {t("total_profit_display")}
                </p>
                <p className="text-2xl font-bold text-purple-600">
                  ${totalProfit.toFixed(2)}
                </p>
              </div>
              <div className="p-3 bg-purple-100 rounded-full">
                <TrendingUp className="w-6 h-6 text-purple-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">
                  {t("avg_sale_value")}
                </p>
                <p className="text-2xl font-bold text-orange-600">
                  ${averageSaleValue.toFixed(2)}
                </p>
              </div>
              <div className="p-3 bg-orange-100 rounded-full">
                <Users className="w-6 h-6 text-orange-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs for different reports */}
      <Tabs defaultValue="sales" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="sales">{t("sales_analytics")}</TabsTrigger>
          <TabsTrigger value="products">{t("product_reports")}</TabsTrigger>
          <TabsTrigger value="inventory">{t("inventory_status")}</TabsTrigger>
          <TabsTrigger value="financial">{t("financial_summary")}</TabsTrigger>
        </TabsList>

        {/* Sales Analytics Tab */}
        <TabsContent value="sales" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Sales Trend */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="w-5 h-5" />
                  {t("sales_trend")}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <AreaChart data={salesByDay()}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="day" />
                    <YAxis />
                    <Tooltip
                      formatter={(value, name) => [
                        name === "revenue" ? `$${value}` : value,
                        name === "revenue" ? t("revenue") : t("sales_count"),
                      ]}
                    />
                    <Area
                      type="monotone"
                      dataKey="revenue"
                      stroke="#3B82F6"
                      fill="#3B82F6"
                      fillOpacity={0.1}
                    />
                    <Area
                      type="monotone"
                      dataKey="sales"
                      stroke="#10B981"
                      fill="#10B981"
                      fillOpacity={0.1}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* FIXED: Sales by Category with proper debugging */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>{t("sales_by_category")}</span>
                  <span className="text-sm text-gray-500 font-normal">
                    ({categoryData.length} categories)
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {hasValidCategoryData ? (
                  <>
                    <ResponsiveContainer width="100%" height={300}>
                      <PieChart>
                        <Pie
                          data={categoryData}
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={120}
                          dataKey="quantity"
                          nameKey="category"
                          label={({ category, percent }) =>
                            percent > 0.05
                              ? `${category} ${(percent * 100).toFixed(0)}%`
                              : ""
                          }
                        >
                          {categoryData.map((entry, index) => (
                            <Cell
                              key={`cell-${index}`}
                              fill={COLORS[index % COLORS.length]}
                            />
                          ))}
                        </Pie>
                        <Tooltip content={<CategoryTooltip />} />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>

                    {/* Category summary */}
                    <div className="mt-4 space-y-2">
                      <h4 className="font-medium text-gray-700 text-sm">
                        Top Categories:
                      </h4>
                      {categoryData.slice(0, 3).map((category, index) => (
                        <div
                          key={category.category}
                          className="flex items-center justify-between text-sm"
                        >
                          <div className="flex items-center gap-2">
                            <div
                              className="w-3 h-3 rounded-full"
                              style={{
                                backgroundColor: COLORS[index % COLORS.length],
                              }}
                            ></div>
                            <span className="font-medium">
                              {category.category}
                            </span>
                          </div>
                          <div className="text-right">
                            <span className="text-green-600">
                              ${category.revenue.toLocaleString()}
                            </span>
                            <br />
                            <span className="text-xs text-gray-500">
                              {category.quantity} items
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                ) : (
                  <div className="flex flex-col items-center justify-center h-[300px] text-gray-500">
                    <Package className="w-16 h-16 mb-4 text-gray-300" />
                    <h3 className="text-lg font-medium text-gray-700 mb-2">
                      No Category Sales Data
                    </h3>

                    {filteredSales.length === 0 ? (
                      <div className="text-center space-y-2">
                        <p className="text-sm">
                          No sales found for the selected time period.
                        </p>
                        <p className="text-xs text-blue-600">
                          Try selecting a different date range or make some
                          sales.
                        </p>
                      </div>
                    ) : (
                      <div className="text-center space-y-2">
                        <p className="text-sm">
                          Found {filteredSales.length} sales, but no category
                          data is available.
                        </p>
                        <p className="text-xs text-blue-600">
                          Make sure your products have categories assigned.
                        </p>

                        {/* Debug info for development */}
                        {process.env.NODE_ENV === "development" && (
                          <details className="mt-4 text-left">
                            <summary className="cursor-pointer text-xs text-gray-400 hover:text-gray-600">
                              Debug Info (click to expand)
                            </summary>
                            <div className="mt-2 p-2 bg-gray-50 rounded text-xs font-mono">
                              <p>Filtered sales: {filteredSales.length}</p>
                              <p>Products: {products.length}</p>
                              <p>
                                Products with categories:{" "}
                                {products.filter((p) => p.category).length}
                              </p>
                              <p>Category data length: {categoryData.length}</p>
                              <p>
                                Dashboard data available:{" "}
                                {dashboardData ? "Yes" : "No"}
                              </p>
                              {categoryData.length > 0 && (
                                <p>
                                  Sample category:{" "}
                                  {JSON.stringify(categoryData[0], null, 2)}
                                </p>
                              )}
                            </div>
                          </details>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Top Selling Products */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Package className="w-5 h-5" />
                {t("top_selling_products")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={400}>
                <BarChart data={topSellingProducts()}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis
                    dataKey="productName"
                    angle={-45}
                    textAnchor="end"
                    height={100}
                  />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="quantity" fill="#3B82F6" />
                  <Bar dataKey="revenue" fill="#10B981" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Product Reports Tab */}
        <TabsContent value="products" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Top Selling Products Table */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>{t("top_products_by_revenue")}</CardTitle>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={exportProductReport}
                >
                  <Download className="w-4 h-4 mr-2" />
                  {t("export_products")}
                </Button>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {topSellingProducts()
                    .slice(0, 5)
                    .map((product, index) => (
                      <div
                        key={index}
                        className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                      >
                        <div>
                          <p className="font-medium">{product.productName}</p>
                          <p className="text-sm text-gray-600">
                            {t("sold_units").replace(
                              "{count}",
                              String(product.quantity)
                            )}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-green-600">
                            ${product.revenue.toFixed(2)}
                          </p>
                          <p className="text-sm text-gray-600">
                            {t("profit")}: ${product.profit.toFixed(2)}
                          </p>
                        </div>
                      </div>
                    ))}
                </div>
              </CardContent>
            </Card>

            {/* Category Performance */}
            <Card>
              <CardHeader>
                <CardTitle>{t("category_performance")}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {categoryData.length > 0 ? (
                    categoryData.map((category, index) => (
                      <div key={index} className="p-3 border rounded-lg">
                        <div className="flex justify-between items-center mb-2">
                          <span className="font-medium">
                            {category.category}
                          </span>
                          <Badge variant="secondary">
                            {t("sold_units").replace(
                              "{count}",
                              String(category.quantity || 0)
                            )}
                          </Badge>
                        </div>
                        <div className="flex justify-between text-sm text-gray-600">
                          <span>
                            {t("revenue")}: $
                            {(category.revenue || 0).toFixed(2)}
                          </span>
                          <span>
                            {t("profit")}: ${(category.profit || 0).toFixed(2)}
                          </span>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-8 text-gray-500">
                      <p>No category performance data available</p>
                      <p className="text-sm">
                        Make sales to see category performance
                      </p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Inventory Status Tab */}
        <TabsContent value="inventory" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Low Stock Alert */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-orange-600">
                  <Package className="w-5 h-5" />
                  {t("low_stock_alert")} ({lowStockProducts.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                {lowStockProducts.length > 0 ? (
                  <div className="space-y-3 max-h-80 overflow-y-auto">
                    {lowStockProducts.map((product) => (
                      <div
                        key={product.id}
                        className="flex justify-between items-center p-3 bg-orange-50 rounded-lg border border-orange-200"
                      >
                        <div>
                          <p className="font-medium text-gray-900">
                            {product.name}
                          </p>
                          <p className="text-sm text-gray-600">
                            {product.category}
                          </p>
                        </div>
                        <div className="text-right">
                          <Badge
                            variant="outline"
                            className="text-orange-700 border-orange-300"
                          >
                            {product.quantity} {t("left")}
                          </Badge>
                          <p className="text-xs text-gray-500 mt-1">
                            {t("alert_at")} {product.lowStockThreshold}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-500 text-center py-8">
                    {t("no_low_stock_items")}
                  </p>
                )}
              </CardContent>
            </Card>

            {/* Inventory Value by Category */}
            <Card>
              <CardHeader>
                <CardTitle>{t("inventory_value_by_category")}</CardTitle>
              </CardHeader>
              <CardContent>
                {inventoryByCategory().length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={inventoryByCategory()}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={120}
                        dataKey="value"
                        nameKey="category"
                        label={({ category, percent }) =>
                          percent > 0.05
                            ? `${category} ${(percent * 100).toFixed(0)}%`
                            : ""
                        }
                      >
                        {inventoryByCategory().map((entry, index) => (
                          <Cell
                            key={`cell-${index}`}
                            fill={COLORS[index % COLORS.length]}
                          />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(value) => [
                          `${value}`,
                          t("inventory_value"),
                        ]}
                      />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-[300px] text-gray-500">
                    <div className="text-center">
                      <Package className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                      <p className="font-medium">No Inventory Data</p>
                      <p className="text-sm">
                        Add products with stock to see inventory value by
                        category
                      </p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Inventory Summary Table */}
          <Card>
            <CardHeader>
              <CardTitle>{t("inventory_summary")}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                {inventoryByCategory().length > 0 ? (
                  <table className="w-full">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left p-3">{t("category")}</th>
                        <th className="text-right p-3">{t("products")}</th>
                        <th className="text-right p-3">
                          {t("total_quantity")}
                        </th>
                        <th className="text-right p-3">
                          {t("inventory_value")}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {inventoryByCategory().map((category, index) => (
                        <tr key={index} className="border-b hover:bg-gray-50">
                          <td className="p-3 font-medium">
                            {category.category}
                          </td>
                          <td className="p-3 text-right">
                            {category.products}
                          </td>
                          <td className="p-3 text-right">
                            {category.quantity}
                          </td>
                          <td className="p-3 text-right font-medium text-green-600">
                            ${category.value.toFixed(2)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    <p>No inventory data available</p>
                    <p className="text-sm">
                      Add products with stock to see summary
                    </p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Financial Summary Tab */}
        <TabsContent value="financial" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card>
              <CardContent className="p-6 text-center">
                <div className="text-3xl font-bold text-green-600 mb-2">
                  ${totalRevenue.toFixed(2)}
                </div>
                <p className="text-gray-600">{t("total_revenue")}</p>
                <div className="mt-2 text-sm text-gray-500">
                  {format(startDate, "MMM dd")} - {format(endDate, "MMM dd")}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6 text-center">
                <div className="text-3xl font-bold text-purple-600 mb-2">
                  ${totalProfit.toFixed(2)}
                </div>
                <p className="text-gray-600">{t("total_profit_display")}</p>
                <div className="mt-2 text-sm text-gray-500">
                  {profitMargin.toFixed(1)}% {t("profit_margin")}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6 text-center">
                <div className="text-3xl font-bold text-blue-600 mb-2">
                  ${averageSaleValue.toFixed(2)}
                </div>
                <p className="text-gray-600">{t("avg_sale_value")}</p>
                <div className="mt-2 text-sm text-gray-500">
                  {t("from_transactions").replace(
                    "{count}",
                    String(totalSales)
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Profit Trend Chart */}
          <Card>
            <CardHeader>
              <CardTitle>{t("profit_trend_analysis")}</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={400}>
                <LineChart data={salesByDay()}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="day" />
                  <YAxis />
                  <Tooltip />
                  <Line
                    type="monotone"
                    dataKey="profit"
                    stroke="#8B5CF6"
                    strokeWidth={3}
                    dot={{ fill: "#8B5CF6", strokeWidth: 2, r: 4 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="revenue"
                    stroke="#10B981"
                    strokeWidth={2}
                    dot={{ fill: "#10B981", strokeWidth: 2, r: 3 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Reports;
