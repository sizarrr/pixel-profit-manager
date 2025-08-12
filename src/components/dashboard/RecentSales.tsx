import React from "react";
import { useStore } from "@/contexts/StoreContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Clock, DollarSign, ShoppingCart } from "lucide-react";

const RecentSales = () => {
  const { sales, loading, error } = useStore();

  // Safety check: ensure sales is an array before using slice
  const recentSales = Array.isArray(sales) ? sales.slice(0, 5) : [];

  // Show loading state
  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="w-5 h-5" />
            Recent Sales
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <div className="animate-pulse text-gray-500">
              Loading recent sales...
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Show error state
  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="w-5 h-5" />
            Recent Sales
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-red-500">
            <p>Error loading sales data</p>
            <p className="text-sm text-gray-500 mt-1">{error}</p>
          </div>
        </CardContent>
      </Card>
    );
  }

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
          {recentSales.length > 0 ? (
            recentSales.map((sale) => (
              <div
                key={sale.id}
                className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <Badge variant="outline">
                      #{sale.receiptNumber || sale.id}
                    </Badge>
                    <span className="text-sm text-gray-500">
                      {sale.date ? (
                        <>
                          {sale.date.toLocaleDateString()}{" "}
                          {sale.date.toLocaleTimeString()}
                        </>
                      ) : (
                        "Date unavailable"
                      )}
                    </span>
                  </div>
                  <div className="text-sm text-gray-700">
                    {sale.products && sale.products.length > 0
                      ? sale.products
                          .map(
                            (p) =>
                              `${p.productName || "Unknown Product"} (${
                                p.quantity || 0
                              })`
                          )
                          .join(", ")
                      : "No products"}
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    Cashier: {sale.cashierName || "Unknown"}
                  </div>
                </div>
                <div className="flex items-center gap-1 font-semibold text-green-600">
                  <DollarSign className="w-4 h-4" />
                  {(sale.totalAmount || 0).toFixed(2)}
                </div>
              </div>
            ))
          ) : (
            <div className="text-center py-8 text-gray-500">
              <ShoppingCart className="w-12 h-12 mx-auto mb-4 text-gray-300" />
              <p>No recent sales</p>
              <p className="text-sm text-gray-400 mt-1">
                Sales will appear here once you start making transactions
              </p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default RecentSales;
