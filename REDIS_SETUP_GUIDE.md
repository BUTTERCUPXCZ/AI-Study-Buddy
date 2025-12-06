# Redis Setup Guide for AI Study Buddy

## Problem
The application uses BullMQ for background job processing (PDF uploads, AI completions, etc.), which **requires Redis** to be running. You're seeing `ECONNREFUSED` errors because Redis isn't configured.

## Quick Solutions

### Option 1: Local Redis (Recommended for Development) ⚡

**Windows - Using Chocolatey:**
```powershell
# Install Chocolatey if not already installed
Set-ExecutionPolicy Bypass -Scope Process -Force; [System.Net.ServicePointManager]::SecurityProtocol = [System.Net.ServicePointManager]::SecurityProtocol -bor 3072; iex ((New-Object System.Net.WebClient).DownloadString('https://community.chocolatey.org/install.ps1'))

# Install Redis
choco install redis-64 -y

# Start Redis
redis-server
```

**Windows - Using MSI Installer:**
1. Download from: https://github.com/microsoftarchive/redis/releases
2. Install Redis-x64-3.0.504.msi
3. Redis will run as a Windows service automatically

**Verify Redis is running:**
```powershell
redis-cli ping
# Should return: PONG
```

**Add to your .env:**
```env
REDIS_HOST=localhost
REDIS_PORT=6379
# No password needed for local development
```

---

### Option 2: Use Upstash Redis TCP Endpoint 🌐

You already have Upstash configured for REST API. Upstash also provides TCP endpoints:

1. Go to https://console.upstash.com/redis
2. Click on your database
3. Find "Endpoint" section - copy the TCP endpoint (looks like `example-12345.upstash.io`)
4. Copy the port (usually `6379` or `33369` for TLS)
5. Copy your password

**Add to your .env:**
```env
REDIS_HOST=your-database.upstash.io
REDIS_PORT=6379
REDIS_PASSWORD=your_upstash_password
```

---

### Option 3: Docker Redis 🐳

If you have Docker installed:

```powershell
# Start Redis in a container
docker run --name redis-dev -d -p 6379:6379 redis:alpine

# Verify it's running
docker ps
```

**Add to your .env:**
```env
REDIS_HOST=localhost
REDIS_PORT=6379
```

---

## Current Configuration Status

✅ **REST Redis (Upstash)** - Already configured for caching
- Used by: `redis.service.ts`
- Environment vars: `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`

❌ **TCP Redis (BullMQ)** - NOT configured (causing errors)
- Used by: Job queues, workers, BullMQ
- Environment vars needed: `REDIS_HOST`, `REDIS_PORT`, `REDIS_PASSWORD`

## Why Two Redis Connections?

1. **REST API (Upstash)** - For simple cache operations via HTTP
2. **TCP Connection (BullMQ)** - For job queues, requires persistent TCP connection

You can use Upstash for both by configuring the TCP endpoint!

## After Setup

1. Add Redis environment variables to your `.env` file
2. Restart the application: `npm run start:dev`
3. Test PDF upload to verify workers are processing jobs

## Verification

Check if Redis is working:
```powershell
# In the app logs, you should see:
# ✓ Connected to BullMQ Redis
# ✓ Workers started successfully
# ✓ Ultra-optimized PDF worker ready

# No more ECONNREFUSED errors!
```

## Troubleshooting

**Still getting connection errors?**
- Verify Redis is running: `redis-cli ping` (local) or check Upstash console
- Check firewall isn't blocking port 6379
- Verify environment variables are loaded: `console.log(process.env.REDIS_HOST)`

**Workers not processing?**
- Check queue status: `GET http://localhost:3000/jobs/ultra-optimized/metrics`
- View job logs in application console
- Verify Redis connection in BullMQ dashboard

## Performance Benefits with Redis

With Redis properly configured, you'll get:
- ✅ Background job processing (no blocking API requests)
- ✅ Multi-level caching (6-10s processing vs 30-50s)
- ✅ Job deduplication (avoid duplicate processing)
- ✅ Retry logic and failure handling
- ✅ Queue monitoring and metrics
