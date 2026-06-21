// ============================================================================
// CUSTOMER CONTROLLER — Data Layer for the Customer Management Hub
// ============================================================================
// Handles CRUD operations for the 4,500+ customer roster.
// All monetary values are cast through Decimal.js.
// Soft-deleted records (isActive: false) are excluded from all queries.
// ============================================================================

const { Decimal } = require('decimal.js');
const bcrypt = require('bcrypt');
const prisma = require('../lib/prisma');
const { createCustomerSchema } = require('../validators/customer.validator');

Decimal.set({ precision: 20, rounding: Decimal.ROUND_HALF_UP });

// ────────────────────────────────────────────────────────────────────────────
// 1. GET ALL CUSTOMERS (Paginated + Area Filter)
// ────────────────────────────────────────────────────────────────────────────
async function getAllCustomers(req, res) {
  try {
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 50, 1), 200);
    const skip = (page - 1) * limit;
    const searchQuery = req.query.search?.trim();

    const where = {
      isActive: true,
      customerId: { not: 'MANUAL_ENTRY' }
    };

    if (searchQuery) {
      where.OR = [
        {
          customerId: {
            contains: searchQuery,
            mode: 'insensitive',
          },
        },
        {
          phone: {
            contains: searchQuery,
            mode: 'insensitive',
          },
        },
      ];
    }

    const [customers, totalCount] = await Promise.all([
      prisma.customer.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          customerId: true,
          name: true,
          phone: true,
          assignedArea: true,
          outstandingPayment: true,
          advanceBalance: true,
          isActive: true,
          createdAt: true,
        },
      }),
      prisma.customer.count({ where }),
    ]);

    // Cast Decimal fields to strings for safe JSON transport
    const formatted = customers.map((c) => ({
      ...c,
      outstandingPayment: c.outstandingPayment.toString(),
      advanceBalance: c.advanceBalance.toString(),
    }));

    return res.status(200).json({
      success: true,
      data: formatted,
      pagination: {
        page,
        limit,
        totalCount,
        totalPages: Math.ceil(totalCount / limit),
      },
    });
  } catch (error) {
    console.error('[CUSTOMER CTRL] getAllCustomers error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to retrieve customer roster.',
    });
  }
}

// ────────────────────────────────────────────────────────────────────────────
// 2. CREATE CUSTOMER
// ────────────────────────────────────────────────────────────────────────────
async function createCustomer(req, res) {
  try {
    // 1. Validate input via Zod
    const parseResult = createCustomerSchema.safeParse(req.body);
    if (!parseResult.success) {
      const errors = parseResult.error.errors.map((e) => ({
        field: e.path.join('.'),
        message: e.message,
      }));
      return res.status(400).json({ success: false, errors });
    }

    const { customerId, name, phone, pin, assignedArea, outstandingPayment, dueStartDate, dueEndDate } = parseResult.data;

    // 2. Check for duplicate customerId
    const existing = await prisma.customer.findUnique({
      where: { customerId },
    });

    if (existing) {
      return res.status(409).json({
        success: false,
        error: `Customer with ID '${customerId}' already exists.`,
      });
    }

    // 3. Hash the 4-digit PIN
    const pinHash = await bcrypt.hash(pin, 12);

    // 4. Cast starting debt to Decimal for safe storage
    const startingDebt = new Decimal(outstandingPayment);

    // 5. Determine if customer starts in debt
    const debtStartDate = startingDebt.gt(0) ? new Date() : null;

    // 6. Insert
    const customer = await prisma.customer.create({
      data: {
        customerId,
        name,
        phone,
        pinHash,
        assignedArea,
        outstandingPayment: startingDebt.toFixed(2),
        debtStartDate,
        dueStartDate,
        dueEndDate,
      },
    });

    return res.status(201).json({
      success: true,
      data: {
        customerId: customer.customerId,
        name: customer.name,
        phone: customer.phone,
        assignedArea: customer.assignedArea,
        outstandingPayment: customer.outstandingPayment.toString(),
        advanceBalance: customer.advanceBalance.toString(),
        createdAt: customer.createdAt,
      },
    });
  } catch (error) {
    console.error('[CUSTOMER CTRL] createCustomer error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to create customer record.',
    });
  }
}

