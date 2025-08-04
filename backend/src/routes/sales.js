import express from 'express';
import { body, validationResult } from 'express-validator';
import { v4 as uuidv4 } from 'uuid';
import { db, runQuery, getRow, getAllRows } from '../database/init.js';

const router = express.Router();

// Validation middleware for sales
const validateSale = [
  body('products').isArray({ min: 1 }).withMessage('Products array is required and must not be empty'),
  body('products.*.productId').isUUID().withMessage('Valid product ID is required'),
  body('products.*.quantity').isInt({ min: 1 }).withMessage('Quantity must be a positive integer'),
  body('products.*.sellPrice').isFloat({ min: 0 }).withMessage('Sell price must be a positive number'),
  body('cashierName').trim().isLength({ min: 1 }).withMessage('Cashier name is required'),
  body('totalAmount').isFloat({ min: 0 }).withMessage('Total amount must be a positive number')
];

// GET /api/sales - Get all sales with pagination
router.get('/', async (req, res) => {
  try {
    const { page = 1, limit = 50, startDate, endDate } = req.query;
    const offset = (page - 1) * limit;

    let sql = `
      SELECT s.*, GROUP_CONCAT(
        json_object(
          'productId', si.product_id,
          'productName', si.product_name,
          'quantity', si.quantity,
          'sellPrice', si.sell_price,
          'total', si.total
        )
      ) as products_json
      FROM sales s
      LEFT JOIN sale_items si ON s.id = si.sale_id
      WHERE 1=1
    `;
    const params = [];

    if (startDate) {
      sql += ' AND DATE(s.created_at) >= ?';
      params.push(startDate);
    }

    if (endDate) {
      sql += ' AND DATE(s.created_at) <= ?';
      params.push(endDate);
    }

    sql += ' GROUP BY s.id ORDER BY s.created_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), offset);

    const sales = await getAllRows(sql, params);

    // Format the response
    const formattedSales = sales.map(sale => {
      let products = [];
      if (sale.products_json) {
        try {
          // Parse the concatenated JSON objects
          const productsStr = sale.products_json.split(',');
          products = productsStr.map(p => JSON.parse(p));
        } catch (error) {
          console.error('Error parsing products JSON:', error);
          products = [];
        }
      }

      return {
        id: sale.id,
        products,
        totalAmount: sale.total_amount,
        cashierName: sale.cashier_name,
        date: new Date(sale.created_at)
      };
    });

    // Get total count for pagination
    let countSql = 'SELECT COUNT(*) as total FROM sales WHERE 1=1';
    const countParams = [];

    if (startDate) {
      countSql += ' AND DATE(created_at) >= ?';
      countParams.push(startDate);
    }

    if (endDate) {
      countSql += ' AND DATE(created_at) <= ?';
      countParams.push(endDate);
    }

    const { total } = await getRow(countSql, countParams);

    res.json({
      sales: formattedSales,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
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
    
    // Get sale details
    const sale = await getRow('SELECT * FROM sales WHERE id = ?', [id]);
    if (!sale) {
      return res.status(404).json({ error: 'Sale not found' });
    }

    // Get sale items
    const saleItems = await getAllRows('SELECT * FROM sale_items WHERE sale_id = ?', [id]);

    const formattedSale = {
      id: sale.id,
      products: saleItems.map(item => ({
        productId: item.product_id,
        productName: item.product_name,
        quantity: item.quantity,
        sellPrice: item.sell_price,
        total: item.total
      })),
      totalAmount: sale.total_amount,
      cashierName: sale.cashier_name,
      date: new Date(sale.created_at)
    };

    res.json(formattedSale);
  } catch (error) {
    console.error('Error fetching sale:', error);
    res.status(500).json({ error: 'Failed to fetch sale' });
  }
});

// POST /api/sales - Create new sale (with transaction)
router.post('/', validateSale, async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { products, totalAmount, cashierName } = req.body;
  const saleId = uuidv4();

  // Start transaction
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      db.run('BEGIN TRANSACTION');

      try {
        // Validate stock availability for all products first
        const stockChecks = products.map(item => {
          return new Promise((resolveCheck, rejectCheck) => {
            db.get('SELECT quantity FROM products WHERE id = ?', [item.productId], (err, row) => {
              if (err) {
                rejectCheck(err);
              } else if (!row) {
                rejectCheck(new Error(`Product ${item.productId} not found`));
              } else if (row.quantity < item.quantity) {
                rejectCheck(new Error(`Insufficient stock for product ${item.productId}. Available: ${row.quantity}, Requested: ${item.quantity}`));
              } else {
                resolveCheck();
              }
            });
          });
        });

        Promise.all(stockChecks)
          .then(() => {
            // Create the sale record
            db.run(
              'INSERT INTO sales (id, total_amount, cashier_name) VALUES (?, ?, ?)',
              [saleId, totalAmount, cashierName],
              function(err) {
                if (err) {
                  db.run('ROLLBACK');
                  return reject(err);
                }

                // Create sale items and update inventory
                let completedOperations = 0;
                const totalOperations = products.length * 2; // sale_item insert + inventory update

                products.forEach(item => {
                  const saleItemId = uuidv4();
                  
                  // Insert sale item
                  db.run(
                    'INSERT INTO sale_items (id, sale_id, product_id, product_name, quantity, sell_price, total) VALUES (?, ?, ?, ?, ?, ?, ?)',
                    [saleItemId, saleId, item.productId, item.productName, item.quantity, item.sellPrice, item.sellPrice * item.quantity],
                    (err) => {
                      if (err) {
                        db.run('ROLLBACK');
                        return reject(err);
                      }
                      
                      completedOperations++;
                      if (completedOperations === totalOperations) {
                        db.run('COMMIT', (commitErr) => {
                          if (commitErr) {
                            reject(commitErr);
                          } else {
                            resolve();
                          }
                        });
                      }
                    }
                  );

                  // Update product inventory
                  db.run(
                    'UPDATE products SET quantity = quantity - ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
                    [item.quantity, item.productId],
                    (err) => {
                      if (err) {
                        db.run('ROLLBACK');
                        return reject(err);
                      }
                      
                      completedOperations++;
                      if (completedOperations === totalOperations) {
                        db.run('COMMIT', (commitErr) => {
                          if (commitErr) {
                            reject(commitErr);
                          } else {
                            resolve();
                          }
                        });
                      }
                    }
                  );
                });
              }
            );
          })
          .catch(error => {
            db.run('ROLLBACK');
            reject(error);
          });

      } catch (error) {
        db.run('ROLLBACK');
        reject(error);
      }
    });
  })
  .then(async () => {
    // Fetch the created sale
    const newSale = await getRow('SELECT * FROM sales WHERE id = ?', [saleId]);
    const saleItems = await getAllRows('SELECT * FROM sale_items WHERE sale_id = ?', [saleId]);

    const formattedSale = {
      id: newSale.id,
      products: saleItems.map(item => ({
        productId: item.product_id,
        productName: item.product_name,
        quantity: item.quantity,
        sellPrice: item.sell_price,
        total: item.total
      })),
      totalAmount: newSale.total_amount,
      cashierName: newSale.cashier_name,
      date: new Date(newSale.created_at)
    };

    res.status(201).json(formattedSale);
  })
  .catch(error => {
    console.error('Error creating sale:', error);
    res.status(500).json({ 
      error: 'Failed to create sale',
      message: error.message 
    });
  });
});

