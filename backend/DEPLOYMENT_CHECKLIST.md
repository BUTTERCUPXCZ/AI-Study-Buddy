# Render Deployment Checklist

## Pre-Deployment
- [x] Updated `package.json` build script to include Prisma generation
- [x] Added health check endpoint at `/health`
- [x] Created `render.yaml` configuration file
- [ ] Push all changes to GitHub `main` branch

## Render Setup

### 1. Create PostgreSQL Database
- [ ] Sign up/login to Render: https://dashboard.render.com
- [ ] Click "New +" → "PostgreSQL"
- [ ] Name: `ai-study-buddy-db`
- [ ] Region: Choose closest to your users (e.g., Oregon, Ohio)
- [ ] Plan: Free (for testing) or Starter (for production)
- [ ] Click "Create Database"
- [ ] **Save these URLs** (found on database info page):
  - [ ] Internal Database URL → Use for `DATABASE_URL`
  - [ ] External Database URL → Use for `DIRECT_URL`

### 2. Create Web Service
- [ ] Click "New +" → "Web Service"
- [ ] Connect to GitHub repository: `BUTTERCUPXCZ/AI-Study-Buddy`
- [ ] Configure:
  - **Name**: `ai-study-buddy-backend`
  - **Region**: Same as database
  - **Branch**: `main`
  - **Root Directory**: `backend`
  - **Runtime**: Node
  - **Build Command**: `npm install && npm run build`
  - **Start Command**: `npm run start:prod`
  - **Plan**: Free or Starter
- [ ] Click "Create Web Service"

### 3. Environment Variables
Add these in Render Dashboard → Environment tab:

#### Required Variables
- [ ] `DATABASE_URL` = (Internal Database URL from PostgreSQL)
- [ ] `DIRECT_URL` = (External Database URL from PostgreSQL)
- [ ] `NODE_ENV` = production
- [ ] `PORT` = 3000
- [ ] `SUPABASE_URL` = (Your Supabase project URL)
- [ ] `SUPABASE_KEY` = (Your Supabase anon key)
- [ ] `GEMINI_API_KEY` = (Your Google AI API key)
- [ ] `JWT_SECRET` = (Generate random string: https://generate-secret.vercel.app)

#### Redis Configuration (Upstash)
- [ ] `REDIS_HOST` = (Your Upstash Redis host)
- [ ] `REDIS_PORT` = (Your Upstash Redis port)
- [ ] `REDIS_PASSWORD` = (Your Upstash Redis password)
- [ ] `REDIS_TLS` = true

#### Optional Configuration
- [ ] `FRONTEND_ORIGIN` = (Your frontend URL, update after deploying frontend)
- [ ] `MAX_FILE_SIZE` = 10485760
- [ ] `ALLOWED_FILE_TYPES` = application/pdf,text/plain

### 4. Run Database Migration
After first deployment:
- [ ] Go to your web service → "Shell" tab
- [ ] Run: `npx prisma migrate deploy`
- [ ] Verify migration completed successfully

### 5. Verify Deployment
- [ ] Check "Logs" tab for successful startup
- [ ] Look for: "Application is running on: http://[::]:3000"
- [ ] Test health endpoint: `https://your-service-name.onrender.com/health`
- [ ] Test root endpoint: `https://your-service-name.onrender.com/`

## Post-Deployment

### Test API Endpoints
- [ ] Health: `GET https://your-service-name.onrender.com/health`
- [ ] Auth: `POST https://your-service-name.onrender.com/auth/register`
- [ ] WebSocket: Test Socket.IO connection

### Update Frontend
- [ ] Update frontend API URL to: `https://your-service-name.onrender.com`
- [ ] Deploy frontend (Vercel recommended)
- [ ] Update `FRONTEND_ORIGIN` in Render environment variables
- [ ] Test CORS is working

### Monitor
- [ ] Check Render Dashboard → Metrics
- [ ] Review logs for any errors
- [ ] Set up alerts (optional)

## Common Issues & Solutions

### ❌ Build Fails
- Check all dependencies are in `package.json`
- Verify `prisma` is in `devDependencies`
- Check build logs for specific errors

### ❌ Database Connection Error
- Verify `DATABASE_URL` is correct (use Internal URL)
- Ensure database is in same region as web service
- Check database is running

### ❌ App Crashes on Start
- Check all environment variables are set
- Review startup logs for missing configs
- Verify Redis connection details

### ❌ Migrations Not Applied
- Run manually in Shell: `npx prisma migrate deploy`
- Or add to build command: `npm install && npx prisma migrate deploy && npm run build`

### ⚠️ Cold Starts (Free Tier)
- Free tier spins down after 15 minutes inactivity
- First request takes ~30 seconds to wake up
- Solution: Upgrade to Starter plan ($7/mo) or use UptimeRobot to ping

## Important Links

- **Render Dashboard**: https://dashboard.render.com
- **Your Backend URL**: `https://your-service-name.onrender.com`
- **Render Docs**: https://render.com/docs/deploy-node-express-app

## Useful Commands

### View Real-time Logs:
```bash
# In Render Dashboard → Logs tab
```

### Manual Redeploy:
```bash
# In Render Dashboard → Manual Deploy → "Deploy latest commit"
```

### Clear Cache & Redeploy:
```bash
# In Render Dashboard → Manual Deploy → "Clear build cache & deploy"
```

### Run Prisma Commands:
```bash
# In Render Dashboard → Shell tab
npx prisma migrate deploy    # Apply migrations
npx prisma db push           # Push schema changes (dev only)
npx prisma generate          # Generate Prisma Client
npx prisma studio            # Open Prisma Studio (if needed)
```

## Upgrade Path

**Free Tier**: 750 hours/month, spins down after inactivity
**Starter ($7/mo)**: Always on, better performance, 512MB RAM
**Standard ($25/mo)**: 2GB RAM, priority support

## Next Steps
1. [ ] Deploy frontend to Vercel
2. [ ] Set up custom domain (optional)
3. [ ] Configure monitoring/logging
4. [ ] Set up CI/CD workflows (optional)
5. [ ] Create staging environment (optional)

---

**Deployment Status**: ⏳ Not Started | 🚧 In Progress | ✅ Complete

**Backend URL**: `https://_____________________.onrender.com`
**Deployment Date**: ___________________
