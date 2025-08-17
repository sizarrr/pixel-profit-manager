import React from "react";
import { useStore } from "@/contexts/StoreContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
} from "recharts";
import { TrendingUp, AlertCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

// Custom tooltip component for better formatting
const CustomTooltip = ({ active, payload, label, t }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white p-4 border rounded-lg shadow-lg">
        <p className="font-medium text-gray-900">{`${label}`}</p>
        {payload.map((entry: any, index: number) => (
          <p key={index} style={{ color: entry.color }} className="text-sm">
            {`${
              entry.name === "sales" ? t("sales_label") : t("profit_label")
            }: $${entry.value?.toLocaleString() || "0"}`}
          </p>
        ))}
      </div>
    );
  }
  return null;
};

// Loading component for chart
const ChartLoading = ({ t }: { t: (key: string) => string }) => (
  <div className="flex items-center justify-center h-[300px]">
    <div className="text-center">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
      <p className="text-gray-500 text-sm">{t("loading_chart_data")}</p>
    </div>
  </div>
);

// Error component for chart
const ChartError = ({
  message,
  t,
}: {
  message: string;
  t: (key: string) => string;
}) => (
  <div className="flex items-center justify-center h-[300px]">
    <Alert variant="destructive" className="max-w-md">
      <AlertCircle className="h-4 w-4" />
      <AlertDescription>
        {message || t("unable_load_chart_data")}
      </AlertDescription>
    </Alert>
  </div>
);

// Empty state component
const ChartEmpty = ({ t }: { t: (key: string) => string }) => (
  <div className="flex items-center justify-center h-[300px]">
    <div className="text-center">
      <TrendingUp className="h-12 w-12 text-gray-300 mx-auto mb-4" />
      <h3 className="text-lg font-medium text-gray-900 mb-2">
        {t("no_sales_data")}
      </h3>
      <p className="text-gray-500 text-sm">{t("start_making_sales")}</p>
    </div>
  </div>
);

const SalesChart = () => {
  const { getMonthlySalesData, loading, error } = useStore();
  const { t } = useLanguage();

  // Get chart data with error handling
  let chartData;
  let chartError = null;

  try {
    chartData = getMonthlySalesData();
    console.log("Chart data:", chartData); // Debug log
  } catch (err) {
    console.error("Error getting monthly sales data:", err);
    chartError = t("failed_load_sales_data");
    chartData = [];
  }

  // Validate chart data
  const isValidData = Array.isArray(chartData) && chartData.length > 0;
  const hasValues =
    isValidData &&
    chartData.some(
      (item) =>
        (item.sales && item.sales > 0) || (item.profit && item.profit > 0)
    );

  // Show loading state
  if (loading) {
    return (
      <Card className="col-span-1 lg:col-span-2">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {t("sales_chart_title")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ChartLoading t={t} />
        </CardContent>
      </Card>
    );
  }

  // Show error state
  if (error || chartError) {
    return (
      <Card className="col-span-1 lg:col-span-2">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {t("sales_chart_title")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ChartError message={error || chartError} t={t} />
        </CardContent>
      </Card>
    );
  }

  // Show empty state
  if (!isValidData || !hasValues) {
    return (
      <Card className="col-span-1 lg:col-span-2">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {t("sales_chart_title")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ChartEmpty t={t} />
        </CardContent>
      </Card>
    );
  }

  // Calculate totals for display
  const totalSales = chartData.reduce(
    (sum, item) => sum + (item.sales || 0),
    0
  );
  const totalProfit = chartData.reduce(
    (sum, item) => sum + (item.profit || 0),
    0
  );

  return (
    <Card className="col-span-1 lg:col-span-2">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {t("sales_chart_title")}
        </CardTitle>
        <div className="flex gap-6 mt-2">
          <div className="text-sm">
            <span className="text-gray-500">{t("total_sales")}: </span>
            <span className="font-semibold text-blue-600">
              ${totalSales.toLocaleString()}
            </span>
          </div>
          <div className="text-sm">
            <span className="text-gray-500">{t("total_profit_display")}: </span>
            <span className="font-semibold text-green-600">
              ${totalProfit.toLocaleString()}
            </span>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart
            data={chartData}
            margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
            barCategoryGap="20%"
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis
              dataKey="month"
              tick={{ fontSize: 12 }}
              axisLine={{ stroke: "#e0e0e0" }}
            />
            <YAxis
              tick={{ fontSize: 12 }}
              axisLine={{ stroke: "#e0e0e0" }}
              tickFormatter={(value) => `$${value.toLocaleString()}`}
            />
            <Tooltip content={<CustomTooltip t={t} />} />
            <Bar
              dataKey="sales"
              fill="#3b82f6"
              name="sales"
              radius={[2, 2, 0, 0]}
              maxBarSize={60}
            />
            <Bar
              dataKey="profit"
              fill="#10b981"
              name="profit"
              radius={[2, 2, 0, 0]}
              maxBarSize={60}
            />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
};

export default SalesChart;