// GET /api/sales/today/summary - Get today's sales summary
router.get('/today/summary', async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    
    const summary = await getRow(`
      SELECT 
        COUNT(*) as total_sales,
        COALESCE(SUM(total_amount), 0) as total_revenue,
        COALESCE(AVG(total_amount), 0) as average_sale
      FROM sales 
      WHERE DATE(created_at) = ?
    `, [today]);

    res.json({
      totalSales: summary.total_sales,
      totalRevenue: summary.total_revenue,
      averageSale: summary.average_sale,
      date: today
    });
  } catch (error) {
    console.error('Error fetching today\'s summary:', error);
    res.status(500).json({ error: 'Failed to fetch today\'s sales summary' });
  }
});

// DELETE /api/sales/:id - Delete/void a sale (with inventory restoration)
router.delete('/:id', async (req, res) => {
  const { id } = req.params;

  return new Promise((resolve, reject) => {
    db.serialize(() => {
      db.run('BEGIN TRANSACTION');

      try {
        // Get sale items to restore inventory
        db.all('SELECT * FROM sale_items WHERE sale_id = ?', [id], (err, saleItems) => {
          if (err) {
            db.run('ROLLBACK');
            return reject(err);
          }

          if (saleItems.length === 0) {
            db.run('ROLLBACK');
            return reject(new Error('Sale not found'));
          }

          // Restore inventory for each product
          let completedOperations = 0;
          const totalOperations = saleItems.length;

          saleItems.forEach(item => {
            db.run(
              'UPDATE products SET quantity = quantity + ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
              [item.quantity, item.product_id],
              (updateErr) => {
                if (updateErr) {
                  db.run('ROLLBACK');
                  return reject(updateErr);
                }

                completedOperations++;
                if (completedOperations === totalOperations) {
                  // Delete sale items and sale
                  db.run('DELETE FROM sale_items WHERE sale_id = ?', [id], (deleteItemsErr) => {
                    if (deleteItemsErr) {
                      db.run('ROLLBACK');
                      return reject(deleteItemsErr);
                    }

                    db.run('DELETE FROM sales WHERE id = ?', [id], (deleteSaleErr) => {
                      if (deleteSaleErr) {
                        db.run('ROLLBACK');
                        return reject(deleteSaleErr);
                      }

                      db.run('COMMIT', (commitErr) => {
                        if (commitErr) {
                          reject(commitErr);
                        } else {
                          resolve();
                        }
                      });
                    });
                  });
                }
              }
            );
          });
        });
      } catch (error) {
        db.run('ROLLBACK');
        reject(error);
      }
    });
  })
  .then(() => {
    res.json({ message: 'Sale voided successfully and inventory restored' });
  })
  .catch(error => {
    console.error('Error voiding sale:', error);
    res.status(500).json({ 
      error: 'Failed to void sale',
      message: error.message 
    });
  });
});

export default router;