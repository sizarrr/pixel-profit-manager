// backend/controllers/inventoryController.js - FIXED VERSION
import InventoryBatch from "../models/InventoryBatch.js";
import Product from "../models/Product.js";
import { catchAsync, AppError } from "../middleware/errorHandler.js";
import mongoose from "mongoose";

// Add new inventory batch for existing product
export const addInventoryBatch = catchAsync(async (req, res, next) => {
  const session = await mongoose.startSession();

  const core = async (activeSession) => {
    const {
      productId,
      buyPrice,
      quantity,
      supplierName,
      notes,
      purchaseDate = new Date(),
      expiryDate,
    } = req.body;

    console.log("📦 Adding inventory batch:", {
      productId,
      buyPrice,
      quantity,
      supplierName,
      purchaseDate,
    });

    // Enhanced validation
    if (!productId || !mongoose.Types.ObjectId.isValid(productId)) {
      throw new AppError("Valid product ID is required", 400);
    }

    if (!buyPrice || isNaN(Number(buyPrice)) || Number(buyPrice) < 0) {
      throw new AppError("Valid buy price is required (must be >= 0)", 400);
    }

    if (!quantity || isNaN(Number(quantity)) || Number(quantity) <= 0) {
      throw new AppError("Valid quantity is required (must be > 0)", 400);
    }

    // Verify product exists and is active
    const productQuery = Product.findById(productId);
    const product = activeSession
      ? await productQuery.session(activeSession)
      : await productQuery;

    if (!product || !product.isActive) {
      throw new AppError("Product not found or inactive", 404);
    }

    console.log("✅ Product verified:", product.name);

    // Create new inventory batch with enhanced data validation
    const batchData = {
      productId: new mongoose.Types.ObjectId(productId),
      buyPrice: Number(buyPrice),
      initialQuantity: Number(quantity),
      remainingQuantity: Number(quantity),
      purchaseDate: new Date(purchaseDate),
      supplierName: supplierName?.trim() || "Unknown Supplier",
      notes: notes?.trim() || "",
    };

    // Add expiry date if provided
    if (expiryDate) {
      const expiryDateObj = new Date(expiryDate);
      if (expiryDateObj <= batchData.purchaseDate) {
        throw new AppError("Expiry date must be after purchase date", 400);
      }
      batchData.expiryDate = expiryDateObj;
    }

    console.log("📝 Creating batch with data:", batchData);

    const createArgs = activeSession
      ? [[batchData], { session: activeSession }]
      : [batchData];
    const created = await InventoryBatch.create(...createArgs);
    const createdBatch = Array.isArray(created) ? created[0] : created;

    console.log("✅ Batch created:", createdBatch.batchNumber);

    // Update product total quantity from all batches
    const updatedQuantity = await Product.updateQuantityFromBatches(productId);
    console.log("📊 Updated product quantity to:", updatedQuantity);

    res.status(201).json({
      status: "success",
      data: {
        batch: createdBatch,
        updatedProductQuantity: updatedQuantity,
      },
    });
  };

  try {
    try {
      await session.withTransaction(async () => {
        await core(session);
      });
    } catch (txError) {
      const message = String(txError?.message || "");
      if (
        message.includes(
          "Transaction numbers are only allowed on a replica set member"
        ) ||
        message.includes("Transaction support is not enabled") ||
        message.includes("does not support sessions")
      ) {
        console.warn(
          "⚠️  Transactions not supported. Falling back to non-transactional processing for addInventoryBatch."
        );
        await core(null);
      } else {
        throw txError;
      }
    }
  } finally {
    await session.endSession();
  }
});

