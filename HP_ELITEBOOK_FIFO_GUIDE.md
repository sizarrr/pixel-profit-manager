# HP EliteBook FIFO Inventory Management Guide

## Your Scenario

You want to implement FIFO (First In, First Out) inventory management for HP EliteBook laptops where:
- **First Batch**: 5 HP EliteBooks bought at $100, selling at $150
- **Second Batch**: 5 HP EliteBooks bought at $120, selling at $170

The system should automatically sell from the first (cheaper) batch before touching the second (more expensive) batch.

## How FIFO Works in This System

### 1. **Batch-Based Inventory Tracking**
Instead of just tracking total quantity, the system maintains separate batches with:
- Purchase price (cost)
- Purchase date
- Remaining quantity
- Supplier information

### 2. **Automatic FIFO Allocation**
When you make a sale:
- System finds all available batches for the product
- Sorts them by purchase date (oldest first)
- Allocates inventory from oldest batches first
- Tracks which batches were used in each sale

### 3. **Accurate Profit Calculation**
- Uses actual purchase prices from batches
- Not the current product price
- Provides real profit margins

## Step-by-Step Implementation

### Step 1: Create the HP EliteBook Product

First, create your HP EliteBook product in the system:

```javascript
// Using the API
POST /api/v1/products
{
  "name": "HP EliteBook 840 G8",
  "category": "Laptops",
  "buyPrice": 100,
  "sellPrice": 150,
  "quantity": 0,
  "description": "HP EliteBook 840 G8 - Business Laptop",
  "barcode": "HP-ELITE-840"
}
```

### Step 2: Add First Inventory Batch (5 @ $100)

Add your first batch of 5 laptops bought at $100:

```javascript
POST /api/v1/inventory/batches
{
  "productId": "your-product-id",
  "buyPrice": 100,
  "quantity": 5,
  "supplierName": "Supplier A",
  "notes": "First batch - lower cost"
}
```

### Step 3: Add Second Inventory Batch (5 @ $120)

Add your second batch of 5 laptops bought at $120:

```javascript
POST /api/v1/inventory/batches
{
  "productId": "your-product-id",
  "buyPrice": 120,
  "quantity": 5,
  "supplierName": "Supplier B",
  "notes": "Second batch - higher cost"
}
```

**Note**: When adding the second batch, update the product's sell price to $170 if needed:

```javascript
PUT /api/v1/products/your-product-id
{
  "sellPrice": 170
}
```

### Step 4: Making Sales (FIFO in Action)

#### Sale Example 1: Selling 3 Laptops

```javascript
POST /api/v1/sales
{
  "products": [{
    "productId": "your-product-id",
    "productName": "HP EliteBook 840 G8",
    "quantity": 3,
    "sellPrice": 150,
    "total": 450
  }],
  "totalAmount": 450,
  "cashierName": "John Doe",
  "paymentMethod": "cash"
}
```

**What happens:**
- All 3 laptops come from Batch 1 (@ $100 cost)
- Cost: 3 × $100 = $300
- Revenue: 3 × $150 = $450
- Profit: $450 - $300 = $150
- Remaining: Batch 1 (2 units), Batch 2 (5 units)

#### Sale Example 2: Selling 4 More Laptops

```javascript
POST /api/v1/sales
{
  "products": [{
    "productId": "your-product-id",
    "productName": "HP EliteBook 840 G8",
    "quantity": 4,
    "sellPrice": 160,
    "total": 640
  }],
  "totalAmount": 640,
  "cashierName": "Jane Smith",
  "paymentMethod": "card"
}
```

**What happens:**
- 2 laptops from Batch 1 (@ $100 cost) - exhausts this batch
- 2 laptops from Batch 2 (@ $120 cost)
- Cost: (2 × $100) + (2 × $120) = $440
- Revenue: 4 × $160 = $640
- Profit: $640 - $440 = $200
- Remaining: Batch 2 (3 units)

### Step 5: Checking Inventory Status

#### View All Batches for a Product
```http
GET /api/v1/inventory/products/your-product-id/batches
```

#### View Inventory Summary
```http
GET /api/v1/inventory/summary
```

## Running the Example Script

We've created a demonstration script that shows the complete FIFO workflow:

```bash
cd backend
node scripts/hp-elitebook-fifo-example.js
```

This script will:
1. Create the HP EliteBook product
2. Add both inventory batches
3. Process sample sales showing FIFO allocation
4. Display profit calculations
5. Show remaining inventory

## Key Benefits

### 1. **Accurate Profit Tracking**
- First batch sold: $150 - $100 = $50 profit per unit
- Second batch sold: $170 - $120 = $50 profit per unit
- System tracks actual costs, not averaged prices

### 2. **Inventory Valuation**
- Remaining inventory valued at actual cost
- No averaging that distorts true inventory value

### 3. **Tax Compliance**
- FIFO is a standard accounting method
- Provides accurate cost basis for tax purposes

### 4. **Supplier Management**
- Track which supplier's inventory sells faster
- Compare profitability by supplier

## API Endpoints Reference

### Inventory Batch Management
- `POST /api/v1/inventory/batches` - Add new batch
- `GET /api/v1/inventory/batches` - List all batches
- `GET /api/v1/inventory/products/:id/batches` - Batches for product
- `GET /api/v1/inventory/summary` - Overall summary

### Sales (with FIFO)
- `POST /api/v1/sales` - Create sale (auto FIFO)
- `GET /api/v1/sales` - List sales
- `GET /api/v1/sales/:id` - Sale details (shows batch allocations)

### Reports
- `GET /api/v1/dashboard/stats` - Dashboard with FIFO profits
- `GET /api/v1/sales/profit` - Profit analysis using batch costs

## Important Notes

1. **Don't Update Product Buy Price**: When you get new inventory at a different price, create a new batch instead of updating the product's buy price.

2. **Sell Price Flexibility**: You can update the product's sell price anytime. Sales will use whatever price you specify at the time of sale.

3. **Automatic Calculations**: The system automatically:
   - Calculates total quantity from all active batches
   - Uses weighted average for display purposes
   - Allocates from oldest batches first

4. **Batch Tracking**: Every sale records which batches were used, providing a complete audit trail.

## Troubleshooting

### Issue: Wrong profit calculations
**Solution**: Ensure you're creating inventory batches instead of just updating product prices.

### Issue: Not seeing FIFO behavior
**Solution**: Check that batches have different purchase dates. The system sorts by purchase date, then creation date.

### Issue: Inventory count mismatch
**Solution**: Run `Product.updateQuantityFromBatches(productId)` to recalculate from batches.

## Next Steps

1. **Set up the product** using the API or admin interface
2. **Add your inventory batches** with correct costs
3. **Process sales** normally - FIFO happens automatically
4. **Monitor reports** to see accurate profit margins

The FIFO system is now ready to handle your HP EliteBook inventory exactly as specified!