import mongoose from 'mongoose';

const saleProductSchema = new mongoose.Schema({
  productId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: [true, 'Product ID is required']
  },
  productName: {
    type: String,
    required: [true, 'Product name is required'],
    trim: true
  },
  quantity: {
    type: Number,
    required: [true, 'Quantity is required'],
    min: [1, 'Quantity must be at least 1']
  },
  sellPrice: {
    type: Number,
    required: [true, 'Sell price is required'],
    min: [0, 'Sell price cannot be negative']
  },
  total: {
    type: Number,
    required: [true, 'Total is required'],
    min: [0, 'Total cannot be negative']
  }
}, { _id: false });

const saleSchema = new mongoose.Schema({
  products: {
    type: [saleProductSchema],
    required: [true, 'Products are required'],
    validate: {
      validator: function(products) {
        return products && products.length > 0;
      },
      message: 'At least one product is required'
    }
  },
  totalAmount: {
    type: Number,
    required: [true, 'Total amount is required'],
    min: [0, 'Total amount cannot be negative']
  },
  cashierName: {
    type: String,
    required: [true, 'Cashier name is required'],
    trim: true,
    maxlength: [100, 'Cashier name cannot exceed 100 characters']
  },
  paymentMethod: {
    type: String,
    enum: ['cash', 'card', 'digital'],
    default: 'cash'
  },
  customerName: {
    type: String,
    trim: true,
    maxlength: [100, 'Customer name cannot exceed 100 characters']
  },
  notes: {
    type: String,
    trim: true,
    maxlength: [500, 'Notes cannot exceed 500 characters']
  },
  receiptNumber: {
    type: String,
    unique: true,
    required: true
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Virtual for total profit
saleSchema.virtual('totalProfit').get(function() {
  // This would need to be calculated by looking up original buy prices
  // For now, we'll calculate it in the controller
  return 0;
});

// Pre-save middleware to generate receipt number
saleSchema.pre('save', async function(next) {
  if (!this.receiptNumber) {
    const date = new Date();
    const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');
    const timeStr = date.getTime().toString().slice(-6);
    this.receiptNumber = `RCP-${dateStr}-${timeStr}`;
  }
  next();
});

// Index for efficient querying
saleSchema.index({ createdAt: -1 });
saleSchema.index({ cashierName: 1 });
saleSchema.index({ receiptNumber: 1 });
saleSchema.index({ 'products.productId': 1 });

const Sale = mongoose.model('Sale', saleSchema);

export default Sale;