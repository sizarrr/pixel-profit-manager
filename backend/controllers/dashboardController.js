// backend/controllers/dashboardController.js - FIXED VERSION
import Product from "../models/Product.js";
import Sale from "../models/Sale.js";
import InventoryBatch from "../models/InventoryBatch.js";
import { catchAsync } from "../middleware/errorHandler.js";

// Get comprehensive dashboard overview - FIXED
export const getDashboardOverview = catchAsync(async (req, res, next) => {
  console.log("🔍 Dashboard Overview - Starting data aggregation...");

  const { startDate, endDate } = req.query;

  // Default to current month if no dates provided
  const start = startDate
    ? new Date(startDate)
    : new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  const end = endDate ? new Date(endDate) : new Date();

  // Get today's date for today's stats
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  console.log("📅 Date range:", { start, end, today, tomorrow });

  try {
    // Parallel execution of all dashboard queries with better error handling
    const [
      productStats,
      salesStats,
      todayStats,
      lowStockProducts,
      recentSales,
      topProducts,
      categoryDistribution,
      monthlySalesData,
    ] = await Promise.allSettled([
      // Product statistics - FIXED
      Product.aggregate([
        { $match: { isActive: { $ne: false } } }, // Handle both true and undefined
        {
          $group: {
            _id: null,
            totalProducts: { $sum: 1 },
            totalInventoryValue: {
              $sum: {
                $multiply: [
                  { $ifNull: ["$sellPrice", 0] },
                  { $ifNull: ["$quantity", 0] },
                ],
              },
            },
            totalQuantity: { $sum: { $ifNull: ["$quantity", 0] } },
            averagePrice: { $avg: { $ifNull: ["$sellPrice", 0] } },
            lowStockCount: {
              $sum: {
                $cond: [
                  {
                    $lte: [
                      { $ifNull: ["$quantity", 0] },
                      { $ifNull: ["$lowStockThreshold", 5] },
                    ],
                  },
                  1,
                  0,
                ],
              },
            },
          },
        },
      ]).catch((err) => {
        console.error("❌ Product stats aggregation error:", err);
        return [
          {
            totalProducts: 0,
            totalInventoryValue: 0,
            totalQuantity: 0,
            averagePrice: 0,
            lowStockCount: 0,
          },
        ];
      }),

      // Sales statistics for the period - FIXED
      Sale.aggregate([
        {
          $match: {
            createdAt: { $gte: start, $lte: end },
          },
        },
        {
          $group: {
            _id: null,
            totalSales: { $sum: 1 },
            totalRevenue: { $sum: { $ifNull: ["$totalAmount", 0] } },
            averageSale: { $avg: { $ifNull: ["$totalAmount", 0] } },
            totalItemsSold: {
              $sum: {
                $reduce: {
                  input: { $ifNull: ["$products", []] },
                  initialValue: 0,
                  in: {
                    $add: ["$$value", { $ifNull: ["$$this.quantity", 0] }],
                  },
                },
              },
            },
          },
        },
      ]).catch((err) => {
        console.error("❌ Sales stats aggregation error:", err);
        return [
          { totalSales: 0, totalRevenue: 0, averageSale: 0, totalItemsSold: 0 },
        ];
      }),

      // Today's statistics - FIXED
      Sale.aggregate([
        {
          $match: {
            createdAt: { $gte: today, $lt: tomorrow },
          },
        },
        {
          $group: {
            _id: null,
            todaySales: { $sum: 1 },
            todayRevenue: { $sum: { $ifNull: ["$totalAmount", 0] } },
          },
        },
      ]).catch((err) => {
        console.error("❌ Today stats aggregation error:", err);
        return [{ todaySales: 0, todayRevenue: 0 }];
      }),

      // Low stock products - FIXED
      Product.find({
        isActive: { $ne: false },
        $expr: {
          $lte: [
            { $ifNull: ["$quantity", 0] },
            { $ifNull: ["$lowStockThreshold", 5] },
          ],
        },
      })
        .sort("quantity")
        .limit(10)
        .lean()
        .catch((err) => {
          console.error("❌ Low stock products error:", err);
          return [];
        }),

      // Recent sales - FIXED
      Sale.find()
        .sort("-createdAt")
        .limit(5)
        .lean()
        .catch((err) => {
          console.error("❌ Recent sales error:", err);
          return [];
        }),

      // Top selling products (last 30 days) - FIXED
      Sale.aggregate([
        {
          $match: {
            createdAt: {
              $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
            },
          },
        },
        { $unwind: { path: "$products", preserveNullAndEmptyArrays: true } },
        {
          $group: {
            _id: "$products.productId",
            productName: {
              $first: { $ifNull: ["$products.productName", "Unknown Product"] },
            },
            totalQuantitySold: { $sum: { $ifNull: ["$products.quantity", 0] } },
            totalRevenue: { $sum: { $ifNull: ["$products.total", 0] } },
          },
        },
        { $sort: { totalQuantitySold: -1 } },
        { $limit: 5 },
      ]).catch((err) => {
        console.error("❌ Top products aggregation error:", err);
        return [];
      }),

      // Category distribution - FIXED
      Product.aggregate([
        { $match: { isActive: { $ne: false } } },
        {
          $group: {
            _id: { $ifNull: ["$category", "Uncategorized"] },
            count: { $sum: 1 },
            totalValue: {
              $sum: {
                $multiply: [
                  { $ifNull: ["$sellPrice", 0] },
                  { $ifNull: ["$quantity", 0] },
                ],
              },
            },
            totalQuantity: { $sum: { $ifNull: ["$quantity", 0] } },
          },
        },
        { $sort: { count: -1 } },
      ]).catch((err) => {
        console.error("❌ Category distribution error:", err);
        return [];
      }),

      // Monthly sales data (last 12 months) - FIXED
      Sale.aggregate([
        {
          $match: {
            createdAt: {
              $gte: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000),
            },
          },
        },
        {
          $group: {
            _id: {
              year: { $year: "$createdAt" },
              month: { $month: "$createdAt" },
            },
            sales: { $sum: 1 },
            revenue: { $sum: { $ifNull: ["$totalAmount", 0] } },
          },
        },
        { $sort: { "_id.year": 1, "_id.month": 1 } },
        { $limit: 12 },
      ]).catch((err) => {
        console.error("❌ Monthly sales data error:", err);
        return [];
      }),
    ]);

    console.log("📊 Aggregation results status:", {
      productStats: productStats.status,
      salesStats: salesStats.status,
      todayStats: todayStats.status,
      lowStockProducts: lowStockProducts.status,
      recentSales: recentSales.status,
      topProducts: topProducts.status,
      categoryDistribution: categoryDistribution.status,
      monthlySalesData: monthlySalesData.status,
    });

    // Extract values from Promise.allSettled results
    const getSettledValue = (result, defaultValue = []) => {
      if (result.status === "fulfilled") {
        return Array.isArray(result.value) ? result.value : [result.value];
      }
      console.warn("⚠️ Promise rejected:", result.reason);
      return Array.isArray(defaultValue) ? defaultValue : [defaultValue];
    };

    // Calculate profit data with error handling
    let profitData = [{ totalProfit: 0, totalRevenue: 0 }];

    try {
      const profitAggregation = await Sale.aggregate([
        {
          $match: {
            createdAt: { $gte: start, $lte: end },
          },
        },
        { $unwind: { path: "$products", preserveNullAndEmptyArrays: true } },
        {
          $addFields: {
            // Use totalProfit if available, otherwise estimate from price difference
            itemProfit: {
              $cond: {
                if: { $ifNull: ["$products.totalProfit", false] },
                then: "$products.totalProfit",
                else: {
                  $subtract: [
                    { $ifNull: ["$products.total", 0] },
                    {
                      $multiply: [
                        { $ifNull: ["$products.quantity", 0] },
                        10, // Default estimated cost - you might want to join with Product here
                      ],
                    },
                  ],
                },
              },
            },
          },
        },
        {
          $group: {
            _id: null,
            totalProfit: { $sum: "$itemProfit" },
            totalRevenue: { $sum: { $ifNull: ["$products.total", 0] } },
          },
        },
      ]);

      if (profitAggregation && profitAggregation.length > 0) {
        profitData = profitAggregation;
      }
    } catch (profitError) {
      console.error("❌ Profit calculation error:", profitError);
    }

    // Format the response with safe data extraction
    const overview = {
      products: getSettledValue(productStats, {
        totalProducts: 0,
        totalInventoryValue: 0,
        totalQuantity: 0,
        averagePrice: 0,
        lowStockCount: 0,
      })[0],
      sales: {
        period: {
          startDate: start,
          endDate: end,
          ...getSettledValue(salesStats, {
            totalSales: 0,
            totalRevenue: 0,
            averageSale: 0,
            totalItemsSold: 0,
          })[0],
        },
        today: getSettledValue(todayStats, {
          todaySales: 0,
          todayRevenue: 0,
        })[0],
      },
      profit: profitData[0] || { totalProfit: 0, totalRevenue: 0 },
      lowStockProducts: getSettledValue(lowStockProducts, []),
      recentSales: getSettledValue(recentSales, []),
      topProducts: getSettledValue(topProducts, []),
      categoryDistribution: getSettledValue(categoryDistribution, []),
      monthlySalesData: getSettledValue(monthlySalesData, []).map((item) => ({
        month: `${item._id?.year || new Date().getFullYear()}-${String(
          item._id?.month || 1
        ).padStart(2, "0")}`,
        sales: item.sales || 0,
        revenue: item.revenue || 0,
      })),
    };

    // Add profit margin calculation with safe division
    const totalRevenue = overview.profit.totalRevenue || 0;
    const totalProfit = overview.profit.totalProfit || 0;

    if (totalRevenue > 0) {
      overview.profit.profitMargin = (totalProfit / totalRevenue) * 100;
    } else {
      overview.profit.profitMargin = 0;
    }

    console.log("✅ Dashboard overview compiled successfully");
    console.log("📈 Overview summary:", {
      totalProducts: overview.products.totalProducts,
      totalSales: overview.sales.period.totalSales,
      totalRevenue: overview.sales.period.totalRevenue,
      totalProfit: overview.profit.totalProfit,
      lowStockCount: overview.products.lowStockCount,
    });

    res.status(200).json({
      status: "success",
      data: overview,
    });
  } catch (error) {
    console.error("❌ Dashboard Overview Error:", error);
    console.error("Error stack:", error.stack);

    // Return safe fallback data instead of throwing error
    const fallbackOverview = {
      products: {
        totalProducts: 0,
        totalInventoryValue: 0,
        totalQuantity: 0,
        averagePrice: 0,
        lowStockCount: 0,
      },
      sales: {
        period: {
          startDate: start,
          endDate: end,
          totalSales: 0,
          totalRevenue: 0,
          averageSale: 0,
          totalItemsSold: 0,
        },
        today: {
          todaySales: 0,
          todayRevenue: 0,
        },
      },
      profit: {
        totalProfit: 0,
        totalRevenue: 0,
        profitMargin: 0,
      },
      lowStockProducts: [],
      recentSales: [],
      topProducts: [],
      categoryDistribution: [],
      monthlySalesData: [],
    };

    res.status(200).json({
      status: "success",
      data: fallbackOverview,
      warning: "Some dashboard data could not be loaded",
    });
  }
});

