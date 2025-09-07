import mongoose from "mongoose";

const productSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Product name is required"],
      trim: true,
      maxlength: [100, "Product name cannot exceed 100 characters"],
    },
    category: {
      type: String,
      required: [true, "Product category is required"],
      trim: true,
      maxlength: [50, "Category name cannot exceed 50 characters"],
    },
    buyPrice: {
      type: Number,
      required: [true, "Buy price is required"],
      min: [0, "Buy price cannot be negative"],
    },
    sellPrice: {
      type: Number,
      required: [true, "Sell price is required"],
      min: [0, "Sell price cannot be negative"],
      // Removed Mongoose-level price validation to avoid conflicts with updates
      // Price validation is handled in the controller layer for better control
    },
    quantity: {
      type: Number,
      required: [true, "Quantity is required"],
      min: [0, "Quantity cannot be negative"],
      default: 0,
    },
    description: {
      type: String,
      required: [true, "Product description is required"],
      trim: true,
      maxlength: [500, "Description cannot exceed 500 characters"],
    },
    image: {
      type: String,
      trim: true,
    },
    barcode: {
      type: String,
      unique: true,
      sparse: true, // Allows null values while maintaining uniqueness
      trim: true,
      index: true, // For fast barcode lookups
    },
    lowStockThreshold: {
      type: Number,
      default: 5,
      min: [0, "Low stock threshold cannot be negative"],
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Virtual for profit per unit
productSchema.virtual("profitPerUnit").get(function () {
  return this.sellPrice - this.buyPrice;
});

// Virtual for total inventory value (calculated from batches)
productSchema.virtual("inventoryValue").get(function () {
  return this.sellPrice * this.quantity;
});

// Virtual for low stock status
productSchema.virtual("isLowStock").get(function () {
  return this.quantity <= this.lowStockThreshold;
});

// Virtual for average buy price (weighted by remaining quantity in batches)
productSchema.virtual("averageBuyPrice").get(function () {
  // This will be populated when needed via aggregation
  return this.buyPrice;
});

// Enhanced index for efficient searching including barcode
productSchema.index({
  name: "text",
  category: "text",
  description: "text",
  barcode: "text",
});
productSchema.index({ category: 1 });
productSchema.index({ quantity: 1 });
productSchema.index({ isActive: 1 });
productSchema.index({ barcode: 1 });
productSchema.index({ category: 1, isActive: 1 });
productSchema.index({ quantity: 1, lowStockThreshold: 1 });

// Static method to get product with current inventory from batches
productSchema.statics.findWithInventory = async function(productId) {
  const InventoryBatch = mongoose.model('InventoryBatch');
  
  const product = await this.findById(productId);
  if (!product) return null;
  
  // Calculate total quantity from active batches
  const totalQuantity = await InventoryBatch.getTotalAvailableQuantity(productId);
  
  // Get average buy price from active batches
  const avgBuyPriceResult = await InventoryBatch.aggregate([
    {
      $match: {
        productId: new mongoose.Types.ObjectId(productId),
        remainingQuantity: { $gt: 0 },
        isActive: true
      }
    },
    {
      $group: {
        _id: null,
        weightedSum: {
          $sum: { $multiply: ['$buyPrice', '$remainingQuantity'] }
        },
        totalQuantity: { $sum: '$remainingQuantity' }
      }
    }
  ]);
  
  const avgBuyPrice = avgBuyPriceResult.length > 0 && avgBuyPriceResult[0].totalQuantity > 0
    ? avgBuyPriceResult[0].weightedSum / avgBuyPriceResult[0].totalQuantity
    : product.buyPrice;
  
  // Update the product object with calculated values
  product.quantity = totalQuantity;
  product.buyPrice = avgBuyPrice;
  
  return product;
};

// Static method to update product quantities from batches
productSchema.statics.updateQuantityFromBatches = async function(productId) {
  const InventoryBatch = mongoose.model('InventoryBatch');
  const totalQuantity = await InventoryBatch.getTotalAvailableQuantity(productId);
  
  await this.findByIdAndUpdate(productId, { quantity: totalQuantity });
  return totalQuantity;
};

const Product = mongoose.model("Product", productSchema);

export default Product;
