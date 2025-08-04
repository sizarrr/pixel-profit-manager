import express from 'express';
import { body, validationResult } from 'express-validator';
import { v4 as uuidv4 } from 'uuid';
import { runQuery, getRow, getAllRows } from '../database/init.js';

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
    const { category, search, lowStock } = req.query;
    let sql = 'SELECT * FROM products WHERE 1=1';
    const params = [];

    if (category && category !== 'all') {
      sql += ' AND category = ?';
      params.push(category);
    }

    if (search) {
      sql += ' AND (name LIKE ? OR category LIKE ? OR description LIKE ?)';
      const searchTerm = `%${search}%`;
      params.push(searchTerm, searchTerm, searchTerm);
    }

    if (lowStock === 'true') {
      sql += ' AND quantity <= 5';
    }

    sql += ' ORDER BY created_at DESC';

    const products = await getAllRows(sql, params);
    
    // Convert database format to frontend format
    const formattedProducts = products.map(product => ({
      id: product.id,
      name: product.name,
      category: product.category,
      buyPrice: product.buy_price,
      sellPrice: product.sell_price,
      quantity: product.quantity,
      description: product.description,
      image: product.image,
      createdAt: new Date(product.created_at),
      updatedAt: new Date(product.updated_at)
    }));

    res.json(formattedProducts);
  } catch (error) {
    console.error('Error fetching products:', error);
    res.status(500).json({ error: 'Failed to fetch products' });
  }
});

// GET /api/products/:id - Get single product
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const product = await getRow('SELECT * FROM products WHERE id = ?', [id]);
    
    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }

    const formattedProduct = {
      id: product.id,
      name: product.name,
      category: product.category,
      buyPrice: product.buy_price,
      sellPrice: product.sell_price,
      quantity: product.quantity,
      description: product.description,
      image: product.image,
      createdAt: new Date(product.created_at),
      updatedAt: new Date(product.updated_at)
    };

    res.json(formattedProduct);
  } catch (error) {
    console.error('Error fetching product:', error);
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

    const { name, category, buyPrice, sellPrice, quantity, description, image } = req.body;
    const id = uuidv4();
    
    const sql = `
      INSERT INTO products (id, name, category, buy_price, sell_price, quantity, description, image)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `;
    
    await runQuery(sql, [id, name, category, buyPrice, sellPrice, quantity, description || '', image || '']);
    
    // Fetch the created product
    const newProduct = await getRow('SELECT * FROM products WHERE id = ?', [id]);
    
    const formattedProduct = {
      id: newProduct.id,
      name: newProduct.name,
      category: newProduct.category,
      buyPrice: newProduct.buy_price,
      sellPrice: newProduct.sell_price,
      quantity: newProduct.quantity,
      description: newProduct.description,
      image: newProduct.image,
      createdAt: new Date(newProduct.created_at),
      updatedAt: new Date(newProduct.updated_at)
    };

    res.status(201).json(formattedProduct);
  } catch (error) {
    console.error('Error creating product:', error);
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
    const { name, category, buyPrice, sellPrice, quantity, description, image } = req.body;

    // Check if product exists
    const existingProduct = await getRow('SELECT * FROM products WHERE id = ?', [id]);
    if (!existingProduct) {
      return res.status(404).json({ error: 'Product not found' });
    }

    const sql = `
      UPDATE products 
      SET name = ?, category = ?, buy_price = ?, sell_price = ?, quantity = ?, 
          description = ?, image = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `;
    
    await runQuery(sql, [name, category, buyPrice, sellPrice, quantity, description || '', image || '', id]);
    
    // Fetch the updated product
    const updatedProduct = await getRow('SELECT * FROM products WHERE id = ?', [id]);
    
    const formattedProduct = {
      id: updatedProduct.id,
      name: updatedProduct.name,
      category: updatedProduct.category,
      buyPrice: updatedProduct.buy_price,
      sellPrice: updatedProduct.sell_price,
      quantity: updatedProduct.quantity,
      description: updatedProduct.description,
      image: updatedProduct.image,
      createdAt: new Date(updatedProduct.created_at),
      updatedAt: new Date(updatedProduct.updated_at)
    };

    res.json(formattedProduct);
  } catch (error) {
    console.error('Error updating product:', error);
    res.status(500).json({ error: 'Failed to update product' });
  }
});

// DELETE /api/products/:id - Delete product
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // Check if product exists
    const existingProduct = await getRow('SELECT * FROM products WHERE id = ?', [id]);
    if (!existingProduct) {
      return res.status(404).json({ error: 'Product not found' });
    }

    // Check if product is used in any sales
    const salesCount = await getRow('SELECT COUNT(*) as count FROM sale_items WHERE product_id = ?', [id]);
    if (salesCount.count > 0) {
      return res.status(400).json({ 
        error: 'Cannot delete product that has been sold. Consider setting quantity to 0 instead.' 
      });
    }

    await runQuery('DELETE FROM products WHERE id = ?', [id]);
    
    res.json({ message: 'Product deleted successfully' });
  } catch (error) {
    console.error('Error deleting product:', error);
    res.status(500).json({ error: 'Failed to delete product' });
  }
});

// GET /api/products/categories/list - Get all categories
router.get('/categories/list', async (req, res) => {
  try {
    const categories = await getAllRows('SELECT DISTINCT category FROM products ORDER BY category');
    const categoryList = categories.map(row => row.category);
    res.json(categoryList);
  } catch (error) {
    console.error('Error fetching categories:', error);
    res.status(500).json({ error: 'Failed to fetch categories' });
  }
});

export default router;