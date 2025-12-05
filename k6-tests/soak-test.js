import http from 'k6/http';
import { check, sleep } from 'k6';
import { Counter } from 'k6/metrics';

// Custom metrics
const totalRequests = new Counter('total_requests');
const successfulRequests = new Counter('successful_requests');

// Soak test - sustained load over extended period
export const options = {
  stages: [
    { duration: '5m', target: 20 },   // Ramp up
    { duration: '30m', target: 20 },  // Stay at 20 users for 30 minutes
    { duration: '5m', target: 0 },    // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<2000', 'p(99)<5000'],
    http_req_failed: ['rate<0.1'],
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';

export default function () {
  totalRequests.add(1);

  // Login
  const loginRes = http.post(
    `${BASE_URL}/auth/login`,
    JSON.stringify({
      email: `soaktest${__VU}@example.com`,
      password: 'TestPassword123!',
      Fullname: `Soak Test User ${__VU}`,
    }),
    {
      headers: { 'Content-Type': 'application/json' },
    }
  );

  const loginSuccess = check(loginRes, {
    'login successful': (r) => r.status === 200 || r.status === 201,
  });

  if (!loginSuccess) {
    sleep(5);
    return;
  }

  successfulRequests.add(1);

  const loginData = JSON.parse(loginRes.body);
  const authToken = loginData.access_token;
  const userId = loginData.user?.id || loginData.userId;

  sleep(2);

  // Simulated user workflow - typical usage pattern
  
  // 1. Check notes
  const notesRes = http.get(`${BASE_URL}/notes/user/${userId}`, {
    headers: { Authorization: `Bearer ${authToken}` },
  });
  check(notesRes, { 'notes retrieved': (r) => r.status === 200 });

  sleep(3);

  // 2. Create a note occasionally
  if (Math.random() < 0.3) {
    const createRes = http.post(
      `${BASE_URL}/notes`,
      JSON.stringify({
        userId: userId,
        title: `Soak Test Note ${Date.now()}`,
        content: 'Long-running test content to detect memory leaks and performance degradation',
        source: 'k6-soak-test',
      }),
      {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
      }
    );
    check(createRes, { 'note created': (r) => r.status === 201 });
  }

  sleep(5);

  // 3. Check quizzes
  const quizzesRes = http.get(`${BASE_URL}/quizzes/user/${userId}`, {
    headers: { Authorization: `Bearer ${authToken}` },
  });
  check(quizzesRes, { 'quizzes retrieved': (r) => r.status === 200 });

  sleep(4);

  // 4. Check jobs
  const jobsRes = http.get(`${BASE_URL}/jobs/user/${userId}`, {
    headers: { Authorization: `Bearer ${authToken}` },
  });
  check(jobsRes, { 'jobs retrieved': (r) => r.status === 200 });

  // Realistic pause between user actions
  sleep(10);
}

export function handleSummary(data) {
  return {
    'soak-test-summary.json': JSON.stringify(data),
  };
}
