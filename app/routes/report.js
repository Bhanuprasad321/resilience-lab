const express = require('express');
const crypto = require('crypto');
const router = express.Router();
const config = require('../config');

// GET /report - CPU-bound endpoint simulating heavy analytical processing
// Executes synchronous PBKDF2 hashing on Node.js main thread
// Calibrated to consume ~50ms of CPU time per request under 0.5 CPU limit
router.get('/', (req, res) => {
  const iterations = parseInt(req.query.iterations, 10) || config.reportWorkIterations;
  const startTime = process.hrtime.bigint();

  // Synchronous cryptographic hashing to saturate CPU without database or network I/O
  const key = crypto.pbkdf2Sync(
    'resilience-lab-report-workload-key',
    'resilience-lab-benchmark-salt-2026',
    iterations,
    32,
    'sha256'
  );

  const durationMs = Number(process.hrtime.bigint() - startTime) / 1e6;

  res.json({
    status: 'ok',
    report: 'Inventory & Sales Aggregation Report',
    iterations,
    computeDurationMs: parseFloat(durationMs.toFixed(2)),
    digest: key.toString('hex').slice(0, 16),
  });
});

module.exports = router;
