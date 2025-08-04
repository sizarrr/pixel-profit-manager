import sqlite3 from 'sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Database path
const DB_PATH = join(__dirname, '../../database.sqlite');

// Create database connection
export const db = new sqlite3.Database(DB_PATH, (err) => {
  if (err) {
    console.error('Error opening database:', err.message);
  } else {
    console.log('Connected to SQLite database');
  }
});

// Database initialization
export const initializeDatabase = () => {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      // Create products table
      db.run(`
        CREATE TABLE IF NOT EXISTS products (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          category TEXT NOT NULL,
          buy_price REAL NOT NULL,
          sell_price REAL NOT NULL,
          quantity INTEGER NOT NULL DEFAULT 0,
          description TEXT,
          image TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `, (err) => {
        if (err) {
          console.error('Error creating products table:', err.message);
          reject(err);
          return;
        }
      });

      // Create sales table
      db.run(`
        CREATE TABLE IF NOT EXISTS sales (
          id TEXT PRIMARY KEY,
          total_amount REAL NOT NULL,
          cashier_name TEXT NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `, (err) => {
        if (err) {
          console.error('Error creating sales table:', err.message);
          reject(err);
          return;
        }
      });

      // Create sale_items table (junction table for sales and products)
      db.run(`
        CREATE TABLE IF NOT EXISTS sale_items (
          id TEXT PRIMARY KEY,
          sale_id TEXT NOT NULL,
          product_id TEXT NOT NULL,
          product_name TEXT NOT NULL,
          quantity INTEGER NOT NULL,
          sell_price REAL NOT NULL,
          total REAL NOT NULL,
          FOREIGN KEY (sale_id) REFERENCES sales (id) ON DELETE CASCADE,
          FOREIGN KEY (product_id) REFERENCES products (id) ON DELETE CASCADE
        )
      `, (err) => {
        if (err) {
          console.error('Error creating sale_items table:', err.message);
          reject(err);
          return;
        }
        resolve();
      });

      // Create indexes for better performance
      db.run(`CREATE INDEX IF NOT EXISTS idx_products_category ON products(category)`);
      db.run(`CREATE INDEX IF NOT EXISTS idx_products_quantity ON products(quantity)`);
      db.run(`CREATE INDEX IF NOT EXISTS idx_sales_created_at ON sales(created_at)`);
      db.run(`CREATE INDEX IF NOT EXISTS idx_sale_items_sale_id ON sale_items(sale_id)`);
      db.run(`CREATE INDEX IF NOT EXISTS idx_sale_items_product_id ON sale_items(product_id)`);
    });
  });
};

// Helper function to run queries with promises
export const runQuery = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function(err) {
      if (err) {
        reject(err);
      } else {
        resolve({ id: this.lastID, changes: this.changes });
      }
    });
  });
};

// Helper function to get single row
export const getRow = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) {
        reject(err);
      } else {
        resolve(row);
      }
    });
  });
};

// Helper function to get all rows
export const getAllRows = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) {
        reject(err);
      } else {
        resolve(rows);
      }
    });
  });
};

// Close database connection
export const closeDatabase = () => {
  return new Promise((resolve, reject) => {
    db.close((err) => {
      if (err) {
        reject(err);
      } else {
        console.log('Database connection closed');
        resolve();
      }
    });
  });
};