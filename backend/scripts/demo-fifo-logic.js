// FIFO Inventory Management Demonstration
// This script demonstrates the FIFO logic without requiring a database connection

console.log('=== FIFO Inventory Management Demo ===\n');

// Mock data structures
class MockInventoryBatch {
  constructor(id, buyPrice, quantity, purchaseDate, batchNumber) {
    this.id = id;
    this.buyPrice = buyPrice;
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

// Initialize inventory with your scenario
const laptopBatches = [
  new MockInventoryBatch(1, 1000, 5, '2024-01-01', 'BATCH-20240101-001'),
  new MockInventoryBatch(2, 1200, 5, '2024-01-15', 'BATCH-20240115-002')
];

console.log('Initial Inventory State:');
laptopBatches.forEach((batch, index) => {
  console.log(`Batch ${index + 1}: ${batch.remainingQuantity}/${batch.initialQuantity} laptops @ $${batch.buyPrice} (${batch.batchNumber})`);
});
console.log(`Total Available: ${laptopBatches.reduce((sum, b) => sum + b.remainingQuantity, 0)} laptops\n`);

// FIFO allocation function
function allocateInventoryFIFO(batches, requestedQuantity) {
  const allocations = [];
  let remainingToAllocate = requestedQuantity;
  
  // Sort batches by purchase date (FIFO)
  const sortedBatches = [...batches]
    .filter(batch => batch.remainingQuantity > 0)
    .sort((a, b) => a.purchaseDate - b.purchaseDate);

  for (const batch of sortedBatches) {
    if (remainingToAllocate <= 0) break;

    const allocatedFromBatch = Math.min(remainingToAllocate, batch.remainingQuantity);
    
    allocations.push({
      batchId: batch.id,
      batchNumber: batch.batchNumber,
      quantity: allocatedFromBatch,
      buyPrice: batch.buyPrice,
      costBasis: allocatedFromBatch * batch.buyPrice
    });

    batch.reduceQuantity(allocatedFromBatch);
    remainingToAllocate -= allocatedFromBatch;
  }

  return {
    allocations,
    totalAllocated: requestedQuantity - remainingToAllocate,
    fullyAllocated: remainingToAllocate === 0
  };
}

// Demo Sale 1: Sell 3 laptops
console.log('=== Sale 1: Selling 3 laptops ===');
const sale1 = allocateInventoryFIFO(laptopBatches, 3);

console.log('FIFO Allocation:');
sale1.allocations.forEach(allocation => {
  console.log(`  ${allocation.quantity} units from ${allocation.batchNumber} @ $${allocation.buyPrice} = $${allocation.costBasis} cost basis`);
});

console.log('\nInventory after Sale 1:');
laptopBatches.forEach((batch, index) => {
  console.log(`Batch ${index + 1}: ${batch.remainingQuantity}/${batch.initialQuantity} laptops @ $${batch.buyPrice} (${batch.batchNumber})`);
});
console.log(`Total Available: ${laptopBatches.reduce((sum, b) => sum + b.remainingQuantity, 0)} laptops\n`);

// Demo Sale 2: Sell 3 more laptops (should finish first batch and start second)
console.log('=== Sale 2: Selling 3 more laptops ===');
const sale2 = allocateInventoryFIFO(laptopBatches, 3);

console.log('FIFO Allocation:');
sale2.allocations.forEach(allocation => {
  console.log(`  ${allocation.quantity} units from ${allocation.batchNumber} @ $${allocation.buyPrice} = $${allocation.costBasis} cost basis`);
});

console.log('\nInventory after Sale 2:');
laptopBatches.forEach((batch, index) => {
  console.log(`Batch ${index + 1}: ${batch.remainingQuantity}/${batch.initialQuantity} laptops @ $${batch.buyPrice} (${batch.batchNumber})`);
});
console.log(`Total Available: ${laptopBatches.reduce((sum, b) => sum + b.remainingQuantity, 0)} laptops\n`);

// Demo Sale 3: Sell 2 more laptops (should come from second batch)
console.log('=== Sale 3: Selling 2 more laptops ===');
const sale3 = allocateInventoryFIFO(laptopBatches, 2);

console.log('FIFO Allocation:');
sale3.allocations.forEach(allocation => {
  console.log(`  ${allocation.quantity} units from ${allocation.batchNumber} @ $${allocation.buyPrice} = $${allocation.costBasis} cost basis`);
});

console.log('\nFinal Inventory State:');
laptopBatches.forEach((batch, index) => {
  console.log(`Batch ${index + 1}: ${batch.remainingQuantity}/${batch.initialQuantity} laptops @ $${batch.buyPrice} (${batch.batchNumber})`);
});
console.log(`Total Available: ${laptopBatches.reduce((sum, b) => sum + b.remainingQuantity, 0)} laptops\n`);

// Summary
console.log('=== FIFO Implementation Summary ===');
console.log('✅ FIFO (First In, First Out) inventory management implemented successfully!');
console.log('✅ Older inventory (purchased at $1000) is sold first');
console.log('✅ Newer inventory (purchased at $1200) is sold only after older stock is depleted');
console.log('✅ Each sale tracks which batches the items came from for accurate cost basis');
console.log('✅ This ensures proper profit calculation and inventory valuation');

// Show profit calculation differences
console.log('\n=== Profit Analysis ===');
const sellPrice = 1500; // Assumed sell price

console.log('Sale 1 Profit Analysis:');
let totalCost1 = 0;
sale1.allocations.forEach(allocation => {
  const profit = (sellPrice - allocation.buyPrice) * allocation.quantity;
  totalCost1 += allocation.costBasis;
  console.log(`  ${allocation.quantity} units: Sell $${sellPrice} - Cost $${allocation.buyPrice} = $${sellPrice - allocation.buyPrice} profit per unit`);
});
const totalRevenue1 = sellPrice * 3;
console.log(`  Total: Revenue $${totalRevenue1} - Cost $${totalCost1} = $${totalRevenue1 - totalCost1} profit`);

console.log('\nSale 2 Profit Analysis:');
let totalCost2 = 0;
sale2.allocations.forEach(allocation => {
  const profit = (sellPrice - allocation.buyPrice) * allocation.quantity;
  totalCost2 += allocation.costBasis;
  console.log(`  ${allocation.quantity} units: Sell $${sellPrice} - Cost $${allocation.buyPrice} = $${sellPrice - allocation.buyPrice} profit per unit`);
});
const totalRevenue2 = sellPrice * 3;
console.log(`  Total: Revenue $${totalRevenue2} - Cost $${totalCost2} = $${totalRevenue2 - totalCost2} profit`);

console.log('\n🎯 Key Benefits of FIFO:');
console.log('• Prevents older inventory from becoming obsolete');
console.log('• Provides accurate cost basis for each sale');
console.log('• Enables precise profit margin calculations');
console.log('• Maintains proper inventory valuation');
console.log('• Supports different purchase prices for the same product');