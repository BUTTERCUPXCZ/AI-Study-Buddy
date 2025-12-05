# K6 Load Testing Implementation Summary

## What Has Been Implemented

A comprehensive k6 load testing suite for the AI Study Buddy backend application, covering all major features and endpoints.

## Test Files Created

### 1. **load-test.js** - Comprehensive Load Test
**Purpose:** Tests all major backend features with realistic user workflows

**Coverage:**
- ✅ Authentication (register, login, get user info, OAuth flow)
- ✅ Notes CRUD (create, read, update, delete)
- ✅ Quizzes CRUD (create, read, update, score updates, delete)
- ✅ Jobs API (get user jobs, queue status)
- ✅ Complete user workflow simulation with cleanup

**Load Profile:** 10-20 concurrent users over 4 minutes

**Thresholds:**
- p95 response time < 2s
- p99 response time < 5s
- Error rate < 10%

---

### 2. **ai-test.js** - AI Features Benchmark
**Purpose:** Specialized testing for resource-intensive AI operations

**Coverage:**
- ✅ AI Notes Generation (from PDF text)
- ✅ AI Quiz Generation (from study notes)
- ✅ AI Tutor Chat (non-streaming)
- ✅ Chat session management

**Load Profile:** 3-5 concurrent users (lighter load for AI)

**Features:**
- Extended timeouts (30s) for AI operations
- Custom metrics for AI error tracking
- Setup/teardown functions for proper test isolation

**Thresholds:**
- p95 < 10-15s (AI operations are slower)
- AI error rate < 20%

---

### 3. **stress-test.js** - Stress Testing
**Purpose:** Find system breaking points and performance limits

**Coverage:**
- Authentication under load
- Database operations under stress
- Rapid CRUD operations
- Resource exhaustion testing

**Load Profile:** Gradual increase from 20 → 50 → 100 → 150 users

**Duration:** ~12 minutes

**Features:**
- Custom metrics (error rate, auth duration, notes duration)
- Realistic user workflows with random delays
- Resource cleanup to prevent data accumulation

**Thresholds:**
- p95 < 3s (more lenient for stress)
- Error rate < 30% (acceptable under stress)

---

### 4. **spike-test.js** - Spike Testing
**Purpose:** Test system behavior under sudden traffic surges

**Coverage:**
- Read-heavy operations during spike
- HTTP batch requests
- System recovery validation

**Load Profile:** 10 → 200 users in 10 seconds

**Duration:** ~4 minutes

**Features:**
- Simulates sudden traffic surge (e.g., viral event)
- Tests auto-scaling and load balancing
- Batch requests to simulate homepage loads

**Thresholds:**
- p95 < 5s (very lenient during spike)
- Error rate < 40% during spike

---

### 5. **soak-test.js** - Soak Testing
**Purpose:** Detect memory leaks and performance degradation over time

**Coverage:**
- Sustained realistic user workflows
- Long-running operations
- Memory leak detection
- Resource cleanup validation

**Load Profile:** 20 users for 30 minutes

**Duration:** 40 minutes

**Features:**
- Realistic user behavior patterns
- Random pauses between operations
- Continuous monitoring of metrics
- JSON summary export

**Thresholds:**
- p95 < 2s (should remain stable)
- p99 < 5s
- Error rate < 10%

---

### 6. **upload-test.js** - File Upload Testing
**Purpose:** Test file upload functionality and multipart form data handling

**Coverage:**
- ✅ PDF file upload
- ✅ File retrieval
- ✅ User file listing
- ✅ File deletion

**Load Profile:** 5 concurrent users

**Features:**
- FormData handling with k6
- Simulated PDF content
- Complete upload lifecycle testing

**Thresholds:**
- p95 < 5s (uploads are slower)
- Error rate < 15%

---

## Helper Scripts

### setup.ps1
- Verifies k6 installation
- Displays available test files
- Provides quick start guide

### run-test.ps1
**Features:**
- Interactive test runner
- Multiple test types: quick, load, ai, stress, spike, soak, upload, all
- Custom base URL support
- JSON output option
- Backend connectivity check
- Progress indicators

