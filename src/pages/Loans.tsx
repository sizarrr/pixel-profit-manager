// src/pages/Loans.tsx - Credit/Loan Sales Management
import React, { useState, useEffect } from "react";
import { useStore } from "@/contexts/StoreContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Calendar,
  User,
  Phone,
  MapPin,
  DollarSign,
  CreditCard,
  Clock,
  AlertTriangle,
  CheckCircle,
  Eye,
  Edit,
  Plus,
  Receipt,
  Search,
  Filter,
  Calendar as CalendarIcon,
  TrendingUp,
  TrendingDown,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { format, addDays, differenceInDays } from "date-fns";

interface LoanSale {
  id: string;
  receiptNumber: string;
  date?: string;
  customerName: string;
  customerPhone: string;
  customerAddress?: string;
  customerEmail?: string;
  cashierName: string;
  products: Array<{
    productId: string;
    productName: string;
    quantity: number;
    sellPrice: number;
    total: number;
  }>;
  totalAmount: number;
  downPayment: number;
  remainingBalance: number;
  interestRate: number;
  loanTerm: number; // in days
  dailyPayment: number;
  status: "active" | "completed" | "overdue" | "defaulted";
  createdAt: Date;
  dueDate: Date;
  lastPaymentDate?: Date;
  paymentHistory: Array<{
    id: string;
    amount: number;
    date: Date;
    paymentMethod: string;
    notes?: string;
  }>;
}

