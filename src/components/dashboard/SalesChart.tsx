
import React from 'react';
import { useStore } from '@/contexts/StoreContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts';

const SalesChart = () => {
  const { getMonthlySalesData } = useStore();
  const data = getMonthlySalesData();

  return (
    <Card className="col-span-1 lg:col-span-2">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          📈 Monthly Sales & Profit Trends
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="month" />
            <YAxis />
            <Tooltip 
              formatter={(value, name) => [`$${value.toLocaleString()}`, name === 'sales' ? 'Sales' : 'Profit']}
            />
            <Bar dataKey="sales" fill="#3b82f6" name="sales" radius={[2, 2, 0, 0]} />
            <Bar dataKey="profit" fill="#10b981" name="profit" radius={[2, 2, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
};

export default SalesChart;
