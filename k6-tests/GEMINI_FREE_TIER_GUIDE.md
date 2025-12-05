# Gemini Free Tier Load Testing Guide

## 🚨 Gemini Free Tier Limits

**Rate Limits:**
- **~15 requests per minute** (RPM)
- **~1,500 requests per day** (RPD)
- **Error Code:** HTTP 429 (Too Many Requests)

## ✅ Recommended Approach

### Option 1: Ultra-Safe Test (RECOMMENDED)

Use the dedicated Gemini free tier test:

```powershell
k6 run k6-tests/ai-test-gemini-free.js
```

**What it does:**
- Tests 3 AI features sequentially
- ONE request at a time
- 60-second delay between each request
- Total: Only 3 AI requests
- Duration: ~3-4 minutes

**Safe to run:** Multiple times per day without hitting limits

---

### Option 2: Standard AI Test (Modified)

The standard AI test has been updated for free tier:

```powershell
k6 run k6-tests/ai-test.js
```

**Changes made:**
- ✅ Reduced to 1 concurrent user (was 3-5)
- ✅ Increased delays to 5 seconds between requests
- ✅ Extended timeouts to 60 seconds
- ✅ Added rate limit detection (HTTP 429)
- ✅ Allows 30% error rate for rate limits

**Load Profile:**
- 1 user for 3 minutes
- ~12-15 AI requests total
- 5s delay between requests
- Should stay within limits

---

### Option 3: Using Test Runner

```powershell
# Ultra-safe Gemini test
.\k6-tests\run-test.ps1 -TestType ai-free

# Standard AI test (rate-limit safe)
.\k6-tests\run-test.ps1 -TestType ai
```

---

## 📊 Understanding Rate Limits

### How Many Requests Per Test?

**Ultra-Safe Test (`ai-test-gemini-free.js`):**
- 3 AI requests total
- Safe to run 500 times per day

**Standard AI Test (`ai-test.js`):**
- ~12-15 AI requests per run
- Safe to run ~100 times per day
- Respects RPM limit with 5s delays

**Load Test (no AI):**
- 0 AI requests
- Run unlimited (only tests database/API)

---

## 🛡️ What If I Hit Rate Limits?

### Symptoms:
```
HTTP 429 - Too Many Requests
Rate limit hit on [Feature] - waiting longer...
```

### Solutions:

**1. Increase Delays:**
Edit `ai-test.js` and change sleep values:
```javascript
sleep(5);  // Change to sleep(10) or higher
```

**2. Wait Between Runs:**
```powershell
# Run test
k6 run k6-tests/ai-test-gemini-free.js

# Wait 3-5 minutes

# Run again
k6 run k6-tests/ai-test-gemini-free.js
```

**3. Use Only Ultra-Safe Test:**
```powershell
# This is always safe
k6 run k6-tests/ai-test-gemini-free.js
```

**4. Test Non-AI Features:**
```powershell
# These don't use AI - run unlimited
k6 run k6-tests/load-test.js
k6 run k6-tests/upload-test.js
```

---

## 🎯 Testing Strategy for Free Tier

### Daily Testing Workflow

**Morning:**
```powershell
# Quick non-AI validation
.\k6-tests\benchmark.ps1

# Load test (no AI)
k6 run k6-tests/load-test.js
```

**When Needed:**
```powershell
# Test AI features (once or twice per day)
k6 run k6-tests/ai-test-gemini-free.js

# Wait 5 minutes between runs if testing again
```

**Before Deployment:**
```powershell
# Full test suite (uses ai-free for AI tests)
.\k6-tests\run-test.ps1 -TestType all
```

---

## 📈 Monitoring Rate Limits

### Check Test Output

The tests will log rate limit hits:

```
✅ AI Notes Generation successful
⚠️ Rate limit hit on Quiz Generation - waiting longer...
✅ AI Tutor Chat successful
```

### Manual Check

Check your Gemini API dashboard for usage:
- [Google AI Studio](https://makersuite.google.com/app/apikey)

---

## 🔧 Customizing for Your Needs

### If You Need More AI Testing

**Option A: Run tests at different times**
```powershell
# Morning
k6 run k6-tests/ai-test-gemini-free.js

# Afternoon (3+ hours later)
k6 run k6-tests/ai-test-gemini-free.js

# Evening (3+ hours later)
k6 run k6-tests/ai-test-gemini-free.js
```

**Option B: Upgrade Gemini tier**
- [Google AI Pricing](https://ai.google.dev/pricing)
- Paid tier: 360 RPM, much higher daily limits

**Option C: Mix testing approaches**
```powershell
# Test most features without AI
k6 run k6-tests/load-test.js

# Test AI sparingly
k6 run k6-tests/ai-test-gemini-free.js
```

---

## ✅ Best Practices

1. **Start with ultra-safe test** to verify AI is working
2. **Run non-AI tests frequently** (unlimited)
3. **Run AI tests sparingly** (1-2 times per development session)
4. **Monitor for 429 errors** in test output
5. **Wait 1-5 minutes** between AI test runs
6. **Use load test for regular benchmarking** (no AI = no limits)

---

## 🚀 Quick Commands Reference

```powershell
# ALWAYS SAFE (no AI calls)
k6 run k6-tests/load-test.js
k6 run k6-tests/stress-test.js
k6 run k6-tests/spike-test.js
k6 run k6-tests/upload-test.js
.\k6-tests\benchmark.ps1

# SAFE FOR FREE TIER (with AI)
k6 run k6-tests/ai-test-gemini-free.js  # 3 requests
k6 run k6-tests/ai-test.js              # ~12-15 requests

# USE TEST RUNNER
.\k6-tests\run-test.ps1 -TestType ai-free   # Ultra-safe
.\k6-tests\run-test.ps1 -TestType ai        # Rate-limit safe
.\k6-tests\run-test.ps1 -TestType load      # No AI
```

---

## 📝 Summary

| Test Type | AI Requests | Safe to Run | Duration |
|-----------|-------------|-------------|----------|
| `ai-test-gemini-free.js` | 3 | ✅ 500x/day | 3-4 min |
| `ai-test.js` | ~12-15 | ✅ 100x/day | 4-5 min |
| `load-test.js` | 0 | ✅ Unlimited | 4 min |
| `stress-test.js` | 0 | ✅ Unlimited | 12 min |
| All other tests | 0 | ✅ Unlimited | Varies |

**Recommendation:** Use `ai-test-gemini-free.js` for AI testing on free tier! 🎯
