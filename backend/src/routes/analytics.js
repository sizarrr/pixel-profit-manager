import express from 'express';
import { getRow, getAllRows } from '../database/init.js';

const router = express.Router();

// GET /api/analytics/dashboard - Get dashboard statistics
router.get('/dashboard', async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const thisMonth = new Date();
    thisMonth.setDate(1);
    const thisMonthStr = thisMonth.toISOString().split('T')[0];

    // Today's sales
    const todaysSales = await getRow(`
      SELECT COALESCE(SUM(total_amount), 0) as total
      FROM sales 
      WHERE DATE(created_at) = ?
    `, [today]);

    // This month's sales and profit calculation
    const monthlyStats = await getAllRows(`
      SELECT 
        s.total_amount,
        si.product_id,
        si.quantity,
        si.sell_price,
        p.buy_price
      FROM sales s
      JOIN sale_items si ON s.id = si.sale_id
      JOIN products p ON si.product_id = p.id
      WHERE DATE(s.created_at) >= ?
    `, [thisMonthStr]);

    let monthlySales = 0;
    let monthlyProfit = 0;

    monthlyStats.forEach(item => {
      monthlySales += item.sell_price * item.quantity;
      monthlyProfit += (item.sell_price - item.buy_price) * item.quantity;
    });

    // Low stock products (quantity <= 5)
    const lowStockProducts = await getAllRows(`
      SELECT id, name, category, quantity
      FROM products 
      WHERE quantity <= 5 
      ORDER BY quantity ASC
    `);

    // Category distribution
    const categoryDistribution = await getAllRows(`
      SELECT 
        category,
        SUM(sell_price * quantity) as value,
        SUM(quantity) as count
      FROM products
      GROUP BY category
      ORDER BY value DESC
    `);

    res.json({
      todaysSales: todaysSales.total,
      monthlyStats: {
        sales: monthlySales,
        profit: monthlyProfit
      },
      lowStockProducts: lowStockProducts.map(product => ({
        id: product.id,
        name: product.name,
        category: product.category,
        quantity: product.quantity
      })),
      categoryDistribution: categoryDistribution.map(cat => ({
        name: cat.category,
        value: cat.value,
        count: cat.count
      }))
    });
  } catch (error) {
    console.error('Error fetching dashboard analytics:', error);
    res.status(500).json({ error: 'Failed to fetch dashboard analytics' });
  }
});

// GET /api/analytics/monthly-sales - Get monthly sales data for charts
router.get('/monthly-sales', async (req, res) => {
  try {
    const { year = new Date().getFullYear() } = req.query;
    
    const monthlySalesData = await getAllRows(`
      SELECT 
        strftime('%m', s.created_at) as month,
        SUM(s.total_amount) as sales,
        SUM((si.sell_price - p.buy_price) * si.quantity) as profit
      FROM sales s
      JOIN sale_items si ON s.id = si.sale_id
      JOIN products p ON si.product_id = p.id
      WHERE strftime('%Y', s.created_at) = ?
      GROUP BY strftime('%m', s.created_at)
      ORDER BY month
    `, [year.toString()]);

    // Create array for all 12 months
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const result = months.map((month, index) => {
      const monthData = monthlySalesData.find(data => parseInt(data.month) === index + 1);
      return {
        month,
        sales: monthData ? monthData.sales : 0,
        profit: monthData ? monthData.profit : 0
      };
    });

    res.json(result);
  } catch (error) {
    console.error('Error fetching monthly sales data:', error);
    res.status(500).json({ error: 'Failed to fetch monthly sales data' });
  }
});

// GET /api/analytics/top-products - Get top selling products
router.get('/top-products', async (req, res) => {
  try {
    const { limit = 10, period = '30' } = req.query;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(period));
    const startDateStr = startDate.toISOString().split('T')[0];

    const topProducts = await getAllRows(`
      SELECT 
        si.product_name,
        si.product_id,
        SUM(si.quantity) as total_sold,
        SUM(si.total) as total_revenue,
        COUNT(DISTINCT si.sale_id) as times_sold
      FROM sale_items si
      JOIN sales s ON si.sale_id = s.id
      WHERE DATE(s.created_at) >= ?
      GROUP BY si.product_id, si.product_name
      ORDER BY total_sold DESC
      LIMIT ?
    `, [startDateStr, parseInt(limit)]);

    res.json(topProducts.map(product => ({
      productId: product.product_id,
      productName: product.product_name,
      totalSold: product.total_sold,
      totalRevenue: product.total_revenue,
      timesSold: product.times_sold
    })));
  } catch (error) {
    console.error('Error fetching top products:', error);
    res.status(500).json({ error: 'Failed to fetch top products' });
  }
});

