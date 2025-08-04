import express from 'express';
import { body, validationResult } from 'express-validator';
import mongoose from 'mongoose';
import Sale from '../models/Sale.js';
import Product from '../models/Product.js';

const router = express.Router();

// Validation middleware for sales
const validateSale = [
  body('products').isArray({ min: 1 }).withMessage('Products array is required and must not be empty'),
  body('products.*.productId').isMongoId().withMessage('Valid product ID is required'),
  body('products.*.quantity').isInt({ min: 1 }).withMessage('Quantity must be a positive integer'),
  body('products.*.sellPrice').isFloat({ min: 0 }).withMessage('Sell price must be a positive number'),
  body('cashierName').trim().isLength({ min: 1 }).withMessage('Cashier name is required'),
  body('totalAmount').isFloat({ min: 0 }).withMessage('Total amount must be a positive number')
];

// GET /api/sales - Get all sales with pagination
router.get('/', async (req, res) => {
  try {
    const { page = 1, limit = 50, startDate, endDate, cashier, status = 'completed' } = req.query;
    let query = { status };

    // Date range filter
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }

    // Cashier filter
    if (cashier) {
      query.cashierName = { $regex: cashier, $options: 'i' };
    }

    // Calculate pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Execute query with pagination
    const [sales, total] = await Promise.all([
      Sale.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .populate('products.productId', 'name category'),
      Sale.countDocuments(query)
    ]);

    // Format the response to match frontend expectations
    const formattedSales = sales.map(sale => ({
      id: sale._id,
      products: sale.products.map(item => ({
        productId: item.productId._id,
        productName: item.productName,
        quantity: item.quantity,
        sellPrice: item.sellPrice,
        total: item.total
      })),
      totalAmount: sale.totalAmount,
      cashierName: sale.cashierName,
      date: sale.createdAt,
      status: sale.status,
      paymentMethod: sale.paymentMethod
    }));

    res.json({
      sales: formattedSales,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Error fetching sales:', error);
    res.status(500).json({ error: 'Failed to fetch sales' });
  }
});

// GET /api/sales/:id - Get single sale
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const sale = await Sale.findById(id).populate('products.productId', 'name category');
    if (!sale) {
      return res.status(404).json({ error: 'Sale not found' });
    }

    const formattedSale = {
      id: sale._id,
      products: sale.products.map(item => ({
        productId: item.productId._id,
        productName: item.productName,
        quantity: item.quantity,
        sellPrice: item.sellPrice,
        total: item.total
      })),
      totalAmount: sale.totalAmount,
      cashierName: sale.cashierName,
      date: sale.createdAt,
      status: sale.status,
      paymentMethod: sale.paymentMethod,
      notes: sale.notes
    };

    res.json(formattedSale);
  } catch (error) {
    console.error('Error fetching sale:', error);
    if (error.name === 'CastError') {
      return res.status(400).json({ error: 'Invalid sale ID' });
    }
    res.status(500).json({ error: 'Failed to fetch sale' });
  }
});

// POST /api/sales - Create new sale (with transaction)
router.post('/', validateSale, async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { products, totalAmount, cashierName, paymentMethod = 'cash', notes } = req.body;

  // Start a MongoDB session for transaction
  const session = await mongoose.startSession();
  
  try {
    session.startTransaction();

    // Validate stock availability and get product details
    const productUpdates = [];
    const saleProducts = [];

    for (const item of products) {
      const product = await Product.findById(item.productId).session(session);
      
      if (!product) {
        throw new Error(`Product ${item.productId} not found`);
      }

      if (product.quantity < item.quantity) {
        throw new Error(`Insufficient stock for ${product.name}. Available: ${product.quantity}, Requested: ${item.quantity}`);
      }

      // Prepare product update
      productUpdates.push({
        updateOne: {
          filter: { _id: item.productId },
          update: { $inc: { quantity: -item.quantity } }
        }
      });

      // Prepare sale product data
      saleProducts.push({
        productId: item.productId,
        productName: item.productName || product.name,
        quantity: item.quantity,
        sellPrice: item.sellPrice,
        total: item.quantity * item.sellPrice
      });
    }

    // Create the sale
    const sale = new Sale({
      products: saleProducts,
      totalAmount,
      cashierName,
      paymentMethod,
      notes,
      status: 'completed'
    });

    await sale.save({ session });

    // Update product quantities
    await Product.bulkWrite(productUpdates, { session });

    // Commit transaction
    await session.commitTransaction();

    // Populate product details for response
    await sale.populate('products.productId', 'name category');

    const formattedSale = {
      id: sale._id,
      products: sale.products.map(item => ({
        productId: item.productId._id,
        productName: item.productName,
        quantity: item.quantity,
        sellPrice: item.sellPrice,
        total: item.total
      })),
      totalAmount: sale.totalAmount,
      cashierName: sale.cashierName,
      date: sale.createdAt,
      status: sale.status,
      paymentMethod: sale.paymentMethod
    };

    res.status(201).json(formattedSale);
  } catch (error) {
    // Rollback transaction on error
    await session.abortTransaction();
    console.error('Error creating sale:', error);
    res.status(500).json({ 
      error: 'Failed to create sale',
      message: error.message 
    });
  } finally {
    session.endSession();
  }
});

