// Edge case tests for FIFO implementation
import request from 'supertest';
import mongoose from 'mongoose';
import app from '../../server.js';
import Product from '../../models/Product.js';
import InventoryBatch from '../../models/InventoryBatch.js';
import Sale from '../../models/Sale.js';

describe('FIFO Edge Cases', () => {
  let testProduct;

  beforeAll(async () => {
    await mongoose.connect(process.env.MONGODB_TEST_URI || 'mongodb://localhost:27017/pos_test');
  });

  beforeEach(async () => {
    await Sale.deleteMany({});
    await InventoryBatch.deleteMany({});
    await Product.deleteMany({});

    testProduct = await Product.create({
      name: 'Edge Case Product',
      category: 'Test',
      buyPrice: 100,
      sellPrice: 150,
      quantity: 0,
      lowStockThreshold: 1
    });
  });

  afterEach(async () => {
    await Sale.deleteMany({});
    await InventoryBatch.deleteMany({});
    await Product.deleteMany({});
  });

  afterAll(async () => {
    await mongoose.connection.close();
  });

  describe('Zero and Negative Quantities', () => {
    test('should handle zero quantity sale gracefully', async () => {
      await InventoryBatch.create({
        productId: testProduct._id,
        buyPrice: 100,
        initialQuantity: 5,
        remainingQuantity: 5,
        purchaseDate: new Date('2024-01-01')
      });

      const saleData = {
        products: [{
          productId: testProduct._id,
          productName: testProduct.name,
          quantity: 0,
          sellPrice: testProduct.sellPrice,
          total: 0
        }],
        totalAmount: 0,
        cashierName: 'Test Cashier',
        paymentMethod: 'cash'
      };

      const response = await request(app)
        .post('/api/v1/sales')
        .send(saleData)
        .expect(201);

      const sale = response.body.data.sale;
      expect(sale.products[0].batchAllocations).toHaveLength(0);
    });

    test('should reject negative quantity sale', async () => {
      const saleData = {
        products: [{
          productId: testProduct._id,
          productName: testProduct.name,
          quantity: -5,
          sellPrice: testProduct.sellPrice,
          total: testProduct.sellPrice * -5
        }],
        totalAmount: testProduct.sellPrice * -5,
        cashierName: 'Test Cashier',
        paymentMethod: 'cash'
      };

      await request(app)
        .post('/api/v1/sales')
        .send(saleData)
        .expect(400);
    });
  });

  describe('Empty Inventory Scenarios', () => {
    test('should handle sale when no inventory batches exist', async () => {
      const saleData = {
        products: [{
          productId: testProduct._id,
          productName: testProduct.name,
          quantity: 1,
          sellPrice: testProduct.sellPrice,
          total: testProduct.sellPrice
        }],
        totalAmount: testProduct.sellPrice,
        cashierName: 'Test Cashier',
        paymentMethod: 'cash'
      };

      const response = await request(app)
        .post('/api/v1/sales')
        .send(saleData)
        .expect(400);

      expect(response.body.message).toContain('Insufficient stock');
    });

    test('should handle sale when all batches are empty', async () => {
      await InventoryBatch.create({
        productId: testProduct._id,
        buyPrice: 100,
        initialQuantity: 5,
        remainingQuantity: 0, // Empty batch
        purchaseDate: new Date('2024-01-01')
      });

      const saleData = {
        products: [{
          productId: testProduct._id,
          productName: testProduct.name,
          quantity: 1,
          sellPrice: testProduct.sellPrice,
          total: testProduct.sellPrice
        }],
        totalAmount: testProduct.sellPrice,
        cashierName: 'Test Cashier',
        paymentMethod: 'cash'
      };

      await request(app)
        .post('/api/v1/sales')
        .send(saleData)
        .expect(400);
    });
  });

  describe('Inactive Batch Handling', () => {
    test('should skip inactive batches in FIFO allocation', async () => {
      // Create inactive batch (older)
      await InventoryBatch.create({
        productId: testProduct._id,
        buyPrice: 90,
        initialQuantity: 10,
        remainingQuantity: 10,
        purchaseDate: new Date('2024-01-01'),
        isActive: false
      });

      // Create active batch (newer)
      const activeBatch = await InventoryBatch.create({
        productId: testProduct._id,
        buyPrice: 110,
        initialQuantity: 5,
        remainingQuantity: 5,
        purchaseDate: new Date('2024-01-15'),
        isActive: true
      });

      const saleData = {
        products: [{
          productId: testProduct._id,
          productName: testProduct.name,
          quantity: 3,
          sellPrice: testProduct.sellPrice,
          total: testProduct.sellPrice * 3
        }],
        totalAmount: testProduct.sellPrice * 3,
        cashierName: 'Test Cashier',
        paymentMethod: 'cash'
      };

      const response = await request(app)
        .post('/api/v1/sales')
        .send(saleData)
        .expect(201);

      const sale = response.body.data.sale;
      expect(sale.products[0].batchAllocations).toHaveLength(1);
      expect(sale.products[0].batchAllocations[0]).toMatchObject({
        batchId: activeBatch._id.toString(),
        quantity: 3,
        buyPrice: 110
      });
    });
  });

  describe('Concurrent Sales Simulation', () => {
    test('should handle race conditions gracefully', async () => {
      const batch = await InventoryBatch.create({
        productId: testProduct._id,
        buyPrice: 100,
        initialQuantity: 5,
        remainingQuantity: 5,
        purchaseDate: new Date('2024-01-01')
      });

      // Simulate concurrent sales that together exceed available stock
      const sale1Promise = request(app)
        .post('/api/v1/sales')
        .send({
          products: [{
            productId: testProduct._id,
            productName: testProduct.name,
            quantity: 4,
            sellPrice: testProduct.sellPrice,
            total: testProduct.sellPrice * 4
          }],
          totalAmount: testProduct.sellPrice * 4,
          cashierName: 'Cashier 1',
          paymentMethod: 'cash'
        });

      const sale2Promise = request(app)
        .post('/api/v1/sales')
        .send({
          products: [{
            productId: testProduct._id,
            productName: testProduct.name,
            quantity: 3,
            sellPrice: testProduct.sellPrice,
            total: testProduct.sellPrice * 3
          }],
          totalAmount: testProduct.sellPrice * 3,
          cashierName: 'Cashier 2',
          paymentMethod: 'cash'
        });

      const [response1, response2] = await Promise.allSettled([sale1Promise, sale2Promise]);

      // One should succeed, one should fail
      const successes = [response1, response2].filter(r => r.status === 'fulfilled' && r.value.status === 201);
      const failures = [response1, response2].filter(r => r.status === 'fulfilled' && r.value.status === 400);

      expect(successes).toHaveLength(1);
      expect(failures).toHaveLength(1);

      // Verify final inventory state is consistent
      const finalBatch = await InventoryBatch.findById(batch._id);
      expect(finalBatch.remainingQuantity).toBeGreaterThanOrEqual(0);
      expect(finalBatch.remainingQuantity).toBeLessThan(5);
    });
  });

  describe('Large Quantity Scenarios', () => {
    test('should handle very large quantities efficiently', async () => {
      // Create many small batches
      const batchPromises = [];
      for (let i = 0; i < 100; i++) {
        batchPromises.push(InventoryBatch.create({
          productId: testProduct._id,
          buyPrice: 100 + i,
          initialQuantity: 10,
          remainingQuantity: 10,
          purchaseDate: new Date(2024, 0, i + 1) // Sequential dates
        }));
      }
      await Promise.all(batchPromises);

      const saleData = {
        products: [{
          productId: testProduct._id,
          productName: testProduct.name,
          quantity: 500, // Half of total inventory
          sellPrice: testProduct.sellPrice,
          total: testProduct.sellPrice * 500
        }],
        totalAmount: testProduct.sellPrice * 500,
        cashierName: 'Test Cashier',
        paymentMethod: 'cash'
      };

      const startTime = Date.now();
      const response = await request(app)
        .post('/api/v1/sales')
        .send(saleData)
        .expect(201);
      const endTime = Date.now();

      // Should complete within reasonable time (adjust threshold as needed)
      expect(endTime - startTime).toBeLessThan(5000);

      const sale = response.body.data.sale;
      expect(sale.products[0].batchAllocations).toHaveLength(50); // 500 items / 10 per batch
    });
  });

  describe('Fractional Quantities', () => {
    test('should handle fractional quantities correctly', async () => {
      await InventoryBatch.create({
        productId: testProduct._id,
        buyPrice: 100,
        initialQuantity: 10.5,
        remainingQuantity: 10.5,
        purchaseDate: new Date('2024-01-01')
      });

      const saleData = {
        products: [{
          productId: testProduct._id,
          productName: testProduct.name,
          quantity: 2.5,
          sellPrice: testProduct.sellPrice,
          total: testProduct.sellPrice * 2.5
        }],
        totalAmount: testProduct.sellPrice * 2.5,
        cashierName: 'Test Cashier',
        paymentMethod: 'cash'
      };

      const response = await request(app)
        .post('/api/v1/sales')
        .send(saleData)
        .expect(201);

      const sale = response.body.data.sale;
      expect(sale.products[0].batchAllocations[0].quantity).toBe(2.5);

      const updatedBatch = await InventoryBatch.findOne({ productId: testProduct._id });
      expect(updatedBatch.remainingQuantity).toBe(8);
    });
  });

  describe('Database Connection Issues', () => {
    test('should handle transaction rollback on database error', async () => {
      await InventoryBatch.create({
        productId: testProduct._id,
        buyPrice: 100,
        initialQuantity: 5,
        remainingQuantity: 5,
        purchaseDate: new Date('2024-01-01')
      });

      // Mock database error during transaction
      const originalUpdate = InventoryBatch.findByIdAndUpdate;
      InventoryBatch.findByIdAndUpdate = jest.fn().mockRejectedValueOnce(new Error('Database error'));

      const saleData = {
        products: [{
          productId: testProduct._id,
          productName: testProduct.name,
          quantity: 3,
          sellPrice: testProduct.sellPrice,
          total: testProduct.sellPrice * 3
        }],
        totalAmount: testProduct.sellPrice * 3,
        cashierName: 'Test Cashier',
        paymentMethod: 'cash'
      };

      await request(app)
        .post('/api/v1/sales')
        .send(saleData)
        .expect(500);

      // Verify no partial updates occurred
      const batch = await InventoryBatch.findOne({ productId: testProduct._id });
      expect(batch.remainingQuantity).toBe(5);

      const salesCount = await Sale.countDocuments();
      expect(salesCount).toBe(0);

      // Restore original method
      InventoryBatch.findByIdAndUpdate = originalUpdate;
    });
  });

  describe('Product State Consistency', () => {
    test('should maintain product quantity consistency after complex operations', async () => {
      // Create multiple batches
      const batch1 = await InventoryBatch.create({
        productId: testProduct._id,
        buyPrice: 100,
        initialQuantity: 10,
        remainingQuantity: 10,
        purchaseDate: new Date('2024-01-01')
      });

      const batch2 = await InventoryBatch.create({
        productId: testProduct._id,
        buyPrice: 120,
        initialQuantity: 15,
        remainingQuantity: 15,
        purchaseDate: new Date('2024-01-15')
      });

      // Update product quantity
      await Product.updateQuantityFromBatches(testProduct._id);

      // Perform multiple sales
      await request(app)
        .post('/api/v1/sales')
        .send({
          products: [{
            productId: testProduct._id,
            productName: testProduct.name,
            quantity: 8,
            sellPrice: testProduct.sellPrice,
            total: testProduct.sellPrice * 8
          }],
          totalAmount: testProduct.sellPrice * 8,
          cashierName: 'Test Cashier',
          paymentMethod: 'cash'
        })
        .expect(201);

      // Allow async update to complete
      await new Promise(resolve => setTimeout(resolve, 100));

      // Verify product quantity matches sum of batch quantities
      const updatedProduct = await Product.findById(testProduct._id);
      const batch1Updated = await InventoryBatch.findById(batch1._id);
      const batch2Updated = await InventoryBatch.findById(batch2._id);

      const expectedQuantity = batch1Updated.remainingQuantity + batch2Updated.remainingQuantity;
      expect(updatedProduct.quantity).toBe(expectedQuantity);
      expect(updatedProduct.quantity).toBe(17); // 25 - 8 = 17
    });
  });
});