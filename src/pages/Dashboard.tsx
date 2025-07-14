
import React from 'react';
import StatsCards from '@/components/dashboard/StatsCards';
import SalesChart from '@/components/dashboard/SalesChart';
import CategoryChart from '@/components/dashboard/CategoryChart';
import RecentSales from '@/components/dashboard/RecentSales';

const Dashboard = () => {
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
