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
    description: {
      type: String,
      required: [true, "Product description is required"],
      trim: true,
      maxlength: [500, "Description cannot exceed 500 characters"],
    },
    barcode: {
      type: String,
      unique: true,
      sparse: true,
      trim: true,
      index: true,
    },
    image: {
      type: String,
      trim: true,
    },
    // Legacy fields for backward compatibility
    buyPrice: {
      type: Number,
      required: [true, "Buy price is required"],
      min: [0.01, "Buy price must be greater than 0"],
    },
    sellPrice: {
      type: Number,
      required: [true, "Sell price is required"],
      min: [0.01, "Sell price must be greater than 0"],
    },
    quantity: {
      type: Number,
      default: 0,
      min: [0, "Quantity cannot be negative"],
    },
    // Current average prices (calculated from active batches)
    currentBuyPrice: {
      type: Number,
      default: 0,
    },
    currentSellPrice: {
      type: Number,
      default: 0,
    },
    // Total quantity (calculated from all active batches)
    totalQuantity: {
      type: Number,
      default: 0,
      min: [0, "Quantity cannot be negative"],
    },
    // Inventory tracking
    lowStockThreshold: {
      type: Number,
      default: 5,
      min: [0, "Low stock threshold cannot be negative"],
    },
    reorderPoint: {
      type: Number,
      default: 10,
    },
    reorderQuantity: {
      type: Number,
      default: 20,
    },
    // Metadata
    isActive: {
      type: Boolean,
      default: true,
    },
    tags: [String],
    supplier: {
      preferred: String,
      alternates: [String],
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Virtuals
productSchema.virtual("isLowStock").get(function () {
  return this.totalQuantity <= this.lowStockThreshold;
});

productSchema.virtual("needsReorder").get(function () {
  return this.totalQuantity <= this.reorderPoint;
});

// Get inventory batches for this product
productSchema.virtual("batches", {
  ref: "InventoryBatch",
  localField: "_id",
  foreignField: "productId",
});

// Indexes
productSchema.index({ name: "text", description: "text" });
productSchema.index({ category: 1 });
productSchema.index({ barcode: 1 });
productSchema.index({ isActive: 1 });
productSchema.index({ totalQuantity: 1 });

// Method to update calculated fields from batches
productSchema.methods.updateFromBatches = async function () {
  const InventoryBatch = mongoose.model("InventoryBatch");

  const aggregation = await InventoryBatch.aggregate([
    {
      $match: {
        productId: this._id,
        status: "active",
        remainingQuantity: { $gt: 0 },
      },
    },
    {
      $group: {
        _id: null,
        totalQuantity: { $sum: "$remainingQuantity" },
        weightedBuyPrice: {
          $sum: {
            $multiply: ["$buyPrice", "$remainingQuantity"],
          },
        },
        weightedSellPrice: {
          $sum: {
            $multiply: ["$sellPrice", "$remainingQuantity"],
          },
        },
        totalRemainingQuantity: { $sum: "$remainingQuantity" },
      },
    },
  ]);

  if (aggregation.length > 0) {
    const stats = aggregation[0];
    this.totalQuantity = stats.totalQuantity;
    this.quantity = stats.totalQuantity; // Update legacy field
    this.currentBuyPrice =
      stats.totalRemainingQuantity > 0
        ? (stats.weightedBuyPrice / stats.totalRemainingQuantity).toFixed(2)
        : 0;
    this.currentSellPrice =
      stats.totalRemainingQuantity > 0
        ? (stats.weightedSellPrice / stats.totalRemainingQuantity).toFixed(2)
        : 0;
    // Update legacy fields with current values
    this.buyPrice = this.currentBuyPrice || this.buyPrice;
    this.sellPrice = this.currentSellPrice || this.sellPrice;
  } else {
    this.totalQuantity = 0;
    this.quantity = 0; // Update legacy field
    this.currentBuyPrice = 0;
    this.currentSellPrice = 0;
  }

  return this.save();
};

// Add this static method to the Product schema
productSchema.statics.updateQuantityFromBatches = async function (productId) {
  const InventoryBatch = mongoose.model("InventoryBatch");

  const aggregation = await InventoryBatch.aggregate([
    {
      $match: {
        productId: new mongoose.Types.ObjectId(productId),
        status: "active",
        remainingQuantity: { $gt: 0 },
      },
    },
    {
      $group: {
        _id: null,
        totalQuantity: { $sum: "$remainingQuantity" },
      },
    },
  ]);

  if (aggregation.length > 0) {
    await this.findByIdAndUpdate(productId, {
      quantity: aggregation[0].totalQuantity,
      totalQuantity: aggregation[0].totalQuantity,
    });
  } else {
    await this.findByIdAndUpdate(productId, {
      quantity: 0,
      totalQuantity: 0,
    });
  }
};
// Static method to get products with batch details
productSchema.statics.getWithBatchDetails = function () {
  return this.aggregate([
    {
      $match: { isActive: true },
    },
    {
      $lookup: {
        from: "inventorybatches",
        let: { productId: "$_id" },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [
                  { $eq: ["$productId", "$$productId"] },
                  { $eq: ["$status", "active"] },
                  { $gt: ["$remainingQuantity", 0] },
                ],
              },
            },
          },
          {
            $sort: { purchaseDate: 1 },
          },
        ],
        as: "batches",
      },
    },
    {
      $addFields: {
        oldestBatch: { $arrayElemAt: ["$batches", 0] },
        newestBatch: { $arrayElemAt: ["$batches", -1] },
        totalBatches: { $size: "$batches" },
      },
    },
  ]);
};

const Product = mongoose.model("Product", productSchema);

export default Product;
