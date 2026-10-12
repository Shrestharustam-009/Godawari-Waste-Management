const { Decimal } = require('decimal.js');
const crypto = require('crypto');
const prisma = require('../lib/prisma');
const {
  createCategorySchema,
  logManualIncomeSchema,
  logExpenseSchema,
  getFinancialStatementsSchema
} = require('../validators/accounting.validator');
const { z } = require('zod');
const { getIO } = require('../sockets/socketSetup');

// Ensure proper rounding and precision for financial calculations
Decimal.set({ precision: 20, rounding: Decimal.ROUND_HALF_UP });

// ============================================================================
// 1. THE CATEGORY ENGINE
// ============================================================================

async function createCategory(req, res) {
  try {
    const parseResult = createCategorySchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        success: false,
        errors: parseResult.error.errors.map(e => ({ field: e.path.join('.'), message: e.message }))
      });
    }

    const { name, description, type } = parseResult.data;

    let category;
    if (type === 'INCOME') {
      const existing = await prisma.incomeCategory.findUnique({ where: { name } });
      if (existing) return res.status(409).json({ success: false, error: 'Income category already exists.' });
      category = await prisma.incomeCategory.create({ data: { name, description } });
    } else if (type === 'EXPENSE') {
      const existing = await prisma.expenseCategory.findUnique({ where: { name } });
      if (existing) return res.status(409).json({ success: false, error: 'Expense category already exists.' });
      category = await prisma.expenseCategory.create({ data: { name, description } });
    } else if (type === 'VEHICLE_EXPENSE') {
      const existing = await prisma.vehicleExpenseCategory.findUnique({ where: { name } });
      if (existing) return res.status(409).json({ success: false, error: 'Vehicle expense category already exists.' });
      category = await prisma.vehicleExpenseCategory.create({ data: { name, description } });
    } else {
      return res.status(400).json({ success: false, error: 'Invalid category type.' });
    }

    return res.status(201).json({ success: true, data: category });
  } catch (error) {
    console.error('[ACCOUNTING] createCategory error:', error);
    return res.status(500).json({ success: false, error: 'Failed to create category.' });
  }
}

async function getAllCategories(req, res) {
  try {
    const [incomeCategories, expenseCategories, vehicleExpenseCategories] = await Promise.all([
      prisma.incomeCategory.findMany({ where: { isActive: true }, orderBy: { name: 'asc' } }),
      prisma.expenseCategory.findMany({ where: { isActive: true }, orderBy: { name: 'asc' } }),
      prisma.vehicleExpenseCategory.findMany({ where: { isActive: true }, orderBy: { name: 'asc' } })
    ]);

    return res.status(200).json({
      success: true,
      data: {
        income: incomeCategories,
        expense: expenseCategories,
        vehicleExpense: vehicleExpenseCategories
      }
    });
  } catch (error) {
    console.error('[ACCOUNTING] getAllCategories error:', error);
    return res.status(500).json({ success: false, error: 'Failed to retrieve categories.' });
  }
}

// ============================================================================
// 2. INCOME STREAM (Dynamic VAT Splitter)
// ============================================================================

