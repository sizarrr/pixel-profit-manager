import Product from "../models/Product.js";
import InventoryBatch from "../models/InventoryBatch.js";
import { catchAsync, AppError } from "../middleware/errorHandler.js";
import config from "../config/config.js";
import mongoose from "mongoose";

// Helper function to parse sort parameter
const parseSort = (sortStr) => {
  const sortObj = {};
  if (sortStr.startsWith("-")) {
    sortObj[sortStr.slice(1)] = -1;
  } else {
    sortObj[sortStr] = 1;
  }
  return sortObj;
};

// Get all products with filtering, sorting, and pagination
export const getAllProducts = catchAsync(async (req, res, next) => {
  const {
    page = 1,
    limit = config.defaultPageSize,
    category,
    search,
    barcode,
    sort = "-createdAt",
    lowStock,
  } = req.query;

  // Build filter object
  const filter = { isActive: true };

  if (category) {
    filter.category = new RegExp(category, "i");
  }

  // Enhanced search to prioritize barcode
  if (search) {
    // Check if search term looks like a barcode (numeric and long)
    const isBarcodeLike = /^\d{8,}$/.test(search.trim());

    if (isBarcodeLike) {
      // Prioritize exact barcode match
      filter.$or = [
        { barcode: search.trim() },
        { name: new RegExp(search, "i") },
        { description: new RegExp(search, "i") },
        { category: new RegExp(search, "i") },
      ];
    } else {
      filter.$or = [
        { name: new RegExp(search, "i") },
        { description: new RegExp(search, "i") },
        { category: new RegExp(search, "i") },
        { barcode: new RegExp(search, "i") },
      ];
    }
  }

  // Direct barcode search
  if (barcode) {
    filter.barcode = barcode.trim();
  }

  if (lowStock === "true") {
    filter.$expr = { $lte: ["$quantity", "$lowStockThreshold"] };
  }

  // Calculate pagination
  const skip = (page - 1) * limit;
  const limitNum = Math.min(limit, config.maxPageSize);

  // Execute query with special handling for barcode search
  let query = Product.find(filter);

  // If searching by barcode-like term, sort by barcode match first
  if (search && /^\d{8,}$/.test(search.trim())) {
    // Create a custom sort that prioritizes exact barcode matches
    const barcodeSort = {
      $cond: [{ $eq: ["$barcode", search.trim()] }, 0, 1],
    };

    const products = await Product.aggregate([
      { $match: filter },
      {
        $addFields: {
          barcodeMatchPriority: barcodeSort,
        },
      },
      { $sort: { barcodeMatchPriority: 1, ...parseSort(sort) } },
      { $skip: skip },
      { $limit: limitNum },
    ]);

    const total = await Product.countDocuments(filter);
    const totalPages = Math.ceil(total / limitNum);

    return res.status(200).json({
      status: "success",
      results: products.length,
      pagination: {
        currentPage: parseInt(page),
        totalPages,
        totalItems: total,
        itemsPerPage: limitNum,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
      data: {
        products,
      },
    });
  } else {
    query = query.sort(sort);
  }

  const products = await query.skip(skip).limit(limitNum).lean();

  // Get total count for pagination
  const total = await Product.countDocuments(filter);
  const totalPages = Math.ceil(total / limitNum);

  res.status(200).json({
    status: "success",
    results: products.length,
    pagination: {
      currentPage: parseInt(page),
      totalPages,
      totalItems: total,
      itemsPerPage: limitNum,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1,
    },
    data: {
      products,
    },
  });
});

// Get single product by ID
export const getProduct = catchAsync(async (req, res, next) => {
  // Validate ObjectId format
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
    return next(new AppError("Invalid product ID format", 400));
  }

  const product = await Product.findById(req.params.id);

  if (!product || !product.isActive) {
    return next(new AppError("Product not found", 404));
  }

  res.status(200).json({
    status: "success",
    data: {
      product,
    },
  });
});

// Get product by barcode
export const getProductByBarcode = catchAsync(async (req, res, next) => {
  const { barcode } = req.params;

  if (!barcode || barcode.trim() === "") {
    return next(new AppError("Barcode is required", 400));
  }

  const product = await Product.findOne({
    barcode: barcode.trim(),
    isActive: true,
  });

  if (!product) {
    return next(new AppError("Product not found", 404));
  }

  res.status(200).json({
    status: "success",
    data: {
      product,
    },
  });
});

