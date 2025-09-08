// src/pages/Sales.tsx - FIXED VERSION
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
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/contexts/LanguageContext";

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
  const { t } = useLanguage();

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
          title: t("update"),
          description: `${product.name} ${t("quantity")}: ${
            existingItem.quantity + 1
          }`,
        });
      } else {
        toast({
          title: t("insufficient_stock"),
          description: `${t("only_units_available").replace(
            "{count}",
            String(product.quantity)
          )}`,
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
        title: t("add_to_cart"),
        description: `${product.name} ${t("success").toLowerCase()}`,
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
        title: t("insufficient_stock"),
        description: `${t("only_units_available").replace(
          "{count}",
          String(item.availableStock)
        )}`,
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
        title: t("delete"),
        description: `${item.productName} ${t("removed")}`,
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
                `${t("add")} ${product.name}`
              );
              utterance.volume = 0.3;
              utterance.rate = 1.2;
              window.speechSynthesis.speak(utterance);
            }
          } else {
            toast({
              title: t("no_products_stock"),
              description: `${product.name} ${t("no_products_stock")}`,
              variant: "destructive",
            });
          }
        } else {
          toast({
            title: t("error"),
            description: `${t("no_products_available")}: ${barcode}`,
            variant: "destructive",
          });
        }
      } catch (error) {
        console.error("Barcode search error:", error);
        toast({
          title: t("error"),
          description: t("failed_add_product"),
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

  // Enhanced sale processing function with better validation
  const processSale = async () => {
    console.log("🛒 Starting sale processing...");

    // Validation checks
    if (cart.length === 0) {
      toast({
        title: t("empty_cart"),
        description: t("add_items_first"),
        variant: "destructive",
      });
      return;
    }

    // Check stock availability before processing
    for (const cartItem of cart) {
      const product = products.find((p) => p.id === cartItem.productId);
      if (!product || product.quantity < cartItem.quantity) {
        toast({
          title: t("insufficient_stock"),
          description: `${t("insufficient_stock")} ${cartItem.productName}`,
          variant: "destructive",
        });
        return;
      }
    }

    setIsProcessingSale(true);

    try {
      // Calculate totals with proper rounding
      const calculatedTotal = cart.reduce(
        (total, item) =>
          total + Math.round(item.sellPrice * item.quantity * 100) / 100,
        0
      );

      // Prepare sale data with enhanced validation
      const saleData = {
        products: cart.map((item) => {
          // Find the original product to get the MongoDB _id
          const originalProduct = products.find((p) => p.id === item.productId);

          if (!originalProduct) {
            throw new Error(`Product not found: ${item.productName}`);
          }

          const itemTotal =
            Math.round(item.sellPrice * item.quantity * 100) / 100;

          return {
            productId: originalProduct._id, // Use MongoDB _id for backend
            productName: item.productName.trim(),
            quantity: Number(item.quantity),
            sellPrice: Number(item.sellPrice),
            total: itemTotal,
          };
        }),
        totalAmount: Math.round(calculatedTotal * 100) / 100,
        cashierName: "Store Manager", // This should come from user context in real app
        paymentMethod: "cash",
        customerName: undefined, // Optional
        notes: undefined, // Optional
      };

      console.log("📤 Sending sale data:", JSON.stringify(saleData, null, 2));

      // Validate sale data before sending
      if (!saleData.cashierName || saleData.cashierName.trim() === "") {
        throw new Error("Cashier name is required");
      }

      if (saleData.totalAmount <= 0) {
        throw new Error("Total amount must be greater than 0");
      }

      if (!saleData.products || saleData.products.length === 0) {
        throw new Error("At least one product is required");
      }

      // Validate each product
      saleData.products.forEach((product, index) => {
        if (!product.productId) {
          throw new Error(`Product ${index + 1}: Product ID is required`);
        }
        if (!product.productName || product.productName.trim() === "") {
          throw new Error(`Product ${index + 1}: Product name is required`);
        }
        if (!product.quantity || product.quantity <= 0) {
          throw new Error(`Product ${index + 1}: Valid quantity is required`);
        }
        if (!product.sellPrice || product.sellPrice <= 0) {
          throw new Error(`Product ${index + 1}: Valid sell price is required`);
        }
        if (!product.total || product.total <= 0) {
          throw new Error(`Product ${index + 1}: Valid total is required`);
        }
      });

      await addSale(saleData);

      toast({
        title: t("sale_completed"),
        description: `${t(
          "sale_processed"
        )} Total: $${saleData.totalAmount.toFixed(2)}`,
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
    } catch (error: any) {
      console.error("❌ Sale processing error:", error);

      let errorMessage = "An error occurred while processing the sale";

      if (error?.response?.data?.message) {
        errorMessage = error.response.data.message;
      } else if (error?.message) {
        errorMessage = error.message;
      }

      toast({
        title: t("error"),
        description: errorMessage,
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
      title: t("success"),
      description: t("clear_selection") || "All items removed from cart",
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

  // Calculate cart summary
  const cartSummary = {
    itemCount: cart.reduce((sum, item) => sum + item.quantity, 0),
    totalAmount: getTotalAmount(),
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Products Section */}
      <div className="lg:col-span-2 space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">{t("sales")}</h1>
          <p className="text-gray-600">{t("scan_or_select_to_add")}</p>
        </div>

        {/* Barcode Scanner Input */}
        <Card className="border-2 border-blue-200 bg-blue-50">
          <CardContent className="p-4">
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Scan className="w-5 h-5 text-blue-600" />
                <h3 className="font-semibold text-blue-900">
                  {t("barcode_scanner")}
                </h3>
                {isSearching && (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                )}
              </div>

              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                <Input
                  ref={barcodeInputRef}
                  placeholder={t("scan_or_type_barcode")}
                  value={barcodeInput}
                  onChange={(e) => handleBarcodeInputChange(e.target.value)}
                  onKeyPress={handleBarcodeKeyPress}
                  disabled={isSearching}
                  className="pl-10 bg-white text-lg font-mono"
                  autoComplete="off"
                />
              </div>

              <div className="flex items-center justify-between text-xs text-gray-600">
                <span>
                  💡 {t("tip")}: {t("barcode_tip")}
                </span>
                <span
                  className={`font-medium ${
                    barcodeInput.length >= 8
                      ? "text-green-600"
                      : "text-gray-400"
                  }`}
                >
                  {barcodeInput.length >= 8
                    ? `✓ ${t("ready")}`
                    : `${Math.max(0, 8 - barcodeInput.length)} ${t(
                        "more_chars"
                      )}`}
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
                placeholder={t("search_products_by_name_or_category")}
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
                      {product.quantity} {t("in_stock")}
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
                  {t("add_to_cart")}
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
                {t("no_products_found")}
              </h3>
              <p className="text-gray-500">
                {searchTerm || barcodeInput
                  ? t("no_products_match")
                  : t("no_products_stock")}
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
                {t("shopping_cart")} ({cartSummary.itemCount})
              </div>
              {cart.length > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearCart}
                  className="text-red-600 hover:text-red-700"
                >
                  {t("clear_all")}
                </Button>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {cart.length === 0 ? (
              <div className="text-center py-8">
                <ShoppingCart className="w-12 h-12 mx-auto text-gray-300 mb-4" />
                <p className="text-gray-500">{t("your_cart_empty")}</p>
                <p className="text-sm text-gray-400 mt-1">
                  {t("scan_or_add_to_get_started")}
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
                        ${item.sellPrice} {t("each")}
                      </p>
                      <p className="text-xs text-gray-500">
                        {t("total")}: $
                        {(item.sellPrice * item.quantity).toFixed(2)}
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
                {t("order_summary")}
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
                    <span>{t("total")}:</span>
                    <span className="text-green-600">
                      ${cartSummary.totalAmount.toFixed(2)}
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
                        {t("processing")}
                      </>
                    ) : (
                      <>
                        <CheckCircle className="w-4 h-4" />
                        {t("process_sale")}
                      </>
                    )}
                  </Button>

                  <Button
                    variant="outline"
                    onClick={printReceipt}
                    className="w-full flex items-center gap-2"
                  >
                    <Receipt className="w-4 h-4" />
                    {t("print_receipt")}
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
                    Processing Sale...
                  </p>
                  <p className="text-sm text-yellow-600">
                    Please wait while we process your transaction.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Error Display */}
        {cart.length > 0 && (
          <Card className="border-gray-200">
            <CardContent className="p-4">
              <div className="text-xs text-gray-500 space-y-1">
                <p>💡 Sale will be processed using FIFO inventory</p>
                <p>
                  📦 {cartSummary.itemCount} items • $
                  {cartSummary.totalAmount.toFixed(2)} total
                </p>
                {cart.some(
                  (item) => item.quantity >= item.availableStock * 0.8
                ) && (
                  <div className="flex items-center gap-1 text-orange-600">
                    <AlertTriangle className="w-3 h-3" />
                    <span>Some items have low stock remaining</span>
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
