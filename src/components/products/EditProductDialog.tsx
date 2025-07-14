
import React, { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { useStore, Product } from '@/contexts/StoreContext';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';

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
}

const EditProductDialog: React.FC<EditProductDialogProps> = ({ product, isOpen, onClose }) => {
  const { updateProduct } = useStore();
  const { toast } = useToast();
  
  const form = useForm<ProductFormData>({
    defaultValues: {
      name: product.name,
      category: product.category,
      buyPrice: product.buyPrice,
      sellPrice: product.sellPrice,
      quantity: product.quantity,
      description: product.description,
    },
  });

  useEffect(() => {
    if (product) {
      form.reset({
        name: product.name,
        category: product.category,
        buyPrice: product.buyPrice,
        sellPrice: product.sellPrice,
        quantity: product.quantity,
        description: product.description,
      });
    }
  }, [product, form]);

  const onSubmit = (data: ProductFormData) => {
    try {
      updateProduct(product.id, {
        name: data.name,
        category: data.category,
        buyPrice: Number(data.buyPrice),
        sellPrice: Number(data.sellPrice),
        quantity: Number(data.quantity),
        description: data.description,
      });
      
      toast({
        title: 'Success',
        description: 'Product updated successfully!',
      });
      
      onClose();
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to update product. Please try again.',
        variant: 'destructive',
      });
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Edit Product</DialogTitle>
        </DialogHeader>
        
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              rules={{ required: 'Product name is required' }}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Product Name</FormLabel>
                  <FormControl>
                    <Input placeholder="Enter product name" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="category"
              rules={{ required: 'Category is required' }}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Category</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., Laptops, Accessories" {...field} />
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
                  required: 'Buy price is required',
                  min: { value: 0.01, message: 'Price must be greater than 0' }
                }}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Buy Price ($)</FormLabel>
                    <FormControl>
                      <Input 
                        type="number" 
                        step="0.01" 
                        placeholder="0.00" 
                        {...field}
                        onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
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
                  required: 'Sell price is required',
                  min: { value: 0.01, message: 'Price must be greater than 0' }
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
                        onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
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
                required: 'Quantity is required',
                min: { value: 0, message: 'Quantity cannot be negative' }
              }}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Quantity</FormLabel>
                  <FormControl>
                    <Input 
                      type="number" 
                      placeholder="0" 
                      {...field}
                      onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
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
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Input placeholder="Enter product description" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <div className="flex justify-end gap-2 pt-4">
              <Button type="button" variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button type="submit">Update Product</Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};

export default EditProductDialog;
