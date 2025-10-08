import React from "react";
import { useStore } from "@/contexts/StoreContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  Legend,
} from "recharts";
import { Package, AlertCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

const COLORS = [
  "#3b82f6", // Blue
  "#10b981", // Green
  "#f59e0b", // Yellow
  "#ef4444", // Red
  "#8b5cf6", // Purple
  "#06b6d4", // Cyan
  "#84cc16", // Lime
  "#f97316", // Orange
];

const CategoryChart = () => {
  const { products, loading, error } = useStore();
  const { t } = useLanguage();

  // Enhanced getCategoryDistribution with proper error handling
  const getCategoryDistribution = React.useCallback(() => {
    console.log("=== CategoryChart: getCategoryDistribution ===");
    console.log("Products:", products);
    console.log("Products length:", products?.length || 0);

    // Safety checks
    if (!Array.isArray(products)) {
      console.log("❌ Products is not an array:", typeof products);
      return [];
    }

    if (products.length === 0) {
      console.log("❌ No products found");
      return [];
    }

    const categoryMap = new Map<string, { value: number; count: number }>();

    // Process each product with detailed logging
    products.forEach((product, index) => {
      // Validate product data
      if (!product) {
        console.log(`⚠️ Product ${index} is null/undefined`);
        return;
      }

      if (!product.category || typeof product.category !== "string") {
        console.log(
          `⚠️ Product ${index} (${product.name}) has invalid category:`,
          product.category
        );
        return;
      }

      if (typeof product.quantity !== "number" || product.quantity < 0) {
        console.log(
          `⚠️ Product ${index} (${product.name}) has invalid quantity:`,
          product.quantity
        );
        return;
      }

      if (typeof product.sellPrice !== "number" || product.sellPrice < 0) {
        console.log(
          `⚠️ Product ${index} (${product.name}) has invalid sellPrice:`,
          product.sellPrice
        );
        return;
      }

      // Process valid product
      const category = product.category.trim();
      const quantity = Number(product.quantity) || 0;
      const sellPrice = Number(product.sellPrice) || 0;

      if (category && quantity > 0) {
        const current = categoryMap.get(category) || { value: 0, count: 0 };
        const productValue = sellPrice * quantity;

        categoryMap.set(category, {
          value: current.value + productValue,
          count: current.count + quantity,
        });

        console.log(
          `✅ Added ${product.name}: ${quantity} items to category '${category}'`
        );
      } else {
        console.log(
          `⚠️ Skipped ${product.name}: quantity=${quantity}, category='${category}'`
        );
      }
    });

    // Convert map to array
    const result = Array.from(categoryMap.entries()).map(([name, data]) => ({
      name,
      value: Math.round(data.value * 100) / 100,
      count: data.count,
    }));

    // Sort by count descending
    const sortedResult = result.sort((a, b) => b.count - a.count);

    console.log("📊 Final category distribution:", sortedResult);
    console.log("📊 Total categories with data:", sortedResult.length);

    return sortedResult;
  }, [products]);

  const data = getCategoryDistribution();

  // Custom tooltip component
  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-white p-3 border rounded-lg shadow-lg border-gray-200">
          <p className="font-semibold text-gray-900">{data.name}</p>
          <p className="text-sm text-blue-600">
            {t("items")}: {data.count}
          </p>
          <p className="text-sm text-green-600">
            {t("value")}: ${data.value?.toLocaleString() || 0}
          </p>
        </div>
      );
    }
    return null;
  };

  // Custom label function
  const renderLabel = ({ name, percent }: any) => {
    if (percent > 5) {
      // Only show label if slice is > 5%
      return `${name} ${(percent * 100).toFixed(0)}%`;
    }
    return "";
  };

  // Loading state
  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            🏷️ {t("category_distribution")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-[300px]">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
              <p className="text-gray-500 text-sm">{t("loading_chart_data")}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Error state
  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            🏷️ {t("category_distribution")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  // Check if we have valid data
  const hasValidData =
    data && data.length > 0 && data.some((item) => item.count > 0);
  const totalItems = data.reduce((sum, item) => sum + item.count, 0);
  const totalValue = data.reduce((sum, item) => sum + item.value, 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            🏷️ {t("category_distribution")}
          </div>
          <div className="text-sm text-gray-500 font-normal">
            {hasValidData ? (
              <span>
                {data.length} categories • {totalItems} items
              </span>
            ) : (
              <span>No data</span>
            )}
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {hasValidData ? (
          <>
            {/* Summary stats */}
            <div className="mb-4 grid grid-cols-2 gap-4 text-sm">
              <div className="text-center p-2 bg-blue-50 rounded">
                <p className="font-semibold text-blue-900">{totalItems}</p>
                <p className="text-blue-600">Total Items</p>
              </div>
              <div className="text-center p-2 bg-green-50 rounded">
                <p className="font-semibold text-green-900">
                  ${totalValue.toLocaleString()}
                </p>
                <p className="text-green-600">Total Value</p>
              </div>
            </div>

            {/* Pie Chart */}
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={data}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={renderLabel}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="count"
                  animationBegin={0}
                  animationDuration={800}
                >
                  {data.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={COLORS[index % COLORS.length]}
                    />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
                <Legend
                  verticalAlign="bottom"
                  height={36}
                  formatter={(value, entry: any) => (
                    <span style={{ color: entry.color }}>
                      {value} ({entry.payload.count})
                    </span>
                  )}
                />
              </PieChart>
            </ResponsiveContainer>

            {/* Category breakdown */}
            <div className="mt-4 space-y-2">
              <h4 className="font-medium text-gray-700 text-sm">
                Category Breakdown:
              </h4>
              {data.slice(0, 5).map((category, index) => (
                <div
                  key={category.name}
                  className="flex items-center justify-between text-sm"
                >
                  <div className="flex items-center gap-2">
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: COLORS[index % COLORS.length] }}
                    ></div>
                    <span className="font-medium">{category.name}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-gray-600">
                      {category.count} items
                    </span>
                    <br />
                    <span className="text-xs text-green-600">
                      ${category.value.toLocaleString()}
                    </span>
                  </div>
                </div>
              ))}
              {data.length > 5 && (
                <p className="text-xs text-gray-500 text-center pt-2">
                  ... and {data.length - 5} more categories
                </p>
              )}
            </div>
          </>
        ) : (
          // Empty state with helpful messaging
          <div className="flex flex-col items-center justify-center h-[300px] text-gray-500">
            <Package className="w-16 h-16 mb-4 text-gray-300" />
            <h3 className="text-lg font-medium text-gray-700 mb-2">
              No Category Data Available
            </h3>

            {!products || products.length === 0 ? (
              <div className="text-center space-y-2">
                <p className="text-sm">No products found in your inventory.</p>
                <p className="text-xs text-blue-600">
                  Add some products to see category distribution.
                </p>
              </div>
            ) : (
              <div className="text-center space-y-2">
                <p className="text-sm">
                  You have {products.length} products, but none have stock in
                  inventory.
                </p>
                <p className="text-xs text-blue-600">
                  Add inventory to existing products or create products with
                  initial stock.
                </p>

                {/* Debug info for development */}
                <details className="mt-4 text-left">
                  <summary className="cursor-pointer text-xs text-gray-400 hover:text-gray-600">
                    Debug Info (click to expand)
                  </summary>
                  <div className="mt-2 p-2 bg-gray-50 rounded text-xs font-mono">
                    <p>Products found: {products.length}</p>
                    <p>
                      Products with stock:{" "}
                      {products.filter((p) => p.quantity > 0).length}
                    </p>
                    <p>
                      Products with categories:{" "}
                      {products.filter((p) => p.category).length}
                    </p>
                    <p>
                      Valid products:{" "}
                      {
                        products.filter(
                          (p) => p.category && p.quantity > 0 && p.sellPrice > 0
                        ).length
                      }
                    </p>
                  </div>
                </details>
              </div>
            )}
          </div>
        )}

        {/* Development mode debugging */}
        {process.env.NODE_ENV === "development" && (
          <div className="mt-4 p-3 bg-gray-100 rounded-lg">
            <details>
              <summary className="cursor-pointer text-sm font-medium text-gray-700">
                Development Debug Info
              </summary>
              <div className="mt-2 space-y-2 text-xs font-mono">
                <div>
                  <strong>Products Array:</strong> {products?.length || 0} items
                </div>
                <div>
                  <strong>Category Data:</strong> {data?.length || 0} categories
                </div>
                <div>
                  <strong>Has Valid Data:</strong> {hasValidData ? "Yes" : "No"}
                </div>
                <div>
                  <strong>Sample Products:</strong>
                  <pre className="mt-1 p-2 bg-white rounded text-xs overflow-auto max-h-32">
                    {JSON.stringify(products?.slice(0, 2), null, 2)}
                  </pre>
                </div>
                <div>
                  <strong>Category Distribution:</strong>
                  <pre className="mt-1 p-2 bg-white rounded text-xs overflow-auto max-h-32">
                    {JSON.stringify(data, null, 2)}
                  </pre>
                </div>
                <button
                  onClick={() => {
                    console.log("=== Manual Debug Trigger ===");
                    console.log("Products:", products);
                    console.log("Category Data:", data);
                    console.log("Has Valid Data:", hasValidData);
                  }}
                  className="mt-2 px-3 py-1 bg-blue-500 text-white rounded text-xs hover:bg-blue-600"
                >
                  Log to Console
                </button>
              </div>
            </details>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default CategoryChart;
