// backend/controllers/loanController.js - Loan Sales Controller
import mongoose from "mongoose";
import LoanSale from "../models/LoanSale.js";
import Sale from "../models/Sale.js";
import Product from "../models/Product.js";
import InventoryBatch from "../models/InventoryBatch.js";
import { catchAsync, AppError } from "../middleware/errorHandler.js";
import config from "../config/config.js";

// Get all loan sales with pagination and filtering
export const getAllLoans = catchAsync(async (req, res, next) => {
  const {
    page = 1,
    limit = config.defaultPageSize,
    status,
    customerName,
    customerPhone,
    sort = "-createdAt",
  } = req.query;

  // Build filter object
  const filter = {};

  if (status) {
    filter.status = status;
  }

  if (customerName) {
    filter.customerName = new RegExp(customerName, "i");
  }

  if (customerPhone) {
    filter.customerPhone = new RegExp(customerPhone, "i");
  }

  // Calculate pagination
  const skip = (page - 1) * limit;
  const limitNum = Math.min(limit, config.maxPageSize);

  // Execute query with population
  const loans = await LoanSale.find(filter)
    .populate("originalSaleId", "receiptNumber")
    .sort(sort)
    .skip(skip)
    .limit(limitNum)
    .lean();

  // Add formatted date column for each loan
  const formattedLoans = loans.map(loan => {
    // Format date as MM/DD/YYYY
    const formatDateOnly = (dateStr) => {
      if (!dateStr) return '';
      const date = new Date(dateStr);
      return date.toLocaleDateString('en-US', {
        month: '2-digit',
        day: '2-digit',
        year: 'numeric'
      });
    };

    return {
      ...loan,
      // Add separate date column for loan accounts table
      date: formatDateOnly(loan.createdAt),
      // Clean receipt number (ensure it's just the receipt number)
      receipt: loan.receiptNumber
    };
  });

  // Get total count for pagination
  const total = await LoanSale.countDocuments(filter);
  const totalPages = Math.ceil(total / limitNum);

  res.status(200).json({
    status: "success",
    results: formattedLoans.length,
    pagination: {
      currentPage: parseInt(page),
      totalPages,
      totalItems: total,
      itemsPerPage: limitNum,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1,
    },
    data: {
      loans: formattedLoans,
    },
  });
});

// Get single loan by ID
export const getLoan = catchAsync(async (req, res, next) => {
  const loan = await LoanSale.findById(req.params.id)
    .populate("originalSaleId", "receiptNumber cashierName")
    .populate("products.productId", "name category")
    .lean();

  if (!loan) {
    return next(new AppError("Loan not found", 404));
  }

  // Format date as MM/DD/YYYY
  const formatDateOnly = (dateStr) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      month: '2-digit',
      day: '2-digit',
      year: 'numeric'
    });
  };

  // Add formatted date column for the loan
  const formattedLoan = {
    ...loan,
    // Add separate date column for loan accounts table
    date: formatDateOnly(loan.createdAt),
    // Clean receipt number
    receipt: loan.receiptNumber
  };

  res.status(200).json({
    status: "success",
    data: {
      loan: formattedLoan,
    },
  });
});

// Create loan from existing sale
export const createLoanFromSale = catchAsync(async (req, res, next) => {
  const {
    originalSaleId,
    customerName,
    customerPhone,
    customerAddress,
    customerEmail,
    downPayment,
    interestRate = 10,
    loanTerm = 30,
    notes,
  } = req.body;

  // Validate required fields
  if (!originalSaleId || !customerName || !customerPhone || !downPayment) {
    return next(new AppError("Missing required fields", 400));
  }

  // Get the original sale
  const originalSale = await Sale.findById(originalSaleId);
  if (!originalSale) {
    return next(new AppError("Original sale not found", 404));
  }

  // Validate down payment
  if (downPayment >= originalSale.totalAmount) {
    return next(new AppError("Down payment cannot be equal to or greater than total amount", 400));
  }

  if (downPayment < 0) {
    return next(new AppError("Down payment cannot be negative", 400));
  }

  // Check if loan already exists for this sale
  const existingLoan = await LoanSale.findOne({ originalSaleId });
  if (existingLoan) {
    return next(new AppError("Loan already exists for this sale", 400));
  }

  // Create loan sale
  const loanData = {
    originalSaleId,
    customerName: customerName.trim(),
    customerPhone: customerPhone.trim(),
    customerAddress: customerAddress?.trim(),
    customerEmail: customerEmail?.trim(),
    cashierName: originalSale.cashierName,
    products: originalSale.products.map(product => ({
      productId: product.productId,
      productName: product.productName,
      quantity: product.quantity,
      sellPrice: product.sellPrice || product.totalPrice / product.quantity,
      total: product.totalPrice,
      batchAllocations: product.batchAllocations || [],
      totalCost: product.totalCost,
      totalPrice: product.totalPrice,
      totalProfit: product.totalProfit,
    })),
    totalAmount: originalSale.totalAmount,
    downPayment: Number(downPayment),
    interestRate: Number(interestRate),
    loanTerm: Number(loanTerm),
    subtotal: originalSale.subtotal,
    taxRate: originalSale.taxRate || 0,
    taxAmount: originalSale.taxAmount || 0,
    discountAmount: originalSale.discountAmount || 0,
    notes: notes?.trim(),
  };

  // Add down payment to payment history
  if (downPayment > 0) {
    loanData.paymentHistory = [{
      amount: Number(downPayment),
      paymentMethod: "cash",
      notes: "Down payment",
      recordedBy: originalSale.cashierName,
    }];
  }

  const loan = new LoanSale(loanData);
  await loan.save();

  // Update original sale to indicate it's converted to loan
  originalSale.paymentMethod = "loan";
  originalSale.notes = `${originalSale.notes || ""} [Converted to Loan: ${loan.receiptNumber}]`.trim();
  await originalSale.save();

  res.status(201).json({
    status: "success",
    data: {
      loan,
    },
  });
});

