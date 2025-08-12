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
      validate: {
        validator: function (value) {
          return value >= this.buyPrice;
        },
        message: "Sell price must be greater than or equal to buy price",
      },
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

// Virtual for total inventory value
productSchema.virtual("inventoryValue").get(function () {
  return this.sellPrice * this.quantity;
});

// Virtual for low stock status
productSchema.virtual("isLowStock").get(function () {
  return this.quantity <= this.lowStockThreshold;
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

const Product = mongoose.model("Product", productSchema);

export default Product;
