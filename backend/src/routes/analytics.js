import express from 'express';
import mongoose from 'mongoose';
import Product from '../models/Product.js';
import Sale from '../models/Sale.js';

const router = express.Router();

// GET /api/analytics/dashboard - Get dashboard statistics
router.get('/dashboard', async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const thisMonth = new Date();
    thisMonth.setDate(1);
    thisMonth.setHours(0, 0, 0, 0);

    // Parallel execution of all dashboard queries
    const [
      todaysSales,
      monthlyStats,
      lowStockProducts,
      categoryDistribution
    ] = await Promise.all([
      // Today's sales
      Sale.aggregate([
        {
          $match: {
            createdAt: { $gte: today, $lt: tomorrow },
            status: 'completed'
          }
        },
        {
          $group: {
            _id: null,
            total: { $sum: '$totalAmount' }
          }
        }
      ]),

      // Monthly sales and profit calculation
      Sale.aggregate([
        {
          $match: {
            createdAt: { $gte: thisMonth },
            status: 'completed'
          }
        },
        {
          $lookup: {
            from: 'products',
            localField: 'products.productId',
            foreignField: '_id',
            as: 'productDetails'
          }
        },
        {
          $unwind: '$products'
        },
        {
          $lookup: {
            from: 'products',
            localField: 'products.productId',
            foreignField: '_id',
            as: 'product'
          }
        },
        {
          $unwind: '$product'
        },
        {
          $group: {
            _id: null,
            sales: { $sum: '$products.total' },
            profit: {
              $sum: {
                $multiply: [
                  { $subtract: ['$products.sellPrice', '$product.buyPrice'] },
                  '$products.quantity'
                ]
              }
            }
          }
        }
      ]),

      // Low stock products
      Product.find({ quantity: { $lte: 5 } })
        .select('name category quantity')
        .sort({ quantity: 1 }),

      // Category distribution
      Product.aggregate([
        {
          $group: {
            _id: '$category',
            value: { $sum: { $multiply: ['$sellPrice', '$quantity'] } },
            count: { $sum: '$quantity' }
          }
        },
        {
          $sort: { value: -1 }
        }
      ])
    ]);

    res.json({
      todaysSales: todaysSales[0]?.total || 0,
      monthlyStats: {
        sales: monthlyStats[0]?.sales || 0,
        profit: monthlyStats[0]?.profit || 0
      },
      lowStockProducts: lowStockProducts.map(product => ({
        id: product._id,
        name: product.name,
        category: product.category,
        quantity: product.quantity
      })),
      categoryDistribution: categoryDistribution.map(cat => ({
        name: cat._id,
        value: cat.value,
        count: cat.count
      }))
    });
  } catch (error) {
    console.error('Error fetching dashboard analytics:', error);
    res.status(500).json({ error: 'Failed to fetch dashboard analytics' });
  }
});

// GET /api/analytics/monthly-sales - Get monthly sales data for charts
router.get('/monthly-sales', async (req, res) => {
  try {
    const { year = new Date().getFullYear() } = req.query;
    
    const monthlySalesData = await Sale.aggregate([
      {
        $match: {
          createdAt: {
            $gte: new Date(`${year}-01-01`),
            $lt: new Date(`${parseInt(year) + 1}-01-01`)
          },
          status: 'completed'
        }
      },
      {
        $lookup: {
          from: 'products',
          localField: 'products.productId',
          foreignField: '_id',
          as: 'productDetails'
        }
      },
      {
        $unwind: '$products'
      },
      {
        $lookup: {
          from: 'products',
          localField: 'products.productId',
          foreignField: '_id',
          as: 'product'
        }
      },
      {
        $unwind: '$product'
      },
      {
        $group: {
          _id: { $month: '$createdAt' },
          sales: { $sum: '$products.total' },
          profit: {
            $sum: {
              $multiply: [
                { $subtract: ['$products.sellPrice', '$product.buyPrice'] },
                '$products.quantity'
              ]
            }
          }
        }
      },
      {
        $sort: { '_id': 1 }
      }
    ]);

    // Create array for all 12 months
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const result = months.map((month, index) => {
      const monthData = monthlySalesData.find(data => data._id === index + 1);
      return {
        month,
        sales: monthData ? monthData.sales : 0,
        profit: monthData ? monthData.profit : 0
      };
    });

    res.json(result);
  } catch (error) {
    console.error('Error fetching monthly sales data:', error);
    res.status(500).json({ error: 'Failed to fetch monthly sales data' });
  }
});

