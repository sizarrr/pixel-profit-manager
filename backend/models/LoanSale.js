// backend/models/LoanSale.js - Loan/Credit Sales Model
import mongoose from "mongoose";

const paymentHistorySchema = new mongoose.Schema(
  {
    amount: {
      type: Number,
      required: true,
      min: [0.01, "Payment amount must be positive"],
    },
    paymentMethod: {
      type: String,
      required: true,
      enum: ["cash", "card", "digital", "bank_transfer"],
      default: "cash",
    },
    notes: {
      type: String,
      trim: true,
    },
    recordedBy: {
      type: String,
      required: true,
      trim: true,
    },
  },
  {
    timestamps: true,
    _id: true
  }
);

const loanProductSchema = new mongoose.Schema(
  {
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
    },
    productName: {
      type: String,
      required: true,
      trim: true,
    },
    quantity: {
      type: Number,
      required: true,
      min: [0.01, "Quantity must be positive"],
    },
    sellPrice: {
      type: Number,
      required: true,
      min: [0, "Sell price cannot be negative"],
    },
    total: {
      type: Number,
      required: true,
      min: [0, "Total cannot be negative"],
    },
    // FIFO batch allocations (copied from the original sale)
    batchAllocations: [{
      batchId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "InventoryBatch",
        required: true,
      },
      batchNumber: String,
      quantity: {
        type: Number,
        required: true,
        min: [0.01, "Quantity must be positive"],
      },
      buyPrice: {
        type: Number,
        required: true,
      },
      sellPrice: {
        type: Number,
        required: true,
      },
      profit: {
        type: Number,
        required: true,
      },
    }],
    // Aggregated FIFO values
    totalCost: {
      type: Number,
      required: true,
    },
    totalPrice: {
      type: Number,
      required: true,
    },
    totalProfit: {
      type: Number,
      required: true,
    },
  },
  { _id: false }
);

