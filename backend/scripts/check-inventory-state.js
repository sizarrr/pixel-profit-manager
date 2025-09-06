import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Product from '../models/Product.js';
import InventoryBatch from '../models/InventoryBatch.js';

dotenv.config();

const connectDB = async () => {
  try {
    const mongoURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/store-management';
    await mongoose.connect(mongoURI);
    console.log('✅ MongoDB Connected for inventory check');
  } catch (error) {
    console.error('❌ MongoDB connection failed:', error.message);
    process.exit(1);
  }
};

const checkInventoryState = async () => {
  try {
    console.log('🔍 Checking current inventory state...\n');
    
    // Get all products
    const products = await Product.find({ isActive: true });
    
    for (const product of products) {
      console.log(`📦 Product: ${product.name} (${product._id})`);
      console.log(`   Current quantity: ${product.quantity}`);
      
      // Get all batches for this product
      const batches = await InventoryBatch.find({ 
        productId: product._id,
        isActive: true 
      }).sort({ purchaseDate: 1 });
      
      console.log(`   Batches (${batches.length}):`);
      let totalRemaining = 0;
      
      batches.forEach((batch, index) => {
        console.log(`     ${index + 1}. ${batch.batchNumber}: ${batch.remainingQuantity}/${batch.initialQuantity} remaining`);
        totalRemaining += batch.remainingQuantity;
      });
      
      console.log(`   Total remaining from batches: ${totalRemaining}`);
      
      if (product.quantity !== totalRemaining) {
        console.log(`   ⚠️  MISMATCH! Product quantity (${product.quantity}) != batch total (${totalRemaining})`);
      } else {
        console.log(`   ✅ Quantities match`);
      }
      
      console.log('');
    }
    
  } catch (error) {
    console.error('❌ Error checking inventory state:', error);
  } finally {
    await mongoose.connection.close();
    console.log('📪 Database connection closed');
    process.exit(0);
  }
};

// Run the script
connectDB().then(checkInventoryState);