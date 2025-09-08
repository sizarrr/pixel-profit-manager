// backend/scripts/seed.js - DATABASE SEEDER
import mongoose from "mongoose";
import dotenv from "dotenv";
import Product from "../models/Product.js";
import Sale from "../models/Sale.js";
import InventoryBatch from "../models/InventoryBatch.js";
import connectDB from "../config/database.js";

dotenv.config();

// Sample product data
const sampleProducts = [
  {
    name: "Dell XPS 15 Laptop",
    category: "Laptops",
    buyPrice: 1200,
    sellPrice: 1599,
    quantity: 15,
    description:
      "High-performance laptop with Intel Core i7, 16GB RAM, 512GB SSD",
    barcode: "DELL-XPS-15-2024",
    lowStockThreshold: 5,
  },
  {
    name: 'MacBook Pro 14"',
    category: "Laptops",
    buyPrice: 1800,
    sellPrice: 2299,
    quantity: 10,
    description: "Apple MacBook Pro with M3 chip, 16GB RAM, 512GB SSD",
    barcode: "APPLE-MBP-14-2024",
    lowStockThreshold: 3,
  },
  {
    name: "HP Pavilion Desktop",
    category: "Desktops",
    buyPrice: 600,
    sellPrice: 849,
    quantity: 20,
    description: "Desktop computer with AMD Ryzen 5, 8GB RAM, 1TB HDD",
    barcode: "HP-PAV-DT-2024",
    lowStockThreshold: 5,
  },
  {
    name: "ASUS Gaming Desktop",
    category: "Desktops",
    buyPrice: 1500,
    sellPrice: 1999,
    quantity: 8,
    description: "Gaming desktop with RTX 4070, Intel i9, 32GB RAM, 1TB SSD",
    barcode: "ASUS-GAME-DT-2024",
    lowStockThreshold: 2,
  },
  {
    name: 'Samsung 27" Monitor',
    category: "Monitors",
    buyPrice: 250,
    sellPrice: 399,
    quantity: 25,
    description: "27-inch 4K UHD monitor with HDR support",
    barcode: "SAM-MON-27-4K",
    lowStockThreshold: 8,
  },
  {
    name: 'LG 32" Curved Monitor',
    category: "Monitors",
    buyPrice: 350,
    sellPrice: 499,
    quantity: 12,
    description: "32-inch curved gaming monitor with 144Hz refresh rate",
    barcode: "LG-MON-32-CURVE",
    lowStockThreshold: 4,
  },
  {
    name: "Logitech MX Master 3",
    category: "Accessories",
    buyPrice: 70,
    sellPrice: 99,
    quantity: 50,
    description: "Advanced wireless mouse with ergonomic design",
    barcode: "LOG-MX-MASTER3",
    lowStockThreshold: 15,
  },
  {
    name: "Mechanical Gaming Keyboard",
    category: "Accessories",
    buyPrice: 80,
    sellPrice: 129,
    quantity: 35,
    description: "RGB mechanical keyboard with Cherry MX switches",
    barcode: "MECH-KB-RGB-2024",
    lowStockThreshold: 10,
  },
  {
    name: "Wireless Headset",
    category: "Accessories",
    buyPrice: 60,
    sellPrice: 89,
    quantity: 40,
    description: "Bluetooth wireless headset with noise cancellation",
    barcode: "WL-HEADSET-NC",
    lowStockThreshold: 12,
  },
  {
    name: "USB-C Hub",
    category: "Accessories",
    buyPrice: 25,
    sellPrice: 39,
    quantity: 60,
    description: "7-in-1 USB-C hub with HDMI, USB 3.0, and SD card reader",
    barcode: "USBC-HUB-7IN1",
    lowStockThreshold: 20,
  },
  {
    name: "External SSD 1TB",
    category: "Storage",
    buyPrice: 80,
    sellPrice: 129,
    quantity: 30,
    description: "Portable 1TB SSD with USB 3.2 Gen 2",
    barcode: "EXT-SSD-1TB",
    lowStockThreshold: 10,
  },
  {
    name: "External HDD 4TB",
    category: "Storage",
    buyPrice: 70,
    sellPrice: 109,
    quantity: 25,
    description: "4TB external hard drive with USB 3.0",
    barcode: "EXT-HDD-4TB",
    lowStockThreshold: 8,
  },
  {
    name: "Webcam 1080p",
    category: "Accessories",
    buyPrice: 40,
    sellPrice: 69,
    quantity: 45,
    description: "Full HD webcam with built-in microphone",
    barcode: "WEBCAM-1080P",
    lowStockThreshold: 15,
  },
  {
    name: "Graphics Card RTX 4060",
    category: "Components",
    buyPrice: 400,
    sellPrice: 549,
    quantity: 6,
    description: "NVIDIA GeForce RTX 4060 8GB GDDR6",
    barcode: "GPU-RTX-4060",
    lowStockThreshold: 2,
  },
  {
    name: "RAM 16GB DDR5",
    category: "Components",
    buyPrice: 60,
    sellPrice: 89,
    quantity: 40,
    description: "16GB (2x8GB) DDR5 RAM 5600MHz",
    barcode: "RAM-16GB-DDR5",
    lowStockThreshold: 12,
  },
  {
    name: "Motherboard B650",
    category: "Components",
    buyPrice: 150,
    sellPrice: 229,
    quantity: 15,
    description: "AMD B650 chipset motherboard with WiFi 6",
    barcode: "MB-B650-WIFI",
    lowStockThreshold: 5,
  },
  {
    name: "Power Supply 750W",
    category: "Components",
    buyPrice: 80,
    sellPrice: 119,
    quantity: 20,
    description: "750W 80+ Gold certified modular power supply",
    barcode: "PSU-750W-GOLD",
    lowStockThreshold: 7,
  },
  {
    name: "CPU Intel i5-13600K",
    category: "Components",
    buyPrice: 250,
    sellPrice: 349,
    quantity: 10,
    description: "Intel Core i5-13600K processor",
    barcode: "CPU-I5-13600K",
    lowStockThreshold: 3,
  },
  {
    name: "Laptop Cooling Pad",
    category: "Accessories",
    buyPrice: 20,
    sellPrice: 35,
    quantity: 55,
    description: "Laptop cooling pad with 5 fans and RGB lighting",
    barcode: "COOL-PAD-RGB",
    lowStockThreshold: 18,
  },
  {
    name: "Wireless Router WiFi 6",
    category: "Networking",
    buyPrice: 120,
    sellPrice: 179,
    quantity: 18,
    description: "WiFi 6 router with 4 antennas and gigabit ports",
    barcode: "ROUTER-WIFI6",
    lowStockThreshold: 6,
  },
];

