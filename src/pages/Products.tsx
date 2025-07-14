
import React, { useState } from 'react';
import { useStore } from '@/contexts/StoreContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { 
  Plus, 
  Search, 
  Edit, 
  Trash2, 
  Package, 
  AlertTriangle,
  DollarSign
} from 'lucide-react';
import AddProductDialog from '@/components/products/AddProductDialog';
import EditProductDialog from '@/components/products/EditProductDialog';

const Products = () => {
  const { products, deleteProduct, getLowStockProducts } = useStore();
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  
  const lowStockProducts = getLowStockProducts();
  const categories = Array.from(new Set(products.map(p => p.category)));
  
  const filteredProducts = products.filter(product => {
    const matchesSearch = product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         product.category.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = categoryFilter === 'all' || product.category === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  const handleDeleteProduct = (id: string) => {
    if (window.confirm('Are you sure you want to delete this product?')) {
      deleteProduct(id);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Products</h1>
          <p className="text-gray-600">Manage your inventory and product catalog</p>
        </div>
        <Button onClick={() => setIsAddDialogOpen(true)} className="flex items-center gap-2">
          <Plus className="w-4 h-4" />
          Add Product
        </Button>
      </div>

      {/* Low Stock Alert */}
      {lowStockProducts.length > 0 && (
        <Card className="border-orange-200 bg-orange-50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-orange-800">
              <AlertTriangle className="w-5 h-5" />
              Low Stock Alert
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-orange-700 mb-3">
              {lowStockProducts.length} products are running low on stock:
            </p>
            <div className="flex flex-wrap gap-2">
              {lowStockProducts.map(product => (
                <Badge key={product.id} variant="outline" className="text-orange-700 border-orange-300">
                  {product.name} ({product.quantity} left)
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Filters */}
      <Card>
        <CardContent className="p-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                <Input
                  placeholder="Search products..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Categories</option>
              {categories.map(category => (
                <option key={category} value={category}>{category}</option>
              ))}
            </select>
          </div>
        </CardContent>
      </Card>

      {/* Products Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {filteredProducts.map(product => (
          <Card key={product.id} className="hover:shadow-lg transition-shadow">
            <CardHeader className="pb-3">
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <CardTitle className="text-lg font-semibold text-gray-900 line-clamp-2">
                    {product.name}
                  </CardTitle>
                  <Badge variant="secondary" className="mt-1">
                    {product.category}
                  </Badge>
                </div>
                <div className="flex gap-1 ml-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setEditingProduct(product)}
                    className="p-1 h-8 w-8"
                  >
                    <Edit className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDeleteProduct(product.id)}
                    className="p-1 h-8 w-8 text-red-600 hover:text-red-700"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <p className="text-sm text-gray-600 line-clamp-2">
                  {product.description}
                </p>
                
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-1">
                    <Package className="w-4 h-4 text-gray-500" />
                    <span className={`text-sm font-medium ${
                      product.quantity <= 5 ? 'text-red-600' : 'text-gray-700'
                    }`}>
                      {product.quantity} in stock
                    </span>
                  </div>
                  {product.quantity <= 5 && (
                    <Badge variant="outline" className="text-red-600 border-red-300">
                      Low Stock
                    </Badge>
                  )}
                </div>
                
                <div className="pt-2 border-t">
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="text-xs text-gray-500">Buy Price</p>
                      <p className="font-medium">${product.buyPrice}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-gray-500">Sell Price</p>
                      <p className="font-bold text-green-600 flex items-center gap-1">
                        <DollarSign className="w-3 h-3" />
                        {product.sellPrice}
                      </p>
                    </div>
                  </div>
                  <div className="mt-2 text-center">
                    <p className="text-xs text-gray-500">Profit per unit</p>
                    <p className="text-sm font-medium text-blue-600">
                      ${(product.sellPrice - product.buyPrice).toFixed(2)}
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {filteredProducts.length === 0 && (
        <Card>
          <CardContent className="text-center py-12">
            <Package className="w-16 h-16 mx-auto text-gray-300 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No products found</h3>
            <p className="text-gray-500 mb-4">
              {searchTerm || categoryFilter !== 'all' 
                ? 'Try adjusting your search or filter criteria.'
                : 'Get started by adding your first product.'
              }
            </p>
            {!searchTerm && categoryFilter === 'all' && (
              <Button onClick={() => setIsAddDialogOpen(true)} className="flex items-center gap-2">
                <Plus className="w-4 h-4" />
                Add Your First Product
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {/* Dialogs */}
      <AddProductDialog 
        isOpen={isAddDialogOpen} 
        onClose={() => setIsAddDialogOpen(false)} 
      />
      {editingProduct && (
        <EditProductDialog 
          product={editingProduct}
          isOpen={!!editingProduct}
          onClose={() => setEditingProduct(null)}
        />
      )}
    </div>
  );
};

export default Products;