// Get sales analytics for charts - FIXED
export const getSalesAnalytics = catchAsync(async (req, res, next) => {
  const { period = "30d", groupBy = "day" } = req.query;

  // Calculate date range based on period
  let startDate;
  const endDate = new Date();

  switch (period) {
    case "7d":
      startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      break;
    case "30d":
      startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      break;
    case "90d":
      startDate = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
      break;
    case "1y":
      startDate = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000);
      break;
    default:
      startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  }

  // Set grouping format based on groupBy parameter
  let groupFormat;
  switch (groupBy) {
    case "hour":
      groupFormat = {
        $dateToString: { format: "%Y-%m-%d %H:00", date: "$createdAt" },
      };
      break;
    case "day":
      groupFormat = {
        $dateToString: { format: "%Y-%m-%d", date: "$createdAt" },
      };
      break;
    case "week":
      groupFormat = {
        $dateToString: {
          format: "%Y-W%V",
          date: "$createdAt",
        },
      };
      break;
    case "month":
      groupFormat = { $dateToString: { format: "%Y-%m", date: "$createdAt" } };
      break;
    default:
      groupFormat = {
        $dateToString: { format: "%Y-%m-%d", date: "$createdAt" },
      };
  }

  try {
    const analyticsData = await Sale.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate, $lte: endDate },
        },
      },
      {
        $group: {
          _id: groupFormat,
          sales: { $sum: 1 },
          revenue: { $sum: { $ifNull: ["$totalAmount", 0] } },
          itemsSold: {
            $sum: {
              $reduce: {
                input: { $ifNull: ["$products", []] },
                initialValue: 0,
                in: { $add: ["$$value", { $ifNull: ["$$this.quantity", 0] }] },
              },
            },
          },
          averageSale: { $avg: { $ifNull: ["$totalAmount", 0] } },
        },
      },
      {
        $sort: { _id: 1 },
      },
    ]);

    res.status(200).json({
      status: "success",
      data: {
        period: {
          startDate,
          endDate,
          groupBy,
        },
        analytics: analyticsData || [],
      },
    });
  } catch (error) {
    console.error("❌ Sales Analytics Error:", error);

    res.status(200).json({
      status: "success",
      data: {
        period: {
          startDate,
          endDate,
          groupBy,
        },
        analytics: [],
      },
      warning: "Analytics data could not be loaded",
    });
  }
});

