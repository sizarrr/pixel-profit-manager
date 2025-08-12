import React from "react";
import { useStore } from "@/contexts/StoreContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DollarSign,
  ShoppingCart,
  TrendingUp,
  Package,
  ArrowUpRight,
  ArrowDownRight,
} from "lucide-react";

const StatsCards = () => {
  const { products, getTodaysSales, getMonthlyStats, loading, error } =
    useStore();

  // Safety checks and default values
  const safeProducts = Array.isArray(products) ? products : [];
  const todaysSales = getTodaysSales() || 0;
  const monthlyStats = getMonthlyStats() || { sales: 0, profit: 0 };

  const totalProducts = safeProducts.reduce(
    (sum, product) => sum + (product.quantity || 0),
    0
  );
  const totalValue = safeProducts.reduce(
    (sum, product) => sum + (product.sellPrice || 0) * (product.quantity || 0),
    0
  );

  const stats = [
    {
      title: "Today's Sales",
      value: `$${todaysSales.toLocaleString()}`,
      change: "+12%",
      changeType: "positive" as const,
      icon: DollarSign,
      color: "bg-green-500",
    },
    {
      title: "Monthly Sales",
      value: `$${monthlyStats.sales.toLocaleString()}`,
      change: "+8%",
      changeType: "positive" as const,
      icon: ShoppingCart,
      color: "bg-blue-500",
    },
    {
      title: "Monthly Profit",
      value: `$${monthlyStats.profit.toLocaleString()}`,
      change: "+15%",
      changeType: "positive" as const,
      icon: TrendingUp,
      color: "bg-purple-500",
    },
    {
      title: "Products in Stock",
      value: totalProducts.toString(),
      change: `$${totalValue.toLocaleString()} value`,
      changeType: "neutral" as const,
      icon: Package,
      color: "bg-orange-500",
    },
  ];

  // Show loading state
  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i} className="animate-pulse">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <div className="h-4 bg-gray-200 rounded w-20"></div>
              <div className="w-10 h-10 bg-gray-200 rounded-lg"></div>
            </CardHeader>
            <CardContent>
              <div className="h-8 bg-gray-200 rounded w-16 mb-2"></div>
              <div className="h-4 bg-gray-200 rounded w-12"></div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  // Show error state
  if (error) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat, index) => (
          <Card key={index} className="border-red-200">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-red-600">
                {stat.title}
              </CardTitle>
              <div className="w-10 h-10 rounded-lg bg-red-100 flex items-center justify-center">
                <stat.icon className="w-5 h-5 text-red-500" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-gray-400">--</div>
              <div className="flex items-center mt-2">
                <span className="text-sm text-red-500">Error loading data</span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      {stats.map((stat, index) => (
        <Card key={index} className="hover:shadow-lg transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">
              {stat.title}
            </CardTitle>
            <div
              className={`w-10 h-10 rounded-lg ${stat.color} flex items-center justify-center`}
            >
              <stat.icon className="w-5 h-5 text-white" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gray-900">{stat.value}</div>
            <div className="flex items-center mt-2">
              {stat.changeType === "positive" && (
                <ArrowUpRight className="w-4 h-4 text-green-500 mr-1" />
              )}
              <span
                className={`text-sm ${
                  stat.changeType === "positive"
                    ? "text-green-600"
                    : "text-gray-500"
                }`}
              >
                {stat.change}
              </span>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};

export default StatsCards;
