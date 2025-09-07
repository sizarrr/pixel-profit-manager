import Product from '../models/Product.js';
import Sale from '../models/Sale.js';
import { catchAsync } from '../middleware/errorHandler.js';

// Get comprehensive dashboard overview
export const getDashboardOverview = catchAsync(async (req, res, next) => {
  const { startDate, endDate } = req.query;
  
  // Default to current month if no dates provided
  const start = startDate ? new Date(startDate) : new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  const end = endDate ? new Date(endDate) : new Date();

  // Get today's date for today's stats
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  // Parallel execution of all dashboard queries
  const [
    productStats,
    salesStats,
    todayStats,
    lowStockProducts,
    recentSales,
    topProducts,
    categoryDistribution,
    monthlySalesData
  ] = await Promise.all([
    // Product statistics
    Product.aggregate([
      { $match: { isActive: true } },
      {
        $group: {
          _id: null,
          totalProducts: { $sum: 1 },
          totalInventoryValue: { $sum: { $multiply: ['$sellPrice', '$quantity'] } },
          totalQuantity: { $sum: '$quantity' },
          averagePrice: { $avg: '$sellPrice' },
          lowStockCount: {
            $sum: {
              $cond: [{ $lte: ['$quantity', '$lowStockThreshold'] }, 1, 0]
            }
          }
        }
      }
    ]),

    // Sales statistics for the period
    Sale.aggregate([
      {
        $match: {
          createdAt: { $gte: start, $lte: end }
        }
      },
      {
        $group: {
          _id: null,
          totalSales: { $sum: 1 },
          totalRevenue: { $sum: '$totalAmount' },
          averageSale: { $avg: '$totalAmount' },
          totalItemsSold: {
            $sum: {
              $reduce: {
                input: '$products',
                initialValue: 0,
                in: { $add: ['$$value', '$$this.quantity'] }
              }
            }
          }
        }
      }
    ]),

    // Today's statistics
    Sale.aggregate([
      {
        $match: {
          createdAt: { $gte: today, $lt: tomorrow }
        }
      },
      {
        $group: {
          _id: null,
          todaySales: { $sum: 1 },
          todayRevenue: { $sum: '$totalAmount' }
        }
      }
    ]),

    // Low stock products
    Product.find({
      isActive: true,
      $expr: { $lte: ['$quantity', '$lowStockThreshold'] }
    }).sort('quantity').limit(10),

    // Recent sales
    Sale.find()
      .sort('-createdAt')
      .limit(5)
      .lean(),

    // Top selling products (last 30 days)
    Sale.aggregate([
      {
        $match: {
          createdAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }
        }
      },
      { $unwind: '$products' },
      {
        $group: {
          _id: '$products.productId',
          productName: { $first: '$products.productName' },
          totalQuantitySold: { $sum: '$products.quantity' },
          totalRevenue: { $sum: '$products.total' }
        }
      },
      { $sort: { totalQuantitySold: -1 } },
      { $limit: 5 }
    ]),

    // Category distribution
    Product.aggregate([
      { $match: { isActive: true } },
      {
        $group: {
          _id: '$category',
          count: { $sum: 1 },
          totalValue: { $sum: { $multiply: ['$sellPrice', '$quantity'] } },
          totalQuantity: { $sum: '$quantity' }
        }
      },
      { $sort: { count: -1 } }
    ]),

    // Monthly sales data (last 12 months)
    Sale.aggregate([
      {
        $match: {
          createdAt: { $gte: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000) }
        }
      },
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' }
          },
          sales: { $sum: 1 },
          revenue: { $sum: '$totalAmount' }
        }
      },
      { $sort: { '_id.year': 1, '_id.month': 1 } },
      { $limit: 12 }
    ])
  ]);

  // Calculate profit data using actual FIFO batch costs
  const profitData = await Sale.aggregate([
    {
      $match: {
        createdAt: { $gte: start, $lte: end }
      }
    },
    { $unwind: '$products' },
    {
      $addFields: {
        // Calculate actual cost from batch allocations if available
        actualCost: {
          $cond: {
            if: { $and: [
              { $isArray: '$products.batchAllocations' },
              { $gt: [{ $size: '$products.batchAllocations' }, 0] }
            ]},
            then: {
              $reduce: {
                input: '$products.batchAllocations',
                initialValue: 0,
                in: {
                  $add: [
                    '$$value',
                    { $multiply: ['$$this.buyPrice', '$$this.quantity'] }
                  ]
                }
              }
            },
            else: null
          }
        }
      }
    },
    {
      $lookup: {
        from: 'products',
        localField: 'products.productId',
        foreignField: '_id',
        as: 'productInfo'
      }
    },
    { $unwind: '$productInfo' },
    {
      $addFields: {
        profit: {
          $subtract: [
            '$products.total',
            {
              $ifNull: [
                '$actualCost',
                { $multiply: ['$productInfo.buyPrice', '$products.quantity'] }
              ]
            }
          ]
        }
      }
    },
    {
      $group: {
        _id: null,
        totalProfit: { $sum: '$profit' },
        totalRevenue: { $sum: '$products.total' }
      }
    }
  ]);

  // Format the response
  const overview = {
    products: productStats[0] || {
      totalProducts: 0,
      totalInventoryValue: 0,
      totalQuantity: 0,
      averagePrice: 0,
      lowStockCount: 0
    },
    sales: {
      period: {
        startDate: start,
        endDate: end,
        ...salesStats[0] || {
          totalSales: 0,
          totalRevenue: 0,
          averageSale: 0,
          totalItemsSold: 0
        }
      },
      today: todayStats[0] || {
        todaySales: 0,
        todayRevenue: 0
      }
    },
    profit: profitData[0] || {
      totalProfit: 0,
      totalRevenue: 0
    },
    lowStockProducts,
    recentSales,
    topProducts,
    categoryDistribution,
    monthlySalesData: monthlySalesData.map(item => ({
      month: `${item._id.year}-${String(item._id.month).padStart(2, '0')}`,
      sales: item.sales,
      revenue: item.revenue
    }))
  };

  // Add profit margin calculation
  if (overview.profit.totalRevenue > 0) {
    overview.profit.profitMargin = (overview.profit.totalProfit / overview.profit.totalRevenue * 100);
  } else {
    overview.profit.profitMargin = 0;
  }

  res.status(200).json({
    status: 'success',
    data: overview
  });
});

