const pino = require('pino');
const pinoHttp = require('pino-http');
const config = require('../config');

const logger = pino({
  level: config.logLevel,
  base: {
    instanceId: config.instanceId,
  },
  timestamp: pino.stdTimeFunctions.isoTime,
});

const httpLogger = pinoHttp({
  logger,
  genReqId: (req) => req.headers['x-request-id'] || require('crypto').randomUUID(),
  customLogLevel: (req, res, err) => {
    if (res.statusCode >= 500 || err) return 'error';
    if (res.statusCode >= 400) return 'warn';
    return 'info';
  },
});

module.exports = { logger, httpLogger };
