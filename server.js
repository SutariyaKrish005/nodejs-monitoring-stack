// Load environment variables from .env file
require('dotenv').config();

const express = require('express');
const mongoose = require('mongoose');
const client = require('prom-client');
const User = require('./models/User');

const app = express();
const PORT = process.env.PORT || 3000;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/mydb';

// ─── Middleware ────────────────────────────────────────────────────────────────
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ─── Prometheus Metrics Setup ──────────────────────────────────────────────────

// Create a Registry to register metrics
const register = new client.Registry();

// Add default Node.js metrics (event loop lag, memory, CPU, etc.)
client.collectDefaultMetrics({ register });

// Counter: total number of HTTP requests received
const httpRequestCounter = new client.Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code'],
  registers: [register]
});

// Histogram: HTTP response time in seconds
const httpResponseTime = new client.Histogram({
  name: 'http_response_time_seconds',
  help: 'HTTP response time in seconds',
  labelNames: ['method', 'route', 'status_code'],
  // Buckets cover fast (5ms) to slow (10s) responses
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
  registers: [register]
});

// Gauge: number of active connections currently being processed
const activeConnectionsGauge = new client.Gauge({
  name: 'active_connections',
  help: 'Number of active connections',
  registers: [register]
});

// ─── Metrics Middleware ────────────────────────────────────────────────────────
// Intercepts every request to record timing and counts
app.use((req, res, next) => {
  // Increment active connections when request starts
  activeConnectionsGauge.inc();

  // Start the response timer
  const end = httpResponseTime.startTimer();

  // When the response finishes, record metrics
  res.on('finish', () => {
    // Normalize route (replace dynamic segments like /api/users/123 → /api/users/:id)
    const route = req.route ? req.route.path : req.path;

    const labels = {
      method: req.method,
      route: route,
      status_code: res.statusCode
    };

    httpRequestCounter.inc(labels);
    end(labels);

    // Decrement active connections when request completes
    activeConnectionsGauge.dec();
  });

  next();
});

// ─── MongoDB Connection ────────────────────────────────────────────────────────
const connectDB = async () => {
  try {
    await mongoose.connect(MONGODB_URI, {
      serverSelectionTimeoutMS: 5000 // Timeout after 5s if MongoDB is unreachable
    });
    console.log(`✅ MongoDB connected: ${MONGODB_URI}`);
  } catch (error) {
    console.error(`❌ MongoDB connection error: ${error.message}`);
    // Retry connection after 5 seconds instead of crashing immediately
    setTimeout(connectDB, 5000);
  }
};

// Listen for disconnection events and attempt reconnect
mongoose.connection.on('disconnected', () => {
  console.warn('⚠️  MongoDB disconnected. Attempting to reconnect...');
  setTimeout(connectDB, 5000);
});

// ─── API Routes ────────────────────────────────────────────────────────────────

/**
 * GET /api/health
 * Health check endpoint — used by Docker health checks and load balancers
 */
app.get('/api/health', async (req, res) => {
  const mongoStatus = mongoose.connection.readyState === 1 ? 'connected' : 'disconnected';

  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    mongodb: mongoStatus,
    environment: process.env.NODE_ENV || 'development'
  });
});

/**
 * GET /api/users
 * Retrieve all users from the database
 */
app.get('/api/users', async (req, res) => {
  try {
    const users = await User.find().sort({ createdAt: -1 });
    res.status(200).json({
      success: true,
      count: users.length,
      data: users
    });
  } catch (error) {
    console.error('Error fetching users:', error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve users'
    });
  }
});

/**
 * POST /api/users
 * Create a new user in the database
 * Body: { "name": "string", "email": "string" }
 */
app.post('/api/users', async (req, res) => {
  try {
    const { name, email } = req.body;

    // Basic input validation
    if (!name || !email) {
      return res.status(400).json({
        success: false,
        error: 'Name and email are required fields'
      });
    }

    const user = new User({ name, email });
    await user.save();

    res.status(201).json({
      success: true,
      data: user
    });
  } catch (error) {
    // Handle duplicate email (MongoDB unique constraint violation)
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        error: 'A user with this email already exists'
      });
    }

    // Handle Mongoose validation errors
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(e => e.message);
      return res.status(400).json({
        success: false,
        error: messages.join(', ')
      });
    }

    console.error('Error creating user:', error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to create user'
    });
  }
});

/**
 * GET /metrics
 * Prometheus scraping endpoint — exposes all registered metrics
 */
app.get('/metrics', async (req, res) => {
  try {
    res.set('Content-Type', register.contentType);
    res.end(await register.metrics());
  } catch (error) {
    res.status(500).end(error.message);
  }
});

// ─── 404 Handler ──────────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: `Route ${req.method} ${req.path} not found`
  });
});

// ─── Global Error Handler ──────────────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err.stack);
  res.status(500).json({
    success: false,
    error: 'Internal server error'
  });
});

// ─── Start Server ──────────────────────────────────────────────────────────────
const startServer = async () => {
  await connectDB();

  app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`📊 Metrics available at http://localhost:${PORT}/metrics`);
    console.log(`🏥 Health check at http://localhost:${PORT}/api/health`);
  });
};

startServer();

module.exports = app;
