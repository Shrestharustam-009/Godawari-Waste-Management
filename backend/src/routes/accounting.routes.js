const express = require('express');
const router = express.Router();

const {
  createCategory,
  getAllCategories,
  logManualIncome,
  incrementPrintCount,
  logExpense,
  logSalary,
  getSalaries,
  logVehicleExpense,
  getVehicleExpenses,
  getAccountingAnalysis,
  getFinancialStatements,
  getIncomeHistory,
  getBonusFees,
  processSalesReturnRoute,
  getVatRegister,
  getSalesReturns,
  getAuditLogs
} = require('../controllers/accounting.controller');

const { checkAuth, authorizeRoles } = require('../middleware/checkAuth');

// RBAC applied per-route to allow field staff to log income
// router.use(checkAuth, authorizeRoles('ADMIN'));

// Categories
router.post('/categories', authorizeRoles('ADMIN'), createCategory);
router.get('/categories', authorizeRoles('ADMIN', 'STAFF', 'DRIVER'), getAllCategories);

// Ledgers
router.get('/income/history', authorizeRoles('ADMIN', 'STAFF', 'DRIVER'), getIncomeHistory);
router.post('/income', authorizeRoles('ADMIN', 'STAFF', 'DRIVER'), logManualIncome);
router.post('/income/:id/print', authorizeRoles('ADMIN', 'STAFF', 'DRIVER'), incrementPrintCount);
router.post('/income/:id/return', authorizeRoles('ADMIN'), processSalesReturnRoute);
router.post('/expense', authorizeRoles('ADMIN'), logExpense);
router.post('/salary', authorizeRoles('ADMIN'), logSalary);
router.get('/salary', authorizeRoles('ADMIN'), getSalaries);

// ── Fleet Accounting ──
router.post('/expenses/vehicle', authorizeRoles('ADMIN'), logVehicleExpense);
router.get('/expenses/vehicle', authorizeRoles('ADMIN'), getVehicleExpenses);

// Reporting & Dashboards
router.get('/analysis', authorizeRoles('ADMIN'), getAccountingAnalysis);
router.get('/statements', authorizeRoles('ADMIN'), getFinancialStatements);
router.get('/bonus-fees', authorizeRoles('ADMIN', 'STAFF'), getBonusFees);
router.get('/vat-register', authorizeRoles('ADMIN'), getVatRegister);
router.get('/sales-returns', authorizeRoles('ADMIN'), getSalesReturns);
router.get('/audit-logs', authorizeRoles('ADMIN'), getAuditLogs);

module.exports = router;
