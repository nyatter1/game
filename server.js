/**
 * server.js
 * A robust Express.js server template featuring middleware setup,
 * health checks, and a clean structure for API development.
 */

const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const path = require('path');

// Initialize the Express application
const app = express();

// --- Configuration ---
const PORT = process.env.PORT || 3000;
const NODE_ENV = process.env.NODE_ENV || 'development';

// --- Middleware ---

// Enable Cross-Origin Resource Sharing (CORS)
app.use(cors());

// HTTP request logger (morgan)
app.use(morgan(NODE_ENV === 'development' ? 'dev' : 'combined'));

// Parse incoming JSON payloads
app.use(express.json());

// Parse URL-encoded bodies
app.use(express.urlencoded({ extended: true }));

// Serve static files from a "public" directory if needed
app.use(express.static(path.join(__dirname, 'public')));

// --- Routes ---

/**
 * @route   GET /health
 * @desc    Health check endpoint for monitoring and uptime services
 */
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  });
});

/**
 * @route   GET /api/example
 * @desc    A sample API route
 */
app.get('/api/example', (req, res) => {
  res.status(200).json({
    message: 'Hello from the server!',
    data: {
      items: [1, 2, 3, 4, 5]
    }
  });
});

// --- Error Handling ---

/**
 * 404 Handler
 * Catch-all for any request that doesn't match a defined route
 */
app.use((req, res, next) => {
  const error = new Error(`Not Found - ${req.originalUrl}`);
  res.status(404);
  next(error);
});

/**
 * Global Error Handler
 * Catches all errors passed via next(error)
 */
app.use((err, req, res, next) => {
  const statusCode = res.statusCode === 200 ? 500 : res.statusCode;
  
  res.status(statusCode).json({
    message: err.message,
    // Only show stack trace in development mode
    stack: NODE_ENV === 'development' ? err.stack : '🥞',
  });
});

// --- Server Startup ---

const server = app.listen(PORT, () => {
  console.log(`
  🚀 Server running in ${NODE_ENV} mode
  📡 Listening on port: ${PORT}
  🔗 Health check: http://localhost:${PORT}/health
  `);
});

/**
 * Graceful Shutdown
 * Ensures the server closes connections before exiting
 */
process.on('SIGTERM', () => {
  console.info('SIGTERM signal received. Closing HTTP server...');
  server.close(() => {
    console.log('HTTP server closed.');
    process.exit(0);
  });
});