// Get all inventory batches for a product
export const getProductBatches = catchAsync(async (req, res, next) => {
  const { productId } = req.params;
  const { includeEmpty = false } = req.query;

  // Validate product ID
  if (!mongoose.Types.ObjectId.isValid(productId)) {
    return next(new AppError("Invalid product ID format", 400));
  }

  // Build filter
  const filter = { productId: new mongoose.Types.ObjectId(productId) };
  if (!includeEmpty) {
    filter.remainingQuantity = { $gt: 0 };
  }

  const batches = await InventoryBatch.find(filter)
    .sort({ purchaseDate: 1, createdAt: 1 }) // FIFO order
    .populate("productId", "name category sellPrice")
    .lean();

  // Calculate summary statistics
  const summary = {
    totalBatches: batches.length,
    totalInitialQuantity: batches.reduce(
      (sum, batch) => sum + batch.initialQuantity,
      0
    ),
    totalRemainingQuantity: batches.reduce(
      (sum, batch) => sum + batch.remainingQuantity,
      0
    ),
    totalSoldQuantity: batches.reduce(
      (sum, batch) => sum + (batch.initialQuantity - batch.remainingQuantity),
      0
    ),
    averageBuyPrice:
      batches.length > 0
        ? batches.reduce(
            (sum, batch) => sum + batch.buyPrice * batch.remainingQuantity,
            0
          ) /
            batches.reduce((sum, batch) => sum + batch.remainingQuantity, 0) ||
          0
        : 0,
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

// Get all inventory batches with filtering and pagination
export const getAllBatches = catchAsync(async (req, res, next) => {
  const {
    page = 1,
    limit = 20,
    productId,
    includeEmpty = false,
    sort = "purchaseDate",
    supplierName,
  } = req.query;

  // Build filter
  const filter = {};

  if (productId) {
    if (!mongoose.Types.ObjectId.isValid(productId)) {
      return next(new AppError("Invalid product ID format", 400));
    }
    filter.productId = new mongoose.Types.ObjectId(productId);
  }

  if (!includeEmpty) {
    filter.remainingQuantity = { $gt: 0 };
  }

  if (supplierName) {
    filter.supplierName = new RegExp(supplierName, "i");
  }

  // Calculate pagination
  const skip = (page - 1) * limit;
  const limitNum = Math.min(limit, 50); // Max 50 per page

  // Execute query
  const batches = await InventoryBatch.find(filter)
    .sort(sort)
    .skip(skip)
    .limit(limitNum)
    .populate("productId", "name category sellPrice")
    .lean();

  // Get total count for pagination
  const total = await InventoryBatch.countDocuments(filter);
  const totalPages = Math.ceil(total / limitNum);

  res.status(200).json({
    status: "success",
    results: batches.length,
    pagination: {
      currentPage: parseInt(page),
      totalPages,
      totalItems: total,
      itemsPerPage: limitNum,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1,
    },
    data: {
      batches,
    },
  });
});

// Get inventory summary for all products
export const getInventorySummary = catchAsync(async (req, res, next) => {
  const summary = await InventoryBatch.aggregate([
    {
      $match: {
        remainingQuantity: { $gt: 0 },
        isActive: true,
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
        _id: "$productId",
        productName: { $first: "$product.name" },
        category: { $first: "$product.category" },
        sellPrice: { $first: "$product.sellPrice" },
        totalQuantity: { $sum: "$remainingQuantity" },
        totalBatches: { $sum: 1 },
        oldestBatch: { $min: "$purchaseDate" },
        newestBatch: { $max: "$purchaseDate" },
        averageBuyPrice: {
          $divide: [
            { $sum: { $multiply: ["$buyPrice", "$remainingQuantity"] } },
            { $sum: "$remainingQuantity" },
          ],
        },
        totalInventoryValue: {
          $sum: { $multiply: ["$buyPrice", "$remainingQuantity"] },
        },
        totalSellValue: {
          $sum: { $multiply: ["$sellPrice", "$remainingQuantity"] },
        },
        batches: {
          $push: {
            batchId: "$_id",
            batchNumber: "$batchNumber",
            buyPrice: "$buyPrice",
            remainingQuantity: "$remainingQuantity",
            purchaseDate: "$purchaseDate",
            supplierName: "$supplierName",
          },
        },
      },
    },
    {
      $addFields: {
        potentialProfit: {
          $subtract: ["$totalSellValue", "$totalInventoryValue"],
        },
      },
    },
    {
      $sort: { productName: 1 },
    },
  ]);

  // Calculate overall summary
  const overallSummary = {
    totalProducts: summary.length,
    totalInventoryValue: summary.reduce(
      (sum, item) => sum + item.totalInventoryValue,
      0
    ),
    totalSellValue: summary.reduce((sum, item) => sum + item.totalSellValue, 0),
    totalQuantity: summary.reduce((sum, item) => sum + item.totalQuantity, 0),
    totalBatches: summary.reduce((sum, item) => sum + item.totalBatches, 0),
    potentialProfit: summary.reduce(
      (sum, item) => sum + item.potentialProfit,
      0
    ),
  };

  res.status(200).json({
    status: "success",
    results: summary.length,
    data: {
      inventory: summary,
      summary: overallSummary,
    },
  });
});

// Update inventory batch (limited fields for safety)
export const updateInventoryBatch = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  const updates = req.body;

  // Validate batch ID
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return next(new AppError("Invalid batch ID format", 400));
  }

  // Don't allow updating critical fields that would break FIFO logic
  const forbiddenUpdates = [
    "productId",
    "initialQuantity",
    "remainingQuantity",
    "purchaseDate",
  ];
  const updateKeys = Object.keys(updates);
  const hasForbiddenUpdate = forbiddenUpdates.some((field) =>
    updateKeys.includes(field)
  );

  if (hasForbiddenUpdate) {
    throw new AppError(
      `Cannot update critical inventory fields (${forbiddenUpdates.join(
        ", "
      )}). Create a new batch instead.`,
      400
    );
  }

  // Allowed fields for update
  const allowedFields = ["supplierName", "notes", "expiryDate"];
  const filteredUpdates = {};

  allowedFields.forEach((field) => {
    if (updates.hasOwnProperty(field)) {
      if (field === "expiryDate" && updates[field]) {
        filteredUpdates[field] = new Date(updates[field]);
      } else if (field === "supplierName" || field === "notes") {
        filteredUpdates[field] = updates[field]?.trim() || "";
      }
    }
  });

  if (Object.keys(filteredUpdates).length === 0) {
    return next(new AppError("No valid fields provided for update", 400));
  }

  const batch = await InventoryBatch.findByIdAndUpdate(id, filteredUpdates, {
    new: true,
    runValidators: true,
  }).populate("productId", "name category sellPrice");

  if (!batch) {
    throw new AppError("Inventory batch not found", 404);
  }

  res.status(200).json({
    status: "success",
    data: {
      batch,
    },
  });
});

