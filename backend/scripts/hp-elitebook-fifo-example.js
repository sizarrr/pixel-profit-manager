// HP EliteBook FIFO Example Script
// This script demonstrates the FIFO inventory management for your specific scenario:
// - First batch: 5 HP EliteBook bought at $100, sell at $150
// - Second batch: 5 HP EliteBook bought at $120, sell at $170

import mongoose from "mongoose";
import dotenv from "dotenv";
import Product from "../models/Product.js";
import InventoryBatch from "../models/InventoryBatch.js";
import Sale from "../models/Sale.js";
import connectDB from "../config/database.js";

dotenv.config();

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

const log = {
  info: (msg) => console.log(`${colors.blue}ℹ${colors.reset}  ${msg}`),
  success: (msg) => console.log(`${colors.green}✓${colors.reset}  ${msg}`),
  error: (msg) => console.log(`${colors.red}✗${colors.reset}  ${msg}`),
  warning: (msg) => console.log(`${colors.yellow}⚠${colors.reset}  ${msg}`),
  section: (msg) => console.log(`\n${colors.cyan}══════════════════════════════════════${colors.reset}\n${colors.cyan}${msg}${colors.reset}\n${colors.cyan}══════════════════════════════════════${colors.reset}`)
};

async function runHPEliteBookExample() {
  try {
    // Connect to database
    log.info("Connecting to database...");
    await connectDB();
    log.success("Connected to database");

    // Step 1: Create HP EliteBook product
    log.section("Step 1: Creating HP EliteBook Product");
    
    // Check if product already exists
    let product = await Product.findOne({ name: "HP EliteBook 840 G8" });
    
    if (!product) {
      product = await Product.create({
        name: "HP EliteBook 840 G8",
        category: "Laptops",
        buyPrice: 100, // Initial buy price (will be updated by batches)
        sellPrice: 150, // Initial sell price
        quantity: 0, // Will be calculated from batches
        description: "HP EliteBook 840 G8 - 14\" Business Laptop, Intel Core i5, 8GB RAM, 256GB SSD",
        barcode: "HP-ELITEBOOK-840-G8",
        lowStockThreshold: 3,
        isActive: true
      });
      log.success(`Created product: ${product.name} (ID: ${product._id})`);
    } else {
      log.info(`Product already exists: ${product.name} (ID: ${product._id})`);
    }

    // Step 2: Add first inventory batch (5 laptops @ $100)
    log.section("Step 2: Adding First Batch - 5 HP EliteBook @ $100");
    
    const batch1 = await InventoryBatch.create({
      productId: product._id,
      buyPrice: 100,
      initialQuantity: 5,
      remainingQuantity: 5,
      purchaseDate: new Date('2024-01-01'),
      supplierName: "TechDistributor A",
      notes: "First batch - Lower cost inventory"
    });
    
    log.success(`Created Batch 1: ${batch1.batchNumber}`);
    log.info(`  - Buy Price: $${batch1.buyPrice}`);
    log.info(`  - Quantity: ${batch1.initialQuantity}`);
    log.info(`  - Purchase Date: ${batch1.purchaseDate.toDateString()}`);

    // Update product sell price to $150 for first batch
    await Product.findByIdAndUpdate(product._id, { sellPrice: 150 });
    
    // Step 3: Add second inventory batch (5 laptops @ $120)
    log.section("Step 3: Adding Second Batch - 5 HP EliteBook @ $120");
    
    const batch2 = await InventoryBatch.create({
      productId: product._id,
      buyPrice: 120,
      initialQuantity: 5,
      remainingQuantity: 5,
      purchaseDate: new Date('2024-02-01'),
      supplierName: "TechDistributor B",
      notes: "Second batch - Higher cost inventory"
    });
    
    log.success(`Created Batch 2: ${batch2.batchNumber}`);
    log.info(`  - Buy Price: $${batch2.buyPrice}`);
    log.info(`  - Quantity: ${batch2.initialQuantity}`);
    log.info(`  - Purchase Date: ${batch2.purchaseDate.toDateString()}`);

    // Update product sell price to $170 for new inventory
    await Product.findByIdAndUpdate(product._id, { sellPrice: 170 });

    // Update product quantity from batches
    await Product.updateQuantityFromBatches(product._id);

    // Step 4: Show current inventory status
    log.section("Step 4: Current Inventory Status");
    
    const updatedProduct = await Product.findById(product._id);
    const allBatches = await InventoryBatch.find({ 
      productId: product._id,
      remainingQuantity: { $gt: 0 }
    }).sort({ purchaseDate: 1 });
    
    log.info(`Product: ${updatedProduct.name}`);
    log.info(`Total Quantity: ${updatedProduct.quantity}`);
    log.info(`Current Sell Price: $${updatedProduct.sellPrice}`);
    log.info("\nAvailable Batches (FIFO Order):");
    
    for (const batch of allBatches) {
      log.info(`  - ${batch.batchNumber}: ${batch.remainingQuantity} units @ $${batch.buyPrice} (${batch.purchaseDate.toDateString()})`);
    }

    // Step 5: Demonstrate FIFO sales
    log.section("Step 5: Demonstrating FIFO Sales");
    
    // Sale 1: Sell 3 laptops (should come from first batch @ $100)
    log.info("\nSale 1: Selling 3 HP EliteBooks...");
    
    const sale1 = await Sale.create({
      products: [{
        productId: product._id,
        productName: product.name,
        quantity: 3,
        sellPrice: 150, // Using the original price for first batch
        total: 450
      }],
      totalAmount: 450,
      cashierName: "John Doe",
      paymentMethod: "cash",
      customerName: "ABC Company"
    });
    
    log.success(`Sale 1 completed! Receipt: ${sale1.receiptNumber}`);
    
    // Process FIFO allocation manually (normally done in saleController)
    const sale1Batches = await InventoryBatch.getAvailableBatches(product._id);
    let remainingToAllocate = 3;
    const allocations1 = [];
    
    for (const batch of sale1Batches) {
      if (remainingToAllocate <= 0) break;
      const allocated = Math.min(remainingToAllocate, batch.remainingQuantity);
      
      batch.remainingQuantity -= allocated;
      await batch.save();
      
      allocations1.push({
        batchNumber: batch.batchNumber,
        quantity: allocated,
        buyPrice: batch.buyPrice
      });
      
      remainingToAllocate -= allocated;
    }
    
    log.info("FIFO Allocation for Sale 1:");
    for (const alloc of allocations1) {
      log.info(`  - ${alloc.quantity} units from ${alloc.batchNumber} @ $${alloc.buyPrice} cost`);
    }
    
    const sale1Cost = allocations1.reduce((sum, alloc) => sum + (alloc.quantity * alloc.buyPrice), 0);
    const sale1Profit = sale1.totalAmount - sale1Cost;
    log.success(`Sale 1 Profit: $${sale1Profit} (Revenue: $${sale1.totalAmount} - Cost: $${sale1Cost})`);

    // Sale 2: Sell 4 laptops (2 from first batch @ $100, 2 from second batch @ $120)
    log.info("\nSale 2: Selling 4 HP EliteBooks...");
    
    const sale2 = await Sale.create({
      products: [{
        productId: product._id,
        productName: product.name,
        quantity: 4,
        sellPrice: 160, // Average price
        total: 640
      }],
      totalAmount: 640,
      cashierName: "Jane Smith",
      paymentMethod: "card",
      customerName: "XYZ Corporation"
    });
    
    log.success(`Sale 2 completed! Receipt: ${sale2.receiptNumber}`);
    
    // Process FIFO allocation for sale 2
    const sale2Batches = await InventoryBatch.getAvailableBatches(product._id);
    remainingToAllocate = 4;
    const allocations2 = [];
    
    for (const batch of sale2Batches) {
      if (remainingToAllocate <= 0) break;
      const allocated = Math.min(remainingToAllocate, batch.remainingQuantity);
      
      batch.remainingQuantity -= allocated;
      await batch.save();
      
      allocations2.push({
        batchNumber: batch.batchNumber,
        quantity: allocated,
        buyPrice: batch.buyPrice
      });
      
      remainingToAllocate -= allocated;
    }
    
    log.info("FIFO Allocation for Sale 2:");
    for (const alloc of allocations2) {
      log.info(`  - ${alloc.quantity} units from ${alloc.batchNumber} @ $${alloc.buyPrice} cost`);
    }
    
    const sale2Cost = allocations2.reduce((sum, alloc) => sum + (alloc.quantity * alloc.buyPrice), 0);
    const sale2Profit = sale2.totalAmount - sale2Cost;
    log.success(`Sale 2 Profit: $${sale2Profit} (Revenue: $${sale2.totalAmount} - Cost: $${sale2Cost})`);

    // Step 6: Show final inventory status
    log.section("Step 6: Final Inventory Status");
    
    await Product.updateQuantityFromBatches(product._id);
    const finalProduct = await Product.findById(product._id);
    const finalBatches = await InventoryBatch.find({ 
      productId: product._id,
      remainingQuantity: { $gt: 0 }
    }).sort({ purchaseDate: 1 });
    
    log.info(`Product: ${finalProduct.name}`);
    log.info(`Remaining Quantity: ${finalProduct.quantity}`);
    log.info("\nRemaining Batches:");
    
    for (const batch of finalBatches) {
      log.info(`  - ${batch.batchNumber}: ${batch.remainingQuantity} units @ $${batch.buyPrice}`);
    }

    // Summary
    log.section("FIFO Example Summary");
    log.success("✓ Created HP EliteBook product");
    log.success("✓ Added first batch: 5 units @ $100 (sell @ $150)");
    log.success("✓ Added second batch: 5 units @ $120 (sell @ $170)");
    log.success("✓ Sale 1: Sold 3 units from first batch (lower cost)");
    log.success("✓ Sale 2: Sold 2 units from first batch + 2 from second batch");
    log.success("✓ Remaining: 3 units from second batch @ $120");
    
    log.info("\nKey Points:");
    log.info("• FIFO ensures oldest (cheapest) inventory is sold first");
    log.info("• Profit margins are calculated using actual batch costs");
    log.info("• Each sale tracks which batches were used");
    log.info("• Inventory valuation is accurate based on remaining batches");

    process.exit(0);
  } catch (error) {
    log.error(`Error: ${error.message}`);
    console.error(error);
    process.exit(1);
  }
}

// Run the example
runHPEliteBookExample();