// GET /api/analytics/top-products - Get top selling products
router.get('/top-products', async (req, res) => {
  try {
    const { limit = 10, period = '30' } = req.query;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(period));

    const topProducts = await Sale.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate },
          status: 'completed'
        }
      },
      {
        $unwind: '$products'
      },
      {
        $group: {
          _id: '$products.productId',
          productName: { $first: '$products.productName' },
          totalSold: { $sum: '$products.quantity' },
          totalRevenue: { $sum: '$products.total' },
          timesSold: { $sum: 1 }
        }
      },
      {
        $sort: { totalSold: -1 }
      },
      {
        $limit: parseInt(limit)
      }
    ]);

    res.json(topProducts.map(product => ({
      productId: product._id,
      productName: product.productName,
      totalSold: product.totalSold,
      totalRevenue: product.totalRevenue,
      timesSold: product.timesSold
    })));
  } catch (error) {
    console.error('Error fetching top products:', error);
    res.status(500).json({ error: 'Failed to fetch top products' });
  }
});

// GET /api/analytics/sales-by-date - Get sales data by date range
router.get('/sales-by-date', async (req, res) => {
  try {
    const { startDate, endDate, groupBy = 'day' } = req.query;
    
    if (!startDate || !endDate) {
      return res.status(400).json({ error: 'Start date and end date are required' });
    }

    let dateGrouping;
    switch (groupBy) {
      case 'month':
        dateGrouping = {
          year: { $year: '$createdAt' },
          month: { $month: '$createdAt' }
        };
        break;
      case 'week':
        dateGrouping = {
          year: { $year: '$createdAt' },
          week: { $week: '$createdAt' }
        };
        break;
      default:
        dateGrouping = {
          year: { $year: '$createdAt' },
          month: { $month: '$createdAt' },
          day: { $dayOfMonth: '$createdAt' }
        };
    }

    const salesData = await Sale.aggregate([
      {
        $match: {
          createdAt: {
            $gte: new Date(startDate),
            $lte: new Date(endDate)
          },
          status: 'completed'
        }
      },
      {
        $group: {
          _id: dateGrouping,
          transactionCount: { $sum: 1 },
          totalSales: { $sum: '$totalAmount' },
          averageSale: { $avg: '$totalAmount' }
        }
      },
      {
        $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1, '_id.week': 1 }
      }
    ]);

    const formattedData = salesData.map(data => {
      let period;
      if (groupBy === 'month') {
        period = `${data._id.year}-${String(data._id.month).padStart(2, '0')}`;
      } else if (groupBy === 'week') {
        period = `${data._id.year}-W${String(data._id.week).padStart(2, '0')}`;
      } else {
        period = `${data._id.year}-${String(data._id.month).padStart(2, '0')}-${String(data._id.day).padStart(2, '0')}`;
      }

      return {
        period,
        transactionCount: data.transactionCount,
        totalSales: data.totalSales,
        averageSale: data.averageSale
      };
    });

    res.json(formattedData);
  } catch (error) {
    console.error('Error fetching sales by date:', error);
    res.status(500).json({ error: 'Failed to fetch sales by date' });
  }
});

// GET /api/analytics/inventory-value - Get total inventory value
router.get('/inventory-value', async (req, res) => {
  try {
    const [inventoryValue, categoryBreakdown] = await Promise.all([
      // Overall inventory summary
      Product.aggregate([
        {
          $group: {
            _id: null,
            costValue: { $sum: { $multiply: ['$buyPrice', '$quantity'] } },
            retailValue: { $sum: { $multiply: ['$sellPrice', '$quantity'] } },
            totalProducts: { $sum: 1 },
            totalItems: { $sum: '$quantity' }
          }
        }
      ]),

      // Category breakdown
      Product.aggregate([
        {
          $group: {
            _id: '$category',
            costValue: { $sum: { $multiply: ['$buyPrice', '$quantity'] } },
            retailValue: { $sum: { $multiply: ['$sellPrice', '$quantity'] } },
            productCount: { $sum: 1 },
            itemCount: { $sum: '$quantity' }
          }
        },
        {
          $sort: { retailValue: -1 }
        }
      ])
    ]);

    const summary = inventoryValue[0] || {
      costValue: 0,
      retailValue: 0,
      totalProducts: 0,
      totalItems: 0
    };

    res.json({
      summary: {
        costValue: summary.costValue,
        retailValue: summary.retailValue,
        totalProducts: summary.totalProducts,
        totalItems: summary.totalItems,
        potentialProfit: summary.retailValue - summary.costValue
      },
      categoryBreakdown: categoryBreakdown.map(cat => ({
        category: cat._id,
        costValue: cat.costValue,
        retailValue: cat.retailValue,
        productCount: cat.productCount,
        itemCount: cat.itemCount,
        potentialProfit: cat.retailValue - cat.costValue
      }))
    });
  } catch (error) {
    console.error('Error fetching inventory value:', error);
    res.status(500).json({ error: 'Failed to fetch inventory value' });
  }
});

