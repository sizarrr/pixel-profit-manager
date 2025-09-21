import React from "react";
import { useForm } from "react-hook-form";
import { useStore } from "@/contexts/StoreContext";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import {
  Package,
  Plus,
  DollarSign,
  Calendar,
  User,
  AlertCircle,
} from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface AddInventoryDialogProps {
  isOpen: boolean;
  onClose: () => void;
  productId?: string;
  productName?: string;
}

interface InventoryBatchFormData {
  productId: string;
  buyPrice: number;
  sellPrice: number;
  quantity: number;
  supplierName: string;
  invoiceNumber: string;
  purchaseDate: string;
  expiryDate?: string;
  notes: string;
  shippingCost: number;
  taxAmount: number;
  otherCosts: number;
}

const AddInventoryDialog: React.FC<AddInventoryDialogProps> = ({
  isOpen,
  onClose,
  productId,
  productName,
}) => {
  const { addInventoryBatch, products } = useStore();
  const { t } = useLanguage();
  const { toast } = useToast();

  const form = useForm<InventoryBatchFormData>({
    defaultValues: {
      productId: productId || "",
      buyPrice: 0,
      sellPrice: 0,
      quantity: 1,
      supplierName: "",
      invoiceNumber: "",
      purchaseDate: new Date().toISOString().split("T")[0],
      expiryDate: "",
      notes: "",
      shippingCost: 0,
      taxAmount: 0,
      otherCosts: 0,
    },
  });

  // Find the selected product to auto-fill prices
  const selectedProduct = products.find((p) => {
    // Try to match using both id and _id fields
    return (
      p.id === form.watch("productId") || p._id === form.watch("productId")
    );
  });

  React.useEffect(() => {
    if (productId) {
      console.log("🔍 Setting productId:", productId);

      // Find the product to get the correct MongoDB _id
      const product = products.find(
        (p) => p.id === productId || p._id === productId
      );
      console.log("🔍 Found product:", product);

      if (product) {
        // Use the MongoDB _id for the form
        const mongoId = product._id || product.id;
        console.log("🔍 Using MongoDB ID:", mongoId);

        form.setValue("productId", mongoId);

        // Auto-fill prices from existing product if available
        form.setValue(
          "sellPrice",
          product.sellPrice || product.currentSellPrice || 0
        );
        form.setValue(
          "buyPrice",
          product.buyPrice || product.currentBuyPrice || 0
        );
      }
    }
  }, [productId, products, form]);

  const onSubmit = async (data: InventoryBatchFormData) => {
    console.log("📝 Form submitted with data:", data);

    try {
      // Enhanced validation
      if (!data.productId || data.productId.trim() === "") {
        throw new Error("Product selection is required");
      }

      // Validate that the productId exists in our products list
      const product = products.find(
        (p) => p._id === data.productId || p.id === data.productId
      );
      if (!product) {
        throw new Error(
          "Selected product not found. Please select a valid product."
        );
      }

      console.log("✅ Product validation passed:", product.name);

      if (!data.supplierName || data.supplierName.trim() === "") {
        throw new Error("Supplier name is required");
      }

      if (Number(data.buyPrice) <= 0) {
        throw new Error("Buy price must be greater than 0");
      }

      if (Number(data.sellPrice) <= 0) {
        throw new Error("Sell price must be greater than 0");
      }

      if (Number(data.quantity) <= 0) {
        throw new Error("Quantity must be greater than 0");
      }

      // Validate sell price vs buy price
      const totalCostPerUnit = calculateTotalCostPerUnit();
      if (Number(data.sellPrice) < totalCostPerUnit) {
        throw new Error(
          `Sell price must be at least $${totalCostPerUnit.toFixed(
            2
          )} (total cost per unit)`
        );
      }

      // Prepare batch data with proper validation
      const batchData: any = {
        productId: product._id, // Always use MongoDB _id
        buyPrice: Number(data.buyPrice),
        sellPrice: Number(data.sellPrice),
        quantity: Number(data.quantity),
        supplierName: data.supplierName.trim(),
        invoiceNumber: data.invoiceNumber?.trim() || undefined,
        purchaseDate: data.purchaseDate
          ? new Date(data.purchaseDate + "T00:00:00")
          : new Date(),
        notes: data.notes?.trim() || "",
        shippingCost: Number(data.shippingCost) || 0,
        taxAmount: Number(data.taxAmount) || 0,
        otherCosts: Number(data.otherCosts) || 0,
      };

      console.log("📤 Sending batch data to API:", batchData);

      await addInventoryBatch(batchData);

      toast({
        title: t("success"),
        description: `Inventory batch added successfully! ${data.quantity} units added to FIFO inventory for ${product.name}.`,
        duration: 5000,
      });

      form.reset();
      onClose();
    } catch (error: any) {
      console.error("❌ Error adding inventory batch:", error);

      const errorMessage =
        error?.response?.data?.message ||
        error?.message ||
        "Failed to add inventory batch";

      toast({
        title: t("error"),
        description: errorMessage,
        variant: "destructive",
      });
    }
  };

  const calculateTotalCostPerUnit = () => {
    const buyPrice = Number(form.watch("buyPrice")) || 0;
    const shippingCost = Number(form.watch("shippingCost")) || 0;
    const taxAmount = Number(form.watch("taxAmount")) || 0;
    const otherCosts = Number(form.watch("otherCosts")) || 0;
    const quantity = Number(form.watch("quantity")) || 1;

    const additionalCostPerUnit =
      quantity > 0 ? (shippingCost + taxAmount + otherCosts) / quantity : 0;
    return buyPrice + additionalCostPerUnit;
  };

  const calculateProfitPerUnit = () => {
    const sellPrice = Number(form.watch("sellPrice")) || 0;
    const totalCost = calculateTotalCostPerUnit();
    return sellPrice - totalCost;
  };

  const calculateProfitMargin = () => {
    const sellPrice = Number(form.watch("sellPrice")) || 0;
    const profit = calculateProfitPerUnit();
    return sellPrice > 0 ? (profit / sellPrice) * 100 : 0;
  };

  const handleClose = () => {
    form.reset();
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="w-5 h-5" />
            Add Inventory Batch
            {productName && (
              <span className="text-gray-500">for {productName}</span>
            )}
          </DialogTitle>
        </DialogHeader>

        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            This batch will be added to the FIFO inventory system. Oldest
            batches will be sold first automatically.
          </AlertDescription>
        </Alert>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {/* Product Selection - only show if not pre-selected */}
            {!productId && (
              <FormField
                control={form.control}
                name="productId"
                rules={{
                  required: "Product selection is required",
                  validate: (value) => {
                    const product = products.find(
                      (p) => p._id === value || p.id === value
                    );
                    if (!product) {
                      return "Please select a valid product";
                    }
                    return true;
                  },
                }}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Product *</FormLabel>
                    <FormControl>
                      <select
                        {...field}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                      >
                        <option value="">Select a product</option>
                        {products.map((product) => (
                          <option key={product._id} value={product._id}>
                            {product.name} - {product.category}
                          </option>
                        ))}
                      </select>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {/* Product Info Display */}
            {selectedProduct && (
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                <h4 className="font-medium text-gray-900 mb-2">
                  Selected Product
                </h4>
                <div className="text-sm text-gray-600 space-y-1">
                  <p>
                    <strong>Name:</strong> {selectedProduct.name}
                  </p>
                  <p>
                    <strong>Category:</strong> {selectedProduct.category}
                  </p>
                  <p>
                    <strong>Current Stock:</strong> {selectedProduct.quantity}{" "}
                    units
                  </p>
                  <p>
                    <strong>Current Sell Price:</strong> $
                    {(
                      selectedProduct.currentSellPrice ||
                      selectedProduct.sellPrice
                    ).toFixed(2)}
                  </p>
                  <p>
                    <strong>Current Buy Price:</strong> $
                    {(
                      selectedProduct.currentBuyPrice ||
                      selectedProduct.buyPrice
                    ).toFixed(2)}
                  </p>
                </div>
              </div>
            )}

            {/* Supplier Information */}
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="supplierName"
                rules={{
                  required: "Supplier name is required",
                  minLength: {
                    value: 2,
                    message: "Supplier name must be at least 2 characters",
                  },
                }}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-2">
                      <User className="w-4 h-4" />
                      Supplier Name *
                    </FormLabel>
                    <FormControl>
                      <Input placeholder="Enter supplier name" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="invoiceNumber"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Invoice Number (Optional)</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter invoice number" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Dates */}
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="purchaseDate"
                rules={{ required: "Purchase date is required" }}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-2">
                      <Calendar className="w-4 h-4" />
                      Purchase Date *
                    </FormLabel>
                    <FormControl>
                      <Input
                        type="date"
                        {...field}
                        max={new Date().toISOString().split("T")[0]}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="expiryDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Expiry Date (Optional)</FormLabel>
                    <FormControl>
                      <Input
                        type="date"
                        {...field}
                        min={form.watch("purchaseDate")}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Pricing */}
            <div className="grid grid-cols-3 gap-4">
              <FormField
                control={form.control}
                name="buyPrice"
                rules={{
                  required: "Buy price is required",
                  min: {
                    value: 0.01,
                    message: "Buy price must be greater than 0",
                  },
                }}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-2">
                      <DollarSign className="w-4 h-4" />
                      Buy Price ($) *
                    </FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="0.01"
                        placeholder="0.00"
                        {...field}
                        onChange={(e) =>
                          field.onChange(parseFloat(e.target.value) || 0)
                        }
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="sellPrice"
                rules={{
                  required: "Sell price is required",
                  min: {
                    value: 0.01,
                    message: "Sell price must be greater than 0",
                  },
                  validate: (value) => {
                    const totalCost = calculateTotalCostPerUnit();
                    return (
                      Number(value) >= totalCost ||
                      `Sell price must be at least ${totalCost.toFixed(
                        2
                      )} (total cost per unit)`
                    );
                  },
                }}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Sell Price ($) *</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="0.01"
                        placeholder="0.00"
                        {...field}
                        onChange={(e) =>
                          field.onChange(parseFloat(e.target.value) || 0)
                        }
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="quantity"
                rules={{
                  required: "Quantity is required",
                  min: { value: 1, message: "Quantity must be at least 1" },
                }}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Quantity *</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min="1"
                        step="1"
                        placeholder="1"
                        {...field}
                        onChange={(e) =>
                          field.onChange(parseInt(e.target.value) || 0)
                        }
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Additional Costs */}
            <div className="space-y-3">
              <h4 className="font-medium text-gray-900">
                Additional Costs (Optional)
              </h4>

              <div className="grid grid-cols-3 gap-4">
                <FormField
                  control={form.control}
                  name="shippingCost"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Shipping Cost ($)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="0.01"
                          placeholder="0.00"
                          {...field}
                          onChange={(e) =>
                            field.onChange(parseFloat(e.target.value) || 0)
                          }
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="taxAmount"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Tax Amount ($)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="0.01"
                          placeholder="0.00"
                          {...field}
                          onChange={(e) =>
                            field.onChange(parseFloat(e.target.value) || 0)
                          }
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="otherCosts"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Other Costs ($)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="0.01"
                          placeholder="0.00"
                          {...field}
                          onChange={(e) =>
                            field.onChange(parseFloat(e.target.value) || 0)
                          }
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            {/* Cost Calculation Summary */}
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
              <h4 className="font-medium text-gray-900 mb-3">Cost Analysis</h4>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-gray-600">Total Cost per Unit:</span>
                  <span className="ml-2 font-semibold">
                    ${calculateTotalCostPerUnit().toFixed(2)}
                  </span>
                </div>
                <div>
                  <span className="text-gray-600">Profit per Unit:</span>
                  <span
                    className={`ml-2 font-semibold ${
                      calculateProfitPerUnit() >= 0
                        ? "text-green-600"
                        : "text-red-600"
                    }`}
                  >
                    ${calculateProfitPerUnit().toFixed(2)}
                  </span>
                </div>
                <div>
                  <span className="text-gray-600">Total Investment:</span>
                  <span className="ml-2 font-semibold">
                    $
                    {(
                      calculateTotalCostPerUnit() *
                      (Number(form.watch("quantity")) || 0)
                    ).toFixed(2)}
                  </span>
                </div>
                <div>
                  <span className="text-gray-600">Profit Margin:</span>
                  <span
                    className={`ml-2 font-semibold ${
                      calculateProfitMargin() >= 0
                        ? "text-green-600"
                        : "text-red-600"
                    }`}
                  >
                    {calculateProfitMargin().toFixed(1)}%
                  </span>
                </div>
              </div>
            </div>

            {/* Notes */}
            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes (Optional)</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Add any additional notes about this batch..."
                      {...field}
                      rows={3}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* FIFO Information */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h4 className="font-medium text-blue-900 mb-2">
                📦 FIFO Inventory Management
              </h4>
              <ul className="text-sm text-blue-800 space-y-1">
                <li>
                  • This batch will be added to your FIFO inventory system
                </li>
                <li>• Older batches will be sold first automatically</li>
                <li>• Profit calculations will use actual batch costs</li>
                <li>• You can track performance of individual batches</li>
              </ul>
            </div>

            {/* Action Buttons */}
            <div className="flex justify-end gap-2 pt-4 border-t">
              <Button type="button" variant="outline" onClick={handleClose}>
                {t("cancel")}
              </Button>
              <Button type="submit" className="flex items-center gap-2">
                <Plus className="w-4 h-4" />
                Add Inventory Batch
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};

export default AddInventoryDialog;
