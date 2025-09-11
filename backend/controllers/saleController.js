import Sale from "../models/Sale.js";
import Product from "../models/Product.js";
import InventoryBatch from "../models/InventoryBatch.js";
import { catchAsync, AppError } from "../middleware/errorHandler.js";
import config from "../config/config.js";
import mongoose from "mongoose";

// Get all sales with filtering, sorting, and pagination
export const getAllSales = catchAsync(async (req, res, next) => {
  const {
    page = 1,
    limit = config.defaultPageSize,
    startDate,
    endDate,
    cashier,
    sort = "-createdAt",
  } = req.query;

  // Build filter object
  const filter = {};

  if (startDate || endDate) {
    filter.createdAt = {};
    if (startDate) filter.createdAt.$gte = new Date(startDate);
    if (endDate) filter.createdAt.$lte = new Date(endDate);
  }

  if (cashier) {
    filter.cashierName = new RegExp(cashier, "i");
  }

  // Calculate pagination
  const skip = (page - 1) * limit;
  const limitNum = Math.min(limit, config.maxPageSize);

  // Execute query
  const sales = await Sale.find(filter)
    .sort(sort)
    .skip(skip)
    .limit(limitNum)
    .lean();

  // Get total count for pagination
  const total = await Sale.countDocuments(filter);
  const totalPages = Math.ceil(total / limitNum);

  res.status(200).json({
    status: "success",
    results: sales.length,
    pagination: {
      currentPage: parseInt(page),
      totalPages,
      totalItems: total,
      itemsPerPage: limitNum,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1,
    },
    data: {
      sales,
    },
  });
});

// Get single sale by ID
export const getSale = catchAsync(async (req, res, next) => {
  const sale = await Sale.findById(req.params.id).populate(
    "products.batchAllocations.batchId",
    "batchNumber purchaseDate"
  );

  if (!sale) {
    return next(new AppError("Sale not found", 404));
  }

  res.status(200).json({
    status: "success",
    data: {
      sale,
    },
  });
});

