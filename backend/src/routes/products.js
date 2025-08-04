import express from 'express';
import { body, validationResult } from 'express-validator';
import Product from '../models/Product.js';
import Sale from '../models/Sale.js';

const router = express.Router();

// Validation middleware
const validateProduct = [
  body('name').trim().isLength({ min: 1 }).withMessage('Product name is required'),
  body('category').trim().isLength({ min: 1 }).withMessage('Category is required'),
  body('buyPrice').isFloat({ min: 0 }).withMessage('Buy price must be a positive number'),
  body('sellPrice').isFloat({ min: 0 }).withMessage('Sell price must be a positive number'),
  body('quantity').isInt({ min: 0 }).withMessage('Quantity must be a non-negative integer'),
  body('description').optional().trim()
];

// GET /api/products - Get all products
router.get('/', async (req, res) => {
  try {
    const { category, search, lowStock, page = 1, limit = 50 } = req.query;
    let query = {};

    // Build query filters
    if (category && category !== 'all') {
      query.category = category;
    }

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { category: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }

    if (lowStock === 'true') {
      query.quantity = { $lte: 5 };
    }

    // Calculate pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Execute query with pagination
    const [products, total] = await Promise.all([
      Product.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      Product.countDocuments(query)
    ]);

    res.json({
      products,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Error fetching products:', error);
    res.status(500).json({ error: 'Failed to fetch products' });
  }
});

// GET /api/products/:id - Get single product
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const product = await Product.findById(id);
    
    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }

    res.json(product);
  } catch (error) {
    console.error('Error fetching product:', error);
    if (error.name === 'CastError') {
      return res.status(400).json({ error: 'Invalid product ID' });
    }
    res.status(500).json({ error: 'Failed to fetch product' });
  }
});

// POST /api/products - Create new product
router.post('/', validateProduct, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const productData = req.body;
    const product = new Product(productData);
    
    await product.save();
    
    res.status(201).json(product);
  } catch (error) {
    console.error('Error creating product:', error);
    if (error.name === 'ValidationError') {
      return res.status(400).json({ 
        error: 'Validation error',
        details: Object.values(error.errors).map(err => err.message)
      });
    }
    res.status(500).json({ error: 'Failed to create product' });
  }
});

// PUT /api/products/:id - Update product
router.put('/:id', validateProduct, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { id } = req.params;
    const updateData = req.body;

    const product = await Product.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    );

    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }

    res.json(product);
  } catch (error) {
    console.error('Error updating product:', error);
    if (error.name === 'CastError') {
      return res.status(400).json({ error: 'Invalid product ID' });
    }
    if (error.name === 'ValidationError') {
      return res.status(400).json({ 
        error: 'Validation error',
        details: Object.values(error.errors).map(err => err.message)
      });
    }
    res.status(500).json({ error: 'Failed to update product' });
  }
});

// DELETE /api/products/:id - Delete product
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // Check if product exists
    const product = await Product.findById(id);
    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }

    // Check if product is used in any sales
    const salesCount = await Sale.countDocuments({
      'products.productId': id,
      status: { $ne: 'voided' }
    });

    if (salesCount > 0) {
      return res.status(400).json({ 
        error: 'Cannot delete product that has been sold. Consider setting quantity to 0 instead.' 
      });
    }

    await Product.findByIdAndDelete(id);
    
    res.json({ message: 'Product deleted successfully' });
  } catch (error) {
    console.error('Error deleting product:', error);
    if (error.name === 'CastError') {
      return res.status(400).json({ error: 'Invalid product ID' });
    }
    res.status(500).json({ error: 'Failed to delete product' });
  }
});

// GET /api/products/categories/list - Get all categories
router.get('/categories/list', async (req, res) => {
  try {
    const categories = await Product.distinct('category');
    res.json(categories.sort());
  } catch (error) {
    console.error('Error fetching categories:', error);
    res.status(500).json({ error: 'Failed to fetch categories' });
  }
});

// GET /api/products/low-stock - Get low stock products
router.get('/low-stock', async (req, res) => {
  try {
    const { threshold = 5 } = req.query;
    const lowStockProducts = await Product.getLowStock(parseInt(threshold));
    res.json(lowStockProducts);
  } catch (error) {
    console.error('Error fetching low stock products:', error);
    res.status(500).json({ error: 'Failed to fetch low stock products' });
  }
});

// GET /api/products/search/:term - Search products
router.get('/search/:term', async (req, res) => {
  try {
    const { term } = req.params;
    const products = await Product.search(term);
    res.json(products);
  } catch (error) {
    console.error('Error searching products:', error);
    res.status(500).json({ error: 'Failed to search products' });
  }
});

export default router;