// ============================================================================
// CUSTOMER CONTROLLER — Data Layer for the Customer Management Hub
// ============================================================================
// Handles CRUD operations for the 4,500+ customer roster.
// All monetary values are cast through Decimal.js.
// Soft-deleted records (isActive: false) are excluded from all queries.
// ============================================================================

const { Decimal } = require('decimal.js');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
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
          name: {
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
          billingCycleDay: true,
          monthlyFee: true,
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
      monthlyFee: c.monthlyFee.toString(),
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

    const { customerId, name, phone, password, assignedArea, billingCycleDay, monthlyFee, outstandingPayment, dueStartDate, dueEndDate } = parseResult.data;

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

    // 3. Hash the password (stored in pinHash column for backwards compatibility)
    const pinHash = await bcrypt.hash(password, 12);

    // 4. Cast starting debt to Decimal for safe storage
    const startingDebt = new Decimal(outstandingPayment);

    // 5. Determine if customer starts in debt
    const debtStartDate = startingDebt.gt(0) ? new Date() : null;

    // 6. Insert
    const customer = await prisma.customer.create({
      data: {
        customerId,
        name,
        phone: phone || null,
        pinHash,
        assignedArea,
        billingCycleDay: billingCycleDay || null,
        monthlyFee: new Decimal(monthlyFee).toFixed(2),
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
        billingCycleDay: customer.billingCycleDay,
        monthlyFee: customer.monthlyFee.toString(),
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
        billingEntries: {
          orderBy: { date: 'desc' },
          select: {
            id: true,
            date: true,
            amount: true,
            description: true,
            createdAt: true,
          }
        }
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
      billingCycleDay: customer.billingCycleDay,
      monthlyFee: customer.monthlyFee.toString(),
      outstandingPayment: customer.outstandingPayment.toString(),
      advanceBalance: customer.advanceBalance.toString(),
      debtStartDate: customer.debtStartDate,
      dueStartDate: customer.dueStartDate,
      dueEndDate: customer.dueEndDate,
      lastBilledDate: customer.lastBilledDate,
      createdAt: customer.createdAt,
      transactions: [
        ...customer.incomeEntries.map((tx) => ({
          type: 'PAYMENT',
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
        ...customer.billingEntries.map((tx) => ({
          type: 'CHARGE',
          id: tx.id,
          date: tx.date,
          amount: tx.amount.toString(),
          description: tx.description,
          createdAt: tx.createdAt,
        }))
      ].sort((a, b) => new Date(b.date) - new Date(a.date)),
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
// 4. RESET PASSWORD (Sudo-Protected)
// ────────────────────────────────────────────────────────────────────────────
async function resetCustomerPassword(req, res) {
  try {
    const { customerId } = req.params;
    const { sudoPassword } = req.body;

    if (!sudoPassword) {
      return res.status(400).json({ success: false, error: 'Admin sudo password is required.' });
    }

    const adminUser = await prisma.user.findUnique({ where: { id: req.user.id } });
    if (!adminUser || adminUser.role !== 'ADMIN') {
      return res.status(403).json({ success: false, error: 'Forbidden. Admin access required.' });
    }

    const isSudoValid = await bcrypt.compare(sudoPassword, adminUser.passwordHash);
    if (!isSudoValid) {
      return res.status(401).json({ success: false, error: 'Invalid admin password.' });
    }

    // Generate strict 8-character alphanumeric password
    const newPassword = crypto.randomBytes(4).toString('hex');
    const pinHash = await bcrypt.hash(newPassword, 12);

    await prisma.customer.update({
      where: { customerId },
      data: { pinHash },
    });

    return res.status(200).json({
      success: true,
      message: 'Password reset successfully.',
      data: { newPassword },
    });
  } catch (error) {
    console.error('[CUSTOMER CTRL] resetCustomerPassword error:', error);
    return res.status(500).json({ success: false, error: 'Failed to reset password.' });
  }
}

// ────────────────────────────────────────────────────────────────────────────
// 5. UPDATE CUSTOMER
// ────────────────────────────────────────────────────────────────────────────
async function updateCustomer(req, res) {
  try {
    const { customerId } = req.params;
    
    // RBAC: Only ADMIN can update customer details
    const adminUser = await prisma.user.findUnique({ where: { id: req.user.id } });
    if (!adminUser || adminUser.role !== 'ADMIN') {
      return res.status(403).json({ success: false, error: 'Forbidden. Admin access required to update customer details.' });
    }

    const parseResult = require('../validators/customer.validator').updateCustomerSchema.safeParse(req.body);
    if (!parseResult.success) {
      const errors = parseResult.error.errors.map((e) => ({
        field: e.path.join('.'),
        message: e.message,
      }));
      return res.status(400).json({ success: false, errors });
    }

    const { name, phone, assignedArea, monthlyFee, billingCycleDay, outstandingPayment, dueStartDate, dueEndDate, isActive, sudoPassword, newCustomerId } = parseResult.data;

    // Verify sudo password
    const isPasswordValid = await bcrypt.compare(sudoPassword, adminUser.passwordHash);
    if (!isPasswordValid) {
      return res.status(403).json({ success: false, error: 'Invalid admin password.' });
    }

    const updateData = {};
    if (name) updateData.name = name;
    if (phone !== undefined) updateData.phone = phone || null;
    if (assignedArea) updateData.assignedArea = assignedArea;
    if (monthlyFee) updateData.monthlyFee = new Decimal(monthlyFee).toFixed(2);
    if (outstandingPayment !== undefined) updateData.outstandingPayment = new Decimal(outstandingPayment).toFixed(2);
    if (dueStartDate !== undefined) updateData.dueStartDate = dueStartDate;
    if (dueEndDate !== undefined) updateData.dueEndDate = dueEndDate;
    if (billingCycleDay !== undefined) updateData.billingCycleDay = billingCycleDay;
    if (isActive !== undefined) updateData.isActive = isActive;
    
    if (newCustomerId && newCustomerId !== customerId) {
      const existing = await prisma.customer.findUnique({ where: { customerId: newCustomerId } });
      if (existing) {
        return res.status(400).json({ success: false, error: 'Customer ID already exists.' });
      }
      updateData.customerId = newCustomerId;
    }

    const updatedCustomer = await prisma.customer.update({
      where: { customerId },
      data: updateData,
    });

    return res.status(200).json({
      success: true,
      message: 'Customer updated successfully.',
      data: {
        customerId: updatedCustomer.customerId,
        name: updatedCustomer.name,
        phone: updatedCustomer.phone,
        assignedArea: updatedCustomer.assignedArea,
        billingCycleDay: updatedCustomer.billingCycleDay,
        monthlyFee: updatedCustomer.monthlyFee.toString(),
        outstandingPayment: updatedCustomer.outstandingPayment.toString(),
        isActive: updatedCustomer.isActive,
      },
    });
  } catch (error) {
    console.error('[CUSTOMER CTRL] updateCustomer error:', error);
    if (error.code === 'P2025') {
      return res.status(404).json({ success: false, error: 'Customer not found.' });
    }
    return res.status(500).json({ success: false, error: 'Failed to update customer.' });
  }
}

// ────────────────────────────────────────────────────────────────────────────
// 6. GET LATEST DRIVER LOCATIONS (For Customer Map)
// ────────────────────────────────────────────────────────────────────────────
async function getLatestDriverLocations(req, res) {
  try {
    // 1. Fetch latest driver locations
    const locations = await prisma.latestDriverLocation.findMany();

    // 2. Fetch corresponding vehicle details and assigned users
    const validVehicleIds = locations
      .map(loc => parseInt(loc.vehicleId, 10))
      .filter(id => !isNaN(id));

    const vehicles = await prisma.vehicle.findMany({
      where: { id: { in: validVehicleIds } },
      select: {
        id: true,
        registrationNumber: true,
        type: true,
        assignedUsers: {
          select: { name: true, phone: true, role: true }
        }
      }
    });

    // 3. Map the data together
    const driverData = locations.map(loc => {
      const vehicle = vehicles.find(v => String(v.id) === String(loc.vehicleId));
      // Find the currently assigned driver from the vehicle's assignedUsers relation
      const assignedDriver = vehicle?.assignedUsers?.find(u => u.role === 'DRIVER');
      
      const driverName = assignedDriver ? assignedDriver.name : 'Unknown Driver';
      const driverPhone = assignedDriver?.phone || null;
      const plateNumber = vehicle?.registrationNumber || 'Unknown';
      const vehicleType = vehicle?.type || 'Vehicle';
      
      return {
        vehicleId: loc.vehicleId,
        lat: loc.lat,
        lng: loc.lng,
        timestamp: loc.updatedAt,
        plateNumber,
        driverName,
        driverPhone,
        vehicleType
      };
    });

    res.json({ success: true, drivers: driverData });
  } catch (err) {
    console.error('[API ERROR] Failed to fetch latest driver locations for customer map:', err);
    res.status(500).json({ success: false, message: 'Server error loading vehicle locations.' });
  }
}

module.exports = {
  getAllCustomers,
  createCustomer,
  getCustomerProfile,
  resetCustomerPassword,
  updateCustomer,
  getLatestDriverLocations
};
