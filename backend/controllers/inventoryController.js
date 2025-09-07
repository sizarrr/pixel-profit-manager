import InventoryBatch from '../models/InventoryBatch.js';
import Product from '../models/Product.js';
import { catchAsync, AppError } from '../middleware/errorHandler.js';
import mongoose from 'mongoose';

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
      expiryDate
    } = req.body;

    // Verify product exists
    const productQuery = Product.findById(productId);
    const product = activeSession ? await productQuery.session(activeSession) : await productQuery;
    if (!product || !product.isActive) {
      throw new AppError('Product not found or inactive', 404);
    }

    // Create new inventory batch
    const batchData = {
      productId,
      buyPrice,
      initialQuantity: quantity,
      remainingQuantity: quantity,
      purchaseDate: new Date(purchaseDate),
      supplierName,
      notes
    };

    if (expiryDate) {
      batchData.expiryDate = new Date(expiryDate);
    }

    const createArgs = activeSession ? [[batchData], { session: activeSession }] : [batchData];
    const created = await InventoryBatch.create(...createArgs);
    const createdBatch = Array.isArray(created) ? created[0] : created;

    // Update product total quantity
    await Product.updateQuantityFromBatches(productId);

    res.status(201).json({
      status: 'success',
      data: {
        batch: createdBatch
      }
    });
  };

  try {
    try {
      await session.withTransaction(async () => {
        await core(session);
      });
    } catch (txError) {
      const message = String(txError?.message || '');
      if (
        message.includes('Transaction numbers are only allowed on a replica set member') ||
        message.includes('Transaction support is not enabled') ||
        message.includes('does not support sessions')
      ) {
        console.warn('⚠️  Transactions not supported. Falling back to non-transactional processing for addInventoryBatch.');
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

  // Build filter
  const filter = { productId };
  if (!includeEmpty) {
    filter.remainingQuantity = { $gt: 0 };
  }

  const batches = await InventoryBatch.find(filter)
    .sort({ purchaseDate: 1, createdAt: 1 })
    .populate('productId', 'name category sellPrice')
    .lean();

  res.status(200).json({
    status: 'success',
    results: batches.length,
    data: {
      batches
    }
  });
});

// Get all inventory batches with filtering
export const getAllBatches = catchAsync(async (req, res, next) => {
  const {
    page = 1,
    limit = 20,
    productId,
    includeEmpty = false,
    sort = 'purchaseDate'
  } = req.query;

  // Build filter
  const filter = {};
  if (productId) {
    filter.productId = productId;
  }
  if (!includeEmpty) {
    filter.remainingQuantity = { $gt: 0 };
  }

  // Calculate pagination
  const skip = (page - 1) * limit;
  const limitNum = Math.min(limit, 50); // Max 50 per page

  // Execute query
  const batches = await InventoryBatch.find(filter)
    .sort(sort)
    .skip(skip)
    .limit(limitNum)
    .populate('productId', 'name category sellPrice')
    .lean();

  // Get total count for pagination
  const total = await InventoryBatch.countDocuments(filter);
  const totalPages = Math.ceil(total / limitNum);

  res.status(200).json({
    status: 'success',
    results: batches.length,
    pagination: {
      currentPage: parseInt(page),
      totalPages,
      totalItems: total,
      itemsPerPage: limitNum,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1
    },
    data: {
      batches
    }
  });
});

// Get inventory summary for all products
export const getInventorySummary = catchAsync(async (req, res, next) => {
  const summary = await InventoryBatch.aggregate([
    {
      $match: {
        remainingQuantity: { $gt: 0 },
        isActive: true
      }
    },
    {
      $lookup: {
        from: 'products',
        localField: 'productId',
        foreignField: '_id',
        as: 'product'
      }
    },
    {
      $unwind: '$product'
    },
    {
      $group: {
        _id: '$productId',
        productName: { $first: '$product.name' },
        category: { $first: '$product.category' },
        sellPrice: { $first: '$product.sellPrice' },
        totalQuantity: { $sum: '$remainingQuantity' },
        totalBatches: { $sum: 1 },
        oldestBatch: { $min: '$purchaseDate' },
        newestBatch: { $max: '$purchaseDate' },
        averageBuyPrice: {
          $divide: [
            { $sum: { $multiply: ['$buyPrice', '$remainingQuantity'] } },
            { $sum: '$remainingQuantity' }
          ]
        },
        totalInventoryValue: {
          $sum: { $multiply: ['$buyPrice', '$remainingQuantity'] }
        },
        batches: {
          $push: {
            batchId: '$_id',
            batchNumber: '$batchNumber',
            buyPrice: '$buyPrice',
            remainingQuantity: '$remainingQuantity',
            purchaseDate: '$purchaseDate'
          }
        }
      }
    },
    {
      $sort: { productName: 1 }
    }
  ]);

  res.status(200).json({
    status: 'success',
    results: summary.length,
    data: {
      inventory: summary
    }
  });
});

// Update inventory batch
export const updateInventoryBatch = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  const updates = req.body;

  // Don't allow updating critical fields that would break FIFO logic
  const forbiddenUpdates = ['productId', 'initialQuantity', 'remainingQuantity', 'purchaseDate'];
  const updateKeys = Object.keys(updates);
  const hasForbiddenUpdate = forbiddenUpdates.some(field => updateKeys.includes(field));

  if (hasForbiddenUpdate) {
    throw new AppError('Cannot update critical inventory fields. Create a new batch instead.', 400);
  }

  const batch = await InventoryBatch.findByIdAndUpdate(
    id,
    updates,
    { new: true, runValidators: true }
  ).populate('productId', 'name category sellPrice');

  if (!batch) {
    throw new AppError('Inventory batch not found', 404);
  }

  res.status(200).json({
    status: 'success',
    data: {
      batch
    }
  });
});

// Deactivate inventory batch (soft delete)
export const deactivateInventoryBatch = catchAsync(async (req, res, next) => {
  const { id } = req.params;

  const batch = await InventoryBatch.findById(id);
  if (!batch) {
    throw new AppError('Inventory batch not found', 404);
  }

  if (batch.remainingQuantity > 0) {
    throw new AppError('Cannot deactivate batch with remaining inventory. Transfer or adjust quantity first.', 400);
  }

  batch.isActive = false;
  await batch.save();

  res.status(200).json({
    status: 'success',
    data: {
      batch
    }
  });
});

// Get low stock products (considering all batches)
export const getLowStockProducts = catchAsync(async (req, res, next) => {
  const lowStockProducts = await Product.aggregate([
    {
      $lookup: {
        from: 'inventorybatches',
        let: { productId: '$_id' },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [
                  { $eq: ['$productId', '$$productId'] },
                  { $gt: ['$remainingQuantity', 0] },
                  { $eq: ['$isActive', true] }
                ]
              }
            }
          }
        ],
        as: 'batches'
      }
    },
    {
      $addFields: {
        totalQuantity: {
          $sum: '$batches.remainingQuantity'
        }
      }
    },
    {
      $match: {
        $expr: {
          $lte: ['$totalQuantity', '$lowStockThreshold']
        },
        isActive: true
      }
    },
    {
      $project: {
        name: 1,
        category: 1,
        sellPrice: 1,
        lowStockThreshold: 1,
        totalQuantity: 1,
        isLowStock: {
          $lte: ['$totalQuantity', '$lowStockThreshold']
        }
      }
    }
  ]);

  res.status(200).json({
    status: 'success',
    results: lowStockProducts.length,
    data: {
      lowStockProducts
    }
  });
});