# FIFO Manual Testing Guide

## Overview
This guide provides step-by-step instructions for manually testing your FIFO inventory implementation to ensure it works correctly in real-world scenarios.

## Prerequisites
1. Backend server running (`npm start`)
2. Database connection established
3. API testing tool (Postman, curl, or similar)

## Test Scenarios

### Scenario 1: Basic FIFO Verification

**Objective**: Verify that sales consume inventory from oldest batches first.

#### Step 1: Create a Test Product
```bash
POST /api/v1/products
{
  "name": "Manual Test Laptop",
  "category": "Electronics",
  "buyPrice": 1000,
  "sellPrice": 1500,
  "description": "Laptop for manual FIFO testing",
  "lowStockThreshold": 2
}
```
*Save the returned `productId` for subsequent steps.*

#### Step 2: Add First Inventory Batch (Older)
```bash
POST /api/v1/inventory/batches
{
  "productId": "YOUR_PRODUCT_ID",
  "buyPrice": 1000,
  "quantity": 5,
  "supplierName": "Supplier A",
  "purchaseDate": "2024-01-01T00:00:00Z",
  "notes": "First batch - should be sold first"
}
```

#### Step 3: Add Second Inventory Batch (Newer)
```bash
POST /api/v1/inventory/batches
{
  "productId": "YOUR_PRODUCT_ID",
  "buyPrice": 1200,
  "quantity": 5,
  "supplierName": "Supplier B",
  "purchaseDate": "2024-01-15T00:00:00Z",
  "notes": "Second batch - should be sold second"
}
```

#### Step 4: Check Inventory Summary
```bash
GET /api/v1/inventory/summary
```
**Expected Result**: Product should show total quantity of 10 with 2 batches.

#### Step 5: Make a Sale (3 Items)
```bash
POST /api/v1/sales
{
  "products": [{
    "productId": "YOUR_PRODUCT_ID",
    "productName": "Manual Test Laptop",
    "quantity": 3,
    "sellPrice": 1500,
    "total": 4500
  }],
  "totalAmount": 4500,
  "cashierName": "Manual Tester",
  "paymentMethod": "cash"
}
```

#### Step 6: Verify FIFO Behavior
**Check the sale response:**
- `batchAllocations` should have 1 entry
- `batchAllocations[0].quantity` should be 3
- `batchAllocations[0].buyPrice` should be 1000 (from first batch)

**Check remaining inventory:**
```bash
GET /api/v1/inventory/products/YOUR_PRODUCT_ID/batches
```
**Expected Result**:
- First batch: 2 remaining (5 - 3)
- Second batch: 5 remaining (unchanged)

### Scenario 2: Cross-Batch Sales

**Objective**: Verify sales that span multiple batches.

#### Step 7: Make Another Sale (4 Items)
```bash
POST /api/v1/sales
{
  "products": [{
    "productId": "YOUR_PRODUCT_ID",
    "productName": "Manual Test Laptop",
    "quantity": 4,
    "sellPrice": 1500,
    "total": 6000
  }],
  "totalAmount": 6000,
  "cashierName": "Manual Tester",
  "paymentMethod": "cash"
}
```

#### Step 8: Verify Cross-Batch Allocation
**Check the sale response:**
- `batchAllocations` should have 2 entries
- `batchAllocations[0]`: 2 items at $1000 (finishing first batch)
- `batchAllocations[1]`: 2 items at $1200 (starting second batch)

**Check remaining inventory:**
- First batch: 0 remaining
- Second batch: 3 remaining (5 - 2)

### Scenario 3: Error Handling

#### Step 9: Attempt Oversell
```bash
POST /api/v1/sales
{
  "products": [{
    "productId": "YOUR_PRODUCT_ID",
    "productName": "Manual Test Laptop",
    "quantity": 10,
    "sellPrice": 1500,
    "total": 15000
  }],
  "totalAmount": 15000,
  "cashierName": "Manual Tester",
  "paymentMethod": "cash"
}
```
**Expected Result**: 400 error with "Insufficient stock" message.

#### Step 10: Verify No Inventory Change
```bash
GET /api/v1/inventory/products/YOUR_PRODUCT_ID/batches
```
**Expected Result**: Inventory should remain unchanged from Step 8.

