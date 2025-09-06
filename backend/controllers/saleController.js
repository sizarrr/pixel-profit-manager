import Sale from '../models/Sale.js';
import Product from '../models/Product.js';
import InventoryBatch from '../models/InventoryBatch.js';
import { catchAsync, AppError } from '../middleware/errorHandler.js';
import config from '../config/config.js';
import mongoose from 'mongoose';

// Get all sales with filtering, sorting, and pagination
export const getAllSales = catchAsync(async (req, res, next) => {
  const {
    page = 1,
    limit = config.defaultPageSize,
    startDate,
    endDate,
    cashier,
    sort = '-createdAt'
  } = req.query;

  // Build filter object
  const filter = {};
  
  if (startDate || endDate) {
    filter.createdAt = {};
    if (startDate) filter.createdAt.$gte = new Date(startDate);
    if (endDate) filter.createdAt.$lte = new Date(endDate);
  }
  
  if (cashier) {
    filter.cashierName = new RegExp(cashier, 'i');
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
    status: 'success',
    results: sales.length,
    pagination: {
      currentPage: parseInt(page),
      totalPages,
      totalItems: total,
      itemsPerPage: limitNum,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1
    },
    data: {
      sales
    }
  });
});

// Get single sale by ID
export const getSale = catchAsync(async (req, res, next) => {
  const sale = await Sale.findById(req.params.id).populate('products.productId', 'name category buyPrice');

  if (!sale) {
    return next(new AppError('Sale not found', 404));
  }

  res.status(200).json({
    status: 'success',
    data: {
      sale
    }
  });
});

// Create new sale (process transaction) with FIFO inventory management
export const createSale = catchAsync(async (req, res, next) => {
  const session = await mongoose.startSession();
  
  try {
    await session.withTransaction(async () => {
      const { products, totalAmount, cashierName, paymentMethod, customerName, notes } = req.body;

      // Validate and process FIFO inventory allocation
      const processedProducts = [];
      const batchUpdates = [];
      let calculatedTotal = 0;

      for (const saleProduct of products) {
        const product = await Product.findById(saleProduct.productId).session(session);
        
        if (!product || !product.isActive) {
          throw new AppError(`Product ${saleProduct.productName} not found`, 404);
        }

        // Get available inventory batches in FIFO order
        const availableBatches = await InventoryBatch.find({
          productId: saleProduct.productId,
          remainingQuantity: { $gt: 0 },
          isActive: true
        }).sort({ purchaseDate: 1, createdAt: 1 }).session(session);

        // Calculate total available quantity
        const totalAvailable = availableBatches.reduce((sum, batch) => sum + batch.remainingQuantity, 0);
        
        if (totalAvailable < saleProduct.quantity) {
          throw new AppError(`Insufficient stock for ${product.name}. Available: ${totalAvailable}, Requested: ${saleProduct.quantity}`, 400);
        }

        // Verify price and total
        if (saleProduct.sellPrice !== product.sellPrice) {
          throw new AppError(`Price mismatch for ${product.name}`, 400);
        }

        const expectedTotal = saleProduct.sellPrice * saleProduct.quantity;
        if (Math.abs(saleProduct.total - expectedTotal) > 0.01) {
          throw new AppError(`Total mismatch for ${product.name}`, 400);
        }

        calculatedTotal += expectedTotal;

        // Allocate inventory using FIFO logic
        let remainingToAllocate = saleProduct.quantity;
        const batchAllocations = [];

        for (const batch of availableBatches) {
          if (remainingToAllocate <= 0) break;

          const allocatedFromBatch = Math.min(remainingToAllocate, batch.remainingQuantity);
          
          batchAllocations.push({
            batchId: batch._id,
            quantity: allocatedFromBatch,
            buyPrice: batch.buyPrice,
            batchNumber: batch.batchNumber
          });

          batchUpdates.push({
            batchId: batch._id,
            newRemainingQuantity: batch.remainingQuantity - allocatedFromBatch
          });

          remainingToAllocate -= allocatedFromBatch;
        }

        // Add batch allocation info to the sale product
        const enhancedSaleProduct = {
          ...saleProduct,
          batchAllocations
        };

        processedProducts.push(enhancedSaleProduct);
      }

      // Verify total amount
      if (Math.abs(totalAmount - calculatedTotal) > 0.01) {
        throw new AppError('Total amount mismatch', 400);
      }

      // Update inventory batch quantities
      for (const update of batchUpdates) {
        await InventoryBatch.findByIdAndUpdate(
          update.batchId,
          { remainingQuantity: update.newRemainingQuantity },
          { session, runValidators: true }
        );
      }

      // Create sale record with batch allocation information
      const saleData = {
        products: processedProducts,
        totalAmount,
        cashierName,
        paymentMethod: paymentMethod || 'cash',
        customerName,
        notes
      };

      const sale = await Sale.create([saleData], { session });

      // Store product IDs for updating quantities after transaction
      const uniqueProductIds = [...new Set(products.map(p => p.productId))];

      res.status(201).json({
        status: 'success',
        data: {
          sale: sale[0]
        }
      });

      // Update product total quantities from batches after transaction completes
      setImmediate(async () => {
        for (const productId of uniqueProductIds) {
          try {
            await Product.updateQuantityFromBatches(productId);
          } catch (error) {
            console.error(`Error updating quantity for product ${productId}:`, error);
          }
        }
      });
    });
  } catch (error) {
    throw error;
  } finally {
    await session.endSession();
  }
});