// Create new product
export const createProduct = catchAsync(async (req, res, next) => {
  try {
    // Extract legacy fields that will be used for initial batch
    const { buyPrice, sellPrice, quantity, ...productData } = req.body;
    
    // Set default low stock threshold
    productData.lowStockThreshold = productData.lowStockThreshold || config.defaultLowStockThreshold;

    // Enhanced barcode validation
    if (productData.barcode) {
      const trimmedBarcode = productData.barcode.toString().trim();

      if (trimmedBarcode === "") {
        return next(
          new AppError("Barcode cannot be empty or just whitespace", 400)
        );
      }

      const existingProduct = await Product.findOne({
        barcode: trimmedBarcode,
        isActive: true,
      });

      if (existingProduct) {
        return next(
          new AppError("Product with this barcode already exists", 400)
        );
      }

      productData.barcode = trimmedBarcode;
    }

    // Validate prices if provided
    let initialBuyPrice = 0;
    let initialSellPrice = 0;
    let initialQuantity = 0;
    
    if (buyPrice !== undefined || sellPrice !== undefined) {
      initialBuyPrice = parseFloat(buyPrice || 0);
      initialSellPrice = parseFloat(sellPrice || 0);

      if (isNaN(initialBuyPrice) || isNaN(initialSellPrice)) {
        return next(new AppError("Invalid price values", 400));
      }

      if (initialSellPrice < initialBuyPrice) {
        return next(
          new AppError(
            "Sell price must be greater than or equal to buy price",
            400
          )
        );
      }
    }
    
    if (quantity !== undefined) {
      initialQuantity = parseInt(quantity || 0);
      if (isNaN(initialQuantity) || initialQuantity < 0) {
        return next(new AppError("Invalid quantity value", 400));
      }
    }

    // Set initial values if provided
    if (initialBuyPrice > 0) {
      productData.currentBuyPrice = initialBuyPrice;
    }
    if (initialSellPrice > 0) {
      productData.currentSellPrice = initialSellPrice;
    }
    if (initialQuantity > 0) {
      productData.totalQuantity = initialQuantity;
    }

    // Create the product first
    const product = await Product.create(productData);

    // If initial stock is provided, create an inventory batch
    console.log("Initial values:", { initialQuantity, initialBuyPrice, initialSellPrice });
    if (initialQuantity > 0 && initialBuyPrice > 0) {
      console.log("Creating inventory batch for new product...");
      try {
        const batch = await InventoryBatch.create({
          productId: product._id,
          buyPrice: initialBuyPrice,
          sellPrice: initialSellPrice,
          initialQuantity: initialQuantity,
          remainingQuantity: initialQuantity,
          purchaseDate: new Date(),
          supplierName: "Initial Stock",
          notes: "Initial inventory when product was created",
        });
        console.log("Inventory batch created:", batch.batchNumber);

        // Update product with calculated fields from batch
        await product.updateFromBatches();
        console.log("Product updated from batches");
      } catch (batchError) {
        console.error("Error creating inventory batch:", batchError);
        // Don't fail the product creation, just log the error
      }
    } else {
      console.log("Skipping batch creation - no initial stock or price");
    }

    // Reload the product to get updated fields
    const updatedProduct = await Product.findById(product._id);

    res.status(201).json({
      status: "success",
      data: {
        product: updatedProduct,
      },
    });
  } catch (error) {
    console.error("Product creation error:", error);

    // Handle specific MongoDB errors
    if (error.name === "ValidationError") {
      const message = Object.values(error.errors)
        .map((err) => err.message)
        .join(", ");
      return next(new AppError(`Validation Error: ${message}`, 400));
    }

    if (error.code === 11000) {
      return next(
        new AppError("Product with this barcode already exists", 400)
      );
    }

    return next(new AppError("Failed to create product", 500));
  }
});