// Record payment for a loan
export const recordPayment = catchAsync(async (req, res, next) => {
  const { amount, paymentMethod = "cash", notes = "" } = req.body;
  const { recordedBy = "System" } = req.body;

  // Validate amount
  if (!amount || amount <= 0) {
    return next(new AppError("Payment amount must be positive", 400));
  }

  // Get loan
  const loan = await LoanSale.findById(req.params.id);
  if (!loan) {
    return next(new AppError("Loan not found", 404));
  }

  // Check if loan is active
  if (loan.status === "completed") {
    return next(new AppError("Loan is already completed", 400));
  }

  // Check if payment amount is valid
  if (amount > loan.remainingBalance) {
    return next(new AppError("Payment amount exceeds remaining balance", 400));
  }

  // Record payment using instance method
  await loan.recordPayment({
    amount: Number(amount),
    paymentMethod,
    notes,
    recordedBy,
  });

  // Create a corresponding sale record for dashboard/reports statistics
  const saleData = {
    receiptNumber: `LOAN-PAY-${loan.receiptNumber}-${Date.now()}`,
    products: loan.products.map(product => ({
      productId: product.productId,
      productName: product.productName,
      quantity: 1, // Set to 1 for validation, but no actual inventory movement
      batchAllocations: [],
      totalCost: 0,
      totalPrice: Number(amount), // Use payment amount as total
      totalProfit: Number(amount), // Full payment amount counts as profit for statistics
    })),
    subtotal: Number(amount),
    taxRate: 0,
    taxAmount: 0,
    discountAmount: 0,
    totalAmount: Number(amount),
    totalCost: 0,
    totalProfit: Number(amount),
    paymentMethod: paymentMethod,
    cashierName: recordedBy,
    customerName: loan.customerName,
    customerPhone: loan.customerPhone,
    notes: `Loan payment for ${loan.receiptNumber}${notes ? ` - ${notes}` : ''}`,
    status: "completed",
  };

  // Create the sale record to appear in dashboard statistics
  const paymentSale = new Sale(saleData);
  await paymentSale.save();

  res.status(200).json({
    status: "success",
    message: "Payment recorded successfully",
    data: {
      loan,
      paymentSale,
    },
  });
});

// Get loan statistics
export const getLoanStatistics = catchAsync(async (req, res, next) => {
  const statistics = await LoanSale.getLoanStatistics();

  res.status(200).json({
    status: "success",
    data: {
      statistics,
    },
  });
});

// Get overdue loans
export const getOverdueLoans = catchAsync(async (req, res, next) => {
  const overdueLoans = await LoanSale.getOverdueLoans();

  res.status(200).json({
    status: "success",
    results: overdueLoans.length,
    data: {
      loans: overdueLoans,
    },
  });
});

// Update loan status
export const updateLoanStatus = catchAsync(async (req, res, next) => {
  const { status } = req.body;

  const validStatuses = ["active", "completed", "overdue", "defaulted"];
  if (!validStatuses.includes(status)) {
    return next(new AppError("Invalid status", 400));
  }

  const loan = await LoanSale.findByIdAndUpdate(
    req.params.id,
    { status },
    { new: true, runValidators: true }
  );

  if (!loan) {
    return next(new AppError("Loan not found", 404));
  }

  res.status(200).json({
    status: "success",
    data: {
      loan,
    },
  });
});

