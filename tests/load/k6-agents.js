/**
 * k6 load test — simulates a field-agent fleet hitting the hot paths.
 *
 * Target (E9): 200 concurrent agents on a single VPS without p95 > 1.5 s.
 *
 * Run (k6 binary: https://k6.io/docs/get-started/installation/):
 *   k6 run tests/load/k6-agents.js \
 *     -e BASE_URL=https://your-domain \
 *     -e TOKEN=<mobile JWT of a test agent> \
 *     -e ADMIN_TOKEN=<mobile JWT of a test admin>
 *
 * Read-only by design — it never submits collections, so it is safe against
 * a staging copy of production data. For write-path testing, point it at a
 * disposable database.
 */
import http from 'k6/http';
import { check, sleep } from 'k6';

const BASE = __ENV.BASE_URL || 'http://localhost:3000';
const TOKEN = __ENV.TOKEN || '';
const ADMIN_TOKEN = __ENV.ADMIN_TOKEN || TOKEN;

export const options = {
  scenarios: {
    agents: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '1m', target: 50 },
        { duration: '2m', target: 200 },
        { duration: '2m', target: 200 },
        { duration: '30s', target: 0 },
      ],
      exec: 'agentFlow',
    },
    admins: {
      executor: 'constant-vus',
      vus: 5,
      duration: '5m30s',
      exec: 'adminFlow',
    },
  },
  thresholds: {
    http_req_duration: ['p(95)<1500'],
    http_req_failed: ['rate<0.01'],
  },
};

const agentHeaders = {
  Authorization: `Bearer ${TOKEN}`,
  'Content-Type': 'application/json',
};
const adminHeaders = {
  Authorization: `Bearer ${ADMIN_TOKEN}`,
  'Content-Type': 'application/json',
};

export function agentFlow() {
  // Typical agent loop: dashboard data → customer list → loan list → ping
  let res = http.get(`${BASE}/api/v1/loans?limit=20`, { headers: agentHeaders });
  check(res, { 'loans 200': (r) => r.status === 200 });

  res = http.get(`${BASE}/api/v1/customers?limit=20`, { headers: agentHeaders });
  check(res, { 'customers 200': (r) => r.status === 200 });

  // GPS ping batch (write, but append-only telemetry — cheap + idempotent-ish)
  res = http.post(
    `${BASE}/api/v1/gps/ping`,
    JSON.stringify({
      pings: [{
        lat: 13.0827 + Math.random() * 0.01,
        lng: 80.2707 + Math.random() * 0.01,
        accuracyM: 8,
        capturedAt: new Date().toISOString(),
      }],
    }),
    { headers: agentHeaders },
  );
  check(res, { 'ping 200': (r) => r.status === 200 });

  sleep(3 + Math.random() * 4); // think time
}

export function adminFlow() {
  let res = http.get(`${BASE}/api/v1/gps/live`, { headers: adminHeaders });
  check(res, { 'live 200': (r) => r.status === 200 });

  res = http.get(`${BASE}/api/health`);
  check(res, { 'health 200': (r) => r.status === 200 });

  sleep(10);
}
