// backend/controllers/dashboardController.js - FIXED VERSION WITH ROBUST PROFIT CALCULATION
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

    // ROBUST PROFIT CALCULATION - Handle both FIFO and non-FIFO sales
    let profitData = { totalProfit: 0, totalRevenue: 0 };

    try {
      console.log("💰 Starting profit calculation...");

      // First, check if we have any sales with FIFO data
      const salesWithFIFO = await Sale.findOne({
        totalProfit: { $exists: true },
      });
      const hasFIFOData = salesWithFIFO !== null;

      console.log("📊 FIFO data available:", hasFIFOData);

      if (hasFIFOData) {
        // Use FIFO profit data if available
        const fifoProfit = await Sale.aggregate([
          {
            $match: {
              createdAt: { $gte: start, $lte: end },
              totalProfit: { $exists: true },
            },
          },
          {
            $group: {
              _id: null,
              totalProfit: {
                $sum: {
                  $cond: [{ $ne: ["$totalProfit", null] }, "$totalProfit", 0],
                },
              },
              totalRevenue: {
                $sum: {
                  $cond: [{ $ne: ["$totalAmount", null] }, "$totalAmount", 0],
                },
              },
            },
          },
        ]);

        if (fifoProfit && fifoProfit.length > 0) {
          profitData.totalProfit = fifoProfit[0].totalProfit || 0;
          profitData.totalRevenue = fifoProfit[0].totalRevenue || 0;
        }
      }

      // For sales without FIFO data or as a fallback, calculate estimated profit
      const estimatedProfitResult = await Sale.aggregate([
        {
          $match: {
            createdAt: { $gte: start, $lte: end },
            $or: [{ totalProfit: { $exists: false } }, { totalProfit: null }],
          },
        },
        {
          $unwind: {
            path: "$products",
            preserveNullAndEmptyArrays: false, // Skip empty products
          },
        },
        {
          $lookup: {
            from: "products",
            let: { productId: { $toObjectId: "$products.productId" } },
            pipeline: [
              {
                $match: {
                  $expr: { $eq: ["$_id", "$$productId"] },
                },
              },
              {
                $project: {
                  buyPrice: 1,
                  currentBuyPrice: 1,
                },
              },
            ],
            as: "productInfo",
          },
        },
        {
          $addFields: {
            productData: { $arrayElemAt: ["$productInfo", 0] },
            sellAmount: {
              $multiply: [
                { $toDouble: { $ifNull: ["$products.sellPrice", 0] } },
                { $toDouble: { $ifNull: ["$products.quantity", 0] } },
              ],
            },
          },
        },
        {
          $addFields: {
            // Use currentBuyPrice if available (FIFO), otherwise use buyPrice
            unitCost: {
              $cond: [
                { $ne: ["$productData.currentBuyPrice", null] },
                { $toDouble: "$productData.currentBuyPrice" },
                {
                  $cond: [
                    { $ne: ["$productData.buyPrice", null] },
                    { $toDouble: "$productData.buyPrice" },
                    {
                      $multiply: [
                        { $toDouble: { $ifNull: ["$products.sellPrice", 0] } },
                        0.7,
                      ],
                    }, // 30% margin estimate
                  ],
                },
              ],
            },
          },
        },
        {
          $addFields: {
            costAmount: {
              $multiply: [
                "$unitCost",
                { $toDouble: { $ifNull: ["$products.quantity", 0] } },
              ],
            },
            estimatedProfit: {
              $subtract: [
                "$sellAmount",
                {
                  $multiply: [
                    "$unitCost",
                    { $toDouble: { $ifNull: ["$products.quantity", 0] } },
                  ],
                },
              ],
            },
          },
        },
        {
          $group: {
            _id: null,
            estimatedProfit: {
              $sum: {
                $cond: [
                  {
                    $and: [
                      { $ne: ["$estimatedProfit", null] },
                      { $not: { $isNaN: "$estimatedProfit" } },
                    ],
                  },
                  "$estimatedProfit",
                  0,
                ],
              },
            },
            totalRevenue: {
              $sum: {
                $cond: [
                  {
                    $and: [
                      { $ne: ["$sellAmount", null] },
                      { $not: { $isNaN: "$sellAmount" } },
                    ],
                  },
                  "$sellAmount",
                  0,
                ],
              },
            },
          },
        },
      ]);

      if (estimatedProfitResult && estimatedProfitResult.length > 0) {
        const estimatedProfit = estimatedProfitResult[0].estimatedProfit || 0;
        const estimatedRevenue = estimatedProfitResult[0].totalRevenue || 0;

        profitData.totalProfit += estimatedProfit;
        profitData.totalRevenue += estimatedRevenue;

        console.log("📊 Estimated profit added:", estimatedProfit);
      }

      // Final validation to prevent NaN
      if (
        isNaN(profitData.totalProfit) ||
        profitData.totalProfit === null ||
        profitData.totalProfit === undefined
      ) {
        console.warn("⚠️ Profit calculation resulted in NaN, defaulting to 0");
        profitData.totalProfit = 0;
      }

      if (
        isNaN(profitData.totalRevenue) ||
        profitData.totalRevenue === null ||
        profitData.totalRevenue === undefined
      ) {
        console.warn("⚠️ Revenue calculation resulted in NaN, defaulting to 0");
        profitData.totalRevenue = 0;
      }

      // Round to 2 decimal places
      profitData.totalProfit = Math.round(profitData.totalProfit * 100) / 100;
      profitData.totalRevenue = Math.round(profitData.totalRevenue * 100) / 100;

      console.log("✅ Final profit data:", profitData);
    } catch (profitError) {
      console.error("❌ Profit calculation error:", profitError);
      console.error("Error details:", profitError.stack);

      // Fallback to simple revenue calculation
      try {
        const revenueOnly = await Sale.aggregate([
          {
            $match: {
              createdAt: { $gte: start, $lte: end },
            },
          },
          {
            $group: {
              _id: null,
              totalRevenue: { $sum: { $ifNull: ["$totalAmount", 0] } },
            },
          },
        ]);

        if (revenueOnly && revenueOnly.length > 0) {
          profitData.totalRevenue = revenueOnly[0].totalRevenue || 0;
          // Estimate 20% profit margin as fallback
          profitData.totalProfit = profitData.totalRevenue * 0.2;
        }
      } catch (revenueError) {
        console.error("❌ Even revenue calculation failed:", revenueError);
      }
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
      profit: {
        totalProfit: profitData.totalProfit || 0,
        totalRevenue: profitData.totalRevenue || 0,
        profitMargin: 0,
      },
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

    // Calculate profit margin safely
    if (overview.profit.totalRevenue > 0) {
      overview.profit.profitMargin =
        Math.round(
          (overview.profit.totalProfit / overview.profit.totalRevenue) * 10000
        ) / 100;
    }

    // Final NaN check on all numeric fields
    overview.profit.totalProfit = isNaN(overview.profit.totalProfit)
      ? 0
      : overview.profit.totalProfit;
    overview.profit.totalRevenue = isNaN(overview.profit.totalRevenue)
      ? 0
      : overview.profit.totalRevenue;
    overview.profit.profitMargin = isNaN(overview.profit.profitMargin)
      ? 0
      : overview.profit.profitMargin;

    console.log("✅ Dashboard overview compiled successfully");
    console.log("📈 Overview summary:", {
      totalProducts: overview.products.totalProducts,
      totalSales: overview.sales.period.totalSales,
      totalRevenue: overview.sales.period.totalRevenue,
      totalProfit: overview.profit.totalProfit,
      profitMargin: overview.profit.profitMargin,
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