// COMPLETELY REWRITTEN Update product function
// FIXED updateProduct function with corrected price validation
export const updateProduct = catchAsync(async (req, res, next) => {
  console.log("=== UPDATE PRODUCT START ===");
  console.log("Product ID:", req.params.id);
  console.log("Raw Request Body:", JSON.stringify(req.body, null, 2));

  try {
    // 1. Validate ObjectId format first
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      console.log("❌ Invalid ObjectId format");
      return next(new AppError("Invalid product ID format", 400));
    }

    // 2. Find existing product
    const existingProduct = await Product.findById(req.params.id);
    console.log("Existing product found:", !!existingProduct);

    if (!existingProduct) {
      console.log("❌ Product not found");
      return next(new AppError("Product not found", 404));
    }

    if (!existingProduct.isActive) {
      console.log("❌ Product is not active");
      return next(new AppError("Product not found", 404));
    }

    console.log("✅ Existing product:", {
      id: existingProduct._id,
      name: existingProduct.name,
      buyPrice: existingProduct.buyPrice,
      sellPrice: existingProduct.sellPrice,
      barcode: existingProduct.barcode,
    });

    // 3. Build update data - ONLY include fields that are actually changing
    const updateData = {};

    // List of fields that can be updated
    const allowedFields = [
      "name",
      "category",
      "buyPrice",
      "sellPrice",
      "quantity",
      "description",
      "image",
      "barcode",
      "lowStockThreshold",
    ];

    // Only add fields that are present and different
    allowedFields.forEach((field) => {
      if (req.body.hasOwnProperty(field)) {
        const newValue = req.body[field];
        const oldValue = existingProduct[field];

        // Handle different field types appropriately
        if (field === "buyPrice" || field === "sellPrice") {
          const newNum = parseFloat(newValue);
          const oldNum = parseFloat(oldValue);
          if (!isNaN(newNum) && newNum !== oldNum) {
            updateData[field] = newNum;
          }
        } else if (field === "quantity" || field === "lowStockThreshold") {
          const newNum = parseInt(newValue);
          const oldNum = parseInt(oldValue);
          if (!isNaN(newNum) && newNum !== oldNum) {
            updateData[field] = newNum;
          }
        } else if (field === "barcode") {
          // Special handling for barcode
          const newBarcode =
            newValue === null || newValue === ""
              ? null
              : String(newValue).trim();
          if (newBarcode !== oldValue) {
            updateData[field] = newBarcode;
          }
        } else {
          // String fields
          const newStr = newValue === null ? null : String(newValue).trim();
          if (newStr !== oldValue) {
            updateData[field] = newStr;
          }
        }
      }
    });

    console.log("📝 Fields to update:", Object.keys(updateData));
    console.log("📝 Update data:", updateData);

    // 4. Validate barcode if it's being changed
    if (updateData.hasOwnProperty("barcode")) {
      console.log("🔍 Validating barcode change...");

      if (updateData.barcode === null || updateData.barcode === "") {
        console.log("✅ Removing barcode (set to null)");
        updateData.barcode = null;
      } else {
        const trimmedBarcode = String(updateData.barcode).trim();

        if (trimmedBarcode === "") {
          console.log("❌ Barcode cannot be just whitespace");
          return next(
            new AppError("Barcode cannot be empty or just whitespace", 400)
          );
        }

        // Check for barcode uniqueness only if it's different from current
        if (trimmedBarcode !== existingProduct.barcode) {
          console.log("🔍 Checking barcode uniqueness for:", trimmedBarcode);

          const duplicateProduct = await Product.findOne({
            barcode: trimmedBarcode,
            isActive: true,
            _id: { $ne: req.params.id },
          });

          if (duplicateProduct) {
            console.log("❌ Duplicate barcode found");
            return next(
              new AppError("Product with this barcode already exists", 400)
            );
          }
        }

        updateData.barcode = trimmedBarcode;
      }
    }

    // 5. FIXED PRICE VALIDATION - Ensure proper type handling
    let finalBuyPrice, finalSellPrice;

    // Determine final prices after update
    if (updateData.hasOwnProperty("buyPrice")) {
      finalBuyPrice = parseFloat(updateData.buyPrice);
    } else {
      finalBuyPrice = parseFloat(existingProduct.buyPrice);
    }

    if (updateData.hasOwnProperty("sellPrice")) {
      finalSellPrice = parseFloat(updateData.sellPrice);
    } else {
      finalSellPrice = parseFloat(existingProduct.sellPrice);
    }

    console.log("💰 Price validation:");
    console.log("  - Final buy price:", finalBuyPrice, typeof finalBuyPrice);
    console.log("  - Final sell price:", finalSellPrice, typeof finalSellPrice);

    // Validate that prices are numbers
    if (isNaN(finalBuyPrice) || isNaN(finalSellPrice)) {
      console.log("❌ Invalid price values - NaN detected");
      console.log("  - finalBuyPrice isNaN:", isNaN(finalBuyPrice));
      console.log("  - finalSellPrice isNaN:", isNaN(finalSellPrice));
      return next(new AppError("Invalid price values", 400));
    }

    // Validate price relationship
    if (finalSellPrice < finalBuyPrice) {
      console.log("❌ Sell price lower than buy price");
      console.log(`  - Sell: $${finalSellPrice}, Buy: $${finalBuyPrice}`);
      return next(
        new AppError(
          `Sell price ($${finalSellPrice}) must be greater than or equal to buy price ($${finalBuyPrice})`,
          400
        )
      );
    }

    console.log("✅ Price validation passed");

    // 6. Validate quantity if being updated
    if (updateData.hasOwnProperty("quantity")) {
      const quantity = parseInt(updateData.quantity);
      if (isNaN(quantity) || quantity < 0) {
        console.log("❌ Invalid quantity");
        return next(
          new AppError("Quantity must be a non-negative number", 400)
        );
      }
    }

    // 7. If no fields to update, return current product
    if (Object.keys(updateData).length === 0) {
      console.log("⚠️ No fields to update");
      return res.status(200).json({
        status: "success",
        data: {
          product: existingProduct,
        },
      });
    }

    // 8.a Ensure legacy stock (pre-batch) is captured as an initial batch
    const existingActiveQty = await InventoryBatch.getTotalAvailableQuantity(
      existingProduct._id
    );
    if (existingActiveQty === 0 && Number(existingProduct.quantity) > 0) {
      console.log(
        "🧭 Capturing legacy stock into initial batch to enable FIFO"
      );
      await InventoryBatch.create({
        productId: existingProduct._id,
        buyPrice: parseFloat(existingProduct.buyPrice),
        initialQuantity: Number(existingProduct.quantity),
        remainingQuantity: Number(existingProduct.quantity),
        purchaseDate:
          existingProduct.createdAt || new Date(Date.now() - 24 * 3600 * 1000),
        supplierName: "Legacy stock import",
        notes: "Auto-created from existing product.quantity to initialize FIFO",
      });
    }

    // 8.b If quantity is being increased, create an inventory batch instead of direct set
    let updatedProduct;
    const isQuantityProvided = updateData.hasOwnProperty("quantity");
    if (isQuantityProvided) {
      const newQuantity = parseInt(updateData.quantity);
      delete updateData.quantity; // prevent direct quantity mutation

      if (newQuantity > existingProduct.quantity) {
        const quantityToAdd = newQuantity - existingProduct.quantity;
        console.log(
          "📦 Detected restock. Creating inventory batch for +",
          quantityToAdd
        );

        // Determine buyPrice to use for this new batch
        const batchBuyPrice = updateData.hasOwnProperty("buyPrice")
          ? parseFloat(updateData.buyPrice)
          : parseFloat(existingProduct.buyPrice);

        // Create inventory batch to honor FIFO
        await InventoryBatch.create({
          productId: existingProduct._id,
          batchNumber: undefined, // auto-generate
          buyPrice: batchBuyPrice,
          initialQuantity: quantityToAdd,
          remainingQuantity: quantityToAdd,
          purchaseDate: new Date(),
          supplierName: "Manual restock via product update",
          notes: "Auto-generated to preserve FIFO",
        });

        // Recompute product quantity from batches after restock
        await Product.updateQuantityFromBatches(existingProduct._id);
      } else if (newQuantity < existingProduct.quantity) {
        console.log(
          "⚠️ Quantity decrease requested. Ignoring direct decrease to protect FIFO; quantities are derived from batches."
        );
      }
    }

    // Perform the remaining updates (name, prices, etc.)
    console.log("🚀 Performing database update...");

    updatedProduct = await Product.findByIdAndUpdate(
      req.params.id,
      updateData,
      {
        new: true,
        runValidators: true,
      }
    );

    if (!updatedProduct) {
      console.log("❌ Product not found after update");
      return next(new AppError("Product not found", 404));
    }

    console.log("✅ Product updated successfully");

    // 9. After any potential restock, ensure quantity is in sync with batches
    await Product.updateQuantityFromBatches(updatedProduct._id);

    // 10. Return success response
    res.status(200).json({
      status: "success",
      data: {
        product: updatedProduct,
      },
    });
  } catch (error) {
    console.error("=== PRODUCT UPDATE ERROR ===");
    console.error("Error:", error);

    // Handle specific errors
    if (error.name === "ValidationError") {
      const messages = Object.values(error.errors).map((err) => err.message);
      console.log("❌ Validation errors:", messages);
      return next(
        new AppError(`Validation Error: ${messages.join(", ")}`, 400)
      );
    }

    if (error.name === "MongoServerError" && error.code === 11000) {
      console.log("❌ Duplicate key error");
      return next(new AppError("Duplicate field value detected", 400));
    }

    // Generic error
    console.log("❌ Unexpected error");
    return next(new AppError("Failed to update product", 500));
  }
});

