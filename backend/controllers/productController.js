import Product from '../models/Product.js';
import { catchAsync, AppError } from '../middleware/errorHandler.js';
import config from '../config/config.js';

// Get all products with filtering, sorting, and pagination
export const getAllProducts = catchAsync(async (req, res, next) => {
  const {
    page = 1,
    limit = config.defaultPageSize,
    category,
    search,
    sort = '-createdAt',
    lowStock
  } = req.query;

  // Build filter object
  const filter = { isActive: true };
  
  if (category) {
    filter.category = new RegExp(category, 'i');
  }
  
  if (search) {
    filter.$or = [
      { name: new RegExp(search, 'i') },
      { description: new RegExp(search, 'i') },
      { category: new RegExp(search, 'i') }
    ];
  }
  
  if (lowStock === 'true') {
    filter.$expr = { $lte: ['$quantity', '$lowStockThreshold'] };
  }

  // Calculate pagination
  const skip = (page - 1) * limit;
  const limitNum = Math.min(limit, config.maxPageSize);

  // Execute query
  const products = await Product.find(filter)
    .sort(sort)
    .skip(skip)
    .limit(limitNum)
    .lean();

  // Get total count for pagination
  const total = await Product.countDocuments(filter);
  const totalPages = Math.ceil(total / limitNum);

  res.status(200).json({
    status: 'success',
    results: products.length,
    pagination: {
      currentPage: parseInt(page),
      totalPages,
      totalItems: total,
      itemsPerPage: limitNum,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1
    },
    data: {
      products
    }
  });
});

// Get single product by ID
export const getProduct = catchAsync(async (req, res, next) => {
  const product = await Product.findById(req.params.id);

  if (!product || !product.isActive) {
    return next(new AppError('Product not found', 404));
  }

  res.status(200).json({
    status: 'success',
    data: {
      product
    }
  });
});

// Create new product
export const createProduct = catchAsync(async (req, res, next) => {
  const productData = {
    ...req.body,
    lowStockThreshold: req.body.lowStockThreshold || config.defaultLowStockThreshold
  };

  const product = await Product.create(productData);

  res.status(201).json({
    status: 'success',
    data: {
      product
    }
  });
});

// Update product
export const updateProduct = catchAsync(async (req, res, next) => {
  // Remove fields that shouldn't be updated directly
  const allowedFields = [
    'name', 'category', 'buyPrice', 'sellPrice', 'quantity', 
    'description', 'image', 'lowStockThreshold'
  ];
  
  const updateData = {};
  allowedFields.forEach(field => {
    if (req.body[field] !== undefined) {
      updateData[field] = req.body[field];
    }
  });

  // Validate sell price vs buy price if both are being updated
  if (updateData.sellPrice && updateData.buyPrice) {
    if (updateData.sellPrice < updateData.buyPrice) {
      return next(new AppError('Sell price must be greater than or equal to buy price', 400));
    }
  }

  const product = await Product.findByIdAndUpdate(
    req.params.id,
    updateData,
    {
      new: true,
      runValidators: true
    }
  );

  if (!product || !product.isActive) {
    return next(new AppError('Product not found', 404));
  }

  res.status(200).json({
    status: 'success',
    data: {
      product
    }
  });
});

// Delete product (soft delete)
export const deleteProduct = catchAsync(async (req, res, next) => {
  const product = await Product.findByIdAndUpdate(
    req.params.id,
    { isActive: false },
    { new: true }
  );

  if (!product) {
    return next(new AppError('Product not found', 404));
  }

  res.status(204).json({
    status: 'success',
    data: null
  });
});

// Get low stock products
export const getLowStockProducts = catchAsync(async (req, res, next) => {
  const products = await Product.find({
    isActive: true,
    $expr: { $lte: ['$quantity', '$lowStockThreshold'] }
  }).sort('quantity');

  res.status(200).json({
    status: 'success',
    results: products.length,
    data: {
      products
    }
  });
});

// Get product categories
export const getCategories = catchAsync(async (req, res, next) => {
  const categories = await Product.distinct('category', { isActive: true });

  res.status(200).json({
    status: 'success',
    results: categories.length,
    data: {
      categories: categories.sort()
    }
  });
});

// Update product quantity (for inventory management)
export const updateQuantity = catchAsync(async (req, res, next) => {
  const { quantity, operation = 'set' } = req.body;

  if (!quantity && quantity !== 0) {
    return next(new AppError('Quantity is required', 400));
  }

  let updateOperation;
  if (operation === 'add') {
    updateOperation = { $inc: { quantity } };
  } else if (operation === 'subtract') {
    updateOperation = { $inc: { quantity: -quantity } };
  } else {
    updateOperation = { quantity };
  }

  const product = await Product.findByIdAndUpdate(
    req.params.id,
    updateOperation,
    {
      new: true,
      runValidators: true
    }
  );

  if (!product || !product.isActive) {
    return next(new AppError('Product not found', 404));
  }

  if (product.quantity < 0) {
    return next(new AppError('Insufficient stock', 400));
  }

  res.status(200).json({
    status: 'success',
    data: {
      product
    }
  });
});

// Get products statistics
export const getProductStats = catchAsync(async (req, res, next) => {
  const stats = await Product.aggregate([
    {
      $match: { isActive: true }
    },
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
  ]);

  const categoryStats = await Product.aggregate([
    {
      $match: { isActive: true }
    },
    {
      $group: {
        _id: '$category',
        count: { $sum: 1 },
        totalValue: { $sum: { $multiply: ['$sellPrice', '$quantity'] } },
        totalQuantity: { $sum: '$quantity' }
      }
    },
    {
      $sort: { count: -1 }
    }
  ]);

  res.status(200).json({
    status: 'success',
    data: {
      overall: stats[0] || {
        totalProducts: 0,
        totalInventoryValue: 0,
        totalQuantity: 0,
        averagePrice: 0,
        lowStockCount: 0
      },
      categories: categoryStats
    }
  });
});