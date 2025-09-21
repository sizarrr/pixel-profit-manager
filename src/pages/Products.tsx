import React, { useState } from "react";
import { useStore } from "@/contexts/StoreContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Plus,
  Search,
  Edit,
  Trash2,
  Package,
  AlertTriangle,
  DollarSign,
  Settings,
  Layers,
  TrendingUp,
  Archive,
} from "lucide-react";
import AddProductDialog from "@/components/products/AddProductDialog";
import EditProductDialog from "@/components/products/EditProductDialog";
import BulkOperationsDialog from "@/components/products/BulkOperationsDialog";
import AddInventoryDialog from "@/components/products/AddInventoryDialog";

const Products = () => {
  const { products, deleteProduct, getLowStockProducts } = useStore();
  const { t } = useLanguage();
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [selectedProducts, setSelectedProducts] = useState<string[]>([]);
  const [isBulkDialogOpen, setIsBulkDialogOpen] = useState(false);
  const [inventoryProduct, setInventoryProduct] = useState<{
    id: string;
    name: string;
  } | null>(null);

  const lowStockProducts = getLowStockProducts();
  const categories = Array.from(new Set(products.map((p) => p.category)));

  const filteredProducts = products.filter((product) => {
    const matchesSearch =
      product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      product.category.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (product.barcode &&
        product.barcode.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesCategory =
      categoryFilter === "all" || product.category === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  const handleDeleteProduct = (id: string) => {
    if (window.confirm(t("delete_product_confirm"))) {
      deleteProduct(id);
    }
  };

  const handleSelectProduct = (productId: string, checked: boolean) => {
    if (checked) {
      setSelectedProducts((prev) => [...prev, productId]);
    } else {
      setSelectedProducts((prev) => prev.filter((id) => id !== productId));
    }
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedProducts(filteredProducts.map((p) => p.id));
    } else {
      setSelectedProducts([]);
    }
  };

  const clearSelection = () => {
    setSelectedProducts([]);
  };

  const handleAddInventory = (product: any) => {
    console.log("Opening inventory dialog for product:", product);
    // Use _id as the primary identifier, fallback to id
    const productId = product._id || product.id;
    console.log("Product ID to pass:", productId);
    setInventoryProduct({ id: productId, name: product.name });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">{t("products")}</h1>
          <p className="text-gray-600">
            {t("manage_inventory")} - FIFO System Enabled
          </p>
        </div>
        <div className="flex items-center gap-2">
          {selectedProducts.length > 0 && (
            <Button
              variant="outline"
              onClick={() => setIsBulkDialogOpen(true)}
              className="flex items-center gap-2"
            >
              <Settings className="w-4 h-4" />
              {t("bulk_actions")} ({selectedProducts.length})
            </Button>
          )}
          <Button
            onClick={() => setIsAddDialogOpen(true)}
            className="flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            {t("add_product")}
          </Button>
        </div>
      </div>

      {/* FIFO System Info */}
      <Card className="border-blue-200 bg-blue-50">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <Layers className="w-5 h-5 text-blue-600 mt-0.5" />
            <div>
              <h4 className="font-semibold text-blue-900 mb-1">
                FIFO Inventory System
              </h4>
              <p className="text-sm text-blue-700 mb-2">
                Your store uses First-In-First-Out inventory management for
                accurate cost tracking and profit calculations.
              </p>
              <div className="flex flex-wrap gap-2 text-xs text-blue-600">
                <span>• Automatic batch tracking</span>
                <span>• Accurate profit margins</span>
                <span>• Expiration management</span>
                <span>• Cost per sale precision</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Low Stock Alert */}
      {lowStockProducts.length > 0 && (
        <Card className="border-orange-200 bg-orange-50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-orange-800">
              <AlertTriangle className="w-5 h-5" />
              {t("low_stock_alert")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-orange-700 mb-3">
              {lowStockProducts.length} {t("items_low_stock")}:
            </p>
            <div className="flex flex-wrap gap-2">
              {lowStockProducts.map((product) => (
                <Badge
                  key={product.id}
                  variant="outline"
                  className="text-orange-700 border-orange-300"
                >
                  {product.name} ({product.quantity} {t("left")})
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Filters */}
      <Card>
        <CardContent className="p-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                <Input
                  placeholder={`${t("search")} ${t(
                    "products"
                  ).toLowerCase()}...`}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">{t("all_categories")}</option>
              {categories.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
          </div>
        </CardContent>
      </Card>

      {/* Bulk Selection Header */}
      {filteredProducts.length > 0 && (
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Checkbox
                  checked={
                    selectedProducts.length === filteredProducts.length &&
                    filteredProducts.length > 0
                  }
                  onCheckedChange={handleSelectAll}
                />
                <span className="text-sm font-medium">
                  {t("select_all_products")} ({filteredProducts.length})
                </span>
                {selectedProducts.length > 0 && (
                  <span className="text-sm text-gray-600">
                    - {selectedProducts.length} {t("selected")}
                  </span>
                )}
              </div>
              {selectedProducts.length > 0 && (
                <Button variant="ghost" size="sm" onClick={clearSelection}>
                  {t("clear_selection")}
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Products Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {filteredProducts.map((product) => (
          <Card
            key={product.id}
            className={`hover:shadow-lg transition-shadow ${
              selectedProducts.includes(product.id)
                ? "ring-2 ring-blue-500"
                : ""
            }`}
          >
            <CardHeader className="pb-3">
              <div className="flex justify-between items-start">
                <div className="flex items-start gap-3">
                  <Checkbox
                    checked={selectedProducts.includes(product.id)}
                    onCheckedChange={(checked) =>
                      handleSelectProduct(product.id, checked as boolean)
                    }
                  />
                  <div className="flex-1">
                    <CardTitle className="text-lg font-semibold text-gray-900 line-clamp-2">
                      {product.name}
                    </CardTitle>
                    <Badge variant="secondary" className="mt-1">
                      {product.category}
                    </Badge>
                    {product.barcode && (
                      <div className="mt-1">
                        <Badge variant="outline" className="text-xs font-mono">
                          {product.barcode}
                        </Badge>
                      </div>
                    )}
                  </div>
                  <div className="flex gap-1 ml-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleAddInventory(product)}
                      className="p-1 h-8 w-8 text-green-600 hover:text-green-700"
                      title="Add Inventory Batch"
                    >
                      <Plus className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setEditingProduct(product)}
                      className="p-1 h-8 w-8"
                    >
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDeleteProduct(product.id)}
                      className="p-1 h-8 w-8 text-red-600 hover:text-red-700"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <p className="text-sm text-gray-600 line-clamp-2">
                  {product.description}
                </p>

                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-1">
                    <Package className="w-4 h-4 text-gray-500" />
                    <span
                      className={`text-sm font-medium ${
                        product.quantity <= product.lowStockThreshold
                          ? "text-red-600"
                          : "text-gray-700"
                      }`}
                    >
                      {product.quantity} {t("in_stock")}
                    </span>
                  </div>
                  {product.quantity <= product.lowStockThreshold && (
                    <Badge
                      variant="outline"
                      className="text-red-600 border-red-300"
                    >
                      {t("low_stock")}
                    </Badge>
                  )}
                </div>

                <div className="pt-2 border-t">
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="text-xs text-gray-500">
                        {product.currentBuyPrice !== undefined
                          ? "Avg Buy Price"
                          : t("buy_price")}
                      </p>
                      <p className="font-medium">
                        $
                        {(product.currentBuyPrice || product.buyPrice).toFixed(
                          2
                        )}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-gray-500">
                        {product.currentSellPrice !== undefined
                          ? "Avg Sell Price"
                          : t("sell_price")}
                      </p>
                      <p className="font-bold text-green-600 flex items-center gap-1">
                        <DollarSign className="w-3 h-3" />
                        {(
                          product.currentSellPrice || product.sellPrice
                        ).toFixed(2)}
                      </p>
                    </div>
                  </div>
                  <div className="mt-2 text-center">
                    <p className="text-xs text-gray-500">
                      {t("profit_per_unit")}
                    </p>
                    <p className="text-sm font-medium text-blue-600">
                      $
                      {(
                        (product.currentSellPrice || product.sellPrice) -
                        (product.currentBuyPrice || product.buyPrice)
                      ).toFixed(2)}
                    </p>
                  </div>
                </div>

                {/* FIFO Indicator */}
                <div className="pt-2 border-t">
                  <div className="flex items-center justify-between text-xs text-gray-500">
                    <div className="flex items-center gap-1">
                      <Layers className="w-3 h-3" />
                      <span>FIFO Tracked</span>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleAddInventory(product)}
                      className="text-xs text-green-600 hover:text-green-700 p-1 h-6"
                    >
                      + Add Stock
                    </Button>
                  </div>
                </div>
              </div>
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
            <p className="text-gray-500 mb-4">
              {searchTerm || categoryFilter !== "all"
                ? t("adjust_search")
                : t("add_first_product")}
            </p>
            {!searchTerm && categoryFilter === "all" && (
              <Button
                onClick={() => setIsAddDialogOpen(true)}
                className="flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                {t("add_product")}
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {/* Dialogs */}
      <AddProductDialog
        isOpen={isAddDialogOpen}
        onClose={() => setIsAddDialogOpen(false)}
      />
      {editingProduct && (
        <EditProductDialog
          product={editingProduct}
          isOpen={!!editingProduct}
          onClose={() => setEditingProduct(null)}
        />
      )}
      <BulkOperationsDialog
        isOpen={isBulkDialogOpen}
        onClose={() => setIsBulkDialogOpen(false)}
        selectedProducts={selectedProducts}
        onClearSelection={clearSelection}
      />
      {inventoryProduct && (
        <AddInventoryDialog
          isOpen={!!inventoryProduct}
          onClose={() => setInventoryProduct(null)}
          productId={inventoryProduct.id}
          productName={inventoryProduct.name}
        />
      )}
    </div>
  );
};

export default Products;
