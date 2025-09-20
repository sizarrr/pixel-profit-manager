// backend/controllers/productController.js - FIXED VERSION
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

// Create new product - FIXED VERSION
export const createProduct = catchAsync(async (req, res, next) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const productData = {
      ...req.body,
      lowStockThreshold:
        req.body.lowStockThreshold || config.defaultLowStockThreshold,
    };

    // Enhanced barcode validation
    if (productData.barcode) {
      const trimmedBarcode = productData.barcode.toString().trim();

      if (trimmedBarcode === "") {
        delete productData.barcode; // Remove empty barcode
      } else {
        const existingProduct = await Product.findOne({
          barcode: trimmedBarcode,
          isActive: true,
        });

        if (existingProduct) {
          await session.abortTransaction();
          return next(
            new AppError("Product with this barcode already exists", 400)
          );
        }

        productData.barcode = trimmedBarcode;
      }
    }

    // Validate prices
    if (
      productData.buyPrice !== undefined &&
      productData.sellPrice !== undefined
    ) {
      const buyPrice = parseFloat(productData.buyPrice);
      const sellPrice = parseFloat(productData.sellPrice);

      if (isNaN(buyPrice) || isNaN(sellPrice)) {
        await session.abortTransaction();
        return next(new AppError("Invalid price values", 400));
      }

      if (sellPrice < buyPrice) {
        await session.abortTransaction();
        return next(
          new AppError(
            "Sell price must be greater than or equal to buy price",
            400
          )
        );
      }

      productData.buyPrice = buyPrice;
      productData.sellPrice = sellPrice;
    }

    // Extract initial quantity if provided
    const initialQuantity = productData.quantity || 0;
    delete productData.quantity; // Remove quantity from product data as it will be managed by batches

    // Create the product first
    const product = new Product({
      ...productData,
      quantity: 0, // Start with 0, will be updated from batch
      totalQuantity: 0,
    });

    await product.save({ session });

    console.log("✅ Product created with ID:", product._id);

    // If initial quantity is provided, create an inventory batch
    if (initialQuantity > 0) {
      console.log(
        "📦 Creating initial inventory batch for quantity:",
        initialQuantity
      );

      const batch = new InventoryBatch({
        productId: product._id, // Use the newly created product's _id
        buyPrice: product.buyPrice,
        sellPrice: product.sellPrice,
        initialQuantity: initialQuantity,
        remainingQuantity: initialQuantity,
        supplierName: "Initial Stock",
        invoiceNumber: `INIT-${Date.now()}`,
        notes: "Initial inventory batch created with product",
        purchaseDate: new Date(),
        status: "active",
      });

      await batch.save({ session });

      console.log("✅ Initial batch created with ID:", batch._id);

      // Update product quantity from the batch
      product.quantity = initialQuantity;
      product.totalQuantity = initialQuantity;
      product.currentBuyPrice = product.buyPrice;
      product.currentSellPrice = product.sellPrice;

      await product.save({ session });
    }

    await session.commitTransaction();

    res.status(201).json({
      status: "success",
      data: {
        product,
      },
    });
  } catch (error) {
    await session.abortTransaction();
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
  } finally {
    session.endSession();
  }
});