async function logManualIncome(req, res) {
  try {
    // Re-use or define local safe parse if schema changes. Assuming original schema works.
    const { amount, categoryId, subCategory, date, notes, customerId } = req.body;
    
    if (!amount || !categoryId || !date) {
      return res.status(400).json({ success: false, error: 'Missing required fields' });
    }

    // Verify category exists
    const category = await prisma.incomeCategory.findUnique({ where: { id: categoryId } });
    if (!category || !category.isActive) {
      return res.status(404).json({ success: false, error: 'Income category not found or inactive.' });
    }

    // DYNAMIC VAT SPLITTER
    const grossAmount = new Decimal(amount);
    let baseAmount = grossAmount;
    let vatAmount = new Decimal(0);
    let vatRate = new Decimal(0);

    if (category.name === 'Monthly Collection Fee') {
      // It's a field income / monthly fee, automatically split 13% Output VAT.
      // Base Revenue = Total Collected / 1.13
      // VAT Amount = Total Collected - Base Revenue
      vatRate = new Decimal(13);
      baseAmount = grossAmount.dividedBy(1.13).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
      vatAmount = grossAmount.minus(baseAmount).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
    }

    const resolvedCustomerId = customerId || 'MANUAL_ENTRY';

    // Transaction to safely update customer balances and ledger
    const result = await prisma.$transaction(async (tx) => {
      let customer = await tx.customer.findUnique({ where: { customerId: resolvedCustomerId } });
      
      if (!customer) {
        customer = await tx.customer.create({
          data: {
            customerId: resolvedCustomerId,
            name: 'General Manual Income',
            phone: '0000000000',
            pinHash: 'SYS',
            assignedArea: 'System',
            outstandingPayment: 0,
            advanceBalance: 0
          }
        });
      }

      // SMART WALLET & DEBT MATH
      let newOutstanding = new Decimal(customer.outstandingPayment || 0);
      let newAdvance = new Decimal(customer.advanceBalance || 0);

      if (grossAmount.greaterThan(newOutstanding)) {
        const remainder = grossAmount.minus(newOutstanding);
        newOutstanding = new Decimal(0);
        newAdvance = newAdvance.plus(remainder);
      } else {
        newOutstanding = newOutstanding.minus(grossAmount);
      }

      // SET AUDIT LOG USER CONTEXT
      await tx.$executeRaw`SET LOCAL app.current_user_id = ${String(req.user.id)}`;

      // UPDATE CUSTOMER
      await tx.customer.update({
        where: { customerId: resolvedCustomerId },
        data: {
          outstandingPayment: newOutstanding.toFixed(2),
          advanceBalance: newAdvance.toFixed(2)
        }
      });

      // CREATE LEDGER
      const entry = await tx.incomeLedger.create({
        data: {
          date: new Date(date),
          amount: grossAmount.toFixed(2),
          baseAmount: baseAmount.toFixed(2),
          vatRate: vatRate.toFixed(2),
          vatAmount: vatAmount.toFixed(2),
          paymentMethod: 'CASH', 
          source: category.name === 'Monthly Collection Fee' ? 'FIELD_APP' : 'MANUAL_ENTRY',
          status: 'SUCCESSFUL',
          customerId: resolvedCustomerId,
          collectedById: req.user.id,
          incomeCategoryId: categoryId,
          subCategory: subCategory || null,
          note: notes || ''
        }
      });

      return entry;
    });

    // WEBSOCKET EMISSION
    if (category.name === 'Monthly Collection Fee') {
      try {
        const io = getIO();
        io.to('admin_room').emit('live_collection_update', {
          type: 'COLLECTION',
          amount: Number(result.amount),
          staffName: req.user.username,
          timestamp: new Date()
        });
      } catch (err) {
        console.error('[SOCKET] Failed to emit event:', err.message);
      }
    }

    return res.status(201).json({
      success: true,
      data: {
        ...result,
        amount: result.amount.toString(),
        baseAmount: result.baseAmount.toString(),
        vatRate: result.vatRate.toString(),
        vatAmount: result.vatAmount.toString(),
      }
    });
  } catch (error) {
    console.error('[ACCOUNTING] logManualIncome error:', error);
    return res.status(500).json({ success: false, error: 'Failed to log income.' });
  }
}

async function getIncomeHistory(req, res) {
  try {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    
    const transactions = await prisma.incomeLedger.findMany({
      where: {
        collectedById: req.user.id,
        date: { gte: sevenDaysAgo }
      },
      include: {
        customer: {
          select: { name: true, customerId: true, assignedArea: true, phone: true }
        }
      },
      orderBy: { date: 'desc' }
    });

    return res.status(200).json({ success: true, data: transactions });
  } catch (error) {
    console.error('[ACCOUNTING] getIncomeHistory error:', error);
    return res.status(500).json({ success: false, error: 'Failed to fetch history.' });
  }
}

// ============================================================================
// 3. EXPENSE STREAM
// ============================================================================

