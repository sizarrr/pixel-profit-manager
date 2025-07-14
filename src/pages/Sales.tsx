
import React, { useState } from 'react';
import { useStore } from '@/contexts/StoreContext';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { 
  ShoppingCart, 
  Plus, 
  Minus, 
  Trash2, 
  Receipt, 
  Search,
  DollarSign,
  Package
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface CartItem {
  productId: string;
  productName: string;
  sellPrice: number;
  quantity: number;
  availableStock: number;
}

const Sales = () => {
  const { products, addSale } = useStore();
  const { user } = useAuth();
  const { toast } = useToast();
  
  const [cart, setCart] = useState<CartItem[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isProcessingSale, setIsProcessingSale] = useState(false);
  
  const availableProducts = products.filter(p => p.quantity > 0);
  const filteredProducts = availableProducts.filter(product =>
    product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    product.category.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const addToCart = (product: any) => {
    const existingItem = cart.find(item => item.productId === product.id);
    
    if (existingItem) {
      if (existingItem.quantity < product.quantity) {
        setCart(prev => prev.map(item =>
          item.productId === product.id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        ));
      } else {
        toast({
          title: 'Insufficient Stock',
          description: `Only ${product.quantity} units available in stock.`,
          variant: 'destructive',
        });
      }
    } else {
      const newCartItem: CartItem = {
        productId: product.id,
        productName: product.name,
        sellPrice: product.sellPrice,
        quantity: 1,
        availableStock: product.quantity,
      };
      setCart(prev => [...prev, newCartItem]);
    }
  };

  const updateCartQuantity = (productId: string, newQuantity: number) => {
    const item = cart.find(item => item.productId === productId);
    if (!item) return;

    if (newQuantity <= 0) {
      removeFromCart(productId);
      return;
    }

    if (newQuantity > item.availableStock) {
      toast({
        title: 'Insufficient Stock',
        description: `Only ${item.availableStock} units available.`,
        variant: 'destructive',
      });
      return;
    }

    setCart(prev => prev.map(item =>
      item.productId === productId
        ? { ...item, quantity: newQuantity }
        : item
    ));
  };

  const removeFromCart = (productId: string) => {
    setCart(prev => prev.filter(item => item.productId !== productId));
  };

  const getTotalAmount = () => {
    return cart.reduce((total, item) => total + (item.sellPrice * item.quantity), 0);
  };

  const processSale = async () => {
    if (cart.length === 0) {
      toast({
        title: 'Empty Cart',
        description: 'Please add items to cart before processing sale.',
        variant: 'destructive',
      });
      return;
    }

    // Check stock availability before processing
    for (const cartItem of cart) {
      const product = products.find(p => p.id === cartItem.productId);
      if (!product || product.quantity < cartItem.quantity) {
        toast({
          title: 'Stock Error', 
          description: `Insufficient stock for ${cartItem.productName}`,
          variant: 'destructive',
        });
        return;
      }
    }

    setIsProcessingSale(true);

    try {
      const saleData = {
        products: cart.map(item => ({
          productId: item.productId,
          productName: item.productName,
          quantity: item.quantity,
          sellPrice: item.sellPrice,
          total: item.sellPrice * item.quantity,
        })),
        totalAmount: getTotalAmount(),
        cashierName: user?.name || 'Unknown',
      };

      addSale(saleData);

      toast({
        title: 'Sale Completed',
        description: `Sale of $${getTotalAmount().toFixed(2)} processed successfully!`,
      });

      // Clear cart after successful sale
      setCart([]);
    } catch (error) {
      toast({
        title: 'Sale Failed',
        description: 'Failed to process sale. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsProcessingSale(false);
    }
  };

  const printReceipt = () => {
    if (cart.length === 0) return;

    const receiptContent = `
      COMPUTER STORE RECEIPT
      =====================
      Date: ${new Date().toLocaleDateString()}
      Time: ${new Date().toLocaleTimeString()}
      Cashier: ${user?.name || 'Unknown'}
      
      Items:
      ${cart.map(item => 
        `${item.productName} x${item.quantity} @ $${item.sellPrice} = $${(item.sellPrice * item.quantity).toFixed(2)}`
      ).join('\n      ')}
      
      =====================
      Total: $${getTotalAmount().toFixed(2)}
      =====================
      
      Thank you for your purchase!
    `;

    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(`<pre style="font-family: monospace; white-space: pre-wrap;">${receiptContent}</pre>`);
      printWindow.document.close();
      printWindow.print();
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Products Section */}
      <div className="lg:col-span-2 space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Sales</h1>
          <p className="text-gray-600">Select products to add to cart</p>
        </div>

        {/* Search */}
        <Card>
          <CardContent className="p-4">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <Input
                placeholder="Search products..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </CardContent>
        </Card>

        {/* Products Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredProducts.map(product => (
            <Card key={product.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-4">
                <div className="flex justify-between items-start mb-3">
                  <div className="flex-1">
                    <h3 className="font-semibold text-gray-900">{product.name}</h3>
                    <Badge variant="secondary" className="mt-1">{product.category}</Badge>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold text-green-600">${product.sellPrice}</p>
                    <p className="text-sm text-gray-500">{product.quantity} in stock</p>
                  </div>
                </div>
                
                <p className="text-sm text-gray-600 mb-3">{product.description}</p>
                
                <Button 
                  onClick={() => addToCart(product)}
                  className="w-full flex items-center gap-2"
                  disabled={product.quantity === 0}
                >
                  <Plus className="w-4 h-4" />
                  Add to Cart
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>

        {filteredProducts.length === 0 && (
          <Card>
            <CardContent className="text-center py-12">
              <Package className="w-16 h-16 mx-auto text-gray-300 mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No products available</h3>
              <p className="text-gray-500">
                {searchTerm ? 'No products match your search.' : 'No products in stock.'}
              </p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Cart Section */}
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShoppingCart className="w-5 h-5" />
              Shopping Cart ({cart.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {cart.length === 0 ? (
              <div className="text-center py-8">
                <ShoppingCart className="w-12 h-12 mx-auto text-gray-300 mb-4" />
                <p className="text-gray-500">Your cart is empty</p>
              </div>
            ) : (
              <div className="space-y-4">
                {cart.map(item => (
                  <div key={item.productId} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="flex-1">
                      <h4 className="font-medium text-gray-900">{item.productName}</h4>
                      <p className="text-sm text-gray-600">${item.sellPrice} each</p>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => updateCartQuantity(item.productId, item.quantity - 1)}
                        className="p-1 h-8 w-8"
                      >
                        <Minus className="w-3 h-3" />
                      </Button>
                      
                      <span className="w-8 text-center font-medium">{item.quantity}</span>
                      
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => updateCartQuantity(item.productId, item.quantity + 1)}
                        className="p-1 h-8 w-8"
                      >
                        <Plus className="w-3 h-3" />
                      </Button>
                      
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeFromCart(item.productId)}
                        className="p-1 h-8 w-8 text-red-600 hover:text-red-700"
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Cart Summary */}
        {cart.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="w-5 h-5" />
                Order Summary
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {cart.map(item => (
                  <div key={item.productId} className="flex justify-between text-sm">
                    <span>{item.productName} x{item.quantity}</span>
                    <span>${(item.sellPrice * item.quantity).toFixed(2)}</span>
                  </div>
                ))}
                
                <div className="border-t pt-3">
                  <div className="flex justify-between items-center text-lg font-bold">
                    <span>Total:</span>
                    <span className="text-green-600">${getTotalAmount().toFixed(2)}</span>
                  </div>
                </div>
                
                <div className="space-y-2 pt-4">
                  <Button 
                    onClick={processSale}
                    disabled={isProcessingSale}
                    className="w-full"
                  >
                    {isProcessingSale ? 'Processing...' : 'Process Sale'}
                  </Button>
                  
                  <Button 
                    variant="outline"
                    onClick={printReceipt}
                    className="w-full flex items-center gap-2"
                  >
                    <Receipt className="w-4 h-4" />
                    Print Receipt
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default Sales;
