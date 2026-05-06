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

---

## 🚀 Local Development Setup

### 1. Clone & Install

```bash
# Backend
cd propms/backend
npm install
cp .env.example .env
# Fill in your .env values

# Frontend
cd ../frontend
npm install
cp .env.example .env
```

### 2. Database Setup

Create a PostgreSQL database, then run migrations:

```bash
cd backend
node config/migrate.js   # Creates all tables
node config/seed.js      # Loads demo data
```

### 3. Start Servers

```bash
# Terminal 1 — Backend (port 5000)
cd backend
npm run dev

# Terminal 2 — Frontend (port 3000)
cd frontend
npm start
```

### 4. Login

Open http://localhost:3000 and use:
- **Admin:** `admin@propms.com` / `Admin@123456`
- **Manager:** `manager@propms.com` / `Manager@123`

---

## 🌐 Deployment

### Backend → Render

1. Push your `backend/` folder to a GitHub repo
2. Go to [render.com](https://render.com) → New → Web Service
3. Connect repo, set:
   - **Build Command:** `npm install`
   - **Start Command:** `node server.js`
4. Add all environment variables from `.env.example`
5. Deploy

### Database → Render PostgreSQL

1. Render → New → PostgreSQL
2. Copy the **External Database URL**
3. Set `DATABASE_URL` in your backend service environment variables
4. Run migrations via Render Shell: `node config/migrate.js && node config/seed.js`

### Frontend → Vercel

1. Push `frontend/` to GitHub
2. Go to [vercel.com](https://vercel.com) → New Project → Import repo
3. Set environment variable:
   - `REACT_APP_API_URL` = `https://your-backend.onrender.com/api`
4. Deploy

> ⚠️ Remove the `"proxy"` field from `frontend/package.json` before deploying to Vercel.

### Alternative: Railway

```bash
# Install Railway CLI
npm install -g @railway/cli
railway login

# Deploy backend
cd backend
railway init
railway up

# Add PostgreSQL plugin in Railway dashboard
# Get DATABASE_URL from Railway and add to env vars
```

---

## 🔑 Environment Variables

### Backend `.env`

```env
PORT=5000
NODE_ENV=development

# Database (use DATABASE_URL OR individual vars)
DATABASE_URL=postgresql://user:password@host:5432/propms
DB_HOST=localhost
DB_PORT=5432
DB_NAME=propms
DB_USER=postgres
DB_PASSWORD=yourpassword

# JWT
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production

# SMTP Email
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your@gmail.com
SMTP_PASS=your-app-password
FROM_EMAIL=PropMS <your@gmail.com>

# SMS — Termii (Primary)
TERMII_API_KEY=your-termii-api-key
TERMII_SENDER_ID=PropMS

# SMS — Africa's Talking (Fallback)
AT_API_KEY=your-at-api-key
AT_USERNAME=your-at-username

# App
FRONTEND_URL=http://localhost:3000

# Seed (optional)
SEED_ADMIN_EMAIL=admin@propms.com
SEED_ADMIN_PASSWORD=Admin@123456
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

---

## 🧪 Running Tests

No test suite included in v1. Recommended tools:
- Backend: Jest + Supertest
- Frontend: React Testing Library

---

## 📞 SMS Setup Guide

### Termii (Recommended for Nigeria)
1. Sign up at [termii.com](https://termii.com)
2. Get API key from dashboard
3. Register sender ID "PropMS" (takes ~24h approval)
4. Add to `.env`: `TERMII_API_KEY` and `TERMII_SENDER_ID`

### Africa's Talking (Fallback)
1. Sign up at [africastalking.com](https://africastalking.com)
2. Create app, get API key
3. Add to `.env`: `AT_API_KEY` and `AT_USERNAME`

> Both providers run in **mock mode** (console log only) if API keys are not set — safe for development.

---

*Built for Nigerian real estate. All amounts in NGN (₦). Timezone: Africa/Lagos.*
