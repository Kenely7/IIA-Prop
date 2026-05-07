const express = require('express');
const cors = require('cors');
const path = require('path');
const migrate = require('./config/migrate');
const seed = require('./config/seed');
require('dotenv').config();

const routes = require('./routes/index');
const errorHandler = require('./middleware/errorHandler');
const { initCronJobs } = require('./jobs/cronJobs');

const app = express();

// ===== MIDDLEWARE =====
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// ===== HEALTH CHECK =====
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString(), env: process.env.NODE_ENV });
});

// ===== API ROUTES =====
app.use('/api', routes);

// ===== ERROR HANDLER =====
app.use(errorHandler);

// ===== 404 =====
app.use('*', (req, res) => {
  res.status(404).json({ success: false, message: `Route ${req.originalUrl} not found` });
});
(async () => {
  try {
    console.log("⏳ Running migrations...");
    await migrate();

    // console.log("🌱 Seeding database...");
    // await seed();

    console.log("✅ Database ready");

    app.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
    });

  } catch (error) {
    console.error("❌ Startup error:", error);
  }
})();
// ===== START =====
const PORT = process.env.PORT || 5000;

// app.listen(PORT, () => {
//   console.log(`
// ╔══════════════════════════════════════╗
// ║         PropMS Backend Server        ║
// ╠══════════════════════════════════════╣
// ║  Port: ${PORT}                          ║
// ║  Env:  ${process.env.NODE_ENV || 'development'}                 ║
// ╚══════════════════════════════════════╝
//   `);

//   // Initialize cron jobs
//   initCronJobs();
// });

module.exports = app;
