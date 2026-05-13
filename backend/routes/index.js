const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const { protect, authorize } = require('../middleware/auth');

const authCtrl = require('../controllers/authController');
const propertyCtrl = require('../controllers/propertyController');
const tenantCtrl = require('../controllers/tenantController');
const paymentCtrl = require('../controllers/paymentController');
const dashboardCtrl = require('../controllers/dashboardController');
const reportCtrl = require('../controllers/reportController');
const reminderCtrl = require('../controllers/reminderController');

// ===== AUTH ROUTES =====
router.post('/auth/login', [
  body('email').isEmail().normalizeEmail(),
  body('password').notEmpty(),
], authCtrl.login);

router.post('/auth/register', protect, authorize('admin'), [
  body('full_name').notEmpty().trim(),
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 8 }),
  body('role').optional().isIn(['admin', 'manager', 'viewer']),
], authCtrl.register);

router.get('/auth/me', protect, authCtrl.getMe);
router.put('/auth/change-password', protect, authCtrl.changePassword);
router.get('/auth/users', protect, authorize('admin'), authCtrl.getUsers);

// ===== DASHBOARD =====
router.get('/dashboard', protect, dashboardCtrl.getDashboard);

// ===== PROPERTIES =====
router.get('/properties', protect, propertyCtrl.getProperties);
router.post('/properties', protect, authorize('admin', 'manager'), [
  body('name').notEmpty().trim(),
  body('address').notEmpty().trim(),
  body('total_units').isInt({ min: 1 }),
], propertyCtrl.createProperty);
router.get('/properties/:id', protect, propertyCtrl.getProperty);
router.put('/properties/:id', protect, authorize('admin', 'manager'), propertyCtrl.updateProperty);
router.delete('/properties/:id', protect, authorize('admin'), propertyCtrl.deleteProperty);
router.get('/properties/:id/units', protect, propertyCtrl.getUnits);
router.post('/properties/:id/units', protect, authorize('admin', 'manager'), propertyCtrl.addUnit);
router.put('/properties/:id/units/:unitId', protect, authorize('admin', 'manager'), propertyCtrl.updateUnit);
router.delete('/properties/:id/units/:unitId', protect, authorize('admin', 'manager'), propertyCtrl.deleteUnit);

// ===== TENANTS =====
router.get('/tenants/expiring', protect, tenantCtrl.getExpiringTenants);
router.get('/tenants/outstanding', protect, tenantCtrl.getOutstandingBalances);
router.get('/tenants', protect, tenantCtrl.getTenants);
router.post('/tenants', protect, authorize('admin', 'manager'), [
  body('full_name').notEmpty().trim(),
  body('phone').notEmpty().matches(/^(\+234|0)[789][01]\d{8}$/).withMessage('Valid Nigerian phone number required'),
  body('property_id').isUUID(),
  body('rent_amount').isFloat({ min: 1 }),
  body('tenancy_start').isDate(),
  body('tenancy_end').isDate(),
], tenantCtrl.createTenant);
router.get('/tenants/:id', protect, tenantCtrl.getTenant);
router.put('/tenants/:id', protect, authorize('admin', 'manager'), tenantCtrl.updateTenant);
router.delete('/tenants/:id', protect, authorize('admin'), tenantCtrl.deleteTenant);

// ===== PAYMENTS =====
router.get('/payments/stats', protect, paymentCtrl.getPaymentStats);
router.get('/payments', protect, paymentCtrl.getPayments);
router.post('/payments', protect, authorize('admin', 'manager'), [
  body('tenant_id').isUUID(),
  body('amount').isFloat({ min: 1 }),
  body('payment_date').isDate(),
  body('period_from').isDate(),
  body('period_to').isDate(),
], paymentCtrl.createPayment);
router.get('/payments/:id', protect, paymentCtrl.getPayment);
router.put('/payments/:id', protect, authorize('admin', 'manager'), paymentCtrl.updatePayment);
router.delete('/payments/:id', protect, authorize('admin'), paymentCtrl.deletePayment);
router.get('/payments/:id/receipt', protect, paymentCtrl.generateReceipt);

// ===== REPORTS =====
router.get('/reports', protect, reportCtrl.getReports);
router.get('/reports/export/excel', protect, reportCtrl.exportExcel);
router.get('/reports/export/csv', protect, reportCtrl.exportCSV);

// ===== REMINDERS =====
router.get('/reminders', protect, reminderCtrl.getReminders);
router.post('/reminders/send', protect, authorize('admin', 'manager'), reminderCtrl.sendManualReminder);
router.post('/reminders/run-job', protect, authorize('admin'), reminderCtrl.runReminderJob);

module.exports = router;
