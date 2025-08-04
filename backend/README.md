# Store Management System - Backend API

A comprehensive RESTful API for managing a computer store's inventory, sales, and analytics built with Express.js and MongoDB.

## 🚀 Features

- **Product Management**: CRUD operations for products with categories, pricing, and inventory tracking
- **Sales Processing**: Point-of-sale system with transaction management and inventory updates
- **Analytics Dashboard**: Comprehensive analytics with sales charts, profit calculations, and insights
- **Inventory Alerts**: Low stock and out-of-stock notifications
- **Data Validation**: Robust input validation and error handling
- **Security**: Rate limiting, CORS, helmet security headers
- **Performance**: Database indexing, query optimization, and compression

## 🛠️ Tech Stack

- **Runtime**: Node.js
- **Framework**: Express.js
- **Database**: MongoDB with Mongoose ODM
- **Validation**: Express-validator
- **Security**: Helmet, CORS, Rate limiting
- **Development**: Nodemon for hot reloading

## 📋 Prerequisites

- Node.js (v16 or higher)
- MongoDB (v5 or higher)
- npm or yarn package manager

## ⚡ Quick Start

### 1. Installation

```bash
# Clone the repository
git clone <repository-url>
cd backend

# Install dependencies
npm install
```

### 2. Environment Setup

Create a `.env` file in the backend directory:

```env
PORT=5000
MONGODB_URI=mongodb://localhost:27017/store-management
NODE_ENV=development
CORS_ORIGIN=http://localhost:5173
API_PREFIX=/api/v1
```

### 3. Database Setup

Start MongoDB service and seed the database with sample data:

```bash
# Seed database with sample data
npm run seed
```

### 4. Start the Server

```bash
# Development mode with hot reloading
npm run dev

# Production mode
npm start
```

The API will be available at `http://localhost:5000/api/v1`

## 📚 API Documentation

### Base URL
```
http://localhost:5000/api/v1
```

### Authentication
Currently, the API does not require authentication. This can be added as needed.

## 🛍️ Products API

### Get All Products
```http
GET /api/v1/products
```

**Query Parameters:**
- `page` (number): Page number for pagination (default: 1)
- `limit` (number): Items per page (default: 20, max: 100)
- `category` (string): Filter by category
- `search` (string): Search in name, description, or category
- `sort` (string): Sort field (name, category, sellPrice, quantity, createdAt)
- `lowStock` (boolean): Filter low stock products

**Example:**
```bash
curl "http://localhost:5000/api/v1/products?page=1&limit=10&category=Laptops&sort=-createdAt"
```

### Get Single Product
```http
GET /api/v1/products/:id
```

### Create Product
```http
POST /api/v1/products
Content-Type: application/json

{
  "name": "Gaming Laptop RTX 4070",
  "category": "Laptops",
  "buyPrice": 900,
  "sellPrice": 1400,
  "quantity": 10,
  "description": "High-performance gaming laptop with RTX 4070",
  "lowStockThreshold": 5
}
```

### Update Product
```http
PUT /api/v1/products/:id
Content-Type: application/json

{
  "sellPrice": 1350,
  "quantity": 8
}
```

### Delete Product
```http
DELETE /api/v1/products/:id
```

### Additional Product Endpoints

- `GET /api/v1/products/low-stock` - Get low stock products
- `GET /api/v1/products/categories` - Get all product categories
- `GET /api/v1/products/stats` - Get product statistics
- `PATCH /api/v1/products/:id/quantity` - Update product quantity

## 💰 Sales API

### Get All Sales
```http
GET /api/v1/sales
```

**Query Parameters:**
- `page`, `limit` - Pagination
- `startDate`, `endDate` - Date range filter (ISO 8601 format)
- `cashier` - Filter by cashier name
- `sort` - Sort field

### Get Single Sale
```http
GET /api/v1/sales/:id
```

### Create Sale (Process Transaction)
```http
POST /api/v1/sales
Content-Type: application/json

{
  "products": [
    {
      "productId": "60d5ecb54b24a1234567890a",
      "productName": "Gaming Laptop RTX 4060",
      "quantity": 1,
      "sellPrice": 1200,
      "total": 1200
    }
  ],
  "totalAmount": 1200,
  "cashierName": "John Doe",
  "paymentMethod": "card",
  "customerName": "Jane Smith",
  "notes": "Customer requested extended warranty"
}
```

### Sales Analytics Endpoints