const loanSaleSchema = new mongoose.Schema(
  {
    receiptNumber: {
      type: String,
      unique: true,
      required: true,
    },
    // Reference to the original sale
    originalSaleId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Sale",
      required: true,
    },
    // Customer Information
    customerName: {
      type: String,
      required: true,
      trim: true,
    },
    customerPhone: {
      type: String,
      required: true,
      trim: true,
    },
    customerAddress: {
      type: String,
      trim: true,
    },
    customerEmail: {
      type: String,
      trim: true,
      lowercase: true,
      validate: {
        validator: function(email) {
          if (!email) return true; // Allow empty email
          return /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/.test(email);
        },
        message: "Please enter a valid email address"
      }
    },
    // Sale Information
    cashierName: {
      type: String,
      required: true,
      trim: true,
    },
    products: {
      type: [loanProductSchema],
      required: true,
      validate: {
        validator: function (products) {
          return products && products.length > 0;
        },
        message: "At least one product is required",
      },
    },
    // Financial Information
    totalAmount: {
      type: Number,
      required: true,
      min: [0.01, "Total amount must be positive"],
    },
    downPayment: {
      type: Number,
      required: true,
      min: [0, "Down payment cannot be negative"],
      validate: {
        validator: function(value) {
          return value < this.totalAmount;
        },
        message: "Down payment must be less than total amount"
      }
    },
    loanAmount: {
      type: Number,
      required: true,
      min: [0.01, "Loan amount must be positive"],
    },
    interestRate: {
      type: Number,
      required: true,
      min: [0, "Interest rate cannot be negative"],
      max: [100, "Interest rate cannot exceed 100%"],
      default: 0,
    },
    totalWithInterest: {
      type: Number,
      required: true,
      min: [0.01, "Total with interest must be positive"],
    },
    remainingBalance: {
      type: Number,
      required: true,
      min: [0, "Remaining balance cannot be negative"],
    },
    // Loan Terms
    loanTerm: {
      type: Number,
      required: true,
      min: [1, "Loan term must be at least 1 day"],
    },
    dailyPayment: {
      type: Number,
      required: true,
      min: [0.01, "Daily payment must be positive"],
    },
    dueDate: {
      type: Date,
      required: true,
    },
    // Status
    status: {
      type: String,
      required: true,
      enum: ["active", "completed", "overdue", "defaulted"],
      default: "active",
    },
    lastPaymentDate: {
      type: Date,
    },
    // Payment History
    paymentHistory: {
      type: [paymentHistorySchema],
      default: [],
    },
    // Additional Information
    notes: {
      type: String,
      trim: true,
    },
    // System Information
    subtotal: {
      type: Number,
      required: true,
    },
    taxRate: {
      type: Number,
      default: 0,
      min: [0, "Tax rate cannot be negative"],
      max: [1, "Tax rate cannot exceed 100%"],
    },
    taxAmount: {
      type: Number,
      default: 0,
      min: [0, "Tax amount cannot be negative"],
    },
    discountAmount: {
      type: Number,
      default: 0,
      min: [0, "Discount amount cannot be negative"],
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Indexes for performance
loanSaleSchema.index({ createdAt: -1 });
loanSaleSchema.index({ customerName: 1 });
loanSaleSchema.index({ customerPhone: 1 });
loanSaleSchema.index({ status: 1 });
loanSaleSchema.index({ dueDate: 1 });
loanSaleSchema.index({ receiptNumber: 1 });
loanSaleSchema.index({ originalSaleId: 1 });

// Virtual for days overdue
loanSaleSchema.virtual('daysOverdue').get(function() {
  if (this.status !== 'overdue') return 0;
  const now = new Date();
  const overdueDays = Math.floor((now - this.dueDate) / (1000 * 60 * 60 * 24));
  return Math.max(0, overdueDays);
});

// Virtual for days remaining
loanSaleSchema.virtual('daysRemaining').get(function() {
  if (this.status === 'completed') return 0;
  const now = new Date();
  const remainingDays = Math.floor((this.dueDate - now) / (1000 * 60 * 60 * 24));
  return Math.max(0, remainingDays);
});

// Virtual for payment progress percentage
loanSaleSchema.virtual('paymentProgress').get(function() {
  const totalPaid = this.totalWithInterest - this.remainingBalance;
  return Math.round((totalPaid / this.totalWithInterest) * 100);
});

// Pre-save middleware to calculate loan fields
loanSaleSchema.pre("save", function (next) {
  // Calculate loan amount
  this.loanAmount = this.totalAmount - this.downPayment;

  // Calculate total with interest
  this.totalWithInterest = this.loanAmount * (1 + this.interestRate / 100);

  // Calculate daily payment
  this.dailyPayment = this.totalWithInterest / this.loanTerm;

  // Set due date if not set
  if (!this.dueDate) {
    this.dueDate = new Date();
    this.dueDate.setDate(this.dueDate.getDate() + this.loanTerm);
  }

  // Update remaining balance based on payments
  const totalPaid = this.paymentHistory.reduce((sum, payment) => sum + payment.amount, 0);
  this.remainingBalance = Math.max(0, this.totalWithInterest - totalPaid);

  // Update status based on remaining balance and due date
  if (this.remainingBalance <= 0) {
    this.status = "completed";
  } else if (new Date() > this.dueDate && this.status === "active") {
    this.status = "overdue";
  }

  // Update last payment date
  if (this.paymentHistory.length > 0) {
    const lastPayment = this.paymentHistory[this.paymentHistory.length - 1];
    this.lastPaymentDate = lastPayment.createdAt || new Date();
  }

  next();
});

// Pre-save middleware to generate receipt number
loanSaleSchema.pre("save", async function (next) {
  if (!this.receiptNumber) {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");

    const count = await mongoose.model("LoanSale").countDocuments({
      createdAt: {
        $gte: new Date(date.setHours(0, 0, 0, 0)),
        $lt: new Date(date.setHours(23, 59, 59, 999)),
      },
    });

    this.receiptNumber = `LOAN-${year}${month}${day}-${String(count + 1).padStart(4, "0")}`;
  }
  next();
});

// Static method to get loan statistics
loanSaleSchema.statics.getLoanStatistics = async function() {
  const stats = await this.aggregate([
    {
      $group: {
        _id: null,
        totalLoans: { $sum: 1 },
        totalAmount: { $sum: "$totalAmount" },
        totalOutstanding: {
          $sum: {
            $cond: [
              { $in: ["$status", ["active", "overdue"]] },
              "$remainingBalance",
              0
            ]
          }
        },
        totalCollected: {
          $sum: {
            $subtract: ["$totalWithInterest", "$remainingBalance"]
          }
        },
        activeLoans: {
          $sum: {
            $cond: [{ $eq: ["$status", "active"] }, 1, 0]
          }
        },
        overdueLoans: {
          $sum: {
            $cond: [{ $eq: ["$status", "overdue"] }, 1, 0]
          }
        },
        completedLoans: {
          $sum: {
            $cond: [{ $eq: ["$status", "completed"] }, 1, 0]
          }
        },
      }
    }
  ]);

  return stats[0] || {
    totalLoans: 0,
    totalAmount: 0,
    totalOutstanding: 0,
    totalCollected: 0,
    activeLoans: 0,
    overdueLoans: 0,
    completedLoans: 0,
  };
};

// Static method to get overdue loans
loanSaleSchema.statics.getOverdueLoans = function() {
  return this.find({
    status: "overdue",
    remainingBalance: { $gt: 0 }
  }).sort({ dueDate: 1 });
};

// Instance method to record payment
loanSaleSchema.methods.recordPayment = function(paymentData) {
  const { amount, paymentMethod = "cash", notes = "", recordedBy } = paymentData;

  if (amount <= 0 || amount > this.remainingBalance) {
    throw new Error("Invalid payment amount");
  }

  this.paymentHistory.push({
    amount,
    paymentMethod,
    notes,
    recordedBy,
  });

  return this.save();
};

const LoanSale = mongoose.model("LoanSale", loanSaleSchema);

export default LoanSale;