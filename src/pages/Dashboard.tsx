import React, { useEffect } from "react";
import { useStore } from "@/contexts/StoreContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { Loading } from "@/components/ui/loading";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { AlertTriangle, RefreshCw } from "lucide-react";
import StatsCards from "@/components/dashboard/StatsCards";
import SalesChart from "@/components/dashboard/SalesChart";
import CategoryChart from "@/components/dashboard/CategoryChart";
import RecentSales from "@/components/dashboard/RecentSales";

const Dashboard = () => {
  const { loading, error, refreshData } = useStore();
  const { t } = useLanguage();

  // Auto-refresh dashboard data every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      console.log("Auto-refreshing dashboard data...");
      refreshData();
    }, 30000); // 30 seconds

    return () => clearInterval(interval);
  }, [refreshData]);

  const handleManualRefresh = async () => {
    console.log("Manual refresh triggered");
    try {
      await refreshData();
    } catch (err) {
      console.error("Manual refresh failed:", err);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              {t("dashboard")}
            </h1>
            <p className="text-gray-600">{t("overview")}</p>
          </div>
        </div>
        <div className="flex items-center justify-center py-20">
          <Loading
            size="lg"
            text={`${t("loading")} ${t("dashboard").toLowerCase()}...`}
          />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              {t("dashboard")}
            </h1>
            <p className="text-gray-600">{t("overview")}</p>
          </div>
          <Button
            onClick={handleManualRefresh}
            variant="outline"
            className="flex items-center gap-2"
          >
            <RefreshCw className="h-4 w-4" />
            {t("retry")}
          </Button>
        </div>
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            {error}. {t("check_connection")}
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t("dashboard")}</h1>
          <p className="text-gray-600">{t("overview")}</p>
        </div>
        <Button
          onClick={handleManualRefresh}
          variant="outline"
          size="sm"
          className="flex items-center gap-2"
        >
          <RefreshCw className="h-4 w-4" />
          {t("refresh")}
        </Button>
      </div>

      <StatsCards />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <SalesChart />
        <CategoryChart />
      </div>

      <RecentSales />
    </div>
  );
};

export default Dashboard;
