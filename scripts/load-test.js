const autocannon = require('autocannon');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const TARGET_URL = process.env.TARGET_URL || 'http://localhost:3000';
const CONNECTIONS = parseInt(process.env.LOAD_TEST_CONNECTIONS, 10) || 20;
const DURATION = parseInt(process.env.LOAD_TEST_DURATION, 10) || 20;
const WARMUP_DURATION = parseInt(process.env.LOAD_TEST_WARMUP, 10) || 5;

const RESULTS_DIR = path.join(__dirname, '..', 'results', 'data');

if (!fs.existsSync(RESULTS_DIR)) {
  fs.mkdirSync(RESULTS_DIR, { recursive: true });
}

function runAutocannon(opts, label) {
  return new Promise((resolve, reject) => {
    console.log(`\n======================================================`);
    console.log(`[${label}] Running: ${opts.method || 'GET'} ${opts.url}`);
    console.log(`Parameters: ${opts.connections} connections, ${opts.duration}s duration`);
    console.log(`======================================================`);

    const instance = autocannon(opts, (err, result) => {
      if (err) return reject(err);
      resolve(result);
    });

    autocannon.track(instance, { renderProgressBar: true });
  });
}

function extractMetrics(result, endpoint, extraParams = {}) {
  const reqPerSec = result.requests ? result.requests.average : 0;
  const p50 = result.latency ? result.latency.p50 : 0;
  const p90 = result.latency ? result.latency.p90 : 0;
  const p99 = result.latency ? result.latency.p99 : 0;
  const max = result.latency ? result.latency.max : 0;
  const totalRequests = result.requests ? result.requests.total : 0;
  const totalErrors = result.errors || 0;
  const non2xx = result.non2xx || 0;
  const totalFailures = totalErrors + non2xx;
  const errorRate = totalRequests > 0 ? ((totalFailures / totalRequests) * 100).toFixed(2) : 0;

  return {
    endpoint,
    parameters: {
      connections: CONNECTIONS,
      duration: DURATION,
      warmupDuration: WARMUP_DURATION,
      cpuLimit: '0.5',
      ...extraParams,
    },
    metrics: {
      requestsPerSecond: {
        average: reqPerSec,
        mean: result.requests ? result.requests.mean : 0,
        max: result.requests ? result.requests.max : 0,
      },
      latencyMs: {
        p50,
        p90,
        p99,
        max,
      },
      errorRate: parseFloat(errorRate),
      totalRequests,
      totalErrors,
      non2xx,
    },
    timestamp: new Date().toISOString(),
  };
}

async function main() {
  console.log(`Starting Phase 1 Baseline Load Tests against: ${TARGET_URL}`);
  console.log(`Configuration: Connections=${CONNECTIONS}, Duration=${DURATION}s, Warmup=${WARMUP_DURATION}s\n`);

  // 1. Warm-up phase
  console.log(`[Warm-up] Priming connection pool and JIT for ${WARMUP_DURATION}s...`);
  await runAutocannon({
    url: `${TARGET_URL}/health`,
    connections: 5,
    duration: WARMUP_DURATION,
  }, 'WARM-UP');

  // 2. Test 1: Fast Path - GET /products?limit=20
  const listResult = await runAutocannon({
    url: `${TARGET_URL}/products?limit=20`,
    connections: CONNECTIONS,
    duration: DURATION,
  }, 'TEST 1: LIST PRODUCTS (FAST PATH)');

  const listMetrics = extractMetrics(listResult, '/products?limit=20');
  const listFilePath = path.join(RESULTS_DIR, 'baseline-list.json');
  fs.writeFileSync(listFilePath, JSON.stringify(listMetrics, null, 2), 'utf-8');
  console.log(`Saved list test metrics to: ${listFilePath}`);

  // 3. Test 2: Slow Path - GET /products?search=wireless (unindexed regex scan across 50,000 multi-sentence documents)
  const searchResult = await runAutocannon({
    url: `${TARGET_URL}/products?search=wireless`,
    connections: CONNECTIONS,
    duration: DURATION,
  }, 'TEST 2: UNINDEXED SEARCH (BOTTLENECK PATH)');

  const searchMetrics = extractMetrics(searchResult, '/products?search=wireless');
  const searchFilePath = path.join(RESULTS_DIR, 'baseline-search.json');
  fs.writeFileSync(searchFilePath, JSON.stringify(searchMetrics, null, 2), 'utf-8');
  console.log(`Saved search test metrics to: ${searchFilePath}`);

  // 4. Comparison Summary Table
  console.log('\n========================================================================');
  console.log('                   PHASE 1 BASELINE BENCHMARK SUMMARY                   ');
  console.log('========================================================================');
  console.table([
    {
      'Endpoint': listMetrics.endpoint,
      'Throughput (req/s)': listMetrics.metrics.requestsPerSecond.average.toFixed(1),
      'Latency p50 (ms)': listMetrics.metrics.latencyMs.p50,
      'Latency p99 (ms)': listMetrics.metrics.latencyMs.p99,
      'Error Rate (%)': `${listMetrics.metrics.errorRate}%`,
      'Total Reqs': listMetrics.metrics.totalRequests,
    },
    {
      'Endpoint': searchMetrics.endpoint,
      'Throughput (req/s)': searchMetrics.metrics.requestsPerSecond.average.toFixed(1),
      'Latency p50 (ms)': searchMetrics.metrics.latencyMs.p50,
      'Latency p99 (ms)': searchMetrics.metrics.latencyMs.p99,
      'Error Rate (%)': `${searchMetrics.metrics.errorRate}%`,
      'Total Reqs': searchMetrics.metrics.totalRequests,
    },
  ]);
  console.log('========================================================================\n');
}

main().catch((err) => {
  console.error('Load test runner failed:', err);
  process.exit(1);
});
