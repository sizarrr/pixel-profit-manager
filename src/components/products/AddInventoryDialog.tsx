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
import { Package, Plus, DollarSign, Calendar, User } from "lucide-react";

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

  const selectedProduct = products.find(
    (p) => p.id === form.watch("productId")
  );

  React.useEffect(() => {
    if (productId) {
      form.setValue("productId", productId);

      // Auto-fill prices from existing product if available
      if (selectedProduct) {
        form.setValue("sellPrice", selectedProduct.sellPrice);
        form.setValue("buyPrice", selectedProduct.buyPrice);
      }
    }
  }, [productId, selectedProduct, form]);

  const onSubmit = async (data: InventoryBatchFormData) => {
    console.log("Form submitted:", data);
    try {
      const batchData = {
        productId: data.productId,
        buyPrice: Number(data.buyPrice),
        sellPrice: Number(data.sellPrice),
        quantity: Number(data.quantity),
        supplierName: data.supplierName.trim(),
        invoiceNumber: data.invoiceNumber.trim(),
        purchaseDate: new Date(data.purchaseDate),
        expiryDate: data.expiryDate ? new Date(data.expiryDate) : undefined,
        notes: data.notes.trim(),
        shippingCost: Number(data.shippingCost) || 0,
        taxAmount: Number(data.taxAmount) || 0,
        otherCosts: Number(data.otherCosts) || 0,
      };

      await addInventoryBatch(batchData);

      toast({
        title: t("success"),
        description:
          "Inventory batch added successfully! Stock will be processed using FIFO.",
      });

      form.reset();
      onClose();
    } catch (error: any) {
      console.error("Error adding inventory batch:", error);

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

  const totalCostPerUnit = () => {
    const buyPrice = Number(form.watch("buyPrice")) || 0;
    const shippingCost = Number(form.watch("shippingCost")) || 0;
    const taxAmount = Number(form.watch("taxAmount")) || 0;
    const otherCosts = Number(form.watch("otherCosts")) || 0;
    const quantity = Number(form.watch("quantity")) || 1;

    const additionalCostPerUnit =
      (shippingCost + taxAmount + otherCosts) / quantity;
    return buyPrice + additionalCostPerUnit;
  };

  const profitPerUnit = () => {
    const sellPrice = Number(form.watch("sellPrice")) || 0;
    const totalCost = totalCostPerUnit();
    return sellPrice - totalCost;
  };

  const profitMargin = () => {
    const sellPrice = Number(form.watch("sellPrice")) || 0;
    const profit = profitPerUnit();
    return sellPrice > 0 ? (profit / sellPrice) * 100 : 0;
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px] max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="w-5 h-5" />
            Add Inventory Batch
            {productName && (
              <span className="text-gray-500">for {productName}</span>
            )}
          </DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {/* Product Selection */}
            {!productId && (
              <FormField
                control={form.control}
                name="productId"
                rules={{ required: "Product selection is required" }}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Product</FormLabel>
                    <FormControl>
                      <select
                        {...field}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                      >
                        <option value="">Select a product</option>
                        {products.map((product) => (
                          <option key={product.id} value={product.id}>
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

            {/* Supplier Information */}
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="supplierName"
                rules={{ required: "Supplier name is required" }}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-2">
                      <User className="w-4 h-4" />
                      Supplier Name
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
                      Purchase Date
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
                      Buy Price ($)
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
                    const totalCost = totalCostPerUnit();
                    return (
                      value >= totalCost ||
                      `Sell price must be at least ${totalCost.toFixed(
                        2
                      )} (total cost per unit)`
                    );
                  },
                }}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Sell Price ($)</FormLabel>
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
                    <FormLabel>Quantity</FormLabel>
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
                    ${totalCostPerUnit().toFixed(2)}
                  </span>
                </div>
                <div>
                  <span className="text-gray-600">Profit per Unit:</span>
                  <span
                    className={`ml-2 font-semibold ${
                      profitPerUnit() >= 0 ? "text-green-600" : "text-red-600"
                    }`}
                  >
                    ${profitPerUnit().toFixed(2)}
                  </span>
                </div>
                <div>
                  <span className="text-gray-600">Total Investment:</span>
                  <span className="ml-2 font-semibold">
                    $
                    {(
                      totalCostPerUnit() * (form.watch("quantity") || 0)
                    ).toFixed(2)}
                  </span>
                </div>
                <div>
                  <span className="text-gray-600">Profit Margin:</span>
                  <span
                    className={`ml-2 font-semibold ${
                      profitMargin() >= 0 ? "text-green-600" : "text-red-600"
                    }`}
                  >
                    {profitMargin().toFixed(1)}%
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
              <Button type="button" variant="outline" onClick={onClose}>
                {t("cancel")}
              </Button>
              <Button
                type="submit"
                className="flex items-center gap-2"
                disabled={!form.formState.isValid}
              >
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
