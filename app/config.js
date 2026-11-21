const os = require('os');
require('dotenv').config();

module.exports = {
  port: parseInt(process.env.PORT, 10) || 3000,
  mongoUri: process.env.MONGO_URI || 'mongodb://localhost:27017/resilience_lab',
  sessionSecret: process.env.SESSION_SECRET || 'resilience-lab-default-secret',
  logLevel: process.env.LOG_LEVEL || 'info',
  reportWorkIterations: parseInt(process.env.REPORT_WORK_ITERATIONS, 10) || 40000,
  instanceId: os.hostname(),
};
