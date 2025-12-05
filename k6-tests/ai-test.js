import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Rate } from 'k6/metrics';

// Custom metrics
const aiGenerationErrors = new Rate('ai_generation_errors');

// AI operations are heavy, and Gemini free tier has rate limits
// Using sequential testing (1 user at a time) to avoid rate limit errors
export const options = {
  stages: [
    { duration: '1m', target: 1 },   // Single user only
    { duration: '3m', target: 1 },   // Stay at 1 user for extended test
    { duration: '30s', target: 0 },  // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<30000', 'p(99)<60000'], // AI is slower, more lenient
    ai_generation_errors: ['rate<0.3'], // Allow 30% error rate for rate limits
    'http_req_duration{name:AI Notes Generation}': ['p(95)<30000'],
    'http_req_duration{name:AI Quiz Generation}': ['p(95)<30000'],
    'http_req_duration{name:AI Tutor Chat}': ['p(95)<20000'],
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';

// Sample PDF text for testing
const SAMPLE_PDF_TEXT = `
Introduction to Machine Learning

Machine Learning is a subset of artificial intelligence that focuses on building systems 
that can learn from and make decisions based on data. Unlike traditional programming, 
where we explicitly code rules, ML algorithms learn patterns from data.

Key Concepts:
1. Supervised Learning - Learning from labeled data
2. Unsupervised Learning - Finding patterns in unlabeled data
3. Reinforcement Learning - Learning through trial and error

Popular algorithms include:
- Linear Regression
- Decision Trees
- Neural Networks
- Support Vector Machines

Applications:
Machine learning is used in various fields including image recognition, natural language 
processing, recommendation systems, and autonomous vehicles.
`;

const SAMPLE_STUDY_NOTES = `
# JavaScript Fundamentals

## Variables
- var: function-scoped
- let: block-scoped
- const: block-scoped, immutable reference

## Data Types
1. Primitive: string, number, boolean, undefined, null, symbol, bigint
2. Reference: objects, arrays, functions

## Functions
- Function declaration
- Function expression
- Arrow functions
- Higher-order functions

## Asynchronous JavaScript
- Callbacks
- Promises
- Async/await
`;

let authToken = '';
let userId = '';
let noteId = '';

export function setup() {
  // Login to get auth token
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

  if (loginRes.status === 200 || loginRes.status === 201) {
    const loginData = JSON.parse(loginRes.body);
    return {
      authToken: loginData.access_token,
      userId: loginData.user?.id || loginData.userId,
    };
  }

  console.error('Setup failed: Could not login');
  return { authToken: '', userId: '' };
}

export default function (data) {
  if (!data.authToken || !data.userId) {
    console.log('No auth data, skipping test');
    return;
  }

  authToken = data.authToken;
  userId = data.userId;

  // AI Notes Generation
  group('AI Notes Generation', function () {
    console.log('Starting AI Notes Generation...');
    
    const generateNotesRes = http.post(
      `${BASE_URL}/ai/generate/notes`,
      JSON.stringify({
        pdfText: SAMPLE_PDF_TEXT,
        userId: userId,
        title: `AI Generated Notes ${Date.now()}`,
        source: 'k6-ai-test',
      }),
      {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        tags: { name: 'AI Notes Generation' },
        timeout: '60s', // Increased timeout
      }
    );

    const notesSuccess = check(generateNotesRes, {
      'generate notes status is 201': (r) => r.status === 201,
      'generate notes not rate limited': (r) => r.status !== 429,
      'generate notes returns content': (r) => {
        try {
          const body = JSON.parse(r.body);
          if (body.id) {
            noteId = body.id;
          }
          return body.content !== undefined;
        } catch {
          return false;
        }
      },
    });

    if (generateNotesRes.status === 429) {
      console.log('Rate limit hit on Notes Generation - waiting longer...');
    }

    aiGenerationErrors.add(!notesSuccess);
  });

  // Longer sleep to respect rate limits (Gemini free tier: ~15 requests/min)
  sleep(5);

  // AI Quiz Generation
  group('AI Quiz Generation', function () {
    console.log('Starting AI Quiz Generation...');
    
    const generateQuizRes = http.post(
      `${BASE_URL}/ai/generate/quiz`,
      JSON.stringify({
        studyNotes: SAMPLE_STUDY_NOTES,
        userId: userId,
        title: `AI Generated Quiz ${Date.now()}`,
        noteId: noteId || undefined,
      }),
      {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        tags: { name: 'AI Quiz Generation' },
        timeout: '60s', // Increased timeout
      }
    );

    const quizSuccess = check(generateQuizRes, {
      'generate quiz status is 201': (r) => r.status === 201,
      'generate quiz not rate limited': (r) => r.status !== 429,
      'generate quiz returns questions': (r) => {
        try {
          const body = JSON.parse(r.body);
          return Array.isArray(body.questions) && body.questions.length > 0;
        } catch {
          return false;
        }
      },
    });

    if (generateQuizRes.status === 429) {
      console.log('Rate limit hit on Quiz Generation - waiting longer...');
    }

    aiGenerationErrors.add(!quizSuccess);
  });

  // Longer sleep to respect rate limits
  sleep(5);

  // AI Tutor Chat (Non-streaming)
  group('AI Tutor Chat', function () {
    console.log('Starting AI Tutor Chat...');
    
    const tutorChatRes = http.post(
      `${BASE_URL}/ai/tutor/chat`,
      JSON.stringify({
        userQuestion: 'Can you explain what machine learning is in simple terms?',
        userId: userId,
        noteId: noteId || undefined,
      }),
      {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        tags: { name: 'AI Tutor Chat' },
        timeout: '60s', // Increased timeout
      }
    );

    const chatSuccess = check(tutorChatRes, {
      'tutor chat status is 201': (r) => r.status === 201,
      'tutor chat not rate limited': (r) => r.status !== 429,
      'tutor chat returns response': (r) => {
        try {
          const body = JSON.parse(r.body);
          return body.aiResponse !== undefined || body.response !== undefined;
        } catch {
          return false;
        }
      },
    });

    if (tutorChatRes.status === 429) {
      console.log('Rate limit hit on Tutor Chat - waiting longer...');
    }

    aiGenerationErrors.add(!chatSuccess);
  });

  // Longer sleep to respect rate limits
  sleep(5);

  // Get AI Tutor Sessions
  group('AI Tutor Sessions', function () {
    const sessionsRes = http.get(
      `${BASE_URL}/ai/tutor/sessions/user/${userId}`,
      {
        headers: { Authorization: `Bearer ${authToken}` },
      }
    );

    check(sessionsRes, {
      'get sessions status is 200': (r) => r.status === 200,
    });
  });

  // Final delay before next iteration to ensure we don't hit rate limits
  sleep(10);
}

export function teardown(data) {
  console.log('AI tests completed - Sequential execution to respect Gemini free tier rate limits');
}
