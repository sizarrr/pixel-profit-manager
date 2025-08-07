import React, { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { 
  Search, 
  Calendar as CalendarIcon, 
  Filter, 
  X,
  DollarSign,
  User,
  CreditCard
} from 'lucide-react';
import { format } from 'date-fns';

interface SalesSearchAndFilterProps {
  onFilterChange: (filters: SalesFilters) => void;
  totalSales: number;
  filteredTotal: number;
}

export interface SalesFilters {
  search: string;
  startDate?: Date;
  endDate?: Date;
  cashier: string;
  paymentMethod: string;
  minAmount?: number;
  maxAmount?: number;
}

const paymentMethods = [
  { value: '', label: 'All Payment Methods' },
  { value: 'cash', label: 'Cash' },
  { value: 'card', label: 'Card' },
  { value: 'check', label: 'Check' },
  { value: 'digital', label: 'Digital Payment' },
];

const SalesSearchAndFilter: React.FC<SalesSearchAndFilterProps> = ({
  onFilterChange,
  totalSales,
  filteredTotal
}) => {
  const [filters, setFilters] = useState<SalesFilters>({
    search: '',
    cashier: '',
    paymentMethod: '',
  });
  
  const [showAdvanced, setShowAdvanced] = useState(false);

  const updateFilters = (newFilters: Partial<SalesFilters>) => {
    const updatedFilters = { ...filters, ...newFilters };
    setFilters(updatedFilters);
    onFilterChange(updatedFilters);
  };

  const clearAllFilters = () => {
    const clearedFilters: SalesFilters = {
      search: '',
      cashier: '',
      paymentMethod: '',
    };
    setFilters(clearedFilters);
    onFilterChange(clearedFilters);
    setShowAdvanced(false);
  };

  const hasActiveFilters = filters.search || filters.startDate || filters.endDate || 
    filters.cashier || filters.paymentMethod || filters.minAmount || filters.maxAmount;

  return (
    <Card>
      <CardContent className="p-6 space-y-4">
        {/* Basic Search Row */}
        <div className="flex flex-col md:flex-row gap-4">
          {/* Search Input */}
          <div className="flex-1">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <Input
                placeholder="Search by receipt number, cashier, or amount..."
                value={filters.search}
                onChange={(e) => updateFilters({ search: e.target.value })}
                className="pl-10"
              />
            </div>
          </div>

          {/* Quick Filters */}
          <div className="flex items-center gap-2">
            <Button
              variant={showAdvanced ? 'default' : 'outline'}
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="flex items-center gap-2"
            >
              <Filter className="w-4 h-4" />
              Advanced Filters
            </Button>
            
            {hasActiveFilters && (
              <Button
                variant="ghost"
                onClick={clearAllFilters}
                className="flex items-center gap-2 text-red-600 hover:text-red-700"
              >
                <X className="w-4 h-4" />
                Clear All
              </Button>
            )}
          </div>
        </div>

        {/* Advanced Filters */}
        {showAdvanced && (
          <div className="border-t pt-4 space-y-4">
            {/* Date Range */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label>Start Date</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className="w-full justify-start text-left font-normal"
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {filters.startDate ? format(filters.startDate, 'PPP') : 'Pick a date'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={filters.startDate}
                      onSelect={(date) => updateFilters({ startDate: date })}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>

              <div>
                <Label>End Date</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className="w-full justify-start text-left font-normal"
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {filters.endDate ? format(filters.endDate, 'PPP') : 'Pick a date'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={filters.endDate}
                      onSelect={(date) => updateFilters({ endDate: date })}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>

            {/* Cashier and Payment Method */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="cashier">Cashier Name</Label>
                <div className="relative">
                  <User className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                  <Input
                    id="cashier"
                    placeholder="Enter cashier name"
                    value={filters.cashier}
                    onChange={(e) => updateFilters({ cashier: e.target.value })}
                    className="pl-10"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="paymentMethod">Payment Method</Label>
                <div className="relative">
                  <CreditCard className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                  <select
                    id="paymentMethod"
                    value={filters.paymentMethod}
                    onChange={(e) => updateFilters({ paymentMethod: e.target.value })}
                    className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                  >
                    {paymentMethods.map(method => (
                      <option key={method.value} value={method.value}>
                        {method.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Amount Range */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="minAmount">Minimum Amount</Label>
                <div className="relative">
                  <DollarSign className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                  <Input
                    id="minAmount"
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={filters.minAmount || ''}
                    onChange={(e) => updateFilters({ 
                      minAmount: e.target.value ? parseFloat(e.target.value) : undefined 
                    })}
                    className="pl-10"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="maxAmount">Maximum Amount</Label>
                <div className="relative">
                  <DollarSign className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                  <Input
                    id="maxAmount"
                    type="number"
                    step="0.01"
                    placeholder="No limit"
                    value={filters.maxAmount || ''}
                    onChange={(e) => updateFilters({ 
                      maxAmount: e.target.value ? parseFloat(e.target.value) : undefined 
                    })}
                    className="pl-10"
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Active Filters Display */}
        {hasActiveFilters && (
          <div className="border-t pt-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-medium text-gray-700">Active filters:</span>
              
              {filters.search && (
                <Badge variant="secondary" className="flex items-center gap-1">
                  Search: "{filters.search}"
                  <X 
                    className="w-3 h-3 cursor-pointer" 
                    onClick={() => updateFilters({ search: '' })}
                  />
                </Badge>
              )}

              {filters.startDate && (
                <Badge variant="secondary" className="flex items-center gap-1">
                  From: {format(filters.startDate, 'MMM dd')}
                  <X 
                    className="w-3 h-3 cursor-pointer" 
                    onClick={() => updateFilters({ startDate: undefined })}
                  />
                </Badge>
              )}

              {filters.endDate && (
                <Badge variant="secondary" className="flex items-center gap-1">
                  To: {format(filters.endDate, 'MMM dd')}
                  <X 
                    className="w-3 h-3 cursor-pointer" 
                    onClick={() => updateFilters({ endDate: undefined })}
                  />
                </Badge>
              )}

              {filters.cashier && (
                <Badge variant="secondary" className="flex items-center gap-1">
                  Cashier: {filters.cashier}
                  <X 
                    className="w-3 h-3 cursor-pointer" 
                    onClick={() => updateFilters({ cashier: '' })}
                  />
                </Badge>
              )}

              {filters.paymentMethod && (
                <Badge variant="secondary" className="flex items-center gap-1">
                  Payment: {paymentMethods.find(m => m.value === filters.paymentMethod)?.label}
                  <X 
                    className="w-3 h-3 cursor-pointer" 
                    onClick={() => updateFilters({ paymentMethod: '' })}
                  />
                </Badge>
              )}

              {(filters.minAmount || filters.maxAmount) && (
                <Badge variant="secondary" className="flex items-center gap-1">
                  Amount: ${filters.minAmount || 0} - ${filters.maxAmount || '∞'}
                  <X 
                    className="w-3 h-3 cursor-pointer" 
                    onClick={() => updateFilters({ minAmount: undefined, maxAmount: undefined })}
                  />
                </Badge>
              )}
            </div>
          </div>
        )}

        {/* Results Summary */}
        <div className="border-t pt-4">
          <div className="flex justify-between items-center text-sm text-gray-600">
            <span>
              Showing {filteredTotal} of {totalSales} sales
              {hasActiveFilters && filteredTotal !== totalSales && (
                <span className="text-blue-600 font-medium ml-1">
                  (filtered)
                </span>
              )}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default SalesSearchAndFilter;