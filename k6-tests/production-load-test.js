import http from 'k6/http';
import { check, group, sleep } from 'k6';
import { SharedArray } from 'k6/data';

export const options = {
  // Use scenario executors appropriate for production-like loads
  scenarios: {
    // Constant arrival rate: target X requests/sec for Y minutes
    constant_load: {
      executor: 'constant-arrival-rate',
      rate: __ENV.TARGET_RPS ? parseInt(__ENV.TARGET_RPS) : 50, // requests/sec
      timeUnit: '1s',
      duration: __ENV.DURATION || '3m',
      preAllocatedVUs: 200,
      maxVUs: 2000,
      exec: 'stress',
    },
    // Background low-rate user journeys (optional)
    smoke: {
      executor: 'shared-iterations',
      vus: 5,
      iterations: 20,
      maxDuration: '1m',
      exec: 'userJourney',
    },
  },

  // Fail the test if too many requests fail or p95 is too high
  thresholds: {
    'http_req_failed': ['rate<0.01'], // <1% errors
    'http_req_duration': ['p(95)<1200'], // p95 under 1.2s
    checks: ['rate>0.99'], // 99% checks must pass
  },

  // Useful summary fields
  summaryTrendStats: ['avg', 'min', 'med', 'max', 'p(95)', 'p(99)'],
};

// Load some immutable data once per test (e.g., sample payloads)
const payloads = new SharedArray('payloads', function () {
  return [
    JSON.stringify({ title: 'note A', content: 'sample content' }),
    JSON.stringify({ title: 'note B', content: 'sample content B' }),
  ];
});

// Setup runs once: do login and return auth token(s)
export function setup() {
  const BASE = __ENV.BASE_URL || 'http://localhost:3000';
  const email = __ENV.TEST_EMAIL;
  const password = __ENV.TEST_PASSWORD;

  if (!email || !password) {
    console.warn('TEST_EMAIL & TEST_PASSWORD not provided. Some endpoints may fail.');
  }

  // Example login request: adapt path to your API
  const loginRes = http.post(`${BASE}/auth/login`, JSON.stringify({ email, password }), {
    headers: { 'Content-Type': 'application/json' },
    tags: { name: 'login' },
  });

  if (loginRes.status !== 200) {
    console.warn('Login failed in setup, status:', loginRes.status);
  }

  let token = null;
  try {
    token = loginRes.json('token') || loginRes.json('accessToken') || null;
  } catch (e) {
    // Keep token null if parsing fails; script will still run but protected endpoints will fail.
  }

  return { token, base: BASE };
}

// Primary high-rate executor function
export function stress(data) {
  const BASE = data.base || __ENV.BASE_URL || 'http://localhost:3000';
  const authHeader = data.token ? { Authorization: `Bearer ${data.token}` } : {};

  // Choose payload randomly to vary requests
  const body = payloads[Math.floor(Math.random() * payloads.length)];

  // Example: create resource (POST) then fetch list (GET)
  const createRes = http.post(`${BASE}/api/notes`, body, {
    headers: Object.assign({ 'Content-Type': 'application/json' }, authHeader),
    tags: { name: 'create_note' },
  });

  check(createRes, {
    'create note status 201 or 200': (r) => r.status === 201 || r.status === 200,
  });

  // Then fetch notes (simulate read-heavy traffic)
  const listRes = http.get(`${BASE}/notes`, { headers: authHeader, tags: { name: 'list_notes' } });
  check(listRes, { 'list notes 200': (r) => r.status === 200 });

  // Small sleep to allow pacing per VU; constant-arrival-rate controls aggregate RPS
  sleep(0.05);
}

// Lower-volume user journey example
export function userJourney(data) {
  const BASE = data.base || __ENV.BASE_URL || 'http://localhost:3000';
  const authHeader = data.token ? { Authorization: `Bearer ${data.token}` } : {};

  // Visit home
  http.get(`${BASE}/`, { tags: { name: 'home' } });
  sleep(0.5);

  // Login (idempotent for testing; you may prefer setup to handle auth)
  const email = __ENV.TEST_EMAIL;
  const password = __ENV.TEST_PASSWORD;
  if (email && password) {
    http.post(`${BASE}/auth/login`, JSON.stringify({ email, password }), {
      headers: { 'Content-Type': 'application/json' },
      tags: { name: 'login_journey' },
    });
  }

  sleep(1);
  // Read notes
  http.get(`${BASE}/api/notes`, { headers: authHeader, tags: { name: 'list_notes_journey' } });
}

export function teardown(data) {
  // Optionally clean up test data created during the run (call delete endpoints),
  // or export additional metrics to external systems. Keep teardown idempotent.
}