async function logExpense(req, res) {
  try {
    const { amount, categoryId, subCategory, date, notes, vehicleId } = req.body;
    
    if (!amount || !categoryId || !date) {
      return res.status(400).json({ success: false, error: 'Missing required fields' });
    }

    const category = await prisma.expenseCategory.findUnique({ where: { id: categoryId } });
    if (!category || !category.isActive) {
      return res.status(404).json({ success: false, error: 'Expense category not found or inactive.' });
    }

    const grossAmount = new Decimal(amount);

    const entry = await prisma.expenseLedger.create({
      data: {
        date: new Date(date),
        amount: grossAmount.toFixed(2),
        baseAmount: grossAmount.toFixed(2), // Strip VAT/TDS logic per user request
        vatRate: '0.00',
        inputVat: '0.00',
        tdsRate: '0.00',
        tdsAmount: '0.00',
        netPayable: grossAmount.toFixed(2),
        expenseCategoryId: categoryId,
        subCategory: subCategory || '-',
        note: notes || '',
        vehicleId: vehicleId ? parseInt(vehicleId) : null,
      }
    });

    return res.status(201).json({
      success: true,
      data: {
        ...entry,
        amount: entry.amount.toString(),
      }
    });
  } catch (error) {
    console.error('[ACCOUNTING] logExpense error:', error);
    return res.status(500).json({ success: false, error: 'Failed to log expense.' });
  }
}

// ============================================================================
// 4. SALARY LEDGER (Dynamic Deductions)
// ============================================================================

async function logSalary(req, res) {
  try {
    const { staffId, date, basicPay, note, deductions } = req.body;

    if (!staffId || !date || !basicPay) {
      return res.status(400).json({ success: false, error: 'Missing required fields: staffId, date, basicPay' });
    }

    // Deductions is passed as an array of objects: { name, amount }
    // We calculate netPay based on basicPay minus all deduction amounts
    const basic = new Decimal(basicPay);
    let totalDeductions = new Decimal(0);

    const deductionSnapshot = [];

    if (Array.isArray(deductions)) {
      for (const ded of deductions) {
        const amt = new Decimal(ded.amount || 0);
        totalDeductions = totalDeductions.plus(amt);
        deductionSnapshot.push({
          name: ded.name,
          amount: amt.toFixed(2),
        });
      }
    }

    const netPay = basic.minus(totalDeductions);

    const entry = await prisma.salaryLedger.create({
      data: {
        date: new Date(date),
        staffId: parseInt(staffId),
        basicPay: basic.toFixed(2),
        deductions: deductionSnapshot,
        netPay: netPay.toFixed(2),
        note: note || ''
      }
    });

    return res.status(201).json({
      success: true,
      data: {
        ...entry,
        basicPay: entry.basicPay.toString(),
        netPay: entry.netPay.toString(),
      }
    });
  } catch (error) {
    console.error('[ACCOUNTING] logSalary error:', error);
    return res.status(500).json({ success: false, error: 'Failed to log salary.' });
  }
}

async function getSalaries(req, res) {
  try {
    const entries = await prisma.salaryLedger.findMany({
      where: { isDeleted: false },
      include: { staff: { select: { name: true, role: true } } },
      orderBy: { date: 'desc' }
    });

    const formatted = entries.map(tx => ({
      id: tx.id,
      date: tx.date,
      staffName: tx.staff.name,
      role: tx.staff.role,
      basicPay: tx.basicPay.toString(),
      deductions: tx.deductions,
      netPay: tx.netPay.toString(),
      note: tx.note
    }));

    return res.status(200).json({ success: true, data: formatted });
  } catch (error) {
    console.error('[ACCOUNTING] getSalaries error:', error);
    return res.status(500).json({ success: false, error: 'Failed to get salaries.' });
  }
}

// ============================================================================
// 5. VEHICLE EXPENSES (Isolated Ledger)
// ============================================================================

