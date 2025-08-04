#!/bin/bash

# Store Management Backend Setup Script
echo "🚀 Setting up Store Management Backend..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    print_error "Node.js is not installed. Please install Node.js v16 or higher."
    exit 1
fi

# Check Node.js version
NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 16 ]; then
    print_error "Node.js version must be 16 or higher. Current version: $(node -v)"
    exit 1
fi

print_success "Node.js $(node -v) is installed"

# Check if MongoDB is running
if ! pgrep -x "mongod" > /dev/null; then
    print_warning "MongoDB doesn't appear to be running. Please start MongoDB service."
    print_status "On Ubuntu/Debian: sudo systemctl start mongod"
    print_status "On macOS with Homebrew: brew services start mongodb-community"
    print_status "On Windows: net start MongoDB"
fi

# Install dependencies
print_status "Installing dependencies..."
npm install

if [ $? -eq 0 ]; then
    print_success "Dependencies installed successfully"
else
    print_error "Failed to install dependencies"
    exit 1
fi

# Create .env file if it doesn't exist
if [ ! -f ".env" ]; then
    print_status "Creating .env file..."
    cp .env.example .env
    print_success ".env file created from template"
    print_warning "Please review and update the .env file with your configuration"
else
    print_status ".env file already exists"
fi

# Seed the database
print_status "Seeding database with sample data..."
npm run seed

if [ $? -eq 0 ]; then
    print_success "Database seeded successfully"
else
    print_warning "Database seeding failed. You can run 'npm run seed' manually later."
fi

echo ""
echo "🎉 Setup completed successfully!"
echo ""
echo "📋 Next steps:"
echo "  1. Review and update the .env file if needed"
echo "  2. Start the development server: npm run dev"
echo "  3. Visit http://localhost:5000/api/v1/health to test the API"
echo ""
echo "📚 Available commands:"
echo "  npm run dev     - Start development server with hot reload"
echo "  npm start       - Start production server"
echo "  npm run seed    - Seed database with sample data"
echo ""
echo "🔗 API Endpoints:"
echo "  Health Check:    http://localhost:5000/api/v1/health"
echo "  Products:        http://localhost:5000/api/v1/products"
echo "  Sales:           http://localhost:5000/api/v1/sales"
echo "  Dashboard:       http://localhost:5000/api/v1/dashboard"
echo ""
print_success "Happy coding! 🚀"