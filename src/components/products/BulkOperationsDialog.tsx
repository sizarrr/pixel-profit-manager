import React, { useState } from "react";
import { useStore } from "@/contexts/StoreContext";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Trash2, Edit, Package } from "lucide-react";

interface BulkOperationsDialogProps {
  isOpen: boolean;
  onClose: () => void;
  selectedProducts: string[];
  onClearSelection: () => void;
}

interface BulkUpdateData {
  category?: string;
  buyPriceMultiplier?: number;
  sellPriceMultiplier?: number;
  lowStockThreshold?: number;
}

const BulkOperationsDialog: React.FC<BulkOperationsDialogProps> = ({
  isOpen,
  onClose,
  selectedProducts,
  onClearSelection,
}) => {
  const { products, deleteProduct, updateProduct } = useStore();
  const { t } = useLanguage();
  const { toast } = useToast();

  const [operation, setOperation] = useState<"delete" | "update">("update");
  const [bulkUpdateData, setBulkUpdateData] = useState<BulkUpdateData>({});
  const [confirmDelete, setConfirmDelete] = useState(false);

  const selectedProductDetails = products.filter((p) =>
    selectedProducts.includes(p.id)
  );

  const handleBulkDelete = async () => {
    if (!confirmDelete) {
      toast({
        title: t("error"),
        description: "Please confirm the delete operation",
        variant: "destructive",
      });
      return;
    }

    try {
      for (const productId of selectedProducts) {
        await deleteProduct(productId);
      }

      toast({
        title: t("success"),
        description: `Successfully deleted ${selectedProducts.length} products`,
      });

      onClearSelection();
      onClose();
    } catch (error) {
      toast({
        title: t("error"),
        description: "Failed to delete products",
        variant: "destructive",
      });
    }
  };

  const handleBulkUpdate = async () => {
    try {
      for (const productId of selectedProducts) {
        const product = products.find((p) => p.id === productId);
        if (!product) continue;

        const updateData: any = {};

        if (bulkUpdateData.category) {
          updateData.category = bulkUpdateData.category;
        }

        if (bulkUpdateData.buyPriceMultiplier) {
          updateData.buyPrice =
            product.buyPrice * bulkUpdateData.buyPriceMultiplier;
        }

        if (bulkUpdateData.sellPriceMultiplier) {
          updateData.sellPrice =
            product.sellPrice * bulkUpdateData.sellPriceMultiplier;
        }

        if (bulkUpdateData.lowStockThreshold) {
          updateData.lowStockThreshold = bulkUpdateData.lowStockThreshold;
        }

        await updateProduct(productId, updateData);
      }

      toast({
        title: t("success"),
        description: `Successfully updated ${selectedProducts.length} products`,
      });

      onClearSelection();
      onClose();
    } catch (error) {
      toast({
        title: t("error"),
        description: "Failed to update products",
        variant: "destructive",
      });
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>
            Bulk Operations - {selectedProducts.length} Products Selected
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Operation Type Selection */}
          <div className="flex gap-4">
            <Button
              variant={operation === "update" ? "default" : "outline"}
              onClick={() => setOperation("update")}
              className="flex items-center gap-2"
            >
              <Edit className="w-4 h-4" />
              Bulk Update
            </Button>
            <Button
              variant={operation === "delete" ? "destructive" : "outline"}
              onClick={() => setOperation("delete")}
              className="flex items-center gap-2"
            >
              <Trash2 className="w-4 h-4" />
              Bulk Delete
            </Button>
          </div>

          {/* Selected Products Preview */}
          <Card>
            <CardContent className="p-4">
              <h4 className="font-medium mb-2 flex items-center gap-2">
                <Package className="w-4 h-4" />
                Selected Products ({selectedProducts.length})
              </h4>
              <div className="max-h-32 overflow-y-auto space-y-1">
                {selectedProductDetails.map((product) => (
                  <div key={product.id} className="text-sm text-gray-600">
                    {product.name} - {product.category}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Operation Forms */}
          {operation === "update" && (
            <div className="space-y-4">
              <h4 className="font-medium">Update Options</h4>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="category">New Category</Label>
                  <Input
                    id="category"
                    placeholder="Leave empty to keep current"
                    value={bulkUpdateData.category || ""}
                    onChange={(e) =>
                      setBulkUpdateData((prev) => ({
                        ...prev,
                        category: e.target.value,
                      }))
                    }
                  />
                </div>

                <div>
                  <Label htmlFor="lowStockThreshold">Low Stock Threshold</Label>
                  <Input
                    id="lowStockThreshold"
                    type="number"
                    placeholder="Leave empty to keep current"
                    value={bulkUpdateData.lowStockThreshold || ""}
                    onChange={(e) =>
                      setBulkUpdateData((prev) => ({
                        ...prev,
                        lowStockThreshold: e.target.value
                          ? parseInt(e.target.value)
                          : undefined,
                      }))
                    }
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="buyPriceMultiplier">
                    Buy Price Multiplier
                  </Label>
                  <Input
                    id="buyPriceMultiplier"
                    type="number"
                    step="0.01"
                    placeholder="e.g., 1.1 for 10% increase"
                    value={bulkUpdateData.buyPriceMultiplier || ""}
                    onChange={(e) =>
                      setBulkUpdateData((prev) => ({
                        ...prev,
                        buyPriceMultiplier: e.target.value
                          ? parseFloat(e.target.value)
                          : undefined,
                      }))
                    }
                  />
                </div>

                <div>
                  <Label htmlFor="sellPriceMultiplier">
                    Sell Price Multiplier
                  </Label>
                  <Input
                    id="sellPriceMultiplier"
                    type="number"
                    step="0.01"
                    placeholder="e.g., 1.1 for 10% increase"
                    value={bulkUpdateData.sellPriceMultiplier || ""}
                    onChange={(e) =>
                      setBulkUpdateData((prev) => ({
                        ...prev,
                        sellPriceMultiplier: e.target.value
                          ? parseFloat(e.target.value)
                          : undefined,
                      }))
                    }
                  />
                </div>
              </div>
            </div>
          )}

          {operation === "delete" && (
            <div className="space-y-4">
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <h4 className="font-medium text-red-800 mb-2">
                  ⚠️ Permanent Delete Warning
                </h4>
                <p className="text-red-700 text-sm">
                  This will permanently delete {selectedProducts.length}{" "}
                  products. This action cannot be undone.
                </p>

                <div className="flex items-center space-x-2 mt-3">
                  <Checkbox
                    id="confirmDelete"
                    checked={confirmDelete}
                    onCheckedChange={(checked) =>
                      setConfirmDelete(checked === true)
                    }
                  />
                  <Label htmlFor="confirmDelete" className="text-red-700">
                    I understand this action is permanent and cannot be undone
                  </Label>
                </div>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            {operation === "update" && (
              <Button onClick={handleBulkUpdate}>
                Update {selectedProducts.length} Products
              </Button>
            )}
            {operation === "delete" && (
              <Button
                variant="destructive"
                onClick={handleBulkDelete}
                disabled={!confirmDelete}
              >
                Delete {selectedProducts.length} Products
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default BulkOperationsDialog;