// Delete product (soft delete)
export const deleteProduct = catchAsync(async (req, res, next) => {
  // Validate ObjectId format
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
    return next(new AppError("Invalid product ID format", 400));
  }

  const product = await Product.findByIdAndUpdate(
    req.params.id,
    { isActive: false },
    { new: true }
  );

  if (!product) {
    return next(new AppError("Product not found", 404));
  }

  res.status(204).json({
    status: "success",
    data: null,
  });
});

// Get low stock products
export const getLowStockProducts = catchAsync(async (req, res, next) => {
  const products = await Product.find({
    isActive: true,
    $expr: { $lte: ["$quantity", "$lowStockThreshold"] },
  }).sort("quantity");

  res.status(200).json({
    status: "success",
    results: products.length,
    data: {
      products,
    },
  });
});

// Get product categories
export const getCategories = catchAsync(async (req, res, next) => {
  const categories = await Product.distinct("category", { isActive: true });

  res.status(200).json({
    status: "success",
    results: categories.length,
    data: {
      categories: categories.sort(),
    },
  });
});

// Update product quantity (for inventory management)
export const updateQuantity = catchAsync(async (req, res, next) => {
  // Validate ObjectId format
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
    return next(new AppError("Invalid product ID format", 400));
  }

  const { quantity, operation = "set" } = req.body;

  if (!quantity && quantity !== 0) {
    return next(new AppError("Quantity is required", 400));
  }

  let updateOperation;
  if (operation === "add") {
    updateOperation = { $inc: { quantity } };
  } else if (operation === "subtract") {
    updateOperation = { $inc: { quantity: -quantity } };
  } else {
    updateOperation = { quantity };
  }

  const product = await Product.findByIdAndUpdate(
    req.params.id,
    updateOperation,
    {
      new: true,
      runValidators: true,
    }
  );

  if (!product || !product.isActive) {
    return next(new AppError("Product not found", 404));
  }

  if (product.quantity < 0) {
    return next(new AppError("Insufficient stock", 400));
  }

  res.status(200).json({
    status: "success",
    data: {
      product,
    },
  });
});

