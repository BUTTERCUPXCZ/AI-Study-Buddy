# k6 Load Testing for AI Study Buddy

## Installation
k6 v1.4.2 is installed on your system.

## Available Test Suites

### 1. **load-test.js** - Comprehensive Load Test
Tests all major features with realistic user workflows.

**Features tested:**
- Authentication (register, login, get user info)
- Notes CRUD operations (create, read, update, delete)
- Quizzes CRUD operations
- Jobs API
- Complete user workflows with cleanup

**Run:**
```powershell
k6 run k6-tests/load-test.js
```

**Load Profile:**
- Ramp up to 10 users (30s)
- Ramp up to 20 users (1m)
- Sustained 20 users (2m)
- Ramp down (30s)

---

### 2. **ai-test.js** - AI Features Benchmark
Specialized test for AI-powered features (optimized for rate limits).

**Features tested:**
- AI Notes Generation from PDF text
- AI Quiz Generation from study notes
- AI Tutor Chat (non-streaming)
- Chat session management

**Run:**
```powershell
k6 run k6-tests/ai-test.js
```

**Load Profile:**
- Sequential testing (1 user at a time)
- Extended timeouts (60s) for AI operations
- 5-second delays between requests
- Custom metrics for AI errors

**⚠️ Note:** Adjusted for Gemini free tier rate limits

---

### 2b. **ai-test-gemini-free.js** - Gemini Free Tier Safe Test
**RECOMMENDED for Gemini Free Tier** - Ultra-safe testing with maximum delays.

**Features:**
- ONE request at a time
- 60-second delays between each AI operation
- Tests 3 AI features sequentially
- Built-in rate limit detection

**Run:**
```powershell
k6 run k6-tests/ai-test-gemini-free.js
```

**Load Profile:**
- 1 virtual user
- 3 iterations (one per AI feature)
- 60s wait between operations
- Total runtime: ~3-4 minutes

**Gemini Free Tier Limits:**
- ~15 requests per minute
- ~1500 requests per day
- This test uses only 3 requests total

---

### 3. **stress-test.js** - Stress Testing
Gradually increases load to find breaking points.

**Run:**
```powershell
k6 run k6-tests/stress-test.js
```

**Load Profile:**
- 20 → 50 → 100 → 150 users
- Tests system limits
- Identifies bottlenecks

---

### 4. **spike-test.js** - Spike Testing
Sudden traffic surge simulation.

**Run:**
```powershell
k6 run k6-tests/spike-test.js
```

**Load Profile:**
- Sudden spike from 10 to 200 users
- Tests system recovery
- Validates auto-scaling

---

### 5. **soak-test.js** - Soak Testing
Extended duration test to detect memory leaks.

**Run:**
```powershell
k6 run k6-tests/soak-test.js
```

**Load Profile:**
- 20 users sustained for 30 minutes
- Detects memory leaks
- Monitors performance degradation

---

### 6. **upload-test.js** - File Upload Testing
Tests PDF file upload functionality.

**Run:**
```powershell
k6 run k6-tests/upload-test.js
```

**Features tested:**
- PDF file upload
- File retrieval
- File deletion

---

## Quick Start

### Setup (First Time Only)

Run the setup script to verify installation:
```powershell
.\k6-tests\setup.ps1
```

### Before Running Tests

1. **Start your backend server:**
```powershell
cd backend
npm run start:dev
```

2. **Ensure your database is running** (PostgreSQL/Supabase)

3. **Set up test users** (or let tests create them):
```powershell
# The tests will create users like:
# testuser0@example.com
# testuser1@example.com
# ... etc.
# All with password: TestPassword123!
```

### Quick Benchmark (Recommended First Step)

Run a quick 30-second benchmark to test your setup:
```powershell
.\k6-tests\benchmark.ps1
```

This will give you:
- Requests per second
- Average response time
- 95th and 99th percentile latencies
- Performance rating

### Using the Test Runner

The easiest way to run tests is using the PowerShell runner:

```powershell
# Quick smoke test (30 seconds)
.\k6-tests\run-test.ps1 -TestType quick

# Full load test
.\k6-tests\run-test.ps1 -TestType load

# AI features test
.\k6-tests\run-test.ps1 -TestType ai

# Stress test
.\k6-tests\run-test.ps1 -TestType stress

# Spike test
.\k6-tests\run-test.ps1 -TestType spike

# File upload test
.\k6-tests\run-test.ps1 -TestType upload

# Run all tests with JSON output
.\k6-tests\run-test.ps1 -TestType all -OutputJson

# Custom backend URL
.\k6-tests\run-test.ps1 -TestType load -BaseUrl "http://localhost:4000"
```