// Get sales analytics for charts
export const getSalesAnalytics = catchAsync(async (req, res, next) => {
  const { period = '30d', groupBy = 'day' } = req.query;
  
  // Calculate date range based on period
  let startDate;
  const endDate = new Date();
  
  switch (period) {
    case '7d':
      startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      break;
    case '30d':
      startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      break;
    case '90d':
      startDate = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
      break;
    case '1y':
      startDate = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000);
      break;
    default:
      startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  }

  // Set grouping format based on groupBy parameter
  let groupFormat;
  switch (groupBy) {
    case 'hour':
      groupFormat = { $dateToString: { format: '%Y-%m-%d %H:00', date: '$createdAt' } };
      break;
    case 'day':
      groupFormat = { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } };
      break;
    case 'week':
      groupFormat = { 
        $dateToString: { 
          format: '%Y-W%V', 
          date: '$createdAt' 
        } 
      };
      break;
    case 'month':
      groupFormat = { $dateToString: { format: '%Y-%m', date: '$createdAt' } };
      break;
    default:
      groupFormat = { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } };
  }

  const analyticsData = await Sale.aggregate([
    {
      $match: {
        createdAt: { $gte: startDate, $lte: endDate }
      }
    },
    {
      $group: {
        _id: groupFormat,
        sales: { $sum: 1 },
        revenue: { $sum: '$totalAmount' },
        itemsSold: {
          $sum: {
            $reduce: {
              input: '$products',
              initialValue: 0,
              in: { $add: ['$$value', '$$this.quantity'] }
            }
          }
        },
        averageSale: { $avg: '$totalAmount' }
      }
    },
    {
      $sort: { _id: 1 }
    }
  ]);

  res.status(200).json({
    status: 'success',
    data: {
      period: {
        startDate,
        endDate,
        groupBy
      },
      analytics: analyticsData
    }
  });
});

// Get inventory alerts and insights
export const getInventoryInsights = catchAsync(async (req, res, next) => {
  const [
    lowStockProducts,
    outOfStockProducts,
    overstockedProducts,
    categoryInsights
  ] = await Promise.all([
    // Low stock products
    Product.find({
      isActive: true,
      $expr: { $lte: ['$quantity', '$lowStockThreshold'] },
      quantity: { $gt: 0 }
    }).sort('quantity'),

    // Out of stock products
    Product.find({
      isActive: true,
      quantity: 0
    }).sort('name'),

    // Potentially overstocked products (quantity > 100 and no sales in last 30 days)
    Product.aggregate([
      {
        $match: {
          isActive: true,
          quantity: { $gt: 100 }
        }
      },
      {
        $lookup: {
          from: 'sales',
          let: { productId: '$_id' },
          pipeline: [
            { $unwind: '$products' },
            {
              $match: {
                $expr: { $eq: ['$products.productId', '$$productId'] },
                createdAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }
              }
            }
          ],
          as: 'recentSales'
        }
      },
      {
        $match: {
          recentSales: { $size: 0 }
        }
      },
      {
        $project: {
          name: 1,
          category: 1,
          quantity: 1,
          sellPrice: 1,
          inventoryValue: { $multiply: ['$sellPrice', '$quantity'] }
        }
      },
      { $sort: { inventoryValue: -1 } }
    ]),

    // Category insights
    Product.aggregate([
      { $match: { isActive: true } },
      {
        $group: {
          _id: '$category',
          totalProducts: { $sum: 1 },
          totalQuantity: { $sum: '$quantity' },
          totalValue: { $sum: { $multiply: ['$sellPrice', '$quantity'] } },
          averagePrice: { $avg: '$sellPrice' },
          lowStockCount: {
            $sum: {
              $cond: [{ $lte: ['$quantity', '$lowStockThreshold'] }, 1, 0]
            }
          }
        }
      },
      { $sort: { totalValue: -1 } }
    ])
  ]);

  res.status(200).json({
    status: 'success',
    data: {
      alerts: {
        lowStock: lowStockProducts,
        outOfStock: outOfStockProducts,
        overstocked: overstockedProducts
      },
      categoryInsights
    }
  });
});