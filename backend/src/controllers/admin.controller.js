// ============================================================================
// ADMIN ANALYTICS CONTROLLER
// ============================================================================
// Powers the Admin Dashboard.
// Enforces STRICT Decimal.js aggregation to prevent frontend float distortion.
// Enforces Soft Delete security rule: `isDeleted: false` globally applied.
// ============================================================================

const { Decimal } = require('decimal.js');
const prisma = require('../lib/prisma');

// Use banker's rounding for exact financial precision
Decimal.set({ precision: 20, rounding: Decimal.ROUND_HALF_UP });

/**
 * Helper to get the start and end of the current local date.
 */
function getTodayBounds() {
  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
  const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
  return { startOfDay, endOfDay };
}

// ────────────────────────────────────────────────────────────────────────────
// 1. GET DASHBOARD KPIs
// ────────────────────────────────────────────────────────────────────────────
async function getDashboardKPIs(req, res) {
  try {
    const { startOfDay, endOfDay } = getTodayBounds();

    // Run aggregations in parallel for maximum performance
    const [incomeResult, expenseResult, todayIncomeResult] = await Promise.all([
      // Total Income (All Time)
      prisma.incomeLedger.aggregate({
        _sum: { amount: true },
        where: {
          isDeleted: false,
          status: 'SUCCESSFUL', // Exclude PENDING/FAILED digital payments
        },
      }),

      // Total Expenses (All Time)
      prisma.expenseLedger.aggregate({
        _sum: { amount: true },
        where: {
          isDeleted: false,
        },
      }),

      // Total Amount Collected Today
      prisma.incomeLedger.aggregate({
        _sum: { amount: true },
        where: {
          isDeleted: false,
          status: 'SUCCESSFUL',
          date: {
            gte: startOfDay,
            lte: endOfDay,
          },
        },
      }),
    ]);

    // Cast raw Prisma Decimal outputs to Decimal.js for safe arithmetic
    const totalIncome = new Decimal(incomeResult._sum.amount?.toString() || '0.00');
    const totalExpenses = new Decimal(expenseResult._sum.amount?.toString() || '0.00');
    const totalCollectedToday = new Decimal(todayIncomeResult._sum.amount?.toString() || '0.00');
    
    // Net Profit Calculation
    const netProfit = totalIncome.minus(totalExpenses);

    return res.status(200).json({
      success: true,
      data: {
        totalIncome: totalIncome.toFixed(2),
        totalExpenses: totalExpenses.toFixed(2),
        netProfit: netProfit.toFixed(2),
        totalCollectedToday: totalCollectedToday.toFixed(2),
      },
    });
  } catch (error) {
    console.error('[ADMIN CTRL] getDashboardKPIs error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to retrieve dashboard KPIs.',
    });
  }
}

// ────────────────────────────────────────────────────────────────────────────
// 2. GET LIVE OPERATIONS FEED
// ────────────────────────────────────────────────────────────────────────────
async function getLiveOperationsFeed(req, res) {
  try {
    const recentTransactions = await prisma.incomeLedger.findMany({
      where: {
        isDeleted: false,
        status: 'SUCCESSFUL',
      },
      orderBy: {
        date: 'desc', // Most recent first
      },
      take: 50, // Limit to 50
      select: {
        id: true,
        amount: true,
        paymentMethod: true,
        date: true,
        collectedBy: {
          select: {
            name: true,
          },
        },
        customer: {
          select: {
            customerId: true,
            name: true,
          }
        }
      },
    });

    // Format output (ensure Decimal is cast to string)
    const formattedFeed = recentTransactions.map((tx) => ({
      id: tx.id,
      amount: tx.amount.toString(),
      paymentMethod: tx.paymentMethod,
      date: tx.date,
      collectedBy: tx.collectedBy.name,
      customerName: tx.customer.name,
      customerId: tx.customer.customerId,
    }));

    return res.status(200).json({
      success: true,
      data: formattedFeed,
    });
  } catch (error) {
    console.error('[ADMIN CTRL] getLiveOperationsFeed error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to retrieve live operations feed.',
    });
  }
}

// ────────────────────────────────────────────────────────────────────────────
// 3. GET STAFF DAILY COLLECTION
// ────────────────────────────────────────────────────────────────────────────
async function getStaffDailyCollection(req, res) {
  try {
    const staffId = parseInt(req.params.staffId, 10);
    if (isNaN(staffId)) {
      return res.status(400).json({ success: false, error: 'Invalid staff ID.' });
    }

    const { startOfDay, endOfDay } = getTodayBounds();

    const collectionResult = await prisma.incomeLedger.aggregate({
      _sum: { amount: true },
      where: {
        isDeleted: false,
        status: 'SUCCESSFUL',
        paymentMethod: 'CASH', // Usually, "staff collection" refers to cash on hand
        collectedById: staffId,
        date: {
          gte: startOfDay,
          lte: endOfDay,
        },
      },
    });

    const totalCollected = new Decimal(collectionResult._sum.amount?.toString() || '0.00');

    return res.status(200).json({
      success: true,
      data: {
        staffId,
        date: startOfDay.toISOString().split('T')[0],
        totalCashCollectedToday: totalCollected.toFixed(2),
      },
    });
  } catch (error) {
    console.error('[ADMIN CTRL] getStaffDailyCollection error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to retrieve staff daily collection.',
    });
  }
}

module.exports = {
  getDashboardKPIs,
  getLiveOperationsFeed,
  getStaffDailyCollection,
};
