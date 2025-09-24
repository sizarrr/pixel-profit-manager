// backend/models/InventoryBatch.js - FIXED VERSION
import mongoose from "mongoose";

const inventoryBatchSchema = new mongoose.Schema(
  {
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: [true, "Product ID is required"],
      index: true,
    },
    batchNumber: {
      type: String,
      unique: true,
      trim: true,
      // Auto-generated, not required during creation
    },
    purchaseDate: {
      type: Date,
      required: [true, "Purchase date is required"],
      default: Date.now,
    },
    expiryDate: {
      type: Date,
      validate: {
        validator: function (value) {
          return !value || value > this.purchaseDate;
        },
        message: "Expiry date must be after purchase date",
      },
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
    },
    initialQuantity: {
      type: Number,
      required: [true, "Initial quantity is required"],
      min: [1, "Initial quantity must be at least 1"],
    },
    remainingQuantity: {
      type: Number,
      required: [true, "Remaining quantity is required"],
      min: [0, "Remaining quantity cannot be negative"],
      validate: {
        validator: function (value) {
          return value <= this.initialQuantity;
        },
        message: "Remaining quantity cannot exceed initial quantity",
      },
    },
    supplierName: {
      type: String,
      trim: true,
      default: "Unknown Supplier",
      maxlength: [100, "Supplier name cannot exceed 100 characters"],
    },
    invoiceNumber: {
      type: String,
      trim: true,
    },
    notes: {
      type: String,
      trim: true,
      maxlength: [500, "Notes cannot exceed 500 characters"],
    },
    status: {
      type: String,
      enum: ["active", "depleted", "expired", "cancelled"],
      default: "active",
    },
    costDetails: {
      shippingCost: { type: Number, default: 0 },
      taxAmount: { type: Number, default: 0 },
      otherCosts: { type: Number, default: 0 },
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Virtual for total cost per unit including all costs
inventoryBatchSchema.virtual("totalUnitCost").get(function () {
  const totalAdditionalCosts =
    (this.costDetails?.shippingCost || 0) +
    (this.costDetails?.taxAmount || 0) +
    (this.costDetails?.otherCosts || 0);

  return this.buyPrice + totalAdditionalCosts / this.initialQuantity;
});

// Virtual for profit margin
inventoryBatchSchema.virtual("profitMargin").get(function () {
  return (
    ((this.sellPrice - this.totalUnitCost) / this.sellPrice) *
    100
  ).toFixed(2);
});

// Virtual for batch age in days
inventoryBatchSchema.virtual("ageInDays").get(function () {
  return Math.floor(
    (Date.now() - this.purchaseDate.getTime()) / (1000 * 60 * 60 * 24)
  );
});

// Indexes for performance
inventoryBatchSchema.index({ productId: 1, purchaseDate: 1 });
inventoryBatchSchema.index({ productId: 1, status: 1, remainingQuantity: 1 });
inventoryBatchSchema.index({ status: 1 });

// Generate batch number before saving - IMPROVED VERSION
inventoryBatchSchema.pre("save", async function (next) {
  if (!this.batchNumber) {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    const hours = String(date.getHours()).padStart(2, "0");
    const minutes = String(date.getMinutes()).padStart(2, "0");
    const seconds = String(date.getSeconds()).padStart(2, "0");
    const milliseconds = String(date.getMilliseconds()).padStart(3, "0");
    const random = Math.random().toString(36).substring(2, 8).toUpperCase();

    // More unique batch number with timestamp and random string
    this.batchNumber = `BATCH-${year}${month}${day}-${hours}${minutes}${seconds}${milliseconds}-${random}`;
  }

  // Auto-update status based on quantity
  if (this.remainingQuantity === 0 && this.status === "active") {
    this.status = "depleted";
  }

  // Check if batch is expired
  if (
    this.expiryDate &&
    this.expiryDate < new Date() &&
    this.status === "active"
  ) {
    this.status = "expired";
  }

  next();
});

// Method to consume from batch (for FIFO allocation)
inventoryBatchSchema.methods.consume = function (quantity) {
  if (quantity > this.remainingQuantity) {
    throw new Error(
      `Cannot consume ${quantity} units. Only ${this.remainingQuantity} available in batch ${this.batchNumber}`
    );
  }

  this.remainingQuantity -= quantity;

  if (this.remainingQuantity === 0) {
    this.status = "depleted";
  }

  return this.save();
};

// Add this static method to get total available quantity
inventoryBatchSchema.statics.getTotalAvailableQuantity = async function (
  productId
) {
  const result = await this.aggregate([
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

  return result.length > 0 ? result[0].totalQuantity : 0;
};

// Static method to get available batches for a product in FIFO order
inventoryBatchSchema.statics.getAvailableBatchesFIFO = function (productId) {
  return this.find({
    productId,
    status: "active",
    remainingQuantity: { $gt: 0 },
  })
    .sort({ purchaseDate: 1, createdAt: 1 }) // FIFO: oldest first
    .populate("productId", "name category");
};

// Static method to allocate quantity using FIFO
inventoryBatchSchema.statics.allocateFIFO = async function (
  productId,
  requiredQuantity
) {
  const batches = await this.getAvailableBatchesFIFO(productId);
  const allocations = [];
  let remainingToAllocate = requiredQuantity;

  for (const batch of batches) {
    if (remainingToAllocate <= 0) break;

    const allocateFromBatch = Math.min(
      remainingToAllocate,
      batch.remainingQuantity
    );

    allocations.push({
      batchId: batch._id,
      batchNumber: batch.batchNumber,
      quantity: allocateFromBatch,
      buyPrice: batch.buyPrice,
      sellPrice: batch.sellPrice,
      totalCost: batch.totalUnitCost * allocateFromBatch,
      purchaseDate: batch.purchaseDate,
    });

    remainingToAllocate -= allocateFromBatch;
  }

  if (remainingToAllocate > 0) {
    throw new Error(
      `Insufficient inventory. Need ${requiredQuantity}, but only ${
        requiredQuantity - remainingToAllocate
      } available`
    );
  }

  return allocations;
};

const InventoryBatch = mongoose.model("InventoryBatch", inventoryBatchSchema);

export default InventoryBatch;
