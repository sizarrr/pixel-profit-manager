import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Product from '../models/Product.js';
import InventoryBatch from '../models/InventoryBatch.js';

dotenv.config();

const connectDB = async () => {
  try {
    const mongoURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/store-management';
    await mongoose.connect(mongoURI);
    console.log('✅ MongoDB Connected for quantity update test');
  } catch (error) {
    console.error('❌ MongoDB connection failed:', error.message);
    process.exit(1);
  }
};

const testQuantityUpdate = async () => {
  try {
    const productId = '68a1ac17082945f1e10ab8ef'; // ASUS TUF GAMING
    
    console.log('🔍 Testing quantity update for product:', productId);
    
    // Get current product
    let product = await Product.findById(productId);
    console.log('Current product quantity:', product.quantity);
    
    // Get total from batches using the method
    const totalFromBatches = await InventoryBatch.getTotalAvailableQuantity(productId);
    console.log('Total from batches method:', totalFromBatches);
    
    // Manually calculate total from batches
    const batches = await InventoryBatch.find({
      productId: new mongoose.Types.ObjectId(productId),
      remainingQuantity: { $gt: 0 },
      isActive: true
    });
    const manualTotal = batches.reduce((sum, batch) => sum + batch.remainingQuantity, 0);
    console.log('Manual calculation total:', manualTotal);
    
    // Update using the method
    console.log('Updating product quantity from batches...');
    const updatedQuantity = await Product.updateQuantityFromBatches(productId);
    console.log('Method returned quantity:', updatedQuantity);
    
    // Get updated product
    product = await Product.findById(productId);
    console.log('Updated product quantity:', product.quantity);
    
  } catch (error) {
    console.error('❌ Error testing quantity update:', error);
  } finally {
    await mongoose.connection.close();
    console.log('📪 Database connection closed');
    process.exit(0);
  }
};

// Run the script
connectDB().then(testQuantityUpdate);