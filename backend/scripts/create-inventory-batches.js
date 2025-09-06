import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Product from '../models/Product.js';
import InventoryBatch from '../models/InventoryBatch.js';

dotenv.config();

const connectDB = async () => {
  try {
    const mongoURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/store-management';
    await mongoose.connect(mongoURI);
    console.log('✅ MongoDB Connected for inventory batch creation');
  } catch (error) {
    console.error('❌ MongoDB connection failed:', error.message);
    process.exit(1);
  }
};

const createInventoryBatches = async () => {
  try {
    console.log('🏭 Creating inventory batches for existing products...');
    
    // Get all products
    const products = await Product.find({ isActive: true });
    console.log(`📦 Found ${products.length} active products`);
    
    let batchesCreated = 0;
    
    for (const product of products) {
      // Check if this product already has inventory batches
      const existingBatches = await InventoryBatch.find({ 
        productId: product._id,
        isActive: true 
      });
      
      if (existingBatches.length > 0) {
        console.log(`⏭️  Product "${product.name}" already has ${existingBatches.length} batches, skipping`);
        continue;
      }
      
      // Create initial inventory batch for this product
      // We'll assume the current quantity is from a single batch purchased recently
      if (product.quantity > 0) {
        const purchaseDate = new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000);
        const dateStr = purchaseDate.toISOString().slice(0, 10).replace(/-/g, '');
        const timeStr = purchaseDate.getTime().toString().slice(-6);
        const batchNumber = `BATCH-${dateStr}-${timeStr}`;
        
        const batch = new InventoryBatch({
          productId: product._id,
          batchNumber: batchNumber,
          buyPrice: product.buyPrice,
          initialQuantity: product.quantity,
          remainingQuantity: product.quantity,
          purchaseDate: purchaseDate,
          supplierName: 'Initial Stock',
          notes: 'Auto-created batch for existing inventory'
        });
        
        await batch.save();
        batchesCreated++;
        
        console.log(`✅ Created batch for "${product.name}": ${product.quantity} units at $${product.buyPrice}`);
      } else {
        console.log(`⚠️  Product "${product.name}" has 0 quantity, skipping batch creation`);
      }
    }
    
    console.log(`🎉 Successfully created ${batchesCreated} inventory batches!`);
    
    // Verify the batches
    const totalBatches = await InventoryBatch.countDocuments({ isActive: true });
    console.log(`📊 Total active inventory batches in system: ${totalBatches}`);
    
  } catch (error) {
    console.error('❌ Error creating inventory batches:', error);
  } finally {
    await mongoose.connection.close();
    console.log('📪 Database connection closed');
    process.exit(0);
  }
};

// Run the script
connectDB().then(createInventoryBatches);