- `GET /api/v1/sales/stats` - Sales statistics
- `GET /api/v1/sales/analytics` - Sales data for charts
- `GET /api/v1/sales/top-products` - Top selling products
- `GET /api/v1/sales/profit` - Profit calculations
- `GET /api/v1/sales/recent` - Recent sales

## 📊 Dashboard API

### Get Dashboard Overview
```http
GET /api/v1/dashboard/overview
```

Returns comprehensive dashboard data including:
- Product statistics
- Sales metrics
- Profit calculations
- Low stock alerts
- Recent sales
- Top products
- Category distribution
- Monthly sales data

### Get Sales Analytics
```http
GET /api/v1/dashboard/analytics?period=30d&groupBy=day
```

**Parameters:**
- `period`: 7d, 30d, 90d, 1y
- `groupBy`: hour, day, week, month

### Get Inventory Insights
```http
GET /api/v1/dashboard/inventory-insights
```

Returns inventory alerts and category insights.

## 🔧 Data Models

### Product Schema
```javascript
{
  name: String,           // Product name
  category: String,       // Product category
  buyPrice: Number,       // Purchase price
  sellPrice: Number,      // Selling price
  quantity: Number,       // Stock quantity
  description: String,    // Product description
  image: String,          // Image URL (optional)
  lowStockThreshold: Number, // Low stock alert threshold
  isActive: Boolean,      // Soft delete flag
  createdAt: Date,
  updatedAt: Date
}
```

### Sale Schema
```javascript
{
  products: [{
    productId: ObjectId,    // Reference to Product
    productName: String,    // Product name at time of sale
    quantity: Number,       // Quantity sold
    sellPrice: Number,      // Price at time of sale
    total: Number          // Line total
  }],
  totalAmount: Number,      // Total sale amount
  cashierName: String,      // Cashier name
  paymentMethod: String,    // cash, card, digital
  customerName: String,     // Customer name (optional)
  notes: String,           // Sale notes (optional)
  receiptNumber: String,    // Auto-generated receipt number
  createdAt: Date,
  updatedAt: Date
}
```

## 🛡️ Error Handling

The API uses consistent error response format:

```json
{
  "status": "error",
  "message": "Error description"
}
```

**HTTP Status Codes:**
- `200` - Success
- `201` - Created
- `400` - Bad Request (validation errors)
- `404` - Not Found
- `429` - Too Many Requests (rate limiting)
- `500` - Internal Server Error

## 🔒 Security Features

- **Rate Limiting**: 100 requests per 15 minutes per IP
- **CORS**: Configured for frontend origin
- **Helmet**: Security headers
- **Input Validation**: Comprehensive validation with express-validator
- **Error Sanitization**: Prevents information leakage

## 📈 Performance Optimizations

- **Database Indexing**: Optimized queries with proper indexes
- **Aggregation Pipelines**: Efficient data aggregation for analytics
- **Compression**: Gzip compression for responses
- **Connection Pooling**: MongoDB connection optimization

## 🧪 Testing the API

### Health Check
```bash
curl http://localhost:5000/api/v1/health
```

### Test Product Creation
```bash
curl -X POST http://localhost:5000/api/v1/products \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Product",
    "category": "Test Category",
    "buyPrice": 50,
    "sellPrice": 80,
    "quantity": 10,
    "description": "Test product description"
  }'
```

## 🚀 Deployment

### Environment Variables for Production
```env
NODE_ENV=production
PORT=5000
MONGODB_URI=mongodb://your-production-mongodb-uri
CORS_ORIGIN=https://your-frontend-domain.com
```

### PM2 Process Manager
```bash
# Install PM2
npm install -g pm2

# Start application
pm2 start server.js --name "store-api"

# Monitor
pm2 monit
```

## 📝 Development

### Adding New Features

1. **Models**: Add new schemas in `/models`
2. **Controllers**: Add business logic in `/controllers`
3. **Routes**: Define endpoints in `/routes`
4. **Validation**: Add validation rules in `/middleware/validation.js`
5. **Tests**: Add tests for new functionality

### Code Structure
```
backend/
├── config/          # Configuration files
├── controllers/     # Business logic
├── middleware/      # Custom middleware
├── models/         # Database schemas
├── routes/         # API routes
├── scripts/        # Utility scripts
└── server.js       # Main application file
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License.

## 🆘 Support

For support, please create an issue in the repository or contact the development team.

---

**Happy Coding! 🎉**