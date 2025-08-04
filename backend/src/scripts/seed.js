import { v4 as uuidv4 } from 'uuid';
import { runQuery, initializeDatabase, closeDatabase } from '../database/init.js';

// Sample products data (matching the original mock data)
const sampleProducts = [
  {
    id: uuidv4(),
    name: 'Gaming Laptop RTX 4060',
    category: 'Laptops',
    buyPrice: 800,
    sellPrice: 1200,
    quantity: 15,
    description: 'High-performance gaming laptop with RTX 4060'
  },
  {
    id: uuidv4(),
    name: 'Wireless Gaming Mouse',
    category: 'Accessories',
    buyPrice: 25,
    sellPrice: 45,
    quantity: 3,
    description: 'Ergonomic wireless gaming mouse'
  },
  {
    id: uuidv4(),
    name: 'Mechanical Keyboard RGB',
    category: 'Accessories',
    buyPrice: 60,
    sellPrice: 95,
    quantity: 8,
    description: 'RGB mechanical keyboard with Cherry MX switches'
  },
  {
    id: uuidv4(),
    name: '27" 4K Monitor',
    category: 'Monitors',
    buyPrice: 300,
    sellPrice: 450,
    quantity: 12,
    description: '27-inch 4K UHD monitor with HDR support'
  },
  {
    id: uuidv4(),
    name: 'Gaming Headset Pro',
    category: 'Accessories',
    buyPrice: 80,
    sellPrice: 120,
    quantity: 20,
    description: 'Professional gaming headset with 7.1 surround sound'
  },
  {
    id: uuidv4(),
    name: 'SSD 1TB NVMe',
    category: 'Storage',
    buyPrice: 90,
    sellPrice: 140,
    quantity: 25,
    description: 'High-speed NVMe SSD 1TB capacity'
  },
  {
    id: uuidv4(),
    name: 'Graphics Card RTX 4070',
    category: 'Components',
    buyPrice: 500,
    sellPrice: 750,
    quantity: 8,
    description: 'NVIDIA GeForce RTX 4070 graphics card'
  },
  {
    id: uuidv4(),
    name: 'Webcam 4K Ultra',
    category: 'Accessories',
    buyPrice: 120,
    sellPrice: 180,
    quantity: 15,
    description: '4K Ultra HD webcam for streaming and video calls'
  },
  {
    id: uuidv4(),
    name: 'Gaming Chair Ergonomic',
    category: 'Furniture',
    buyPrice: 200,
    sellPrice: 320,
    quantity: 6,
    description: 'Ergonomic gaming chair with lumbar support'
  },
  {
    id: uuidv4(),
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
  
  for (const product of sampleProducts) {
    try {
      await runQuery(`
        INSERT INTO products (id, name, category, buy_price, sell_price, quantity, description, image)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        product.id,
        product.name,
        product.category,
        product.buyPrice,
        product.sellPrice,
        product.quantity,
        product.description,
        '' // empty image for now
      ]);
      
      console.log(`✅ Added product: ${product.name}`);
    } catch (error) {
      console.error(`❌ Error adding product ${product.name}:`, error.message);
    }
  }
};

// Function to seed sample sales
const seedSales = async () => {
  console.log('🌱 Seeding sample sales...');
  
  // Get some products for sample sales
  const laptopProduct = sampleProducts.find(p => p.name.includes('Gaming Laptop'));
  const mouseProduct = sampleProducts.find(p => p.name.includes('Wireless Gaming Mouse'));
  const keyboardProduct = sampleProducts.find(p => p.name.includes('Mechanical Keyboard'));
  const headsetProduct = sampleProducts.find(p => p.name.includes('Gaming Headset'));
  
  // Sample sales data
  const sampleSales = [
    {
      id: uuidv4(),
      products: [
        {
          productId: laptopProduct.id,
          productName: laptopProduct.name,
          quantity: 1,
          sellPrice: laptopProduct.sellPrice,
          total: laptopProduct.sellPrice * 1
        }
      ],
      totalAmount: laptopProduct.sellPrice,
      cashierName: 'Store Manager',
      createdAt: new Date().toISOString()
    },
    {
      id: uuidv4(),
      products: [
        {
          productId: mouseProduct.id,
          productName: mouseProduct.name,
          quantity: 2,
          sellPrice: mouseProduct.sellPrice,
          total: mouseProduct.sellPrice * 2
        },
        {
          productId: keyboardProduct.id,
          productName: keyboardProduct.name,
          quantity: 1,
          sellPrice: keyboardProduct.sellPrice,
          total: keyboardProduct.sellPrice * 1
        }
      ],
      totalAmount: (mouseProduct.sellPrice * 2) + (keyboardProduct.sellPrice * 1),
      cashierName: 'Store Cashier',
      createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString() // Yesterday
    },
    {
      id: uuidv4(),
      products: [
        {
          productId: headsetProduct.id,
          productName: headsetProduct.name,
          quantity: 1,
          sellPrice: headsetProduct.sellPrice,
          total: headsetProduct.sellPrice * 1
        }
      ],
      totalAmount: headsetProduct.sellPrice,
      cashierName: 'Store Manager',
      createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString() // 2 days ago
    }
  ];

  for (const sale of sampleSales) {
    try {
      // Insert sale
      await runQuery(`
        INSERT INTO sales (id, total_amount, cashier_name, created_at)
        VALUES (?, ?, ?, ?)
      `, [sale.id, sale.totalAmount, sale.cashierName, sale.createdAt]);

      // Insert sale items
      for (const product of sale.products) {
        const saleItemId = uuidv4();
        await runQuery(`
          INSERT INTO sale_items (id, sale_id, product_id, product_name, quantity, sell_price, total)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `, [
          saleItemId,
          sale.id,
          product.productId,
          product.productName,
          product.quantity,
          product.sellPrice,
          product.total
        ]);

        // Update product inventory
        await runQuery(`
          UPDATE products 
          SET quantity = quantity - ?, updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `, [product.quantity, product.productId]);
      }

      console.log(`✅ Added sale: $${sale.totalAmount} by ${sale.cashierName}`);
    } catch (error) {
      console.error(`❌ Error adding sale:`, error.message);
    }
  }
};

// Main seeding function
const seedDatabase = async () => {
  try {
    console.log('🚀 Starting database seeding...');
    
    // Initialize database
    await initializeDatabase();
    
    // Clear existing data (optional - comment out if you want to keep existing data)
    console.log('🧹 Clearing existing data...');
    await runQuery('DELETE FROM sale_items');
    await runQuery('DELETE FROM sales');
    await runQuery('DELETE FROM products');
    
    // Seed data
    await seedProducts();
    await seedSales();
    
    console.log('✅ Database seeding completed successfully!');
    console.log(`📊 Added ${sampleProducts.length} products and 3 sample sales`);
    
  } catch (error) {
    console.error('❌ Error seeding database:', error);
    process.exit(1);
  } finally {
    await closeDatabase();
  }
};

// Run seeding if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  seedDatabase();
}

export { seedDatabase, sampleProducts };