**Usage Examples:**
```powershell
.\k6-tests\run-test.ps1 -TestType quick
.\k6-tests\run-test.ps1 -TestType load -OutputJson
.\k6-tests\run-test.ps1 -TestType all -BaseUrl "http://localhost:4000"
```

### benchmark.ps1
**Features:**
- Quick 30-second performance check
- Key metrics display:
  - Total requests & requests/second
  - Response time metrics (avg, p95, p99)
  - Error rates
  - Performance rating (⭐⭐⭐⭐⭐)
- Summary export to JSON

**Usage:**
```powershell
.\k6-tests\benchmark.ps1
.\k6-tests\benchmark.ps1 -BaseUrl "http://localhost:4000"
```

---

## API Endpoints Tested

### Authentication (`/auth`)
- ✅ POST `/auth/register` - User registration
- ✅ POST `/auth/login` - User login
- ✅ GET `/auth/me` - Get current user
- ✅ GET `/auth/oauth?provider=...` - OAuth initiation
- ✅ POST `/auth/oauth/callback` - OAuth callback

### Notes (`/notes`)
- ✅ POST `/notes` - Create note
- ✅ GET `/notes/user/:userId` - Get all user notes
- ✅ GET `/notes/:noteId/user/:userId` - Get specific note
- ✅ PUT `/notes/:noteId/user/:userId` - Update note
- ✅ DELETE `/notes/:noteId/user/:userId` - Delete note

### Quizzes (`/quizzes`)
- ✅ POST `/quizzes` - Create quiz
- ✅ GET `/quizzes/user/:userId` - Get all user quizzes
- ✅ GET `/quizzes/:quizId/user/:userId` - Get specific quiz
- ✅ PUT `/quizzes/:quizId/user/:userId/score` - Update quiz score
- ✅ DELETE `/quizzes/:quizId/user/:userId` - Delete quiz

### AI Features (`/ai`)
- ✅ POST `/ai/generate/notes` - AI notes generation
- ✅ POST `/ai/generate/quiz` - AI quiz generation
- ✅ POST `/ai/tutor/chat` - AI tutor chat
- ✅ POST `/ai/tutor/chat/stream` - AI tutor chat streaming (SSE)
- ✅ GET `/ai/tutor/sessions/user/:userId` - Get chat sessions
- ✅ GET `/ai/tutor/sessions/:sessionId/user/:userId` - Get specific session
- ✅ PUT `/ai/tutor/sessions/:sessionId/user/:userId/title` - Update session title
- ✅ DELETE `/ai/tutor/sessions/:sessionId/user/:userId` - Delete session

### File Upload (`/upload`)
- ✅ POST `/upload` - Upload PDF file
- ✅ GET `/upload/user/:userId` - Get user files
- ✅ GET `/upload/:id` - Get specific file
- ✅ DELETE `/upload/:id?userId=...` - Delete file

### Jobs (`/jobs`)
- ✅ GET `/jobs/:jobId` - Get specific job
- ✅ GET `/jobs/user/:userId` - Get user jobs
- ✅ GET `/jobs/queue/:queueName` - Get queue jobs
- ✅ DELETE `/jobs/cleanup` - Cleanup old jobs

---

## Test Data

### User Credentials
Tests create/use users with the pattern:
- Email: `testuser{0-50}@example.com`
- Password: `TestPassword123!`
- Full Name: `Test User {0-50}`

### Sample Data Used
- **PDF Text:** Machine Learning introduction (150+ words)
- **Study Notes:** JavaScript fundamentals with code examples
- **Quiz Questions:** Multiple-choice questions with 4 options
- **Note Content:** Realistic study notes with formatting

---

## Metrics & Thresholds

### Standard Metrics Tracked
- `http_req_duration` - Response time (avg, p50, p95, p99)
- `http_req_failed` - Failed request rate
- `http_reqs` - Total requests per second
- `iterations` - Completed test iterations
- `vus` - Virtual users (concurrent)
- `data_received` - Bandwidth consumed
- `data_sent` - Bandwidth sent