const Loans = () => {
  const { refreshData } = useStore();
  const { t } = useLanguage();
  const { toast } = useToast();

  // State management
  const [loans, setLoans] = useState<LoanSale[]>([]);
  const [filteredLoans, setFilteredLoans] = useState<LoanSale[]>([]);
  const [selectedLoan, setSelectedLoan] = useState<LoanSale | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [isLoading, setIsLoading] = useState(true);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [paymentNotes, setPaymentNotes] = useState("");

  // Fetch loans from API
  const fetchLoans = async () => {
    try {
      setIsLoading(true);
      const response = await fetch("http://localhost:5000/api/v1/loans");

      if (!response.ok) {
        throw new Error("Failed to fetch loans");
      }

      const data = await response.json();

      // Transform API data to match our interface
      const transformedLoans = data.data.loans.map((loan: any) => ({
        id: loan._id,
        receiptNumber: loan.receipt || loan.receiptNumber,
        date: loan.date,
        customerName: loan.customerName,
        customerPhone: loan.customerPhone,
        customerAddress: loan.customerAddress || "",
        customerEmail: loan.customerEmail || "",
        cashierName: loan.cashierName,
        products: loan.products,
        totalAmount: loan.totalAmount,
        downPayment: loan.downPayment || 0,
        remainingBalance: loan.remainingBalance,
        interestRate: loan.interestRate || 0,
        loanTerm: loan.loanTerm,
        dailyPayment: loan.dailyPayment || 0,
        status: loan.status,
        createdAt: new Date(loan.createdAt),
        dueDate: new Date(loan.dueDate),
        lastPaymentDate: loan.lastPaymentDate ? new Date(loan.lastPaymentDate) : undefined,
        paymentHistory: loan.paymentHistory.map((payment: any) => ({
          id: payment._id,
          amount: payment.amount,
          date: new Date(payment.date),
          paymentMethod: payment.paymentMethod,
          notes: payment.notes,
        })),
      }));

      setLoans(transformedLoans);
      setFilteredLoans(transformedLoans);
    } catch (error) {
      console.error("Error fetching loans:", error);
      toast({
        title: "Error",
        description: "Failed to fetch loan records",
        variant: "destructive",
      });
      setLoans([]);
      setFilteredLoans([]);
    } finally {
      setIsLoading(false);
    }
  };

  // Load loans data
  useEffect(() => {
    fetchLoans();
  }, []);

  // Filter loans based on search and status
  useEffect(() => {
    let filtered = loans;

    if (searchTerm) {
      filtered = filtered.filter(
        (loan) =>
          loan.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
          loan.customerPhone.includes(searchTerm) ||
          loan.receiptNumber.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (statusFilter !== "all") {
      filtered = filtered.filter((loan) => loan.status === statusFilter);
    }

    setFilteredLoans(filtered);
  }, [loans, searchTerm, statusFilter]);

  // Calculate statistics
  const statistics = {
    totalLoans: loans.length,
    activeLoans: loans.filter((l) => l.status === "active").length,
    overdueLoans: loans.filter((l) => l.status === "overdue").length,
    completedLoans: loans.filter((l) => l.status === "completed").length,
    totalAmount: loans.reduce((sum, loan) => sum + loan.totalAmount, 0),
    totalOutstanding: loans
      .filter((l) => l.status === "active" || l.status === "overdue")
      .reduce((sum, loan) => sum + loan.remainingBalance, 0),
    totalCollected: loans.reduce(
      (sum, loan) =>
        sum + loan.paymentHistory.reduce((pSum, payment) => pSum + payment.amount, 0),
      0
    ),
  };

  // Handle payment recording
  const recordPayment = async () => {
    if (!selectedLoan || !paymentAmount) return;

    const amount = parseFloat(paymentAmount);
    if (amount <= 0 || amount > selectedLoan.remainingBalance) {
      toast({
        title: "Invalid Amount",
        description: "Payment amount must be valid and not exceed remaining balance",
        variant: "destructive",
      });
      return;
    }

    try {
      // Record payment via API
      const response = await fetch(`http://localhost:5000/api/v1/loans/${selectedLoan.id}/payment`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          amount,
          paymentMethod,
          notes: paymentNotes,
          recordedBy: "Store Manager", // You can get this from user context
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to record payment");
      }

      const data = await response.json();

      // Refresh the loans list to get updated data
      await fetchLoans();

      setShowPaymentModal(false);
      setPaymentAmount("");
      setPaymentNotes("");
      setSelectedLoan(null);

      toast({
        title: "Payment Recorded! 💰",
        description: `Payment of $${amount.toFixed(2)} recorded successfully`,
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to record payment",
        variant: "destructive",
      });
    }
  };

  // Get status badge color
  const getStatusBadge = (status: string) => {
    const colors = {
      active: "bg-blue-100 text-blue-800",
      completed: "bg-green-100 text-green-800",
      overdue: "bg-red-100 text-red-800",
      defaulted: "bg-gray-100 text-gray-800",
    };
    return colors[status as keyof typeof colors] || colors.active;
  };

  // Calculate days remaining or overdue
  const getDaysInfo = (loan: LoanSale) => {
    const today = new Date();
    const daysFromDue = differenceInDays(today, loan.dueDate);

    if (daysFromDue > 0) {
      return { text: `${daysFromDue} days overdue`, color: "text-red-600" };
    } else {
      return { text: `${Math.abs(daysFromDue)} days remaining`, color: "text-blue-600" };
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="ml-3">Loading loans...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Credit & Loan Sales</h1>
          <p className="text-gray-600">Manage customer credit purchases and payment tracking</p>
        </div>
        <Button className="flex items-center gap-2">
          <Plus className="w-4 h-4" />
          New Loan Sale
        </Button>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Loans</p>
                <p className="text-2xl font-bold text-gray-900">{statistics.totalLoans}</p>
              </div>
              <div className="p-3 bg-blue-100 rounded-full">
                <CreditCard className="w-6 h-6 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Outstanding</p>
                <p className="text-2xl font-bold text-red-600">
                  ${statistics.totalOutstanding.toFixed(2)}
                </p>
              </div>
              <div className="p-3 bg-red-100 rounded-full">
                <TrendingUp className="w-6 h-6 text-red-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Collected</p>
                <p className="text-2xl font-bold text-green-600">
                  ${statistics.totalCollected.toFixed(2)}
                </p>
              </div>
              <div className="p-3 bg-green-100 rounded-full">
                <TrendingDown className="w-6 h-6 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Overdue</p>
                <p className="text-2xl font-bold text-orange-600">{statistics.overdueLoans}</p>
              </div>
              <div className="p-3 bg-orange-100 rounded-full">
                <AlertTriangle className="w-6 h-6 text-orange-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                <Input
                  placeholder="Search by customer name, phone, or receipt number..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <div className="w-48">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full h-10 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              >
                <option value="all">All Status</option>
                <option value="active">Active</option>
                <option value="overdue">Overdue</option>
                <option value="completed">Completed</option>
                <option value="defaulted">Defaulted</option>
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Loans Table */}
      <Card>
        <CardHeader>
          <CardTitle>Loan Accounts ({filteredLoans.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left p-3">Customer</th>
                  <th className="text-left p-3">Receipt</th>
                  <th className="text-left p-3">Date</th>
                  <th className="text-right p-3">Total Amount</th>
                  <th className="text-right p-3">Outstanding</th>
                  <th className="text-center p-3">Status</th>
                  <th className="text-center p-3">Due Date</th>
                  <th className="text-center p-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredLoans.map((loan) => {
                  const daysInfo = getDaysInfo(loan);
                  return (
                    <tr key={loan.id} className="border-b hover:bg-gray-50">
                      <td className="p-3">
                        <div>
                          <p className="font-medium text-gray-900">{loan.customerName}</p>
                          <p className="text-sm text-gray-500">{loan.customerPhone}</p>
                        </div>
                      </td>
                      <td className="p-3">
                        <p className="font-mono text-sm">{loan.receiptNumber}</p>
                      </td>
                      <td className="p-3">
                        <p className="text-sm">
                          {loan.date || format(loan.createdAt, "MM/dd/yyyy")}
                        </p>
                      </td>
                      <td className="p-3 text-right">
                        <p className="font-medium">${loan.totalAmount.toFixed(2)}</p>
                      </td>
                      <td className="p-3 text-right">
                        <p className="font-medium text-red-600">
                          ${loan.remainingBalance.toFixed(2)}
                        </p>
                      </td>
                      <td className="p-3 text-center">
                        <Badge className={getStatusBadge(loan.status)}>
                          {loan.status.charAt(0).toUpperCase() + loan.status.slice(1)}
                        </Badge>
                      </td>
                      <td className="p-3 text-center">
                        <p className="text-sm">{format(loan.dueDate, "MMM dd, yyyy")}</p>
                        <p className={`text-xs ${daysInfo.color}`}>{daysInfo.text}</p>
                      </td>
                      <td className="p-3">
                        <div className="flex items-center justify-center gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setSelectedLoan(loan)}
                          >
                            <Eye className="w-4 h-4" />
                          </Button>
                          {(loan.status === "active" || loan.status === "overdue") && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setSelectedLoan(loan);
                                setShowPaymentModal(true);
                              }}
                              className="text-green-600 hover:text-green-700"
                            >
                              <DollarSign className="w-4 h-4" />
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {filteredLoans.length === 0 && (
              <div className="text-center py-8">
                <CreditCard className="w-16 h-16 mx-auto text-gray-300 mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  No Loan Accounts Found
                </h3>
                <p className="text-gray-500">
                  {searchTerm || statusFilter !== "all"
                    ? "No loans match your search criteria"
                    : "No loan accounts have been created yet"}
                </p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Loan Details Modal */}
      {selectedLoan && !showPaymentModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b">
              <div className="flex justify-between items-center">
                <h2 className="text-xl font-bold">Loan Details - {selectedLoan.receiptNumber}</h2>
                <Button
                  variant="ghost"
                  onClick={() => setSelectedLoan(null)}
                >
                  ✕
                </Button>
              </div>
            </div>

            <div className="p-6 space-y-6">
              {/* Customer Information */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Customer Information</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex items-center gap-2">
                      <User className="w-4 h-4 text-gray-500" />
                      <span className="font-medium">{selectedLoan.customerName}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Phone className="w-4 h-4 text-gray-500" />
                      <span>{selectedLoan.customerPhone}</span>
                    </div>
                    {selectedLoan.customerAddress && (
                      <div className="flex items-center gap-2">
                        <MapPin className="w-4 h-4 text-gray-500" />
                        <span>{selectedLoan.customerAddress}</span>
                      </div>
                    )}
                    <div className="flex items-center gap-2">
                      <CalendarIcon className="w-4 h-4 text-gray-500" />
                      <span>Created: {format(selectedLoan.createdAt, "PPP 'at' pp")}</span>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Loan Summary</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Total Amount:</span>
                      <span className="font-medium">${selectedLoan.totalAmount.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Down Payment:</span>
                      <span className="font-medium">${selectedLoan.downPayment.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Interest Rate:</span>
                      <span className="font-medium">{selectedLoan.interestRate}%</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Loan Term:</span>
                      <span className="font-medium">{selectedLoan.loanTerm} days</span>
                    </div>
                    <div className="flex justify-between border-t pt-2">
                      <span className="text-gray-600">Remaining Balance:</span>
                      <span className="font-bold text-red-600">
                        ${selectedLoan.remainingBalance.toFixed(2)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Status:</span>
                      <Badge className={getStatusBadge(selectedLoan.status)}>
                        {selectedLoan.status.charAt(0).toUpperCase() + selectedLoan.status.slice(1)}
                      </Badge>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Products */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Products</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {selectedLoan.products.map((product, index) => (
                      <div key={index} className="flex justify-between items-center p-3 bg-gray-50 rounded">
                        <div>
                          <p className="font-medium">{product.productName}</p>
                          <p className="text-sm text-gray-600">
                            Qty: {product.quantity} × ${product.sellPrice.toFixed(2)}
                          </p>
                        </div>
                        <span className="font-medium">${product.total.toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Payment History */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Payment History</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {selectedLoan.paymentHistory.map((payment) => (
                      <div key={payment.id} className="flex justify-between items-center p-3 border rounded">
                        <div>
                          <p className="font-medium">${payment.amount.toFixed(2)}</p>
                          <p className="text-sm text-gray-600">
                            {format(payment.date, "MMM dd, yyyy 'at' HH:mm")} • {payment.paymentMethod}
                          </p>
                          {payment.notes && (
                            <p className="text-xs text-gray-500">{payment.notes}</p>
                          )}
                        </div>
                        <Receipt className="w-4 h-4 text-gray-400" />
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="p-6 border-t bg-gray-50">
              <div className="flex justify-between">
                <Button variant="outline" onClick={() => setSelectedLoan(null)}>
                  Close
                </Button>
                {(selectedLoan.status === "active" || selectedLoan.status === "overdue") && (
                  <Button
                    onClick={() => setShowPaymentModal(true)}
                    className="flex items-center gap-2"
                  >
                    <DollarSign className="w-4 h-4" />
                    Record Payment
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Payment Modal */}
      {showPaymentModal && selectedLoan && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-md w-full">
            <div className="p-6 border-b">
              <h2 className="text-xl font-bold">Record Payment</h2>
              <p className="text-gray-600">
                Outstanding: ${selectedLoan.remainingBalance.toFixed(2)}
              </p>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Payment Amount *
                </label>
                <Input
                  type="number"
                  step="0.01"
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                  placeholder="Enter payment amount"
                  max={selectedLoan.remainingBalance}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Payment Method
                </label>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  className="w-full h-10 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                >
                  <option value="cash">💵 Cash</option>
                  <option value="card">💳 Card</option>
                  <option value="digital">📱 Digital Payment</option>
                  <option value="bank_transfer">🏦 Bank Transfer</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Notes (Optional)
                </label>
                <Input
                  value={paymentNotes}
                  onChange={(e) => setPaymentNotes(e.target.value)}
                  placeholder="Enter payment notes"
                />
              </div>
            </div>

            <div className="p-6 border-t bg-gray-50 flex justify-between">
              <Button
                variant="outline"
                onClick={() => {
                  setShowPaymentModal(false);
                  setPaymentAmount("");
                  setPaymentNotes("");
                }}
              >
                Cancel
              </Button>
              <Button
                onClick={recordPayment}
                disabled={!paymentAmount || parseFloat(paymentAmount) <= 0}
              >
                Record Payment
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Loans;