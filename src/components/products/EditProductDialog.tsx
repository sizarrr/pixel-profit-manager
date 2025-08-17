import React, { useEffect } from "react";
import { useForm } from "react-hook-form";
import { useStore, Product } from "@/contexts/StoreContext";
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
import { useToast } from "@/hooks/use-toast";
import { Textarea } from "@/components/ui/textarea";

interface EditProductDialogProps {
  product: Product;
  isOpen: boolean;
  onClose: () => void;
}

interface ProductFormData {
  name: string;
  category: string;
  buyPrice: number;
  sellPrice: number;
  quantity: number;
  description: string;
  barcode: string;
  lowStockThreshold: number;
}

const EditProductDialog: React.FC<EditProductDialogProps> = ({
  product,
  isOpen,
  onClose,
}) => {
  const { updateProduct, loading } = useStore();
  const { toast } = useToast();

  const form = useForm<ProductFormData>({
    defaultValues: {
      name: "",
      category: "",
      buyPrice: 0,
      sellPrice: 0,
      quantity: 0,
      description: "",
      barcode: "",
      lowStockThreshold: 5,
    },
  });

  // Reset form when product changes
  useEffect(() => {
    if (product && isOpen) {
      console.log("🔄 Resetting form with product data:", product);
      form.reset({
        name: product.name || "",
        category: product.category || "",
        buyPrice: Number(product.buyPrice) || 0,
        sellPrice: Number(product.sellPrice) || 0,
        quantity: Number(product.quantity) || 0,
        description: product.description || "",
        barcode: product.barcode || "",
        lowStockThreshold: Number(product.lowStockThreshold) || 5,
      });
    }
  }, [product, isOpen, form]);

  const onSubmit = async (data: ProductFormData) => {
    console.log("📝 Form submission data:", data);
    console.log("🔍 Original product:", product);

    try {
      // Validate prices
      if (data.sellPrice < data.buyPrice) {
        toast({
          title: "Validation Error",
          description: "Sell price must be greater than or equal to buy price",
          variant: "destructive",
        });
        return;
      }

      // Prepare update data - only include changed fields
      const updateData: Partial<Product> = {};

      // Compare each field and only include if changed
      if (data.name !== product.name) {
        updateData.name = data.name.trim();
      }

      if (data.category !== product.category) {
        updateData.category = data.category.trim();
      }

      if (Number(data.buyPrice) !== Number(product.buyPrice)) {
        updateData.buyPrice = Number(data.buyPrice);
      }

      if (Number(data.sellPrice) !== Number(product.sellPrice)) {
        updateData.sellPrice = Number(data.sellPrice);
      }

      if (Number(data.quantity) !== Number(product.quantity)) {
        updateData.quantity = Number(data.quantity);
      }

      if (data.description !== product.description) {
        updateData.description = data.description.trim();
      }

      // Handle barcode specially - it can be empty, null, or a value
      const newBarcode = data.barcode ? data.barcode.trim() : "";
      const oldBarcode = product.barcode || "";
      if (newBarcode !== oldBarcode) {
        updateData.barcode = newBarcode || null;
      }

      if (
        Number(data.lowStockThreshold) !== Number(product.lowStockThreshold)
      ) {
        updateData.lowStockThreshold = Number(data.lowStockThreshold);
      }

      console.log("🚀 Update data being sent:", updateData);

      // Check if there are actually changes to make
      if (Object.keys(updateData).length === 0) {
        toast({
          title: "No Changes",
          description: "No changes were made to the product.",
          variant: "default",
        });
        onClose();
        return;
      }

      // Call the update function
      await updateProduct(product.id, updateData);

      toast({
        title: "Success",
        description: "Product updated successfully!",
      });

      onClose();
    } catch (error: any) {
      console.error("❌ Error updating product:", error);

      // Extract meaningful error message
      let errorMessage = "Failed to update product. Please try again.";

      if (error?.response?.data?.message) {
        errorMessage = error.response.data.message;
      } else if (error?.message) {
        errorMessage = error.message;
      }

      toast({
        title: "Update Failed",
        description: errorMessage,
        variant: "destructive",
      });
    }
  };

  const handleClose = () => {
    form.reset();
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[600px] max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Product</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {/* Product Name */}
            <FormField
              control={form.control}
              name="name"
              rules={{
                required: "Product name is required",
                minLength: {
                  value: 2,
                  message: "Name must be at least 2 characters",
                },
                maxLength: {
                  value: 100,
                  message: "Name cannot exceed 100 characters",
                },
              }}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Product Name</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Enter product name"
                      {...field}
                      disabled={loading}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Category and Barcode Row */}
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="category"
                rules={{
                  required: "Category is required",
                  minLength: {
                    value: 2,
                    message: "Category must be at least 2 characters",
                  },
                  maxLength: {
                    value: 50,
                    message: "Category cannot exceed 50 characters",
                  },
                }}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Category</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="e.g., Laptops, Accessories"
                        {...field}
                        disabled={loading}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="barcode"
                rules={{
                  validate: (value) => {
                    if (!value || value.trim() === "") return true; // Optional field
                    const trimmed = value.trim();
                    if (trimmed.length < 6 || trimmed.length > 50) {
                      return "Barcode must be between 6 and 50 characters";
                    }
                    if (!/^[a-zA-Z0-9\-_]+$/.test(trimmed)) {
                      return "Barcode can only contain letters, numbers, hyphens, and underscores";
                    }
                    return true;
                  },
                }}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Barcode (Optional)</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Enter or scan barcode"
                        {...field}
                        disabled={loading}
                        onKeyDown={(e) => {
                          // Handle barcode scanner input
                          if (e.key === "Enter") {
                            e.preventDefault();
                          }
                        }}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Prices Row */}
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="buyPrice"
                rules={{
                  required: "Buy price is required",
                  min: {
                    value: 0.01,
                    message: "Buy price must be greater than 0",
                  },
                  validate: (value) => {
                    const num = parseFloat(value.toString());
                    if (isNaN(num)) return "Buy price must be a valid number";
                    if (num <= 0) return "Buy price must be greater than 0";
                    return true;
                  },
                }}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Buy Price ($)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="0.01"
                        min="0.01"
                        placeholder="0.00"
                        {...field}
                        disabled={loading}
                        onChange={(e) => {
                          const value = parseFloat(e.target.value);
                          field.onChange(isNaN(value) ? 0 : value);
                        }}
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
                    const sellPrice = parseFloat(value.toString());
                    const buyPrice = parseFloat(
                      form.getValues("buyPrice").toString()
                    );

                    if (isNaN(sellPrice))
                      return "Sell price must be a valid number";
                    if (sellPrice <= 0)
                      return "Sell price must be greater than 0";
                    if (sellPrice < buyPrice)
                      return "Sell price must be greater than or equal to buy price";

                    return true;
                  },
                }}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Sell Price ($)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="0.01"
                        min="0.01"
                        placeholder="0.00"
                        {...field}
                        disabled={loading}
                        onChange={(e) => {
                          const value = parseFloat(e.target.value);
                          field.onChange(isNaN(value) ? 0 : value);
                        }}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Quantity and Low Stock Threshold Row */}
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="quantity"
                rules={{
                  required: "Quantity is required",
                  min: { value: 0, message: "Quantity cannot be negative" },
                  validate: (value) => {
                    const num = parseInt(value.toString());
                    if (isNaN(num)) return "Quantity must be a valid number";
                    if (num < 0) return "Quantity cannot be negative";
                    return true;
                  },
                }}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Quantity in Stock</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min="0"
                        step="1"
                        placeholder="0"
                        {...field}
                        disabled={loading}
                        onChange={(e) => {
                          const value = parseInt(e.target.value);
                          field.onChange(isNaN(value) ? 0 : value);
                        }}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="lowStockThreshold"
                rules={{
                  min: {
                    value: 0,
                    message: "Low stock threshold cannot be negative",
                  },
                  validate: (value) => {
                    const num = parseInt(value.toString());
                    if (isNaN(num))
                      return "Low stock threshold must be a valid number";
                    if (num < 0)
                      return "Low stock threshold cannot be negative";
                    return true;
                  },
                }}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Low Stock Alert Threshold</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min="0"
                        step="1"
                        placeholder="5"
                        {...field}
                        disabled={loading}
                        onChange={(e) => {
                          const value = parseInt(e.target.value);
                          field.onChange(isNaN(value) ? 5 : value);
                        }}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Description */}
            <FormField
              control={form.control}
              name="description"
              rules={{
                required: "Description is required",
                minLength: {
                  value: 10,
                  message: "Description must be at least 10 characters",
                },
                maxLength: {
                  value: 500,
                  message: "Description cannot exceed 500 characters",
                },
              }}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Enter product description"
                      {...field}
                      disabled={loading}
                      rows={3}
                      className="resize-none"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Current vs New Values Preview */}
            {Object.keys(form.formState.dirtyFields).length > 0 && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h4 className="font-medium text-blue-900 mb-2">
                  Changes Summary:
                </h4>
                <div className="space-y-1 text-sm">
                  {form.formState.dirtyFields.name && (
                    <div className="text-blue-800">
                      <strong>Name:</strong> "{product.name}" → "
                      {form.getValues("name")}"
                    </div>
                  )}
                  {form.formState.dirtyFields.category && (
                    <div className="text-blue-800">
                      <strong>Category:</strong> "{product.category}" → "
                      {form.getValues("category")}"
                    </div>
                  )}
                  {form.formState.dirtyFields.buyPrice && (
                    <div className="text-blue-800">
                      <strong>Buy Price:</strong> ${product.buyPrice} → $
                      {form.getValues("buyPrice")}
                    </div>
                  )}
                  {form.formState.dirtyFields.sellPrice && (
                    <div className="text-blue-800">
                      <strong>Sell Price:</strong> ${product.sellPrice} → $
                      {form.getValues("sellPrice")}
                    </div>
                  )}
                  {form.formState.dirtyFields.quantity && (
                    <div className="text-blue-800">
                      <strong>Quantity:</strong> {product.quantity} →{" "}
                      {form.getValues("quantity")}
                    </div>
                  )}
                  {form.formState.dirtyFields.barcode && (
                    <div className="text-blue-800">
                      <strong>Barcode:</strong> "{product.barcode || "None"}" →
                      "{form.getValues("barcode") || "None"}"
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex justify-end gap-2 pt-4 border-t">
              <Button
                type="button"
                variant="outline"
                onClick={handleClose}
                disabled={loading}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={loading || !form.formState.isValid}
              >
                {loading ? "Updating..." : "Update Product"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};

export default EditProductDialog;
