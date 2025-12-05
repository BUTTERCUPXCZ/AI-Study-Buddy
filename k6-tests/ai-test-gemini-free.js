import http from 'k6/http';
import { check, sleep } from 'k6';

// Gemini Free Tier Safe Test
// This test runs ONE AI operation at a time with long delays between requests
// Gemini Free Tier limits: ~15 requests per minute, 1500 requests per day

export const options = {
  vus: 1, // Only 1 virtual user
  iterations: 3, // Run 3 iterations total (one for each AI feature)
  thresholds: {
    http_req_duration: ['p(95)<60000'], // 60 seconds
    http_req_failed: ['rate<0.5'], // Allow 50% failure for rate limits
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';

// Sample data
const SAMPLE_PDF_TEXT = `
Introduction to Machine Learning

Machine Learning is a subset of artificial intelligence that focuses on building systems 
that can learn from and make decisions based on data. Unlike traditional programming, 
where we explicitly code rules, ML algorithms learn patterns from data.

Key Concepts:
1. Supervised Learning - Learning from labeled data
2. Unsupervised Learning - Finding patterns in unlabeled data
3. Reinforcement Learning - Learning through trial and error

Popular algorithms include Linear Regression, Decision Trees, Neural Networks, and 
Support Vector Machines.
`;

const SAMPLE_STUDY_NOTES = `
# JavaScript Fundamentals

## Variables
- var: function-scoped
- let: block-scoped
- const: block-scoped, immutable reference

## Data Types
1. Primitive: string, number, boolean, undefined, null, symbol
2. Reference: objects, arrays, functions
`;

export function setup() {
  console.log('==============================================');
  console.log('  Gemini Free Tier Safe Test');
  console.log('  1 request at a time with 60s delays');
  console.log('==============================================');
  
  // Login
  const loginRes = http.post(
    `${BASE_URL}/auth/login`,
    JSON.stringify({
      email: 'ivaneltagonde5@gmail.com',
      password: 'ivan2003',
      Fullname: 'Ivan Eltagonde',
    }),
    {
      headers: { 'Content-Type': 'application/json' },
    }
  );

  // If login failed, try to register the test user then login again
  if (loginRes.status === 200 || loginRes.status === 201) {
    const loginData = JSON.parse(loginRes.body);
    return {
      authToken: loginData.access_token,
      userId: loginData.user?.id || loginData.userId,
    };
  }

  // Attempt to register the user (safe to call even if user exists)
  console.log('Login failed, attempting to register test user...');
  const registerRes = http.post(
    `${BASE_URL}/auth/register`,
    JSON.stringify({
      Fullname: 'Ivan Eltagonde',
      email: 'ivaneltagonde5@example.com',
      password: 'ivan2003',
    }),
    {
      headers: { 'Content-Type': 'application/json' },
    }
  );

  if (registerRes.status === 201 || registerRes.status === 200) {
    console.log('Register succeeded, attempting login again...');
    const reloginRes = http.post(
      `${BASE_URL}/auth/login`,
      JSON.stringify({
        email: 'ivaneltagonde5@example.com',
        password: 'ivan2003',
        Fullname: 'Ivan Eltagonde',
      }),
      {
        headers: { 'Content-Type': 'application/json' },
      }
    );

    if (reloginRes.status === 200 || reloginRes.status === 201) {
      const loginData = JSON.parse(reloginRes.body);
      return {
        authToken: loginData.access_token,
        userId: loginData.user?.id || loginData.userId,
      };
    }
    console.log(`Re-login failed with status ${reloginRes.status}`);
  } else {
    // If register returns an error, log body to help debug (user might already exist)
    try { console.log('Register response:', registerRes.status, registerRes.body); } catch (e) {}
  }

  console.error('Setup failed: Could not login or register test user');
  return { authToken: '', userId: '' };
}

export default function (data) {
  if (!data.authToken || !data.userId) {
    console.log('No auth data, skipping test');
    return;
  }

  const authToken = data.authToken;
  const userId = data.userId;

  // Determine which AI feature to test based on iteration
  const iteration = __ITER + 1;
  
  console.log('');
  console.log('==============================================');
  console.log(`  Iteration ${iteration}/3`);
  console.log('==============================================');

  if (iteration === 1) {
    // Test AI Notes Generation
    console.log('Testing: AI Notes Generation');
    console.log('Waiting 5 seconds before request...');
    sleep(5);

    const notesRes = http.post(
      `${BASE_URL}/ai/generate/notes`,
      JSON.stringify({
        pdfText: SAMPLE_PDF_TEXT,
        userId: userId,
        title: `Gemini Test Notes ${Date.now()}`,
        source: 'k6-gemini-free-test',
      }),
      {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        timeout: '120s',
      }
    );

    const success = check(notesRes, {
      'AI Notes Generation - Success': (r) => r.status === 201,
      'AI Notes Generation - Not Rate Limited': (r) => r.status !== 429,
    });

    if (notesRes.status === 429) {
      console.log('❌ Rate limit hit! Wait 60 seconds before trying again.');
    } else if (success) {
      console.log('✅ AI Notes Generation successful');
    } else {
      console.log(`❌ AI Notes Generation failed with status ${notesRes.status}`);
    }

    console.log('Waiting 60 seconds before next test...');
    sleep(60); // Wait full minute between tests

  } else if (iteration === 2) {
    // Test AI Quiz Generation
    console.log('Testing: AI Quiz Generation');
    console.log('Waiting 5 seconds before request...');
    sleep(5);

    const quizRes = http.post(
      `${BASE_URL}/ai/generate/quiz`,
      JSON.stringify({
        studyNotes: SAMPLE_STUDY_NOTES,
        userId: userId,
        title: `Gemini Test Quiz ${Date.now()}`,
      }),
      {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        timeout: '120s',
      }
    );

    const success = check(quizRes, {
      'AI Quiz Generation - Success': (r) => r.status === 201,
      'AI Quiz Generation - Not Rate Limited': (r) => r.status !== 429,
    });

    if (quizRes.status === 429) {
      console.log('❌ Rate limit hit! Wait 60 seconds before trying again.');
    } else if (success) {
      console.log('✅ AI Quiz Generation successful');
    } else {
      console.log(`❌ AI Quiz Generation failed with status ${quizRes.status}`);
    }

    console.log('Waiting 60 seconds before next test...');
    sleep(60);

  } else if (iteration === 3) {
    // Test AI Tutor Chat
    console.log('Testing: AI Tutor Chat');
    console.log('Waiting 5 seconds before request...');
    sleep(5);

    const chatRes = http.post(
      `${BASE_URL}/ai/tutor/chat`,
      JSON.stringify({
        userQuestion: 'What is machine learning?',
        userId: userId,
      }),
      {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        timeout: '120s',
      }
    );

    const success = check(chatRes, {
      'AI Tutor Chat - Success': (r) => r.status === 201,
      'AI Tutor Chat - Not Rate Limited': (r) => r.status !== 429,
    });

    if (chatRes.status === 429) {
      console.log('❌ Rate limit hit! Wait 60 seconds before trying again.');
    } else if (success) {
      console.log('✅ AI Tutor Chat successful');
    } else {
      console.log(`❌ AI Tutor Chat failed with status ${chatRes.status}`);
    }

    console.log('Test complete!');
    sleep(5);
  }
}

export function teardown(data) {
  console.log('');
  console.log('==============================================');
  console.log('  Gemini Free Tier Test Complete');
  console.log('  Safe to run again in 3-4 minutes');
  console.log('==============================================');
}