// Create new sale with FIFO allocation
export const createSale = catchAsync(async (req, res, next) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const {
      products,
      cashierName,
      customerName,
      customerPhone,
      paymentMethod = "cash",
      taxRate = 0,
      discountAmount = 0,
      notes,
    } = req.body;

    // Validate required fields
    if (!products || !Array.isArray(products) || products.length === 0) {
      throw new AppError("At least one product is required", 400);
    }

    if (!cashierName || cashierName.trim() === "") {
      throw new AppError("Cashier name is required", 400);
    }

    let subtotal = 0;
    let totalCost = 0;
    let totalProfit = 0;
    const processedProducts = [];

    // Process each product with FIFO allocation
    for (const item of products) {
      // Validate product data
      if (!item.productId) {
        throw new AppError("Product ID is required", 400);
      }

      if (!item.quantity || item.quantity <= 0) {
        throw new AppError("Valid quantity is required", 400);
      }

      // Get product details
      const product = await Product.findById(item.productId).session(session);

      if (!product) {
        throw new AppError(`Product not found: ${item.productId}`, 404);
      }

      if (!product.isActive) {
        throw new AppError(`Product is not active: ${product.name}`, 400);
      }

      // Get available batches in FIFO order (oldest first)
      const availableBatches = await InventoryBatch.find({
        productId: item.productId,
        status: "active",
        remainingQuantity: { $gt: 0 },
      })
        .sort({ purchaseDate: 1, createdAt: 1 }) // FIFO: oldest first
        .session(session);

      // Calculate total available quantity
      const totalAvailable = availableBatches.reduce(
        (sum, batch) => sum + batch.remainingQuantity,
        0
      );

      // Check if we have enough inventory
      if (totalAvailable < item.quantity) {
        throw new AppError(
          `Insufficient stock for ${product.name}. Available: ${totalAvailable}, Requested: ${item.quantity}`,
          400
        );
      }

      // FIFO allocation
      const batchAllocations = [];
      let remainingToAllocate = item.quantity;
      let itemCost = 0;
      let itemPrice = 0;

      for (const batch of availableBatches) {
        if (remainingToAllocate <= 0) break;

        const allocateFromBatch = Math.min(
          remainingToAllocate,
          batch.remainingQuantity
        );

        // Calculate costs for this allocation
        const allocationCost = batch.buyPrice * allocateFromBatch;
        const allocationPrice = batch.sellPrice * allocateFromBatch;
        const allocationProfit = allocationPrice - allocationCost;

        // Record the allocation
        batchAllocations.push({
          batchId: batch._id,
          batchNumber: batch.batchNumber,
          quantity: allocateFromBatch,
          buyPrice: batch.buyPrice,
          sellPrice: batch.sellPrice,
          profit: allocationProfit,
        });

        // Update batch remaining quantity
        batch.remainingQuantity -= allocateFromBatch;

        // Update batch status if depleted
        if (batch.remainingQuantity === 0) {
          batch.status = "depleted";
        }

        await batch.save({ session });

        // Add to totals
        itemCost += allocationCost;
        itemPrice += allocationPrice;
        remainingToAllocate -= allocateFromBatch;
      }

      // Verify all quantity was allocated
      if (remainingToAllocate > 0) {
        throw new AppError(
          `Failed to allocate full quantity for ${product.name}`,
          500
        );
      }

      const itemProfit = itemPrice - itemCost;

      // Add to processed products
      processedProducts.push({
        productId: item.productId,
        productName: product.name,
        quantity: item.quantity,
        batchAllocations,
        totalCost: itemCost,
        totalPrice: itemPrice,
        totalProfit: itemProfit,
      });

      subtotal += itemPrice;
      totalCost += itemCost;
      totalProfit += itemProfit;

      // Update product total quantity from remaining batches
      await product.updateFromBatches();
    }

    // Calculate final amounts with tax and discount
    const taxAmount = (subtotal - discountAmount) * (taxRate / 100);
    const totalAmount = subtotal - discountAmount + taxAmount;
    const finalProfit = totalProfit - discountAmount;

    // Generate receipt number
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    const salesCount = await Sale.countDocuments({
      createdAt: {
        $gte: new Date(date.setHours(0, 0, 0, 0)),
        $lt: new Date(date.setHours(23, 59, 59, 999)),
      },
    });
    const receiptNumber = `RCP-${year}${month}${day}-${String(
      salesCount + 1
    ).padStart(4, "0")}`;

    // Create sale record
    const sale = new Sale({
      receiptNumber,
      products: processedProducts,
      subtotal,
      taxRate,
      taxAmount,
      discountAmount,
      totalAmount,
      totalCost,
      totalProfit: finalProfit,
      cashierName: cashierName.trim(),
      customerName: customerName?.trim(),
      customerPhone: customerPhone?.trim(),
      paymentMethod,
      notes: notes?.trim(),
      status: "completed",
    });

    await sale.save({ session });
    await session.commitTransaction();

    // Populate batch details for response
    const populatedSale = await Sale.findById(sale._id).populate(
      "products.batchAllocations.batchId",
      "batchNumber purchaseDate"
    );

    res.status(201).json({
      status: "success",
      data: {
        sale: populatedSale,
        summary: {
          itemsSold: processedProducts.reduce((sum, p) => sum + p.quantity, 0),
          totalRevenue: totalAmount,
          totalCost: totalCost,
          totalProfit: finalProfit,
          profitMargin:
            totalAmount > 0
              ? ((finalProfit / totalAmount) * 100).toFixed(2)
              : 0,
        },
      },
    });
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
});

// Get recent sales
export const getRecentSales = catchAsync(async (req, res, next) => {
  const { limit = 10 } = req.query;

  const sales = await Sale.find()
    .sort("-createdAt")
    .limit(parseInt(limit))
    .lean();

  res.status(200).json({
    status: "success",
    results: sales.length,
    data: {
      sales,
    },
  });
});

// Get sales statistics with FIFO profit calculations
export const getSalesStats = catchAsync(async (req, res, next) => {
  const { startDate, endDate } = req.query;

  // Default to current month if no dates provided
  const start = startDate
    ? new Date(startDate)
    : new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  const end = endDate ? new Date(endDate) : new Date();

  const stats = await Sale.aggregate([
    {
      $match: {
        createdAt: { $gte: start, $lte: end },
        status: "completed",
      },
    },
    {
      $group: {
        _id: null,
        totalSales: { $sum: 1 },
        totalRevenue: { $sum: "$totalAmount" },
        totalCost: { $sum: "$totalCost" },
        totalProfit: { $sum: "$totalProfit" },
        averageSale: { $avg: "$totalAmount" },
        averageProfit: { $avg: "$totalProfit" },
        totalItemsSold: {
          $sum: {
            $reduce: {
              input: "$products",
              initialValue: 0,
              in: { $add: ["$$value", "$$this.quantity"] },
            },
          },
        },
      },
    },
  ]);

  // Get today's sales
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const todayStats = await Sale.aggregate([
    {
      $match: {
        createdAt: { $gte: today, $lt: tomorrow },
        status: "completed",
      },
    },
    {
      $group: {
        _id: null,
        todaySales: { $sum: 1 },
        todayRevenue: { $sum: "$totalAmount" },
        todayProfit: { $sum: "$totalProfit" },
      },
    },
  ]);

  const periodStats = stats[0] || {
    totalSales: 0,
    totalRevenue: 0,
    totalCost: 0,
    totalProfit: 0,
    averageSale: 0,
    averageProfit: 0,
    totalItemsSold: 0,
  };

  const todayData = todayStats[0] || {
    todaySales: 0,
    todayRevenue: 0,
    todayProfit: 0,
  };

  res.status(200).json({
    status: "success",
    data: {
      period: {
        startDate: start,
        endDate: end,
        ...periodStats,
        profitMargin:
          periodStats.totalRevenue > 0
            ? (
                (periodStats.totalProfit / periodStats.totalRevenue) *
                100
              ).toFixed(2)
            : 0,
      },
      today: todayData,
    },
  });
});

