import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

// Custom metrics
const errorRate = new Rate('errors');
const authDuration = new Trend('auth_duration');
const notesDuration = new Trend('notes_duration');

// Stress test configuration - gradually increase load to breaking point
export const options = {
  stages: [
    { duration: '1m', target: 20 },   // Ramp up to 20 users
    { duration: '2m', target: 50 },   // Ramp up to 50 users
    { duration: '2m', target: 100 },  // Ramp up to 100 users
    { duration: '3m', target: 100 },  // Stay at 100 users
    { duration: '2m', target: 150 },  // Push to 150 users
    { duration: '3m', target: 150 },  // Hold at 150 users
    { duration: '2m', target: 0 },    // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<3000', 'p(99)<10000'],
    errors: ['rate<0.3'], // Allow up to 30% error rate in stress test
    http_req_failed: ['rate<0.3'],
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';

let authToken = '';
let userId = '';

export default function () {
  // Login
  const loginStart = Date.now();
  const loginRes = http.post(
    `${BASE_URL}/auth/login`,
    JSON.stringify({
      email: `testuser${__VU}@example.com`,
      password: 'TestPassword123!',
      Fullname: `Test User ${__VU}`,
    }),
    {
      headers: { 'Content-Type': 'application/json' },
    }
  );

  authDuration.add(Date.now() - loginStart);

  const loginSuccess = check(loginRes, {
    'login successful': (r) => r.status === 200 || r.status === 201,
  });

  errorRate.add(!loginSuccess);

  if (loginSuccess) {
    const loginData = JSON.parse(loginRes.body);
    authToken = loginData.access_token;
    userId = loginData.user?.id || loginData.userId;
  } else {
    sleep(1);
    return;
  }

  sleep(0.5);

  // Rapid-fire note operations
  const notesStart = Date.now();
  
  // Create note
  const createRes = http.post(
    `${BASE_URL}/notes`,
    JSON.stringify({
      userId: userId,
      title: `Stress Test Note ${__VU}-${__ITER}`,
      content: `Content created by VU ${__VU} in iteration ${__ITER}`,
      source: 'k6-stress-test',
    }),
    {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`,
      },
    }
  );

  const createSuccess = check(createRes, {
    'create note successful': (r) => r.status === 201,
  });
  errorRate.add(!createSuccess);

  let noteId = '';
  if (createSuccess) {
    try {
      const createData = JSON.parse(createRes.body);
      noteId = createData.id;
    } catch (e) {
      errorRate.add(true);
    }
  }

  // Get all notes
  const getNotesRes = http.get(`${BASE_URL}/notes/user/${userId}`, {
    headers: { Authorization: `Bearer ${authToken}` },
  });

  const getSuccess = check(getNotesRes, {
    'get notes successful': (r) => r.status === 200,
  });
  errorRate.add(!getSuccess);

  notesDuration.add(Date.now() - notesStart);

  // Random sleep to simulate realistic usage
  sleep(Math.random() * 2);

  // Create quiz under stress
  const quizRes = http.post(
    `${BASE_URL}/quizzes`,
    JSON.stringify({
      userId: userId,
      title: `Stress Quiz ${__VU}-${__ITER}`,
      questions: [
        {
          question: 'Stress test question?',
          options: ['A', 'B', 'C', 'D'],
          correctAnswer: 0,
        },
      ],
    }),
    {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`,
      },
    }
  );

  const quizSuccess = check(quizRes, {
    'create quiz successful': (r) => r.status === 201,
  });
  errorRate.add(!quizSuccess);

  sleep(Math.random() * 1);

  // Cleanup
  if (noteId) {
    http.del(`${BASE_URL}/notes/${noteId}/user/${userId}`, null, {
      headers: { Authorization: `Bearer ${authToken}` },
    });
  }

  sleep(1);
}
