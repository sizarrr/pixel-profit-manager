// backend/models/Sale.js - FIXED VERSION
import mongoose from "mongoose";

const batchAllocationSchema = new mongoose.Schema(
  {
    batchId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "InventoryBatch",
      required: [true, "Batch ID is required"],
    },
    quantity: {
      type: Number,
      required: [true, "Allocated quantity is required"],
      min: [0.01, "Allocated quantity must be greater than 0"],
    },
    buyPrice: {
      type: Number,
      required: [true, "Buy price is required"],
      min: [0, "Buy price cannot be negative"],
    },
    batchNumber: {
      type: String,
      required: [true, "Batch number is required"],
      trim: true,
    },
  },
  { _id: false }
);

const saleProductSchema = new mongoose.Schema(
  {
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: [true, "Product ID is required"],
    },
    productName: {
      type: String,
      required: [true, "Product name is required"],
      trim: true,
      minlength: [1, "Product name cannot be empty"],
      maxlength: [200, "Product name cannot exceed 200 characters"],
    },
    quantity: {
      type: Number,
      required: [true, "Quantity is required"],
      min: [0.01, "Quantity must be greater than 0"],
      validate: {
        validator: function (value) {
          return Number.isFinite(value) && value > 0;
        },
        message: "Quantity must be a valid positive number",
      },
    },
    sellPrice: {
      type: Number,
      required: [true, "Sell price is required"],
      min: [0, "Sell price cannot be negative"],
      validate: {
        validator: function (value) {
          return Number.isFinite(value) && value >= 0;
        },
        message: "Sell price must be a valid non-negative number",
      },
    },
    total: {
      type: Number,
      required: [true, "Total is required"],
      min: [0, "Total cannot be negative"],
      validate: {
        validator: function (value) {
          return Number.isFinite(value) && value >= 0;
        },
        message: "Total must be a valid non-negative number",
      },
    },
    batchAllocations: {
      type: [batchAllocationSchema],
      default: [],
    },
  },
  { _id: false }
);

const saleSchema = new mongoose.Schema(
  {
    products: {
      type: [saleProductSchema],
      required: [true, "Products are required"],
      validate: {
        validator: function (products) {
          return products && Array.isArray(products) && products.length > 0;
        },
        message: "At least one product is required",
      },
    },
    totalAmount: {
      type: Number,
      required: [true, "Total amount is required"],
      min: [0.01, "Total amount must be greater than 0"],
      validate: {
        validator: function (value) {
          return Number.isFinite(value) && value > 0;
        },
        message: "Total amount must be a valid positive number",
      },
    },
    cashierName: {
      type: String,
      required: [true, "Cashier name is required"],
      trim: true,
      minlength: [1, "Cashier name cannot be empty"],
      maxlength: [100, "Cashier name cannot exceed 100 characters"],
    },
    paymentMethod: {
      type: String,
      enum: {
        values: ["cash", "card", "digital"],
        message: "Payment method must be cash, card, or digital",
      },
      default: "cash",
    },
    customerName: {
      type: String,
      trim: true,
      maxlength: [100, "Customer name cannot exceed 100 characters"],
    },
    notes: {
      type: String,
      trim: true,
      maxlength: [500, "Notes cannot exceed 500 characters"],
    },
    receiptNumber: {
      type: String,
      unique: true,
      sparse: true, // Allows for automatic generation
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Virtual for total profit (calculated from batch allocations)
saleSchema.virtual("totalProfit").get(function () {
  return this.products.reduce((totalProfit, product) => {
    if (product.batchAllocations && product.batchAllocations.length > 0) {
      // Calculate profit using actual FIFO batch costs
      const actualCost = product.batchAllocations.reduce((cost, allocation) => {
        return cost + allocation.buyPrice * allocation.quantity;
      }, 0);
      return totalProfit + (product.total - actualCost);
    }
    return totalProfit;
  }, 0);
});

// Virtual for items count
saleSchema.virtual("itemsCount").get(function () {
  return this.products.reduce((count, product) => count + product.quantity, 0);
});

// Pre-save middleware to generate receipt number
saleSchema.pre("save", async function (next) {
  if (!this.receiptNumber) {
    const date = new Date();
    const dateStr = date.toISOString().slice(0, 10).replace(/-/g, "");
    const timeStr = date.getTime().toString().slice(-6);
    const randomStr = Math.random().toString(36).substring(2, 5).toUpperCase();
    this.receiptNumber = `RCP-${dateStr}-${timeStr}-${randomStr}`;
  }

  // Validate total amount matches sum of product totals
  const calculatedTotal = this.products.reduce(
    (sum, product) => sum + product.total,
    0
  );
  const tolerance = 0.01; // Allow for small rounding differences

  if (Math.abs(this.totalAmount - calculatedTotal) > tolerance) {
    const error = new Error(
      `Total amount (${this.totalAmount}) does not match sum of product totals (${calculatedTotal})`
    );
    error.name = "ValidationError";
    return next(error);
  }

  next();
});

// Pre-save middleware to validate individual product calculations
saleSchema.pre("save", function (next) {
  for (let i = 0; i < this.products.length; i++) {
    const product = this.products[i];
    const expectedTotal =
      Math.round(product.sellPrice * product.quantity * 100) / 100;
    const actualTotal = Math.round(product.total * 100) / 100;

    if (Math.abs(actualTotal - expectedTotal) > 0.01) {
      const error = new Error(
        `Product ${i + 1} (${
          product.productName
        }): Total (${actualTotal}) does not match sellPrice × quantity (${expectedTotal})`
      );
      error.name = "ValidationError";
      return next(error);
    }
  }
  next();
});

// Index for efficient querying
saleSchema.index({ createdAt: -1 });
saleSchema.index({ cashierName: 1 });
saleSchema.index({ receiptNumber: 1 });
saleSchema.index({ "products.productId": 1 });
saleSchema.index({ paymentMethod: 1 });
saleSchema.index({ totalAmount: 1 });

// Compound indexes for common queries
saleSchema.index({ createdAt: -1, cashierName: 1 });
saleSchema.index({ createdAt: -1, paymentMethod: 1 });

const Sale = mongoose.model("Sale", saleSchema);

export default Sale;