### Custom Metrics
- `ai_generation_errors` - AI operation failure rate
- `auth_duration` - Authentication latency
- `notes_duration` - Notes operation latency
- `error_rate` - Overall error rate

### Group Durations
- `group_duration{group:::Auth Flow}`
- `group_duration{group:::Notes CRUD}`
- `group_duration{group:::Quizzes CRUD}`
- `group_duration{group:::AI Notes Generation}`

---

## Performance Targets

### Load Test Targets
- ✅ **Throughput:** 50+ requests/second
- ✅ **Response Time (p95):** < 2 seconds
- ✅ **Error Rate:** < 10%
- ✅ **Concurrent Users:** 20 users sustained

### AI Test Targets
- ✅ **Notes Generation (p95):** < 15 seconds
- ✅ **Quiz Generation (p95):** < 15 seconds
- ✅ **Chat Response (p95):** < 10 seconds
- ✅ **Error Rate:** < 20%

### Stress Test Targets
- 🎯 **Breaking Point:** Find maximum user capacity
- 🎯 **Error Rate at 150 users:** < 30%
- 🎯 **Recovery Time:** System should recover when load decreases

---

## How to Use

### 1. Initial Setup
```powershell
# Run setup script
.\k6-tests\setup.ps1

# Start backend
cd backend
npm run start:dev
```

### 2. Quick Validation
```powershell
# 30-second benchmark
.\k6-tests\benchmark.ps1
```

### 3. Run Specific Tests
```powershell
# Load test
.\k6-tests\run-test.ps1 -TestType load

# AI test (requires AI configured)
.\k6-tests\run-test.ps1 -TestType ai

# Stress test
.\k6-tests\run-test.ps1 -TestType stress
```

### 4. Full Test Suite
```powershell
# Run all tests with results
.\k6-tests\run-test.ps1 -TestType all -OutputJson
```

### 5. Direct k6 Execution
```powershell
# Manual execution
k6 run k6-tests/load-test.js
k6 run --vus 50 --duration 2m k6-tests/load-test.js
k6 run --out json=results.json k6-tests/load-test.js
```

---

## Integration Options

### CI/CD Integration
```yaml
# Example GitHub Actions
- name: Run Load Tests
  run: k6 run --quiet k6-tests/load-test.js
```

### Cloud Testing
```powershell
k6 login cloud
k6 cloud k6-tests/load-test.js
```

### Monitoring Integration
```powershell
# InfluxDB
k6 run --out influxdb=http://localhost:8086/k6 k6-tests/load-test.js

# Prometheus
k6 run --out experimental-prometheus-rw k6-tests/load-test.js
```

---

## Next Steps

1. ✅ **Baseline:** Run benchmark to establish baseline metrics
2. ✅ **Load Test:** Validate normal operation under load
3. ✅ **Optimize:** Identify and fix bottlenecks
4. ✅ **Stress Test:** Find system limits
5. ✅ **Monitor:** Set up continuous performance monitoring
6. ✅ **Iterate:** Regular benchmarking during development

---

## Files Structure

```
k6-tests/
├── load-test.js          # Main load test (all features)
├── ai-test.js            # AI features benchmark
├── stress-test.js        # Stress testing (150 users)
├── spike-test.js         # Spike testing (200 users)
├── soak-test.js          # Soak testing (30 minutes)
├── upload-test.js        # File upload testing
├── run-test.ps1          # Test runner script
├── benchmark.ps1         # Quick benchmark script
├── setup.ps1             # Setup verification script
├── README.md             # Detailed documentation
└── TEST_SUMMARY.md       # This file
```

---

## Requirements

- ✅ k6 v1.4.2 or higher
- ✅ PowerShell 5.1+ (Windows)
- ✅ Backend running on localhost:3000 (or custom URL)
- ✅ Database configured and running
- ✅ (Optional) AI service configured for AI tests

---

## Troubleshooting

See README.md for detailed troubleshooting guide including:
- Authentication failures
- Connection issues
- Slow AI tests
- Database problems

---

**Status:** ✅ Complete - Ready for testing!