async function logVehicleExpense(req, res) {
  try {
    const { amount, vehicleExpenseCategoryId, date, notes, vehicleId } = req.body;
    
    if (!amount || !vehicleExpenseCategoryId || !date || !vehicleId) {
      return res.status(400).json({ success: false, error: 'Missing required fields' });
    }

    const category = await prisma.vehicleExpenseCategory.findUnique({ where: { id: vehicleExpenseCategoryId } });
    if (!category || !category.isActive) {
      return res.status(404).json({ success: false, error: 'Vehicle Expense category not found or inactive.' });
    }

    const vehicle = await prisma.vehicle.findUnique({ where: { id: parseInt(vehicleId) } });
    if (!vehicle) {
      return res.status(404).json({ success: false, error: 'Vehicle not found.' });
    }

    const grossAmount = new Decimal(amount);

    const entry = await prisma.vehicleExpenseLedger.create({
      data: {
        date: new Date(date),
        amount: grossAmount.toFixed(2),
        vehicleExpenseCategoryId,
        vehicleId: parseInt(vehicleId),
        note: notes || '',
      }
    });

    return res.status(201).json({
      success: true,
      data: {
        ...entry,
        amount: entry.amount.toString(),
      }
    });
  } catch (error) {
    console.error('[ACCOUNTING] logVehicleExpense error:', error);
    return res.status(500).json({ success: false, error: 'Failed to log vehicle expense.' });
  }
}

async function getVehicleExpenses(req, res) {
  try {
    const entries = await prisma.vehicleExpenseLedger.findMany({
      where: { isDeleted: false },
      include: { 
        vehicleExpenseCategory: true,
        vehicle: true 
      },
      orderBy: { date: 'desc' }
    });

    const formatted = entries.map(tx => ({
      id: tx.id,
      date: tx.date,
      vehicleId: tx.vehicle.vehicleId,
      registrationNumber: tx.vehicle?.registrationNumber || 'Unknown',
      categoryName: tx.vehicleExpenseCategory.name,
      amount: tx.amount.toString(),
      note: tx.note
    }));

    return res.status(200).json({ success: true, data: formatted });
  } catch (error) {
    console.error('[ACCOUNTING] getVehicleExpenses error:', error);
    return res.status(500).json({ success: false, error: 'Failed to get vehicle expenses.' });
  }
}

// ============================================================================
// 6. ACCOUNTING ANALYSIS (KPIs & DASHBOARD)
// ============================================================================

async function getAccountingAnalysis(req, res) {
  try {
    // 1. Total Revenue
    const incomeAgg = await prisma.incomeLedger.aggregate({
      where: { isDeleted: false, status: 'SUCCESSFUL' },
      _sum: { amount: true }
    });
    
    // 2. Standard Expenses (No Vehicle ID)
    const stdExpenseAgg = await prisma.expenseLedger.aggregate({
      where: { isDeleted: false, vehicleId: null },
      _sum: { amount: true }
    });

    // 3. Vehicle Expenses
    const vehExpenseAgg = await prisma.vehicleExpenseLedger.aggregate({
      where: { isDeleted: false },
      _sum: { amount: true }
    });

    // 4. Salary Expenses
    // To get total salary expenses including deductions, we can just use basicPay
    const salaryAgg = await prisma.salaryLedger.aggregate({
      where: { isDeleted: false },
      _sum: { basicPay: true }
    });

    const totalRevenue = new Decimal(incomeAgg._sum.amount || 0);
    const standardExpense = new Decimal(stdExpenseAgg._sum.amount || 0);
    const vehicleExpense = new Decimal(vehExpenseAgg._sum.amount || 0);
    
    const salaryGross = new Decimal(salaryAgg._sum.basicPay || 0);

    const totalExpense = standardExpense.plus(vehicleExpense).plus(salaryGross);

    // Dynamic Trend Data for the past 6 months
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5);
    sixMonthsAgo.setDate(1);
    sixMonthsAgo.setHours(0, 0, 0, 0);

    const incomes = await prisma.incomeLedger.findMany({
      where: { date: { gte: sixMonthsAgo }, isDeleted: false, status: 'SUCCESSFUL' },
      select: { date: true, amount: true }
    });
    const expenses = await prisma.expenseLedger.findMany({
      where: { date: { gte: sixMonthsAgo }, isDeleted: false, vehicleId: null },
      select: { date: true, amount: true }
    });
    const vehicleExp = await prisma.vehicleExpenseLedger.findMany({
      where: { date: { gte: sixMonthsAgo }, isDeleted: false },
      select: { date: true, amount: true }
    });
    const salaries = await prisma.salaryLedger.findMany({
      where: { date: { gte: sixMonthsAgo }, isDeleted: false },
      select: { date: true, basicPay: true }
    });

    const monthKeys = [];
    const trendMap = {};

    for (let i = 5; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      const mStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      monthKeys.push(mStr);
      trendMap[mStr] = { rawMonth: mStr, Revenue: 0, Expense: 0, Vehicle: 0, Salary: 0 };
    }

    const addAgg = (list, key, amountField = 'amount') => {
      for (const item of list) {
        if (!item.date) continue;
        const d = new Date(item.date);
        const mStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        if (trendMap[mStr]) {
          trendMap[mStr][key] += Number(item[amountField]) || 0;
        }
      }
    };

    addAgg(incomes, 'Revenue');
    addAgg(expenses, 'Expense');
    addAgg(vehicleExp, 'Vehicle');
    addAgg(salaries, 'Salary', 'basicPay');

    const trendData = monthKeys.map(m => trendMap[m]);

    return res.status(200).json({
      success: true,
      data: {
        kpis: {
          totalRevenue: totalRevenue.toFixed(2),
          totalExpense: totalExpense.toFixed(2),
          vehicleExpense: vehicleExpense.toFixed(2),
          salaryExpense: salaryGross.toFixed(2),
        },
        trendData
      }
    });

  } catch (error) {
    console.error('[ACCOUNTING] getAccountingAnalysis error:', error);
    return res.status(500).json({ success: false, error: 'Failed to generate accounting analysis.' });
  }
}

