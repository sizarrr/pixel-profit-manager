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

    // Reports - NEW TRANSLATIONS
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
    total_sales: "Total Sales",
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

    // Auth
    store_pos: "Store POS",
    admin: "admin",
    cashier: "cashier",
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
    loading: "بارکردن...",
    success: "سەرکەوتن",
    error: "هەڵە",
    yes: "بەڵێ",
    no: "نەخێر",

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
    products_in_stock: "بەرهەمەکان لە کۆگا",
    sales_trends: "ڕەوتی فرۆشتن",
    category_distribution: "دابەشکردنی پۆلەکان",
    recent_sales: "فرۆشتنی دوایی",
    low_stock_alert: "ئاگاداریی کەمی کاڵا",
    items_low_stock: "بڕگە کەمن لە کۆگا",

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

    // Reports - KURDISH TRANSLATIONS
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
    total_sales: "کۆی فرۆشتن",
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

    // Auth
    store_pos: "سیستمی فرۆشگا",
    admin: "بەڕێوەبەر",
    cashier: "کاشێر",
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
    const translation = translations[language][key];
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