// GET /api/sales/today/summary - Get today's sales summary
router.get('/today/summary', async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const [summary] = await Sale.aggregate([
      {
        $match: {
          createdAt: { $gte: today, $lt: tomorrow },
          status: 'completed'
        }
      },
      {
        $group: {
          _id: null,
          totalSales: { $sum: 1 },
          totalRevenue: { $sum: '$totalAmount' },
          averageSale: { $avg: '$totalAmount' }
        }
      }
    ]);

    res.json({
      totalSales: summary?.totalSales || 0,
      totalRevenue: summary?.totalRevenue || 0,
      averageSale: summary?.averageSale || 0,
      date: today.toISOString().split('T')[0]
    });
  } catch (error) {
    console.error('Error fetching today\'s summary:', error);
    res.status(500).json({ error: 'Failed to fetch today\'s sales summary' });
  }
});

// PUT /api/sales/:id/void - Void a sale (with inventory restoration)
router.put('/:id/void', async (req, res) => {
  const { id } = req.params;
  const session = await mongoose.startSession();

  try {
    session.startTransaction();

    const sale = await Sale.findById(id).session(session);
    if (!sale) {
      throw new Error('Sale not found');
    }

    if (sale.status === 'voided') {
      throw new Error('Sale is already voided');
    }

    // Restore inventory for each product
    const productUpdates = sale.products.map(item => ({
      updateOne: {
        filter: { _id: item.productId },
        update: { $inc: { quantity: item.quantity } }
      }
    }));

    // Update product quantities
    await Product.bulkWrite(productUpdates, { session });

    // Update sale status
    sale.status = 'voided';
    await sale.save({ session });

    await session.commitTransaction();

    res.json({ 
      message: 'Sale voided successfully and inventory restored',
      sale: {
        id: sale._id,
        status: sale.status,
        totalAmount: sale.totalAmount,
        voidedAt: new Date()
      }
    });
  } catch (error) {
    await session.abortTransaction();
    console.error('Error voiding sale:', error);
    if (error.name === 'CastError') {
      return res.status(400).json({ error: 'Invalid sale ID' });
    }
    res.status(500).json({ 
      error: 'Failed to void sale',
      message: error.message 
    });
  } finally {
    session.endSession();
  }
});

// DELETE /api/sales/:id - Delete/void a sale (alias for void)
router.delete('/:id', async (req, res) => {
  // Redirect to void endpoint
  req.url = `/${req.params.id}/void`;
  req.method = 'PUT';
  return router.handle(req, res);
});

// GET /api/sales/stats/daily - Get daily sales statistics
router.get('/stats/daily', async (req, res) => {
  try {
    const { days = 30 } = req.query;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(days));
    startDate.setHours(0, 0, 0, 0);

    const dailyStats = await Sale.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate },
          status: 'completed'
        }
      },
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' },
            day: { $dayOfMonth: '$createdAt' }
          },
          totalSales: { $sum: 1 },
          totalRevenue: { $sum: '$totalAmount' },
          averageSale: { $avg: '$totalAmount' }
        }
      },
      {
        $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 }
      }
    ]);

    const formattedStats = dailyStats.map(stat => ({
      date: `${stat._id.year}-${String(stat._id.month).padStart(2, '0')}-${String(stat._id.day).padStart(2, '0')}`,
      totalSales: stat.totalSales,
      totalRevenue: stat.totalRevenue,
      averageSale: stat.averageSale
    }));

    res.json(formattedStats);
  } catch (error) {
    console.error('Error fetching daily stats:', error);
    res.status(500).json({ error: 'Failed to fetch daily statistics' });
  }
});

export default router;