// Get products statistics
export const getProductStats = catchAsync(async (req, res, next) => {
  const stats = await Product.aggregate([
    {
      $match: { isActive: true },
    },
    {
      $group: {
        _id: null,
        totalProducts: { $sum: 1 },
        totalInventoryValue: {
          $sum: { $multiply: ["$sellPrice", "$quantity"] },
        },
        totalQuantity: { $sum: "$quantity" },
        averagePrice: { $avg: "$sellPrice" },
        lowStockCount: {
          $sum: {
            $cond: [{ $lte: ["$quantity", "$lowStockThreshold"] }, 1, 0],
          },
        },
      },
    },
  ]);

  const categoryStats = await Product.aggregate([
    {
      $match: { isActive: true },
    },
    {
      $group: {
        _id: "$category",
        count: { $sum: 1 },
        totalValue: { $sum: { $multiply: ["$sellPrice", "$quantity"] } },
        totalQuantity: { $sum: "$quantity" },
      },
    },
    {
      $sort: { count: -1 },
    },
  ]);

  res.status(200).json({
    status: "success",
    data: {
      overall: stats[0] || {
        totalProducts: 0,
        totalInventoryValue: 0,
        totalQuantity: 0,
        averagePrice: 0,
        lowStockCount: 0,
      },
      categories: categoryStats,
    },
  });
});

// Search products specifically for barcode lookup
export const searchProducts = catchAsync(async (req, res, next) => {
  const { query } = req.query;

  if (!query) {
    return next(new AppError("Search query is required", 400));
  }

  const filter = { isActive: true };
  const isBarcodeLike = /^\d{8,}$/.test(query.trim());

  if (isBarcodeLike) {
    // Prioritize exact barcode match
    filter.$or = [{ barcode: query.trim() }, { name: new RegExp(query, "i") }];
  } else {
    filter.$or = [
      { name: new RegExp(query, "i") },
      { barcode: new RegExp(query, "i") },
      { description: new RegExp(query, "i") },
      { category: new RegExp(query, "i") },
    ];
  }

  const products = await Product.find(filter)
    .sort(isBarcodeLike ? { barcode: 1 } : { name: 1 })
    .limit(50)
    .lean();

  res.status(200).json({
    status: "success",
    results: products.length,
    data: {
      products,
    },
  });
});
