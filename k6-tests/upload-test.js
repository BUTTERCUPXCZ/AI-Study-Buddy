import http from 'k6/http';
import { check, sleep } from 'k6';
import { FormData } from 'https://jslib.k6.io/formdata/0.0.2/index.js';

// Upload test with file operations
export const options = {
  stages: [
    { duration: '30s', target: 5 },  // Ramp up to 5 users
    { duration: '1m', target: 5 },   // Stay at 5 users
    { duration: '30s', target: 0 },  // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<5000'], // Uploads take longer
    http_req_failed: ['rate<0.15'],
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';

// Sample PDF content (simple text representation)
const SAMPLE_PDF_CONTENT = `%PDF-1.4
Sample PDF content for testing
This is a test document
End of PDF`;

export default function () {
  // Login
  const loginRes = http.post(
    `${BASE_URL}/auth/login`,
    JSON.stringify({
      email: `uploadtest${__VU}@example.com`,
      password: 'TestPassword123!',
      Fullname: `Upload Test User ${__VU}`,
    }),
    {
      headers: { 'Content-Type': 'application/json' },
    }
  );

  if (loginRes.status !== 200 && loginRes.status !== 201) {
    console.log('Login failed, skipping upload test');
    sleep(2);
    return;
  }

  const loginData = JSON.parse(loginRes.body);
  const authToken = loginData.access_token;
  const userId = loginData.user?.id || loginData.userId;

  sleep(1);

  // Upload PDF file
  const fd = new FormData();
  fd.append('file', http.file(SAMPLE_PDF_CONTENT, 'test-document.pdf', 'application/pdf'));
  fd.append('userId', userId);
  fd.append('fileName', `test-upload-${Date.now()}.pdf`);

  const uploadRes = http.post(`${BASE_URL}/upload`, fd.body(), {
    headers: {
      'Content-Type': 'multipart/form-data; boundary=' + fd.boundary,
      Authorization: `Bearer ${authToken}`,
    },
  });

  const uploadSuccess = check(uploadRes, {
    'upload status is 200 or 201': (r) => r.status === 200 || r.status === 201,
    'upload returns file info': (r) => {
      try {
        const body = JSON.parse(r.body);
        return body.id !== undefined || body.fileId !== undefined;
      } catch {
        return false;
      }
    },
  });

  let fileId = '';
  if (uploadSuccess) {
    try {
      const uploadData = JSON.parse(uploadRes.body);
      fileId = uploadData.id || uploadData.fileId;
    } catch (e) {
      console.log('Could not parse upload response');
    }
  }

  sleep(2);

  // Get user files
  const filesRes = http.get(`${BASE_URL}/upload/user/${userId}`, {
    headers: { Authorization: `Bearer ${authToken}` },
  });

  check(filesRes, {
    'get files status is 200': (r) => r.status === 200,
    'files list is array': (r) => {
      try {
        const body = JSON.parse(r.body);
        return Array.isArray(body) || Array.isArray(body.files);
      } catch {
        return false;
      }
    },
  });

  sleep(1);

  // Get specific file
  if (fileId) {
    const fileRes = http.get(`${BASE_URL}/upload/${fileId}`, {
      headers: { Authorization: `Bearer ${authToken}` },
    });

    check(fileRes, {
      'get file status is 200': (r) => r.status === 200,
    });

    sleep(1);

    // Delete file
    const deleteRes = http.del(
      `${BASE_URL}/upload/${fileId}?userId=${userId}`,
      null,
      {
        headers: { Authorization: `Bearer ${authToken}` },
      }
    );

    check(deleteRes, {
      'delete file successful': (r) => r.status === 200 || r.status === 204,
    });
  }

  sleep(2);
}
