// ============================================================================
// PAYMENT SERVICE — Financial Collection Engine
// ============================================================================
// This is the SOLE authority for payment processing logic in the system.
// Express controllers call these functions — they never touch Prisma directly
// for financial mutations.
//
// INVARIANTS ENFORCED:
//   1. ALL arithmetic uses Decimal.js — zero native JS operators on money
//   2. ALL mutations run inside prisma.$transaction — full ACID rollback
//   3. Idempotency keys are checked BEFORE any mutation begins
//   4. 13% VAT is auto-split on every collection (Nepal tax law)
//   5. Smart Wallet: overpayments route to advanceBalance automatically
//
// VAT FORMULA (Nepal 13%):
//   grossAmount  = amount received from customer (VAT-inclusive)
//   baseRevenue  = grossAmount / 1.13   (revenue excluding VAT)
//   vatAmount    = grossAmount - baseRevenue  (VAT component)
//
// IMPORTANT: The `amount` field in IncomeLedger stores the GROSS (VAT-inclusive)
// amount. The `baseAmount` and `vatAmount` fields store the split components.
// This ensures:  amount === baseAmount + vatAmount  (always, to the paisa)
// ============================================================================

const { Decimal } = require('decimal.js');
const prisma = require('../lib/prisma');

// ── Configure Decimal.js for financial precision ──
// Use ROUND_HALF_UP (banker's rounding) to match standard accounting behavior
Decimal.set({ precision: 20, rounding: Decimal.ROUND_HALF_UP });

// ── Nepal VAT rate: 13% ──
const VAT_RATE = new Decimal('1.13');
const VAT_MULTIPLIER = new Decimal('0.13');

// ============================================================================
// 1. PROCESS FIELD PAYMENT — The core collection function
// ============================================================================
/**
 * Processes a payment collected in the field (or via customer portal).
 *
 * This function implements the complete financial collection pipeline:
 *   1. Idempotency check (prevents double-charging)
 *   2. 13% VAT split (base revenue + VAT component)
 *   3. Smart Wallet routing (normal deduction vs. advance credit)
 *   4. ACID transaction (all-or-nothing: ledger + balance update)
 *   5. Audit-ready response with full financial breakdown
 *
 * @param {Object} params
 * @param {string}  params.customerId       — Manual string PK (e.g., "GDW-0001")
 * @param {string}  params.amountReceived   — Gross amount as STRING (e.g., "500.00")
 * @param {boolean} params.isAdvancePayment — If true, overpayment goes to Smart Wallet
 * @param {number}  params.staffId          — User ID of the collecting staff member
 * @param {string}  params.idempotencyKey   — Unique key to prevent duplicate submissions
 * @param {string}  params.paymentMethod    — 'CASH' or 'DIGITAL_GATEWAY'
 * @param {number}  params.incomeCategoryId — FK to IncomeCategory
 * @param {string|null} params.referenceId  — External payment gateway transaction ID
 * @param {string|null} params.note         — Optional descriptive note
 *
 * @returns {Promise<Object>} Result object with shape:
 *   {
 *     isIdempotent: boolean,        — true if this was a duplicate submission
 *     income: IncomeLedger,         — The created (or existing) ledger record
 *     vatBreakdown: { gross, base, vat },
 *     balanceSnapshot: { previousOutstanding, newOutstanding, previousAdvance, newAdvance },
 *     route: 'NORMAL' | 'ADVANCE',
 *   }
 *
 * @throws {Error} 'CUSTOMER_NOT_FOUND' — No customer with this ID
 * @throws {Error} 'CUSTOMER_INACTIVE'  — Customer account is deactivated
 * @throws {Error} 'OVERPAYMENT_NOT_ALLOWED' — Overpayment without isAdvancePayment flag
 * @throws {Error} 'CATEGORY_NOT_FOUND' — Invalid incomeCategoryId
 */