// GET /api/analytics/sales-by-date - Get sales data by date range
router.get('/sales-by-date', async (req, res) => {
  try {
    const { startDate, endDate, groupBy = 'day' } = req.query;
    
    if (!startDate || !endDate) {
      return res.status(400).json({ error: 'Start date and end date are required' });
    }

    let dateFormat;
    switch (groupBy) {
      case 'month':
        dateFormat = '%Y-%m';
        break;
      case 'week':
        dateFormat = '%Y-%W';
        break;
      default:
        dateFormat = '%Y-%m-%d';
    }

    const salesData = await getAllRows(`
      SELECT 
        strftime('${dateFormat}', created_at) as period,
        COUNT(*) as transaction_count,
        SUM(total_amount) as total_sales,
        AVG(total_amount) as average_sale
      FROM sales
      WHERE DATE(created_at) BETWEEN ? AND ?
      GROUP BY strftime('${dateFormat}', created_at)
      ORDER BY period
    `, [startDate, endDate]);

    res.json(salesData.map(data => ({
      period: data.period,
      transactionCount: data.transaction_count,
      totalSales: data.total_sales,
      averageSale: data.average_sale
    })));
  } catch (error) {
    console.error('Error fetching sales by date:', error);
    res.status(500).json({ error: 'Failed to fetch sales by date' });
  }
});

// GET /api/analytics/inventory-value - Get total inventory value
router.get('/inventory-value', async (req, res) => {
  try {
    const inventoryValue = await getRow(`
      SELECT 
        SUM(buy_price * quantity) as cost_value,
        SUM(sell_price * quantity) as retail_value,
        COUNT(*) as total_products,
        SUM(quantity) as total_items
      FROM products
    `);

    const categoryBreakdown = await getAllRows(`
      SELECT 
        category,
        SUM(buy_price * quantity) as cost_value,
        SUM(sell_price * quantity) as retail_value,
        COUNT(*) as product_count,
        SUM(quantity) as item_count
      FROM products
      GROUP BY category
      ORDER BY retail_value DESC
    `);

    res.json({
      summary: {
        costValue: inventoryValue.cost_value || 0,
        retailValue: inventoryValue.retail_value || 0,
        totalProducts: inventoryValue.total_products,
        totalItems: inventoryValue.total_items,
        potentialProfit: (inventoryValue.retail_value || 0) - (inventoryValue.cost_value || 0)
      },
      categoryBreakdown: categoryBreakdown.map(cat => ({
        category: cat.category,
        costValue: cat.cost_value,
        retailValue: cat.retail_value,
        productCount: cat.product_count,
        itemCount: cat.item_count,
        potentialProfit: cat.retail_value - cat.cost_value
      }))
    });
  } catch (error) {
    console.error('Error fetching inventory value:', error);
    res.status(500).json({ error: 'Failed to fetch inventory value' });
  }
});

// GET /api/analytics/profit-analysis - Get profit analysis
router.get('/profit-analysis', async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const today = new Date().toISOString().split('T')[0];
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const thirtyDaysAgoStr = thirtyDaysAgo.toISOString().split('T')[0];

    const start = startDate || thirtyDaysAgoStr;
    const end = endDate || today;

    const profitData = await getAllRows(`
      SELECT 
        s.created_at,
        s.total_amount as revenue,
        SUM((si.sell_price - p.buy_price) * si.quantity) as profit,
        SUM(p.buy_price * si.quantity) as cost
      FROM sales s
      JOIN sale_items si ON s.id = si.sale_id
      JOIN products p ON si.product_id = p.id
      WHERE DATE(s.created_at) BETWEEN ? AND ?
      GROUP BY s.id, s.created_at, s.total_amount
      ORDER BY s.created_at DESC
    `, [start, end]);

    const summary = profitData.reduce((acc, sale) => ({
      totalRevenue: acc.totalRevenue + sale.revenue,
      totalProfit: acc.totalProfit + sale.profit,
      totalCost: acc.totalCost + sale.cost,
      transactionCount: acc.transactionCount + 1
    }), { totalRevenue: 0, totalProfit: 0, totalCost: 0, transactionCount: 0 });

    const profitMargin = summary.totalRevenue > 0 ? (summary.totalProfit / summary.totalRevenue) * 100 : 0;

    res.json({
      summary: {
        ...summary,
        profitMargin,
        averageProfit: summary.transactionCount > 0 ? summary.totalProfit / summary.transactionCount : 0
      },
      transactions: profitData.map(sale => ({
        date: sale.created_at,
        revenue: sale.revenue,
        profit: sale.profit,
        cost: sale.cost,
        profitMargin: sale.revenue > 0 ? (sale.profit / sale.revenue) * 100 : 0
      })),
      dateRange: { start, end }
    });
  } catch (error) {
    console.error('Error fetching profit analysis:', error);
    res.status(500).json({ error: 'Failed to fetch profit analysis' });
  }
});

export default router;