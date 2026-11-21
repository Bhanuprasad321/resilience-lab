const autocannon = require('autocannon');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const TARGET_URL = process.env.TARGET_URL || 'http://localhost:3000';
const CONNECTIONS = parseInt(process.env.LOAD_TEST_CONNECTIONS, 10) || 20;
const DURATION = parseInt(process.env.LOAD_TEST_DURATION, 10) || 20;
const WARMUP_DURATION = parseInt(process.env.LOAD_TEST_WARMUP, 10) || 5;
const COOLDOWN_DURATION = parseInt(process.env.LOAD_TEST_COOLDOWN, 10) || 5;

const BENCHMARK_TITLE = process.env.BENCHMARK_TITLE || 'PHASE 2 - STEP 2 (CPU-BOUND REPORT)';
const BENCHMARK_PREFIX = process.env.BENCHMARK_PREFIX || 'p2-step2-';
const RESULTS_DIR = path.join(__dirname, '..', 'results', 'data');

if (!fs.existsSync(RESULTS_DIR)) {
  fs.mkdirSync(RESULTS_DIR, { recursive: true });
}

const sleep = (seconds) =>
  new Promise((resolve) => {
    console.log(`\n[Cooldown] Waiting ${seconds}s between benchmarks for connections and event loop to settle...`);
    setTimeout(resolve, seconds * 1000);
  });

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
  const timeouts = result.timeouts || 0;
  const non2xx = result.non2xx || 0;
  const totalFailures = totalErrors + timeouts + non2xx;
  const errorRate = totalRequests > 0 ? ((totalFailures / totalRequests) * 100).toFixed(2) : 0;

  return {
    endpoint,
    parameters: {
      url: `${TARGET_URL}${endpoint}`,
      connections: CONNECTIONS,
      duration: DURATION,
      warmupDuration: WARMUP_DURATION,
      cpuLimits: {
        app: '0.5',
        mongo: '1.0',
      },
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
      timeouts,
      non2xx,
      statusCodes: {
        '2xx': result['2xx'] || result.res2xx || 0,
        '4xx': result['4xx'] || result.res4xx || 0,
        '5xx': result['5xx'] || result.res5xx || 0,
      },
    },
    timestamp: new Date().toISOString(),
  };
}

async function runBenchmarkSuite(benchmark) {
  const fullUrl = `${TARGET_URL}${benchmark.endpoint}`;

  // 1. Warm up benchmark's own endpoint
  console.log(`\n[Warm-up] Warming up ${fullUrl} for ${WARMUP_DURATION}s...`);
  await runAutocannon({
    url: fullUrl,
    connections: 5,
    duration: WARMUP_DURATION,
  }, `WARM-UP: ${benchmark.name}`);

  // Brief pause after warmup to let sockets reset
  await new Promise((r) => setTimeout(r, 1000));

  // 2. Run actual measurement
  const result = await runAutocannon({
    url: fullUrl,
    connections: CONNECTIONS,
    duration: DURATION,
  }, `BENCHMARK: ${benchmark.name}`);

  const metrics = extractMetrics(result, benchmark.endpoint, {
    description: benchmark.description,
  });

  const filePath = path.join(RESULTS_DIR, benchmark.outputFile);
  fs.writeFileSync(filePath, JSON.stringify(metrics, null, 2), 'utf-8');
  console.log(`Saved metrics to: ${filePath}`);

  return metrics;
}

async function main() {
  console.log(`Starting Load Tests: ${BENCHMARK_TITLE} against: ${TARGET_URL}`);
  console.log(`Configuration: Connections=${CONNECTIONS}, Duration=${DURATION}s, Warmup=${WARMUP_DURATION}s, Cooldown=${COOLDOWN_DURATION}s\n`);

  const benchmarks = [
    {
      name: 'List Products (Fast Path)',
      description: 'Standard product pagination without search filter',
      endpoint: '/products?limit=20',
      outputFile: `${BENCHMARK_PREFIX}list.json`,
    },
    {
      name: 'Common Search (Early Exit)',
      description: 'Indexed search on common term',
      endpoint: '/products?search=wireless&limit=20',
      outputFile: `${BENCHMARK_PREFIX}search-common.json`,
    },
    {
      name: 'Full-Scan Search Benchmark (Zero Match)',
      description: 'Indexed search on zero-match term ($text token lookup)',
      endpoint: '/products?search=zzzxqy&limit=20',
      outputFile: `${BENCHMARK_PREFIX}search-fullscan.json`,
    },
    {
      name: 'CPU-Bound Report Path',
      description: 'Synchronous CPU hashing workload (~50ms computation)',
      endpoint: '/report',
      outputFile: `${BENCHMARK_PREFIX}report.json`,
    },
  ];

  const results = [];

  for (let i = 0; i < benchmarks.length; i++) {
    const bench = benchmarks[i];
    const metrics = await runBenchmarkSuite(bench);
    results.push(metrics);

    // Cooldown pause between benchmarks (except after the final benchmark)
    if (i < benchmarks.length - 1) {
      await sleep(COOLDOWN_DURATION);
    }
  }

  // Comparison Summary Table
  console.log('\n========================================================================================');
  console.log(`                    BENCHMARK SUMMARY (${BENCHMARK_TITLE})              `);
  console.log('========================================================================================');
  console.table(
    results.map((res) => ({
      'Endpoint': res.endpoint,
      'Throughput (req/s)': res.metrics.requestsPerSecond.average.toFixed(1),
      'Latency p50 (ms)': res.metrics.latencyMs.p50,
      'Latency p99 (ms)': res.metrics.latencyMs.p99,
      'Max Latency (ms)': res.metrics.latencyMs.max,
      'Timeouts': res.metrics.timeouts,
      'Errors': res.metrics.totalErrors,
      'Error Rate (%)': `${res.metrics.errorRate}%`,
      'Total Reqs': res.metrics.totalRequests,
    }))
  );
  console.log('========================================================================================\n');
}

main().catch((err) => {
  console.error('Load test runner failed:', err);
  process.exit(1);
});
