const mongoose = require('mongoose');
const config = require('./config');
const { logger } = require('./middleware/logger');

async function connectDB() {
  try {
    await mongoose.connect(config.mongoUri, {
      serverSelectionTimeoutMS: 5000,
    });
    logger.info({ mongoUri: config.mongoUri }, 'Successfully connected to MongoDB');
  } catch (err) {
    logger.error({ err: err.message, mongoUri: config.mongoUri }, 'MongoDB connection failed');
    process.exit(1);
  }
}

mongoose.connection.on('disconnected', () => {
  logger.warn('MongoDB connection disconnected');
});

module.exports = { connectDB };
