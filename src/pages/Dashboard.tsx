
import React from 'react';
import { useStore } from '@/contexts/StoreContext';
import { Loading } from '@/components/ui/loading';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertTriangle } from 'lucide-react';
import StatsCards from '@/components/dashboard/StatsCards';
import SalesChart from '@/components/dashboard/SalesChart';
import CategoryChart from '@/components/dashboard/CategoryChart';
import RecentSales from '@/components/dashboard/RecentSales';

const Dashboard = () => {
  const { loading, error } = useStore();

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-600">Overview of your store performance</p>
        </div>
        <div className="flex items-center justify-center py-20">
          <Loading size="lg" text="Loading dashboard data..." />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-600">Overview of your store performance</p>
        </div>
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            {error}. Please check your connection and try again.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-600">Overview of your store performance</p>
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
