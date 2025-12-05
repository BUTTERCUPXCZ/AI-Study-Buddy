import http from 'k6/http';
import { check, sleep } from 'k6';

// Spike test - sudden traffic surge
export const options = {
  stages: [
    { duration: '1m', target: 10 },   // Warm up
    { duration: '10s', target: 200 }, // Spike to 200 users
    { duration: '1m', target: 200 },  // Hold spike
    { duration: '10s', target: 10 },  // Drop back down
    { duration: '1m', target: 10 },   // Recovery
    { duration: '10s', target: 0 },   // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<5000'], // More lenient during spike
    http_req_failed: ['rate<0.4'], // Allow higher error rate during spike
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';

export default function () {
  // Simulate users hitting read-heavy endpoints during traffic spike
  const loginRes = http.post(
    `${BASE_URL}/auth/login`,
    JSON.stringify({
      email: `testuser${__VU % 50}@example.com`,
      password: 'TestPassword123!',
      Fullname: `Test User ${__VU % 50}`,
    }),
    {
      headers: { 'Content-Type': 'application/json' },
    }
  );

  if (loginRes.status === 200 || loginRes.status === 201) {
    const loginData = JSON.parse(loginRes.body);
    const authToken = loginData.access_token;
    const userId = loginData.user?.id || loginData.userId;

    // Multiple rapid GET requests (simulating homepage load)
    http.batch([
      ['GET', `${BASE_URL}/notes/user/${userId}`, null, {
        headers: { Authorization: `Bearer ${authToken}` },
      }],
      ['GET', `${BASE_URL}/quizzes/user/${userId}`, null, {
        headers: { Authorization: `Bearer ${authToken}` },
      }],
      ['GET', `${BASE_URL}/jobs/user/${userId}`, null, {
        headers: { Authorization: `Bearer ${authToken}` },
      }],
    ]);
  }

  sleep(0.1); // Minimal sleep during spike
}
