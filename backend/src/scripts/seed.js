import mongoose from 'mongoose';
import { connectDatabase } from '../database/connection.js';
import Product from '../models/Product.js';
import Sale from '../models/Sale.js';

// Sample products data (matching the original mock data)
const sampleProducts = [
  {
    name: 'Gaming Laptop RTX 4060',
    category: 'Laptops',
    buyPrice: 800,
    sellPrice: 1200,
    quantity: 15,
    description: 'High-performance gaming laptop with RTX 4060'
  },
  {
    name: 'Wireless Gaming Mouse',
    category: 'Accessories',
    buyPrice: 25,
    sellPrice: 45,
    quantity: 3,
    description: 'Ergonomic wireless gaming mouse'
  },
  {
    name: 'Mechanical Keyboard RGB',
    category: 'Accessories',
    buyPrice: 60,
    sellPrice: 95,
    quantity: 8,
    description: 'RGB mechanical keyboard with Cherry MX switches'
  },
  {
    name: '27" 4K Monitor',
    category: 'Monitors',
    buyPrice: 300,
    sellPrice: 450,
    quantity: 12,
    description: '27-inch 4K UHD monitor with HDR support'
  },
  {
    name: 'Gaming Headset Pro',
    category: 'Accessories',
    buyPrice: 80,
    sellPrice: 120,
    quantity: 20,
    description: 'Professional gaming headset with 7.1 surround sound'
  },
  {
    name: 'SSD 1TB NVMe',
    category: 'Storage',
    buyPrice: 90,
    sellPrice: 140,
    quantity: 25,
    description: 'High-speed NVMe SSD 1TB capacity'
  },
  {
    name: 'Graphics Card RTX 4070',
    category: 'Components',
    buyPrice: 500,
    sellPrice: 750,
    quantity: 8,
    description: 'NVIDIA GeForce RTX 4070 graphics card'
  },
  {
    name: 'Webcam 4K Ultra',
    category: 'Accessories',
    buyPrice: 120,
    sellPrice: 180,
    quantity: 15,
    description: '4K Ultra HD webcam for streaming and video calls'
  },
  {
    name: 'Gaming Chair Ergonomic',
    category: 'Furniture',
    buyPrice: 200,
    sellPrice: 320,
    quantity: 6,
    description: 'Ergonomic gaming chair with lumbar support'
  },
  {
    name: 'USB-C Hub Multi-port',
    category: 'Accessories',
    buyPrice: 35,
    sellPrice: 55,
    quantity: 30,
    description: 'Multi-port USB-C hub with HDMI and card readers'
  }
];

// Function to seed products
const seedProducts = async () => {
  console.log('🌱 Seeding products...');
  
  try {
    const products = await Product.insertMany(sampleProducts);
    console.log(`✅ Added ${products.length} products successfully`);
    return products;
  } catch (error) {
    console.error('❌ Error seeding products:', error.message);
    throw error;
  }
};

