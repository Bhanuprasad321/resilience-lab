const config = require('../config');

// Injects X-Instance-Id (container hostname) into every response header
// Used in load balancing and failover verification
module.exports = function instanceIdMiddleware(req, res, next) {
  res.setHeader('X-Instance-Id', config.instanceId);
  next();
};
