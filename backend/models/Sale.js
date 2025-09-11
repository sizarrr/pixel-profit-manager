import mongoose from "mongoose";

const batchAllocationSchema = new mongoose.Schema(
  {
    batchId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "InventoryBatch",
      required: true,
    },
    batchNumber: String,
    quantity: {
      type: Number,
      required: true,
      min: [0.01, "Quantity must be positive"],
    },
    buyPrice: {
      type: Number,
      required: true,
    },
    sellPrice: {
      type: Number,
      required: true,
    },
    profit: {
      type: Number,
      required: true,
    },
  },
  { _id: false }
);

const saleProductSchema = new mongoose.Schema(
  {
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
    },
    productName: {
      type: String,
      required: true,
    },
    quantity: {
      type: Number,
      required: true,
      min: [0.01, "Quantity must be positive"],
    },
    // FIFO batch allocations
    batchAllocations: [batchAllocationSchema],
    // Aggregated values
    totalCost: {
      type: Number,
      required: true,
    },
    totalPrice: {
      type: Number,
      required: true,
    },
    totalProfit: {
      type: Number,
      required: true,
    },
  },
  { _id: false }
);

const saleSchema = new mongoose.Schema(
  {
    receiptNumber: {
      type: String,
      unique: true,
      required: true,
    },
    products: {
      type: [saleProductSchema],
      required: true,
      validate: {
        validator: function (products) {
          return products && products.length > 0;
        },
        message: "At least one product is required",
      },
    },
    subtotal: {
      type: Number,
      required: true,
    },
    taxRate: {
      type: Number,
      default: 0,
    },
    taxAmount: {
      type: Number,
      default: 0,
    },
    discountAmount: {
      type: Number,
      default: 0,
    },
    totalAmount: {
      type: Number,
      required: true,
    },
    totalCost: {
      type: Number,
      required: true,
    },
    totalProfit: {
      type: Number,
      required: true,
    },
    paymentMethod: {
      type: String,
      enum: ["cash", "card", "digital", "check"],
      default: "cash",
    },
    cashierName: {
      type: String,
      required: true,
      trim: true,
    },
    customerName: {
      type: String,
      trim: true,
    },
    customerPhone: {
      type: String,
      trim: true,
    },
    notes: {
      type: String,
      trim: true,
      maxlength: 500,
    },
    status: {
      type: String,
      enum: ["completed", "refunded", "partial_refund", "cancelled"],
      default: "completed",
    },
  },
  {
    timestamps: true,
  }
);

// Generate receipt number
saleSchema.pre("save", async function (next) {
  if (!this.receiptNumber) {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    const count = await mongoose.model("Sale").countDocuments({
      createdAt: {
        $gte: new Date(date.setHours(0, 0, 0, 0)),
        $lt: new Date(date.setHours(23, 59, 59, 999)),
      },
    });

    this.receiptNumber = `RCP-${year}${month}${day}-${String(
      count + 1
    ).padStart(4, "0")}`;
  }
  next();
});

// Indexes
saleSchema.index({ receiptNumber: 1 });
saleSchema.index({ createdAt: -1 });
saleSchema.index({ cashierName: 1 });
saleSchema.index({ status: 1 });
saleSchema.index({ "products.productId": 1 });

const Sale = mongoose.model("Sale", saleSchema);

export default Sale;
