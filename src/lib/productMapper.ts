// Product field mapping utilities
// Maps between backend (FIFO-based) and frontend (legacy) field names

export interface BackendProduct {
  _id: string;
  name: string;
  category: string;
  currentBuyPrice: number;
  currentSellPrice: number;
  totalQuantity: number;
  description?: string;
  barcode?: string;
  lowStockThreshold: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  isLowStock?: boolean;
  needsReorder?: boolean;
}

export interface FrontendProduct {
  _id: string;
  name: string;
  category: string;
  buyPrice: number;
  sellPrice: number;
  quantity: number;
  description?: string;
  barcode?: string;
  lowStockThreshold: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  isLowStock?: boolean;
}

// Map backend product to frontend format
export function mapBackendToFrontend(backendProduct: any): FrontendProduct {
  // If backend already has compatibility fields, use them
  return {
    _id: backendProduct._id,
    name: backendProduct.name,
    category: backendProduct.category,
    buyPrice: backendProduct.buyPrice || backendProduct.currentBuyPrice || 0,
    sellPrice: backendProduct.sellPrice || backendProduct.currentSellPrice || 0,
    quantity: backendProduct.quantity || backendProduct.totalQuantity || 0,
    description: backendProduct.description,
    barcode: backendProduct.barcode,
    lowStockThreshold: backendProduct.lowStockThreshold,
    isActive: backendProduct.isActive,
    createdAt: backendProduct.createdAt,
    updatedAt: backendProduct.updatedAt,
    isLowStock: backendProduct.isLowStock
  };
}

// Map frontend product data to backend format for creation/update
export function mapFrontendToBackend(frontendProduct: Partial<FrontendProduct>): any {
  const mapped: any = {};
  
  if (frontendProduct.name !== undefined) mapped.name = frontendProduct.name;
  if (frontendProduct.category !== undefined) mapped.category = frontendProduct.category;
  if (frontendProduct.description !== undefined) mapped.description = frontendProduct.description;
  if (frontendProduct.barcode !== undefined) mapped.barcode = frontendProduct.barcode;
  if (frontendProduct.lowStockThreshold !== undefined) mapped.lowStockThreshold = frontendProduct.lowStockThreshold;
  if (frontendProduct.isActive !== undefined) mapped.isActive = frontendProduct.isActive;
  
  // Pass through legacy fields for backend to handle
  if (frontendProduct.buyPrice !== undefined) mapped.buyPrice = frontendProduct.buyPrice;
  if (frontendProduct.sellPrice !== undefined) mapped.sellPrice = frontendProduct.sellPrice;
  if (frontendProduct.quantity !== undefined) mapped.quantity = frontendProduct.quantity;
  
  return mapped;
}

// Map array of backend products to frontend format
export function mapBackendProductsToFrontend(backendProducts: BackendProduct[]): FrontendProduct[] {
  return backendProducts.map(mapBackendToFrontend);
}