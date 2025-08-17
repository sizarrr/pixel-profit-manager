import React, { createContext, useContext, useState, ReactNode } from "react";

type Language = "en" | "ku";

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string) => string;
}

const translations = {
  en: {
    // Common
    welcome: "Welcome back",
    search: "Search",
    cancel: "Cancel",
    save: "Save",
    delete: "Delete",
    edit: "Edit",
    add: "Add",
    close: "Close",
    confirm: "Confirm",
    loading: "Loading...",
    success: "Success",
    error: "Error",
    yes: "Yes",
    no: "No",
    update: "Update",
    optional: "Optional",
    required: "Required",
    tip: "Tip",

    // Navigation
    dashboard: "Dashboard",
    products: "Products",
    sales: "Sales",
    reports: "Reports",
    users: "Users",
    logout: "Sign out",

    // Dashboard
    overview: "Overview of your store performance",
    total_sales_today: "Total Sales Today",
    monthly_sales: "Monthly Sales",
    total_profit: "Total Profit",
    products_in_stock: "Products in Stock",
    sales_trends: "Sales Trends",
    category_distribution: "Category Distribution",
    recent_sales: "Recent Sales",
    low_stock_alert: "Low Stock Alert",
    items_low_stock: "items are running low on stock",
    monthly_sales_profit_trends: "Monthly Sales & Profit Trends",
    total_sales: "Total Sales",
    total_profit_display: "Total Profit",
    loading_chart_data: "Loading chart data...",
    loading_recent_sales: "Loading recent sales...",
    no_recent_sales: "No recent sales",
    sales_appear_here:
      "Sales will appear here once you start making transactions",
    error_loading_sales_data: "Error loading sales data",
    no_sales_data: "No Sales Data",
    start_making_sales: "Start making sales to see your trends here!",
    unable_load_chart_data: "Unable to load chart data. Please try again.",
    failed_load_sales_data: "Failed to load sales data",

    // Products
    manage_inventory: "Manage your inventory and product catalog",
    add_product: "Add Product",
    add_new_product: "Add New Product",
    product_name: "Product Name",
    category: "Category",
    buy_price: "Buy Price",
    sell_price: "Sell Price",
    quantity: "Quantity",
    initial_quantity: "Initial Quantity",
    description: "Description",
    in_stock: "in stock",
    low_stock: "Low Stock",
    profit_per_unit: "Profit per unit",
    no_products_found: "No products found",
    adjust_search: "Try adjusting your search or filter criteria.",
    add_first_product: "Get started by adding your first product.",
    all_categories: "All Categories",
    delete_product_confirm: "Are you sure you want to delete this product?",
    barcode: "Barcode",
    enter_scan_barcode: "Enter or scan barcode",
    low_stock_threshold: "Low Stock Alert",
    low_stock_alert_description: "Low Stock Alert",
    edit_product: "Edit Product",
    update_product: "Update Product",
    product_updated_success: "Product updated successfully!",
    failed_update_product: "Failed to update product. Please try again.",
    enter_product_name: "Enter product name",
    enter_product_description: "Enter product description",

    // Bulk Operations
    bulk_operations: "Bulk Operations",
    bulk_update: "Bulk Update",
    bulk_delete: "Bulk Delete",
    products_selected: "Products Selected",
    selected_products: "Selected Products",
    no_products_found_selection: "No products found",
    update_options: "Update Options",
    new_category: "New Category",
    leave_empty_keep_current: "Leave empty to keep current",
    buy_price_multiplier: "Buy Price Multiplier",
    sell_price_multiplier: "Sell Price Multiplier",
    price_multiplier_tip:
      "Price multipliers will be applied to existing prices. For example, 1.1 increases prices by 10%, 0.9 decreases by 10%.",
    price_increase_example: "e.g., 1.1 for 10% increase",
    soft_delete_warning: "Soft Delete Warning",
    products_marked_inactive:
      "This will mark {count} product{plural} as inactive. They will be hidden from normal views but can be restored later.",
    understand_deactivate:
      "I understand this will deactivate the selected products",
    updating: "Updating...",
    deleting: "Deleting...",
    update_products_count: "Update {count} Product{plural}",
    delete_products_count: "Delete {count} Product{plural}",
    successfully_updated: "Successfully updated {count} product{plural}",
    successfully_deleted: "Successfully deleted {count} product{plural}",
    failed_update: "Failed to update {count} product{plural}",
    failed_delete: "Failed to delete {count} product{plural}",
    specify_field_update: "Please specify at least one field to update",
    confirm_delete_operation: "Please confirm the delete operation",
    unexpected_error_bulk_update:
      "An unexpected error occurred during bulk update",
    unexpected_error_bulk_delete:
      "An unexpected error occurred during bulk delete",
    bulk_actions: "Bulk Actions",
    select_all_products: "Select All Products",
    selected: "selected",
    clear_selection: "Clear Selection",

    // Sales
    select_products: "Select products to add to cart",
    shopping_cart: "Shopping Cart",
    your_cart_empty: "Your cart is empty",
    add_to_cart: "Add to Cart",
    order_summary: "Order Summary",
    total: "Total",
    process_sale: "Process Sale",
    processing: "Processing...",
    print_receipt: "Print Receipt",
    sale_completed: "Sale Completed",
    sale_processed: "processed successfully!",
    empty_cart: "Empty Cart",
    add_items_first: "Please add items to cart before processing sale.",
    insufficient_stock: "Insufficient Stock",
    only_units_available: "Only {count} units available in stock.",
    no_products_available: "No products available",
    no_products_match: "No products match your search.",
    no_products_stock: "No products in stock.",
    receipt_number: "Receipt Number",
    date_unavailable: "Date unavailable",
    no_products: "No products",
    unknown_product: "Unknown Product",
    unknown: "Unknown",
    cashier: "Cashier",

    // Sales Search and Filter
    search_receipt_cashier_amount:
      "Search by receipt number, cashier, or amount...",
    advanced_filters: "Advanced Filters",
    clear_all: "Clear All",
    start_date: "Start Date",
    end_date: "End Date",
    pick_date: "Pick a date",
    cashier_name: "Cashier Name",
    enter_cashier_name: "Enter cashier name",
    payment_method: "Payment Method",
    all_payment_methods: "All Payment Methods",
    cash: "Cash",
    card: "Card",
    check: "Check",
    digital_payment: "Digital Payment",
    minimum_amount: "Minimum Amount",
    maximum_amount: "Maximum Amount",
    no_limit: "No limit",
    active_filters: "Active filters",
    search_term: "Search",
    from_date: "From",
    to_date: "To",
    payment_filter: "Payment",
    amount_range: "Amount",
    showing_sales: "Showing {filtered} of {total} sales",
    filtered: "filtered",

    // Reports
    reports_overview: "Comprehensive analytics and insights for your store",
    time_period: "Time Period",
    today: "Today",
    yesterday: "Yesterday",
    last_7_days: "Last 7 days",
    last_30_days: "Last 30 days",
    this_month: "This Month",
    last_month: "Last Month",
    last_90_days: "Last 90 days",
    last_year: "Last Year",
    total_revenue: "Total Revenue",
    avg_sale_value: "Avg. Sale Value",
    profit_margin: "Profit Margin",
    sales_analytics: "Sales Analytics",
    product_reports: "Product Reports",
    inventory_status: "Inventory Status",
    financial_summary: "Financial Summary",
    sales_trend: "Sales Trend",
    top_selling_products: "Top Selling Products",
    top_products_by_revenue: "Top Products by Revenue",
    category_performance: "Category Performance",
    inventory_value_by_category: "Inventory Value by Category",
    inventory_summary: "Inventory Summary by Category",
    profit_trend_analysis: "Profit Trend Analysis",
    export_sales: "Export Sales",
    export_products: "Export Products",
    refresh: "Refresh",
    no_low_stock_items: "No low stock items",
    alert_at: "Alert at",
    sold_units: "Sold: {count} units",
    from_transactions: "From {count} transactions",
    inventory_value: "Inventory Value",

    // Form validation
    required_field: "This field is required",
    price_greater_zero: "Price must be greater than 0",
    quantity_not_negative: "Quantity cannot be negative",
    product_added_success: "Product added successfully!",
    failed_add_product: "Failed to add product. Please try again.",
    sell_price_greater_buy_price: "Sell price must be >= buy price",

    // Auth & Header
    store_pos: "Store POS",
    admin: "admin",
    cashier: "cashier",
    english: "English",
    kurdish: "کوردی",

    // Chart specific
    sales_chart_title: "📈 Monthly Sales & Profit Trends",
    category_chart_title: "🏷️ Category Distribution",
    sales_label: "Sales",
    profit_label: "Profit",
    quantity_label: "Quantity",
    items: "items",

    // Status messages
    retry: "Retry",
    check_connection: "Please check your connection and try again",
    left: "left",
    value: "value",

    // Dashboard stats
    change_positive: "+12%",
    change_monthly_sales: "+8%",
    change_monthly_profit: "+15%",
    loading_data: "Loading data...",
    error_loading_data: "Error loading data",
  },
  ku: {
    // Common
    welcome: "بەخێربێیتەوە",
    search: "گەڕان",
    cancel: "هەڵوەشاندنەوە",
    save: "پاشەکەوتکردن",
    delete: "سڕینەوە",
    edit: "دەستکاریکردن",
    add: "زیادکردن",
    close: "داخستن",
    confirm: "پشتڕاستکردنەوە",
    loading: "لۆدینگ",
    success: "سەرکەوتووبوو",
    error: "هەڵە",
    yes: "بەڵێ",
    no: "نەخێر",
    update: "نوێکردنەوە",
    optional: "ئیختیاری",
    required: "پێویست",
    tip: "ئامۆژگاری",

    // Navigation
    dashboard: "داشبۆرد",
    products: "بەرهەمەکان",
    sales: "فرۆشتن",
    reports: "ڕاپۆرتەکان",
    users: "بەکارهێنەران",
    logout: "چوونەدەرەوە",

    // Dashboard
    overview: "تێروانینێک بۆ کارکردنی فرۆشگاکەت",
    total_sales_today: "کۆی فرۆشتنی ئەمڕۆ",
    monthly_sales: "فرۆشتنی مانگانە",
    total_profit: "کۆی قازانج",
    products_in_stock: "بەرهەمەکانی ناو کۆگا",
    sales_trends: "ڕەوتی فرۆشتن",
    category_distribution: "دابەشکردنی پۆلەکان",
    recent_sales: "فرۆشتنی ئەم دواییانە",
    low_stock_alert: "ئاگاداریی کەمی کاڵا",
    items_low_stock: "ئەم بەرهەمە کەمە لە ناو کۆگا",
    monthly_sales_profit_trends: "ڕەوتی فرۆشتن و قازانجی مانگانە",
    total_sales: "کۆی فرۆشتن",
    total_profit_display: "کۆی قازانج",
    loading_chart_data: "بارکردنی زانیاریەکانی چارت...",
    loading_recent_sales: "بارکردنی فرۆشتنی دوایی...",
    no_recent_sales: "فرۆشتنی دوایی نییە",
    sales_appear_here:
      "فرۆشتنەکان لێرە دەردەکەون کاتێک دەست بە مامەڵەکان دەکەیت",
    error_loading_sales_data: "هەڵە لە بارکردنی زانیاریەکانی فرۆشتن",
    no_sales_data: "زانیاریی فرۆشتن نییە",
    start_making_sales: "دەست بە فرۆشتن بکە بۆ بینینی ڕەوتەکانت لێرە!",
    unable_load_chart_data:
      "ناتوانرێت زانیاریەکانی چارت بار بکرێت. تکایە دووبارە هەوڵبدەوە.",
    failed_load_sales_data: "سەرکەوتوو نەبوو لە بارکردنی زانیاریەکانی فرۆشتن",

    // Products
    manage_inventory: "بەڕێوەبردنی کۆگا و کاتالۆگی بەرهەمەکان",
    add_product: "زیادکردنی بەرهەم",
    add_new_product: "زیادکردنی بەرهەمی نوێ",
    product_name: "ناوی بەرهەم",
    category: "پۆل",
    buy_price: "نرخی کڕین",
    sell_price: "نرخی فرۆشتن",
    quantity: "بڕ",
    initial_quantity: "بڕی سەرەتایی",
    description: "وەسف",
    in_stock: "لە کۆگا",
    low_stock: "کەمی کاڵا",
    profit_per_unit: "قازانج بۆ هەر یەکە",
    no_products_found: "هیچ بەرهەمێک نەدۆزرایەوە",
    adjust_search: "هەوڵبدە گەڕان یان فلتەرەکانت بگۆڕیت.",
    add_first_product: "دەست پێبکە بە زیادکردنی یەکەم بەرهەمت.",
    all_categories: "هەموو پۆلەکان",
    delete_product_confirm: "دڵنیایت لە سڕینەوەی ئەم بەرهەمە؟",
    barcode: "کۆدی کاڵا",
    enter_scan_barcode: "کۆدی کاڵا بنووسە یان بیخوێنەوە",
    low_stock_threshold: "ئاگاداریی کەمی کاڵا",
    low_stock_alert_description: "ئاگاداریی کەمی کاڵا",
    edit_product: "دەستکاری کردنی بەرهەم",
    update_product: "نوێکردنەوەی بەرهەم",
    product_updated_success: "بەرهەم بە سەرکەوتوویی نوێکرایەوە!",
    failed_update_product:
      "سەرکەوتوو نەبوو لە نوێکردنەوەی بەرهەم. دووبارە هەوڵبدەوە.",
    enter_product_name: "ناوی بەرهەم بنووسە",
    enter_product_description: "وەسفی بەرهەم بنووسە",

    // Bulk Operations
    bulk_operations: "کارەکانی کۆمەڵ",
    bulk_update: "نوێکردنەوەی کۆمەڵ",
    bulk_delete: "سڕینەوەی کۆمەڵ",
    products_selected: "بەرهەم هەڵبژێردراوە",
    selected_products: "بەرهەمە هەڵبژێردراوەکان",
    no_products_found_selection: "هیچ بەرهەمێک نەدۆزرایەوە",
    update_options: "بژاردەکانی نوێکردنەوە",
    new_category: "پۆلی نوێ",
    leave_empty_keep_current: "بەتاڵی بێڵە بۆ پاراستنی ئێستا",
    buy_price_multiplier: "لێکەری نرخی کڕین",
    sell_price_multiplier: "لێکەری نرخی فرۆشتن",
    price_multiplier_tip:
      "لێکەری نرخەکان لەسەر نرخەکانی ئێستا جێبەجێ دەکرێت. نموونە، ١.١ نرخەکان بە ١٠٪ زیاد دەکات، ٠.٩ بە ١٠٪ کەم دەکاتەوە.",
    price_increase_example: "نموونە، ١.١ بۆ زیادکردنی ١٠٪",
    soft_delete_warning: "ئاگاداریی سڕینەوەی نەرم",
    products_marked_inactive:
      "ئەمە {count} بەرهەم{plural} وەک ناچالاک نیشان دەکات. لە بینینە ئاساییەکان شاردەونەتەوە بەڵام دەتوانرێت دوابارە گەڕێنرێتەوە.",
    understand_deactivate:
      "تێدەگەم کە ئەمە بەرهەمە هەڵبژێردراوەکان ناچالاک دەکات",
    updating: "نوێکردنەوە...",
    deleting: "سڕینەوە...",
    update_products_count: "نوێکردنەوەی {count} بەرهەم{plural}",
    delete_products_count: "سڕینەوەی {count} بەرهەم{plural}",
    successfully_updated: "بە سەرکەوتوویی {count} بەرهەم{plural} نوێکرایەوە",
    successfully_deleted: "بە سەرکەوتوویی {count} بەرهەم{plural} سڕایەوە",
    failed_update: "سەرکەوتوو نەبوو لە نوێکردنەوەی {count} بەرهەم{plural}",
    failed_delete: "سەرکەوتوو نەبوو لە سڕینەوەی {count} بەرهەم{plural}",
    specify_field_update: "تکایە لانیکەم یەک خانە دیاری بکە بۆ نوێکردنەوە",
    confirm_delete_operation: "تکایە کردارەکەی سڕینەوە پشتڕاست بکەرەوە",
    unexpected_error_bulk_update:
      "هەڵەیەکی چاوەڕوان نەکراو ڕوویدا لە کاتی نوێکردنەوەی کۆمەڵدا",
    unexpected_error_bulk_delete:
      "هەڵەیەکی چاوەڕوان نەکراو ڕوویدا لە کاتی سڕینەوەی کۆمەڵدا",
    bulk_actions: "کردارەکانی کۆمەڵ",
    select_all_products: "هەموو بەرهەمەکان هەڵبژێرە",
    selected: "هەڵبژێردراو",
    clear_selection: "پاککردنەوەی هەڵبژاردن",

    // Sales
    select_products: "بەرهەمەکان هەڵبژێرە بۆ زیادکردن بۆ سەبەتە",
    shopping_cart: "سەبەتی کڕین",
    your_cart_empty: "سەبەتەکەت بەتاڵە",
    add_to_cart: "زیادکردن بۆ سەبەتە",
    order_summary: "پوختەی داواکاری",
    total: "کۆ",
    process_sale: "ئەنجامدانی فرۆشتن",
    processing: "ئەنجامدان...",
    print_receipt: "چاپکردنی وەسڵ",
    sale_completed: "فرۆشتن تەواوبوو",
    sale_processed: "بە سەرکەوتوویی ئەنجامدرا!",
    empty_cart: "سەبەتی بەتاڵ",
    add_items_first: "تکایە پێش ئەنجامدانی فرۆشتن شتەکان بۆ سەبەتە زیادبکە.",
    insufficient_stock: "کەمی کاڵا",
    only_units_available: "تەنها {count} یەکە لە کۆگا هەیە.",
    no_products_available: "هیچ بەرهەمێک بەردەست نییە",
    no_products_match: "هیچ بەرهەمێک لەگەڵ گەڕانەکەت ناگونجێت.",
    no_products_stock: "هیچ بەرهەمێک لە کۆگا نییە.",
    receipt_number: "ژمارەی وەسڵ",
    date_unavailable: "بەروار بەردەست نییە",
    no_products: "بەرهەم نییە",
    unknown_product: "بەرهەمی نەناسراو",
    unknown: "نەناسراو",
    cashier: "کاشێر",

    // Sales Search and Filter
    search_receipt_cashier_amount: "گەڕان بەپێی ژمارەی وەسڵ، کاشێر، یان بڕ...",
    advanced_filters: "فلتەرە پێشکەوتووەکان",
    clear_all: "پاککردنەوەی هەموو",
    start_date: "بەرواری دەستپێک",
    end_date: "بەرواری کۆتایی",
    pick_date: "بەرواری هەڵبژێرە",
    cashier_name: "ناوی کاشێر",
    enter_cashier_name: "ناوی کاشێر بنووسە",
    payment_method: "شێوازی پارەدان",
    all_payment_methods: "هەموو شێوازەکانی پارەدان",
    cash: "نەقد",
    card: "کارت",
    check: "چێک",
    digital_payment: "پارەدانی دیجیتاڵ",
    minimum_amount: "کەمترین بڕ",
    maximum_amount: "زۆرترین بڕ",
    no_limit: "سنوور نییە",
    active_filters: "فلتەرە چالاکەکان",
    search_term: "گەڕان",
    from_date: "لە",
    to_date: "بۆ",
    payment_filter: "پارەدان",
    amount_range: "مەودای بڕ",
    showing_sales: "پیشاندانی {filtered} لە {total} فرۆشتن",
    filtered: "فلتەرکراو",

    // Reports
    reports_overview: "شیکاری تەواو و تێگەیشتن بۆ فرۆشگاکەت",
    time_period: "ماوەی کات",
    today: "ئەمڕۆ",
    yesterday: "دوێنێ",
    last_7_days: "دوایین ٧ ڕۆژ",
    last_30_days: "دوایین ٣٠ ڕۆژ",
    this_month: "ئەم مانگە",
    last_month: "مانگی ڕابردوو",
    last_90_days: "دوایین ٩٠ ڕۆژ",
    last_year: "ساڵی ڕابردوو",
    total_revenue: "کۆی داهات",
    avg_sale_value: "نرخی ناوەندی فرۆشتن",
    profit_margin: "ڕێژەی قازانج",
    sales_analytics: "شیکاری فرۆشتن",
    product_reports: "ڕاپۆرتی بەرهەمەکان",
    inventory_status: "دۆخی کۆگا",
    financial_summary: "پوختەی دارایی",
    sales_trend: "ڕەوتی فرۆشتن",
    top_selling_products: "بەرهەمە زۆر فرۆشراوەکان",
    top_products_by_revenue: "بەرهەمەکان بەپێی داهات",
    category_performance: "کارکردنی پۆلەکان",
    inventory_value_by_category: "نرخی کۆگا بەپێی پۆل",
    inventory_summary: "پوختەی کۆگا بەپێی پۆل",
    profit_trend_analysis: "شیکاری ڕەوتی قازانج",
    export_sales: "دەرهێنانی فرۆشتنەکان",
    export_products: "دەرهێنانی بەرهەمەکان",
    refresh: "نوێکردنەوە",
    no_low_stock_items: "هیچ کاڵایەکی کەم نییە",
    alert_at: "ئاگاداری لە",
    sold_units: "فرۆشراو: {count} دانە",
    from_transactions: "لە {count} مامەڵە",
    inventory_value: "نرخی کۆگا",

    // Form validation
    required_field: "ئەم خانەیە پێویستە",
    price_greater_zero: "نرخ دەبێت لە ٠ زیاتر بێت",
    quantity_not_negative: "بڕ ناتوانێت نەرێنی بێت",
    product_added_success: "بەرهەم بە سەرکەوتوویی زیادکرا!",
    failed_add_product: "زیادکردنی بەرهەم سەرکەوتوو نەبوو. دووبارە هەوڵبدەوە.",
    sell_price_greater_buy_price: "نرخی فرۆشتن دەبێت >= نرخی کڕین",

    // Auth & Header
    store_pos: "سیستمی فرۆشگا",
    admin: "بەڕێوەبەر",
    cashier: "کاشێر",
    english: "English",
    kurdish: "کوردی",

    // Chart specific
    sales_chart_title: "📈 ڕەوتی فرۆشتن و قازانجی مانگانە",
    category_chart_title: "🏷️ دابەشکردنی پۆلەکان",
    sales_label: "فرۆشتن",
    profit_label: "قازانج",
    quantity_label: "بڕ",
    items: "بڕگە",

    // Status messages
    retry: "دووبارە هەوڵبدە",
    check_connection: "تکایە پەیوەندیەکەت بپشکنە و دووبارە هەوڵبدەوە",
    left: "مایەوە",
    value: "نرخ",

    // Dashboard stats
    change_positive: "+١٢٪",
    change_monthly_sales: "+٨٪",
    change_monthly_profit: "+١٥٪",
    loading_data: "بارکردنی زانیارییەکان...",
    error_loading_data: "هەڵە لە بارکردنی زانیارییەکان",
  },
};

const LanguageContext = createContext<LanguageContextType | undefined>(
  undefined
);

export const LanguageProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  const [language, setLanguage] = useState<Language>("en");

  const t = (key: string): string => {
    const translation =
      translations[language][key as keyof typeof translations.en];
    if (!translation) {
      console.warn(
        `Translation missing for key: ${key} in language: ${language}`
      );
      return key;
    }
    return translation;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    throw new Error("useLanguage must be used within a LanguageProvider");
  }
  return context;
};
