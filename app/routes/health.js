const express = require('express');
const router = express.Router();
const config = require('../config');

// Health check endpoint - returns process status, uptime, and instance ID
router.get('/', (req, res) => {
  res.json({
    status: 'ok',
    uptime: process.uptime(),
    instanceId: config.instanceId,
    timestamp: new Date().toISOString(),
  });
});

module.exports = router;
