// backend/controllers/saleController.js - FIXED VERSION
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
    "products.productId",
    "name category buyPrice"
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

// Create new sale (process transaction) with FIFO inventory management
export const createSale = catchAsync(async (req, res, next) => {
  console.log("🛒 Processing new sale:", JSON.stringify(req.body, null, 2));

  // Input validation with detailed error messages
  const {
    products: rawProducts,
    totalAmount: rawTotalAmount,
    cashierName,
    paymentMethod = "cash",
    customerName,
    notes,
  } = req.body;

  // Validate required fields
  if (!rawProducts || !Array.isArray(rawProducts) || rawProducts.length === 0) {
    console.error("❌ Missing or invalid products array");
    return next(new AppError("At least one product is required", 400));
  }

  if (!rawTotalAmount || rawTotalAmount <= 0) {
    console.error("❌ Missing or invalid total amount");
    return next(
      new AppError("Total amount is required and must be greater than 0", 400)
    );
  }

  if (!cashierName || cashierName.trim() === "") {
    console.error("❌ Missing cashier name");
    return next(new AppError("Cashier name is required", 400));
  }

  // Clean and validate input data
  const products = rawProducts.map((p, index) => {
    console.log(`📦 Processing product ${index + 1}:`, p);

    // Validate product fields
    if (!p.productId) {
      throw new AppError(`Product ${index + 1}: Product ID is required`, 400);
    }
    if (!p.productName || p.productName.trim() === "") {
      throw new AppError(`Product ${index + 1}: Product name is required`, 400);
    }
    if (!p.quantity || p.quantity <= 0) {
      throw new AppError(
        `Product ${index + 1}: Valid quantity is required`,
        400
      );
    }
    if (!p.sellPrice || p.sellPrice <= 0) {
      throw new AppError(
        `Product ${index + 1}: Valid sell price is required`,
        400
      );
    }
    if (!p.total || p.total <= 0) {
      throw new AppError(`Product ${index + 1}: Valid total is required`, 400);
    }

    return {
      productId: mongoose.Types.ObjectId.isValid(p.productId)
        ? new mongoose.Types.ObjectId(p.productId)
        : p.productId,
      productName: p.productName.trim(),
      quantity: Number(p.quantity),
      sellPrice: Number(p.sellPrice),
      total: Number(p.total),
    };
  });

  const totalAmount = Number(rawTotalAmount);
  const cleanCashierName = cashierName.trim();

  console.log("✅ Validated input data:", {
    productsCount: products.length,
    totalAmount,
    cashierName: cleanCashierName,
    paymentMethod,
  });

  const session = await mongoose.startSession();

  // Core sale processing logic
  const processSaleCore = async (activeSession) => {
    console.log("💼 Starting FIFO sale processing...");

    // Validate and process FIFO inventory allocation
    const processedProducts = [];
    const batchUpdates = [];
    let calculatedTotal = 0;

    for (const saleProduct of products) {
      console.log(`🔍 Processing product: ${saleProduct.productName}`);

      // Find the product in database
      const productQuery = Product.findById(saleProduct.productId);
      const product = activeSession
        ? await productQuery.session(activeSession)
        : await productQuery;

      if (!product || !product.isActive) {
        throw new AppError(
          `Product ${saleProduct.productName} not found or inactive`,
          404
        );
      }

      console.log(
        `📊 Product found: ${product.name}, Current stock: ${product.quantity}`
      );

      // Get available inventory batches in FIFO order (oldest first)
      let availableBatches = await InventoryBatch.find({
        productId: saleProduct.productId,
        remainingQuantity: { $gt: 0 },
        isActive: true,
      })
        .sort({ purchaseDate: 1, createdAt: 1 })
        .session(activeSession || null);

      console.log(`📦 Found ${availableBatches.length} available batches`);

      // Calculate total available quantity from batches
      let totalAvailable = availableBatches.reduce(
        (sum, batch) => sum + batch.remainingQuantity,
        0
      );

      console.log(`📊 Total available from batches: ${totalAvailable}`);

      // If no batches exist but product has quantity, create initial batch for legacy inventory
      if (totalAvailable === 0 && Number(product.quantity) > 0) {
        console.log("🔄 Creating initial batch for legacy inventory...");

        const initQty = Number(product.quantity);
        const initBatchData = {
          productId: product._id,
          buyPrice: Number(product.buyPrice) || 0,
          initialQuantity: initQty,
          remainingQuantity: initQty,
          purchaseDate: product.createdAt || new Date(),
          supplierName: "Legacy stock import",
          notes:
            "Auto-created from existing product quantity to initialize FIFO",
        };

        if (activeSession) {
          await InventoryBatch.create([initBatchData], {
            session: activeSession,
          });
        } else {
          await InventoryBatch.create(initBatchData);
        }

        // Re-fetch available batches
        availableBatches = await InventoryBatch.find({
          productId: saleProduct.productId,
          remainingQuantity: { $gt: 0 },
          isActive: true,
        })
          .sort({ purchaseDate: 1, createdAt: 1 })
          .session(activeSession || null);

        totalAvailable = availableBatches.reduce(
          (sum, batch) => sum + batch.remainingQuantity,
          0
        );

        console.log(
          `✅ Created initial batch. New total available: ${totalAvailable}`
        );
      }

      // Check if we have enough inventory
      if (totalAvailable < saleProduct.quantity) {
        console.error(
          `❌ Insufficient inventory for ${product.name}. Available: ${totalAvailable}, Requested: ${saleProduct.quantity}`
        );
        throw new AppError(
          `Insufficient stock for ${product.name}. Available: ${totalAvailable}, Requested: ${saleProduct.quantity}`,
          400
        );
      }

      // Verify price matches current product price
      if (
        Math.abs(Number(saleProduct.sellPrice) - Number(product.sellPrice)) >
        0.01
      ) {
        console.error(
          `❌ Price mismatch for ${product.name}. Expected: ${product.sellPrice}, Got: ${saleProduct.sellPrice}`
        );
        throw new AppError(
          `Price mismatch for ${product.name}. Current price: ${product.sellPrice}`,
          400
        );
      }

      // Verify item total calculation
      const expectedTotal = saleProduct.sellPrice * saleProduct.quantity;
      if (Math.abs(saleProduct.total - expectedTotal) > 0.01) {
        console.error(
          `❌ Total mismatch for ${product.name}. Expected: ${expectedTotal}, Got: ${saleProduct.total}`
        );
        throw new AppError(`Total calculation error for ${product.name}`, 400);
      }

      calculatedTotal += expectedTotal;

      // FIFO allocation logic
      console.log(
        `🔄 Starting FIFO allocation for ${saleProduct.quantity} units...`
      );
      let remainingToAllocate = saleProduct.quantity;
      const batchAllocations = [];

      for (const batch of availableBatches) {
        if (remainingToAllocate <= 0) break;

        const allocatedFromBatch = Math.min(
          remainingToAllocate,
          batch.remainingQuantity
        );

        console.log(
          `📦 Allocating ${allocatedFromBatch} units from batch ${batch.batchNumber} @ $${batch.buyPrice}`
        );

        batchAllocations.push({
          batchId: batch._id,
          quantity: allocatedFromBatch,
          buyPrice: batch.buyPrice,
          batchNumber: batch.batchNumber,
        });

        batchUpdates.push({
          batchId: batch._id,
          newRemainingQuantity: batch.remainingQuantity - allocatedFromBatch,
        });

        remainingToAllocate -= allocatedFromBatch;
      }

      console.log(
        `✅ FIFO allocation complete. ${batchAllocations.length} batches used.`
      );

      // Add batch allocation info to the sale product
      const enhancedSaleProduct = {
        ...saleProduct,
        batchAllocations,
      };

      processedProducts.push(enhancedSaleProduct);
    }

    // Verify total amount matches calculation
    if (Math.abs(Number(totalAmount) - calculatedTotal) > 0.01) {
      console.error(
        `❌ Total amount mismatch. Expected: ${calculatedTotal}, Got: ${totalAmount}`
      );
      throw new AppError("Total amount mismatch. Please recalculate.", 400);
    }

    console.log("💰 Amount verification passed");

    // Update inventory batch quantities
    console.log(`🔄 Updating ${batchUpdates.length} inventory batches...`);
    for (const update of batchUpdates) {
      const updateOptions = activeSession
        ? { session: activeSession, runValidators: true }
        : { runValidators: true };

      await InventoryBatch.findByIdAndUpdate(
        update.batchId,
        { remainingQuantity: update.newRemainingQuantity },
        updateOptions
      );
    }

    console.log("✅ Inventory batches updated");

    // Create sale record with batch allocation information
    const saleData = {
      products: processedProducts,
      totalAmount,
      cashierName: cleanCashierName,
      paymentMethod,
      customerName: customerName?.trim() || undefined,
      notes: notes?.trim() || undefined,
    };

    console.log("💾 Creating sale record...");

    let sale;
    if (activeSession) {
      const saleArray = await Sale.create([saleData], {
        session: activeSession,
      });
      sale = saleArray[0];
    } else {
      sale = await Sale.create(saleData);
    }

    console.log(
      `✅ Sale created with ID: ${sale._id}, Receipt: ${sale.receiptNumber}`
    );

    // Update product total quantities from batches (do this after transaction)
    const uniqueProductIds = [...new Set(products.map((p) => p.productId))];

    // Send successful response
    res.status(201).json({
      status: "success",
      data: {
        sale: sale,
      },
    });

    // Update product quantities asynchronously after response
    setImmediate(async () => {
      console.log("🔄 Updating product quantities from batches...");
      for (const productId of uniqueProductIds) {
        try {
          await Product.updateQuantityFromBatches(productId);
          console.log(`✅ Updated quantity for product ${productId}`);
        } catch (error) {
          console.error(
            `❌ Error updating quantity for product ${productId}:`,
            error
          );
        }
      }
      console.log("✅ All product quantities updated");
    });
  };

  // Execute with transaction support where available
  try {
    try {
      await session.withTransaction(async () => {
        await processSaleCore(session);
      });
    } catch (txError) {
      const message = String(txError?.message || "");

      // Fallback for environments without replica set / transaction support
      if (
        message.includes(
          "Transaction numbers are only allowed on a replica set member"
        ) ||
        message.includes("Transaction support is not enabled") ||
        message.includes("does not support sessions")
      ) {
        console.warn(
          "⚠️  MongoDB transactions not supported in current environment. Falling back to non-transactional processing."
        );
        await processSaleCore(null);
      } else {
        throw txError;
      }
    }
  } catch (error) {
    console.error("❌ Sale processing failed:", error);
    throw error;
  } finally {
    await session.endSession();
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

// Get sales statistics
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
      },
    },
    {
      $group: {
        _id: null,
        totalSales: { $sum: 1 },
        totalRevenue: { $sum: "$totalAmount" },
        averageSale: { $avg: "$totalAmount" },
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
      },
    },
    {
      $group: {
        _id: null,
        todaySales: { $sum: 1 },
        todayRevenue: { $sum: "$totalAmount" },
      },
    },
  ]);

  res.status(200).json({
    status: "success",
    data: {
      period: {
        startDate: start,
        endDate: end,
        ...(stats[0] || {
          totalSales: 0,
          totalRevenue: 0,
          averageSale: 0,
          totalItemsSold: 0,
        }),
      },
      today: todayStats[0] || {
        todaySales: 0,
        todayRevenue: 0,
      },
    },
  });
});