async function processFieldPayment({
  customerId,
  amountReceived,
  isAdvancePayment = false,
  staffId,
  idempotencyKey,
  paymentMethod = 'CASH',
  incomeCategoryId,
  referenceId = null,
  note = null,
  paymentForStartDate = null,
  paymentForEndDate = null,
  bonusFee = null,
  bonusRemark = null,
}) {
  // ──────────────────────────────────────────────────────────────────────
  // STEP 1: Parse and validate the gross amount using Decimal.js
  // ──────────────────────────────────────────────────────────────────────
  // The amount arrives as a STRING (enforced by Zod validator).
  // We convert to Decimal.js immediately — no native JS float ever touches it.

  const grossAmount = new Decimal(amountReceived);

  // ──────────────────────────────────────────────────────────────────────
  // STEP 2: IDEMPOTENCY CHECK — Return existing record if duplicate
  // ──────────────────────────────────────────────────────────────────────
  // This MUST happen OUTSIDE the transaction to avoid unnecessary locks.
  // If the key exists, we return the original result with a 200 OK flag.

  if (idempotencyKey) {
    const existingEntry = await prisma.incomeLedger.findUnique({
      where: { idempotencyKey },
      include: {
        customer: {
          select: {
            customerId: true,
            name: true,
            outstandingPayment: true,
            advanceBalance: true,
          },
        },
      },
    });

    if (existingEntry) {
      // Return the existing record — the client should treat this as success
      return {
        isIdempotent: true,
        income: existingEntry,
        vatBreakdown: {
          gross: existingEntry.amount.toString(),
          base: existingEntry.baseAmount.toString(),
          vat: existingEntry.vatAmount.toString(),
        },
        balanceSnapshot: {
          currentOutstanding: existingEntry.customer.outstandingPayment.toString(),
          currentAdvance: existingEntry.customer.advanceBalance.toString(),
        },
        route: 'EXISTING_IDEMPOTENT',
      };
    }
  }

  // ──────────────────────────────────────────────────────────────────────
  // STEP 3: VAT SPLIT — Calculate base revenue and VAT component
  // ──────────────────────────────────────────────────────────────────────
  // Nepal VAT: 13% inclusive
  //   baseRevenue = grossAmount / 1.13
  //   vatAmount   = grossAmount - baseRevenue
  //
  // We use Decimal.js division with ROUND_HALF_UP, then derive VAT as
  // the remainder to guarantee:  gross === base + vat  (no rounding leak)

  const baseRevenue = grossAmount.dividedBy(VAT_RATE).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
  const vatAmount = grossAmount.minus(baseRevenue);

  // ASSERTION: The identity must hold — if it doesn't, Decimal.js has a bug
  // (This should never fire, but we check for audit defensibility)
  const reconstructed = baseRevenue.plus(vatAmount);
  if (!reconstructed.eq(grossAmount)) {
    throw Object.assign(
      new Error(`VAT split integrity failure: ${baseRevenue} + ${vatAmount} ≠ ${grossAmount}`),
      { code: 'VAT_INTEGRITY_ERROR' }
    );
  }

  // ──────────────────────────────────────────────────────────────────────
  // STEP 4: Validate the income category exists
  // ──────────────────────────────────────────────────────────────────────

  const category = await prisma.incomeCategory.findUnique({
    where: { id: incomeCategoryId },
    select: { id: true, isActive: true },
  });

  if (!category || !category.isActive) {
    throw Object.assign(
      new Error('Income category not found or inactive.'),
      { code: 'CATEGORY_NOT_FOUND' }
    );
  }

  // ──────────────────────────────────────────────────────────────────────
  // STEP 5: ACID TRANSACTION — All-or-nothing financial mutation
  // ──────────────────────────────────────────────────────────────────────
  // Everything inside this block either FULLY COMMITS or FULLY ROLLS BACK.
  // If the IncomeLedger insert succeeds but the Customer balance update
  // fails, the ledger entry is also rolled back — zero partial state.

  const result = await prisma.$transaction(async (tx) => {
    // ── 5a. Fetch the customer with row-level lock (FOR UPDATE) ──
    const lockedRows = await tx.$queryRaw`
      SELECT "customerId", "name", "outstandingPayment"::text, "advanceBalance"::text, "isActive"
      FROM "customers"
      WHERE "customerId" = ${customerId}
      FOR UPDATE
    `;
    const customer = lockedRows[0];

    if (!customer) {
      throw Object.assign(
        new Error(`Customer '${customerId}' not found.`),
        { code: 'CUSTOMER_NOT_FOUND' }
      );
    }

    if (!customer.isActive) {
      throw Object.assign(
        new Error(`Customer '${customerId}' account is deactivated.`),
        { code: 'CUSTOMER_INACTIVE' }
      );
    }

    // ── 5b. Read current balances as Decimal.js (NEVER as native JS float) ──
    const previousOutstanding = new Decimal(customer.outstandingPayment.toString());
    const previousAdvance = new Decimal(customer.advanceBalance.toString());

    // ── 5c. SMART WALLET ROUTING LOGIC ──
    let newOutstanding;
    let newAdvance;
    let route;

    if (grossAmount.lte(previousOutstanding)) {
      // ┌─────────────────────────────────────────────────────────────┐
      // │ NORMAL ROUTE: Payment ≤ Outstanding                        │
      // │ Simply deduct the payment from the outstanding balance.     │
      // │ No advance credit. No wallet interaction.                   │
      // └─────────────────────────────────────────────────────────────┘
      newOutstanding = previousOutstanding.minus(grossAmount);
      newAdvance = previousAdvance;
      route = 'NORMAL';

    } else if (isAdvancePayment) {
      // ┌─────────────────────────────────────────────────────────────┐
      // │ ADVANCE ROUTE: Payment > Outstanding AND client opted in    │
      // │ 1. Wipe the outstanding balance to ₹0.00                   │
      // │ 2. Credit the excess to the Smart Wallet (advanceBalance)  │
      // │                                                             │
      // │ Example: Outstanding = ₹300, Payment = ₹500                │
      // │   → Outstanding becomes ₹0.00                              │
      // │   → Advance wallet gets +₹200.00                           │
      // └─────────────────────────────────────────────────────────────┘
      const excess = grossAmount.minus(previousOutstanding);
      newOutstanding = new Decimal('0.00');
      newAdvance = previousAdvance.plus(excess);
      route = 'ADVANCE';

    } else {
      // ┌─────────────────────────────────────────────────────────────┐
      // │ REJECTION: Payment > Outstanding but isAdvancePayment=false │
      // │ The client must explicitly opt in to advance payments.      │
      // │ This prevents accidental overpayments.                      │
      // └─────────────────────────────────────────────────────────────┘
      throw Object.assign(
        new Error(
          `Payment of ₹${grossAmount.toFixed(2)} exceeds outstanding balance of ` +
          `₹${previousOutstanding.toFixed(2)}. Set isAdvancePayment=true to credit ` +
          `the excess ₹${grossAmount.minus(previousOutstanding).toFixed(2)} to the Smart Wallet.`
        ),
        {
          code: 'OVERPAYMENT_NOT_ALLOWED',
          details: {
            amountReceived: grossAmount.toFixed(2),
            outstandingPayment: previousOutstanding.toFixed(2),
            excess: grossAmount.minus(previousOutstanding).toFixed(2),
          },
        }
      );
    }

    // ── 5d. UPDATE customer balances (Decimal → string → Prisma Decimal) ──
    await tx.customer.update({
      where: { customerId },
      data: {
        outstandingPayment: newOutstanding.toFixed(2),
        advanceBalance: newAdvance.toFixed(2),
      },
    });

    // ── 5e. CREATE Income Ledger entry with VAT breakdown ──
    const income = await tx.incomeLedger.create({
      data: {
        date: new Date(),
        amount: grossAmount.toFixed(2),         // Gross (VAT-inclusive)
        baseAmount: baseRevenue.toFixed(2),      // Revenue excl. VAT
        vatAmount: vatAmount.toFixed(2),          // 13% VAT component
        paymentMethod,
        source: 'FIELD_APP',
        idempotencyKey: idempotencyKey || null,
        referenceId: referenceId || null,
        customerId,
        collectedById: staffId,
        incomeCategoryId,
        note: note || null,
        paymentForStartDate: paymentForStartDate || null,
        paymentForEndDate: paymentForEndDate || null,
      },
    });

    // ── 5f. Create Bonus Fee Ledger entry if provided ──
    let bonusIncome = null;
    if (bonusFee) {
      const bonusAmount = new Decimal(bonusFee);
      if (bonusAmount.greaterThan(0)) {
        // Find or create "Festival Bonus Fee" category
        let bonusCategory = await tx.incomeCategory.findUnique({
          where: { name: 'Festival Bonus Fee' }
        });
        if (!bonusCategory) {
          bonusCategory = await tx.incomeCategory.create({
            data: {
              name: 'Festival Bonus Fee',
              description: 'Bonus fee collected from customer during festival season',
            }
          });
        }
        
        // Calculate 13% VAT split for the bonus
        const bonusBase = bonusAmount.dividedBy(VAT_RATE).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
        const bonusVat = bonusAmount.minus(bonusBase);

        bonusIncome = await tx.incomeLedger.create({
          data: {
            date: new Date(),
            amount: bonusAmount.toFixed(2),
            baseAmount: bonusBase.toFixed(2),
            vatAmount: bonusVat.toFixed(2),
            paymentMethod,
            source: 'FIELD_APP',
            idempotencyKey: idempotencyKey ? `${idempotencyKey}_bonus` : null,
            referenceId: referenceId ? `${referenceId}_bonus` : null,
            customerId,
            collectedById: staffId,
            incomeCategoryId: bonusCategory.id,
            note: bonusRemark || null,
          }
        });
      }
    }

    return {
      income,
      bonusIncome,
      previousOutstanding,
      newOutstanding,
      previousAdvance,
      newAdvance,
      route,
    };
  }, { isolationLevel: 'Serializable' });

  // ──────────────────────────────────────────────────────────────────────
  // STEP 6: Return the complete financial breakdown
  // ──────────────────────────────────────────────────────────────────────

  return {
    isIdempotent: false,
    income: result.income,
    vatBreakdown: {
      gross: grossAmount.toFixed(2),
      base: baseRevenue.toFixed(2),
      vat: vatAmount.toFixed(2),
    },
    balanceSnapshot: {
      previousOutstanding: result.previousOutstanding.toFixed(2),
      newOutstanding: result.newOutstanding.toFixed(2),
      previousAdvance: result.previousAdvance.toFixed(2),
      newAdvance: result.newAdvance.toFixed(2),
    },
    route: result.route,
  };
}