// Get inventory alerts and insights - FIXED
export const getInventoryInsights = catchAsync(async (req, res, next) => {
  try {
    const [
      lowStockProducts,
      outOfStockProducts,
      overstockedProducts,
      categoryInsights,
    ] = await Promise.allSettled([
      // Low stock products
      Product.find({
        isActive: { $ne: false },
        $expr: {
          $and: [
            {
              $lte: [
                { $ifNull: ["$quantity", 0] },
                { $ifNull: ["$lowStockThreshold", 5] },
              ],
            },
            { $gt: [{ $ifNull: ["$quantity", 0] }, 0] },
          ],
        },
      })
        .sort("quantity")
        .lean(),

      // Out of stock products
      Product.find({
        isActive: { $ne: false },
        $or: [{ quantity: 0 }, { quantity: { $exists: false } }],
      })
        .sort("name")
        .lean(),

      // Potentially overstocked products
      Product.aggregate([
        {
          $match: {
            isActive: { $ne: false },
            quantity: { $gt: 100 },
          },
        },
        {
          $lookup: {
            from: "sales",
            let: { productId: "$_id" },
            pipeline: [
              {
                $unwind: {
                  path: "$products",
                  preserveNullAndEmptyArrays: true,
                },
              },
              {
                $match: {
                  $expr: {
                    $eq: [
                      {
                        $toObjectId: {
                          $ifNull: [
                            "$products.productId",
                            "000000000000000000000000",
                          ],
                        },
                      },
                      "$$productId",
                    ],
                  },
                  createdAt: {
                    $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
                  },
                },
              },
            ],
            as: "recentSales",
          },
        },
        {
          $match: {
            recentSales: { $size: 0 },
          },
        },
        {
          $project: {
            name: 1,
            category: { $ifNull: ["$category", "Uncategorized"] },
            quantity: { $ifNull: ["$quantity", 0] },
            sellPrice: { $ifNull: ["$sellPrice", 0] },
            inventoryValue: {
              $multiply: [
                { $ifNull: ["$sellPrice", 0] },
                { $ifNull: ["$quantity", 0] },
              ],
            },
          },
        },
        { $sort: { inventoryValue: -1 } },
      ]),

      // Category insights
      Product.aggregate([
        { $match: { isActive: { $ne: false } } },
        {
          $group: {
            _id: { $ifNull: ["$category", "Uncategorized"] },
            totalProducts: { $sum: 1 },
            totalQuantity: { $sum: { $ifNull: ["$quantity", 0] } },
            totalValue: {
              $sum: {
                $multiply: [
                  { $ifNull: ["$sellPrice", 0] },
                  { $ifNull: ["$quantity", 0] },
                ],
              },
            },
            averagePrice: { $avg: { $ifNull: ["$sellPrice", 0] } },
            lowStockCount: {
              $sum: {
                $cond: [
                  {
                    $lte: [
                      { $ifNull: ["$quantity", 0] },
                      { $ifNull: ["$lowStockThreshold", 5] },
                    ],
                  },
                  1,
                  0,
                ],
              },
            },
          },
        },
        { $sort: { totalValue: -1 } },
      ]),
    ]);

    // Extract values from Promise.allSettled results
    const getSettledValue = (result, defaultValue = []) => {
      if (result.status === "fulfilled") {
        return result.value || defaultValue;
      }
      console.warn("⚠️ Inventory insight promise rejected:", result.reason);
      return defaultValue;
    };

    res.status(200).json({
      status: "success",
      data: {
        alerts: {
          lowStock: getSettledValue(lowStockProducts, []),
          outOfStock: getSettledValue(outOfStockProducts, []),
          overstocked: getSettledValue(overstockedProducts, []),
        },
        categoryInsights: getSettledValue(categoryInsights, []),
      },
    });
  } catch (error) {
    console.error("❌ Inventory Insights Error:", error);

    res.status(200).json({
      status: "success",
      data: {
        alerts: {
          lowStock: [],
          outOfStock: [],
          overstocked: [],
        },
        categoryInsights: [],
      },
      warning: "Some inventory insights could not be loaded",
    });
  }
});