// Get sales by date range with FIFO profit analysis
export const getSalesByDateRange = catchAsync(async (req, res, next) => {
  const { startDate, endDate, groupBy = "day" } = req.query;

  const start = startDate
    ? new Date(startDate)
    : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const end = endDate ? new Date(endDate) : new Date();

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
    case "month":
      groupFormat = { $dateToString: { format: "%Y-%m", date: "$createdAt" } };
      break;
    case "year":
      groupFormat = { $dateToString: { format: "%Y", date: "$createdAt" } };
      break;
    default:
      groupFormat = {
        $dateToString: { format: "%Y-%m-%d", date: "$createdAt" },
      };
  }

  const salesData = await Sale.aggregate([
    {
      $match: {
        createdAt: { $gte: start, $lte: end },
        status: "completed",
      },
    },
    {
      $group: {
        _id: groupFormat,
        sales: { $sum: 1 },
        revenue: { $sum: "$totalAmount" },
        cost: { $sum: "$totalCost" },
        profit: { $sum: "$totalProfit" },
        itemsSold: {
          $sum: {
            $reduce: {
              input: "$products",
              initialValue: 0,
              in: { $add: ["$$value", "$$this.quantity"] },
            },
          },
        },
      },
    },
    {
      $sort: { _id: 1 },
    },
  ]);

  res.status(200).json({
    status: "success",
    results: salesData.length,
    data: {
      salesData,
    },
  });
});

// Get top selling products based on FIFO data
export const getTopSellingProducts = catchAsync(async (req, res, next) => {
  const { limit = 10, startDate, endDate } = req.query;

  const matchStage = { status: "completed" };
  if (startDate || endDate) {
    matchStage.createdAt = {};
    if (startDate) matchStage.createdAt.$gte = new Date(startDate);
    if (endDate) matchStage.createdAt.$lte = new Date(endDate);
  }

  const topProducts = await Sale.aggregate([
    { $match: matchStage },
    { $unwind: "$products" },
    {
      $group: {
        _id: "$products.productId",
        productName: { $first: "$products.productName" },
        totalQuantitySold: { $sum: "$products.quantity" },
        totalRevenue: { $sum: "$products.totalPrice" },
        totalCost: { $sum: "$products.totalCost" },
        totalProfit: { $sum: "$products.totalProfit" },
        salesCount: { $sum: 1 },
      },
    },
    {
      $addFields: {
        profitMargin: {
          $cond: {
            if: { $gt: ["$totalRevenue", 0] },
            then: {
              $multiply: [{ $divide: ["$totalProfit", "$totalRevenue"] }, 100],
            },
            else: 0,
          },
        },
      },
    },
    { $sort: { totalQuantitySold: -1 } },
    { $limit: parseInt(limit) },
  ]);

  res.status(200).json({
    status: "success",
    results: topProducts.length,
    data: {
      topProducts,
    },
  });
});

