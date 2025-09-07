import mongoose from 'mongoose';
import dotenv from 'dotenv';
// Optional in-memory MongoDB for development/testing without a local mongod
// Will only be used when USE_IN_MEMORY_DB=true or MONGODB_URI=memory
let memoryServerInstance = null;

dotenv.config();

const connectDB = async () => {
  try {
    let mongoURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/store-management';

    // Enable in-memory DB when explicitly requested
    if (process.env.USE_IN_MEMORY_DB === 'true' || mongoURI === 'memory') {
      const { MongoMemoryServer } = await import('mongodb-memory-server');
      memoryServerInstance = await MongoMemoryServer.create();
      mongoURI = memoryServerInstance.getUri('store-management');
      console.log(`🧪 Using in-memory MongoDB instance: ${mongoURI}`);
    }
    
    const options = {
      // Connection options for better performance and reliability
      maxPoolSize: 10, // Maintain up to 10 socket connections
      serverSelectionTimeoutMS: 5000, // Keep trying to send operations for 5 seconds
      socketTimeoutMS: 45000, // Close sockets after 45 seconds of inactivity
    };

    const conn = await mongoose.connect(mongoURI, options);

    console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
    
    // Handle connection events
    mongoose.connection.on('error', (err) => {
      console.error('❌ MongoDB connection error:', err);
    });

    mongoose.connection.on('disconnected', () => {
      console.log('⚠️  MongoDB disconnected');
    });

    mongoose.connection.on('reconnected', () => {
      console.log('✅ MongoDB reconnected');
    });

    // Graceful shutdown
    process.on('SIGINT', async () => {
      try {
        await mongoose.connection.close();
        console.log('📪 MongoDB connection closed through app termination');
        if (memoryServerInstance) {
          await memoryServerInstance.stop();
          console.log('🧪 In-memory MongoDB stopped');
        }
        process.exit(0);
      } catch (err) {
        console.error('❌ Error during MongoDB shutdown:', err);
        process.exit(1);
      }
    });

    return conn;
  } catch (error) {
    console.error('❌ MongoDB connection failed:', error.message);
    
    // Retry connection after 5 seconds
    setTimeout(() => {
      console.log('🔄 Retrying MongoDB connection...');
      connectDB();
    }, 5000);
  }
};

export default connectDB;