// FIFO Issue Diagnosis Script
// This script simulates your exact scenario to identify the problem

console.log('=== FIFO Issue Diagnosis ===\n');

// Simulate your scenario: 2 computers at $1000, then update product to $1200
class MockProduct {
  constructor(id, name, buyPrice, sellPrice, quantity) {
    this.id = id;
    this.name = name;
    this.buyPrice = buyPrice; // This is the "current" buy price in the product record
    this.sellPrice = sellPrice; // This is what customers pay
    this.quantity = quantity;
  }
  
  updatePrice(newBuyPrice, newSellPrice) {
    console.log(`📝 Updating product prices:`);
    console.log(`   Buy Price: $${this.buyPrice} → $${newBuyPrice}`);
    console.log(`   Sell Price: $${this.sellPrice} → $${newSellPrice}`);
    this.buyPrice = newBuyPrice;
    this.sellPrice = newSellPrice;
  }
}

class MockInventoryBatch {
  constructor(id, productId, buyPrice, quantity, purchaseDate, batchNumber) {
    this.id = id;
    this.productId = productId;
    this.buyPrice = buyPrice; // This is the ACTUAL cost when purchased
    this.initialQuantity = quantity;
    this.remainingQuantity = quantity;
    this.purchaseDate = new Date(purchaseDate);
    this.batchNumber = batchNumber;
  }

  reduceQuantity(amount) {
    if (amount > this.remainingQuantity) {
      throw new Error(`Cannot reduce by ${amount}. Only ${this.remainingQuantity} remaining.`);
    }
    this.remainingQuantity -= amount;
    return this.remainingQuantity;
  }
}

// Your scenario setup
console.log('🖥️ Setting up your computer scenario...\n');

// Step 1: Create product with initial price
const computer = new MockProduct('comp1', 'Computer', 1000, 1500, 2);
console.log(`Created product: ${computer.name}`);
console.log(`Initial buy price: $${computer.buyPrice}`);
console.log(`Sell price: $${computer.sellPrice}`);
console.log(`Quantity: ${computer.quantity}\n`);

// Step 2: Create inventory batch for the 2 computers at $1000
const batch1 = new MockInventoryBatch('batch1', 'comp1', 1000, 2, '2024-01-01', 'BATCH-001');
console.log(`Created inventory batch: ${batch1.batchNumber}`);
console.log(`Batch buy price: $${batch1.buyPrice}`);
console.log(`Batch quantity: ${batch1.initialQuantity}\n`);

// Step 3: Update product price to $1200 (this is where the confusion might happen)
computer.updatePrice(1200, 1800);
console.log('');

// Step 4: Show the critical difference
console.log('🔍 CRITICAL ANALYSIS:');
console.log(`Product record buy price: $${computer.buyPrice} (UPDATED to $1200)`);
console.log(`Actual inventory batch cost: $${batch1.buyPrice} (ORIGINAL $1000)`);
console.log('');

// Step 5: Simulate the sale process and identify the issue
console.log('💰 SALE SIMULATION - What happens when you sell 1 computer?\n');

// CORRECT FIFO Implementation:
console.log('✅ CORRECT FIFO Implementation:');
const correctAllocation = {
  quantity: 1,
  actualCostBasis: batch1.buyPrice, // Should use $1000 from batch
  sellPrice: computer.sellPrice,
  profit: computer.sellPrice - batch1.buyPrice
};
console.log(`   Uses batch cost: $${correctAllocation.actualCostBasis}`);
console.log(`   Sell price: $${correctAllocation.sellPrice}`);
console.log(`   Profit: $${correctAllocation.profit}`);
console.log('');

// INCORRECT Implementation (what might be happening):
console.log('❌ INCORRECT Implementation (possible bug):');
const incorrectAllocation = {
  quantity: 1,
  wrongCostBasis: computer.buyPrice, // Incorrectly uses updated product price $1200
  sellPrice: computer.sellPrice,
  profit: computer.sellPrice - computer.buyPrice
};
console.log(`   Uses product price: $${incorrectAllocation.wrongCostBasis}`);
console.log(`   Sell price: $${incorrectAllocation.sellPrice}`);
console.log(`   Profit: $${incorrectAllocation.profit}`);
console.log('');

// Step 6: Identify the root cause
console.log('🕵️ ROOT CAUSE ANALYSIS:');
console.log('');
console.log('The issue likely occurs in one of these places:');
console.log('1. Sale controller is using product.buyPrice instead of batch.buyPrice');
console.log('2. Product.buyPrice is being updated when it should remain as weighted average');
console.log('3. Frontend is displaying product.buyPrice instead of actual batch costs');
console.log('4. Profit calculations are using wrong price reference');
console.log('');

// Step 7: Show what should happen
console.log('📋 EXPECTED FIFO BEHAVIOR:');
console.log('');
console.log('When you have:');
console.log('- 2 computers bought at $1000 each (in inventory batch)');
console.log('- Product price updated to $1200 (for future purchases)');
console.log('- Sell 1 computer');
console.log('');
console.log('Expected result:');
console.log('- Cost basis for sale: $1000 (from original batch)');
console.log('- Remaining inventory: 1 computer at $1000 cost');
console.log('- Product buy price: Should show weighted average or remain $1000');
console.log('');

// Step 8: Debugging questions
console.log('🔧 DEBUGGING QUESTIONS:');
console.log('');
console.log('1. When you "update product to $1200", what exactly are you updating?');
console.log('   a) Just the product.buyPrice field?');
console.log('   b) Creating a new inventory batch at $1200?');
console.log('   c) Both?');
console.log('');
console.log('2. When you sell and see "$1200", where are you seeing this?');
console.log('   a) In the sale record?');
console.log('   b) In profit calculations?');
console.log('   c) In the product display?');
console.log('');
console.log('3. Are you creating inventory batches when you receive inventory?');
console.log('   Or just updating the product record?');
console.log('');

console.log('=== Diagnosis Complete ===');
console.log('Run this script to understand the conceptual difference between:');
console.log('- Product.buyPrice (current/average price for the product)');
console.log('- InventoryBatch.buyPrice (actual historical cost of specific inventory)');