// Get sales by date range (for charts)
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
      },
    },
    {
      $group: {
        _id: groupFormat,
        sales: { $sum: 1 },
        revenue: { $sum: "$totalAmount" },
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

// Get top selling products
export const getTopSellingProducts = catchAsync(async (req, res, next) => {
  const { limit = 10, startDate, endDate } = req.query;

  const matchStage = {};
  if (startDate || endDate) {
    matchStage.createdAt = {};
    if (startDate) matchStage.createdAt.$gte = new Date(startDate);
    if (endDate) matchStage.createdAt.$lte = new Date(endDate);
  }

  const topProducts = await Sale.aggregate([
    ...(Object.keys(matchStage).length ? [{ $match: matchStage }] : []),
    { $unwind: "$products" },
    {
      $group: {
        _id: "$products.productId",
        productName: { $first: "$products.productName" },
        totalQuantitySold: { $sum: "$products.quantity" },
        totalRevenue: { $sum: "$products.total" },
        salesCount: { $sum: 1 },
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

// Calculate profit for sales using actual FIFO batch costs
export const getSalesProfit = catchAsync(async (req, res, next) => {
  const { startDate, endDate } = req.query;

  const matchStage = {};
  if (startDate || endDate) {
    matchStage.createdAt = {};
    if (startDate) matchStage.createdAt.$gte = new Date(startDate);
    if (endDate) matchStage.createdAt.$lte = new Date(endDate);
  }

  const profitData = await Sale.aggregate([
    ...(Object.keys(matchStage).length ? [{ $match: matchStage }] : []),
    { $unwind: "$products" },
    {
      $addFields: {
        // Calculate actual cost from batch allocations if available
        actualCost: {
          $cond: {
            if: {
              $and: [
                { $isArray: "$products.batchAllocations" },
                { $gt: [{ $size: "$products.batchAllocations" }, 0] },
              ],
            },
            then: {
              $reduce: {
                input: "$products.batchAllocations",
                initialValue: 0,
                in: {
                  $add: [
                    "$$value",
                    { $multiply: ["$$this.buyPrice", "$$this.quantity"] },
                  ],
                },
              },
            },
            else: null,
          },
        },
      },
    },
    {
      $lookup: {
        from: "products",
        localField: "products.productId",
        foreignField: "_id",
        as: "productInfo",
      },
    },
    { $unwind: "$productInfo" },
    {
      $addFields: {
        // Use batch cost if available, otherwise fallback to product buyPrice
        finalCost: {
          $ifNull: [
            "$actualCost",
            { $multiply: ["$productInfo.buyPrice", "$products.quantity"] },
          ],
        },
        profit: {
          $subtract: [
            "$products.total",
            {
              $ifNull: [
                "$actualCost",
                { $multiply: ["$productInfo.buyPrice", "$products.quantity"] },
              ],
            },
          ],
        },
      },
    },
    {
      $group: {
        _id: null,
        totalProfit: { $sum: "$profit" },
        totalRevenue: { $sum: "$products.total" },
        totalCost: { $sum: "$finalCost" },
      },
    },
  ]);

  const result = profitData[0] || {
    totalProfit: 0,
    totalRevenue: 0,
    totalCost: 0,
  };

  result.profitMargin =
    result.totalRevenue > 0
      ? (result.totalProfit / result.totalRevenue) * 100
      : 0;

  res.status(200).json({
    status: "success",
    data: result,
  });
});