// Keep statements logic for reference
async function getFinancialStatements(req, res) {
  try {
    const parseResult = getFinancialStatementsSchema.safeParse(req.query);
    if (!parseResult.success) {
      return res.status(400).json({
        success: false,
        errors: parseResult.error.errors.map(e => ({ field: e.path.join('.'), message: e.message }))
      });
    }

    const { startDate, endDate } = parseResult.data;
    const dateFilter = {
      gte: new Date(startDate),
      lte: new Date(endDate)
    };

    // Fetch entries
    const incomeEntries = await prisma.incomeLedger.findMany({
      where: { date: dateFilter, isDeleted: false, status: 'SUCCESSFUL' },
      include: { incomeCategory: true, customer: { select: { name: true, vatNumber: true, assignedArea: true } } },
      orderBy: { date: 'desc' }
    });

    const expenseEntries = await prisma.expenseLedger.findMany({
      where: { date: dateFilter, isDeleted: false },
      include: { expenseCategory: true },
      orderBy: { date: 'desc' }
    });

    // Format
    const formattedIncome = incomeEntries.map(tx => ({
      id: tx.id,
      date: tx.date,
      source: tx.source,
      paymentMethod: tx.paymentMethod,
      amount: tx.amount.toString(),
      baseAmount: tx.baseAmount.toString(),
      vatRate: tx.vatRate.toString(),
      vatAmount: tx.vatAmount.toString(),
      categoryName: tx.incomeCategory.name,
      subCategory: tx.subCategory || '-',
      note: tx.note,
      printCount: tx.printCount,
      customer: tx.customer,
      isSalesReturn: tx.isSalesReturn || false
    }));

    const formattedExpense = expenseEntries.map(tx => ({
      id: tx.id,
      date: tx.date,
      amount: tx.amount.toString(),
      categoryName: tx.expenseCategory.name,
      subCategory: tx.subCategory || '-',
      note: tx.note,
      vehicleId: tx.vehicleId
    }));

    return res.status(200).json({
      success: true,
      data: {
        incomeEntries: formattedIncome,
        expenseEntries: formattedExpense
      }
    });
  } catch (error) {
    console.error('[ACCOUNTING] getFinancialStatements error:', error);
    return res.status(500).json({ success: false, error: 'Failed to generate financial statements.' });
  }
}

// ────────────────────────────────────────────────────────────────────────────
// BONUS FEES
// ────────────────────────────────────────────────────────────────────────────

