import InventoryBatch from "../models/InventoryBatch.js";
import Product from "../models/Product.js";
import { catchAsync, AppError } from "../middleware/errorHandler.js";
import mongoose from "mongoose";

// Add new inventory batch (receiving stock)
export const addInventoryBatch = catchAsync(async (req, res, next) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const {
      productId,
      purchaseDate,
      expiryDate,
      buyPrice,
      sellPrice,
      quantity,
      supplierName,
      invoiceNumber,
      shippingCost = 0,
      taxAmount = 0,
      otherCosts = 0,
      notes,
    } = req.body;

    // Validate product exists
    const product = await Product.findById(productId);
    if (!product) {
      throw new AppError("Product not found", 404);
    }

    // Create inventory batch
    const batch = new InventoryBatch({
      productId,
      purchaseDate: purchaseDate || Date.now(),
      expiryDate,
      buyPrice,
      sellPrice,
      initialQuantity: quantity,
      remainingQuantity: quantity,
      supplierName,
      invoiceNumber,
      notes,
      costDetails: {
        shippingCost,
        taxAmount,
        otherCosts,
      },
    });

    await batch.save({ session });

    // Update product with new calculated values
    await product.updateFromBatches();

    await session.commitTransaction();

    res.status(201).json({
      status: "success",
      data: {
        batch,
        product: await Product.findById(productId),
      },
    });
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
});

// Get all batches for a product
export const getProductBatches = catchAsync(async (req, res, next) => {
  const { productId } = req.params;
  const { status = "all" } = req.query;

  const query = { productId };
  if (status !== "all") {
    query.status = status;
  }

  const batches = await InventoryBatch.find(query)
    .sort({ purchaseDate: 1 })
    .populate("productId", "name category");

  const summary = {
    totalBatches: batches.length,
    activeBatches: batches.filter((b) => b.status === "active").length,
    totalQuantity: batches.reduce((sum, b) => sum + b.remainingQuantity, 0),
    totalValue: batches.reduce(
      (sum, b) => sum + b.remainingQuantity * b.buyPrice,
      0
    ),
    oldestBatch: batches[0]?.purchaseDate,
    newestBatch: batches[batches.length - 1]?.purchaseDate,
  };

  res.status(200).json({
    status: "success",
    results: batches.length,
    data: {
      batches,
      summary,
    },
  });
});

// Get inventory valuation report
export const getInventoryValuation = catchAsync(async (req, res, next) => {
  const valuation = await InventoryBatch.aggregate([
    {
      $match: {
        status: "active",
        remainingQuantity: { $gt: 0 },
      },
    },
    {
      $lookup: {
        from: "products",
        localField: "productId",
        foreignField: "_id",
        as: "product",
      },
    },
    {
      $unwind: "$product",
    },
    {
      $group: {
        _id: "$product.category",
        totalQuantity: { $sum: "$remainingQuantity" },
        totalCostValue: {
          $sum: { $multiply: ["$remainingQuantity", "$buyPrice"] },
        },
        totalSellValue: {
          $sum: { $multiply: ["$remainingQuantity", "$sellPrice"] },
        },
        potentialProfit: {
          $sum: {
            $multiply: [
              "$remainingQuantity",
              { $subtract: ["$sellPrice", "$buyPrice"] },
            ],
          },
        },
        products: {
          $addToSet: {
            id: "$product._id",
            name: "$product.name",
            quantity: "$remainingQuantity",
            costValue: { $multiply: ["$remainingQuantity", "$buyPrice"] },
            sellValue: { $multiply: ["$remainingQuantity", "$sellPrice"] },
          },
        },
      },
    },
    {
      $sort: { totalCostValue: -1 },
    },
  ]);

  const totals = valuation.reduce(
    (acc, cat) => ({
      totalQuantity: acc.totalQuantity + cat.totalQuantity,
      totalCostValue: acc.totalCostValue + cat.totalCostValue,
      totalSellValue: acc.totalSellValue + cat.totalSellValue,
      potentialProfit: acc.potentialProfit + cat.potentialProfit,
    }),
    {
      totalQuantity: 0,
      totalCostValue: 0,
      totalSellValue: 0,
      potentialProfit: 0,
    }
  );

  res.status(200).json({
    status: "success",
    data: {
      byCategory: valuation,
      totals,
      profitMargin: (
        (totals.potentialProfit / totals.totalSellValue) *
        100
      ).toFixed(2),
    },
  });
});

