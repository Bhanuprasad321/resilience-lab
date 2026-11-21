const express = require('express');
const session = require('express-session');
const config = require('./config');
const { connectDB } = require('./db');
const { logger, httpLogger } = require('./middleware/logger');
const instanceIdMiddleware = require('./middleware/instanceId');

// Route modules
const healthRoute = require('./routes/health');
const productsRoute = require('./routes/products');
const authRoute = require('./routes/auth');
const cartRoute = require('./routes/cart');
const checkoutRoute = require('./routes/checkout');
const reportRoute = require('./routes/report');

const app = express();

// Global middlewares
app.use(instanceIdMiddleware);
app.use(httpLogger);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// In-memory session store (MemoryStore) for Phase 1 baseline
// In Phase 2, this will demonstrate session loss across multiple app instances
app.use(
  session({
    secret: config.sessionSecret,
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: false,
      httpOnly: true,
      maxAge: 24 * 60 * 60 * 1000,
    },
  })
);

// Route mounting
app.use('/health', healthRoute);
app.use('/products', productsRoute);
app.use('/auth', authRoute);
app.use('/cart', cartRoute);
app.use('/checkout', checkoutRoute);
app.use('/report', reportRoute);

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

// Global error handler
app.use((err, req, res, next) => {
  logger.error({ err: err.message, stack: err.stack }, 'Unhandled error during request processing');
  res.status(500).json({ error: 'Internal Server Error' });
});

// Server bootstrap with graceful shutdown
async function start() {
  await connectDB();
  const server = app.listen(config.port, () => {
    logger.info({ port: config.port, instanceId: config.instanceId }, 'Mini Store application started');
  });

  const shutdown = () => {
    logger.info('Shutting down server gracefully...');
    server.close(() => {
      logger.info('HTTP server closed');
      process.exit(0);
    });
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

start();
