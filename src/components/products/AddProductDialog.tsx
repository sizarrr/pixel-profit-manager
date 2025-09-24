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
  DollarSign,
  Tag,
  FileText,
  Hash,
  AlertCircle,
} from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface AddProductDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

interface ProductFormData {
  name: string;
  category: string;
  buyPrice: number;
  sellPrice: number;
  quantity: number;
  barcode: string;
  description: string;
  lowStockThreshold: number;
}

const AddProductDialog: React.FC<AddProductDialogProps> = ({
  isOpen,
  onClose,
}) => {
  const { addProduct } = useStore();
  const { t } = useLanguage();
  const { toast } = useToast();

  const form = useForm<ProductFormData>({
    defaultValues: {
      name: "",
      category: "",
      buyPrice: 0,
      sellPrice: 0,
      quantity: 0,
      barcode: "",
      description: "",
      lowStockThreshold: 5,
    },
  });

  const onSubmit = async (data: ProductFormData) => {
    console.log("Form submitted:", data);
    try {
      // Validate prices
      if (Number(data.sellPrice) < Number(data.buyPrice)) {
        toast({
          title: t("error"),
          description: t("sell_price_greater_buy_price"),
          variant: "destructive",
        });
        return;
      }

      // Create product with all data (no _id needed - auto-generated)
      await addProduct({
        name: data.name.trim(),
        category: data.category.trim(),
        buyPrice: Number(data.buyPrice),
        sellPrice: Number(data.sellPrice),
        quantity: Number(data.quantity) || 0, // Can be 0 initially
        barcode: data.barcode?.trim() || undefined,
        description: data.description.trim(),
        lowStockThreshold: Number(data.lowStockThreshold) || 5,
      });
      toast({
        title: t("success"),
        description:
          data.quantity > 0
            ? `${t("product_added_success")} Initial stock of ${
                data.quantity
              } units added via FIFO system.`
            : t("product_added_success"),
      });

      form.reset();
      onClose();
    } catch (error: any) {
      console.error("Error adding product:", error);

      const errorMessage =
        error?.response?.data?.message ||
        error?.message ||
        t("failed_add_product");

      toast({
        title: t("error"),
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
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="w-5 h-5" />
            {t("add_new_product")}
          </DialogTitle>
        </DialogHeader>

        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Products will use the FIFO inventory system. Initial quantity will
            create an inventory batch automatically.
          </AlertDescription>
        </Alert>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {/* Product Name */}
            <FormField
              control={form.control}
              name="name"
              rules={{
                required: t("required_field"),
                minLength: {
                  value: 2,
                  message: "Name must be at least 2 characters",
                },
              }}
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center gap-2">
                    <Package className="w-4 h-4" />
                    {t("product_name")} *
                  </FormLabel>
                  <FormControl>
                    <Input placeholder={t("enter_product_name")} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Category and Barcode */}
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="category"
                rules={{
                  required: t("required_field"),
                  minLength: {
                    value: 2,
                    message: "Category must be at least 2 characters",
                  },
                }}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-2">
                      <Tag className="w-4 h-4" />
                      {t("category")} *
                    </FormLabel>
                    <FormControl>
                      <Input
                        placeholder="e.g., Laptops, Accessories"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="barcode"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-2">
                      <Hash className="w-4 h-4" />
                      {t("barcode")} ({t("optional")})
                    </FormLabel>
                    <FormControl>
                      <Input placeholder={t("enter_scan_barcode")} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Prices */}
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="buyPrice"
                rules={{
                  required: t("required_field"),
                  min: { value: 0.01, message: t("price_greater_zero") },
                }}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-2">
                      <DollarSign className="w-4 h-4" />
                      {t("buy_price")} ($) *
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
                  required: t("required_field"),
                  min: { value: 0.01, message: t("price_greater_zero") },
                  validate: (value) => {
                    const buyPrice = form.getValues("buyPrice");
                    return (
                      Number(value) >= Number(buyPrice) ||
                      t("sell_price_greater_buy_price")
                    );
                  },
                }}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-2">
                      <DollarSign className="w-4 h-4" />
                      {t("sell_price")} ($) *
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
            </div>

            {/* Quantity and Low Stock */}
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="quantity"
                rules={{
                  min: { value: 0, message: t("quantity_not_negative") },
                }}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("initial_quantity")}</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        placeholder="0"
                        {...field}
                        onChange={(e) =>
                          field.onChange(parseInt(e.target.value) || 0)
                        }
                      />
                    </FormControl>
                    <p className="text-xs text-gray-500 mt-1">
                      Leave as 0 to add inventory later
                    </p>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="lowStockThreshold"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("low_stock_alert_description")}</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        placeholder="5"
                        {...field}
                        onChange={(e) =>
                          field.onChange(parseInt(e.target.value) || 5)
                        }
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
                required: t("required_field"),
                minLength: {
                  value: 10,
                  message: "Description must be at least 10 characters",
                },
              }}
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center gap-2">
                    <FileText className="w-4 h-4" />
                    {t("description")} *
                  </FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder={t("enter_product_description")}
                      {...field}
                      rows={3}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* FIFO Info */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <p className="text-sm text-blue-800">
                <strong>📦 FIFO Note:</strong> If you enter an initial quantity,
                it will create an inventory batch automatically. You can also
                add inventory batches later using the "+" button on the product
                card.
              </p>
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-2 pt-4 border-t">
              <Button type="button" variant="outline" onClick={handleClose}>
                {t("cancel")}
              </Button>
              <Button type="submit">{t("add_product")}</Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};

export default AddProductDialog;