// GET /api/analytics/profit-analysis - Get profit analysis
router.get('/profit-analysis', async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const today = new Date();
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const start = startDate ? new Date(startDate) : thirtyDaysAgo;
    const end = endDate ? new Date(endDate) : today;

    const profitData = await Sale.aggregate([
      {
        $match: {
          createdAt: { $gte: start, $lte: end },
          status: 'completed'
        }
      },
      {
        $unwind: '$products'
      },
      {
        $lookup: {
          from: 'products',
          localField: 'products.productId',
          foreignField: '_id',
          as: 'product'
        }
      },
      {
        $unwind: '$product'
      },
      {
        $group: {
          _id: '$_id',
          createdAt: { $first: '$createdAt' },
          revenue: { $first: '$totalAmount' },
          cost: {
            $sum: {
              $multiply: ['$product.buyPrice', '$products.quantity']
            }
          },
          profit: {
            $sum: {
              $multiply: [
                { $subtract: ['$products.sellPrice', '$product.buyPrice'] },
                '$products.quantity'
              ]
            }
          }
        }
      },
      {
        $sort: { createdAt: -1 }
      }
    ]);

    const summary = profitData.reduce((acc, sale) => ({
      totalRevenue: acc.totalRevenue + sale.revenue,
      totalProfit: acc.totalProfit + sale.profit,
      totalCost: acc.totalCost + sale.cost,
      transactionCount: acc.transactionCount + 1
    }), { totalRevenue: 0, totalProfit: 0, totalCost: 0, transactionCount: 0 });

    const profitMargin = summary.totalRevenue > 0 ? (summary.totalProfit / summary.totalRevenue) * 100 : 0;

    res.json({
      summary: {
        ...summary,
        profitMargin,
        averageProfit: summary.transactionCount > 0 ? summary.totalProfit / summary.transactionCount : 0
      },
      transactions: profitData.map(sale => ({
        date: sale.createdAt,
        revenue: sale.revenue,
        profit: sale.profit,
        cost: sale.cost,
        profitMargin: sale.revenue > 0 ? (sale.profit / sale.revenue) * 100 : 0
      })),
      dateRange: { 
        start: start.toISOString().split('T')[0], 
        end: end.toISOString().split('T')[0] 
      }
    });
  } catch (error) {
    console.error('Error fetching profit analysis:', error);
    res.status(500).json({ error: 'Failed to fetch profit analysis' });
  }
});

// GET /api/analytics/cashier-performance - Get cashier performance metrics
router.get('/cashier-performance', async (req, res) => {
  try {
    const { period = '30' } = req.query;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(period));

    const cashierStats = await Sale.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate },
          status: 'completed'
        }
      },
      {
        $group: {
          _id: '$cashierName',
          totalSales: { $sum: 1 },
          totalRevenue: { $sum: '$totalAmount' },
          averageSale: { $avg: '$totalAmount' },
          totalItems: { $sum: { $sum: '$products.quantity' } }
        }
      },
      {
        $sort: { totalRevenue: -1 }
      }
    ]);

    res.json(cashierStats.map(cashier => ({
      cashierName: cashier._id,
      totalSales: cashier.totalSales,
      totalRevenue: cashier.totalRevenue,
      averageSale: cashier.averageSale,
      totalItems: cashier.totalItems
    })));
  } catch (error) {
    console.error('Error fetching cashier performance:', error);
    res.status(500).json({ error: 'Failed to fetch cashier performance' });
  }
});

// GET /api/analytics/product-performance - Get detailed product performance
router.get('/product-performance', async (req, res) => {
  try {
    const { period = '30', category } = req.query;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(period));

    let matchStage = {
      createdAt: { $gte: startDate },
      status: 'completed'
    };

    const productPerformance = await Sale.aggregate([
      { $match: matchStage },
      { $unwind: '$products' },
      {
        $lookup: {
          from: 'products',
          localField: 'products.productId',
          foreignField: '_id',
          as: 'product'
        }
      },
      { $unwind: '$product' },
      ...(category ? [{ $match: { 'product.category': category } }] : []),
      {
        $group: {
          _id: '$products.productId',
          productName: { $first: '$products.productName' },
          category: { $first: '$product.category' },
          currentStock: { $first: '$product.quantity' },
          totalSold: { $sum: '$products.quantity' },
          totalRevenue: { $sum: '$products.total' },
          averagePrice: { $avg: '$products.sellPrice' },
          timesSold: { $sum: 1 },
          profit: {
            $sum: {
              $multiply: [
                { $subtract: ['$products.sellPrice', '$product.buyPrice'] },
                '$products.quantity'
              ]
            }
          }
        }
      },
      { $sort: { totalRevenue: -1 } }
    ]);

    res.json(productPerformance.map(product => ({
      productId: product._id,
      productName: product.productName,
      category: product.category,
      currentStock: product.currentStock,
      totalSold: product.totalSold,
      totalRevenue: product.totalRevenue,
      averagePrice: product.averagePrice,
      timesSold: product.timesSold,
      profit: product.profit,
      profitMargin: product.totalRevenue > 0 ? (product.profit / product.totalRevenue) * 100 : 0
    })));
  } catch (error) {
    console.error('Error fetching product performance:', error);
    res.status(500).json({ error: 'Failed to fetch product performance' });
  }
});

export default router;