// Get loans by date range
export const getLoansByDateRange = catchAsync(async (req, res, next) => {
  const { startDate, endDate, groupBy = "day" } = req.query;

  const start = startDate
    ? new Date(startDate)
    : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const end = endDate ? new Date(endDate) : new Date();

  let groupFormat;
  switch (groupBy) {
    case "day":
      groupFormat = {
        $dateToString: { format: "%Y-%m-%d", date: "$createdAt" },
      };
      break;
    case "month":
      groupFormat = { $dateToString: { format: "%Y-%m", date: "$createdAt" } };
      break;
    case "year":
      groupFormat = { $dateToString: { format: "%Y", date: "$createdAt" } };
      break;
    default:
      groupFormat = {
        $dateToString: { format: "%Y-%m-%d", date: "$createdAt" },
      };
  }

  const loanData = await LoanSale.aggregate([
    {
      $match: {
        createdAt: { $gte: start, $lte: end },
      },
    },
    {
      $group: {
        _id: groupFormat,
        totalLoans: { $sum: 1 },
        totalAmount: { $sum: "$totalAmount" },
        totalOutstanding: { $sum: "$remainingBalance" },
        totalCollected: {
          $sum: { $subtract: ["$totalWithInterest", "$remainingBalance"] }
        },
        averageLoanAmount: { $avg: "$totalAmount" },
        activeLoans: {
          $sum: { $cond: [{ $eq: ["$status", "active"] }, 1, 0] }
        },
        overdueLoans: {
          $sum: { $cond: [{ $eq: ["$status", "overdue"] }, 1, 0] }
        },
        completedLoans: {
          $sum: { $cond: [{ $eq: ["$status", "completed"] }, 1, 0] }
        },
      },
    },
    {
      $sort: { _id: 1 },
    },
  ]);

  res.status(200).json({
    status: "success",
    results: loanData.length,
    data: {
      loans: loanData,
    },
  });
});

// Get customer loan history
export const getCustomerLoans = catchAsync(async (req, res, next) => {
  const { customerPhone, customerName } = req.query;

  if (!customerPhone && !customerName) {
    return next(new AppError("Customer phone or name is required", 400));
  }

  const filter = {};
  if (customerPhone) {
    filter.customerPhone = customerPhone;
  }
  if (customerName) {
    filter.customerName = new RegExp(customerName, "i");
  }

  const loans = await LoanSale.find(filter)
    .populate("originalSaleId", "receiptNumber")
    .sort({ createdAt: -1 });

  const customerStats = {
    totalLoans: loans.length,
    totalAmount: loans.reduce((sum, loan) => sum + loan.totalAmount, 0),
    totalOutstanding: loans
      .filter(loan => ["active", "overdue"].includes(loan.status))
      .reduce((sum, loan) => sum + loan.remainingBalance, 0),
    totalPaid: loans.reduce((sum, loan) =>
      sum + loan.paymentHistory.reduce((pSum, payment) => pSum + payment.amount, 0), 0
    ),
    activeLoans: loans.filter(loan => loan.status === "active").length,
    overdueLoans: loans.filter(loan => loan.status === "overdue").length,
    completedLoans: loans.filter(loan => loan.status === "completed").length,
  };

  res.status(200).json({
    status: "success",
    results: loans.length,
    data: {
      loans,
      customerStats,
    },
  });
});

