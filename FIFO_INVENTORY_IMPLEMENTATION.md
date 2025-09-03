# FIFO Inventory Management Implementation

## Overview

Your sales route now supports **FIFO (First In, First Out)** inventory management. This means when you have multiple batches of the same product with different purchase prices, the system will automatically sell from the oldest inventory first.

## Your Laptop Scenario Solution

### Problem
- You have 5 laptops bought at $1000 each
- You buy 5 more laptops of the same brand at $1200 each
- You want to sell the $1000 laptops first, then the $1200 laptops

### Solution Implemented
The system now tracks inventory in **batches** instead of simple quantities. Each batch has:
- Purchase price
- Purchase date
- Remaining quantity
- Supplier information

## How It Works

### 1. Adding Inventory Batches

**First batch (5 laptops @ $1000):**
```http
POST /api/v1/inventory/batches
{
  "productId": "your-laptop-product-id",
  "buyPrice": 1000,
  "quantity": 5,
  "supplierName": "TechSupplier A",
  "notes": "First batch of laptops"
}
```

**Second batch (5 laptops @ $1200):**
```http
POST /api/v1/inventory/batches
{
  "productId": "your-laptop-product-id", 
  "buyPrice": 1200,
  "quantity": 5,
  "supplierName": "TechSupplier B",
  "notes": "Second batch with higher cost"
}
```

### 2. Automatic FIFO Sales

When you create a sale, the system automatically:
1. Finds all available batches for each product
2. Sorts them by purchase date (oldest first)
3. Allocates inventory from oldest batches first
4. Tracks which batches were used in the sale record

**Example Sale:**
```http
POST /api/v1/sales
{
  "products": [{
    "productId": "your-laptop-product-id",
    "productName": "Gaming Laptop XYZ",
    "quantity": 3,
    "sellPrice": 1500,
    "total": 4500
  }],
  "totalAmount": 4500,
  "cashierName": "John Doe",
  "paymentMethod": "cash"
}
```

**Result:** All 3 laptops come from the $1000 batch (oldest), leaving 2 in that batch.

### 3. Batch Allocation Tracking

Each sale now includes detailed batch allocation information:
```json
{
  "products": [{
    "productId": "...",
    "productName": "Gaming Laptop XYZ",
    "quantity": 3,
    "sellPrice": 1500,
    "total": 4500,
    "batchAllocations": [{
      "batchId": "...",
      "batchNumber": "BATCH-20240101-001",
      "quantity": 3,
      "buyPrice": 1000
    }]
  }]
}
```

## New API Endpoints

### Inventory Management
- `GET /api/v1/inventory/summary` - Overall inventory summary
- `GET /api/v1/inventory/batches` - All inventory batches
- `POST /api/v1/inventory/batches` - Add new inventory batch
- `GET /api/v1/inventory/products/:id/batches` - Batches for specific product
- `GET /api/v1/inventory/low-stock` - Products with low stock

### Enhanced Sales
- Sales now automatically use FIFO allocation
- Each sale tracks batch allocations for accurate cost basis
- Profit calculations use actual purchase prices from batches

## Benefits

### 1. Accurate Cost Tracking
- Each sale knows the exact cost basis of sold items
- Profit calculations reflect actual purchase prices
- No more averaging issues when prices change

### 2. Inventory Valuation
- Real-time inventory value based on actual purchase prices
- Weighted average cost calculation
- Batch-level tracking for audit trails

### 3. Business Intelligence
- Track supplier performance
- Identify slow-moving vs fast-moving batches
- Monitor price trends over time

## Example Workflow

1. **Add First Batch:**
   - 5 laptops @ $1000 each
   - System creates Batch 1

2. **Add Second Batch:**
   - 5 laptops @ $1200 each  
   - System creates Batch 2
   - Total inventory: 10 laptops

3. **Sale 1 (3 laptops):**
   - All 3 from Batch 1 @ $1000
   - Remaining: Batch 1 (2), Batch 2 (5)

4. **Sale 2 (3 laptops):**
   - 2 from Batch 1 @ $1000 (finishes batch)
   - 1 from Batch 2 @ $1200
   - Remaining: Batch 1 (0), Batch 2 (4)

5. **Sale 3 (2 laptops):**
   - All 2 from Batch 2 @ $1200
   - Remaining: Batch 2 (2)

## Database Changes

### New Model: InventoryBatch
```javascript
{
  productId: ObjectId,
  buyPrice: Number,
  initialQuantity: Number,
  remainingQuantity: Number,
  purchaseDate: Date,
  batchNumber: String,
  supplierName: String,
  notes: String
}
```

### Updated Sale Model
```javascript
{
  products: [{
    // ... existing fields ...
    batchAllocations: [{
      batchId: ObjectId,
      quantity: Number,
      buyPrice: Number,
      batchNumber: String
    }]
  }]
}
```

## Migration Notes

### For Existing Products
1. Your existing products will continue to work
2. Create initial inventory batches for existing stock
3. Set purchase date to when you acquired the current inventory
4. The system will calculate total quantities from batches

### Backward Compatibility
- Existing sales functionality remains unchanged
- New FIFO logic is additive, not breaking
- Product quantities are automatically calculated from batches

## Getting Started

1. **Start your server:**
   ```bash
   cd backend
   npm start
   ```

2. **Add inventory batches for your laptops:**
   - Use the POST `/api/v1/inventory/batches` endpoint
   - Add each purchase as a separate batch

3. **Process sales normally:**
   - Use existing POST `/api/v1/sales` endpoint
   - FIFO allocation happens automatically

4. **Monitor inventory:**
   - Use GET `/api/v1/inventory/summary` for overview
   - Use GET `/api/v1/inventory/products/:id/batches` for details

Your FIFO inventory management system is now ready to handle your laptop scenario exactly as described!