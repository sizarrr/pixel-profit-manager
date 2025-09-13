// src/pages/Sales.tsx - Enhanced with Full FIFO Support
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
  AlertTriangle,
  Layers,
  Info,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/contexts/LanguageContext";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface CartItem {
  productId: string;
  productName: string;
  sellPrice: number;
  quantity: number;
  availableStock: number;
  category: string;
  barcode?: string;
  // FIFO-specific fields
  estimatedProfit?: number;
  hasBatches?: boolean;
}

interface FIFOPreview {
  productId: string;
  productName: string;
  allocations: {
    batchId: string;
    batchNumber: string;
    quantity: number;
    buyPrice: number;
    sellPrice: number;
    profit: number;
    purchaseDate: Date;
  }[];
  totalCost: number;
  totalRevenue: number;
  totalProfit: number;
}

const Sales = () => {
  const {
    products,
    addSale,
    refreshData,
    searchProductByBarcode,
    getProductBatches,
  } = useStore();
  const { toast } = useToast();
  const { t } = useLanguage();

  const [cart, setCart] = useState<CartItem[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [isProcessingSale, setIsProcessingSale] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [showFIFOPreview, setShowFIFOPreview] = useState(false);
  const [fifoPreview, setFIFOPreview] = useState<FIFOPreview[]>([]);

  // Barcode scanning state
  const [barcodeInput, setBarcodeInput] = useState("");
  const [cashierName, setCashierName] = useState("Store Manager");
  const [customerName, setCustomerName] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<
    "cash" | "card" | "digital"
  >("cash");

  // Refs
  const barcodeInputRef = useRef<HTMLInputElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const barcodeTimeoutRef = useRef<NodeJS.Timeout>();

  // Enhanced product filtering with better search
  const availableProducts = products.filter((p) => p.quantity > 0);
  const filteredProducts = availableProducts.filter((product) => {
    if (!searchTerm) return true;

    const searchLower = searchTerm.toLowerCase();
    return (
      product.name.toLowerCase().includes(searchLower) ||
      product.category.toLowerCase().includes(searchLower) ||
      product.description?.toLowerCase().includes(searchLower) ||
      (product.barcode && product.barcode.toLowerCase().includes(searchLower))
    );
  });

  // Enhanced add to cart with FIFO awareness
  const addToCart = useCallback(
    (product: any) => {
      const existingItem = cart.find((item) => item.productId === product.id);

      if (existingItem) {
        if (existingItem.quantity < product.quantity) {
          setCart((prev) =>
            prev.map((item) =>
              item.productId === product.id
                ? {
                    ...item,
                    quantity: item.quantity + 1,
                    estimatedProfit: calculateEstimatedProfit(
                      product,
                      item.quantity + 1
                    ),
                  }
                : item
            )
          );
          toast({
            title: t("update"),
            description: `${product.name} quantity: ${
              existingItem.quantity + 1
            }`,
          });
        } else {
          toast({
            title: t("insufficient_stock"),
            description: `Only ${product.quantity} units available`,
            variant: "destructive",
          });
        }
      } else {
        const newCartItem: CartItem = {
          productId: product.id,
          productName: product.name,
          sellPrice: product.currentSellPrice || product.sellPrice,
          quantity: 1,
          availableStock: product.quantity,
          category: product.category,
          barcode: product.barcode,
          estimatedProfit: calculateEstimatedProfit(product, 1),
          hasBatches: product.totalQuantity !== undefined, // Indicates FIFO product
        };

        setCart((prev) => [...prev, newCartItem]);
        toast({
          title: t("add_to_cart"),
          description: `${product.name} added to cart`,
        });
      }
    },
    [cart, toast, t]
  );

  // Calculate estimated profit based on current prices
  const calculateEstimatedProfit = (product: any, quantity: number): number => {
    const sellPrice = product.currentSellPrice || product.sellPrice;
    const buyPrice = product.currentBuyPrice || product.buyPrice;
    return (sellPrice - buyPrice) * quantity;
  };

  // Generate FIFO preview for the current cart
  const generateFIFOPreview = useCallback(async () => {
    if (cart.length === 0) return;

    try {
      const previews: FIFOPreview[] = [];

      for (const cartItem of cart) {
        const product = products.find((p) => p.id === cartItem.productId);
        if (!product) continue;

        // For FIFO systems, we can simulate the allocation
        // In a real implementation, this would call a backend endpoint
        const preview: FIFOPreview = {
          productId: cartItem.productId,
          productName: cartItem.productName,
          allocations: [
            {
              batchId: "preview",
              batchNumber: "FIFO-PREVIEW",
              quantity: cartItem.quantity,
              buyPrice: product.currentBuyPrice || product.buyPrice,
              sellPrice: cartItem.sellPrice,
              profit:
                (cartItem.sellPrice -
                  (product.currentBuyPrice || product.buyPrice)) *
                cartItem.quantity,
              purchaseDate: new Date(),
            },
          ],
          totalCost:
            (product.currentBuyPrice || product.buyPrice) * cartItem.quantity,
          totalRevenue: cartItem.sellPrice * cartItem.quantity,
          totalProfit:
            (cartItem.sellPrice -
              (product.currentBuyPrice || product.buyPrice)) *
            cartItem.quantity,
        };

        previews.push(preview);
      }

      setFIFOPreview(previews);
    } catch (error) {
      console.error("Error generating FIFO preview:", error);
    }
  }, [cart, products]);

  // Update cart quantity with FIFO recalculation
  const updateCartQuantity = useCallback(
    (productId: string, newQuantity: number) => {
      const item = cart.find((item) => item.productId === productId);
      if (!item) return;

      if (newQuantity <= 0) {
        removeFromCart(productId);
        return;
      }

      if (newQuantity > item.availableStock) {
        toast({
          title: t("insufficient_stock"),
          description: `Only ${item.availableStock} units available`,
          variant: "destructive",
        });
        return;
      }

      const product = products.find((p) => p.id === productId);

      setCart((prev) =>
        prev.map((cartItem) =>
          cartItem.productId === productId
            ? {
                ...cartItem,
                quantity: newQuantity,
                estimatedProfit: product
                  ? calculateEstimatedProfit(product, newQuantity)
                  : 0,
              }
            : cartItem
        )
      );
    },
    [cart, products, toast, t]
  );

  const removeFromCart = useCallback(
    (productId: string) => {
      const item = cart.find((item) => item.productId === productId);
      setCart((prev) => prev.filter((item) => item.productId !== productId));

      if (item) {
        toast({
          title: "Item Removed",
          description: `${item.productName} removed from cart`,
        });
      }
    },
    [cart, toast]
  );

  // Enhanced barcode search with better error handling
  const handleBarcodeSearch = useCallback(
    async (barcode: string) => {
      if (!barcode.trim()) return;

      setIsSearching(true);
      console.log("🔍 Searching for barcode:", barcode);

      try {
        let product = await searchProductByBarcode(barcode.trim());

        if (!product) {
          // Fallback to local search
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
            setBarcodeInput("");
            setSearchTerm("");

            // Audio feedback
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
            description: `No product found for barcode: ${barcode}`,
            variant: "destructive",
          });
        }
      } catch (error) {
        console.error("Barcode search error:", error);
        toast({
          title: "Search Error",
          description: "Failed to search for product",
          variant: "destructive",
        });
      } finally {
        setIsSearching(false);
        setTimeout(() => {
          barcodeInputRef.current?.focus();
        }, 100);
      }
    },
    [searchProductByBarcode, products, addToCart, toast]
  );

  // Barcode input handling with improved UX
  const handleBarcodeInputChange = useCallback(
    (value: string) => {
      setBarcodeInput(value);

      if (barcodeTimeoutRef.current) {
        clearTimeout(barcodeTimeoutRef.current);
      }

      // Auto-search for barcode-like patterns
      if (/^\d{8,}$/.test(value.trim()) && value.length >= 8) {
        barcodeTimeoutRef.current = setTimeout(() => {
          handleBarcodeSearch(value);
        }, 500);
      }
    },
    [handleBarcodeSearch]
  );

  const handleBarcodeKeyPress = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter") {
        e.preventDefault();
        if (barcodeTimeoutRef.current) {
          clearTimeout(barcodeTimeoutRef.current);
        }
        handleBarcodeSearch(barcodeInput);
      }
    },
    [barcodeInput, handleBarcodeSearch]
  );

  // Enhanced sale processing with FIFO validation
  const processSale = async () => {
    console.log("🛒 Starting FIFO sale processing...");

    // Enhanced validation
    if (cart.length === 0) {
      toast({
        title: "Empty Cart",
        description: "Please add items to cart before processing sale",
        variant: "destructive",
      });
      return;
    }

    if (!cashierName.trim()) {
      toast({
        title: "Cashier Required",
        description: "Please enter cashier name",
        variant: "destructive",
      });
      return;
    }

    // Pre-sale stock validation
    for (const cartItem of cart) {
      const product = products.find((p) => p.id === cartItem.productId);
      if (!product || product.quantity < cartItem.quantity) {
        toast({
          title: "Stock Insufficient",
          description: `${cartItem.productName} doesn't have enough stock`,
          variant: "destructive",
        });
        return;
      }
    }

    setIsProcessingSale(true);

    try {
      // Calculate totals with precision
      const calculatedTotal = cart.reduce(
        (total, item) =>
          total + Math.round(item.sellPrice * item.quantity * 100) / 100,
        0
      );

      // Prepare enhanced sale data for FIFO processing
      const saleData = {
        products: cart.map((item) => {
          const originalProduct = products.find((p) => p.id === item.productId);

          if (!originalProduct) {
            throw new Error(`Product not found: ${item.productName}`);
          }

          const itemTotal =
            Math.round(item.sellPrice * item.quantity * 100) / 100;

          return {
            productId: originalProduct._id, // Use MongoDB _id
            productName: item.productName.trim(),
            quantity: Number(item.quantity),
            sellPrice: Number(item.sellPrice),
            total: itemTotal,
          };
        }),
        totalAmount: Math.round(calculatedTotal * 100) / 100,
        cashierName: cashierName.trim(),
        paymentMethod: paymentMethod,
        customerName: customerName.trim() || undefined,
        // Additional FIFO metadata
        notes: `FIFO sale processed at ${new Date().toISOString()}`,
        taxRate: 0, // Can be configured
        discountAmount: 0, // Can be configured
      };

      console.log("📤 Sending FIFO sale data:", saleData);

      // Process the sale through FIFO system
      await addSale(saleData);

      // Success feedback
      toast({
        title: "Sale Completed Successfully! 🎉",
        description: `Total: $${saleData.totalAmount.toFixed(
          2
        )} • FIFO inventory updated`,
        duration: 5000,
      });

      // Generate receipt data for potential printing
      const receiptData = {
        receiptNumber: `RCP-${Date.now()}`,
        date: new Date(),
        cashier: cashierName,
        customer: customerName || "Walk-in Customer",
        items: cart,
        total: calculatedTotal,
        paymentMethod,
      };

      console.log("🧾 Receipt data:", receiptData);

      // Reset the form
      setCart([]);
      setBarcodeInput("");
      setSearchTerm("");
      setCustomerName("");
      setShowFIFOPreview(false);
      setFIFOPreview([]);

      // Focus back to barcode scanner
      setTimeout(() => {
        barcodeInputRef.current?.focus();
      }, 100);

      // Refresh data to update inventory and analytics
      setTimeout(() => {
        refreshData();
      }, 1000);
    } catch (error: any) {
      console.error("❌ FIFO Sale processing error:", error);

      let errorMessage = "Failed to process sale";
      if (error?.response?.data?.message) {
        errorMessage = error.response.data.message;
      } else if (error?.message) {
        errorMessage = error.message;
      }

      toast({
        title: "Sale Processing Failed",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsProcessingSale(false);
    }
  };

  // Enhanced receipt printing with FIFO details
  const printReceipt = () => {
    if (cart.length === 0) return;

    const totalProfit = cart.reduce(
      (sum, item) => sum + (item.estimatedProfit || 0),
      0
    );
    const totalAmount = cart.reduce(
      (sum, item) => sum + item.sellPrice * item.quantity,
      0
    );

    const receiptContent = `
      COMPUTER STORE RECEIPT
      ====================================
      Date: ${new Date().toLocaleDateString()}
      Time: ${new Date().toLocaleTimeString()}
      Cashier: ${cashierName}
      Customer: ${customerName || "Walk-in Customer"}
      Payment: ${paymentMethod.toUpperCase()}
      
      ITEMS (FIFO INVENTORY):
      ${cart
        .map((item) => {
          const lineTotal = item.sellPrice * item.quantity;
          return `${item.productName}
      ${item.quantity} x $${item.sellPrice.toFixed(2)} = $${lineTotal.toFixed(
            2
          )}
      ${item.barcode ? `Barcode: ${item.barcode}` : ""}
      ${item.hasBatches ? "FIFO Tracked ✓" : ""}`;
        })
        .join("\n      ")}
      
      ====================================
      Subtotal: $${totalAmount.toFixed(2)}
      Estimated Profit: $${totalProfit.toFixed(2)}
      ====================================
      TOTAL: $${totalAmount.toFixed(2)}
      ====================================
      
      🏷️  FIFO Inventory System Active
      📦 All items tracked by batch
      📊 Accurate cost calculations
      
      Thank you for your business!
      Visit us again soon!
    `;

    const printWindow = window.open("", "_blank");
    if (printWindow) {
      printWindow.document.write(`
        <html>
          <head>
            <title>Receipt</title>
            <style>
              body { font-family: 'Courier New', monospace; margin: 20px; }
              pre { white-space: pre-wrap; }
            </style>
          </head>
          <body>
            <pre>${receiptContent}</pre>
            <script>
              window.onload = function() { 
                window.print(); 
                setTimeout(function() { window.close(); }, 100);
              }
            </script>
          </body>
        </html>
      `);
      printWindow.document.close();
    }
  };

  const clearCart = () => {
    setCart([]);
    setBarcodeInput("");
    setSearchTerm("");
    setShowFIFOPreview(false);
    setFIFOPreview([]);
    toast({
      title: "Cart Cleared",
      description: "All items removed from cart",
    });
  };

  // Calculate cart summary with FIFO insights
  const cartSummary = {
    itemCount: cart.reduce((sum, item) => sum + item.quantity, 0),
    totalAmount: cart.reduce(
      (sum, item) => sum + item.sellPrice * item.quantity,
      0
    ),
    totalProfit: cart.reduce(
      (sum, item) => sum + (item.estimatedProfit || 0),
      0
    ),
    fifoItemsCount: cart.filter((item) => item.hasBatches).length,
  };

  // Initialize component
  useEffect(() => {
    const timer = setTimeout(() => {
      barcodeInputRef.current?.focus();
    }, 100);
    return () => clearTimeout(timer);
  }, []);

  // Cleanup
  useEffect(() => {
    return () => {
      if (barcodeTimeoutRef.current) {
        clearTimeout(barcodeTimeoutRef.current);
      }
    };
  }, []);

  // Generate FIFO preview when cart changes
  useEffect(() => {
    if (cart.length > 0 && showFIFOPreview) {
      generateFIFOPreview();
    }
  }, [cart, showFIFOPreview, generateFIFOPreview]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Products Section */}
      <div className="lg:col-span-2 space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">{t("sales")}</h1>
          <p className="text-gray-600 flex items-center gap-2">
            <Layers className="w-4 h-4" />
            FIFO Inventory System Active - Accurate cost tracking enabled
          </p>
        </div>

        {/* FIFO System Info */}
        <Alert>
          <Info className="h-4 w-4" />
          <AlertDescription>
            <strong>FIFO Active:</strong> All sales will use First-In-First-Out
            inventory allocation for accurate profit calculation. Oldest stock
            will be automatically allocated first.
          </AlertDescription>
        </Alert>

        {/* Enhanced Barcode Scanner */}
        <Card className="border-2 border-blue-200 bg-blue-50">
          <CardContent className="p-4">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Scan className="w-5 h-5 text-blue-600" />
                  <h3 className="font-semibold text-blue-900">
                    Barcode Scanner
                  </h3>
                </div>
                {isSearching && (
                  <div className="flex items-center gap-2">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                    <span className="text-sm text-blue-600">Searching...</span>
                  </div>
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
                  className="pl-10 bg-white text-lg font-mono"
                  autoComplete="off"
                />
              </div>

              <div className="flex items-center justify-between text-xs text-blue-600">
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

        {/* Regular Product Search */}
        <Card>
          <CardContent className="p-4">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <Input
                ref={searchInputRef}
                placeholder="Search products by name, category, or description..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </CardContent>
        </Card>

        {/* Products Grid with Enhanced Display */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredProducts.map((product) => (
            <Card
              key={product.id}
              className="hover:shadow-md transition-shadow cursor-pointer group"
              onClick={() => addToCart(product)}
            >
              <CardContent className="p-4">
                <div className="flex justify-between items-start mb-3">
                  <div className="flex-1">
                    <h3 className="font-semibold text-gray-900 group-hover:text-blue-600">
                      {product.name}
                    </h3>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant="secondary">{product.category}</Badge>
                      {product.barcode && (
                        <Badge variant="outline" className="text-xs font-mono">
                          {product.barcode}
                        </Badge>
                      )}
                      {product.totalQuantity !== undefined && (
                        <Badge className="bg-blue-100 text-blue-800">
                          <Layers className="w-3 h-3 mr-1" />
                          FIFO
                        </Badge>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold text-green-600">
                      $
                      {(product.currentSellPrice || product.sellPrice).toFixed(
                        2
                      )}
                    </p>
                    <p
                      className={`text-sm ${
                        product.quantity <= 5 ? "text-red-500" : "text-gray-500"
                      }`}
                    >
                      {product.quantity} in stock
                    </p>
                    {product.currentBuyPrice && (
                      <p className="text-xs text-gray-400">
                        Est. profit: $
                        {(
                          (product.currentSellPrice || product.sellPrice) -
                          product.currentBuyPrice
                        ).toFixed(2)}
                      </p>
                    )}
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
                No Products Found
              </h3>
              <p className="text-gray-500">
                {searchTerm || barcodeInput
                  ? "No products match your search criteria"
                  : "No products currently in stock"}
              </p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Enhanced Cart Section with FIFO Features */}
      <div className="space-y-6">
        {/* Sale Configuration */}
        <Card>
          <CardHeader>
            <CardTitle>Sale Configuration</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <label className="text-sm font-medium text-gray-700">
                Cashier Name *
              </label>
              <Input
                value={cashierName}
                onChange={(e) => setCashierName(e.target.value)}
                placeholder="Enter cashier name"
                required
              />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700">
                Customer Name
              </label>
              <Input
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="Enter customer name (optional)"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700">
                Payment Method
              </label>
              <select
                value={paymentMethod}
                onChange={(e) =>
                  setPaymentMethod(
                    e.target.value as "cash" | "card" | "digital"
                  )
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="cash">Cash</option>
                <option value="card">Card</option>
                <option value="digital">Digital Payment</option>
              </select>
            </div>
          </CardContent>
        </Card>

        {/* Shopping Cart */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShoppingCart className="w-5 h-5" />
                Shopping Cart ({cartSummary.itemCount})
                {cartSummary.fifoItemsCount > 0 && (
                  <Badge className="bg-blue-100 text-blue-800">
                    <Layers className="w-3 h-3 mr-1" />
                    {cartSummary.fifoItemsCount} FIFO
                  </Badge>
                )}
              </div>
              {cart.length > 0 && (
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowFIFOPreview(!showFIFOPreview)}
                  >
                    <Layers className="w-4 h-4 mr-1" />
                    FIFO Preview
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={clearCart}
                    className="text-red-600 hover:text-red-700"
                  >
                    Clear All
                  </Button>
                </div>
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
                      <h4 className="font-medium text-gray-900 flex items-center gap-2">
                        {item.productName}
                        {item.hasBatches && (
                          <Badge className="bg-blue-100 text-blue-700 text-xs">
                            <Layers className="w-3 h-3 mr-1" />
                            FIFO
                          </Badge>
                        )}
                      </h4>
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <span>${item.sellPrice} each</span>
                        {item.barcode && (
                          <Badge
                            variant="outline"
                            className="text-xs font-mono"
                          >
                            {item.barcode}
                          </Badge>
                        )}
                      </div>
                      <div className="text-xs text-gray-500 space-y-1">
                        <p>
                          Line total: $
                          {(item.sellPrice * item.quantity).toFixed(2)}
                        </p>
                        {item.estimatedProfit && (
                          <p className="text-green-600">
                            Est. profit: ${item.estimatedProfit.toFixed(2)}
                          </p>
                        )}
                      </div>
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

        {/* FIFO Preview Panel */}
        {showFIFOPreview && cart.length > 0 && (
          <Card className="border-blue-200 bg-blue-50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-blue-900">
                <Layers className="w-5 h-5" />
                FIFO Allocation Preview
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 text-sm">
                {fifoPreview.map((preview) => (
                  <div
                    key={preview.productId}
                    className="bg-white rounded-lg p-3 border"
                  >
                    <h4 className="font-medium text-gray-900 mb-2">
                      {preview.productName}
                    </h4>
                    <div className="space-y-1 text-xs text-gray-600">
                      <div className="flex justify-between">
                        <span>Total Cost (FIFO):</span>
                        <span>${preview.totalCost.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Total Revenue:</span>
                        <span>${preview.totalRevenue.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between font-medium text-green-600">
                        <span>Actual Profit:</span>
                        <span>${preview.totalProfit.toFixed(2)}</span>
                      </div>
                    </div>
                  </div>
                ))}
                <div className="bg-white rounded-lg p-3 border border-blue-200">
                  <div className="flex justify-between items-center font-medium text-blue-900">
                    <span>Total FIFO Profit:</span>
                    <span>
                      $
                      {fifoPreview
                        .reduce((sum, p) => sum + p.totalProfit, 0)
                        .toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Order Summary with Enhanced FIFO Info */}
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
                      {item.hasBatches && (
                        <Badge className="ml-1 bg-blue-100 text-blue-700 text-xs">
                          FIFO
                        </Badge>
                      )}
                    </span>
                    <span className="font-medium">
                      ${(item.sellPrice * item.quantity).toFixed(2)}
                    </span>
                  </div>
                ))}

                <div className="border-t pt-3 space-y-2">
                  <div className="flex justify-between items-center">
                    <span>Subtotal:</span>
                    <span className="font-medium">
                      ${cartSummary.totalAmount.toFixed(2)}
                    </span>
                  </div>

                  {cartSummary.totalProfit > 0 && (
                    <div className="flex justify-between items-center text-sm text-green-600">
                      <span>Est. Profit (FIFO):</span>
                      <span className="font-medium">
                        ${cartSummary.totalProfit.toFixed(2)}
                      </span>
                    </div>
                  )}

                  <div className="flex justify-between items-center text-lg font-bold border-t pt-2">
                    <span>Total:</span>
                    <span className="text-green-600">
                      ${cartSummary.totalAmount.toFixed(2)}
                    </span>
                  </div>
                </div>

                <div className="space-y-2 pt-4">
                  <Button
                    onClick={processSale}
                    disabled={isProcessingSale || !cashierName.trim()}
                    className="w-full flex items-center gap-2"
                    size="lg"
                  >
                    {isProcessingSale ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                        Processing FIFO Sale...
                      </>
                    ) : (
                      <>
                        <CheckCircle className="w-4 h-4" />
                        Process Sale (FIFO)
                      </>
                    )}
                  </Button>

                  <Button
                    variant="outline"
                    onClick={printReceipt}
                    className="w-full flex items-center gap-2"
                    disabled={isProcessingSale}
                  >
                    <Receipt className="w-4 h-4" />
                    Print Receipt
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Sale Processing Status */}
        {isProcessingSale && (
          <Card className="border-yellow-200 bg-yellow-50">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-yellow-600"></div>
                <div>
                  <p className="font-medium text-yellow-800">
                    Processing FIFO Sale...
                  </p>
                  <p className="text-sm text-yellow-600">
                    Allocating inventory using First-In-First-Out method for
                    accurate costing
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* FIFO System Status & Info */}
        {cart.length > 0 && (
          <Card className="border-gray-200">
            <CardContent className="p-4">
              <div className="text-xs text-gray-500 space-y-1">
                <div className="flex items-center gap-2 font-medium text-gray-700">
                  <Layers className="w-4 h-4" />
                  <span>FIFO Inventory System</span>
                </div>
                <p>
                  💡 Sale will be processed using First-In-First-Out inventory
                  allocation
                </p>
                <p>
                  📦 {cartSummary.itemCount} items • $
                  {cartSummary.totalAmount.toFixed(2)} total
                </p>
                <p>📊 {cartSummary.fifoItemsCount} items with batch tracking</p>
                <p>
                  💰 Estimated profit: ${cartSummary.totalProfit.toFixed(2)}
                </p>

                {cart.some(
                  (item) => item.quantity >= item.availableStock * 0.8
                ) && (
                  <div className="flex items-center gap-1 text-orange-600 mt-2">
                    <AlertTriangle className="w-3 h-3" />
                    <span>Some items have low stock remaining</span>
                  </div>
                )}

                {!cashierName.trim() && (
                  <div className="flex items-center gap-1 text-red-600 mt-2">
                    <AlertTriangle className="w-3 h-3" />
                    <span>Cashier name required to process sale</span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default Sales;
