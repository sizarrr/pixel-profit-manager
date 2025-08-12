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
  const { products, deleteProduct, updateProduct, refreshData } = useStore();
  const { t } = useLanguage();
  const { toast } = useToast();

  const [operation, setOperation] = useState<"delete" | "update">("update");
  const [bulkUpdateData, setBulkUpdateData] = useState<BulkUpdateData>({});
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  // Safety check: ensure products is an array
  const safeProducts = Array.isArray(products) ? products : [];
  const selectedProductDetails = safeProducts.filter((p) =>
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

    setIsProcessing(true);
    let successCount = 0;
    let failCount = 0;

    try {
      // Process deletions with proper error handling
      for (const productId of selectedProducts) {
        try {
          await deleteProduct(productId);
          successCount++;
        } catch (error) {
          console.error(`Failed to delete product ${productId}:`, error);
          failCount++;
        }
      }

      // Show results
      if (successCount > 0) {
        toast({
          title: t("success"),
          description: `Successfully deleted ${successCount} product${
            successCount > 1 ? "s" : ""
          }${failCount > 0 ? `. ${failCount} failed.` : ""}`,
        });
      }

      if (failCount > 0 && successCount === 0) {
        toast({
          title: t("error"),
          description: `Failed to delete ${failCount} product${
            failCount > 1 ? "s" : ""
          }`,
          variant: "destructive",
        });
      }

      // Always refresh data and clear selection
      await refreshData();
      onClearSelection();
      onClose();
    } catch (error) {
      toast({
        title: t("error"),
        description: "An unexpected error occurred during bulk delete",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleBulkUpdate = async () => {
    // Validate that at least one field is being updated
    const hasUpdates = Object.values(bulkUpdateData).some(
      (value) => value !== undefined && value !== null && value !== ""
    );

    if (!hasUpdates) {
      toast({
        title: t("error"),
        description: "Please specify at least one field to update",
        variant: "destructive",
      });
      return;
    }

    setIsProcessing(true);
    let successCount = 0;
    let failCount = 0;

    try {
      for (const productId of selectedProducts) {
        try {
          const product = safeProducts.find((p) => p.id === productId);
          if (!product) {
            failCount++;
            continue;
          }

          const updateData: any = {};

          if (bulkUpdateData.category?.trim()) {
            updateData.category = bulkUpdateData.category.trim();
          }

          if (
            bulkUpdateData.buyPriceMultiplier &&
            bulkUpdateData.buyPriceMultiplier > 0
          ) {
            updateData.buyPrice =
              Math.round(
                product.buyPrice * bulkUpdateData.buyPriceMultiplier * 100
              ) / 100;
          }

          if (
            bulkUpdateData.sellPriceMultiplier &&
            bulkUpdateData.sellPriceMultiplier > 0
          ) {
            updateData.sellPrice =
              Math.round(
                product.sellPrice * bulkUpdateData.sellPriceMultiplier * 100
              ) / 100;
          }

          if (
            bulkUpdateData.lowStockThreshold !== undefined &&
            bulkUpdateData.lowStockThreshold >= 0
          ) {
            updateData.lowStockThreshold = bulkUpdateData.lowStockThreshold;
          }

          // Validate sell price vs buy price
          const finalBuyPrice = updateData.buyPrice || product.buyPrice;
          const finalSellPrice = updateData.sellPrice || product.sellPrice;

          if (finalSellPrice < finalBuyPrice) {
            console.error(
              `Sell price (${finalSellPrice}) cannot be less than buy price (${finalBuyPrice}) for product ${product.name}`
            );
            failCount++;
            continue;
          }

          await updateProduct(productId, updateData);
          successCount++;
        } catch (error) {
          console.error(`Failed to update product ${productId}:`, error);
          failCount++;
        }
      }

      // Show results
      if (successCount > 0) {
        toast({
          title: t("success"),
          description: `Successfully updated ${successCount} product${
            successCount > 1 ? "s" : ""
          }${failCount > 0 ? `. ${failCount} failed.` : ""}`,
        });
      }

      if (failCount > 0 && successCount === 0) {
        toast({
          title: t("error"),
          description: `Failed to update ${failCount} product${
            failCount > 1 ? "s" : ""
          }`,
          variant: "destructive",
        });
      }

      // Always refresh data and clear selection
      await refreshData();
      onClearSelection();
      onClose();
    } catch (error) {
      toast({
        title: t("error"),
        description: "An unexpected error occurred during bulk update",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>
            Bulk Operations - {selectedProducts.length} Product
            {selectedProducts.length > 1 ? "s" : ""} Selected
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Operation Type Selection */}
          <div className="flex gap-4">
            <Button
              variant={operation === "update" ? "default" : "outline"}
              onClick={() => setOperation("update")}
              disabled={isProcessing}
              className="flex items-center gap-2"
            >
              <Edit className="w-4 h-4" />
              Bulk Update
            </Button>
            <Button
              variant={operation === "delete" ? "destructive" : "outline"}
              onClick={() => setOperation("delete")}
              disabled={isProcessing}
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
                {selectedProductDetails.length > 0 ? (
                  selectedProductDetails.map((product) => (
                    <div key={product.id} className="text-sm text-gray-600">
                      {product.name} - {product.category} (${product.sellPrice})
                    </div>
                  ))
                ) : (
                  <div className="text-sm text-gray-400">No products found</div>
                )}
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
                    disabled={isProcessing}
                  />
                </div>

                <div>
                  <Label htmlFor="lowStockThreshold">Low Stock Threshold</Label>
                  <Input
                    id="lowStockThreshold"
                    type="number"
                    min="0"
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
                    disabled={isProcessing}
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
                    min="0.01"
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
                    disabled={isProcessing}
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
                    min="0.01"
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
                    disabled={isProcessing}
                  />
                </div>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <p className="text-blue-800 text-sm">
                  💡 <strong>Tip:</strong> Price multipliers will be applied to
                  existing prices. For example, 1.1 increases prices by 10%, 0.9
                  decreases by 10%.
                </p>
              </div>
            </div>
          )}

          {operation === "delete" && (
            <div className="space-y-4">
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <h4 className="font-medium text-red-800 mb-2">
                  ⚠️ Soft Delete Warning
                </h4>
                <p className="text-red-700 text-sm mb-3">
                  This will mark {selectedProducts.length} product
                  {selectedProducts.length > 1 ? "s" : ""} as inactive. They
                  will be hidden from normal views but can be restored later.
                </p>

                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="confirmDelete"
                    checked={confirmDelete}
                    onCheckedChange={(checked) =>
                      setConfirmDelete(checked === true)
                    }
                    disabled={isProcessing}
                  />
                  <Label
                    htmlFor="confirmDelete"
                    className="text-red-700 text-sm"
                  >
                    I understand this will deactivate the selected products
                  </Label>
                </div>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex justify-end gap-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isProcessing}
            >
              Cancel
            </Button>
            {operation === "update" && (
              <Button onClick={handleBulkUpdate} disabled={isProcessing}>
                {isProcessing
                  ? "Updating..."
                  : `Update ${selectedProducts.length} Product${
                      selectedProducts.length > 1 ? "s" : ""
                    }`}
              </Button>
            )}
            {operation === "delete" && (
              <Button
                variant="destructive"
                onClick={handleBulkDelete}
                disabled={!confirmDelete || isProcessing}
              >
                {isProcessing
                  ? "Deleting..."
                  : `Delete ${selectedProducts.length} Product${
                      selectedProducts.length > 1 ? "s" : ""
                    }`}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default BulkOperationsDialog;
