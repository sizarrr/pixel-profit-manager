// Performance tests for FIFO implementation
import request from 'supertest';
import mongoose from 'mongoose';
import app from '../../server.js';
import Product from '../../models/Product.js';
import InventoryBatch from '../../models/InventoryBatch.js';
import Sale from '../../models/Sale.js';

describe('FIFO Performance Tests', () => {
  let testProducts = [];

  beforeAll(async () => {
    await mongoose.connect(process.env.MONGODB_TEST_URI || 'mongodb://localhost:27017/pos_test');
    
    // Increase timeout for performance tests
    jest.setTimeout(30000);
  });

  beforeEach(async () => {
    await Sale.deleteMany({});
    await InventoryBatch.deleteMany({});
    await Product.deleteMany({});
    testProducts = [];
  });

  afterEach(async () => {
    await Sale.deleteMany({});
    await InventoryBatch.deleteMany({});
    await Product.deleteMany({});
  });

  afterAll(async () => {
    await mongoose.connection.close();
  });

  describe('Large Inventory Performance', () => {
    test('should handle sales with 1000+ inventory batches efficiently', async () => {
      console.log('Creating test product...');
      const product = await Product.create({
        name: 'Performance Test Product',
        category: 'Test',
        buyPrice: 100,
        sellPrice: 150,
        quantity: 0,
        lowStockThreshold: 10
      });

      console.log('Creating 1000 inventory batches...');
      const startSetup = Date.now();
      
      // Create batches in chunks to avoid memory issues
      const batchSize = 100;
      const totalBatches = 1000;
      
      for (let i = 0; i < totalBatches; i += batchSize) {
        const batches = [];
        const endIndex = Math.min(i + batchSize, totalBatches);
        
        for (let j = i; j < endIndex; j++) {
          batches.push({
            productId: product._id,
            buyPrice: 100 + (j % 50), // Varying prices
            initialQuantity: 10,
            remainingQuantity: 10,
            purchaseDate: new Date(2024, 0, 1 + j), // Sequential dates for proper FIFO
            supplierName: `Supplier ${j % 10}`,
            notes: `Batch ${j + 1}`
          });
        }
        
        await InventoryBatch.insertMany(batches);
      }
      
      const setupTime = Date.now() - startSetup;
      console.log(`Setup completed in ${setupTime}ms`);

      console.log('Performing large FIFO sale...');
      const startSale = Date.now();
      
      const saleData = {
        products: [{
          productId: product._id,
          productName: product.name,
          quantity: 2500, // 25% of total inventory (10,000 items)
          sellPrice: product.sellPrice,
          total: product.sellPrice * 2500
        }],
        totalAmount: product.sellPrice * 2500,
        cashierName: 'Performance Test Cashier',
        paymentMethod: 'cash'
      };

      const response = await request(app)
        .post('/api/v1/sales')
        .send(saleData)
        .expect(201);

      const saleTime = Date.now() - startSale;
      console.log(`Sale completed in ${saleTime}ms`);

      // Verify the sale was processed correctly
      const sale = response.body.data.sale;
      expect(sale.products[0].batchAllocations).toHaveLength(250); // 2500 items / 10 per batch
      expect(sale.products[0].quantity).toBe(2500);

      // Performance assertions
      expect(saleTime).toBeLessThan(10000); // Should complete within 10 seconds
      expect(setupTime).toBeLessThan(15000); // Setup should be reasonable

      console.log('Verifying FIFO order...');
      // Verify FIFO order (first few allocations should be from earliest batches)
      const allocations = sale.products[0].batchAllocations;
      expect(allocations[0].buyPrice).toBe(100); // First batch price
      expect(allocations[1].buyPrice).toBe(101); // Second batch price
    });

    test('should handle multiple concurrent sales efficiently', async () => {
      console.log('Setting up concurrent sales test...');
      
      const product = await Product.create({
        name: 'Concurrent Test Product',
        category: 'Test',
        buyPrice: 100,
        sellPrice: 150,
        quantity: 0,
        lowStockThreshold: 10
      });

      // Create 100 batches with 100 items each = 10,000 total
      const batches = [];
      for (let i = 0; i < 100; i++) {
        batches.push({
          productId: product._id,
          buyPrice: 100 + i,
          initialQuantity: 100,
          remainingQuantity: 100,
          purchaseDate: new Date(2024, 0, 1 + i),
          supplierName: `Supplier ${i}`,
          notes: `Concurrent test batch ${i + 1}`
        });
      }
      await InventoryBatch.insertMany(batches);

      console.log('Starting concurrent sales...');
      const startTime = Date.now();
      
      // Create 10 concurrent sales of 50 items each
      const salePromises = [];
      for (let i = 0; i < 10; i++) {
        const saleData = {
          products: [{
            productId: product._id,
            productName: product.name,
            quantity: 50,
            sellPrice: product.sellPrice,
            total: product.sellPrice * 50
          }],
          totalAmount: product.sellPrice * 50,
          cashierName: `Cashier ${i + 1}`,
          paymentMethod: 'cash'
        };

        salePromises.push(
          request(app)
            .post('/api/v1/sales')
            .send(saleData)
        );
      }

      const results = await Promise.allSettled(salePromises);
      const concurrentTime = Date.now() - startTime;
      
      console.log(`Concurrent sales completed in ${concurrentTime}ms`);

      // All sales should succeed (we have enough inventory)
      const successful = results.filter(r => r.status === 'fulfilled' && r.value.status === 201);
      expect(successful).toHaveLength(10);

      // Performance assertion
      expect(concurrentTime).toBeLessThan(15000); // Should complete within 15 seconds

      // Verify total items sold
      const totalSales = await Sale.find({});
      const totalItemsSold = totalSales.reduce((sum, sale) => {
        return sum + sale.products.reduce((pSum, product) => pSum + product.quantity, 0);
      }, 0);
      expect(totalItemsSold).toBe(500); // 10 sales × 50 items
    });
  });

  describe('Complex Multi-Product Performance', () => {
    test('should handle sales with multiple products and many batches', async () => {
      console.log('Setting up multi-product performance test...');
      
      // Create 5 products
      const products = [];
      for (let p = 0; p < 5; p++) {
        const product = await Product.create({
          name: `Product ${p + 1}`,
          category: 'Test',
          buyPrice: 100 + p * 10,
          sellPrice: 150 + p * 15,
          quantity: 0,
          lowStockThreshold: 5
        });
        products.push(product);

        // Create 100 batches per product
        const batches = [];
        for (let b = 0; b < 100; b++) {
          batches.push({
            productId: product._id,
            buyPrice: 100 + p * 10 + b,
            initialQuantity: 20,
            remainingQuantity: 20,
            purchaseDate: new Date(2024, 0, 1 + b),
            supplierName: `Supplier ${b % 5}`,
            notes: `Product ${p + 1} Batch ${b + 1}`
          });
        }
        await InventoryBatch.insertMany(batches);
      }

      console.log('Performing complex multi-product sale...');
      const startTime = Date.now();

      const saleData = {
        products: products.map((product, index) => ({
          productId: product._id,
          productName: product.name,
          quantity: 150, // Will span multiple batches per product
          sellPrice: product.sellPrice,
          total: product.sellPrice * 150
        })),
        totalAmount: products.reduce((sum, product) => sum + product.sellPrice * 150, 0),
        cashierName: 'Multi-Product Test Cashier',
        paymentMethod: 'cash'
      };

      const response = await request(app)
        .post('/api/v1/sales')
        .send(saleData)
        .expect(201);

      const saleTime = Date.now() - startTime;
      console.log(`Multi-product sale completed in ${saleTime}ms`);

      // Verify the sale
      const sale = response.body.data.sale;
      expect(sale.products).toHaveLength(5);
      
      // Each product should have batch allocations
      sale.products.forEach((product, index) => {
        expect(product.batchAllocations.length).toBeGreaterThan(0);
        expect(product.quantity).toBe(150);
      });

      // Performance assertion
      expect(saleTime).toBeLessThan(8000); // Should complete within 8 seconds
    });
  });

  describe('Memory Usage Tests', () => {
    test('should handle large batch queries without memory issues', async () => {
      const product = await Product.create({
        name: 'Memory Test Product',
        category: 'Test',
        buyPrice: 100,
        sellPrice: 150,
        quantity: 0,
        lowStockThreshold: 1
      });

      console.log('Creating large number of batches for memory test...');
      
      // Create 5000 small batches
      const batchSize = 500;
      const totalBatches = 5000;
      
      for (let i = 0; i < totalBatches; i += batchSize) {
        const batches = [];
        const endIndex = Math.min(i + batchSize, totalBatches);
        
        for (let j = i; j < endIndex; j++) {
          batches.push({
            productId: product._id,
            buyPrice: 100 + (j % 100),
            initialQuantity: 2,
            remainingQuantity: 2,
            purchaseDate: new Date(2024, 0, 1, j % 24, j % 60), // Dense time distribution
            supplierName: `Supplier ${j % 20}`,
            notes: `Memory test batch ${j + 1}`
          });
        }
        
        await InventoryBatch.insertMany(batches);
        
        // Force garbage collection if available
        if (global.gc) {
          global.gc();
        }
      }

      console.log('Testing batch query performance...');
      const startQuery = Date.now();
      
      const availableBatches = await InventoryBatch.find({
        productId: product._id,
        remainingQuantity: { $gt: 0 },
        isActive: true
      }).sort({ purchaseDate: 1, createdAt: 1 });
      
      const queryTime = Date.now() - startQuery;
      console.log(`Batch query completed in ${queryTime}ms`);
      
      expect(availableBatches).toHaveLength(5000);
      expect(queryTime).toBeLessThan(5000); // Query should complete within 5 seconds

      // Test a medium-sized sale
      console.log('Testing sale with large batch set...');
      const startSale = Date.now();
      
      const saleData = {
        products: [{
          productId: product._id,
          productName: product.name,
          quantity: 1000, // Will span 500 batches
          sellPrice: product.sellPrice,
          total: product.sellPrice * 1000
        }],
        totalAmount: product.sellPrice * 1000,
        cashierName: 'Memory Test Cashier',
        paymentMethod: 'cash'
      };

      const response = await request(app)
        .post('/api/v1/sales')
        .send(saleData)
        .expect(201);

      const saleTime = Date.now() - startSale;
      console.log(`Sale with large batch set completed in ${saleTime}ms`);

      expect(saleTime).toBeLessThan(10000); // Should complete within 10 seconds
      
      const sale = response.body.data.sale;
      expect(sale.products[0].batchAllocations).toHaveLength(500); // 1000 items / 2 per batch
    });
  });

  describe('Database Index Performance', () => {
    test('should efficiently use database indexes for FIFO queries', async () => {
      const product = await Product.create({
        name: 'Index Test Product',
        category: 'Test',
        buyPrice: 100,
        sellPrice: 150,
        quantity: 0,
        lowStockThreshold: 1
      });

      // Create batches with random dates to test sorting performance
      const batches = [];
      const dates = [];
      
      // Generate random dates over 2 years
      for (let i = 0; i < 1000; i++) {
        const randomDate = new Date(2022 + Math.random() * 2, Math.floor(Math.random() * 12), Math.floor(Math.random() * 28) + 1);
        dates.push(randomDate);
      }
      
      // Sort dates to verify FIFO behavior
      dates.sort((a, b) => a - b);
      
      for (let i = 0; i < 1000; i++) {
        batches.push({
          productId: product._id,
          buyPrice: 100 + i,
          initialQuantity: 5,
          remainingQuantity: 5,
          purchaseDate: dates[i],
          supplierName: `Supplier ${i % 10}`,
          notes: `Index test batch ${i + 1}`
        });
      }
      
      await InventoryBatch.insertMany(batches);

      console.log('Testing FIFO query with complex sorting...');
      const startTime = Date.now();
      
      // This query should use the compound index (productId, purchaseDate)
      const availableBatches = await InventoryBatch.find({
        productId: product._id,
        remainingQuantity: { $gt: 0 },
        isActive: true
      }).sort({ purchaseDate: 1, createdAt: 1 }).limit(100);
      
      const queryTime = Date.now() - startTime;
      console.log(`Indexed FIFO query completed in ${queryTime}ms`);
      
      expect(queryTime).toBeLessThan(1000); // Should be very fast with proper indexing
      expect(availableBatches).toHaveLength(100);
      
      // Verify proper FIFO order
      for (let i = 1; i < availableBatches.length; i++) {
        const prev = new Date(availableBatches[i - 1].purchaseDate);
        const curr = new Date(availableBatches[i].purchaseDate);
        expect(curr.getTime()).toBeGreaterThanOrEqual(prev.getTime());
      }
    });
  });
});