async function getBonusFees(req, res) {
  try {
    const bonusCategory = await prisma.incomeCategory.findUnique({
      where: { name: 'Festival Bonus Fee' }
    });

    if (!bonusCategory) {
      return res.status(200).json({ success: true, data: [] });
    }

    const bonusFees = await prisma.incomeLedger.findMany({
      where: { incomeCategoryId: bonusCategory.id, isDeleted: false },
      include: {
        customer: { select: { customerId: true, name: true } },
        collectedBy: { select: { id: true, name: true } }
      },
      orderBy: { date: 'desc' }
    });

    const formatted = bonusFees.map(fee => ({
      id: fee.id,
      date: fee.date,
      amount: fee.amount.toString(),
      customer: fee.customer ? fee.customer.name : 'Unknown',
      customerId: fee.customer ? fee.customer.customerId : null,
      collectedBy: fee.collectedBy ? fee.collectedBy.name : 'Unknown',
      remark: fee.note || '-'
    }));

    return res.status(200).json({ success: true, data: formatted });
  } catch (error) {
    console.error('[ACCOUNTING] getBonusFees error:', error);
    return res.status(500).json({ success: false, error: 'Failed to retrieve bonus fees.' });
  }
}

// ============================================================================
// INCREMENT INVOICE PRINT COUNT (IRD COMPLIANCE)
// ============================================================================
async function incrementPrintCount(req, res) {
  try {
    const { id } = req.params;
    const ledger = await prisma.incomeLedger.findUnique({
      where: { id: Number(id) }
    });

    if (!ledger) {
      return res.status(404).json({ success: false, error: 'Invoice not found.' });
    }

    // Ownership check: non-ADMIN users can only print their own invoices
    if (req.user.role !== 'ADMIN' && ledger.collectedById !== req.user.id) {
      return res.status(403).json({ success: false, error: 'You can only print your own invoices.' });
    }

    const updated = await prisma.$transaction(async (tx) => {
      if (req.user?.id) {
        await tx.$executeRawUnsafe(`SET LOCAL app.current_user_id = '${req.user.id}'`);
      }
      return await tx.incomeLedger.update({
        where: { id: Number(id) },
        data: {
          printCount: { increment: 1 }
        }
      });
    });

    return res.status(200).json({ success: true, printCount: updated.printCount });
  } catch (error) {
    console.error('[ACCOUNTING] incrementPrintCount error:', error);
    return res.status(500).json({ success: false, error: 'Failed to increment print count.' });
  }
}

// ============================================================================
// SALES RETURN ROUTE (ADMIN ONLY)
// ============================================================================
async function processSalesReturnRoute(req, res) {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    
    // Validate reason is provided (IRD compliance requires documented reason)
    if (!reason || typeof reason !== 'string' || reason.trim().length < 3) {
      return res.status(400).json({ success: false, error: 'A valid reason (minimum 3 characters) is required for sales returns.' });
    }

    // Using the centralized service engine for ACID guarantees
    const { processSalesReturn } = require('../services/payment.service');
    
    const result = await processSalesReturn({
      originalIncomeId: id,
      reason: reason.trim(),
      staffId: req.user.id
    });
    
    return res.status(200).json(result);
  } catch (error) {
    console.error('[ACCOUNTING] processSalesReturnRoute error:', error);
    if (error.code) {
      return res.status(400).json({ success: false, error: error.message, code: error.code });
    }
    return res.status(500).json({ success: false, error: 'Failed to process sales return.' });
  }
}

// ============================================================================
// IRD REPORTING (ADMIN ONLY)
// ============================================================================

