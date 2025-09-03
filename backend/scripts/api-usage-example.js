// API Usage Example for FIFO Inventory Management
// This script shows the HTTP API calls you would make to implement your laptop scenario

console.log('=== FIFO Inventory Management API Usage Example ===\n');

// Example API calls for your laptop scenario
const examples = {
  // Step 1: Create a laptop product (if it doesn't exist)
  createProduct: {
    method: 'POST',
    url: '/api/v1/products',
    body: {
      name: 'Gaming Laptop XYZ',
      category: 'Electronics',
      buyPrice: 1000, // Initial price, will be overridden by batch prices
      sellPrice: 1500,
      quantity: 0, // Will be calculated from batches
      description: 'High-performance gaming laptop',
      lowStockThreshold: 2
    }
  },

  // Step 2: Add first batch of 5 laptops at $1000 each
  addFirstBatch: {
    method: 'POST',
    url: '/api/v1/inventory/batches',
    body: {
      productId: '507f1f77bcf86cd799439011', // Replace with actual product ID
      buyPrice: 1000,
      quantity: 5,
      supplierName: 'TechSupplier A',
      purchaseDate: '2024-01-01T00:00:00.000Z',
      notes: 'First batch of laptops'
    }
  },

  // Step 3: Add second batch of 5 laptops at $1200 each
  addSecondBatch: {
    method: 'POST',
    url: '/api/v1/inventory/batches',
    body: {
      productId: '507f1f77bcf86cd799439011', // Replace with actual product ID
      buyPrice: 1200,
      quantity: 5,
      supplierName: 'TechSupplier B',
      purchaseDate: '2024-01-15T00:00:00.000Z',
      notes: 'Second batch of laptops with higher cost'
    }
  },

  // Step 4: Check inventory summary
  getInventorySummary: {
    method: 'GET',
    url: '/api/v1/inventory/summary',
    description: 'Shows total inventory with batch details and average costs'
  },

  // Step 5: Get product-specific batches
  getProductBatches: {
    method: 'GET',
    url: '/api/v1/inventory/products/507f1f77bcf86cd799439011/batches',
    description: 'Shows all batches for a specific product in FIFO order'
  },

  // Step 6: Process a sale (FIFO automatically applied)
  createSale: {
    method: 'POST',
    url: '/api/v1/sales',
    body: {
      products: [{
        productId: '507f1f77bcf86cd799439011',
        productName: 'Gaming Laptop XYZ',
        quantity: 3,
        sellPrice: 1500,
        total: 4500
      }],
      totalAmount: 4500,
      cashierName: 'John Doe',
      paymentMethod: 'cash',
      customerName: 'Customer A',
      notes: 'FIFO sale example'
    },
    description: 'This sale will automatically allocate from oldest batches first'
  },

  // Step 7: Check updated inventory after sale
  getUpdatedBatches: {
    method: 'GET',
    url: '/api/v1/inventory/products/507f1f77bcf86cd799439011/batches',
    description: 'Shows remaining inventory after FIFO allocation'
  }
};

// Display the API usage examples
Object.entries(examples).forEach(([step, example]) => {
  console.log(`${step.toUpperCase()}:`);
  console.log(`  Method: ${example.method}`);
  console.log(`  URL: ${example.url}`);
  
  if (example.body) {
    console.log(`  Body: ${JSON.stringify(example.body, null, 2)}`);
  }
  
  if (example.description) {
    console.log(`  Description: ${example.description}`);
  }
  
  console.log('');
});

// Show the expected FIFO behavior
console.log('=== Expected FIFO Behavior ===');
console.log('1. When you add the first 5 laptops @ $1000:');
console.log('   - Creates Batch 1 with 5 units @ $1000');
console.log('   - Product total quantity becomes 5');
console.log('');

console.log('2. When you add the second 5 laptops @ $1200:');
console.log('   - Creates Batch 2 with 5 units @ $1200');
console.log('   - Product total quantity becomes 10');
console.log('   - Average cost becomes $1100 ((5×$1000 + 5×$1200) ÷ 10)');
console.log('');

console.log('3. When you sell 3 laptops:');
console.log('   - All 3 units come from Batch 1 (oldest) @ $1000');
console.log('   - Batch 1: 2 remaining, Batch 2: 5 remaining');
console.log('   - Cost basis: 3 × $1000 = $3000');
console.log('   - Profit: 3 × ($1500 - $1000) = $1500');
console.log('');

console.log('4. When you sell 3 more laptops:');
console.log('   - 2 units from Batch 1 (finishing it) @ $1000');
console.log('   - 1 unit from Batch 2 @ $1200');
console.log('   - Batch 1: 0 remaining, Batch 2: 4 remaining');
console.log('   - Cost basis: 2 × $1000 + 1 × $1200 = $3200');
console.log('   - Profit: 2 × ($1500 - $1000) + 1 × ($1500 - $1200) = $1300');
console.log('');

console.log('5. Remaining inventory:');
console.log('   - 4 laptops from Batch 2 @ $1200 each');
console.log('   - Next sales will use these at $1200 cost basis');
console.log('');

console.log('🎯 Key Features Implemented:');
console.log('• FIFO inventory allocation ensures older stock is sold first');
console.log('• Each sale records which batches were used for accurate cost tracking');
console.log('• Supports multiple purchase prices for the same product');
console.log('• Automatic inventory quantity updates based on batch allocations');
console.log('• Detailed batch tracking with purchase dates and supplier info');
console.log('• Transaction safety with MongoDB sessions to prevent inventory inconsistencies');

console.log('\n=== Ready for Production Use! ===');
console.log('Your FIFO inventory management system is now fully implemented.');
console.log('Start your server and use the API endpoints shown above.');