
import React from 'react';
import { useStore } from '@/contexts/StoreContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Clock, DollarSign } from 'lucide-react';

const RecentSales = () => {
  const { sales } = useStore();
  const recentSales = sales.slice(0, 5);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="w-5 h-5" />
          Recent Sales
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {recentSales.map((sale) => (
            <div key={sale.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <Badge variant="outline">#{sale.id}</Badge>
                  <span className="text-sm text-gray-500">
                    {sale.date.toLocaleDateString()} {sale.date.toLocaleTimeString()}
                  </span>
                </div>
                <div className="text-sm text-gray-700">
                  {sale.products.map(p => `${p.productName} (${p.quantity})`).join(', ')}
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  Cashier: {sale.cashierName}
                </div>
              </div>
              <div className="flex items-center gap-1 font-semibold text-green-600">
                <DollarSign className="w-4 h-4" />
                {sale.totalAmount.toFixed(2)}
              </div>
            </div>
          ))}
          
          {recentSales.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              <ShoppingCart className="w-12 h-12 mx-auto mb-4 text-gray-300" />
              <p>No recent sales</p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default RecentSales;
