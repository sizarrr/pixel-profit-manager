import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Product from '../models/Product.js';
import Sale from '../models/Sale.js';

dotenv.config();

const connectDB = async () => {
  try {
    const mongoURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/store-management';
    await mongoose.connect(mongoURI);
    console.log('✅ MongoDB Connected for seeding');
  } catch (error) {
    console.error('❌ MongoDB connection failed:', error.message);
    process.exit(1);
  }
};

const sampleProducts = [
  {
    name: 'Gaming Laptop RTX 4060',
    category: 'Laptops',
    buyPrice: 800,
    sellPrice: 1200,
    quantity: 15,
    description: 'High-performance gaming laptop with RTX 4060 graphics card, 16GB RAM, and 512GB SSD. Perfect for gaming and professional work.',
    lowStockThreshold: 5
  },
  {
    name: 'Wireless Gaming Mouse',
    category: 'Accessories',
    buyPrice: 25,
    sellPrice: 45,
    quantity: 3,
    description: 'Ergonomic wireless gaming mouse with RGB lighting and customizable buttons.',
    lowStockThreshold: 5
  },
  {
    name: 'Mechanical Keyboard RGB',
    category: 'Accessories',
    buyPrice: 60,
    sellPrice: 95,
    quantity: 8,
    description: 'RGB mechanical keyboard with Cherry MX switches and programmable keys.',
    lowStockThreshold: 5
  },
  {
    name: '27" 4K Monitor',
    category: 'Monitors',
    buyPrice: 300,
    sellPrice: 450,
    quantity: 12,
    description: '27-inch 4K UHD monitor with HDR support and USB-C connectivity.',
    lowStockThreshold: 3
  },
  {
    name: 'Gaming Chair',
    category: 'Furniture',
    buyPrice: 150,
    sellPrice: 250,
    quantity: 6,
    description: 'Ergonomic gaming chair with lumbar support and adjustable height.',
    lowStockThreshold: 2
  },
  {
    name: 'Webcam HD 1080p',
    category: 'Accessories',
    buyPrice: 40,
    sellPrice: 70,
    quantity: 20,
    description: 'Full HD 1080p webcam with auto-focus and noise-canceling microphone.',
    lowStockThreshold: 8
  },
  {
    name: 'USB-C Hub',
    category: 'Accessories',
    buyPrice: 20,
    sellPrice: 35,
    quantity: 25,
    description: '7-in-1 USB-C hub with HDMI, USB 3.0, and SD card reader.',
    lowStockThreshold: 10
  },
  {
    name: 'Bluetooth Headphones',
    category: 'Audio',
    buyPrice: 80,
    sellPrice: 130,
    quantity: 14,
    description: 'Wireless Bluetooth headphones with active noise cancellation.',
    lowStockThreshold: 5
  },
  {
    name: 'Portable SSD 1TB',
    category: 'Storage',
    buyPrice: 90,
    sellPrice: 140,
    quantity: 18,
    description: 'High-speed portable SSD with 1TB capacity and USB 3.2 interface.',
    lowStockThreshold: 6
  },
  {
    name: 'Wireless Charger',
    category: 'Accessories',
    buyPrice: 15,
    sellPrice: 30,
    quantity: 2,
    description: 'Fast wireless charger compatible with Qi-enabled devices.',
    lowStockThreshold: 5
  }
];

const generateSampleSales = (products) => {
  const sales = [];
  const cashiers = ['John Doe', 'Jane Smith', 'Mike Johnson', 'Sarah Wilson'];
  const paymentMethods = ['cash', 'card', 'digital'];
  
  // Generate sales for the last 30 days
  for (let i = 0; i < 50; i++) {
    const saleDate = new Date();
    saleDate.setDate(saleDate.getDate() - Math.floor(Math.random() * 30));
    
    const numProducts = Math.floor(Math.random() * 3) + 1; // 1-3 products per sale
    const saleProducts = [];
    let totalAmount = 0;
    
    for (let j = 0; j < numProducts; j++) {
      const randomProduct = products[Math.floor(Math.random() * products.length)];
      const quantity = Math.floor(Math.random() * 3) + 1; // 1-3 quantity
      const total = randomProduct.sellPrice * quantity;
      
      saleProducts.push({
        productId: randomProduct._id,
        productName: randomProduct.name,
        quantity,
        sellPrice: randomProduct.sellPrice,
        total
      });
      
      totalAmount += total;
    }
    
    sales.push({
      products: saleProducts,
      totalAmount,
      cashierName: cashiers[Math.floor(Math.random() * cashiers.length)],
      paymentMethod: paymentMethods[Math.floor(Math.random() * paymentMethods.length)],
      createdAt: saleDate,
      updatedAt: saleDate
    });
  }
  
  return sales;
};

const seedDatabase = async () => {
  try {
    console.log('🌱 Starting database seeding...');
    
    // Clear existing data
    await Product.deleteMany({});
    await Sale.deleteMany({});
    console.log('🧹 Cleared existing data');
    
    // Insert products
    const createdProducts = await Product.insertMany(sampleProducts);
    console.log(`✅ Created ${createdProducts.length} products`);
    
    // Generate and insert sales
    const sampleSales = generateSampleSales(createdProducts);
    const createdSales = await Sale.insertMany(sampleSales);
    console.log(`✅ Created ${createdSales.length} sales`);
    
    console.log('🎉 Database seeding completed successfully!');
    console.log('\n📊 Summary:');
    console.log(`   Products: ${createdProducts.length}`);
    console.log(`   Sales: ${createdSales.length}`);
    console.log(`   Categories: ${[...new Set(sampleProducts.map(p => p.category))].length}`);
    
  } catch (error) {
    console.error('❌ Error seeding database:', error);
  } finally {
    await mongoose.connection.close();
    console.log('📪 Database connection closed');
    process.exit(0);
  }
};

// Run the seeding
connectDB().then(seedDatabase);