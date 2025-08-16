import React, { useState, useEffect } from "react";
import { useStore } from "@/contexts/StoreContext";
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
} from "lucide-react";
import { format, subDays, startOfMonth, endOfMonth, subMonths } from "date-fns";

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
    return (
      profit +
      sale.products.reduce((saleProfit, item) => {
        const product = products.find((p) => p.id === item.productId);
        if (product) {
          return (
            saleProfit + (item.sellPrice - product.buyPrice) * item.quantity
          );
        }
        return saleProfit;
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

      const saleProfit = sale.products.reduce((profit, item) => {
        const product = products.find((p) => p.id === item.productId);
        return (
          profit +
          (product ? (item.sellPrice - product.buyPrice) * item.quantity : 0)
        );
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

        const product = products.find((p) => p.id === item.productId);
        const profit = product
          ? (item.sellPrice - product.buyPrice) * item.quantity
          : 0;

        productMap.set(item.productId, {
          productName: item.productName,
          quantity: existing.quantity + item.quantity,
          revenue: existing.revenue + item.total,
          profit: existing.profit + profit,
        });
      });
    });

    return Array.from(productMap.values())
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 10);
  };

  // Sales by category
  const salesByCategory = () => {
    const categoryMap = new Map();

    filteredSales.forEach((sale) => {
      sale.products.forEach((item) => {
        const product = products.find((p) => p.id === item.productId);
        if (product) {
          const existing = categoryMap.get(product.category) || {
            category: product.category,
            revenue: 0,
            quantity: 0,
            profit: 0,
          };

          const profit = (item.sellPrice - product.buyPrice) * item.quantity;

          categoryMap.set(product.category, {
            category: product.category,
            revenue: existing.revenue + item.total,
            quantity: existing.quantity + item.quantity,
            profit: existing.profit + profit,
          });
        }
      });
    });

    return Array.from(categoryMap.values());
  };

  // Low stock report
  const lowStockProducts = products.filter(
    (p) => p.quantity <= p.lowStockThreshold
  );

  // Inventory value by category
  const inventoryByCategory = () => {
    const categoryMap = new Map();

    products.forEach((product) => {
      if (product.quantity > 0) {
        const existing = categoryMap.get(product.category) || {
          category: product.category,
          value: 0,
          quantity: 0,
          products: 0,
        };

        categoryMap.set(product.category, {
          category: product.category,
          value: existing.value + product.sellPrice * product.quantity,
          quantity: existing.quantity + product.quantity,
          products: existing.products + 1,
        });
      }
    });

    return Array.from(categoryMap.values());
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">{t("reports")}</h1>
          <p className="text-gray-600">
            Comprehensive analytics and insights for your store
          </p>
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
            Refresh
          </Button>
          <Button
            variant="outline"
            onClick={exportSalesReport}
            className="flex items-center gap-2"
          >
            <Download className="w-4 h-4" />
            Export Sales
          </Button>
        </div>
      </div>

      {/* Date Range Filter */}
      <Card>
        <CardContent className="p-6">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-gray-500" />
              <span className="font-medium">Time Period:</span>
            </div>

            <div className="flex flex-wrap gap-2">
              {[
                { label: "Today", value: "today" },
                { label: "Yesterday", value: "yesterday" },
                { label: "Last 7 days", value: "7days" },
                { label: "Last 30 days", value: "30days" },
                { label: "This Month", value: "thisMonth" },
                { label: "Last Month", value: "lastMonth" },
                { label: "Last 90 days", value: "90days" },
                { label: "Last Year", value: "365days" },
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
                      <div className="text-sm font-medium mb-2">Start Date</div>
                      <Calendar
                        mode="single"
                        selected={startDate}
                        onSelect={(date) => date && setStartDate(date)}
                      />
                    </div>
                    <div className="p-3 border-l">
                      <div className="text-sm font-medium mb-2">End Date</div>
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
                  Total Revenue
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
                <p className="text-sm font-medium text-gray-600">Total Sales</p>
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
                  Total Profit
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
                  Avg. Sale Value
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
          <TabsTrigger value="sales">Sales Analytics</TabsTrigger>
          <TabsTrigger value="products">Product Reports</TabsTrigger>
          <TabsTrigger value="inventory">Inventory Status</TabsTrigger>
          <TabsTrigger value="financial">Financial Summary</TabsTrigger>
        </TabsList>

        {/* Sales Analytics Tab */}
        <TabsContent value="sales" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Sales Trend */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="w-5 h-5" />
                  Sales Trend
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
                        name === "revenue" ? "Revenue" : "Sales Count",
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

            {/* Sales by Category */}
            <Card>
              <CardHeader>
                <CardTitle>Sales by Category</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={salesByCategory()}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={120}
                      dataKey="revenue"
                      nameKey="category"
                    >
                      {salesByCategory().map((entry, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={COLORS[index % COLORS.length]}
                        />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value) => [`$${value}`, "Revenue"]} />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          {/* Top Selling Products */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Package className="w-5 h-5" />
                Top Selling Products
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
                <CardTitle>Top Products by Revenue</CardTitle>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={exportProductReport}
                >
                  <Download className="w-4 h-4 mr-2" />
                  Export
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
                            Sold: {product.quantity} units
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-green-600">
                            ${product.revenue.toFixed(2)}
                          </p>
                          <p className="text-sm text-gray-600">
                            Profit: ${product.profit.toFixed(2)}
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
                <CardTitle>Category Performance</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {salesByCategory().map((category, index) => (
                    <div key={index} className="p-3 border rounded-lg">
                      <div className="flex justify-between items-center mb-2">
                        <span className="font-medium">{category.category}</span>
                        <Badge variant="secondary">
                          {category.quantity} sold
                        </Badge>
                      </div>
                      <div className="flex justify-between text-sm text-gray-600">
                        <span>Revenue: ${category.revenue.toFixed(2)}</span>
                        <span>Profit: ${category.profit.toFixed(2)}</span>
                      </div>
                    </div>
                  ))}
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
                  Low Stock Alert ({lowStockProducts.length})
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
                            {product.quantity} left
                          </Badge>
                          <p className="text-xs text-gray-500 mt-1">
                            Alert at {product.lowStockThreshold}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-500 text-center py-8">
                    No low stock items
                  </p>
                )}
              </CardContent>
            </Card>

            {/* Inventory Value by Category */}
            <Card>
              <CardHeader>
                <CardTitle>Inventory Value by Category</CardTitle>
              </CardHeader>
              <CardContent>
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
                    >
                      {inventoryByCategory().map((entry, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={COLORS[index % COLORS.length]}
                        />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value) => [`$${value}`, "Inventory Value"]}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          {/* Inventory Summary Table */}
          <Card>
            <CardHeader>
              <CardTitle>Inventory Summary by Category</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left p-3">Category</th>
                      <th className="text-right p-3">Products</th>
                      <th className="text-right p-3">Total Quantity</th>
                      <th className="text-right p-3">Inventory Value</th>
                    </tr>
                  </thead>
                  <tbody>
                    {inventoryByCategory().map((category, index) => (
                      <tr key={index} className="border-b hover:bg-gray-50">
                        <td className="p-3 font-medium">{category.category}</td>
                        <td className="p-3 text-right">{category.products}</td>
                        <td className="p-3 text-right">{category.quantity}</td>
                        <td className="p-3 text-right font-medium text-green-600">
                          ${category.value.toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
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
                <p className="text-gray-600">Total Revenue</p>
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
                <p className="text-gray-600">Total Profit</p>
                <div className="mt-2 text-sm text-gray-500">
                  {profitMargin.toFixed(1)}% margin
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6 text-center">
                <div className="text-3xl font-bold text-blue-600 mb-2">
                  ${averageSaleValue.toFixed(2)}
                </div>
                <p className="text-gray-600">Average Sale</p>
                <div className="mt-2 text-sm text-gray-500">
                  From {totalSales} transactions
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Profit Trend Chart */}
          <Card>
            <CardHeader>
              <CardTitle>Profit Trend Analysis</CardTitle>
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
