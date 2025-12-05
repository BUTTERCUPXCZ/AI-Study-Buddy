import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { SharedArray } from 'k6/data';

// Test configuration
export const options = {
  stages: [
    { duration: '30s', target: 10 }, // Ramp up to 10 users
    { duration: '1m', target: 20 },  // Ramp up to 20 users
    { duration: '2m', target: 20 },  // Stay at 20 users
    { duration: '30s', target: 0 },  // Ramp down to 0 users
  ],
  thresholds: {
    http_req_duration: ['p(95)<2000', 'p(99)<5000'], // 95% < 2s, 99% < 5s
    http_req_failed: ['rate<0.1'],     // Less than 10% of requests should fail
    'group_duration{group:::Auth Flow}': ['avg<1000'],
    'group_duration{group:::Notes CRUD}': ['avg<1500'],
    'group_duration{group:::Quizzes CRUD}': ['avg<1500'],
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';

// Shared test data
const testUsers = new SharedArray('users', function () {
  const users = [];
  for (let i = 0; i < 10; i++) {
    users.push({
      email: `testuser${i}@example.com`,
      password: 'TestPassword123!',
      fullname: `Test User ${i}`,
    });
  }
  return users;
});

let authToken = '';
let userId = '';
let noteId = '';
let quizId = '';

export default function () {
  const user = testUsers[__VU % testUsers.length];

  // Auth Flow
  group('Auth Flow', function () {
    // Register (might fail if user exists, that's ok)
    const registerRes = http.post(
      `${BASE_URL}/auth/register`,
      JSON.stringify({
        Fullname: user.fullname,
        email: user.email,
        password: user.password,
      }),
      {
        headers: { 'Content-Type': 'application/json' },
      }
    );

    // Login
    const loginRes = http.post(
      `${BASE_URL}/auth/login`,
      JSON.stringify({
        email: user.email,
        password: user.password,
        Fullname: user.fullname,
      }),
      {
        headers: { 'Content-Type': 'application/json' },
      }
    );

    check(loginRes, {
      'login status is 200 or 201': (r) => r.status === 200 || r.status === 201,
      'login returns token': (r) => {
        try {
          const body = JSON.parse(r.body);
          return body.access_token !== undefined;
        } catch {
          return false;
        }
      },
    });

    if (loginRes.status === 200 || loginRes.status === 201) {
      const loginData = JSON.parse(loginRes.body);
      authToken = loginData.access_token;
      userId = loginData.user?.id || loginData.userId;
    }

    sleep(1);

    // Get user info
    if (authToken) {
      const meRes = http.get(`${BASE_URL}/auth/me`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });

      check(meRes, {
        'get me status is 200': (r) => r.status === 200,
      });
    }
  });

  if (!authToken || !userId) {
    console.log('Authentication failed, skipping remaining tests');
    return;
  }

  sleep(1);

  // Notes CRUD Operations
  group('Notes CRUD', function () {
    // Create Note
    const createNoteRes = http.post(
      `${BASE_URL}/notes`,
      JSON.stringify({
        userId: userId,
        title: `Test Note ${Date.now()}`,
        content: 'This is a test note with some content for benchmarking.',
        source: 'k6-load-test',
      }),
      {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
      }
    );

    check(createNoteRes, {
      'create note status is 201': (r) => r.status === 201,
      'create note returns id': (r) => {
        try {
          const body = JSON.parse(r.body);
          if (body.id) {
            noteId = body.id;
            return true;
          }
          return false;
        } catch {
          return false;
        }
      },
    });

    sleep(0.5);

    // Get all user notes
    const getNotesRes = http.get(`${BASE_URL}/notes/user/${userId}`, {
      headers: { Authorization: `Bearer ${authToken}` },
    });

    check(getNotesRes, {
      'get notes status is 200': (r) => r.status === 200,
    });

    sleep(0.5);

    // Get single note
    if (noteId) {
      const getNoteRes = http.get(`${BASE_URL}/notes/${noteId}/user/${userId}`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });

      check(getNoteRes, {
        'get note by id status is 200': (r) => r.status === 200,
      });

      sleep(0.5);

      // Update note
      const updateNoteRes = http.put(
        `${BASE_URL}/notes/${noteId}/user/${userId}`,
        JSON.stringify({
          title: `Updated Test Note ${Date.now()}`,
          content: 'This is updated content for the test note.',
        }),
        {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${authToken}`,
          },
        }
      );

      check(updateNoteRes, {
        'update note status is 200': (r) => r.status === 200,
      });
    }
  });

  sleep(1);

  // Quizzes CRUD Operations
  group('Quizzes CRUD', function () {
    // Create Quiz
    const createQuizRes = http.post(
      `${BASE_URL}/quizzes`,
      JSON.stringify({
        userId: userId,
        title: `Test Quiz ${Date.now()}`,
        questions: [
          {
            question: 'What is 2+2?',
            options: ['3', '4', '5', '6'],
            correctAnswer: 1,
          },
          {
            question: 'What is the capital of France?',
            options: ['London', 'Berlin', 'Paris', 'Madrid'],
            correctAnswer: 2,
          },
        ],
        noteId: noteId || undefined,
      }),
      {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
      }
    );

    check(createQuizRes, {
      'create quiz status is 201': (r) => r.status === 201,
      'create quiz returns id': (r) => {
        try {
          const body = JSON.parse(r.body);
          if (body.id) {
            quizId = body.id;
            return true;
          }
          return false;
        } catch {
          return false;
        }
      },
    });

    sleep(0.5);

    // Get all user quizzes
    const getQuizzesRes = http.get(`${BASE_URL}/quizzes/user/${userId}`, {
      headers: { Authorization: `Bearer ${authToken}` },
    });

    check(getQuizzesRes, {
      'get quizzes status is 200': (r) => r.status === 200,
    });

    sleep(0.5);

    // Get single quiz
    if (quizId) {
      const getQuizRes = http.get(`${BASE_URL}/quizzes/${quizId}/user/${userId}`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });

      check(getQuizRes, {
        'get quiz by id status is 200': (r) => r.status === 200,
      });

      sleep(0.5);

      // Update quiz score
      const updateScoreRes = http.put(
        `${BASE_URL}/quizzes/${quizId}/user/${userId}/score`,
        JSON.stringify({
          score: Math.floor(Math.random() * 100),
        }),
        {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${authToken}`,
          },
        }
      );

      check(updateScoreRes, {
        'update quiz score status is 200': (r) => r.status === 200,
      });
    }
  });

  sleep(1);

  // Jobs API
  group('Jobs API', function () {
    // Get user jobs
    const jobsRes = http.get(`${BASE_URL}/jobs/user/${userId}?limit=10`, {
      headers: { Authorization: `Bearer ${authToken}` },
    });

    check(jobsRes, {
      'get user jobs status is 200': (r) => r.status === 200,
    });
  });

  sleep(2);

  // Cleanup - Delete created resources
  group('Cleanup', function () {
    if (quizId) {
      http.del(`${BASE_URL}/quizzes/${quizId}/user/${userId}`, null, {
        headers: { Authorization: `Bearer ${authToken}` },
      });
    }

    if (noteId) {
      http.del(`${BASE_URL}/notes/${noteId}/user/${userId}`, null, {
        headers: { Authorization: `Bearer ${authToken}` },
      });
    }
  });

  sleep(1);
}