### Run All Tests Sequentially

```powershell
# Standard load test
k6 run k6-tests/load-test.js

# AI features test (requires AI service configured)
k6 run k6-tests/ai-test.js

# Stress test
k6 run k6-tests/stress-test.js

# Spike test
k6 run k6-tests/spike-test.js

# File upload test
k6 run k6-tests/upload-test.js

# Soak test (30+ minutes)
k6 run k6-tests/soak-test.js
```

## Advanced Usage

### Custom Configuration

**Override base URL:**
```powershell
k6 run --env BASE_URL=http://localhost:4000 k6-tests/load-test.js
```

**Custom virtual users and duration:**
```powershell
k6 run --vus 50 --duration 5m k6-tests/load-test.js
```

**Output results to JSON:**
```powershell
k6 run --out json=results.json k6-tests/load-test.js
```

**Output to multiple formats:**
```powershell
k6 run --out json=results.json --out csv=results.csv k6-tests/load-test.js
```

### Cloud Testing (k6 Cloud)

```powershell
# Login to k6 cloud
k6 login cloud

# Run test in cloud
k6 cloud k6-tests/load-test.js
```

### Integration with CI/CD

```powershell
# Run with thresholds and exit with error code if failed
k6 run --quiet k6-tests/load-test.js
```

## Understanding Results

### Key Metrics

- **http_req_duration**: Response time (p95 = 95th percentile)
- **http_req_failed**: Failed request rate
- **http_reqs**: Total requests per second
- **vus**: Current virtual users
- **iterations**: Completed test iterations

### Thresholds

Each test has predefined thresholds:
- Load test: p(95) < 2s, failure rate < 10%
- AI test: p(95) < 10s, failure rate < 20%
- Stress test: p(95) < 3s, failure rate < 30%

## Troubleshooting

### Tests Failing Due to Authentication

Ensure test users exist or can be created:
```sql
-- Check users in your database
SELECT email FROM users WHERE email LIKE 'testuser%';
```

### Connection Refused

Make sure backend is running:
```powershell
# Check if backend is running on port 3000
Test-NetConnection localhost -Port 3000
```

### Slow AI Tests

AI operations are resource-intensive:
- Reduce virtual users (default: 1 for free tier)
- Increase timeout values (60s+)
- Ensure AI service (OpenAI/Anthropic/Gemini) has sufficient quota
- **For Gemini Free Tier:** Use `ai-test-gemini-free.js` instead

### Gemini Free Tier Rate Limits

If you're using Gemini's free tier:

**Limits:**
- ~15 requests per minute
- ~1500 requests per day
- Rate limit error: HTTP 429

**Solutions:**
1. **Use the dedicated free tier test:**
   ```powershell
   k6 run k6-tests/ai-test-gemini-free.js
   ```

2. **Adjust delays in regular AI test:**
   - Already configured with 5s delays
   - Only 1 concurrent user
   - Should work within limits

3. **If you still hit rate limits:**
   - Increase `sleep()` values in `ai-test.js`
   - Reduce test duration
   - Wait 1-2 minutes between test runs

**Check for rate limits:**
```powershell
# The test will log when rate limits are hit
# Look for: "Rate limit hit on [Feature] - waiting longer..."
```

### Database Connection Issues

Check your database connection and connection pool:
```env
DATABASE_URL="your-connection-string"
```

## Performance Targets

### Expected Performance (Example)

**Load Test:**
- ✅ Auth operations: < 500ms (p95)
- ✅ CRUD operations: < 1s (p95)
- ✅ Throughput: 50+ req/s
- ✅ Error rate: < 5%

**AI Test:**
- ✅ Notes generation: < 15s (p95)
- ✅ Quiz generation: < 15s (p95)
- ✅ Chat response: < 10s (p95)
- ✅ Error rate: < 20%

## Resources

- [k6 Documentation](https://k6.io/docs/)
- [k6 Examples](https://k6.io/docs/examples/)
- [k6 Best Practices](https://k6.io/docs/misc/fine-tuning-os/)
- [k6 Cloud](https://k6.io/cloud/)

## Next Steps

1. Run basic load test to establish baseline
2. Review metrics and identify bottlenecks
3. Run stress test to find breaking points
4. Optimize backend based on results
5. Set up continuous benchmarking in CI/CD
