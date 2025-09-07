// Integration tests for FIFO sales workflow
import request from 'supertest';
import mongoose from 'mongoose';
import app from '../../server.js';
import Product from '../../models/Product.js';
import InventoryBatch from '../../models/InventoryBatch.js';
import Sale from '../../models/Sale.js';

describe('FIFO Sales Integration Tests', () => {
  let testProduct;
  let batch1, batch2, batch3;

  beforeAll(async () => {
    // Connect to test database
    await mongoose.connect(process.env.MONGODB_TEST_URI || 'mongodb://localhost:27017/pos_test');
  });

  beforeEach(async () => {
    // Clear test data
    await Sale.deleteMany({});
    await InventoryBatch.deleteMany({});
    await Product.deleteMany({});

    // Create test product
    testProduct = await Product.create({
      name: 'Test Laptop',
      category: 'Electronics',
      buyPrice: 1000, // This will be overridden by batch prices
      sellPrice: 1500,
      quantity: 0,
      description: 'Test laptop for FIFO testing',
      lowStockThreshold: 2
    });

    // Create test inventory batches
    batch1 = await InventoryBatch.create({
      productId: testProduct._id,
      buyPrice: 1000,
      initialQuantity: 5,
      remainingQuantity: 5,
      purchaseDate: new Date('2024-01-01'),
      supplierName: 'Supplier A',
      notes: 'First batch - oldest'
    });

    batch2 = await InventoryBatch.create({
      productId: testProduct._id,
      buyPrice: 1200,
      initialQuantity: 5,
      remainingQuantity: 5,
      purchaseDate: new Date('2024-01-15'),
      supplierName: 'Supplier B',
      notes: 'Second batch - newer'
    });

    batch3 = await InventoryBatch.create({
      productId: testProduct._id,
      buyPrice: 1100,
      initialQuantity: 3,
      remainingQuantity: 3,
      purchaseDate: new Date('2024-01-10'), // Between batch1 and batch2
      supplierName: 'Supplier C',
      notes: 'Third batch - middle date'
    });

    // Update product quantity
    await Product.updateQuantityFromBatches(testProduct._id);
  });

  afterEach(async () => {
    // Clean up test data
    await Sale.deleteMany({});
    await InventoryBatch.deleteMany({});
    await Product.deleteMany({});
  });

  afterAll(async () => {
    await mongoose.connection.close();
  });

  describe('Single Batch FIFO Sales', () => {
    test('should sell from oldest batch first', async () => {
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

      // Verify sale was created with correct batch allocation
      const sale = response.body.data.sale;
      expect(sale.products[0].batchAllocations).toHaveLength(1);
      expect(sale.products[0].batchAllocations[0]).toMatchObject({
        batchId: batch1._id.toString(),
        quantity: 3,
        buyPrice: 1000
      });

      // Verify inventory batch was updated
      const updatedBatch1 = await InventoryBatch.findById(batch1._id);
      expect(updatedBatch1.remainingQuantity).toBe(2);

      // Verify other batches unchanged
      const updatedBatch2 = await InventoryBatch.findById(batch2._id);
      const updatedBatch3 = await InventoryBatch.findById(batch3._id);
      expect(updatedBatch2.remainingQuantity).toBe(5);
      expect(updatedBatch3.remainingQuantity).toBe(3);
    });

    test('should respect chronological order with middle-dated batch', async () => {
      const saleData = {
        products: [{
          productId: testProduct._id,
          productName: testProduct.name,
          quantity: 7, // Will span batch1 (5) and batch3 (2)
          sellPrice: testProduct.sellPrice,
          total: testProduct.sellPrice * 7
        }],
        totalAmount: testProduct.sellPrice * 7,
        cashierName: 'Test Cashier',
        paymentMethod: 'cash'
      };

      const response = await request(app)
        .post('/api/v1/sales')
        .send(saleData)
        .expect(201);

      const sale = response.body.data.sale;
      expect(sale.products[0].batchAllocations).toHaveLength(2);
      
      // First allocation from oldest batch (batch1)
      expect(sale.products[0].batchAllocations[0]).toMatchObject({
        batchId: batch1._id.toString(),
        quantity: 5,
        buyPrice: 1000
      });
      
      // Second allocation from middle-dated batch (batch3)
      expect(sale.products[0].batchAllocations[1]).toMatchObject({
        batchId: batch3._id.toString(),
        quantity: 2,
        buyPrice: 1100
      });

      // Verify inventory updates
      const updatedBatch1 = await InventoryBatch.findById(batch1._id);
      const updatedBatch2 = await InventoryBatch.findById(batch2._id);
      const updatedBatch3 = await InventoryBatch.findById(batch3._id);
      
      expect(updatedBatch1.remainingQuantity).toBe(0);
      expect(updatedBatch2.remainingQuantity).toBe(5); // Unchanged
      expect(updatedBatch3.remainingQuantity).toBe(1);
    });
  });

  describe('Multi-Batch FIFO Sales', () => {
    test('should span all batches in correct order', async () => {
      const saleData = {
        products: [{
          productId: testProduct._id,
          productName: testProduct.name,
          quantity: 10, // Will span batch1 (5) + batch3 (3) + batch2 (2)
          sellPrice: testProduct.sellPrice,
          total: testProduct.sellPrice * 10
        }],
        totalAmount: testProduct.sellPrice * 10,
        cashierName: 'Test Cashier',
        paymentMethod: 'cash'
      };

      const response = await request(app)
        .post('/api/v1/sales')
        .send(saleData)
        .expect(201);

      const sale = response.body.data.sale;
      expect(sale.products[0].batchAllocations).toHaveLength(3);
      
      // Verify FIFO order: batch1 (Jan 1) -> batch3 (Jan 10) -> batch2 (Jan 15)
      expect(sale.products[0].batchAllocations[0]).toMatchObject({
        batchId: batch1._id.toString(),
        quantity: 5,
        buyPrice: 1000
      });
      
      expect(sale.products[0].batchAllocations[1]).toMatchObject({
        batchId: batch3._id.toString(),
        quantity: 3,
        buyPrice: 1100
      });
      
      expect(sale.products[0].batchAllocations[2]).toMatchObject({
        batchId: batch2._id.toString(),
        quantity: 2,
        buyPrice: 1200
      });
    });
  });

  describe('Error Handling', () => {
    test('should reject sale with insufficient stock', async () => {
      const saleData = {
        products: [{
          productId: testProduct._id,
          productName: testProduct.name,
          quantity: 15, // More than available (13)
          sellPrice: testProduct.sellPrice,
          total: testProduct.sellPrice * 15
        }],
        totalAmount: testProduct.sellPrice * 15,
        cashierName: 'Test Cashier',
        paymentMethod: 'cash'
      };

      const response = await request(app)
        .post('/api/v1/sales')
        .send(saleData)
        .expect(400);

      expect(response.body.message).toContain('Insufficient stock');
      
      // Verify no inventory was changed
      const batch1After = await InventoryBatch.findById(batch1._id);
      const batch2After = await InventoryBatch.findById(batch2._id);
      const batch3After = await InventoryBatch.findById(batch3._id);
      
      expect(batch1After.remainingQuantity).toBe(5);
      expect(batch2After.remainingQuantity).toBe(5);
      expect(batch3After.remainingQuantity).toBe(3);
    });

    test('should reject sale with price mismatch', async () => {
      const saleData = {
        products: [{
          productId: testProduct._id,
          productName: testProduct.name,
          quantity: 3,
          sellPrice: 1600, // Wrong price
          total: 1600 * 3
        }],
        totalAmount: 1600 * 3,
        cashierName: 'Test Cashier',
        paymentMethod: 'cash'
      };

      await request(app)
        .post('/api/v1/sales')
        .send(saleData)
        .expect(400);
    });
  });

  describe('Sequential Sales FIFO Behavior', () => {
    test('should maintain FIFO across multiple sales', async () => {
      // First sale: 3 items
      const sale1Data = {
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
        .send(sale1Data)
        .expect(201);

      // Second sale: 4 items (should finish batch1 and start batch3)
      const sale2Data = {
        products: [{
          productId: testProduct._id,
          productName: testProduct.name,
          quantity: 4,
          sellPrice: testProduct.sellPrice,
          total: testProduct.sellPrice * 4
        }],
        totalAmount: testProduct.sellPrice * 4,
        cashierName: 'Test Cashier',
        paymentMethod: 'cash'
      };

      const response2 = await request(app)
        .post('/api/v1/sales')
        .send(sale2Data)
        .expect(201);

      const sale2 = response2.body.data.sale;
      expect(sale2.products[0].batchAllocations).toHaveLength(2);
      
      // Should get remaining 2 from batch1 and 2 from batch3
      expect(sale2.products[0].batchAllocations[0]).toMatchObject({
        batchId: batch1._id.toString(),
        quantity: 2,
        buyPrice: 1000
      });
      
      expect(sale2.products[0].batchAllocations[1]).toMatchObject({
        batchId: batch3._id.toString(),
        quantity: 2,
        buyPrice: 1100
      });

      // Verify final inventory state
      const finalBatch1 = await InventoryBatch.findById(batch1._id);
      const finalBatch2 = await InventoryBatch.findById(batch2._id);
      const finalBatch3 = await InventoryBatch.findById(batch3._id);
      
      expect(finalBatch1.remainingQuantity).toBe(0);
      expect(finalBatch2.remainingQuantity).toBe(5);
      expect(finalBatch3.remainingQuantity).toBe(1);
    });
  });

  describe('Inventory State Consistency', () => {
    test('should update product total quantity after sale', async () => {
      const saleData = {
        products: [{
          productId: testProduct._id,
          productName: testProduct.name,
          quantity: 5,
          sellPrice: testProduct.sellPrice,
          total: testProduct.sellPrice * 5
        }],
        totalAmount: testProduct.sellPrice * 5,
        cashierName: 'Test Cashier',
        paymentMethod: 'cash'
      };

      await request(app)
        .post('/api/v1/sales')
        .send(saleData)
        .expect(201);

      // Allow time for async quantity update
      await new Promise(resolve => setTimeout(resolve, 100));

      const updatedProduct = await Product.findById(testProduct._id);
      expect(updatedProduct.quantity).toBe(8); // 13 - 5 = 8
    });
  });
});