// ────────────────────────────────────────────────────────────────────────────
// 3. GET CUSTOMER PROFILE (with Transaction History)
// ────────────────────────────────────────────────────────────────────────────
async function getCustomerProfile(req, res) {
  try {
    const { customerId } = req.params;

    if (!customerId || !/^[A-Za-z0-9-]+$/.test(customerId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid customer ID format.',
      });
    }

    // RBAC: If a customer is making the request, they can only view their own profile
    if (req.user && req.user.role === 'CUSTOMER' && req.user.id !== customerId) {
      return res.status(403).json({
        success: false,
        error: 'Forbidden: You can only view your own profile.',
      });
    }

    const customer = await prisma.customer.findUnique({
      where: { customerId },
      include: {
        incomeEntries: {
          where: { isDeleted: false },
          orderBy: { date: 'desc' },
          select: {
            id: true,
            date: true,
            amount: true,
            baseAmount: true,
            vatAmount: true,
            paymentMethod: true,
            source: true,
            status: true,
            note: true,
            createdAt: true,
            collectedBy: {
              select: {
                name: true,
              },
            },
          },
        },
      },
    });

    if (!customer || !customer.isActive) {
      return res.status(404).json({
        success: false,
        error: `Customer '${customerId}' not found or has been deactivated.`,
      });
    }

    // Cast all Decimal fields to strings
    const formatted = {
      customerId: customer.customerId,
      name: customer.name,
      phone: customer.phone,
      assignedArea: customer.assignedArea,
      outstandingPayment: customer.outstandingPayment.toString(),
      advanceBalance: customer.advanceBalance.toString(),
      debtStartDate: customer.debtStartDate,
      dueStartDate: customer.dueStartDate,
      dueEndDate: customer.dueEndDate,
      lastBilledDate: customer.lastBilledDate,
      createdAt: customer.createdAt,
      transactions: customer.incomeEntries.map((tx) => ({
        id: tx.id,
        date: tx.date,
        amount: tx.amount.toString(),
        baseAmount: tx.baseAmount.toString(),
        vatAmount: tx.vatAmount.toString(),
        paymentMethod: tx.paymentMethod,
        source: tx.source,
        status: tx.status,
        note: tx.note,
        collectedBy: tx.collectedBy.name,
        createdAt: tx.createdAt,
      })),
    };

    return res.status(200).json({
      success: true,
      data: formatted,
    });
  } catch (error) {
    console.error('[CUSTOMER CTRL] getCustomerProfile error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to retrieve customer profile.',
    });
  }
}

// ────────────────────────────────────────────────────────────────────────────
// 4. RESET PIN (Sudo-Protected)
// ────────────────────────────────────────────────────────────────────────────
async function resetCustomerPin(req, res) {
  try {
    const { sudoPassword } = req.body;
    const { customerId } = req.params;

    const admin = await prisma.user.findUnique({ where: { id: req.user.id } });
    if (!admin) return res.status(401).json({ success: false, error: 'Admin not found.' });

    const isPasswordValid = await bcrypt.compare(sudoPassword, admin.passwordHash);
    if (!isPasswordValid) return res.status(403).json({ success: false, error: 'Sudo authentication failed.' });

    const customer = await prisma.customer.findUnique({ where: { customerId } });
    if (!customer || !customer.isActive) {
      return res.status(404).json({ success: false, error: 'Customer not found or inactive.' });
    }

    // Generate strict 4-digit PIN
    const newPin = Math.floor(1000 + Math.random() * 9000).toString();
    const pinHash = await bcrypt.hash(newPin, 12);

    await prisma.customer.update({
      where: { customerId },
      data: { pinHash },
    });

    return res.status(200).json({
      success: true,
      message: 'PIN reset successfully.',
      data: { newPin },
    });
  } catch (error) {
    console.error('[CUSTOMER CTRL] resetCustomerPin error:', error);
    return res.status(500).json({ success: false, error: 'Failed to reset PIN.' });
  }
}

module.exports = {
  getAllCustomers,
  createCustomer,
  getCustomerProfile,
  resetCustomerPin,
};