// Function to seed sample sales
const seedSales = async (products) => {
  console.log('🌱 Seeding sample sales...');
  
  try {
    // Get some products for sample sales
    const laptopProduct = products.find(p => p.name.includes('Gaming Laptop'));
    const mouseProduct = products.find(p => p.name.includes('Wireless Gaming Mouse'));
    const keyboardProduct = products.find(p => p.name.includes('Mechanical Keyboard'));
    const headsetProduct = products.find(p => p.name.includes('Gaming Headset'));
    const monitorProduct = products.find(p => p.name.includes('4K Monitor'));

    // Sample sales data with different dates
    const sampleSales = [
      {
        products: [
          {
            productId: laptopProduct._id,
            productName: laptopProduct.name,
            quantity: 1,
            sellPrice: laptopProduct.sellPrice,
            total: laptopProduct.sellPrice * 1
          }
        ],
        totalAmount: laptopProduct.sellPrice,
        cashierName: 'Store Manager',
        paymentMethod: 'card',
        status: 'completed',
        createdAt: new Date() // Today
      },
      {
        products: [
          {
            productId: mouseProduct._id,
            productName: mouseProduct.name,
            quantity: 2,
            sellPrice: mouseProduct.sellPrice,
            total: mouseProduct.sellPrice * 2
          },
          {
            productId: keyboardProduct._id,
            productName: keyboardProduct.name,
            quantity: 1,
            sellPrice: keyboardProduct.sellPrice,
            total: keyboardProduct.sellPrice * 1
          }
        ],
        totalAmount: (mouseProduct.sellPrice * 2) + (keyboardProduct.sellPrice * 1),
        cashierName: 'Store Cashier',
        paymentMethod: 'cash',
        status: 'completed',
        createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000) // Yesterday
      },
      {
        products: [
          {
            productId: headsetProduct._id,
            productName: headsetProduct.name,
            quantity: 1,
            sellPrice: headsetProduct.sellPrice,
            total: headsetProduct.sellPrice * 1
          }
        ],
        totalAmount: headsetProduct.sellPrice,
        cashierName: 'Store Manager',
        paymentMethod: 'digital',
        status: 'completed',
        createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000) // 2 days ago
      },
      {
        products: [
          {
            productId: monitorProduct._id,
            productName: monitorProduct.name,
            quantity: 2,
            sellPrice: monitorProduct.sellPrice,
            total: monitorProduct.sellPrice * 2
          }
        ],
        totalAmount: monitorProduct.sellPrice * 2,
        cashierName: 'Store Cashier',
        paymentMethod: 'card',
        status: 'completed',
        createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) // 1 week ago
      },
      {
        products: [
          {
            productId: laptopProduct._id,
            productName: laptopProduct.name,
            quantity: 1,
            sellPrice: laptopProduct.sellPrice,
            total: laptopProduct.sellPrice * 1
          },
          {
            productId: mouseProduct._id,
            productName: mouseProduct.name,
            quantity: 1,
            sellPrice: mouseProduct.sellPrice,
            total: mouseProduct.sellPrice * 1
          }
        ],
        totalAmount: laptopProduct.sellPrice + mouseProduct.sellPrice,
        cashierName: 'Store Manager',
        paymentMethod: 'card',
        status: 'completed',
        createdAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000) // 10 days ago
      }
    ];

    // Use MongoDB session for transaction
    const session = await mongoose.startSession();
    
    try {
      session.startTransaction();

      for (const saleData of sampleSales) {
        // Create the sale
        const sale = new Sale(saleData);
        await sale.save({ session });

        // Update product quantities
        for (const item of saleData.products) {
          await Product.findByIdAndUpdate(
            item.productId,
            { $inc: { quantity: -item.quantity } },
            { session }
          );
        }

        console.log(`✅ Added sale: $${saleData.totalAmount} by ${saleData.cashierName}`);
      }

      await session.commitTransaction();
      console.log(`✅ Added ${sampleSales.length} sample sales successfully`);
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  } catch (error) {
    console.error('❌ Error seeding sales:', error.message);
    throw error;
  }
};

// Main seeding function
const seedDatabase = async () => {
  try {
    console.log('🚀 Starting database seeding...');
    
    // Connect to database
    await connectDatabase();
    
    // Clear existing data (optional - comment out if you want to keep existing data)
    console.log('🧹 Clearing existing data...');
    await Sale.deleteMany({});
    await Product.deleteMany({});
    
    // Seed data
    const products = await seedProducts();
    await seedSales(products);
    
    console.log('✅ Database seeding completed successfully!');
    console.log(`📊 Added ${sampleProducts.length} products and sample sales`);
    
    // Get final counts
    const [productCount, salesCount] = await Promise.all([
      Product.countDocuments(),
      Sale.countDocuments()
    ]);
    
    console.log(`📈 Final counts: ${productCount} products, ${salesCount} sales`);
    
  } catch (error) {
    console.error('❌ Error seeding database:', error);
    process.exit(1);
  } finally {
    await mongoose.connection.close();
    console.log('🔒 Database connection closed');
  }
};

// Run seeding if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  seedDatabase();
}

export { seedDatabase, sampleProducts };