// Get expiring batches
export const getExpiringBatches = catchAsync(async (req, res, next) => {
  const { days = 30 } = req.query;

  const expiryDate = new Date();
  expiryDate.setDate(expiryDate.getDate() + parseInt(days));

  const batches = await InventoryBatch.find({
    status: "active",
    remainingQuantity: { $gt: 0 },
    expiryDate: { $lte: expiryDate },
  })
    .populate("productId", "name category")
    .sort({ expiryDate: 1 });

  res.status(200).json({
    status: "success",
    results: batches.length,
    data: {
      batches,
      totalValue: batches.reduce(
        (sum, b) => sum + b.remainingQuantity * b.buyPrice,
        0
      ),
    },
  });
});

// Transfer inventory between batches
export const transferInventory = catchAsync(async (req, res, next) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { fromBatchId, toBatchId, quantity } = req.body;

    const fromBatch = await InventoryBatch.findById(fromBatchId).session(
      session
    );
    const toBatch = await InventoryBatch.findById(toBatchId).session(session);

    if (!fromBatch || !toBatch) {
      throw new AppError("Batch not found", 404);
    }

    if (fromBatch.productId.toString() !== toBatch.productId.toString()) {
      throw new AppError("Cannot transfer between different products", 400);
    }

    if (fromBatch.remainingQuantity < quantity) {
      throw new AppError("Insufficient quantity in source batch", 400);
    }

    fromBatch.remainingQuantity -= quantity;
    toBatch.remainingQuantity += quantity;

    if (fromBatch.remainingQuantity === 0) {
      fromBatch.status = "depleted";
    }

    await fromBatch.save({ session });
    await toBatch.save({ session });

    await session.commitTransaction();

    res.status(200).json({
      status: "success",
      data: {
        fromBatch,
        toBatch,
      },
    });
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
});

// Get batch history for audit
export const getBatchHistory = catchAsync(async (req, res, next) => {
  const { batchId } = req.params;

  const batch = await InventoryBatch.findById(batchId).populate(
    "productId",
    "name category"
  );

  if (!batch) {
    throw new AppError("Batch not found", 404);
  }

  // Get all sales that used this batch
  const Sale = mongoose.model("Sale");
  const sales = await Sale.find({
    "products.batchAllocations.batchId": batchId,
  })
    .select("receiptNumber createdAt products cashierName totalAmount")
    .sort({ createdAt: -1 });

  // Calculate consumption
  const consumption = sales.reduce((acc, sale) => {
    sale.products.forEach((product) => {
      product.batchAllocations.forEach((allocation) => {
        if (allocation.batchId.toString() === batchId) {
          acc.push({
            date: sale.createdAt,
            receiptNumber: sale.receiptNumber,
            quantity: allocation.quantity,
            sellPrice: allocation.sellPrice,
            profit: allocation.profit,
          });
        }
      });
    });
    return acc;
  }, []);

  res.status(200).json({
    status: "success",
    data: {
      batch,
      consumption,
      totalConsumed: batch.initialQuantity - batch.remainingQuantity,
      totalSales: consumption.length,
    },
  });
});

// Get all batches across all products
export const getAllBatches = catchAsync(async (req, res, next) => {
  const {
    page = 1,
    limit = 20,
    status = "all",
    sortBy = "-purchaseDate",
  } = req.query;

  const query = {};
  if (status !== "all") {
    query.status = status;
  }

  const skip = (page - 1) * limit;

  const batches = await InventoryBatch.find(query)
    .populate("productId", "name category")
    .sort(sortBy)
    .skip(skip)
    .limit(parseInt(limit));

  const total = await InventoryBatch.countDocuments(query);

  res.status(200).json({
    status: "success",
    results: batches.length,
    pagination: {
      currentPage: parseInt(page),
      totalPages: Math.ceil(total / limit),
      totalItems: total,
    },
    data: {
      batches,
    },
  });
});