async function getVatRegister(req, res) {
  try {
    const { startDate, endDate, search } = req.query;
    
    const where = {
      vatAmount: { gt: 0 },
      isDeleted: false,
    };

    if (startDate || endDate) {
      where.date = {};
      if (startDate) {
        where.date.gte = new Date(startDate);
      }
      if (endDate) {
        where.date.lte = new Date(endDate + 'T23:59:59.999Z');
      }
    }

    if (search && search.trim()) {
      const term = search.trim();
      const numId = parseInt(term.replace(/^REC-/i, ''));
      where.OR = [
        ...(isNaN(numId) ? [] : [{ id: numId }]),
        { customer: { is: { name: { contains: term, mode: 'insensitive' } } } },
        { customer: { is: { vatNumber: { contains: term, mode: 'insensitive' } } } },
        { customer: { is: { customerId: { contains: term, mode: 'insensitive' } } } },
        { irdReceiptNo: { contains: term, mode: 'insensitive' } }
      ];
    }

    const vatRecords = await prisma.incomeLedger.findMany({
      where,
      include: {
        customer: { select: { customerId: true, name: true, vatNumber: true, assignedArea: true } },
        collectedBy: { select: { name: true } }
      },
      orderBy: { date: 'desc' }
    });

    return res.status(200).json({ success: true, data: vatRecords });
  } catch (error) {
    console.error('[ACCOUNTING] getVatRegister error:', error);
    return res.status(500).json({ success: false, error: 'Failed to retrieve VAT register.' });
  }
}

async function getSalesReturns(req, res) {
  try {
    const { startDate, endDate } = req.query;
    
    let dateFilter = {};
    if (startDate && endDate) {
      dateFilter = {
        date: {
          gte: new Date(startDate),
          lte: new Date(endDate + 'T23:59:59.999Z')
        }
      };
    }

    const returnRecords = await prisma.incomeLedger.findMany({
      where: {
        isSalesReturn: true,
        isDeleted: false,
        ...dateFilter
      },
      include: {
        customer: { select: { customerId: true, name: true, vatNumber: true, assignedArea: true } },
        collectedBy: { select: { name: true } }
      },
      orderBy: { date: 'desc' }
    });

    return res.status(200).json({ success: true, data: returnRecords });
  } catch (error) {
    console.error('[ACCOUNTING] getSalesReturns error:', error);
    return res.status(500).json({ success: false, error: 'Failed to retrieve Sales Returns.' });
  }
}

async function getAuditLogs(req, res) {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = Math.min(parseInt(req.query.limit) || 50, 1000);
    const isExportAll = req.query.all === 'true';
    const skip = isExportAll ? 0 : (page - 1) * limit;
    const take = isExportAll ? 10000 : limit; // Higher cap for IRD audit exports
    const { action, entityType, startDate, endDate, search } = req.query;

    const where = {};

    if (action && action !== 'ALL') {
      where.action = action;
    }

    if (entityType && entityType !== 'ALL') {
      where.entityType = entityType;
    }

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) {
        where.createdAt.gte = new Date(startDate);
      }
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        where.createdAt.lte = end;
      }
    }

    if (search && search.trim()) {
      const term = search.trim();
      where.OR = [
        { entityId: { contains: term, mode: 'insensitive' } },
        { action: { contains: term, mode: 'insensitive' } },
        { entityType: { contains: term, mode: 'insensitive' } },
        { performedBy: { is: { name: { contains: term, mode: 'insensitive' } } } },
        { performedBy: { is: { username: { contains: term, mode: 'insensitive' } } } },
        // Also match system/trigger events stored in JSON details.db_user
        { details: { path: ['db_user'], string_contains: term } }
      ];
    }

    const [logs, totalCount] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        include: { performedBy: { select: { id: true, name: true, username: true, role: true } } }
      }),
      prisma.auditLog.count({ where })
    ]);

    return res.status(200).json({
      success: true,
      data: logs,
      pagination: {
        page,
        limit: take,
        totalCount,
        totalPages: Math.ceil(totalCount / (take || 1))
      }
    });
  } catch (error) {
    console.error('[ACCOUNTING] getAuditLogs error:', error);
    return res.status(500).json({ success: false, error: 'Failed to retrieve Audit Logs.' });
  }
}

module.exports = {
  createCategory,
  getAllCategories,
  logManualIncome,
  incrementPrintCount,
  processSalesReturnRoute,
  logExpense,
  logSalary,
  getSalaries,
  logVehicleExpense,
  getVehicleExpenses,
  getAccountingAnalysis,
  getFinancialStatements,
  getIncomeHistory,
  getBonusFees,
  getVatRegister,
  getSalesReturns,
  getAuditLogs
};


