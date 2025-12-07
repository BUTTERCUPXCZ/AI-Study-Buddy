# Deploying NestJS Backend to Render

This guide walks you through deploying your AI Study Buddy backend to Render.

## Prerequisites

- GitHub repository (already set up: `BUTTERCUPXCZ/AI-Study-Buddy`)
- Render account (sign up at https://render.com)
- PostgreSQL database (we'll set this up on Render)
- Redis instance (Upstash Redis - already configured in your app)

## Step-by-Step Deployment

### 1. Create PostgreSQL Database on Render

1. Go to https://dashboard.render.com
2. Click **"New +"** → **"PostgreSQL"**
3. Configure:
   - **Name**: `ai-study-buddy-db` (or your preferred name)
   - **Database**: `ai_study_buddy`
   - **User**: (auto-generated)
   - **Region**: Choose closest to your users
   - **Plan**: Free (or paid for production)
4. Click **"Create Database"**
5. **Important**: Copy these connection strings from the database page:
   - **Internal Database URL** (for `DATABASE_URL`)
   - **External Database URL** (for `DIRECT_URL`)

### 2. Create Web Service on Render

1. Click **"New +"** → **"Web Service"**
2. Connect your GitHub repository: `BUTTERCUPXCZ/AI-Study-Buddy`
3. Configure the service:

#### Basic Settings:
- **Name**: `ai-study-buddy-backend`
- **Region**: Same as your database
- **Branch**: `main`
- **Root Directory**: `backend`
- **Runtime**: `Node`
- **Build Command**: `npm install --include=dev && npm run build`
- **Start Command**: `npm run start:prod`

#### Advanced Settings:
- **Plan**: Free (or paid for production)
- **Auto-Deploy**: Yes (deploys on every push to main)

### 3. Configure Environment Variables

In the Render dashboard, go to your web service → **Environment** tab, and add these variables:

```bash
# Database URLs (from Step 1)
DATABASE_URL=<Internal Database URL from Render PostgreSQL>
DIRECT_URL=<External Database URL from Render PostgreSQL>

# Server Configuration
NODE_ENV=production
PORT=3000

# Frontend URL (update after deploying frontend)
FRONTEND_ORIGIN=https://your-frontend-url.vercel.app

# Supabase Configuration
SUPABASE_URL=<your-supabase-url>
SUPABASE_KEY=<your-supabase-anon-key>

# Redis Configuration (Upstash)
REDIS_HOST=<your-upstash-redis-host>
REDIS_PORT=<your-upstash-redis-port>
REDIS_PASSWORD=<your-upstash-redis-password>
REDIS_TLS=true

# Google AI API
GEMINI_API_KEY=<your-gemini-api-key>

# JWT Secret (generate a secure random string)
JWT_SECRET=<generate-a-secure-random-string>

# File Upload Configuration
MAX_FILE_SIZE=10485760
ALLOWED_FILE_TYPES=application/pdf,text/plain
```

### 4. Run Database Migrations

After deployment, you need to run Prisma migrations:

#### Option A: Using Render Shell (Recommended)
1. Go to your web service in Render dashboard
2. Click **"Shell"** tab
3. Run:
```bash
cd backend
npx prisma migrate deploy
```

#### Option B: Add Migration to Build Command
Update your build command to:
```bash
npm install --include=dev && npx prisma migrate deploy && npm run build
```

### 5. Verify Deployment

1. Check the **"Logs"** tab in Render dashboard
2. Look for: `Application is running on: http://[::]:3000`
3. Your backend URL will be: `https://ai-study-buddy-backend.onrender.com`

### 6. Test Your API

Test your deployed backend:
```bash
curl https://ai-study-buddy-backend.onrender.com/health
```

Or visit in browser:
```
https://your-service-name.onrender.com/health
```

## Important Notes

### Free Tier Limitations
- **Spin down after 15 minutes** of inactivity
- First request after spin down takes ~30 seconds to wake up
- 750 hours/month free
- Consider upgrading for production use

### Database Connection Pooling
Your app uses Prisma with connection pooling. For production:
- Use `DATABASE_URL` for migrations (direct connection)
- Use connection pooling for application queries
- Render's internal URL is optimized for low latency

### WebSocket Considerations
- Render supports WebSockets on all plans
- Your Socket.IO configuration will work automatically
- CORS is already configured in `main.ts`

### Redis/BullMQ
- Your app uses Upstash Redis (serverless)
- Perfect for Render's environment
- No additional configuration needed

## Continuous Deployment

Once set up, deployments are automatic:
1. Push code to `main` branch
2. Render detects changes
3. Runs build command
4. Deploys new version
5. Zero-downtime deployment

## Troubleshooting

### Build Fails
- Check **Logs** tab in Render
- Ensure all environment variables are set
- Verify `prisma generate` runs in build

### "Cannot find module" Error
- If you see `Error: Cannot find module .../dist/main`, it means the build output structure is incorrect.
- Ensure `prisma.config.ts` is excluded in `tsconfig.build.json`.

### "nest: not found" Error
- If you see `sh: 1: nest: not found`, it means devDependencies aren't being installed.
- Update your build command to: `npm install --include=dev && npm run build`

### Database Connection Issues
- Verify `DATABASE_URL` and `DIRECT_URL` are correct
- Check database is in the same region
- Ensure migrations have run

### App Crashes on Start
- Check environment variables are complete
- Review startup logs
- Verify Redis connection details

### Cold Start Issues (Free Tier)
- First request takes 30+ seconds after inactivity
- Consider a health check ping service (cron-job.org)
- Or upgrade to paid plan for always-on

## Monitoring

Render provides:
- **Metrics**: CPU, Memory, Request count
- **Logs**: Real-time application logs
- **Alerts**: Set up notifications for issues

## Upgrading

To upgrade from free tier:
1. Go to web service settings
2. Change plan to **Starter ($7/mo)** or higher
3. Benefits: No spin-down, better performance, more resources

## Next Steps

1. Deploy your frontend to Vercel
2. Update `FRONTEND_ORIGIN` environment variable
3. Set up custom domain (optional)
4. Configure monitoring and alerts
5. Set up staging environment (optional)

## Useful Commands

### View logs:
```bash
# In Render dashboard → Logs tab
```

### Run migrations:
```bash
# In Render dashboard → Shell tab
npx prisma migrate deploy
```

### Restart service:
```bash
# In Render dashboard → Manual Deploy → "Clear build cache & deploy"
```

## Support

- Render Docs: https://render.com/docs
- Render Community: https://community.render.com
- NestJS Deployment: https://docs.nestjs.com/deployment

---

**Your backend will be live at**: `https://your-service-name.onrender.com`
