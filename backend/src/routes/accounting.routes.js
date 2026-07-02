const express = require('express');
const router = express.Router();

const {
  createCategory,
  getAllCategories,
  logManualIncome,
  logExpense,
  logSalary,
  getSalaries,
  logVehicleExpense,
  getVehicleExpenses,
  getAccountingAnalysis,
  getFinancialStatements,
  getIncomeHistory,
  getBonusFees
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

module.exports = router;