// Deactivate inventory batch (soft delete)
export const deactivateInventoryBatch = catchAsync(async (req, res, next) => {
  const { id } = req.params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return next(new AppError("Invalid batch ID format", 400));
  }

  const batch = await InventoryBatch.findById(id);
  if (!batch) {
    throw new AppError("Inventory batch not found", 404);
  }

  if (batch.remainingQuantity > 0) {
    throw new AppError(
      "Cannot deactivate batch with remaining inventory. Transfer or adjust quantity first.",
      400
    );
  }

  batch.isActive = false;
  await batch.save();

  // Update product quantity after deactivating batch
  await Product.updateQuantityFromBatches(batch.productId);

  res.status(200).json({
    status: "success",
    data: {
      batch,
    },
  });
});

// Get low stock products (considering all batches)
export const getLowStockProducts = catchAsync(async (req, res, next) => {
  const lowStockProducts = await Product.aggregate([
    {
      $lookup: {
        from: "inventorybatches",
        let: { productId: "$_id" },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [
                  { $eq: ["$productId", "$$productId"] },
                  { $gt: ["$remainingQuantity", 0] },
                  { $eq: ["$isActive", true] },
                ],
              },
            },
          },
        ],
        as: "batches",
      },
    },
    {
      $addFields: {
        totalQuantity: {
          $sum: "$batches.remainingQuantity",
        },
        averageBuyPrice: {
          $cond: {
            if: { $gt: [{ $size: "$batches" }, 0] },
            then: {
              $divide: [
                {
                  $sum: {
                    $map: {
                      input: "$batches",
                      as: "batch",
                      in: {
                        $multiply: [
                          "$$batch.buyPrice",
                          "$$batch.remainingQuantity",
                        ],
                      },
                    },
                  },
                },
                { $sum: "$batches.remainingQuantity" },
              ],
            },
            else: "$buyPrice",
          },
        },
      },
    },
    {
      $match: {
        $expr: {
          $lte: ["$totalQuantity", "$lowStockThreshold"],
        },
        isActive: true,
      },
    },
    {
      $project: {
        name: 1,
        category: 1,
        sellPrice: 1,
        lowStockThreshold: 1,
        totalQuantity: 1,
        averageBuyPrice: 1,
        isLowStock: {
          $lte: ["$totalQuantity", "$lowStockThreshold"],
        },
        batchCount: { $size: "$batches" },
      },
    },
    {
      $sort: { totalQuantity: 1 },
    },
  ]);

  res.status(200).json({
    status: "success",
    results: lowStockProducts.length,
    data: {
      lowStockProducts,
    },
  });
});

// Manual inventory adjustment (for corrections)
export const adjustInventoryBatch = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  const { newQuantity, reason } = req.body;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return next(new AppError("Invalid batch ID format", 400));
  }

  if (!newQuantity || isNaN(Number(newQuantity)) || Number(newQuantity) < 0) {
    return next(
      new AppError("Valid new quantity is required (must be >= 0)", 400)
    );
  }

  if (!reason || reason.trim() === "") {
    return next(new AppError("Reason for adjustment is required", 400));
  }

  const session = await mongoose.startSession();

  try {
    await session.withTransaction(async () => {
      const batch = await InventoryBatch.findById(id).session(session);

      if (!batch) {
        throw new AppError("Inventory batch not found", 404);
      }

      const oldQuantity = batch.remainingQuantity;
      const adjustment = Number(newQuantity) - oldQuantity;

      // Update batch quantity
      batch.remainingQuantity = Number(newQuantity);
      batch.notes = `${
        batch.notes || ""
      }\n[${new Date().toISOString()}] Adjusted by ${adjustment}: ${reason.trim()}`.trim();

      await batch.save({ session });

      // Update product total quantity
      await Product.updateQuantityFromBatches(batch.productId);

      res.status(200).json({
        status: "success",
        data: {
          batch,
          adjustment: {
            oldQuantity,
            newQuantity: Number(newQuantity),
            difference: adjustment,
            reason: reason.trim(),
          },
        },
      });
    });
  } catch (error) {
    throw error;
  } finally {
    await session.endSession();
  }
});

// Get expiring batches
export const getExpiringBatches = catchAsync(async (req, res, next) => {
  const { days = 30 } = req.query;

  const expiryDate = new Date();
  expiryDate.setDate(expiryDate.getDate() + parseInt(days));

  const expiringBatches = await InventoryBatch.find({
    expiryDate: { $lte: expiryDate },
    remainingQuantity: { $gt: 0 },
    isActive: true,
  })
    .populate("productId", "name category sellPrice")
    .sort("expiryDate")
    .lean();

  res.status(200).json({
    status: "success",
    results: expiringBatches.length,
    data: {
      expiringBatches,
      checkDate: expiryDate,
    },
  });
});
