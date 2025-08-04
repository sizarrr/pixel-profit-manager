import mongoose from 'mongoose';

const productSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Product name is required'],
    trim: true,
    maxlength: [200, 'Product name cannot exceed 200 characters']
  },
  category: {
    type: String,
    required: [true, 'Category is required'],
    trim: true,
    maxlength: [100, 'Category cannot exceed 100 characters']
  },
  buyPrice: {
    type: Number,
    required: [true, 'Buy price is required'],
    min: [0, 'Buy price must be positive']
  },
  sellPrice: {
    type: Number,
    required: [true, 'Sell price is required'],
    min: [0, 'Sell price must be positive']
  },
  quantity: {
    type: Number,
    required: [true, 'Quantity is required'],
    min: [0, 'Quantity cannot be negative'],
    default: 0
  },
  description: {
    type: String,
    trim: true,
    maxlength: [1000, 'Description cannot exceed 1000 characters']
  },
  image: {
    type: String,
    trim: true
  }
}, {
  timestamps: true, // Automatically adds createdAt and updatedAt
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Virtual for profit per unit
productSchema.virtual('profitPerUnit').get(function() {
  return this.sellPrice - this.buyPrice;
});

// Virtual for total inventory value
productSchema.virtual('inventoryValue').get(function() {
  return this.sellPrice * this.quantity;
});

// Virtual for cost value
productSchema.virtual('costValue').get(function() {
  return this.buyPrice * this.quantity;
});

// Index for better query performance
productSchema.index({ category: 1 });
productSchema.index({ name: 'text', description: 'text' });
productSchema.index({ quantity: 1 });
productSchema.index({ createdAt: -1 });

// Static method to get low stock products
productSchema.statics.getLowStock = function(threshold = 5) {
  return this.find({ quantity: { $lte: threshold } }).sort({ quantity: 1 });
};

// Static method to get products by category
productSchema.statics.getByCategory = function(category) {
  return this.find({ category }).sort({ name: 1 });
};

// Static method to search products
productSchema.statics.search = function(searchTerm) {
  return this.find({
    $or: [
      { name: { $regex: searchTerm, $options: 'i' } },
      { category: { $regex: searchTerm, $options: 'i' } },
      { description: { $regex: searchTerm, $options: 'i' } }
    ]
  });
};

// Instance method to check if product is low stock
productSchema.methods.isLowStock = function(threshold = 5) {
  return this.quantity <= threshold;
};

// Pre-save middleware to validate sell price is greater than buy price
productSchema.pre('save', function(next) {
  if (this.sellPrice < this.buyPrice) {
    next(new Error('Sell price must be greater than or equal to buy price'));
  } else {
    next();
  }
});

const Product = mongoose.model('Product', productSchema);

export default Product;