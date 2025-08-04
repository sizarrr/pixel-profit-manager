import mongoose from 'mongoose';

// Sale item subdocument schema
const saleItemSchema = new mongoose.Schema({
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
    min: [0, 'Sell price must be positive']
  },
  total: {
    type: Number,
    required: [true, 'Total is required'],
    min: [0, 'Total must be positive']
  }
}, { _id: true });

// Main sale schema
const saleSchema = new mongoose.Schema({
  products: {
    type: [saleItemSchema],
    required: [true, 'Products array is required'],
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
    min: [0, 'Total amount must be positive']
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
  status: {
    type: String,
    enum: ['completed', 'voided', 'refunded'],
    default: 'completed'
  },
  notes: {
    type: String,
    trim: true,
    maxlength: [500, 'Notes cannot exceed 500 characters']
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Virtual for profit calculation
saleSchema.virtual('profit').get(function() {
  // This would require product lookup for buy prices
  // For now, return 0 - will be calculated in analytics
  return 0;
});

// Virtual for number of items
saleSchema.virtual('itemCount').get(function() {
  return this.products.reduce((total, item) => total + item.quantity, 0);
});

// Indexes for better query performance
saleSchema.index({ createdAt: -1 });
saleSchema.index({ cashierName: 1 });
saleSchema.index({ status: 1 });
saleSchema.index({ totalAmount: -1 });
saleSchema.index({ 'products.productId': 1 });

// Static method to get sales by date range
saleSchema.statics.getByDateRange = function(startDate, endDate) {
  return this.find({
    createdAt: {
      $gte: new Date(startDate),
      $lte: new Date(endDate)
    }
  }).sort({ createdAt: -1 });
};

// Static method to get today's sales
saleSchema.statics.getTodaysSales = function() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  
  return this.find({
    createdAt: {
      $gte: today,
      $lt: tomorrow
    },
    status: 'completed'
  });
};

// Static method to get sales by cashier
saleSchema.statics.getByCashier = function(cashierName) {
  return this.find({ cashierName }).sort({ createdAt: -1 });
};

// Static method to get monthly sales
saleSchema.statics.getMonthlySales = function(year, month) {
  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 0, 23, 59, 59);
  
  return this.find({
    createdAt: {
      $gte: startDate,
      $lte: endDate
    },
    status: 'completed'
  });
};

// Instance method to calculate total
saleSchema.methods.calculateTotal = function() {
  return this.products.reduce((total, item) => total + item.total, 0);
};

// Instance method to void sale
saleSchema.methods.voidSale = function() {
  this.status = 'voided';
  return this.save();
};

// Pre-save middleware to validate total amount
saleSchema.pre('save', function(next) {
  const calculatedTotal = this.calculateTotal();
  if (Math.abs(this.totalAmount - calculatedTotal) > 0.01) {
    next(new Error('Total amount does not match sum of product totals'));
  } else {
    next();
  }
});

// Pre-save middleware to validate sale item totals
saleSchema.pre('save', function(next) {
  for (const item of this.products) {
    const expectedTotal = item.quantity * item.sellPrice;
    if (Math.abs(item.total - expectedTotal) > 0.01) {
      next(new Error(`Invalid total for product ${item.productName}`));
      return;
    }
  }
  next();
});

const Sale = mongoose.model('Sale', saleSchema);

export default Sale;