// Get inventory summary
export const getInventorySummary = catchAsync(async (req, res, next) => {
  const [totalProducts, activeBatches, inventoryValue, lowStockProducts] =
    await Promise.all([
      Product.countDocuments({ isActive: true }),
      InventoryBatch.countDocuments({ status: "active", remainingQuantity: { $gt: 0 } }),
      InventoryBatch.aggregate([
        {
          $match: {
            status: "active",
            remainingQuantity: { $gt: 0 },
          },
        },
        {
          $group: {
            _id: null,
            totalCostValue: {
              $sum: { $multiply: ["$remainingQuantity", "$buyPrice"] },
            },
            totalSellValue: {
              $sum: { $multiply: ["$remainingQuantity", "$sellPrice"] },
            },
            totalQuantity: { $sum: "$remainingQuantity" },
          },
        },
      ]),
      Product.countDocuments({
        isActive: true,
        $expr: { $lte: ["$quantity", "$lowStockThreshold"] },
      }),
    ]);

  const values = inventoryValue[0] || {
    totalCostValue: 0,
    totalSellValue: 0,
    totalQuantity: 0,
  };

  res.status(200).json({
    status: "success",
    data: {
      summary: {
        totalProducts,
        activeBatches,
        lowStockProducts,
        inventory: {
          totalQuantity: values.totalQuantity,
          totalCostValue: values.totalCostValue,
          totalSellValue: values.totalSellValue,
          potentialProfit: values.totalSellValue - values.totalCostValue,
          profitMargin: values.totalSellValue > 0
            ? ((values.totalSellValue - values.totalCostValue) / values.totalSellValue * 100).toFixed(2)
            : 0,
        },
      },
    },
  });
});

// Update inventory batch
export const updateInventoryBatch = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  const updates = req.body;

  // Prevent updating certain fields
  delete updates.initialQuantity;
  delete updates.productId;
  delete updates.batchNumber;

  const batch = await InventoryBatch.findByIdAndUpdate(
    id,
    updates,
    {
      new: true,
      runValidators: true,
    }
  );

  if (!batch) {
    throw new AppError("Batch not found", 404);
  }

  // Update product calculations if quantity or price changed
  if (updates.remainingQuantity || updates.buyPrice || updates.sellPrice) {
    const product = await Product.findById(batch.productId);
    if (product) {
      await product.updateFromBatches();
    }
  }

  res.status(200).json({
    status: "success",
    data: {
      batch,
    },
  });
});

// Deactivate inventory batch
export const deactivateInventoryBatch = catchAsync(async (req, res, next) => {
  const { id } = req.params;

  const batch = await InventoryBatch.findById(id);

  if (!batch) {
    throw new AppError("Batch not found", 404);
  }

  if (batch.status === "inactive") {
    throw new AppError("Batch is already inactive", 400);
  }

  batch.status = "inactive";
  await batch.save();

  // Update product calculations
  const product = await Product.findById(batch.productId);
  if (product) {
    await product.updateFromBatches();
  }

  res.status(200).json({
    status: "success",
    message: "Batch deactivated successfully",
    data: {
      batch,
    },
  });
});

// Get low stock products
export const getLowStockProducts = catchAsync(async (req, res, next) => {
  const { limit = 20 } = req.query;

  const products = await Product.find({
    isActive: true,
    $expr: { $lte: ["$quantity", "$lowStockThreshold"] },
  })
    .sort("quantity")
    .limit(parseInt(limit))
    .lean();

  // Get batch details for each product
  const productsWithBatches = await Promise.all(
    products.map(async (product) => {
      const batches = await InventoryBatch.find({
        productId: product._id,
        status: "active",
        remainingQuantity: { $gt: 0 },
      })
        .select("batchNumber remainingQuantity expiryDate")
        .sort("purchaseDate");

      return {
        ...product,
        batches,
        stockStatus: product.quantity === 0 ? "out_of_stock" : "low_stock",
      };
    })
  );

  res.status(200).json({
    status: "success",
    results: productsWithBatches.length,
    data: {
      products: productsWithBatches,
    },
  });
});

export default {
  addInventoryBatch,
  getProductBatches,
  getInventoryValuation,
  getExpiringBatches,
  transferInventory,
  getBatchHistory,
  getAllBatches,
  getInventorySummary,
  updateInventoryBatch,
  deactivateInventoryBatch,
  getLowStockProducts,
};