// Function to create inventory batches for products
const createInventoryBatches = async (products) => {
  const batches = [];

  for (const product of products) {
    // Create 1-3 batches for each product
    const numBatches = Math.floor(Math.random() * 3) + 1;
    const quantityPerBatch = Math.floor(product.quantity / numBatches);
    const remainder = product.quantity % numBatches;

    for (let i = 0; i < numBatches; i++) {
      const batchQuantity =
        i === 0 ? quantityPerBatch + remainder : quantityPerBatch;
      const purchaseDate = new Date();
      purchaseDate.setDate(purchaseDate.getDate() - 30 * (numBatches - i)); // Stagger purchase dates

      batches.push({
        productId: product._id,
        buyPrice: product.buyPrice * (0.9 + Math.random() * 0.2), // Vary buy price ±10%
        initialQuantity: batchQuantity,
        remainingQuantity: batchQuantity,
        purchaseDate,
        supplierName: [
          "Tech Supplies Inc.",
          "Global Tech Distributors",
          "Computer Parts Wholesale",
        ][Math.floor(Math.random() * 3)],
        notes: `Initial stock batch ${i + 1} of ${numBatches}`,
      });
    }
  }

  return batches;
};

// Function to create sample sales
const createSampleSales = async (products) => {
  const sales = [];
  const cashiers = [
    "John Doe",
    "Jane Smith",
    "Mike Johnson",
    "Sarah Williams",
    "Tom Brown",
  ];
  const customers = [
    "Customer A",
    "Customer B",
    "Customer C",
    "Customer D",
    "Customer E",
    null,
  ];
  const paymentMethods = ["cash", "card", "digital"];

  // Create 20-30 sample sales
  const numSales = Math.floor(Math.random() * 11) + 20;

  for (let i = 0; i < numSales; i++) {
    // Random date within last 30 days
    const saleDate = new Date();
    saleDate.setDate(saleDate.getDate() - Math.floor(Math.random() * 30));

    // Random number of products per sale (1-4)
    const numProducts = Math.floor(Math.random() * 4) + 1;
    const saleProducts = [];
    let totalAmount = 0;

    // Select random products for this sale
    const selectedProducts = [...products]
      .sort(() => 0.5 - Math.random())
      .slice(0, numProducts);

    for (const product of selectedProducts) {
      const quantity = Math.floor(Math.random() * 3) + 1;
      const total = product.sellPrice * quantity;

      saleProducts.push({
        productId: product._id,
        productName: product.name,
        quantity,
        sellPrice: product.sellPrice,
        total,
      });

      totalAmount += total;
    }

    sales.push({
      products: saleProducts,
      totalAmount,
      cashierName: cashiers[Math.floor(Math.random() * cashiers.length)],
      paymentMethod:
        paymentMethods[Math.floor(Math.random() * paymentMethods.length)],
      customerName: customers[Math.floor(Math.random() * customers.length)],
      createdAt: saleDate,
    });
  }

  return sales;
};

// Main seeding function
const seedDatabase = async () => {
  try {
    console.log("🌱 Starting database seeding...");

    // Connect to database
    await connectDB();
    console.log("✅ Connected to database");

    // Clear existing data
    console.log("🗑️  Clearing existing data...");
    await Product.deleteMany({});
    await Sale.deleteMany({});
    await InventoryBatch.deleteMany({});
    console.log("✅ Existing data cleared");

    // Insert products
    console.log("📦 Creating products...");
    const products = await Product.insertMany(sampleProducts);
    console.log(`✅ Created ${products.length} products`);

    // Create and insert inventory batches
    console.log("📦 Creating inventory batches...");
    const batches = await createInventoryBatches(products);
    const insertedBatches = await InventoryBatch.insertMany(batches);
    console.log(`✅ Created ${insertedBatches.length} inventory batches`);

    // Update product quantities from batches
    console.log("🔄 Updating product quantities from batches...");
    for (const product of products) {
      await Product.updateQuantityFromBatches(product._id);
    }
    console.log("✅ Product quantities updated");

    // Create and insert sales
    console.log("💰 Creating sample sales...");
    const sales = await createSampleSales(products);
    const insertedSales = await Sale.insertMany(sales);
    console.log(`✅ Created ${insertedSales.length} sales`);

    console.log("\n🎉 Database seeding completed successfully!");
    console.log(`
📊 Summary:
- Products: ${products.length}
- Inventory Batches: ${insertedBatches.length}
- Sales: ${insertedSales.length}
    `);

    process.exit(0);
  } catch (error) {
    console.error("❌ Error seeding database:", error);
    process.exit(1);
  }
};

// Run the seeder
seedDatabase();
