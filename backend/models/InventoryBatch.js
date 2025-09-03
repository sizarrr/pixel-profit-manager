import mongoose from 'mongoose';

const inventoryBatchSchema = new mongoose.Schema(
  {
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: [true, 'Product ID is required'],
      index: true
    },
    batchNumber: {
      type: String,
      required: [true, 'Batch number is required'],
      trim: true
    },
    buyPrice: {
      type: Number,
      required: [true, 'Buy price is required'],
      min: [0, 'Buy price cannot be negative']
    },
    initialQuantity: {
      type: Number,
      required: [true, 'Initial quantity is required'],
      min: [1, 'Initial quantity must be at least 1']
    },
    remainingQuantity: {
      type: Number,
      required: [true, 'Remaining quantity is required'],
      min: [0, 'Remaining quantity cannot be negative']
    },
    purchaseDate: {
      type: Date,
      required: [true, 'Purchase date is required'],
      default: Date.now
    },
    expiryDate: {
      type: Date,
      validate: {
        validator: function(value) {
          return !value || value > this.purchaseDate;
        },
        message: 'Expiry date must be after purchase date'
      }
    },
    supplierName: {
      type: String,
      trim: true,
      maxlength: [100, 'Supplier name cannot exceed 100 characters']
    },
    notes: {
      type: String,
      trim: true,
      maxlength: [500, 'Notes cannot exceed 500 characters']
    },
    isActive: {
      type: Boolean,
      default: true
    }
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

// Virtual for sold quantity
inventoryBatchSchema.virtual('soldQuantity').get(function() {
  return this.initialQuantity - this.remainingQuantity;
});

// Virtual for batch completion status
inventoryBatchSchema.virtual('isCompleted').get(function() {
  return this.remainingQuantity === 0;
});

// Virtual for days since purchase
inventoryBatchSchema.virtual('daysSincePurchase').get(function() {
  return Math.floor((Date.now() - this.purchaseDate.getTime()) / (1000 * 60 * 60 * 24));
});

// Compound index for efficient FIFO queries (oldest first for each product)
inventoryBatchSchema.index({ productId: 1, purchaseDate: 1 });
inventoryBatchSchema.index({ productId: 1, remainingQuantity: 1 });
inventoryBatchSchema.index({ isActive: 1 });
inventoryBatchSchema.index({ expiryDate: 1 });

// Pre-save middleware to generate batch number if not provided
inventoryBatchSchema.pre('save', async function(next) {
  if (!this.batchNumber) {
    const date = new Date(this.purchaseDate);
    const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');
    const timeStr = date.getTime().toString().slice(-6);
    this.batchNumber = `BATCH-${dateStr}-${timeStr}`;
  }
  next();
});

// Method to reduce quantity (for sales)
inventoryBatchSchema.methods.reduceQuantity = function(quantity) {
  if (quantity > this.remainingQuantity) {
    throw new Error(`Cannot reduce quantity by ${quantity}. Only ${this.remainingQuantity} remaining.`);
  }
  this.remainingQuantity -= quantity;
  return this.remainingQuantity;
};

// Static method to get available batches for a product (FIFO order)
inventoryBatchSchema.statics.getAvailableBatches = function(productId) {
  return this.find({
    productId,
    remainingQuantity: { $gt: 0 },
    isActive: true
  }).sort({ purchaseDate: 1, createdAt: 1 });
};

// Static method to get total available quantity for a product
inventoryBatchSchema.statics.getTotalAvailableQuantity = async function(productId) {
  const result = await this.aggregate([
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
        totalQuantity: { $sum: '$remainingQuantity' }
      }
    }
  ]);
  
  return result.length > 0 ? result[0].totalQuantity : 0;
};

const InventoryBatch = mongoose.model('InventoryBatch', inventoryBatchSchema);

export default InventoryBatch;