// Create loan directly (without existing sale)
export const createLoanDirect = catchAsync(async (req, res, next) => {
  const {
    customerName,
    customerPhone,
    customerAddress,
    customerEmail,
    cashierName,
    products,
    totalAmount,
    downPayment = 0,
    interestRate = 0,
    loanTerm = 30,
    notes,
  } = req.body;

  // Validate required fields
  if (!customerName || !products || !totalAmount || !cashierName) {
    return next(new AppError("Missing required fields: customerName, products, totalAmount, cashierName", 400));
  }

  if (!Array.isArray(products) || products.length === 0) {
    return next(new AppError("Products array is required and cannot be empty", 400));
  }

  // Validate products structure
  for (const product of products) {
    if (!product.productId || !product.productName || !product.quantity || !product.sellPrice) {
      return next(new AppError("Each product must have productId, productName, quantity, and sellPrice", 400));
    }
  }

  // Start database transaction for FIFO allocation
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // Process products with FIFO allocation
    const processedProducts = [];
    let totalCost = 0;
    let totalProfit = 0;

    for (const item of products) {
      // Get product details
      const product = await Product.findById(item.productId).session(session);
      if (!product) {
        throw new AppError(`Product with ID ${item.productId} not found`, 404);
      }

      // Get available batches in FIFO order (oldest first)
      const availableBatches = await InventoryBatch.find({
        productId: item.productId,
        status: "active",
        remainingQuantity: { $gt: 0 },
      })
        .sort({ purchaseDate: 1, createdAt: 1 }) // FIFO: oldest first
        .session(session);

      // Calculate total available quantity
      const totalAvailable = availableBatches.reduce(
        (sum, batch) => sum + batch.remainingQuantity,
        0
      );

      // Check stock availability
      if (totalAvailable < item.quantity) {
        throw new AppError(
          `Insufficient stock for ${product.name}. Available: ${totalAvailable}, Requested: ${item.quantity}`,
          400
        );
      }

      // FIFO allocation
      const batchAllocations = [];
      let remainingToAllocate = item.quantity;
      let itemCost = 0;
      let itemPrice = 0;

      for (const batch of availableBatches) {
        if (remainingToAllocate <= 0) break;

        const allocateFromBatch = Math.min(
          remainingToAllocate,
          batch.remainingQuantity
        );

        const allocationCost = allocateFromBatch * batch.buyPrice;
        const allocationPrice = allocateFromBatch * batch.sellPrice;
        const allocationProfit = allocationPrice - allocationCost;

        itemCost += allocationCost;
        itemPrice += allocationPrice;

        batchAllocations.push({
          batchId: batch._id,
          batchNumber: batch.batchNumber,
          quantity: allocateFromBatch,
          buyPrice: batch.buyPrice,
          sellPrice: batch.sellPrice,
          profit: allocationProfit,
        });

        // Update batch remaining quantity
        batch.remainingQuantity -= allocateFromBatch;

        // Update batch status if depleted
        if (batch.remainingQuantity <= 0) {
          batch.status = "depleted";
        }

        await batch.save({ session });
        remainingToAllocate -= allocateFromBatch;
      }

      // Verify all quantity was allocated
      if (remainingToAllocate > 0) {
        throw new AppError(
          `Failed to allocate full quantity for ${product.name}`,
          500
        );
      }

      const itemProfit = itemPrice - itemCost;
      totalCost += itemCost;
      totalProfit += itemProfit;

      processedProducts.push({
        productId: item.productId,
        productName: item.productName.trim(),
        quantity: Number(item.quantity),
        sellPrice: Number(item.sellPrice),
        total: Number(item.total) || Number(item.sellPrice) * Number(item.quantity),
        batchAllocations,
        totalCost: itemCost,
        totalPrice: itemPrice,
        totalProfit: itemProfit,
      });

      // Update product total quantity from remaining batches
      await product.updateFromBatches();
    }

    // Calculate loan values
    const totalAmountNum = Number(totalAmount);
    const downPaymentNum = Number(downPayment);
    const interestRateNum = Number(interestRate);
    const loanTermNum = Number(loanTerm);

    const loanAmount = totalAmountNum - downPaymentNum;
    const totalWithInterest = loanAmount * (1 + interestRateNum / 100);
    const remainingBalance = totalWithInterest - downPaymentNum;
    const dailyPayment = totalWithInterest / loanTermNum;

    // Calculate due date
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + loanTermNum);

    // Create a dummy sale ID (since we're creating loan directly)
    const dummySaleId = new mongoose.Types.ObjectId();

    // Create loan data with processed products
    const loanData = {
      receiptNumber: `LOAN-TEMP-${Date.now()}`, // Temporary, will be overridden by pre-save middleware
      originalSaleId: dummySaleId, // Dummy sale ID for direct loans
      customerName: customerName.trim(),
      customerPhone: customerPhone?.trim() || "N/A",
      customerAddress: customerAddress?.trim() || "",
      customerEmail: customerEmail?.trim() || "",
      cashierName: cashierName.trim(),
      products: processedProducts,
      totalAmount: totalAmountNum,
      downPayment: downPaymentNum,
      loanAmount: loanAmount,
      interestRate: interestRateNum,
      totalWithInterest: totalWithInterest,
      remainingBalance: remainingBalance,
      loanTerm: loanTermNum,
      dailyPayment: dailyPayment,
      dueDate: dueDate,
      subtotal: totalAmountNum,
      taxRate: 0,
      taxAmount: 0,
      discountAmount: 0,
      notes: notes?.trim() || "Direct loan creation with FIFO allocation",
      status: "active",
    };

    // Add down payment to payment history if provided
    if (downPayment > 0) {
      loanData.paymentHistory = [{
        amount: Number(downPayment),
        paymentMethod: "cash",
        notes: "Down payment",
        recordedBy: cashierName.trim(),
      }];
    }

    const loan = new LoanSale(loanData);
    await loan.save({ session });

    // Commit transaction
    await session.commitTransaction();

    res.status(201).json({
      status: "success",
      data: {
        loan,
      },
    });
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
});