// Get sales profit analysis using FIFO batch costs
export const getSalesProfit = catchAsync(async (req, res, next) => {
  const { startDate, endDate } = req.query;

  const matchStage = { status: "completed" };
  if (startDate || endDate) {
    matchStage.createdAt = {};
    if (startDate) matchStage.createdAt.$gte = new Date(startDate);
    if (endDate) matchStage.createdAt.$lte = new Date(endDate);
  }

  const profitData = await Sale.aggregate([
    { $match: matchStage },
    {
      $group: {
        _id: null,
        totalRevenue: { $sum: "$totalAmount" },
        totalCost: { $sum: "$totalCost" },
        totalProfit: { $sum: "$totalProfit" },
        totalSales: { $sum: 1 },
        averageProfit: { $avg: "$totalProfit" },
        averageProfitMargin: {
          $avg: {
            $cond: {
              if: { $gt: ["$totalAmount", 0] },
              then: {
                $multiply: [{ $divide: ["$totalProfit", "$totalAmount"] }, 100],
              },
              else: 0,
            },
          },
        },
      },
    },
  ]);

  const result = profitData[0] || {
    totalRevenue: 0,
    totalCost: 0,
    totalProfit: 0,
    totalSales: 0,
    averageProfit: 0,
    averageProfitMargin: 0,
  };

  // Add overall profit margin
  result.overallProfitMargin =
    result.totalRevenue > 0
      ? ((result.totalProfit / result.totalRevenue) * 100).toFixed(2)
      : 0;

  res.status(200).json({
    status: "success",
    data: result,
  });
});

// Process refund with FIFO batch restoration
export const processSaleRefund = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  const { refundItems, refundReason } = req.body;

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const sale = await Sale.findById(id).session(session);

    if (!sale) {
      throw new AppError("Sale not found", 404);
    }

    if (sale.status !== "completed") {
      throw new AppError("Can only refund completed sales", 400);
    }

    // Process refund for each item
    for (const refundItem of refundItems) {
      const saleProduct = sale.products.find(
        (p) => p.productId.toString() === refundItem.productId
      );

      if (!saleProduct) {
        throw new AppError(
          `Product not found in sale: ${refundItem.productId}`,
          400
        );
      }

      if (refundItem.quantity > saleProduct.quantity) {
        throw new AppError(
          `Cannot refund more than purchased quantity for product ${saleProduct.productName}`,
          400
        );
      }

      // Restore inventory to the original batches (reverse FIFO)
      let remainingToRestore = refundItem.quantity;

      // Process batch allocations in reverse order (newest allocations first)
      for (
        let i = saleProduct.batchAllocations.length - 1;
        i >= 0 && remainingToRestore > 0;
        i--
      ) {
        const allocation = saleProduct.batchAllocations[i];
        const batch = await InventoryBatch.findById(allocation.batchId).session(
          session
        );

        if (batch) {
          const restoreQuantity = Math.min(
            remainingToRestore,
            allocation.quantity
          );
          batch.remainingQuantity += restoreQuantity;

          if (batch.status === "depleted" && batch.remainingQuantity > 0) {
            batch.status = "active";
          }

          await batch.save({ session });
          remainingToRestore -= restoreQuantity;
        }
      }

      // Update product quantity
      const product = await Product.findById(refundItem.productId).session(
        session
      );
      if (product) {
        await product.updateFromBatches();
      }
    }

    // Update sale status
    sale.status = "refunded";
    sale.refundReason = refundReason;
    sale.refundDate = new Date();
    await sale.save({ session });

    await session.commitTransaction();

    res.status(200).json({
      status: "success",
      message: "Refund processed successfully",
      data: {
        sale,
      },
    });
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
});

// Get batch allocation details for a sale
export const getSaleBatchDetails = catchAsync(async (req, res, next) => {
  const { id } = req.params;

  const sale = await Sale.findById(id).populate({
    path: "products.batchAllocations.batchId",
    select: "batchNumber purchaseDate supplierName buyPrice sellPrice",
  });

  if (!sale) {
    return next(new AppError("Sale not found", 404));
  }

  // Calculate detailed profit breakdown
  const profitBreakdown = sale.products.map((product) => ({
    productName: product.productName,
    quantity: product.quantity,
    totalRevenue: product.totalPrice,
    totalCost: product.totalCost,
    totalProfit: product.totalProfit,
    profitMargin:
      product.totalPrice > 0
        ? ((product.totalProfit / product.totalPrice) * 100).toFixed(2)
        : 0,
    batchDetails: product.batchAllocations.map((allocation) => ({
      batchNumber: allocation.batchId?.batchNumber,
      quantity: allocation.quantity,
      buyPrice: allocation.buyPrice,
      sellPrice: allocation.sellPrice,
      profit: allocation.profit,
      supplier: allocation.batchId?.supplierName,
      purchaseDate: allocation.batchId?.purchaseDate,
    })),
  }));

  res.status(200).json({
    status: "success",
    data: {
      sale,
      profitBreakdown,
    },
  });
});

export default {
  getAllSales,
  getSale,
  createSale,
  getRecentSales,
  getSalesStats,
  getSalesByDateRange,
  getTopSellingProducts,
  getSalesProfit,
  processSaleRefund,
  getSaleBatchDetails,
};
