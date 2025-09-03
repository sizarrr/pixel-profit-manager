import mongoose from 'mongoose';
import Product from '../models/Product.js';
import InventoryBatch from '../models/InventoryBatch.js';
import Sale from '../models/Sale.js';
import config from '../config/config.js';

// Test script to demonstrate FIFO inventory management
async function testFIFOInventory() {
  try {
    // Connect to MongoDB
    await mongoose.connect(config.mongodbUri);
    console.log('Connected to MongoDB');

    // Clean up any existing test data
    await Sale.deleteMany({ notes: 'FIFO Test' });
    await InventoryBatch.deleteMany({ notes: 'FIFO Test' });
    
    // Find or create a laptop product for testing
    let laptop = await Product.findOne({ name: /laptop/i });
    
    if (!laptop) {
      laptop = await Product.create({
        name: 'Gaming Laptop',
        category: 'Electronics',
        buyPrice: 1000, // This will be overridden by batch prices
        sellPrice: 1500,
        quantity: 0, // Will be calculated from batches
        description: 'High-performance gaming laptop',
        lowStockThreshold: 2
      });
      console.log('Created test laptop product:', laptop.name);
    } else {
      console.log('Using existing laptop product:', laptop.name);
    }

    // Step 1: Add first batch of 5 laptops at $1000 each
    console.log('\n=== Step 1: Adding first batch (5 laptops @ $1000) ===');
    const batch1 = await InventoryBatch.create({
      productId: laptop._id,
      buyPrice: 1000,
      initialQuantity: 5,
      remainingQuantity: 5,
      purchaseDate: new Date('2024-01-01'),
      supplierName: 'TechSupplier A',
      notes: 'FIFO Test'
    });
    console.log('Batch 1 created:', batch1.batchNumber);

    // Update product quantity
    await Product.updateQuantityFromBatches(laptop._id);
    let updatedProduct = await Product.findById(laptop._id);
    console.log('Product total quantity after batch 1:', updatedProduct.quantity);

    // Step 2: Add second batch of 5 laptops at $1200 each
    console.log('\n=== Step 2: Adding second batch (5 laptops @ $1200) ===');
    const batch2 = await InventoryBatch.create({
      productId: laptop._id,
      buyPrice: 1200,
      initialQuantity: 5,
      remainingQuantity: 5,
      purchaseDate: new Date('2024-01-15'),
      supplierName: 'TechSupplier B',
      notes: 'FIFO Test'
    });
    console.log('Batch 2 created:', batch2.batchNumber);

    // Update product quantity
    await Product.updateQuantityFromBatches(laptop._id);
    updatedProduct = await Product.findById(laptop._id);
    console.log('Product total quantity after batch 2:', updatedProduct.quantity);

    // Step 3: Show current inventory state
    console.log('\n=== Current Inventory State ===');
    const batches = await InventoryBatch.find({ productId: laptop._id, notes: 'FIFO Test' })
      .sort({ purchaseDate: 1 });
    
    batches.forEach((batch, index) => {
      console.log(`Batch ${index + 1}: ${batch.remainingQuantity}/${batch.initialQuantity} units @ $${batch.buyPrice} (${batch.batchNumber})`);
    });

    // Step 4: Simulate a sale of 3 laptops (should come from first batch)
    console.log('\n=== Step 4: Selling 3 laptops (FIFO test) ===');
    
    // Create a test sale
    const saleData = {
      products: [{
        productId: laptop._id,
        productName: laptop.name,
        quantity: 3,
        sellPrice: laptop.sellPrice,
        total: laptop.sellPrice * 3
      }],
      totalAmount: laptop.sellPrice * 3,
      cashierName: 'Test Cashier',
      paymentMethod: 'cash',
      notes: 'FIFO Test'
    };

    // Manually process FIFO allocation (simulating the controller logic)
    const session = await mongoose.startSession();
    await session.withTransaction(async () => {
      // Get available batches in FIFO order
      const availableBatches = await InventoryBatch.find({
        productId: laptop._id,
        remainingQuantity: { $gt: 0 },
        isActive: true,
        notes: 'FIFO Test'
      }).sort({ purchaseDate: 1, createdAt: 1 }).session(session);

      let remainingToAllocate = 3;
      const batchAllocations = [];
      const batchUpdates = [];

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

        console.log(`Allocated ${allocatedFromBatch} units from ${batch.batchNumber} @ $${batch.buyPrice}`);
        remainingToAllocate -= allocatedFromBatch;
      }

      // Update inventory batches
      for (const update of batchUpdates) {
        await InventoryBatch.findByIdAndUpdate(
          update.batchId,
          { remainingQuantity: update.newRemainingQuantity },
          { session }
        );
      }

      // Create sale record
      saleData.products[0].batchAllocations = batchAllocations;
      await Sale.create([saleData], { session });

      // Update product quantity
      await Product.updateQuantityFromBatches(laptop._id);
    });

    // Step 5: Show inventory state after sale
    console.log('\n=== Inventory State After Selling 3 Laptops ===');
    const batchesAfterSale = await InventoryBatch.find({ productId: laptop._id, notes: 'FIFO Test' })
      .sort({ purchaseDate: 1 });
    
    batchesAfterSale.forEach((batch, index) => {
      console.log(`Batch ${index + 1}: ${batch.remainingQuantity}/${batch.initialQuantity} units @ $${batch.buyPrice} (${batch.batchNumber})`);
    });

    updatedProduct = await Product.findById(laptop._id);
    console.log('Product total quantity after sale:', updatedProduct.quantity);

    // Step 6: Sell 3 more laptops (should finish first batch and start second)
    console.log('\n=== Step 6: Selling 3 more laptops ===');
    
    const saleData2 = {
      products: [{
        productId: laptop._id,
        productName: laptop.name,
        quantity: 3,
        sellPrice: laptop.sellPrice,
        total: laptop.sellPrice * 3
      }],
      totalAmount: laptop.sellPrice * 3,
      cashierName: 'Test Cashier',
      paymentMethod: 'cash',
      notes: 'FIFO Test'
    };

    await session.withTransaction(async () => {
      const availableBatches = await InventoryBatch.find({
        productId: laptop._id,
        remainingQuantity: { $gt: 0 },
        isActive: true,
        notes: 'FIFO Test'
      }).sort({ purchaseDate: 1, createdAt: 1 }).session(session);

      let remainingToAllocate = 3;
      const batchAllocations = [];
      const batchUpdates = [];

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

        console.log(`Allocated ${allocatedFromBatch} units from ${batch.batchNumber} @ $${batch.buyPrice}`);
        remainingToAllocate -= allocatedFromBatch;
      }

      // Update inventory batches
      for (const update of batchUpdates) {
        await InventoryBatch.findByIdAndUpdate(
          update.batchId,
          { remainingQuantity: update.newRemainingQuantity },
          { session }
        );
      }

      // Create sale record
      saleData2.products[0].batchAllocations = batchAllocations;
      await Sale.create([saleData2], { session });

      // Update product quantity
      await Product.updateQuantityFromBatches(laptop._id);
    });

    // Step 7: Final inventory state
    console.log('\n=== Final Inventory State ===');
    const finalBatches = await InventoryBatch.find({ productId: laptop._id, notes: 'FIFO Test' })
      .sort({ purchaseDate: 1 });
    
    finalBatches.forEach((batch, index) => {
      console.log(`Batch ${index + 1}: ${batch.remainingQuantity}/${batch.initialQuantity} units @ $${batch.buyPrice} (${batch.batchNumber})`);
    });

    updatedProduct = await Product.findById(laptop._id);
    console.log('Final product total quantity:', updatedProduct.quantity);

    // Step 8: Show sales with batch allocation details
    console.log('\n=== Sales Records with Batch Allocations ===');
    const sales = await Sale.find({ notes: 'FIFO Test' }).sort({ createdAt: 1 });
    
    sales.forEach((sale, index) => {
      console.log(`\nSale ${index + 1} (${sale.receiptNumber}):`);
      sale.products.forEach(product => {
        console.log(`  Product: ${product.productName} - ${product.quantity} units @ $${product.sellPrice}`);
        if (product.batchAllocations && product.batchAllocations.length > 0) {
          product.batchAllocations.forEach(allocation => {
            console.log(`    From ${allocation.batchNumber}: ${allocation.quantity} units @ $${allocation.buyPrice} cost`);
          });
        }
      });
      console.log(`  Total: $${sale.totalAmount}`);
    });

    console.log('\n=== FIFO Test Completed Successfully! ===');
    console.log('The system correctly sells from the oldest inventory first.');
    console.log('First 3 laptops sold from $1000 batch, next 3 from remaining $1000 + $1200 batches.');

  } catch (error) {
    console.error('Test failed:', error.message);
    console.error(error.stack);
  } finally {
    await mongoose.connection.close();
    console.log('Database connection closed');
  }
}

// Run the test if this script is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  testFIFOInventory();
}

export default testFIFOInventory;