// Update product function - FIXED VERSION
export const updateProduct = catchAsync(async (req, res, next) => {
  console.log("=== UPDATE PRODUCT START ===");
  console.log("Product ID:", req.params.id);
  console.log("Raw Request Body:", JSON.stringify(req.body, null, 2));

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // 1. Validate ObjectId format first
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      console.log("❌ Invalid ObjectId format");
      await session.abortTransaction();
      return next(new AppError("Invalid product ID format", 400));
    }

    // 2. Find existing product
    const existingProduct = await Product.findById(req.params.id).session(
      session
    );
    console.log("Existing product found:", !!existingProduct);

    if (!existingProduct) {
      console.log("❌ Product not found");
      await session.abortTransaction();
      return next(new AppError("Product not found", 404));
    }

    if (!existingProduct.isActive) {
      console.log("❌ Product is not active");
      await session.abortTransaction();
      return next(new AppError("Product not found", 404));
    }

    // 3. Build update data - ONLY include fields that are actually changing
    const updateData = {};

    // List of fields that can be updated
    const allowedFields = [
      "name",
      "category",
      "buyPrice",
      "sellPrice",
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
        } else if (field === "lowStockThreshold") {
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

    // 4. Handle quantity updates through inventory batches
    if (req.body.hasOwnProperty("quantity")) {
      const newQuantity = parseInt(req.body.quantity);
      const currentQuantity = existingProduct.quantity || 0;

      if (newQuantity > currentQuantity) {
        const quantityToAdd = newQuantity - currentQuantity;
        console.log(
          "📦 Creating inventory batch for additional quantity:",
          quantityToAdd
        );

        const batch = new InventoryBatch({
          productId: existingProduct._id,
          buyPrice: updateData.buyPrice || existingProduct.buyPrice,
          sellPrice: updateData.sellPrice || existingProduct.sellPrice,
          initialQuantity: quantityToAdd,
          remainingQuantity: quantityToAdd,
          supplierName: "Stock Update",
          invoiceNumber: `UPDATE-${Date.now()}`,
          notes: `Added ${quantityToAdd} units via product update`,
          purchaseDate: new Date(),
          status: "active",
        });

        await batch.save({ session });

        // Update product quantity
        updateData.quantity = newQuantity;
        updateData.totalQuantity = newQuantity;
      } else if (newQuantity < currentQuantity) {
        console.log(
          "⚠️ Quantity decrease requested - ignoring to preserve FIFO integrity"
        );
      }
    }

    // 5. Validate barcode if it's being changed
    if (updateData.hasOwnProperty("barcode") && updateData.barcode !== null) {
      const duplicateProduct = await Product.findOne({
        barcode: updateData.barcode,
        isActive: true,
        _id: { $ne: req.params.id },
      }).session(session);

      if (duplicateProduct) {
        console.log("❌ Duplicate barcode found");
        await session.abortTransaction();
        return next(
          new AppError("Product with this barcode already exists", 400)
        );
      }
    }

    // 6. Validate prices
    let finalBuyPrice = updateData.buyPrice || existingProduct.buyPrice;
    let finalSellPrice = updateData.sellPrice || existingProduct.sellPrice;

    if (finalSellPrice < finalBuyPrice) {
      console.log("❌ Sell price lower than buy price");
      await session.abortTransaction();
      return next(
        new AppError(
          `Sell price ($${finalSellPrice}) must be greater than or equal to buy price ($${finalBuyPrice})`,
          400
        )
      );
    }

    // 7. If no fields to update, return current product
    if (Object.keys(updateData).length === 0) {
      console.log("⚠️ No fields to update");
      await session.abortTransaction();
      return res.status(200).json({
        status: "success",
        data: {
          product: existingProduct,
        },
      });
    }

    // 8. Perform the update
    const updatedProduct = await Product.findByIdAndUpdate(
      req.params.id,
      updateData,
      {
        new: true,
        runValidators: true,
        session,
      }
    );

    await session.commitTransaction();

    console.log("✅ Product updated successfully");

    res.status(200).json({
      status: "success",
      data: {
        product: updatedProduct,
      },
    });
  } catch (error) {
    await session.abortTransaction();
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
  } finally {
    session.endSession();
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
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // Validate ObjectId format
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      await session.abortTransaction();
      return next(new AppError("Invalid product ID format", 400));
    }

    const { quantity, operation = "add" } = req.body;

    if (!quantity && quantity !== 0) {
      await session.abortTransaction();
      return next(new AppError("Quantity is required", 400));
    }

    const product = await Product.findById(req.params.id).session(session);

    if (!product || !product.isActive) {
      await session.abortTransaction();
      return next(new AppError("Product not found", 404));
    }

    if (operation === "add" || operation === "set") {
      const quantityToAdd =
        operation === "set" ? quantity - (product.quantity || 0) : quantity;

      if (quantityToAdd > 0) {
        // Create inventory batch for added quantity
        const batch = new InventoryBatch({
          productId: product._id,
          buyPrice: product.buyPrice,
          sellPrice: product.sellPrice,
          initialQuantity: quantityToAdd,
          remainingQuantity: quantityToAdd,
          supplierName: "Inventory Update",
          invoiceNumber: `INV-${Date.now()}`,
          notes: `${
            operation === "set" ? "Set" : "Added"
          } ${quantityToAdd} units via quantity update`,
          purchaseDate: new Date(),
          status: "active",
        });

        await batch.save({ session });

        // Update product quantity
        product.quantity = (product.quantity || 0) + quantityToAdd;
        product.totalQuantity = product.quantity;
        await product.save({ session });
      }
    } else if (operation === "subtract") {
      // For subtraction, we should ideally process through sales
      // But for direct quantity reduction, we'll just update the quantity
      const newQuantity = product.quantity - quantity;

      if (newQuantity < 0) {
        await session.abortTransaction();
        return next(new AppError("Insufficient stock", 400));
      }

      product.quantity = newQuantity;
      product.totalQuantity = newQuantity;
      await product.save({ session });
    }

    await session.commitTransaction();

    res.status(200).json({
      status: "success",
      data: {
        product,
      },
    });
  } catch (error) {
    await session.abortTransaction();
    console.error("Error updating quantity:", error);
    return next(new AppError("Failed to update quantity", 500));
  } finally {
    session.endSession();
  }
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