// Get recent sales
export const getRecentSales = catchAsync(async (req, res, next) => {
  const { limit = 10 } = req.query;

  const sales = await Sale.find()
    .sort('-createdAt')
    .limit(parseInt(limit))
    .lean();

  res.status(200).json({
    status: 'success',
    results: sales.length,
    data: {
      sales
    }
  });
});

// Get sales statistics
export const getSalesStats = catchAsync(async (req, res, next) => {
  const { startDate, endDate } = req.query;
  
  // Default to current month if no dates provided
  const start = startDate ? new Date(startDate) : new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  const end = endDate ? new Date(endDate) : new Date();

  const stats = await Sale.aggregate([
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
  ]);

  // Get today's sales
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const todayStats = await Sale.aggregate([
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
  ]);

  res.status(200).json({
    status: 'success',
    data: {
      period: {
        startDate: start,
        endDate: end,
        ...stats[0] || {
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
    }
  });
});

// Get sales by date range (for charts)
export const getSalesByDateRange = catchAsync(async (req, res, next) => {
  const { startDate, endDate, groupBy = 'day' } = req.query;
  
  const start = startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const end = endDate ? new Date(endDate) : new Date();

  let groupFormat;
  switch (groupBy) {
    case 'hour':
      groupFormat = { $dateToString: { format: '%Y-%m-%d %H:00', date: '$createdAt' } };
      break;
    case 'day':
      groupFormat = { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } };
      break;
    case 'month':
      groupFormat = { $dateToString: { format: '%Y-%m', date: '$createdAt' } };
      break;
    case 'year':
      groupFormat = { $dateToString: { format: '%Y', date: '$createdAt' } };
      break;
    default:
      groupFormat = { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } };
  }

  const salesData = await Sale.aggregate([
    {
      $match: {
        createdAt: { $gte: start, $lte: end }
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
        }
      }
    },
    {
      $sort: { _id: 1 }
    }
  ]);

  res.status(200).json({
    status: 'success',
    results: salesData.length,
    data: {
      salesData
    }
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
    { $unwind: '$products' },
    {
      $group: {
        _id: '$products.productId',
        productName: { $first: '$products.productName' },
        totalQuantitySold: { $sum: '$products.quantity' },
        totalRevenue: { $sum: '$products.total' },
        salesCount: { $sum: 1 }
      }
    },
    { $sort: { totalQuantitySold: -1 } },
    { $limit: parseInt(limit) }
  ]);

  res.status(200).json({
    status: 'success',
    results: topProducts.length,
    data: {
      topProducts
    }
  });
});

// Calculate profit for sales (requires product buy prices)
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
    { $unwind: '$products' },
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
          $multiply: [
            { $subtract: ['$products.sellPrice', '$productInfo.buyPrice'] },
            '$products.quantity'
          ]
        }
      }
    },
    {
      $group: {
        _id: null,
        totalProfit: { $sum: '$profit' },
        totalRevenue: { $sum: '$products.total' },
        totalCost: { $sum: { $multiply: ['$productInfo.buyPrice', '$products.quantity'] } }
      }
    }
  ]);

  const result = profitData[0] || {
    totalProfit: 0,
    totalRevenue: 0,
    totalCost: 0
  };

  result.profitMargin = result.totalRevenue > 0 ? (result.totalProfit / result.totalRevenue * 100) : 0;

  res.status(200).json({
    status: 'success',
    data: result
  });
});