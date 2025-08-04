# POS System Backend API

A Node.js/Express backend API for a Point of Sale (POS) system with inventory management.

## Features

- **Product Management**: CRUD operations for products with categories and inventory tracking
- **Sales Processing**: Complete sales workflow with automatic inventory updates
- **Analytics**: Dashboard statistics, sales reports, and profit analysis
- **Transaction Safety**: MongoDB transactions ensure data consistency
- **Validation**: Input validation and error handling with Mongoose schemas
- **MongoDB Database**: Scalable NoSQL database with powerful aggregation capabilities
- **Advanced Analytics**: Complex reporting using MongoDB aggregation pipelines

## API Endpoints

### Products
- `GET /api/products` - Get all products (with filtering)
- `GET /api/products/:id` - Get single product
- `POST /api/products` - Create new product
- `PUT /api/products/:id` - Update product
- `DELETE /api/products/:id` - Delete product
- `GET /api/products/categories/list` - Get all categories

### Sales
- `GET /api/sales` - Get all sales (with pagination)
- `GET /api/sales/:id` - Get single sale
- `POST /api/sales` - Create new sale
- `DELETE /api/sales/:id` - Void/delete sale
- `GET /api/sales/today/summary` - Get today's sales summary

### Analytics
- `GET /api/analytics/dashboard` - Dashboard statistics
- `GET /api/analytics/monthly-sales` - Monthly sales data
- `GET /api/analytics/top-products` - Top selling products
- `GET /api/analytics/sales-by-date` - Sales data by date range
- `GET /api/analytics/inventory-value` - Inventory value analysis
- `GET /api/analytics/profit-analysis` - Profit analysis

## Setup Instructions

### Prerequisites
- Node.js (v16 or higher)
- npm or yarn
- MongoDB (v4.4 or higher) - either local installation or MongoDB Atlas

### Installation

1. **Navigate to backend directory**:
   ```bash
   cd backend
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Set up environment variables**:
   ```bash
   cp .env.example .env
   ```
   Edit `.env` file to configure your MongoDB connection:
   - For local MongoDB: `MONGODB_URI=mongodb://localhost:27017/pos_system`
   - For MongoDB Atlas: `MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/pos_system`

4. **Start MongoDB** (if using local installation):
   ```bash
   # On macOS with Homebrew
   brew services start mongodb-community
   
   # On Ubuntu/Debian
   sudo systemctl start mongod
   
   # On Windows
   net start MongoDB
   ```

5. **Initialize and seed the database**:
   ```bash
   npm run seed
   ```
   This will connect to MongoDB and populate it with sample data.

6. **Start the development server**:
   ```bash
   npm run dev
   ```
   The API will be available at `http://localhost:3001`

### Production Setup

1. **Install dependencies**:
   ```bash
   npm ci --only=production
   ```

2. **Set environment variables**:
   ```bash
   export NODE_ENV=production
   export PORT=3001
   export MONGODB_URI=your_mongodb_connection_string
   ```

3. **Start the server**:
   ```bash
   npm start
   ```

## Database Schema

### Products Collection
```javascript
{
  _id: ObjectId,
  name: String (required),
  category: String (required),
  buyPrice: Number (required, min: 0),
  sellPrice: Number (required, min: 0),
  quantity: Number (required, min: 0, default: 0),
  description: String,
  image: String,
  createdAt: Date (auto-generated),
  updatedAt: Date (auto-generated)
}
```

### Sales Collection
```javascript
{
  _id: ObjectId,
  products: [{
    productId: ObjectId (ref: Product),
    productName: String (required),
    quantity: Number (required, min: 1),
    sellPrice: Number (required, min: 0),
    total: Number (required, min: 0)
  }],
  totalAmount: Number (required, min: 0),
  cashierName: String (required),
  paymentMethod: String (enum: ['cash', 'card', 'digital'], default: 'cash'),
  status: String (enum: ['completed', 'voided', 'refunded'], default: 'completed'),
  notes: String,
  createdAt: Date (auto-generated),
  updatedAt: Date (auto-generated)
}
```

## API Usage Examples

### Create a Product
```bash
curl -X POST http://localhost:3001/api/products \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Gaming Mouse",
    "category": "Accessories",
    "buyPrice": 25,
    "sellPrice": 45,
    "quantity": 10,
    "description": "Wireless gaming mouse"
  }'
```

### Process a Sale
```bash
curl -X POST http://localhost:3001/api/sales \
  -H "Content-Type: application/json" \
  -d '{
    "products": [
      {
        "productId": "product-id-here",
        "productName": "Gaming Mouse",
        "quantity": 2,
        "sellPrice": 45
      }
    ],
    "totalAmount": 90,
    "cashierName": "Store Manager"
  }'
```

### Get Dashboard Analytics
```bash
curl http://localhost:3001/api/analytics/dashboard
```

## Development

### Available Scripts
- `npm run dev` - Start development server with auto-reload
- `npm start` - Start production server
- `npm run seed` - Seed database with sample data

### Project Structure
```
backend/
├── src/
│   ├── database/
│   │   └── connection.js    # MongoDB connection setup
│   ├── models/
│   │   ├── Product.js       # Product Mongoose model
│   │   └── Sale.js          # Sale Mongoose model
│   ├── routes/
│   │   ├── products.js      # Product endpoints
│   │   ├── sales.js         # Sales endpoints
│   │   └── analytics.js     # Analytics endpoints
│   ├── scripts/
│   │   └── seed.js          # Database seeding
│   └── server.js            # Main server file
├── .env.example             # Environment variables template
├── package.json             # Dependencies and scripts
└── README.md               # This file
```

## Error Handling

The API includes comprehensive error handling:
- Input validation errors (400)
- Resource not found errors (404)
- Server errors (500)
- Transaction rollback on database errors

## Security Features

- Helmet.js for security headers
- CORS configuration
- Input validation and sanitization with express-validator
- MongoDB injection prevention with Mongoose
- Schema validation and type checking
- Transaction support for data consistency

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

MIT License