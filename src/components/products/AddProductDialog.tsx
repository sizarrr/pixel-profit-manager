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
import { useToast } from "@/hooks/use-toast";

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
  description: string;
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
      description: "",
    },
  });

  const onSubmit = async (data: ProductFormData) => {
    console.log("Form submitted:", data);
    try {
      await addProduct({
        name: data.name,
        category: data.category,
        buyPrice: Number(data.buyPrice),
        sellPrice: Number(data.sellPrice),
        quantity: Number(data.quantity),
        description: data.description,
        lowStockThreshold: 1, // You may want to set this dynamically or add a field for it
      });

      toast({
        title: t("success"),
        description: t("product_added_success"),
      });

      form.reset();
      onClose();
    } catch (error) {
      toast({
        title: t("error"),
        description: t("failed_add_product"),
        variant: "destructive",
      });
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{t("add_new_product")}</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              rules={{ required: t("required_field") }}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("product_name")}</FormLabel>
                  <FormControl>
                    <Input placeholder={`${t("product_name")}`} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="category"
              rules={{ required: t("required_field") }}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("category")}</FormLabel>
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
                    <FormLabel>{t("buy_price")} ($)</FormLabel>
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
                }}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("sell_price")} ($)</FormLabel>
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

            <FormField
              control={form.control}
              name="quantity"
              rules={{
                required: t("required_field"),
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
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("description")}</FormLabel>
                  <FormControl>
                    <Input placeholder={t("description")} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-2 pt-4">
              <Button type="button" variant="outline" onClick={onClose}>
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
