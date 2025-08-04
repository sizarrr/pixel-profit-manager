# POS System Backend API

A Node.js/Express backend API for a Point of Sale (POS) system with inventory management.

## Features

- **Product Management**: CRUD operations for products with categories and inventory tracking
- **Sales Processing**: Complete sales workflow with automatic inventory updates
- **Analytics**: Dashboard statistics, sales reports, and profit analysis
- **Transaction Safety**: Database transactions ensure data consistency
- **Validation**: Input validation and error handling
- **SQLite Database**: Lightweight, file-based database for easy deployment

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
   Edit `.env` file if needed (default values should work for development).

4. **Initialize and seed the database**:
   ```bash
   npm run seed
   ```
   This will create the SQLite database and populate it with sample data.

5. **Start the development server**:
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
   ```

3. **Start the server**:
   ```bash
   npm start
   ```

## Database Schema

### Products Table
- `id` (TEXT PRIMARY KEY)
- `name` (TEXT NOT NULL)
- `category` (TEXT NOT NULL)
- `buy_price` (REAL NOT NULL)
- `sell_price` (REAL NOT NULL)
- `quantity` (INTEGER NOT NULL)
- `description` (TEXT)
- `image` (TEXT)
- `created_at` (DATETIME)
- `updated_at` (DATETIME)

### Sales Table
- `id` (TEXT PRIMARY KEY)
- `total_amount` (REAL NOT NULL)
- `cashier_name` (TEXT NOT NULL)
- `created_at` (DATETIME)

### Sale Items Table
- `id` (TEXT PRIMARY KEY)
- `sale_id` (TEXT NOT NULL)
- `product_id` (TEXT NOT NULL)
- `product_name` (TEXT NOT NULL)
- `quantity` (INTEGER NOT NULL)
- `sell_price` (REAL NOT NULL)
- `total` (REAL NOT NULL)

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
│   │   └── init.js          # Database setup and helpers
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
- Input validation and sanitization
- SQL injection prevention with parameterized queries

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

MIT License