### Scenario 4: Multiple Products

#### Step 11: Create Second Product
```bash
POST /api/v1/products
{
  "name": "Manual Test Mouse",
  "category": "Electronics",
  "buyPrice": 50,
  "sellPrice": 75,
  "description": "Mouse for multi-product FIFO testing"
}
```

#### Step 12: Add Inventory for Second Product
```bash
POST /api/v1/inventory/batches
{
  "productId": "MOUSE_PRODUCT_ID",
  "buyPrice": 45,
  "quantity": 10,
  "supplierName": "Mouse Supplier",
  "purchaseDate": "2024-01-05T00:00:00Z"
}
```

#### Step 13: Multi-Product Sale
```bash
POST /api/v1/sales
{
  "products": [
    {
      "productId": "LAPTOP_PRODUCT_ID",
      "productName": "Manual Test Laptop",
      "quantity": 2,
      "sellPrice": 1500,
      "total": 3000
    },
    {
      "productId": "MOUSE_PRODUCT_ID",
      "productName": "Manual Test Mouse",
      "quantity": 5,
      "sellPrice": 75,
      "total": 375
    }
  ],
  "totalAmount": 3375,
  "cashierName": "Manual Tester",
  "paymentMethod": "cash"
}
```

#### Step 14: Verify Multi-Product FIFO
**Check the sale response:**
- Each product should have its own `batchAllocations`
- Laptop allocation from second batch (buyPrice: 1200)
- Mouse allocation from first batch (buyPrice: 45)

## Performance Testing

### Scenario 5: Large Volume Test

#### Step 15: Create Product with Many Batches
Use the existing demo script:
```bash
node scripts/demo-fifo-logic.js
```

#### Step 16: Monitor Performance
- Check response times for sales
- Verify memory usage doesn't spike
- Confirm database queries are efficient

## Validation Checklist

### ✅ FIFO Behavior
- [ ] Sales consume oldest inventory first
- [ ] Cross-batch sales work correctly
- [ ] Batch allocation tracking is accurate
- [ ] Purchase dates determine order (not creation order)

### ✅ Error Handling
- [ ] Insufficient stock errors prevent sales
- [ ] Price mismatches are caught
- [ ] Invalid product IDs are handled
- [ ] Database errors don't corrupt inventory

### ✅ Data Consistency
- [ ] Product quantities match sum of batch quantities
- [ ] Batch remaining quantities are accurate
- [ ] Sale records contain complete batch allocation info
- [ ] Concurrent sales don't create inconsistencies

### ✅ Performance
- [ ] Sales complete within acceptable time limits
- [ ] Large batch counts don't cause timeouts
- [ ] Memory usage remains stable
- [ ] Database indexes are being used effectively

## Troubleshooting

### Common Issues

1. **Wrong FIFO Order**
   - Check `purchaseDate` values in batches
   - Verify sorting logic in queries
   - Confirm database indexes exist

2. **Inventory Inconsistencies**
   - Check for transaction rollback failures
   - Verify `updateQuantityFromBatches` is called
   - Look for race conditions in concurrent sales

3. **Performance Issues**
   - Check database indexes on `productId` and `purchaseDate`
   - Monitor query execution plans
   - Consider batch size optimization

4. **Batch Allocation Errors**
   - Verify batch allocation calculation logic
   - Check for floating-point precision issues
   - Confirm batch updates are atomic

## Success Criteria

Your FIFO implementation passes manual testing if:

1. **Correctness**: All sales follow FIFO order consistently
2. **Reliability**: Error conditions are handled gracefully
3. **Performance**: Operations complete within reasonable time
4. **Consistency**: Data remains consistent across all operations
5. **Scalability**: System handles realistic inventory volumes

## Next Steps

After completing manual testing:

1. Run automated test suite: `npm run test:fifo`
2. Perform load testing with realistic data volumes
3. Test with your actual product data
4. Monitor production performance metrics
5. Set up alerting for inventory inconsistencies

## Support

If you encounter issues during manual testing:

1. Check server logs for detailed error messages
2. Verify database connection and indexes
3. Review the FIFO implementation documentation
4. Use the demo scripts to isolate issues
5. Test with smaller data sets first