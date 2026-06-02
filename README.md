# PropMS — Nigerian Property Management System

A full-stack, production-ready property management web application built for Nigerian real estate companies.

---

## 🏗️ Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18 + Tailwind CSS |
| Backend | Node.js + Express |
| Database | PostgreSQL |
| Auth | JWT (7-day tokens) |
| PDF | PDFKit |
| SMS | Termii (Africa's Talking fallback) |
| Email | Nodemailer (SMTP) |
| Scheduler | node-cron (Africa/Lagos timezone) |
| Reports | ExcelJS + CSV |

---

## 📁 Project Structure

```
propms/
├── backend/
│   ├── config/
│   │   ├── db.js           # PostgreSQL connection pool
│   │   ├── migrate.js      # Database schema (run once)
│   │   └── seed.js         # Demo data
│   ├── controllers/
│   │   ├── authController.js
│   │   ├── propertyController.js
│   │   ├── tenantController.js
│   │   ├── paymentController.js
│   │   ├── dashboardController.js
│   │   ├── reportController.js
│   │   └── reminderController.js
│   ├── jobs/
│   │   └── cronJobs.js     # Scheduled reminders & auto-expire
│   ├── middleware/
│   │   ├── auth.js         # JWT protect + role authorization
│   │   └── errorHandler.js
│   ├── routes/
│   │   └── index.js        # All REST endpoints
│   ├── services/
│   │   ├── pdfService.js   # Receipt PDF generation
│   │   ├── emailService.js # SMTP email sender
│   │   ├── smsService.js   # Termii/AT SMS sender
│   │   └── reminderService.js
│   ├── .env.example
│   ├── package.json
│   └── server.js
│
└── frontend/
    ├── public/
    ├── src/
    │   ├── components/
    │   │   ├── common/
    │   │   │   ├── Modal.jsx
    │   │   │   └── ConfirmDialog.jsx
    │   │   └── layout/
    │   │       └── Layout.jsx
    │   ├── context/
    │   │   └── AuthContext.jsx
    │   ├── pages/
    │   │   ├── LoginPage.jsx
    │   │   ├── DashboardPage.jsx
    │   │   ├── PropertiesPage.jsx
    │   │   ├── PropertyDetailPage.jsx
    │   │   ├── TenantsPage.jsx
    │   │   ├── TenantDetailPage.jsx
    │   │   ├── PaymentsPage.jsx
    │   │   ├── ReportsPage.jsx
    │   │   ├── RemindersPage.jsx
    │   │   └── SettingsPage.jsx
    │   ├── utils/
    │   │   └── api.js      # Axios + helpers
    │   ├── App.jsx
    │   ├── index.css
    │   └── index.js
    ├── .env.example
    ├── package.json
    └── tailwind.config.js
```


### Frontend `.env`

```env
REACT_APP_API_URL=http://localhost:5000/api
REACT_APP_NAME=PropMS
```

---

## 📡 API Endpoints

### Auth
```
POST   /api/auth/login
POST   /api/auth/register       (admin only)
GET    /api/auth/me
PUT    /api/auth/change-password
GET    /api/auth/users          (admin only)
```

### Dashboard
```
GET    /api/dashboard
```

### Properties
```
GET    /api/properties
POST   /api/properties
GET    /api/properties/:id
PUT    /api/properties/:id
DELETE /api/properties/:id
GET    /api/properties/:id/units
POST   /api/properties/:id/units
```

### Tenants
```
GET    /api/tenants/expiring
GET    /api/tenants/outstanding
GET    /api/tenants
POST   /api/tenants
GET    /api/tenants/:id
PUT    /api/tenants/:id
DELETE /api/tenants/:id
```

### Payments
```
GET    /api/payments/stats
GET    /api/payments
POST   /api/payments
GET    /api/payments/:id
PUT    /api/payments/:id
DELETE /api/payments/:id         (reversal)
GET    /api/payments/:id/receipt (PDF download)
```

### Reports
```
GET    /api/reports
GET    /api/reports/export/excel
GET    /api/reports/export/csv
```

### Reminders
```
GET    /api/reminders
POST   /api/reminders/send
POST   /api/reminders/run-job   (admin only)
```

---

## 🕐 Cron Jobs (Africa/Lagos Timezone)

| Schedule | Job |
|----------|-----|
| Daily 07:00 | Send rent due (7 days ahead), overdue, and expiry (30 days) reminders |
| Daily 00:00 | Auto-expire tenancies past end date, free units |
| Mondays 09:00 | Weekly outstanding balances summary log |

---

## 📊 Database Schema

### Tables
- **users** — Admins, managers, viewers
- **properties** — Buildings/estates with address, city, state
- **units** — Individual units per property (bedrooms, rent, status)
- **tenants** — Tenant profiles linked to property + unit
- **payments** — Payment records with auto-generated receipt numbers
- **reminders** — SMS/email notification log
- **expenses** — Property expense tracking (future)

---

## 🔐 Roles

| Role | Access |
|------|--------|
| Admin | Full access — create users, run jobs, all CRUD |
| Manager | Create/edit properties, tenants, payments |
| Viewer | Read-only across all modules |

---

## 💡 Features Checklist

- ✅ Properties CRUD with occupancy stats
- ✅ Tenants CRUD with NIN, next-of-kin, payment frequency
- ✅ Payments with receipt number + PDF generation
- ✅ Outstanding balance tracking per tenant
- ✅ Auto-expire tenancies via cron
- ✅ SMS reminders via Termii (Africa's Talking fallback)
- ✅ Email reminders via SMTP
- ✅ Daily cron job for automated reminders
- ✅ Dashboard with charts and alerts
- ✅ Reports with Excel + CSV export
- ✅ JWT auth with role-based access control
- ✅ Seed data for demo
- ✅ Nigerian phone number normalization (+234)
- ✅ Naira (₦) currency formatting
- ✅ Africa/Lagos timezone

Overview

A web-based property management system designed to help landlords and property managers efficiently manage properties, tenants, units, rent payments, and occupancy records from a centralized dashboard.

Problem Statement

Managing rental properties manually can be time-consuming and prone to errors. Property owners often struggle with:

Tracking occupied and vacant units
Managing tenant records
Monitoring rent payments
Maintaining property information in one place

This project was developed to provide a simple digital solution that streamlines these processes.

Solution

The Property Management System provides a centralized platform where users can:

Manage multiple properties
Track tenants
Monitor occupancy status
Record and track rent payments
View dashboard statistics
Features
Property Management
Tenant Management
Unit Management
Dashboard Analytics
Rent Tracking
Authentication and Authorization

LIVE PREVIEW IMAGES:

Login page [Images/Login page.png]

Dashboard page [Images/Dashboard page.png]

Properties page [Images/Properties page.png]

Tenants Page [Images/Tenants page.png]