// ============================================================================
// 2. PROCESS MANUAL INCOME ENTRY — Back-office data entry
// ============================================================================
/**
 * Records a manually entered income transaction (entered by admin/staff in
 * the back-office, not collected in the field).
 *
 * Uses the same VAT split and ACID guarantees as field payments, but:
 *   - Source is set to 'MANUAL_ENTRY' instead of 'FIELD_APP'
 *   - Date is specified by the operator (can be backdated)
 *   - No idempotency key (manual entries are reviewed by humans)
 *
 * @param {Object} params — Same shape as processFieldPayment, plus `date`
 * @returns {Promise<Object>} Same result shape as processFieldPayment
 */
async function processManualIncome({
  customerId,
  date,
  amountReceived,
  isAdvancePayment = false,
  staffId,
  paymentMethod = 'CASH',
  incomeCategoryId,
  referenceId = null,
  note = null,
}) {
  const grossAmount = new Decimal(amountReceived);

  // ── VAT split ──
  const baseRevenue = grossAmount.dividedBy(VAT_RATE).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
  const vatAmount = grossAmount.minus(baseRevenue);

  // ── Validate category ──
  const category = await prisma.incomeCategory.findUnique({
    where: { id: incomeCategoryId },
    select: { id: true, isActive: true },
  });

  if (!category || !category.isActive) {
    throw Object.assign(
      new Error('Income category not found or inactive.'),
      { code: 'CATEGORY_NOT_FOUND' }
    );
  }

  // ── ACID transaction ──
  const result = await prisma.$transaction(async (tx) => {
    const lockedRows = await tx.$queryRaw`
      SELECT "customerId", "outstandingPayment"::text, "advanceBalance"::text, "isActive"
      FROM "customers"
      WHERE "customerId" = ${customerId}
      FOR UPDATE
    `;
    const customer = lockedRows[0];

    if (!customer) {
      throw Object.assign(
        new Error(`Customer '${customerId}' not found.`),
        { code: 'CUSTOMER_NOT_FOUND' }
      );
    }

    if (!customer.isActive) {
      throw Object.assign(
        new Error(`Customer '${customerId}' account is deactivated.`),
        { code: 'CUSTOMER_INACTIVE' }
      );
    }

    const previousOutstanding = new Decimal(customer.outstandingPayment.toString());
    const previousAdvance = new Decimal(customer.advanceBalance.toString());

    let newOutstanding;
    let newAdvance;
    let route;

    if (grossAmount.lte(previousOutstanding)) {
      newOutstanding = previousOutstanding.minus(grossAmount);
      newAdvance = previousAdvance;
      route = 'NORMAL';
    } else if (isAdvancePayment) {
      const excess = grossAmount.minus(previousOutstanding);
      newOutstanding = new Decimal('0.00');
      newAdvance = previousAdvance.plus(excess);
      route = 'ADVANCE';
    } else {
      throw Object.assign(
        new Error(
          `Payment of ₹${grossAmount.toFixed(2)} exceeds outstanding ₹${previousOutstanding.toFixed(2)}. ` +
          `Set isAdvancePayment=true to credit excess to Smart Wallet.`
        ),
        { code: 'OVERPAYMENT_NOT_ALLOWED' }
      );
    }

    await tx.customer.update({
      where: { customerId },
      data: {
        outstandingPayment: newOutstanding.toFixed(2),
        advanceBalance: newAdvance.toFixed(2),
      },
    });

    const income = await tx.incomeLedger.create({
      data: {
        date: new Date(date),
        amount: grossAmount.toFixed(2),
        baseAmount: baseRevenue.toFixed(2),
        vatAmount: vatAmount.toFixed(2),
        paymentMethod,
        source: 'MANUAL_ENTRY',
        referenceId: referenceId || null,
        customerId,
        collectedById: staffId,
        incomeCategoryId,
        note: note || null,
      },
    });

    return { income, previousOutstanding, newOutstanding, previousAdvance, newAdvance, route };
  }, { isolationLevel: 'Serializable' });

  return {
    isIdempotent: false,
    income: result.income,
    vatBreakdown: {
      gross: grossAmount.toFixed(2),
      base: baseRevenue.toFixed(2),
      vat: vatAmount.toFixed(2),
    },
    balanceSnapshot: {
      previousOutstanding: result.previousOutstanding.toFixed(2),
      newOutstanding: result.newOutstanding.toFixed(2),
      previousAdvance: result.previousAdvance.toFixed(2),
      newAdvance: result.newAdvance.toFixed(2),
    },
    route: result.route,
  };
}

// ============================================================================
// 3. GET CUSTOMER BALANCE — Read-only financial snapshot
// ============================================================================
/**
 * Returns the current financial state of a customer.
 * All values are returned as strings (Decimal-safe for frontend display).
 *
 * @param {string} customerId
 * @returns {Promise<Object>} Balance snapshot
 */
async function getCustomerBalance(customerId) {
  const customer = await prisma.customer.findUnique({
    where: { customerId },
    select: {
      customerId: true,
      name: true,
      outstandingPayment: true,
      advanceBalance: true,
      isActive: true,
    },
  });

  if (!customer) {
    throw Object.assign(
      new Error(`Customer '${customerId}' not found.`),
      { code: 'CUSTOMER_NOT_FOUND' }
    );
  }

  return {
    customerId: customer.customerId,
    name: customer.name,
    outstandingPayment: customer.outstandingPayment.toString(),
    advanceBalance: customer.advanceBalance.toString(),
    isActive: customer.isActive,
  };
}

module.exports = {
  processFieldPayment,
  processManualIncome,
  getCustomerBalance,
};
