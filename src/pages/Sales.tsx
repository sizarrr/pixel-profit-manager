import React, { useState, useRef, useEffect, useCallback } from "react";
import { useStore } from "@/contexts/StoreContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  ShoppingCart,
  Plus,
  Minus,
  Trash2,
  Receipt,
  Search,
  DollarSign,
  Package,
  CheckCircle,
  Scan,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface CartItem {
  productId: string;
  productName: string;
  sellPrice: number;
  quantity: number;
  availableStock: number;
}

const Sales = () => {
  const { products, addSale, refreshData, searchProductByBarcode } = useStore();
  const { toast } = useToast();

  const [cart, setCart] = useState<CartItem[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [isProcessingSale, setIsProcessingSale] = useState(false);
  const [isSearching, setIsSearching] = useState(false);

  // Barcode scanning state
  const [barcodeInput, setBarcodeInput] = useState("");
  const [isBarcodeScanMode, setIsBarcodeScanMode] = useState(false);
  const barcodeInputRef = useRef<HTMLInputElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Debounce timer for barcode processing
  const barcodeTimeoutRef = useRef<NodeJS.Timeout>();

  const availableProducts = products.filter((p) => p.quantity > 0);
  const filteredProducts = availableProducts.filter(
    (product) =>
      product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      product.category.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (product.barcode &&
        product.barcode.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const addToCart = (product: any) => {
    const existingItem = cart.find((item) => item.productId === product.id);

    if (existingItem) {
      if (existingItem.quantity < product.quantity) {
        setCart((prev) =>
          prev.map((item) =>
            item.productId === product.id
              ? { ...item, quantity: item.quantity + 1 }
              : item
          )
        );
        toast({
          title: "Updated Cart",
          description: `${product.name} quantity: ${existingItem.quantity + 1}`,
        });
      } else {
        toast({
          title: "Insufficient Stock",
          description: `Only ${product.quantity} units available in stock.`,
          variant: "destructive",
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
      setCart((prev) => [...prev, newCartItem]);
      toast({
        title: "Added to Cart",
        description: `${product.name} added successfully`,
      });
    }
  };

  const updateCartQuantity = (productId: string, newQuantity: number) => {
    const item = cart.find((item) => item.productId === productId);
    if (!item) return;

    if (newQuantity <= 0) {
      removeFromCart(productId);
      return;
    }

    if (newQuantity > item.availableStock) {
      toast({
        title: "Insufficient Stock",
        description: `Only ${item.availableStock} units available.`,
        variant: "destructive",
      });
      return;
    }

    setCart((prev) =>
      prev.map((item) =>
        item.productId === productId ? { ...item, quantity: newQuantity } : item
      )
    );
  };

  const removeFromCart = (productId: string) => {
    const item = cart.find((item) => item.productId === productId);
    setCart((prev) => prev.filter((item) => item.productId !== productId));

    if (item) {
      toast({
        title: "Removed from Cart",
        description: `${item.productName} removed from cart`,
      });
    }
  };

  const getTotalAmount = () => {
    return cart.reduce(
      (total, item) => total + item.sellPrice * item.quantity,
      0
    );
  };

  // Improved barcode search function
  const handleBarcodeSearch = useCallback(
    async (barcode: string) => {
      if (!barcode.trim()) return;

      setIsSearching(true);
      console.log("🔍 Searching for barcode:", barcode);

      try {
        // First try direct barcode lookup
        let product = await searchProductByBarcode(barcode.trim());

        if (!product) {
          // If not found by barcode, search in local products
          product = products.find(
            (p) =>
              p.barcode === barcode.trim() ||
              p.name.toLowerCase().includes(barcode.toLowerCase()) ||
              p.id === barcode.trim()
          );
        }

        if (product) {
          if (product.quantity > 0) {
            addToCart(product);
            // Clear inputs after successful scan
            setBarcodeInput("");
            setSearchTerm("");

            // Play success sound if available
            if (typeof window !== "undefined" && window.speechSynthesis) {
              const utterance = new SpeechSynthesisUtterance(
                `Added ${product.name}`
              );
              utterance.volume = 0.3;
              utterance.rate = 1.2;
              window.speechSynthesis.speak(utterance);
            }
          } else {
            toast({
              title: "Out of Stock",
              description: `${product.name} is currently out of stock`,
              variant: "destructive",
            });
          }
        } else {
          toast({
            title: "Product Not Found",
            description: `No product found with barcode: ${barcode}`,
            variant: "destructive",
          });
        }
      } catch (error) {
        console.error("Barcode search error:", error);
        toast({
          title: "Search Error",
          description: "Failed to search product. Please try again.",
          variant: "destructive",
        });
      } finally {
        setIsSearching(false);
      }
    },
    [searchProductByBarcode, products, addToCart, toast]
  );

  // Handle barcode input changes
  const handleBarcodeInputChange = (value: string) => {
    setBarcodeInput(value);

    // Clear existing timeout
    if (barcodeTimeoutRef.current) {
      clearTimeout(barcodeTimeoutRef.current);
    }

    // If it looks like a barcode (8+ digits), auto-search after 500ms pause
    if (/^\d{8,}$/.test(value.trim()) && value.length >= 8) {
      barcodeTimeoutRef.current = setTimeout(() => {
        handleBarcodeSearch(value);
      }, 500);
    }
  };

  // Handle barcode input key press
  const handleBarcodeKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      if (barcodeTimeoutRef.current) {
        clearTimeout(barcodeTimeoutRef.current);
      }
      handleBarcodeSearch(barcodeInput);
    }
  };

  // Handle regular search
  const handleSearchChange = (value: string) => {
    setSearchTerm(value);
  };

  // Process sale function
  const processSale = async () => {
    if (cart.length === 0) {
      toast({
        title: "Empty Cart",
        description: "Please add items to cart before processing sale.",
        variant: "destructive",
      });
      return;
    }

    // Check stock availability before processing
    for (const cartItem of cart) {
      const product = products.find((p) => p.id === cartItem.productId);
      if (!product || product.quantity < cartItem.quantity) {
        toast({
          title: "Stock Error",
          description: `Insufficient stock for ${cartItem.productName}`,
          variant: "destructive",
        });
        return;
      }
    }

    setIsProcessingSale(true);

    try {
      const saleData = {
        products: cart.map((item) => ({
          productId: item.productId,
          productName: item.productName,
          quantity: item.quantity,
          sellPrice: item.sellPrice,
          total: item.sellPrice * item.quantity,
        })),
        totalAmount: getTotalAmount(),
        cashierName: "Store Manager",
        paymentMethod: "cash",
      };

      await addSale(saleData);

      toast({
        title: "Sale Completed",
        description: `Sale of $${getTotalAmount().toFixed(
          2
        )} processed successfully!`,
        duration: 5000,
      });

      // Clear cart and inputs after successful sale
      setCart([]);
      setBarcodeInput("");
      setSearchTerm("");

      // Focus back to barcode input for next sale
      setTimeout(() => {
        barcodeInputRef.current?.focus();
      }, 100);

      // Refresh data to update charts and inventory
      setTimeout(() => {
        refreshData();
      }, 1000);
    } catch (error) {
      console.error("Sale processing error:", error);
      toast({
        title: "Sale Failed",
        description: "Failed to process sale. Please try again.",
        variant: "destructive",
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
      Cashier: Store Manager
      
      Items:
      ${cart
        .map(
          (item) =>
            `${item.productName} x${item.quantity} @ $${item.sellPrice} = $${(
              item.sellPrice * item.quantity
            ).toFixed(2)}`
        )
        .join("\n      ")}
      
      =====================
      Total: $${getTotalAmount().toFixed(2)}
      =====================
      
      Thank you for your purchase!
    `;

    const printWindow = window.open("", "_blank");
    if (printWindow) {
      printWindow.document.write(
        `<pre style="font-family: monospace; white-space: pre-wrap; padding: 20px;">${receiptContent}</pre>`
      );
      printWindow.document.close();
      printWindow.print();
    }
  };

  const clearCart = () => {
    setCart([]);
    setBarcodeInput("");
    setSearchTerm("");
    toast({
      title: "Cart Cleared",
      description: "All items removed from cart",
    });
  };

  // Focus barcode input on component mount
  useEffect(() => {
    const timer = setTimeout(() => {
      barcodeInputRef.current?.focus();
    }, 100);
    return () => clearTimeout(timer);
  }, []);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (barcodeTimeoutRef.current) {
        clearTimeout(barcodeTimeoutRef.current);
      }
    };
  }, []);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Products Section */}
      <div className="lg:col-span-2 space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Sales</h1>
          <p className="text-gray-600">
            Scan barcodes or select products to add to cart
          </p>
        </div>

        {/* Barcode Scanner Input */}
        <Card className="border-2 border-blue-200 bg-blue-50">
          <CardContent className="p-4">
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Scan className="w-5 h-5 text-blue-600" />
                <h3 className="font-semibold text-blue-900">Barcode Scanner</h3>
                {isSearching && (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                )}
              </div>

              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                <Input
                  ref={barcodeInputRef}
                  placeholder="Scan or type barcode here..."
                  value={barcodeInput}
                  onChange={(e) => handleBarcodeInputChange(e.target.value)}
                  onKeyPress={handleBarcodeKeyPress}
                  disabled={isSearching}
                  className="pl-10 bg-white text-lg font-mono "
                  autoComplete="off"
                />
              </div>

              <div className="flex items-center justify-between text-xs text-gray-600">
                <span>
                  💡 Tip: Scan barcode or type product code for instant add
                </span>
                <span
                  className={`font-medium ${
                    barcodeInput.length >= 8
                      ? "text-green-600"
                      : "text-gray-400"
                  }`}
                >
                  {barcodeInput.length >= 8
                    ? "✓ Ready"
                    : `${Math.max(0, 8 - barcodeInput.length)} more chars`}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Regular Search */}
        <Card>
          <CardContent className="p-4">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <Input
                ref={searchInputRef}
                placeholder="Search products by name or category..."
                value={searchTerm}
                onChange={(e) => handleSearchChange(e.target.value)}
                className="pl-10"
              />
            </div>
          </CardContent>
        </Card>

        {/* Products Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredProducts.map((product) => (
            <Card
              key={product.id}
              className="hover:shadow-md transition-shadow cursor-pointer"
              onClick={() => addToCart(product)}
            >
              <CardContent className="p-4">
                <div className="flex justify-between items-start mb-3">
                  <div className="flex-1">
                    <h3 className="font-semibold text-gray-900">
                      {product.name}
                    </h3>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant="secondary">{product.category}</Badge>
                      {product.barcode && (
                        <Badge variant="outline" className="text-xs font-mono">
                          {product.barcode}
                        </Badge>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold text-green-600">
                      ${product.sellPrice}
                    </p>
                    <p
                      className={`text-sm ${
                        product.quantity <= 5 ? "text-red-500" : "text-gray-500"
                      }`}
                    >
                      {product.quantity} in stock
                    </p>
                  </div>
                </div>

                <p className="text-sm text-gray-600 mb-3 line-clamp-2">
                  {product.description}
                </p>

                <Button
                  onClick={(e) => {
                    e.stopPropagation();
                    addToCart(product);
                  }}
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
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                No products found
              </h3>
              <p className="text-gray-500">
                {searchTerm || barcodeInput
                  ? "No products match your search."
                  : "No products in stock."}
              </p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Cart Section */}
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShoppingCart className="w-5 h-5" />
                Shopping Cart ({cart.length})
              </div>
              {cart.length > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearCart}
                  className="text-red-600 hover:text-red-700"
                >
                  Clear All
                </Button>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {cart.length === 0 ? (
              <div className="text-center py-8">
                <ShoppingCart className="w-12 h-12 mx-auto text-gray-300 mb-4" />
                <p className="text-gray-500">Your cart is empty</p>
                <p className="text-sm text-gray-400 mt-1">
                  Scan a barcode or add products to get started
                </p>
              </div>
            ) : (
              <div className="space-y-4 max-h-96 overflow-y-auto">
                {cart.map((item) => (
                  <div
                    key={item.productId}
                    className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                  >
                    <div className="flex-1">
                      <h4 className="font-medium text-gray-900">
                        {item.productName}
                      </h4>
                      <p className="text-sm text-gray-600">
                        ${item.sellPrice} each
                      </p>
                      <p className="text-xs text-gray-500">
                        Total: ${(item.sellPrice * item.quantity).toFixed(2)}
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          updateCartQuantity(item.productId, item.quantity - 1)
                        }
                        className="p-1 h-8 w-8"
                        disabled={item.quantity <= 1}
                      >
                        <Minus className="w-3 h-3" />
                      </Button>

                      <span className="w-8 text-center font-medium">
                        {item.quantity}
                      </span>

                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          updateCartQuantity(item.productId, item.quantity + 1)
                        }
                        className="p-1 h-8 w-8"
                        disabled={item.quantity >= item.availableStock}
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
                {cart.map((item) => (
                  <div
                    key={item.productId}
                    className="flex justify-between text-sm"
                  >
                    <span className="truncate mr-2">
                      {item.productName} x{item.quantity}
                    </span>
                    <span className="font-medium">
                      ${(item.sellPrice * item.quantity).toFixed(2)}
                    </span>
                  </div>
                ))}

                <div className="border-t pt-3">
                  <div className="flex justify-between items-center text-lg font-bold">
                    <span>Total:</span>
                    <span className="text-green-600">
                      ${getTotalAmount().toFixed(2)}
                    </span>
                  </div>
                </div>

                <div className="space-y-2 pt-4">
                  <Button
                    onClick={processSale}
                    disabled={isProcessingSale}
                    className="w-full flex items-center gap-2"
                    size="lg"
                  >
                    {isProcessingSale ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                        Processing...
                      </>
                    ) : (
                      <>
                        <CheckCircle className="w-4 h-4" />
                        Process Sale
                      </>
                    )}
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
